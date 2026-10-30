// Multiplayer rooms on Supabase, for when the game is hosted somewhere static (GitHub Pages) with no room server.
//
//  - The lobby list is the `rooms` table (see supabase/schema.sql); the host keeps its row fresh.
//  - Everything inside a room travels over one Realtime channel: Presence says who is in the room, and
//    Broadcast carries positions, hits, fx and the Wave Defense traffic.
//  - The room's referee (scores, win, start, settings, the opening-scene sync) is whoever is the host. It is
//    the same logic server/rooms.mjs runs locally; here the host's browser runs it. If the host leaves, the
//    longest-serving member takes over.
//
// It looks exactly like Net (game/net.js) from the outside, so the game does not care which one it has.

import { TEAMS, TEAM_COUNTS } from './teams.js';
import { seedForMode } from './maps.js';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to keep codes easy to read out loud
const HOURS_PER_SECOND = 24 / 360; // keep in step with the client's day length
const START_HOUR = 8;
const KILL_TARGET = 10;
const MONSTER_TARGET = 15;
const MAX_PLAYERS = 10;
const INTRO_MAX_MS = 45000; // the longest everyone waits for slow players to finish the opening scene
const CELEBRATE_MS = 7000; // how long a winner is cheered before everyone returns to the waiting room
const HEARTBEAT_MS = 15000; // the host touches its lobby row this often
const STALE_MS = 45000; // a room whose row has not been touched for this long is not listed (its host would have refreshed it)
const DELETE_AFTER_MS = 90000; // ...and one this old is deleted by whoever next looks at the lobby

const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);
const num = (v) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : 0);
const defaultTarget = (winBy) => (winBy === 'monsters' ? MONSTER_TARGET : KILL_TARGET);
const clampTarget = (v, fallback) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.min(99, Math.max(1, Math.round(Number(v)))) : fallback);
const newId = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
const newCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

const CFG_KEYS = ['name', 'seed', 'max', 'mode', 'difficulty', 'pvp', 'winBy', 'target', 'allowLate', 'allowThrow', 'allowMelee', 'allowCheats', 'streakMonsters', 'teams', 'startMoney'];
const pickCfg = (room) => Object.fromEntries(CFG_KEYS.map((k) => [k, room[k]]));

function friendly(error) {
  const text = `${error?.code || ''} ${error?.message || error || ''}`;
  if (/PGRST205|42P01|schema cache|does not exist/i.test(text)) {
    return "Rooms aren't set up in Supabase yet. Run supabase/schema.sql in the Supabase SQL Editor.";
  }
  return error?.message || String(error);
}

const rowToSummary = (r) => ({
  code: r.code,
  name: r.name,
  seed: r.seed,
  max: r.max,
  pvp: r.pvp,
  mode: r.mode,
  difficulty: r.difficulty,
  target: r.target,
  winBy: r.win_by,
  allowLate: r.allow_late,
  allowThrow: r.allow_throw,
  allowMelee: r.allow_melee,
  streakMonsters: r.streak_monsters,
  teams: r.teams || 0,
  count: r.count,
  started: r.started,
  host: r.host_name,
});

const cfgToRow = (cfg) => ({
  name: cfg.name,
  seed: cfg.seed,
  max: cfg.max,
  mode: cfg.mode,
  difficulty: cfg.difficulty,
  pvp: cfg.pvp,
  win_by: cfg.winBy,
  target: cfg.target,
  allow_late: cfg.allowLate,
  allow_throw: cfg.allowThrow,
  allow_melee: cfg.allowMelee,
  streak_monsters: cfg.streakMonsters,
  teams: cfg.teams || 0,
});

export class SupaNet {
  // `flushMs`: how often a player's outgoing messages are sent, together in one batch
  constructor(getClient, { flushMs = 100, sweepMs = 3500 } = {}) {
    this.getClient = getClient;
    this.flushMs = flushMs;
    this.sweepMs = sweepMs; // how long after leaving a room we double-check that it is really empty
    // closing the tab skips leave(), so tidy the room's row on the way out
    if (typeof window !== 'undefined') window.addEventListener('pagehide', () => this.dropOnUnload());
    this.status = 'connecting'; // connecting | online | offline
    this.rooms = [];
    this.lan = [];
    this.problem = ''; // something worth telling the player (for example, the rooms table is missing)
    this.listeners = new Set();
    this.wantLobby = false;
    this.closed = false;
    this.me = newId();
    this.sb = null;
    this.online = []; // everyone else who has the game open: { id, name, hero, room, roomName }
    this.identity = { name: 'Friend', hero: 'adam' };
    this.lobbyCh = null;
    this.lobbyReady = false;
    this.timers = { lobby: 0, heartbeat: 0, state: 0, intro: 0, back: 0, hostWatch: 0, aiSync: 0 };
    this.resetRoom();
    this.connect();
  }

  get offlineText() {
    return "Can't reach Supabase. Check your internet connection and the VITE_SUPABASE_* values in .env.";
  }

  get roomCode() {
    return this.code;
  }

  get isHost() {
    return this.hostId === this.me;
  }

  // Computer players (AI) sit in seats like heroes do, but only the host's game plays them. Everyone keeps them in `members`
  // (flagged `ai`), so the seats, scores and teams treat them like anyone else; real players are what the rest counts on.
  humans() {
    return [...this.members.values()].filter((m) => !m.ai);
  }

  aiList() {
    return [...this.members.values()].filter((m) => m.ai).map((m) => this.publicPlayer(m));
  }

  sendAis() {
    if (this.isHost && this.channel) this.out({ t: 'ais', list: this.aiList() });
  }

  resetRoom() {
    this.channel = null;
    this.code = null;
    this.cfg = null;
    this.members = new Map(); // id -> { id, name, hero, slot, at }
    this.posOf = new Map(); // id -> last known position
    this.known = new Map(); // everyone who has been in the room: id -> their details (to put back someone wrongly marked as gone)
    this.strays = {}; // id -> how many positions arrived from someone we think has left
    this.teamMap = {}; // id -> team number (the host decides; everyone keeps a copy)
    this.hostId = null;
    this.started = false;
    this.winning = false;
    this.paused = false; // the host has paused the game for everyone
    this.syncing = false;
    this.startHour = START_HOUR;
    this.t0 = Date.now();
    this.kills = new Map();
    this.firstDone = false; // has anyone been taken down yet this round (for First Blood)
    this.lastScores = []; // what the host last announced (so a new host can carry on)
    this.introOpen = false;
    this.introReady = new Set();
    this.pos = { x: 0, y: 0, dir: 'down', moving: false, hp: 6, hidden: false, lv: 1 };
    this.outbox = []; // messages waiting for the next batch
    this.flushT = 0;
    this.gotSync = null;
  }

  async connect() {
    this.sb = await this.getClient();
    this.setStatus(this.sb ? 'online' : 'offline');
    if (this.sb) this.openLobbyChannel();
  }

  // ---------- who is online, and invites ----------
  // One channel that every browser with the game open joins. Presence is the "players online" list, and an
  // invite is a broadcast addressed to one player; it reaches them wherever they are (menu, waiting room, in a game).

  openLobbyChannel() {
    if (this.lobbyCh || !this.sb) return;
    const ch = this.sb.channel('cuzy-lobby', { config: { broadcast: { self: false }, presence: { key: this.me } } });
    this.lobbyCh = ch;
    ch.on('broadcast', { event: 'invite' }, ({ payload }) => this.onInvite(payload));
    ch.on('broadcast', { event: 'gchat' }, ({ payload }) => this.onGlobalChat(payload));
    for (const event of ['sync', 'join', 'leave']) ch.on('presence', { event }, () => this.refreshOnline());
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        this.lobbyReady = true;
        this.trackLobby();
      }
    });
  }

  // tell everyone who we are and where we are
  trackLobby() {
    if (!this.lobbyCh || !this.lobbyReady) return;
    this.lobbyCh.track({ id: this.me, ...this.identity, room: this.code || null, roomName: this.cfg?.name || '', at: Date.now() }).catch?.(() => {});
  }

  setIdentity(p) {
    this.identity = { name: clean(p?.name, 14) || 'Friend', hero: clean(p?.hero, 32) || 'adam' };
    this.trackLobby();
  }

  refreshOnline() {
    if (!this.lobbyCh) return;
    const players = [];
    for (const [key, metas] of Object.entries(this.lobbyCh.presenceState())) {
      const m = metas[0];
      if (m && key !== this.me && m.id) players.push({ id: m.id, name: m.name, hero: m.hero, room: m.room || null, roomName: m.roomName || '' });
    }
    players.sort((a, b) => a.name.localeCompare(b.name));
    this.online = players;
    this.emit({ t: 'online', players });
  }

  // ask a player to join the room we are in
  invite(toId) {
    if (!this.lobbyCh || !this.code) return false;
    this.lobbyCh.send({
      type: 'broadcast',
      event: 'invite',
      payload: { to: toId, from: { id: this.me, name: this.identity.name, hero: this.identity.hero }, code: this.code, roomName: this.cfg?.name || '' },
    }).catch?.(() => {});
    return true;
  }

  // chat that every player online can read, wherever they are (people in our own room already got it from the room)
  sendGlobal(text) {
    const t = clean(text, 80);
    if (!t || !this.lobbyCh || !this.lobbyReady) return false;
    this.lobbyCh.send({ type: 'broadcast', event: 'gchat', payload: { id: this.me, name: this.identity.name, text: t, room: this.code || null } }).catch?.(() => {});
    return true;
  }

  onGlobalChat(p) {
    if (!p || !p.id || p.id === this.me || !p.text) return;
    if (p.room && p.room === this.code) return;
    this.emit({ t: 'gchat', id: p.id, name: clean(p.name, 14) || 'Friend', text: clean(p.text, 80) });
  }

  onInvite(p) {
    if (!p || p.to !== this.me || !p.code || !p.from) return;
    this.emit({ t: 'invite', from: { id: p.from.id, name: clean(p.from.name, 14), hero: clean(p.from.hero, 32) }, code: clean(p.code, 8).toUpperCase(), roomName: clean(p.roomName, 24) });
  }

  // take another seat in the waiting room (an empty one); everyone is told
  moveSlot(n) {
    const me = this.members.get(this.me);
    if (!me || this.started || !this.channel) return false;
    const slot = Math.round(Number(n));
    if (!Number.isInteger(slot) || slot < 0 || slot >= (this.cfg?.max || 0)) return false;
    if ([...this.members.values()].some((m) => m.id !== this.me && m.slot === slot)) return false;
    me.slot = slot;
    this.channel.track(me).catch?.(() => {});
    this.bcast({ t: 'slot', id: this.me, slot });
    this.emit({ t: 'slot', id: this.me, slot });
    return true;
  }

  setStatus(status) {
    this.status = status;
    this.emit({ t: 'status', status });
  }

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(m) {
    for (const fn of [...this.listeners]) fn(m);
  }

  // ---------- the lobby list ----------

  watchLobby() {
    this.wantLobby = true;
    clearInterval(this.timers.lobby);
    this.refreshRooms();
    this.timers.lobby = setInterval(() => this.refreshRooms(), 4000);
  }

  stopLobby() {
    this.wantLobby = false;
    clearInterval(this.timers.lobby);
  }

  async refreshRooms() {
    if (!this.sb) {
      await this.connect();
      if (!this.sb) return;
    }
    const since = new Date(Date.now() - STALE_MS).toISOString();
    const { data, error } = await this.sb.from('rooms').select('*').gt('updated_at', since).gt('count', 0).order('updated_at', { ascending: false }).limit(50);
    if (error) {
      this.problem = friendly(error);
      this.rooms = [];
    } else {
      this.problem = '';
      this.rooms = data.map(rowToSummary);
      // tidy up rooms whose host vanished long ago
      this.sb.from('rooms').delete().lt('updated_at', new Date(Date.now() - DELETE_AFTER_MS).toISOString()).then(() => {}, () => {});
    }
    this.emit({ t: 'rooms', rooms: this.rooms });
  }

  // ---------- creating, joining, leaving ----------

  cleanPlayer(p) {
    return { name: clean(p?.name, 14) || 'Friend', hero: clean(p?.hero, 32) || 'adam' };
  }

  needOnline() {
    if (!this.sb) throw new Error(this.offlineText);
  }

  async create({ name, seed, max, pvp, mode, difficulty, winBy, allowLate, allowThrow, allowMelee, allowCheats, streakMonsters, teams, target, startMoney, player }) {
    this.stopLobby();
    await this.leave();
    if (!this.sb) await this.connect();
    this.needOnline();
    const me = this.cleanPlayer(player);
    const free = !['waves', 'survival'].includes(mode);
    const cfg = {
      name: clean(name, 24) || `${me.name}'s meadow`,
      seed: clean(seed, 40) || 'sunny-meadow-101',
      max: Math.min(MAX_PLAYERS, Math.max(2, Number(max) || 4)),
      // Wave Defense and Survival are co-op: the host runs the monsters, so there is no hero-vs-hero fighting
      mode: free ? 'free' : mode,
      difficulty: ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium',
      pvp: free && pvp !== false,
      winBy: free && winBy === 'monsters' ? 'monsters' : 'duel',
      allowThrow: allowThrow !== false,
      allowMelee: allowMelee !== false,
      streakMonsters: streakMonsters === true,
      teams: free && [2, 3, 4].includes(Number(teams)) ? Number(teams) : 0, // 0 = free for all
      allowLate: allowLate !== false,
      startMoney: Math.min(99999, Math.max(0, Math.round(Number(startMoney)) || 0)), // coins everyone starts a round with
      allowCheats: allowCheats === true, // chat commands like -gold 100 (kept in the channel, not in the rooms table)
    };
    cfg.target = clampTarget(target, defaultTarget(cfg.winBy));
    const startHour = mode === 'survival' ? 17.3 : START_HOUR; // Survival begins at dusk
    const t0 = Date.now();

    let code = null;
    for (let i = 0; i < 6 && !code; i++) {
      const tryCode = newCode();
      const { error } = await this.sb.from('rooms').insert({
        code: tryCode,
        ...cfgToRow(cfg),
        started: false,
        host_id: this.me,
        host_name: me.name,
        count: 1,
        t0,
        start_hour: startHour,
        updated_at: new Date().toISOString(),
      });
      if (!error) code = tryCode;
      else if (error.code !== '23505') throw new Error(friendly(error)); // 23505: that code is taken, try another
    }
    if (!code) throw new Error('Could not find a free room code. Try again.');

    this.code = code;
    this.cfg = cfg;
    this.startHour = startHour;
    this.t0 = t0;
    this.hostId = this.me;
    this.started = false;
    const slot = await this.subscribe(code, me, true);
    this.startHeartbeat();
    this.trackLobby();
    return this.joinedMessage(slot);
  }

  async join(code, player) {
    this.stopLobby();
    await this.leave();
    if (!this.sb) await this.connect();
    this.needOnline();
    const wanted = clean(code, 8).toUpperCase();
    const { data: row, error } = await this.sb.from('rooms').select('*').eq('code', wanted).maybeSingle();
    if (error) throw new Error(friendly(error));
    if (!row || Date.now() - new Date(row.updated_at).getTime() > STALE_MS * 2) throw new Error("That room code doesn't exist (anymore).");
    if (row.count >= row.max) throw new Error('That room is full.');
    if (row.started && !row.allow_late) throw new Error('That round has already started, and the host has turned late joining off.');

    const me = this.cleanPlayer(player);
    this.code = row.code;
    this.cfg = pickCfg({ ...rowToSummary(row) });
    this.startHour = row.start_hour;
    this.t0 = Number(row.t0);
    this.started = row.started;
    this.hostId = row.host_id;
    let slot;
    try {
      slot = await this.subscribe(row.code, me, false);
    } catch (err) {
      await this.leave();
      throw err;
    }
    if (this.members.size > this.cfg.max) {
      await this.leave();
      throw new Error('That room is full.');
    }
    this.trackLobby();
    return this.joinedMessage(slot);
  }

  // Open the room's channel, learn who is in it, pick a free slot and announce ourselves
  async subscribe(code, me, creator) {
    const ch = this.sb.channel(`cuzy-room-${code}`, { config: { broadcast: { self: false }, presence: { key: this.me } } });
    this.channel = ch;
    this.syncing = true;
    this.gotSync = new Promise((resolve) => {
      this.resolveSync = resolve;
    });
    ch.on('broadcast', { event: 'm' }, ({ payload }) => this.receive(payload));
    ch.on('presence', { event: 'sync' }, () => {
      this.resolveSync?.();
      // a "join" notice can be missed; the full list never lies, so anyone in it that we do not know yet counts as joined
      if (!this.syncing && this.channel === ch) {
        const known = [];
        for (const [key, metas] of Object.entries(ch.presenceState())) if (metas[0] && key !== this.me) known.push(metas[0]);
        this.onPresenceJoin(known);
      }
    });
    ch.on('presence', { event: 'join' }, ({ newPresences }) => this.onPresenceJoin(newPresences));
    ch.on('presence', { event: 'leave' }, ({ leftPresences }) => this.onPresenceLeave(leftPresences));
    await new Promise((resolve, reject) => {
      let first = true;
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          if (first) resolve();
          first = false;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (first) reject(new Error('Could not open the room channel.'));
          else if (this.channel === ch) this.emit({ t: 'disconnected' });
          first = false;
        } else if (status === 'CLOSED' && !first && this.channel === ch) {
          this.emit({ t: 'disconnected' });
        }
      });
    });
    if (!creator) {
      await Promise.race([this.gotSync, new Promise((r) => setTimeout(r, 2500))]);
      // Presence can report the others a moment late. The room's row says who the host is, so give the host a
      // moment to show up before deciding anything (guessing wrong here makes a second "host").
      for (let i = 0; i < 20; i++) {
        this.readPresence();
        if (this.members.has(this.hostId)) break;
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    this.readPresence();
    const taken = new Set([...this.members.values()].map((m) => m.slot));
    let slot = 0;
    while (taken.has(slot)) slot++;
    const meta = { id: this.me, name: me.name, hero: me.hero, slot, at: Date.now() };
    this.members.set(this.me, meta);
    if (creator) this.assignTeam(this.me);
    await ch.track(meta);
    // The room's row names the host, and we go with that. Presence can be slow, so we never guess at join time; only if
    // that host still has not shown up well after (an abandoned room) is someone else chosen.
    if (!creator) {
      clearTimeout(this.timers.hostWatch);
      this.timers.hostWatch = setTimeout(() => {
        if (this.channel && !this.members.has(this.hostId)) {
          this.hostId = this.electHost();
          if (this.isHost) this.takeOver();
        }
      }, 10000);
    }
    this.syncing = false;
    return slot;
  }

  readPresence() {
    const state = this.channel.presenceState();
    for (const [key, metas] of Object.entries(state)) {
      const m = metas[0];
      if (m && key !== this.me && m.id) {
        this.members.set(m.id, m);
        this.known.set(m.id, m);
      }
    }
  }

  joinedMessage(slot) {
    const elapsed = (Date.now() - this.t0) / 1000;
    const hours = this.startHour + elapsed * HOURS_PER_SECOND;
    return {
      t: 'joined',
      started: this.started,
      you: this.me,
      slot,
      host: this.hostId,
      room: this.summary(),
      teams: { ...this.teamMap },
      players: [...this.members.values()].filter((m) => m.id !== this.me).map((m) => this.publicPlayer(m)),
      scores: this.scoreList(),
      clock: { hour: hours % 24, day: 1 + Math.floor(hours / 24) },
    };
  }

  async leave() {
    const ch = this.channel;
    if (!ch) return;
    clearInterval(this.timers.heartbeat);
    clearTimeout(this.timers.intro);
    clearTimeout(this.timers.back);
    clearTimeout(this.flushT);
    clearTimeout(this.timers.hostWatch);
    clearInterval(this.timers.aiSync);
    const others = this.humans().filter((m) => m.id !== this.me).sort((a, b) => a.at - b.at);
    const alone = others.length === 0;
    const wasHost = this.isHost;
    const code = this.code;
    // say goodbye at once; Presence only notices a departure a few seconds later
    this.flushOutbox();
    try {
      await ch.send({ type: 'broadcast', event: 'm', payload: { t: 'bye', id: this.me } });
    } catch {
      /* best effort */
    }
    this.channel = null; // from now on its events are ignored
    try {
      if (alone) await this.sb.from('rooms').delete().eq('code', code); // the last one out turns the lights off
      else if (wasHost) {
        // the room goes on without us: its row must point at the next host straight away, not at someone who left
        await this.sb.from('rooms').update({ host_id: others[0].id, host_name: others[0].name, count: others.length, updated_at: new Date().toISOString() }).eq('code', code);
      }
      await ch.untrack();
      await this.sb.removeChannel(ch);
    } catch {
      /* leaving is best effort */
    }
    this.resetRoom();
    this.trackLobby(); // back to "not in a room"
    if (!alone) this.sweepRoom(code); // someone else may have been leaving at the same moment
  }

  // Two people leaving at the same instant each think the other is still there, so neither deletes the room.
  // A few seconds later, take a quiet look at who is really in it; if nobody is, close it down.
  async sweepRoom(code) {
    const sb = this.sb;
    if (!sb || !code) return;
    await new Promise((r) => setTimeout(r, this.sweepMs));
    const ch = sb.channel(`cuzy-room-${code}`, { config: { presence: { key: `sweep-${this.me}` } } });
    try {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('no presence')), 6000);
        ch.on('presence', { event: 'sync' }, () => {
          clearTimeout(timeout);
          resolve();
        });
        ch.subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            clearTimeout(timeout);
            reject(new Error(status));
          }
        });
      });
      const present = Object.keys(ch.presenceState()).filter((k) => !k.startsWith('sweep-'));
      if (!present.length) await sb.from('rooms').delete().eq('code', code);
    } catch {
      /* the stale-row rules will tidy it up instead */
    } finally {
      try {
        await sb.removeChannel(ch);
      } catch {
        /* ignore */
      }
    }
  }

  // The page is closing, so there is no time for the normal leave(). Fire-and-forget requests that survive the page:
  // delete the room if we were the only one in it, or hand the row to the next host.
  dropOnUnload() {
    if (!this.sb || !this.code || typeof fetch !== 'function') return;
    const url = `${this.sb.supabaseUrl}/rest/v1/rooms?code=eq.${encodeURIComponent(this.code)}`;
    const key = this.sb.supabaseKey;
    const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
    const others = this.humans().filter((m) => m.id !== this.me).sort((a, b) => a.at - b.at);
    try {
      if (!others.length) fetch(url, { method: 'DELETE', headers, keepalive: true }).catch(() => {});
      else if (this.isHost) {
        fetch(url, { method: 'PATCH', headers, keepalive: true, body: JSON.stringify({ host_id: others[0].id, host_name: others[0].name, count: others.length }) }).catch(() => {});
      }
    } catch {
      /* nothing more can be done */
    }
  }

  close() {
    this.closed = true;
    this.stopLobby();
    this.lobbyCh && this.sb?.removeChannel(this.lobbyCh);
    return this.leave();
  }

  // ---------- who is here ----------

  publicPlayer(m) {
    return { id: m.id, slot: m.slot, team: this.teamMap[m.id] ?? null, name: m.name, hero: m.hero, ...(m.ai ? { ai: true } : {}), ...(this.posOf.get(m.id) || { x: 0, y: 0, dir: 'down', moving: false, hp: 6 }) };
  }

  scoreList() {
    return [...this.members.values()].map((m) => ({ id: m.id, name: m.name, kills: this.kills.get(m.id) || 0, team: this.teamMap[m.id] ?? null }));
  }

  summary() {
    return {
      code: this.code,
      ...this.cfg,
      count: this.members.size,
      started: this.started,
      host: this.members.get(this.hostId)?.name || '?',
    };
  }

  // everyone works out the same host: the member who has been here longest
  electHost() {
    const sorted = this.humans().sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
    return sorted[0]?.id || this.me;
  }

  onPresenceJoin(list) {
    for (const m of list || []) {
      if (!m.id || m.id === this.me || this.members.has(m.id)) continue;
      this.members.set(m.id, m);
      this.known.set(m.id, m);
      if (this.syncing) continue;
      if (this.isHost) this.assignTeam(m.id);
      this.emit({ t: 'peer_join', player: this.publicPlayer(m) });
      if (this.isHost) {
        this.out({ t: 'settings', room: this.summary() }); // so a newcomer sees the settings that are not in the rooms table
        if (this.paused) this.out({ t: 'paused', on: true, by: this.members.get(this.me)?.name || 'the host' }); // joined while paused
        this.sendTeams();
        this.sendScores();
        this.sendAis();
        this.touchRow();
      }
    }
  }

  // `force`: they said goodbye themselves, so Presence still listing them for a moment does not count
  onPresenceLeave(list, force = false) {
    if (this.syncing || !this.channel) return;
    // A flaky connection makes Presence say "left" and "joined" for the same player, sometimes in the wrong order. If the
    // full list still has them, they never left (taking them out would leave a player who is there but cannot be seen).
    const here = this.channel.presenceState();
    for (const m of list || []) {
      if (!m.id || m.id === this.me || !this.members.has(m.id)) continue;
      if (!force && here[m.id]?.length) continue;
      this.members.delete(m.id);
      this.kills.delete(m.id);
      delete this.teamMap[m.id];
      const wasHost = m.id === this.hostId;
      if (wasHost) this.hostId = this.electHost();
      this.emit({ t: 'peer_leave', id: m.id, name: m.name, host: this.hostId });
      if (this.isHost) {
        if (wasHost) this.takeOver();
        this.checkIntro(); // the one who left might have been the last we were waiting for
        this.sendScores();
        this.touchRow();
      }
    }
  }

  // someone we thought had left keeps sending their position: if the room's list still has them, they are back in the room
  recoverMember(id) {
    this.strays[id] = (this.strays[id] || 0) + 1;
    // the room's list first; failing that, once they have kept playing for a moment (a packet from someone who really left stops soon)
    const meta = this.channel?.presenceState()[id]?.[0] || (this.strays[id] >= 8 ? this.known.get(id) : null);
    if (meta?.id === id) {
      this.strays[id] = 0;
      this.onPresenceJoin([meta]);
    }
  }

  // the old host left and we are next in line: carry on refereeing
  takeOver() {
    for (const s of this.lastScores) if (this.members.has(s.id)) this.kills.set(s.id, s.kills);
    this.startHeartbeat();
    this.touchRow({ host_id: this.me, host_name: this.members.get(this.me)?.name });
    if (this.winning) {
      clearTimeout(this.timers.back);
      this.timers.back = setTimeout(() => this.returnToLobby(), 3000);
    } else if (this.started) {
      this.out({ t: 'go' }); // do not leave anyone stuck waiting on a scene that the old host was tracking
    }
  }

  // ---------- the lobby row ----------

  startHeartbeat() {
    clearInterval(this.timers.heartbeat);
    this.timers.heartbeat = setInterval(() => this.touchRow(), HEARTBEAT_MS);
    clearInterval(this.timers.aiSync);
    this.timers.aiSync = setInterval(() => {
      if (this.members.size > 1 && [...this.members.values()].some((m) => m.ai)) this.sendAis();
    }, 4000);
  }

  touchRow(extra = {}) {
    if (!this.sb || !this.code || !this.isHost) return;
    this.sb
      .from('rooms')
      .update({ count: this.members.size, started: this.started, updated_at: new Date().toISOString(), ...extra })
      .eq('code', this.code)
      .then(() => {}, () => {});
  }

  // ---------- talking ----------

  // Messages are not sent one by one: everything a player produces in a moment (positions, hits, fx, wave traffic)
  // leaves in a single batch every `flushMs`. Supabase limits how many messages per second a project may send,
  // and a busy fight between several players blew straight through it when every event was its own message.
  // Only the newest position and the newest Wave Defense snapshot matter, so older ones are replaced.
  bcast(payload) {
    if (!this.channel) return;
    if (payload.t === 'state') this.outbox = this.outbox.filter((m) => !(m.t === 'state' && m.id === payload.id));
    else if (payload.t === 'w' && payload.k === 'snap') this.outbox = this.outbox.filter((m) => !(m.t === 'w' && m.k === 'snap'));
    this.outbox.push(payload);
    if (!this.flushT) this.flushT = setTimeout(() => this.flushOutbox(), this.flushMs);
  }

  flushOutbox() {
    clearTimeout(this.flushT);
    this.flushT = 0;
    const msgs = this.outbox;
    this.outbox = [];
    if (!this.channel || !msgs.length) return;
    this.channel.send({ type: 'broadcast', event: 'm', payload: msgs.length === 1 ? msgs[0] : { t: 'batch', msgs } }).catch?.(() => {});
  }

  // tell everyone, ourselves included
  out(msg) {
    this.bcast(msg);
    this.receive(msg);
  }

  // what the game calls: the same message types it sends to the local room server
  send(m) {
    if (!this.channel || !m) return;
    switch (m.t) {
      case 'state':
        this.queueState(m);
        break;
      case 'hit': {
        if (!this.cfg.pvp || String(m.target) === this.me) return;
        if (this.cfg.teams && this.teamMap[String(m.target)] === this.teamMap[this.me]) return; // no friendly fire
        const dmg = Math.max(1, Math.min(4, Math.round(Number(m.dmg) || 1)));
        if (this.members.get(String(m.target))?.ai) {
          // a computer player is played by the host's game, which works out the damage itself
          const hurt = { t: 'aihurt', ai: String(m.target), from: this.me, dmg, fx: this.pos.x, fy: this.pos.y };
          if (this.isHost) this.emit(hurt);
          else this.bcast({ ...hurt, to: 'host' });
          break;
        }
        this.bcast({ t: 'hit', to: String(m.target), from: this.me, dmg, fx: this.pos.x, fy: this.pos.y });
        break;
      }
      case 'addai':
      case 'removeai':
        this.request(m.t, m);
        break;
      // the host's game reports where its computer players are, what they swing and throw, who they hurt and who beat them
      case 'aistate':
        if (!this.isHost || !Array.isArray(m.list)) return;
        for (const e of m.list.slice(0, 10)) {
          const ai = this.members.get(String(e.id));
          if (!ai?.ai) continue;
          const pos = {
            x: num(e.x),
            y: num(e.y),
            dir: ['up', 'down', 'left', 'right'].includes(e.dir) ? e.dir : 'down',
            moving: !!e.moving,
            hidden: !!e.hidden,
            hp: Math.max(0, Math.min(40, Math.round((Number(e.hp) || 0) * 10) / 10)),
            mhp: 6,
            lv: 1,
            mt: '',
          };
          this.posOf.set(ai.id, pos);
          this.bcast({ t: 'state', id: ai.id, ...pos });
        }
        break;
      case 'aifx':
        if (!this.isHost || !this.members.get(String(m.id))?.ai) return;
        if (m.kind === 'swing') this.bcast({ t: 'fx', id: String(m.id), kind: 'swing', a: num(m.a), w: '' });
        else if (m.kind === 'throw') this.bcast({ t: 'fx', id: String(m.id), kind: 'throw', item: 'rock', x: num(m.x), y: num(m.y), vx: num(m.vx), vy: num(m.vy) });
        break;
      case 'aiattack': {
        const target = String(m.target);
        if (!this.isHost || !this.cfg.pvp || target === this.me || !this.members.get(String(m.ai))?.ai || !this.members.has(target)) return;
        if (this.cfg.teams && this.teamMap[target] === this.teamMap[String(m.ai)]) return;
        this.bcast({ t: 'hit', to: target, from: String(m.ai), dmg: Math.max(1, Math.min(4, Math.round(Number(m.dmg) || 1))), fx: num(m.fx), fy: num(m.fy) });
        break;
      }
      case 'aidied':
        if (this.isHost && this.members.get(String(m.ai))?.ai) this.hKill(String(m.killer), String(m.ai));
        break;
      case 'died':
        this.request('died', { killer: String(m.killer) });
        break;
      case 'start':
      case 'ready':
      case 'settings':
      case 'mkill':
      case 'team':
      case 'pause':
      case 'tolobby':
        this.request(m.t, m);
        break;
      case 'fell':
        if (this.started) this.bcast({ t: 'fell', id: this.me });
        break;
      case 'skill':
        // a monster kill that counts towards streaks, if the host allowed that
        if (this.cfg.streakMonsters && this.started && !this.winning) {
          this.out({ t: 'kill', killer: this.members.get(this.me)?.name || 'Someone', victim: clean(m.victim, 24) || 'a monster', killerId: this.me, victimId: 'npc', first: false });
        }
        break;
      case 'w':
        if (typeof m.k !== 'string') return;
        if (m.to === 'host' && this.isHost) return;
        this.bcast({ t: 'w', from: this.me, k: m.k.slice(0, 12), d: m.d, to: m.to });
        break;
      case 'chat': {
        const text = clean(m.text, 80);
        if (text) this.bcast({ t: 'chat', id: this.me, name: this.members.get(this.me)?.name || 'Friend', text });
        break;
      }
      case 'fx':
        if (m.kind === 'swing') this.bcast({ t: 'fx', id: this.me, kind: 'swing', a: num(m.a), w: clean(m.w, 12) });
        else if (m.kind === 'shield') this.bcast({ t: 'fx', id: this.me, kind: 'shield' });
        else if (m.kind === 'loot') this.bcast({ t: 'fx', id: this.me, kind: 'loot', lid: clean(m.lid, 40), x: num(m.x), y: num(m.y), qty: Math.max(1, Math.min(99999, Math.round(Number(m.qty)) || 1)) });
        else if (m.kind === 'grab') this.bcast({ t: 'fx', id: this.me, kind: 'grab', lid: clean(m.lid, 40) });
        else if (m.kind === 'spin') this.bcast({ t: 'fx', id: this.me, kind: 'spin', a: num(m.a), r: num(m.r), d: num(m.d) });
        else if (m.kind === 'ball') this.bcast({ t: 'fx', id: this.me, kind: 'ball', i: Math.max(0, Math.min(7, Math.round(Number(m.i)) || 0)), x: num(m.x), y: num(m.y), vx: num(m.vx), vy: num(m.vy), z: num(m.z), vz: num(m.vz) });
        else if (m.kind === 'throw') this.bcast({ t: 'fx', id: this.me, kind: 'throw', item: clean(m.item, 16), x: num(m.x), y: num(m.y), vx: num(m.vx), vy: num(m.vy) });
        break;
      case 'leave':
        this.leave();
        break;
      default:
    }
  }

  // positions are sent at most ten times a second, always the latest
  queueState(m) {
    this.pos = {
      x: num(m.x),
      y: num(m.y),
      dir: ['up', 'down', 'left', 'right'].includes(m.dir) ? m.dir : 'down',
      moving: !!m.moving,
      hidden: !!m.hidden,
      hp: Math.max(0, Math.min(40, Math.round((Number(m.hp) || 0) * 10) / 10)),
      mhp: Math.max(1, Math.min(40, Math.round((Number(m.mhp) || 6) * 10) / 10)), // max health, in hearts
      lv: Math.max(1, Math.min(99, Math.round(Number(m.lv)) || 1)), // character level, shown next to the health bar
      mt: m.mt === 'chicken' || m.mt === 'cow' ? m.mt : '', // what they are riding
    };
    this.bcast({ t: 'state', id: this.me, ...this.pos });
  }

  // a request for the host (a message of its own kind, so it is never mistaken for an announcement)
  request(r, m = {}) {
    const msg = { req: r, to: 'host', from: this.me, ...m };
    delete msg.t;
    if (this.isHost) this.handleRequest(msg);
    else this.bcast(msg);
  }

  // anything that arrives from the channel (or from ourselves, via out())
  receive(m) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'batch') {
      for (const sub of m.msgs || []) this.receive(sub);
      return;
    }
    if (m.req) {
      if (this.isHost && m.from !== this.me) this.handleRequest(m);
      return;
    }
    if (m.t === 'bye') {
      // someone left on purpose: no need to wait for Presence to notice
      const gone = this.members.get(m.id);
      if (gone && !gone.ai) {
        this.known.delete(gone.id);
        this.onPresenceLeave([gone], true);
      }
      return;
    }
    if (m.to && m.to !== 'host' && m.to !== this.me) return; // addressed to someone else
    if (m.to === 'host' && !this.isHost) return;
    const { to, ...msg } = m; // eslint-disable-line no-unused-vars
    switch (msg.t) {
      case 'start':
        this.started = true;
        this.winning = false;
        this.t0 = Date.now();
        this.cfg = pickCfg(msg.room);
        if (msg.teams) this.teamMap = { ...msg.teams };
        this.emit({ ...msg, players: msg.players.filter((p) => p.id !== this.me) });
        return;
      case 'lobby':
        this.started = false;
        this.winning = false;
        this.cfg = pickCfg(msg.room);
        if (msg.teams) this.teamMap = { ...msg.teams };
        break;
      case 'teams':
        this.teamMap = { ...msg.teams };
        break;
      case 'peer_join':
        if (msg.player?.ai) this.members.set(msg.player.id, { id: msg.player.id, name: msg.player.name, hero: msg.player.hero, slot: msg.player.slot, at: Date.now(), ai: true });
        break;
      case 'peer_leave':
        if (this.members.get(msg.id)?.ai) {
          this.members.delete(msg.id);
          this.kills.delete(msg.id);
          delete this.teamMap[msg.id];
        }
        break;
      case 'ais': {
        // the host's full list of computer players: keep ours the same
        const ids = new Set((msg.list || []).map((p) => p.id));
        for (const m2 of [...this.members.values()]) if (m2.ai && !ids.has(m2.id)) this.members.delete(m2.id);
        for (const p of msg.list || []) {
          const old = this.members.get(p.id);
          this.members.set(p.id, { id: p.id, name: p.name, hero: p.hero, slot: p.slot, at: old?.at || Date.now(), ai: true });
        }
        break;
      }
      case 'slot': {
        const mem = this.members.get(msg.id);
        if (mem && Number.isInteger(msg.slot)) mem.slot = msg.slot;
        break;
      }
      case 'hit':
        if (this.cfg?.teams && this.teamMap[msg.from] === this.teamMap[this.me]) return; // no friendly fire
        break;
      case 'settings':
        this.cfg = pickCfg(msg.room);
        break;
      case 'scores':
        this.lastScores = msg.scores;
        break;
      case 'win':
        this.winning = true;
        break;
      case 'state': {
        const { t, id, ...pos } = msg; // eslint-disable-line no-unused-vars
        if (!this.members.has(id) && !this.syncing) this.recoverMember(id); // they are playing, so they are here: put them back
        this.posOf.set(id, pos);
        break;
      }
      default:
    }
    this.emit(msg);
  }

  // ---------- the referee (runs on the host) ----------

  handleRequest(m) {
    const from = m.from;
    if (!this.members.has(from) && from !== this.me) return;
    switch (m.req) {
      case 'start':
        return this.hStart(from);
      case 'settings':
        return this.hSettings(from, m);
      case 'ready':
        return this.hReady(from);
      case 'died':
        return this.hDied(from, m);
      case 'mkill':
        return this.hMkill(from);
      case 'team':
        return this.hTeam(from, m);
      case 'pause':
        return this.hPause(from, m);
      case 'addai':
        return this.hAddAi(from, m);
      case 'removeai':
        return this.hRemoveAi(from, m);
      case 'tolobby':
        // a finished wave round: back to the waiting room, for everyone
        if (this.started) this.returnToLobby();
        return;
      default:
    }
  }

  // ---- teams: a room is free for all (teams = 0) or split into 2-4 teams ----
  sendTeams() {
    this.out({ t: 'teams', teams: { ...this.teamMap } });
  }

  // a newcomer joins the smallest team
  assignTeam(id) {
    const n = this.cfg.teams;
    if (!n) {
      delete this.teamMap[id];
      return;
    }
    const counts = Array(n).fill(0);
    for (const [pid, t] of Object.entries(this.teamMap)) if (pid !== id && this.members.has(pid) && t < n) counts[t]++;
    this.teamMap[id] = counts.indexOf(Math.min(...counts));
  }

  reassignAll() {
    this.teamMap = {};
    if (!this.cfg.teams) return;
    let i = 0;
    for (const id of this.members.keys()) this.teamMap[id] = i++ % this.cfg.teams;
  }

  // what a win is counted on: your own kills, or your whole team's
  scoreOf(id) {
    const t = this.teamMap[id];
    if (!this.cfg.teams || t === undefined) return this.kills.get(id) || 0;
    let sum = 0;
    for (const pid of this.members.keys()) if (this.teamMap[pid] === t) sum += this.kills.get(pid) || 0;
    return sum;
  }

  // the host pauses or resumes the game for everyone in the room
  hPause(from, m) {
    if (!this.started || from !== this.hostId) return;
    this.paused = !!m.on;
    this.out({ t: 'paused', on: this.paused, by: this.members.get(from)?.name || 'the host' });
  }

  // a player picks their own team in the waiting room
  hTeam(from, m) {
    const n = Number(m.team);
    if (this.started || !this.cfg.teams || !Number.isInteger(n) || n < 0 || n >= this.cfg.teams) return;
    const cap = Math.ceil(this.cfg.max / this.cfg.teams); // a team only has so many places
    if (this.teamMap[from] !== n && [...this.members.keys()].filter((id) => this.teamMap[id] === n).length >= cap) return;
    this.teamMap[from] = n;
    this.sendTeams();
  }

  sendScores() {
    this.out({ t: 'scores', scores: this.scoreList(), target: this.cfg.target });
  }

  // Everyone watches the opening scene when a round starts; the world only begins once all of them are done (or skipped it).
  openIntro() {
    this.introOpen = true;
    this.introReady = new Set();
    clearTimeout(this.timers.intro);
    this.timers.intro = setTimeout(() => this.closeIntro(), INTRO_MAX_MS);
  }

  closeIntro() {
    if (!this.introOpen) return;
    this.introOpen = false;
    clearTimeout(this.timers.intro);
    this.out({ t: 'go' });
    // say it again a few times, in case it got lost on the way (extra ones are harmless)
    for (const ms of [800, 2000, 4000]) {
      setTimeout(() => {
        if (this.channel && this.started && !this.introOpen) this.bcast({ t: 'go' });
      }, ms);
    }
  }

  // if every player has finished or skipped it, the game starts at once
  checkIntro() {
    if (this.introOpen && this.humans().every((m) => this.introReady.has(m.id))) this.closeIntro();
  }

  hStart(from) {
    if (this.started || from !== this.hostId) return;
    this.started = true;
    this.winning = false;
    this.paused = false;
    for (const id of this.members.keys()) if (this.cfg.teams && this.teamMap[id] === undefined) this.assignTeam(id);
    this.openIntro();
    this.t0 = Date.now();
    this.kills = new Map();
    this.firstDone = false; // has anyone been taken down yet this round (for First Blood)
    this.out({
      t: 'start',
      room: this.summary(),
      teams: { ...this.teamMap },
      host: this.hostId,
      players: [...this.members.values()].map((m) => this.publicPlayer(m)),
      scores: this.scoreList(),
      clock: { hour: this.startHour % 24, day: 1 + Math.floor(this.startHour / 24) },
    });
    this.touchRow({ started: true, t0: this.t0 });
  }

  hSettings(from, m) {
    if (from !== this.hostId) return;
    const cfg = this.cfg;
    const free = cfg.mode === 'free';
    if (typeof m.allowLate === 'boolean') cfg.allowLate = m.allowLate;
    if (typeof m.allowCheats === 'boolean') cfg.allowCheats = m.allowCheats;
    // these can be changed at any time, even in the middle of a round
    if (typeof m.allowThrow === 'boolean') cfg.allowThrow = m.allowThrow;
    if (typeof m.allowMelee === 'boolean') cfg.allowMelee = m.allowMelee;
    if (typeof m.streakMonsters === 'boolean') cfg.streakMonsters = m.streakMonsters;
    if (m.startMoney !== undefined && !this.started) cfg.startMoney = Math.min(99999, Math.max(0, Math.round(Number(m.startMoney)) || 0));
    if (['easy', 'medium', 'hard'].includes(m.difficulty)) cfg.difficulty = m.difficulty;
    if (Number.isFinite(Number(m.max))) cfg.max = Math.min(MAX_PLAYERS, Math.max(2, this.members.size, Math.round(Number(m.max))));
    if (free && m.target !== undefined) cfg.target = clampTarget(m.target, cfg.target);
    // the rest is decided before the round
    if (!this.started) {
      // Free Roam <-> Survival: the map, the start of the day and the fighting rules follow the mode
      if (['free', 'survival'].includes(m.mode) && m.mode !== cfg.mode) {
        cfg.mode = m.mode;
        cfg.seed = seedForMode(cfg.seed, m.mode);
        this.startHour = m.mode === 'survival' ? 17.3 : START_HOUR;
        cfg.pvp = m.mode === 'free';
        cfg.winBy = 'duel';
        cfg.target = defaultTarget('duel');
        cfg.teams = 0;
        if (m.mode === 'survival') {
          // computer players only play Free Roam fights
          for (const ai of [...this.members.values()].filter((x) => x.ai)) this.out({ t: 'peer_leave', id: ai.id, name: ai.name, host: this.hostId });
        }
        this.reassignAll();
      }
      if (cfg.mode === 'free') {
        if (TEAM_COUNTS.includes(Number(m.teams)) && m.teams !== undefined && Number(m.teams) !== cfg.teams) {
          cfg.teams = Number(m.teams);
          this.reassignAll();
        }
        if (typeof m.pvp === 'boolean') cfg.pvp = m.pvp;
        if (m.winBy === 'duel' || m.winBy === 'monsters') cfg.winBy = m.winBy;
        if (m.target !== undefined) cfg.target = clampTarget(m.target, cfg.target);
        if (!cfg.pvp) cfg.winBy = 'monsters'; // with no player damage, the only way to win is monsters
      }
    }
    this.out({ t: 'settings', room: this.summary() });
    this.sendTeams();
    this.touchRow({ ...cfgToRow(cfg), start_hour: this.startHour });
  }

  // (a player who is still waiting asks again every couple of seconds; once the scene is over they are told to go)
  hReady(from) {
    if (!this.started) return;
    if (!this.introOpen) {
      this.out({ t: 'go', to: from }); // a late joiner: the round is already running
      return;
    }
    this.introReady.add(from);
    this.checkIntro();
  }

  // the host puts a computer player in a seat (its name and look come from the host's game)
  hAddAi(from, m) {
    const cfg = this.cfg;
    if (from !== this.hostId || this.started || cfg.mode !== 'free' || this.members.size >= cfg.max) return;
    let slot = Math.round(Number(m.slot));
    const taken = new Set([...this.members.values()].map((x) => x.slot));
    if (!Number.isInteger(slot) || slot < 0 || slot >= cfg.max || taken.has(slot)) {
      slot = 0;
      while (taken.has(slot)) slot++;
    }
    this.aiSeq = (this.aiSeq || 0) + 1;
    const ai = { id: `ai${this.aiSeq}${this.me.slice(0, 3)}`, name: clean(m.name, 14) || 'Robo', hero: clean(m.hero, 32) || 'retro:1', slot, at: Date.now(), ai: true };
    this.members.set(ai.id, ai);
    this.assignTeam(ai.id);
    this.out({ t: 'peer_join', player: this.publicPlayer(ai) });
    this.sendTeams();
    this.sendScores();
    this.touchRow();
  }

  hRemoveAi(from, m) {
    const ai = this.members.get(String(m.id));
    if (from !== this.hostId || this.started || !ai?.ai) return;
    this.out({ t: 'peer_leave', id: ai.id, name: ai.name, host: this.hostId });
    this.sendTeams();
    this.sendScores();
    this.touchRow();
  }

  // the victim reports its own defeat so the right player gets the point
  hDied(from, m) {
    this.hKill(String(m.killer), from);
  }

  // `killer` took down `victimId` (either can be a computer player)
  hKill(killerId, victimId) {
    const cfg = this.cfg;
    if (!cfg.pvp || !this.started || this.winning) return;
    const killer = this.members.get(killerId);
    const victim = this.members.get(victimId);
    const from = victimId;
    if (!killer || !victim || killer.id === from) return;
    // a player took down a player: everyone hears about it (kill streaks are global); it only scores in a "player kills" room
    const first = !this.firstDone;
    this.firstDone = true;
    this.out({ t: 'kill', killer: killer.name, victim: victim.name, killerId: killer.id, victimId: from, first });
    if (cfg.winBy === 'monsters') return;
    const n = (this.kills.get(killer.id) || 0) + 1;
    this.kills.set(killer.id, n);
    if (this.scoreOf(killer.id) >= cfg.target) this.finishRound(killer.id);
    this.sendScores();
  }

  // in a "monster kills" room each client reports the monsters it takes down
  hMkill(from) {
    const cfg = this.cfg;
    if (cfg.winBy !== 'monsters' || !this.started || this.winning) return;
    const n = (this.kills.get(from) || 0) + 1;
    this.kills.set(from, n);
    this.sendScores();
    if (this.scoreOf(from) >= cfg.target) this.finishRound(from);
  }

  // a player reached the target: cheer them, then send everyone back to the waiting room
  finishRound(id) {
    this.winning = true;
    const team = this.cfg.teams ? this.teamMap[id] ?? null : null;
    this.out({ t: 'win', id, name: team !== null ? `${TEAMS[team].name} team` : this.members.get(id)?.name || 'Someone', team, target: this.cfg.target });
    clearTimeout(this.timers.back);
    this.timers.back = setTimeout(() => this.returnToLobby(), CELEBRATE_MS);
  }

  returnToLobby() {
    if (!this.channel || !this.isHost) return;
    this.started = false;
    this.winning = false;
    this.paused = false;
    this.introOpen = false;
    this.kills = new Map();
    this.firstDone = false; // has anyone been taken down yet this round (for First Blood)
    this.out({ t: 'lobby', room: this.summary(), teams: { ...this.teamMap }, host: this.hostId, players: [...this.members.values()].map((m) => this.publicPlayer(m)), scores: this.scoreList() });
    this.touchRow({ started: false });
  }
}
