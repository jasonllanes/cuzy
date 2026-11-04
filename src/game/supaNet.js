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
import { ARENA_SEED, seedForMode, seedWithMap } from './maps.js';

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
const cleanBet = (v) => Math.min(99999, Math.max(0, Math.round(Number(v)) || 0));
const cleanEvery = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.min(60, Math.max(1, Math.round(Number(v)))) : 0); // minutes between the duels of a running round (0 = none)
const cleanMins = (v) => (Number.isFinite(Number(v)) ? Math.min(10, Math.max(1, Math.round(Number(v)))) : 3);
const newId = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
const newCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

const CFG_KEYS = ['name', 'seed', 'max', 'mode', 'difficulty', 'pvp', 'winBy', 'target', 'allowLate', 'allowThrow', 'allowMelee', 'allowCheats', 'streakMonsters', 'teams', 'startMoney', 'waveStart', 'allowVisit', 'waves', 'duel', 'bet', 'duelMins', 'fighters', 'duelPick', 'duelEvery'];
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
    this.timers = { lobby: 0, heartbeat: 0, state: 0, intro: 0, back: 0, hostWatch: 0, aiSync: 0, duel: 0, duelEvent: 0 };
    this.stakes = new Map(); // what each player put on the table in a duel with a bet
    this.resetDuel();
    this.resetMatches();
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

  async create({ name, seed, max, pvp, mode, difficulty, winBy, allowLate, allowThrow, allowMelee, allowCheats, allowVisit, waves, duel, duelEvery, bet, duelMins, streakMonsters, teams, target, startMoney, player }) {
    this.stopLobby();
    await this.leave();
    if (!this.sb) await this.connect();
    this.needOnline();
    const me = this.cleanPlayer(player);
    const free = !['waves', 'survival'].includes(mode);
    const cfg = {
      name: clean(name, 24) || `${me.name}'s meadow`,
      seed: clean(seed, 48) || 'sunny-meadow-101',
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
      allowVisit: allowVisit === undefined ? !free : allowVisit === true, // may players teleport to each other? (on by default in co-op Survival, off in Free Roam fights)
      waves: Number.isInteger(Number(waves)) && Number(waves) >= 0 && Number(waves) <= 99 ? Number(waves) : 10, // how many waves a Survival run lasts (0 = endless)
      waveStart: 'timer', // what starts the next wave in Survival: timer | vote | manual | instant (kept in the channel, not in the rooms table)
      allowCheats: allowCheats === true, // chat commands like -gold 100 (kept in the channel, not in the rooms table)
      duel: false, // a Free Roam 1v1 in the colosseum, against the clock (kept in the channel)
      bet: cleanBet(bet), // coins each player stakes in a duel: the winner takes the pot, a draw gives them back (0 = no bet)
      duelMins: cleanMins(duelMins),
      duelEvery: free ? cleanEvery(duelEvery) : 0, // a duel in the Colosseum every this many minutes of a running Free Roam round (0 = none)
      duelPick: 'pick', // who duels next (a 1v1 with spectators): pick (the host) | random | streak (the winner stays, the loser sits out) | robin (everybody in turn)
    };
    cfg.target = clampTarget(target, defaultTarget(cfg.winBy));
    if (free && duel === true) {
      this.preDuel = { seed: cfg.seed, max: cfg.max, pvp: cfg.pvp, winBy: cfg.winBy, target: cfg.target, teams: cfg.teams };
      Object.assign(cfg, { duel: true, seed: ARENA_SEED, pvp: true, winBy: 'duel', target: 1 });
      this.resetMatches();
      this.fixPair(true);
    }
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
    // the settings that are not in the rooms table (startup money, waves, duel...) come from the host once it sees us: wait for them,
    // so a game that opens at once (a reconnect) knows its startup money
    const gotCfg = new Promise((r) => {
      this.resolveCfg = r;
    });
    try {
      slot = await this.subscribe(row.code, me, false);
    } catch (err) {
      await this.leave();
      throw err;
    }
    await Promise.race([gotCfg, new Promise((r) => setTimeout(r, 2500))]);
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
    clearInterval(this.timers.duel);
    clearInterval(this.timers.duelEvent);
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
      ...((this.cfg.duel && this.started) || this.duelLive ? { duelFighters: [...this.fighters], duelFallen: [...this.fallen], duelUnits: Object.fromEntries(this.fighterUnit), duelLive: this.duelLive } : {}),
    };
  }

  // (the matchmaking memory of a duel room: which pairs have fought, and when each player last did)
  resetMatches() {
    this.duelPlayed = new Set();
    this.lastFought = new Map();
    this.duelRound = 0;
    this.lastDuel = null;
  }

  // The next pair for a one-against-one duel, by the room's matchup rule (never two on the same team). `last` is how the previous duel went.
  choosePair(mode, last = null) {
    const ids = this.humans().sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1)).map((h) => h.id);
    const key = (a, b) => [a, b].sort().join('|');
    const ok = (a, b) => !this.cfg.teams || this.teamMap[a] !== this.teamMap[b];
    const pairs = [];
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (ok(ids[i], ids[j])) pairs.push([ids[i], ids[j]]);
    if (!pairs.length) return null;
    const wait = (id) => this.lastFought.get(id) ?? 0; // (lower: has waited longer)
    if (mode === 'random') {
      const lastKey = last?.pair ? key(last.pair[0], last.pair[1]) : null;
      const fresh = pairs.filter(([a, b]) => key(a, b) !== lastKey); // (not the same two again, if there is anyone else)
      const from = fresh.length ? fresh : pairs;
      const pick = from[Math.floor(Math.random() * from.length)];
      return Math.random() < 0.5 ? pick : [pick[1], pick[0]];
    }
    if (mode === 'streak') {
      const winner = last && !last.draw && ids.includes(last.winner) ? last.winner : null;
      if (winner) {
        const rivals = pairs.filter(([a, b]) => a === winner || b === winner).map(([a, b]) => (a === winner ? b : a));
        rivals.sort((a, b) => wait(a) - wait(b) || ids.indexOf(a) - ids.indexOf(b)); // the one who has waited longest steps in
        const fresh = rivals.find((id) => !(last.losers || []).includes(id));
        const challenger = fresh || rivals[0];
        if (challenger) return [winner, challenger];
      }
      return [...pairs].sort((x, y) => wait(x[0]) + wait(x[1]) - (wait(y[0]) + wait(y[1])))[0]; // the first round, or a draw: the two who have waited longest
    }
    if (mode === 'robin') {
      let next = pairs.find(([a, b]) => !this.duelPlayed.has(key(a, b)));
      if (!next) {
        this.duelPlayed = new Set(); // everybody has met everybody: round again
        next = pairs[0];
      }
      return next;
    }
    return null;
  }

  // between rounds (and when people come and go) the next pair follows the rule
  fixPair(force = false) {
    const cfg = this.cfg;
    const mode = cfg.duelPick || 'pick';
    if (!cfg.duel || cfg.teams || mode === 'pick' || this.started) return;
    const ok = cfg.fighters?.length === 2 && cfg.fighters.every((id) => this.members.get(id) && !this.members.get(id).ai);
    if (ok && !force) return;
    const pair = this.choosePair(mode, this.lastDuel);
    if (pair) cfg.fighters = pair;
  }

  // is a duel being fought right now? (a duel round, or a duel in the middle of a round)
  duelRunning() {
    return (this.cfg.duel && this.started && !this.winning) || this.duelLive;
  }

  resetDuel() {
    this.duelLive = false;
    this.fighters = new Set(); // who is fighting in the duel (everyone else watches)
    this.fighterUnit = new Map(); // fighter id -> what they fight for: their team, or themselves
    this.fallen = new Set(); // fighters who are out
  }

  // every game keeps the duel's list of fighters (a new host carries on from it)
  takeDuel(room) {
    if (!room?.duelFighters) return;
    this.duelLive = !!room.duelLive;
    this.fighters = new Set(room.duelFighters.map(String));
    this.fallen = new Set((room.duelFallen || []).map(String));
    this.fighterUnit = new Map(Object.entries(room.duelUnits || {}));
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
        this.fixPair();
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
        if (this.duelRunning() && this.fighters.has(m.id)) this.duelFall(m.id, null, 'forfeit'); // a fighter walked out: they are out
        this.checkIntro(); // the one who left might have been the last we were waiting for
        if (this.cfg.duel && !this.started) {
          this.fixPair();
          this.out({ t: 'settings', room: this.summary() });
        }
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
      this.startDuelEventTimer();
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
        if (!(this.cfg.pvp || this.duelLive) || String(m.target) === this.me) return;
        if (this.cfg.duel || this.duelLive) {
          // only the fighters still standing can hurt each other (the ones who watch cannot, and cannot be hurt)
          const t = String(m.target);
          if (!this.fighters.has(this.me) || !this.fighters.has(t) || this.fallen.has(this.me) || this.fallen.has(t)) return;
          if (this.fighterUnit.get(this.me) === this.fighterUnit.get(t)) return;
        }
        if (this.cfg.teams && this.teamMap[String(m.target)] === this.teamMap[this.me]) return; // no friendly fire
        const stun = Math.min(4, Math.max(0, Number(m.stun) || 0)); // a stun grenade (no damage)
        const dmg = stun ? 0 : Math.max(1, Math.min(4, Math.round(Number(m.dmg) || 1)));
        if (this.members.get(String(m.target))?.ai) {
          // a computer player is played by the host's game, which works out the damage itself
          const hurt = { t: 'aihurt', ai: String(m.target), from: this.me, dmg, fx: this.pos.x, fy: this.pos.y };
          if (this.isHost) this.emit(hurt);
          else this.bcast({ ...hurt, to: 'host' });
          break;
        }
        this.bcast({ t: 'hit', to: String(m.target), from: this.me, dmg, ...(stun ? { stun } : {}), fx: this.pos.x, fy: this.pos.y });
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
        this.request('died', { killer: String(m.killer ?? '') });
        break;
      case 'stake':
        this.request('stake', { amount: Math.max(0, Math.min(99999, Math.round(Number(m.amount)) || 0)) });
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
        else if (m.kind === 'flame') this.bcast({ t: 'fx', id: this.me, kind: 'flame', x: num(m.x), y: num(m.y), a: num(m.a) });
        else if (m.kind === 'zap') this.bcast({ t: 'fx', id: this.me, kind: 'zap', x1: num(m.x1), y1: num(m.y1), x2: num(m.x2), y2: num(m.y2) });
        else if (m.kind === 'grapple') this.bcast({ t: 'fx', id: this.me, kind: 'grapple', a: num(m.a), len: num(m.len), hit: m.hit ? 1 : 0 });
        else if (m.kind === 'bomb') this.bcast({ t: 'fx', id: this.me, kind: 'bomb', item: clean(m.item, 20), tx: num(m.tx), ty: num(m.ty), x0: num(m.x0), y0: num(m.y0), fl: num(m.fl) });
        else if (m.kind === 'fan') this.bcast({ t: 'fx', id: this.me, kind: 'fan', x: num(m.x), y: num(m.y), a: num(m.a), L: num(m.L), T: num(m.T), side: m.side < 0 ? -1 : 1, w: clean(m.w, 20) });
        else if (m.kind === 'trident') this.bcast({ t: 'fx', id: this.me, kind: 'trident', x: num(m.x), y: num(m.y), a: num(m.a), range: num(m.range), speed: num(m.speed), w: clean(m.w, 20) });
        else if (m.kind === 'cast') this.bcast({ t: 'fx', id: this.me, kind: 'cast', x: num(m.x), y: num(m.y), r: num(m.r), fx: clean(m.fx, 24), hue: num(m.hue), color: clean(m.color, 12) });
        else if (m.kind === 'spin') this.bcast({ t: 'fx', id: this.me, kind: 'spin', a: num(m.a), r: num(m.r), d: num(m.d) });
        else if (m.kind === 'ball') this.bcast({ t: 'fx', id: this.me, kind: 'ball', i: Math.max(0, Math.min(7, Math.round(Number(m.i)) || 0)), x: num(m.x), y: num(m.y), vx: num(m.vx), vy: num(m.vy), z: num(m.z), vz: num(m.vz) });
        else if (m.kind === 'throw') this.bcast({ t: 'fx', id: this.me, kind: 'throw', item: clean(m.item, 16), x: num(m.x), y: num(m.y), vx: num(m.vx), vy: num(m.vy), ...(m.g ? { g: clean(m.g, 12) } : {}) });
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
    // (who we are rides along with every position, so a player who is somehow missing from someone's list is put back by it)
    const me = this.members.get(this.me);
    this.bcast({ t: 'state', id: this.me, ...this.pos, ...(me ? { nm: clean(me.name, 16), hr: clean(me.hero, 24), sl: Number(me.slot) || 0 } : {}) });
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
        this.takeDuel(msg.room);
        this.resetDuel();
        this.takeDuel(msg.room);
        if (msg.teams) this.teamMap = { ...msg.teams };
        this.emit({ ...msg, players: msg.players.filter((p) => p.id !== this.me) });
        return;
      case 'duelfall':
        this.fallen.add(String(msg.id));
        break;
      case 'duelstart':
        // a duel in the middle of the round: these two fight (everyone else watches)
        this.fighters = new Set(msg.fighters.map(String));
        this.fighterUnit = new Map(Object.entries(msg.units || {}));
        this.fallen = new Set();
        this.duelLive = true;
        break;
      case 'duelend':
        this.resetDuel();
        break;
      case 'lobby':
        this.started = false;
        this.winning = false;
        this.resetDuel();
        this.cfg = pickCfg(msg.room);
        this.takeDuel(msg.room);
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
        this.takeDuel(msg.room);
        this.resolveCfg?.();
        break;
      case 'scores':
        this.lastScores = msg.scores;
        break;
      case 'win':
        this.winning = true;
        break;
      case 'state': {
        const { t, id, nm, hr, sl, ...pos } = msg; // eslint-disable-line no-unused-vars
        if (!this.members.has(id) && !this.syncing) {
          // they are playing, so they are here: put them back (from the room's list, or from what their own packet says they are)
          this.recoverMember(id);
          if (!this.members.has(id) && nm && hr) this.onPresenceJoin([{ id, name: clean(nm, 16) || 'Friend', hero: clean(hr, 24), slot: Number(sl) || 0, at: Date.now() }]);
        }
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
      case 'stake':
        if (this.duelRunning() && this.fighters.has(from)) this.stakes.set(from, Math.min(this.cfg.bet || 0, Math.max(0, Math.round(Number(m.amount)) || 0)));
        return;
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

  // the host's "shuffle" button: everybody (computer players too) is dealt out again at random, as evenly as it goes;
  // the extra player lands on a random team
  shuffleTeams() {
    const n = this.cfg.teams;
    if (!n) return;
    const ids = [...this.members.keys()];
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    const off = Math.floor(Math.random() * n);
    this.teamMap = {};
    ids.forEach((id, i) => {
      this.teamMap[id] = (i + off) % n;
    });
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
    if (this.cfg.duel) this.startDuelClock();
    this.startDuelEventTimer();
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
    if (this.cfg.duel && !this.pickFighters()) return; // a duel needs two sides
    this.started = true;
    this.winning = false;
    this.paused = false;
    for (const id of this.members.keys()) if (this.cfg.teams && this.teamMap[id] === undefined) this.assignTeam(id);
    this.openIntro();
    this.t0 = Date.now();
    this.kills = new Map();
    this.stakes = new Map();
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
    if (typeof m.allowVisit === 'boolean') cfg.allowVisit = m.allowVisit;
    if (m.waves !== undefined && Number.isInteger(Number(m.waves)) && Number(m.waves) >= 0 && Number(m.waves) <= 99) cfg.waves = Number(m.waves);
    if (['timer', 'vote', 'manual', 'instant'].includes(m.waveStart)) cfg.waveStart = m.waveStart;
    // these can be changed at any time, even in the middle of a round
    if (typeof m.allowThrow === 'boolean') cfg.allowThrow = m.allowThrow;
    if (typeof m.allowMelee === 'boolean') cfg.allowMelee = m.allowMelee;
    if (typeof m.streakMonsters === 'boolean') cfg.streakMonsters = m.streakMonsters;
    if (m.startMoney !== undefined && !this.started) cfg.startMoney = Math.min(99999, Math.max(0, Math.round(Number(m.startMoney)) || 0));
    if (['easy', 'medium', 'hard'].includes(m.difficulty)) cfg.difficulty = m.difficulty;
    if (!cfg.duel && Number.isFinite(Number(m.max))) cfg.max = Math.min(MAX_PLAYERS, Math.max(2, this.members.size, Math.round(Number(m.max))));
    // the rest is decided before the round
    if (!this.started) {
      if (typeof m.map === 'string' && !cfg.duel) cfg.seed = seedWithMap(cfg.seed, cfg.mode, m.map); // another map (the same mode, and the same layout roll)
      // Free Roam <-> Survival: the map, the start of the day and the fighting rules follow the mode
      if (['free', 'survival'].includes(m.mode) && m.mode !== cfg.mode) {
        if (cfg.duel) this.setDuel(false);
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
      if (cfg.mode === 'free' && typeof m.duel === 'boolean' && m.duel !== !!cfg.duel) this.setDuel(m.duel);
      if (cfg.duel) {
        if (m.shuffleTeams === true) this.shuffleTeams();
        if (TEAM_COUNTS.includes(Number(m.teams)) && m.teams !== undefined && Number(m.teams) !== cfg.teams) {
          cfg.teams = Number(m.teams);
          this.reassignAll();
        }
      }
    }
    // the duel settings: the bet, the clock and who fights (before a duel round, or any time between the duels of a running round)
    if (cfg.mode === 'free' && (cfg.duel ? !this.started : !this.duelLive)) {
      if (m.bet !== undefined) cfg.bet = cleanBet(m.bet);
      if (m.duelMins !== undefined) cfg.duelMins = cleanMins(m.duelMins);
      if (['pick', 'random', 'streak', 'robin'].includes(m.duelPick) && m.duelPick !== (cfg.duelPick || 'pick')) {
        cfg.duelPick = m.duelPick;
        this.resetMatches();
        this.fixPair(true);
      }
      if (m.reroll === true && cfg.duelPick === 'random') this.fixPair(true);
      const sides = (a, b) => !cfg.teams || this.teamMap[a] !== this.teamMap[b];
      if ((cfg.duelPick || 'pick') === 'pick' && Array.isArray(m.fighters) && m.fighters.length === 2 && m.fighters[0] !== m.fighters[1] && m.fighters.every((id) => this.members.get(String(id)) && !this.members.get(String(id)).ai) && (cfg.duel || sides(String(m.fighters[0]), String(m.fighters[1])))) cfg.fighters = m.fighters.map(String);
      if (!cfg.duel && m.duelEvery !== undefined && cleanEvery(m.duelEvery) !== (cfg.duelEvery || 0)) {
        cfg.duelEvery = cleanEvery(m.duelEvery);
        if (this.started) this.startDuelEventTimer();
      }
    }
    // the fighting rules can change in the middle of a round too: every game picks them up from the settings message
    if (cfg.mode === 'free' && !cfg.duel) {
      const wasWinBy = cfg.winBy;
      if (m.shuffleTeams === true) this.shuffleTeams();
      if (TEAM_COUNTS.includes(Number(m.teams)) && m.teams !== undefined && Number(m.teams) !== cfg.teams) {
        cfg.teams = Number(m.teams);
        this.reassignAll();
      }
      if (typeof m.pvp === 'boolean') cfg.pvp = m.pvp;
      if (m.winBy === 'duel' || m.winBy === 'monsters') cfg.winBy = m.winBy;
      if (m.target !== undefined) cfg.target = clampTarget(m.target, cfg.target);
      if (!cfg.pvp) cfg.winBy = 'monsters'; // with no player damage, the only way to win is monsters
      if (this.started && !this.winning) {
        if (cfg.winBy !== wasWinBy) this.kills = new Map(); // player kills and monster kills are different races: start the count again
        this.out({ t: 'settings', room: this.summary() });
        this.sendScores();
        const lead = [...this.members.keys()].find((id) => this.scoreOf(id) > 0 && this.scoreOf(id) >= cfg.target); // (a lower target may already be reached)
        if (lead) return this.finishRound(lead);
      }
    }
    this.out({ t: 'settings', room: this.summary() });
    this.sendTeams();
    this.touchRow({ ...cfgToRow(cfg), start_hour: this.startHour });
  }

  // switch the colosseum duel on or off: it takes the world, the fighting rules and the number of seats with it
  setDuel(on) {
    const cfg = this.cfg;
    if (on) {
      this.preDuel = { seed: cfg.seed, max: cfg.max, pvp: cfg.pvp, winBy: cfg.winBy, target: cfg.target, teams: cfg.teams };
      Object.assign(cfg, { duel: true, seed: ARENA_SEED, pvp: true, winBy: 'duel', target: 1 });
    } else {
      const p = this.preDuel || {};
      Object.assign(cfg, { duel: false, seed: p.seed && p.seed !== ARENA_SEED ? p.seed : seedForMode('sunny-meadow-101', cfg.mode), pvp: p.pvp ?? true, winBy: p.winBy || 'duel', target: p.target || defaultTarget('duel') });
    }
  }

  // the duel is against the clock: when it runs out, whoever has the lowest health loses (the same health is a draw)
  startDuelClock() {
    clearInterval(this.timers.duel);
    this.stakes = this.stakes || new Map();
    let left = Math.max(1, Number(this.cfg.duelMins) || 3) * 60;
    let n = 0;
    const tick = () => {
      if (!this.channel || !this.started || this.winning || !this.isHost) return clearInterval(this.timers.duel);
      if (!this.paused) left -= 1;
      if (n++ % 2 === 0 || left <= 10) this.out({ t: 'duel', left: Math.max(0, left) });
      if (left <= 0) {
        clearInterval(this.timers.duel);
        this.duelTimeUp();
      }
    };
    this.timers.duel = setInterval(tick, 1000);
    this.out({ t: 'duel', left });
  }

  // who fights: with teams, everybody (the teams fight each other); without, two players (the host's pick, or the first two in the room)
  // and everybody else watches. Returns false when there are not two sides.
  pickFighters() {
    const cfg = this.cfg;
    if (cfg.teams) for (const id of this.members.keys()) if (this.teamMap[id] === undefined) this.assignTeam(id);
    const hs = this.humans().sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
    let ids;
    if (cfg.teams) ids = hs.map((h) => h.id);
    else {
      let pick = (cfg.fighters || []).filter((id) => this.members.get(id) && !this.members.get(id).ai);
      if (pick.length !== 2 && (cfg.duelPick || 'pick') !== 'pick') pick = this.choosePair(cfg.duelPick, this.lastDuel) || [];
      ids = pick.length === 2 ? pick : hs.slice(0, 2).map((h) => h.id);
      this.duelRound += 1;
      for (const id of ids) this.lastFought.set(id, this.duelRound);
      this.duelPlayed.add([...ids].sort().join('|'));
    }
    const unit = (id) => (cfg.teams ? `t${this.teamMap[id]}` : id);
    if (new Set(ids.map(unit)).size < 2) return false;
    this.fighters = new Set(ids);
    this.fighterUnit = new Map(ids.map((id) => [id, unit(id)]));
    this.fallen = new Set();
    return true;
  }

  // a fighter is out (knocked out, or walked away): when only one side is left standing, it wins
  duelFall(victimId, killerId, reason = 'ko') {
    if (!this.duelRunning() || !this.started || !this.fighters.has(victimId) || this.fallen.has(victimId)) return;
    this.fallen.add(victimId);
    this.out({ t: 'duelfall', id: victimId });
    const killer = this.members.get(killerId);
    const victim = this.members.get(victimId);
    if (killer && victim && this.fighters.has(killerId) && killerId !== victimId) {
      const first = !this.firstDone;
      this.firstDone = true;
      this.out({ t: 'kill', killer: killer.name, victim: victim.name, killerId, victimId, first });
    }
    const standing = new Set([...this.fighters].filter((id) => !this.fallen.has(id)).map((id) => this.fighterUnit.get(id)));
    if (standing.size >= 2) return;
    this.finishDuel(standing.size === 1 ? [...standing][0] : null, reason);
  }

  // the bell: the side with the most health left wins (the same health is a draw)
  duelTimeUp() {
    if (!this.started || this.winning) return;
    const hp = (id) => (id === this.me ? this.pos?.hp : this.posOf.get(id)?.hp) ?? 0;
    const hearts = {};
    const sums = new Map();
    for (const id of this.fighters) {
      hearts[id] = this.fallen.has(id) ? 0 : hp(id);
      sums.set(this.fighterUnit.get(id), (sums.get(this.fighterUnit.get(id)) || 0) + hearts[id]);
    }
    const ranked = [...sums.entries()].sort((a, b) => b[1] - a[1]);
    if (!ranked.length || (ranked.length > 1 && Math.abs(ranked[0][1] - ranked[1][1]) < 0.05)) this.finishDuel(null, 'time', hearts);
    else this.finishDuel(ranked[0][0], 'time', hearts);
  }

  // `unit`: the side that won (null: a draw)
  finishDuel(unit, reason, hearts = null) {
    const event = this.duelLive; // a duel in the middle of a round: everybody carries on afterwards
    if (!event) this.winning = true;
    clearInterval(this.timers.duel);
    const ids = [...this.fighters];
    const winners = unit ? ids.filter((id) => this.fighterUnit.get(id) === unit) : [];
    const losers = unit ? ids.filter((id) => this.fighterUnit.get(id) !== unit) : [];
    if (event || !this.cfg.teams) this.lastDuel = { pair: ids, winner: winners[0] ?? null, winners, losers, draw: !unit };
    const teamed = !event && this.cfg.teams;
    const team = unit && teamed ? this.teamMap[winners[0]] ?? Number(String(unit).slice(1)) : null;
    const name = !unit ? 'Nobody' : team !== null && teamed ? `${TEAMS[team]?.name || 'A'} team` : this.members.get(winners[0])?.name || 'Someone';
    this.out({ t: event ? 'duelend' : 'win', id: winners[0] ?? null, name, team: team ?? null, target: 1, duel: true, draw: !unit, reason, winners, losers, fighters: ids, stakes: Object.fromEntries(this.stakes), hearts });
    if (event) {
      this.stakes = new Map();
      this.resetDuel();
      if (this.cfg.duelEvery > 0 && !this.cfg.duel) {
        this.duelNext = this.cfg.duelEvery * 60;
        this.out({ t: 'duelnext', left: this.duelNext });
      }
      return;
    }
    clearTimeout(this.timers.back);
    this.timers.back = setTimeout(() => this.returnToLobby(), CELEBRATE_MS);
  }

  // ---- the duels of a running round: every few minutes two players are called to the Colosseum ----

  startDuelEventTimer() {
    const cfg = this.cfg;
    if (this.duelLive) return; // (the next one is counted from the end of this one)
    clearInterval(this.timers.duelEvent);
    if (!this.isHost || !this.channel) return;
    if (!this.started || cfg.duel || cfg.mode !== 'free' || !(cfg.duelEvery > 0)) {
      this.duelNext = null;
      this.out({ t: 'duelnext', left: null });
      return;
    }
    this.duelNext = cfg.duelEvery * 60;
    this.timers.duelEvent = setInterval(() => this.eventTick(), 1000);
    this.out({ t: 'duelnext', left: this.duelNext });
  }

  eventTick() {
    if (!this.channel || !this.started || this.winning || !this.isHost || this.cfg.duel || !(this.cfg.duelEvery > 0)) {
      clearInterval(this.timers.duelEvent);
      return;
    }
    if (this.duelLive || this.paused || this.introOpen) return;
    this.duelNext -= 1;
    if (this.duelNext <= 0) return this.startDuelEvent();
    if (this.duelNext % 5 === 0 || this.duelNext <= 10) this.out({ t: 'duelnext', left: this.duelNext });
  }

  // two players who are not on the same team: the host's pick, or by the matchup rule (random, winner stays, round robin)
  eventPair() {
    const cfg = this.cfg;
    const mode = cfg.duelPick || 'pick';
    const here = (id) => this.members.get(id) && !this.members.get(id).ai;
    if (mode === 'pick' && cfg.fighters?.length === 2 && cfg.fighters.every(here) && (!cfg.teams || this.teamMap[cfg.fighters[0]] !== this.teamMap[cfg.fighters[1]])) return cfg.fighters;
    return this.choosePair(mode === 'pick' ? 'random' : mode, this.lastDuel);
  }

  startDuelEvent() {
    const pair = this.eventPair();
    if (!pair || this.winning) {
      this.duelNext = 30; // nobody to pit against each other: try again soon
      this.out({ t: 'duelnext', left: 30 });
      return;
    }
    this.fighters = new Set(pair);
    this.fighterUnit = new Map(pair.map((id) => [id, id]));
    this.fallen = new Set();
    this.stakes = new Map();
    this.duelLive = true;
    this.duelRound += 1;
    for (const id of pair) this.lastFought.set(id, this.duelRound);
    this.duelPlayed.add([...pair].sort().join('|'));
    this.out({ t: 'duelstart', fighters: pair, units: Object.fromEntries(this.fighterUnit), bet: this.cfg.bet || 0, left: Math.max(1, Number(this.cfg.duelMins) || 3) * 60 });
    this.startDuelClock();
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
    if (from !== this.hostId || this.started || cfg.mode !== 'free' || cfg.duel || this.members.size >= cfg.max) return;
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
    if (this.duelRunning()) {
      if (this.fighters.has(from)) return this.duelFall(from, String(m.killer || ''));
      return; // (someone who is only watching cannot fall)
    }
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
  finishRound(id, info = {}) {
    this.winning = true;
    clearInterval(this.timers.duel);
    const team = this.cfg.teams && id ? this.teamMap[id] ?? null : null;
    this.out({ t: 'win', id, name: !id ? 'Nobody' : team !== null ? `${TEAMS[team].name} team` : this.members.get(id)?.name || 'Someone', team, target: this.cfg.target });
    clearTimeout(this.timers.back);
    this.timers.back = setTimeout(() => this.returnToLobby(), CELEBRATE_MS);
  }

  returnToLobby() {
    if (!this.channel || !this.isHost) return;
    this.started = false;
    this.winning = false;
    this.paused = false;
    this.introOpen = false;
    clearInterval(this.timers.duel);
    clearInterval(this.timers.duelEvent);
    this.stakes = new Map();
    this.resetDuel();
    this.fixPair(true); // the next duel's pair, by the room's rule
    this.kills = new Map();
    this.firstDone = false; // has anyone been taken down yet this round (for First Blood)
    this.out({ t: 'lobby', room: this.summary(), teams: { ...this.teamMap }, host: this.hostId, players: [...this.members.values()].map((m) => this.publicPlayer(m)), scores: this.scoreList() });
    this.touchRow({ started: false });
  }
}
