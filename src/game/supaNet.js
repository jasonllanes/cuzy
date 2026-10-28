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

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to keep codes easy to read out loud
const HOURS_PER_SECOND = 24 / 360; // keep in step with the client's day length
const START_HOUR = 8;
const KILL_TARGET = 10;
const MONSTER_TARGET = 15;
const MAX_PLAYERS = 10;
const INTRO_MAX_MS = 45000; // the longest everyone waits for slow players to finish the opening scene
const CELEBRATE_MS = 7000; // how long a winner is cheered before everyone returns to the waiting room
const HEARTBEAT_MS = 15000; // the host touches its lobby row this often
const STALE_MS = 60000; // a room whose row has not been touched for this long is not listed
const STATE_MS = 100; // positions go out at most this often

const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);
const num = (v) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : 0);
const defaultTarget = (winBy) => (winBy === 'monsters' ? MONSTER_TARGET : KILL_TARGET);
const clampTarget = (v, fallback) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.min(99, Math.max(1, Math.round(Number(v)))) : fallback);
const newId = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
const newCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

const CFG_KEYS = ['name', 'seed', 'max', 'mode', 'difficulty', 'pvp', 'winBy', 'target', 'allowLate', 'allowThrow', 'allowMelee', 'streakMonsters'];
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
});

export class SupaNet {
  constructor(getClient) {
    this.getClient = getClient;
    this.status = 'connecting'; // connecting | online | offline
    this.rooms = [];
    this.lan = [];
    this.problem = ''; // something worth telling the player (for example, the rooms table is missing)
    this.listeners = new Set();
    this.wantLobby = false;
    this.closed = false;
    this.me = newId();
    this.sb = null;
    this.timers = { lobby: 0, heartbeat: 0, state: 0, intro: 0, back: 0 };
    this.resetRoom();
    this.connect();
  }

  get offlineText() {
    return "Can't reach Supabase. Check your internet connection and the VITE_SUPABASE_* values in .env.";
  }

  get isHost() {
    return this.hostId === this.me;
  }

  resetRoom() {
    this.channel = null;
    this.code = null;
    this.cfg = null;
    this.members = new Map(); // id -> { id, name, hero, slot, at }
    this.posOf = new Map(); // id -> last known position
    this.hostId = null;
    this.started = false;
    this.winning = false;
    this.syncing = false;
    this.startHour = START_HOUR;
    this.t0 = Date.now();
    this.kills = new Map(); // host's score keeping
    this.lastScores = []; // what the host last announced (so a new host can carry on)
    this.introOpen = false;
    this.introReady = new Set();
    this.pos = { x: 0, y: 0, dir: 'down', moving: false, hp: 6, hidden: false, lv: 1 };
    this.lastState = 0;
    this.pendingState = null;
    this.gotSync = null;
  }

  async connect() {
    this.sb = await this.getClient();
    this.setStatus(this.sb ? 'online' : 'offline');
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
    const { data, error } = await this.sb.from('rooms').select('*').gt('updated_at', since).order('updated_at', { ascending: false }).limit(50);
    if (error) {
      this.problem = friendly(error);
      this.rooms = [];
    } else {
      this.problem = '';
      this.rooms = data.map(rowToSummary);
      // tidy up rooms whose host vanished long ago
      this.sb.from('rooms').delete().lt('updated_at', new Date(Date.now() - 10 * STALE_MS).toISOString()).then(() => {}, () => {});
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

  async create({ name, seed, max, pvp, mode, difficulty, winBy, allowLate, allowThrow, allowMelee, streakMonsters, target, player }) {
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
      allowLate: allowLate !== false,
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
    ch.on('presence', { event: 'sync' }, () => this.resolveSync?.());
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
    if (!creator) await Promise.race([this.gotSync, new Promise((r) => setTimeout(r, 2500))]);
    this.readPresence();
    const taken = new Set([...this.members.values()].map((m) => m.slot));
    let slot = 0;
    while (taken.has(slot)) slot++;
    const meta = { id: this.me, name: me.name, hero: me.hero, slot, at: Date.now() };
    this.members.set(this.me, meta);
    await ch.track(meta);
    if (!creator && !this.members.has(this.hostId)) this.hostId = this.electHost();
    this.syncing = false;
    return slot;
  }

  readPresence() {
    const state = this.channel.presenceState();
    for (const [key, metas] of Object.entries(state)) {
      const m = metas[0];
      if (m && key !== this.me && m.id) this.members.set(m.id, m);
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
    clearTimeout(this.timers.state);
    const alone = this.members.size <= 1;
    const code = this.code;
    // say goodbye at once; Presence only notices a departure a few seconds later
    try {
      await ch.send({ type: 'broadcast', event: 'm', payload: { t: 'bye', id: this.me } });
    } catch {
      /* best effort */
    }
    this.channel = null; // from now on its events are ignored
    try {
      if (alone) await this.sb.from('rooms').delete().eq('code', code);
      await ch.untrack();
      await this.sb.removeChannel(ch);
    } catch {
      /* leaving is best effort */
    }
    this.resetRoom();
  }

  close() {
    this.closed = true;
    this.stopLobby();
    return this.leave();
  }

  // ---------- who is here ----------

  publicPlayer(m) {
    return { id: m.id, slot: m.slot, name: m.name, hero: m.hero, ...(this.posOf.get(m.id) || { x: 0, y: 0, dir: 'down', moving: false, hp: 6 }) };
  }

  scoreList() {
    return [...this.members.values()].map((m) => ({ id: m.id, name: m.name, kills: this.kills.get(m.id) || 0 }));
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
    const sorted = [...this.members.values()].sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
    return sorted[0]?.id || this.me;
  }

  onPresenceJoin(list) {
    for (const m of list || []) {
      if (!m.id || m.id === this.me || this.members.has(m.id)) continue;
      this.members.set(m.id, m);
      if (this.syncing) continue;
      this.emit({ t: 'peer_join', player: this.publicPlayer(m) });
      if (this.isHost) {
        this.sendScores();
        this.touchRow();
      }
    }
  }

  onPresenceLeave(list) {
    if (this.syncing || !this.channel) return;
    for (const m of list || []) {
      if (!m.id || m.id === this.me || !this.members.has(m.id)) continue;
      this.members.delete(m.id);
      this.kills.delete(m.id);
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

  bcast(payload) {
    if (!this.channel) return;
    this.channel.send({ type: 'broadcast', event: 'm', payload }).catch?.(() => {});
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
        const dmg = Math.max(1, Math.min(4, Math.round(Number(m.dmg) || 1)));
        this.bcast({ t: 'hit', to: String(m.target), from: this.me, dmg, fx: this.pos.x, fy: this.pos.y });
        break;
      }
      case 'died':
        this.request('died', { killer: String(m.killer) });
        break;
      case 'start':
      case 'ready':
      case 'settings':
      case 'mkill':
        this.request(m.t, m);
        break;
      case 'fell':
        if (this.started) this.bcast({ t: 'fell', id: this.me });
        break;
      case 'skill':
        // a monster kill that counts towards streaks, if the host allowed that
        if (this.cfg.streakMonsters && this.started && !this.winning) {
          this.out({ t: 'kill', killer: this.members.get(this.me)?.name || 'Someone', victim: clean(m.victim, 24) || 'a monster', killerId: this.me, victimId: 'npc' });
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
        if (m.kind === 'swing') this.bcast({ t: 'fx', id: this.me, kind: 'swing', a: num(m.a) });
        else if (m.kind === 'shield') this.bcast({ t: 'fx', id: this.me, kind: 'shield' });
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
      hp: Math.max(0, Math.min(12, Math.round(Number(m.hp) || 0))),
      lv: Math.max(1, Math.min(9, Math.round(Number(m.lv)) || 1)), // sword level, shown next to the health bar
    };
    const wait = this.lastState + STATE_MS - Date.now();
    if (wait <= 0) this.flushState();
    else if (!this.timers.state) {
      this.timers.state = setTimeout(() => {
        this.timers.state = 0;
        this.flushState();
      }, wait);
    }
  }

  flushState() {
    this.lastState = Date.now();
    this.bcast({ t: 'state', id: this.me, ...this.pos });
  }

  // a request for the host (a message of its own kind, so it is never mistaken for an announcement)
  request(r, m = {}) {
    const msg = { r, to: 'host', from: this.me, ...m };
    delete msg.t;
    if (this.isHost) this.handleRequest(msg);
    else this.bcast(msg);
  }

  // anything that arrives from the channel (or from ourselves, via out())
  receive(m) {
    if (!m || typeof m !== 'object') return;
    if (m.r) {
      if (this.isHost && m.from !== this.me) this.handleRequest(m);
      return;
    }
    if (m.t === 'bye') {
      // someone left on purpose: no need to wait for Presence to notice
      const gone = this.members.get(m.id);
      if (gone) this.onPresenceLeave([gone]);
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
        this.emit({ ...msg, players: msg.players.filter((p) => p.id !== this.me) });
        return;
      case 'lobby':
        this.started = false;
        this.winning = false;
        this.cfg = pickCfg(msg.room);
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
    switch (m.r) {
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
      default:
    }
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
  }

  // if every player has finished or skipped it, the game starts at once
  checkIntro() {
    if (this.introOpen && [...this.members.keys()].every((id) => this.introReady.has(id))) this.closeIntro();
  }

  hStart(from) {
    if (this.started || from !== this.hostId) return;
    this.started = true;
    this.winning = false;
    this.openIntro();
    this.t0 = Date.now();
    this.kills = new Map();
    this.out({
      t: 'start',
      room: this.summary(),
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
    // everything else is decided before the round, not during it
    if (!this.started) {
      if (typeof m.allowThrow === 'boolean') cfg.allowThrow = m.allowThrow;
      if (typeof m.allowMelee === 'boolean') cfg.allowMelee = m.allowMelee;
      if (typeof m.streakMonsters === 'boolean') cfg.streakMonsters = m.streakMonsters;
      if (Number.isFinite(Number(m.max))) cfg.max = Math.min(MAX_PLAYERS, Math.max(2, this.members.size, Math.round(Number(m.max))));
      if (free) {
        if (typeof m.pvp === 'boolean') cfg.pvp = m.pvp;
        if (m.winBy === 'duel' || m.winBy === 'monsters') cfg.winBy = m.winBy;
        if (m.target !== undefined) cfg.target = clampTarget(m.target, cfg.target);
        if (!cfg.pvp) cfg.winBy = 'monsters'; // with no player damage, the only way to win is monsters
      }
    }
    this.out({ t: 'settings', room: this.summary() });
    this.touchRow(cfgToRow(cfg));
  }

  hReady(from) {
    if (!this.started) return;
    if (!this.introOpen) {
      this.out({ t: 'go', to: from }); // a late joiner: the round is already running
      return;
    }
    this.introReady.add(from);
    this.checkIntro();
  }

  // the victim reports its own defeat so the right player gets the point
  hDied(from, m) {
    const cfg = this.cfg;
    if (!cfg.pvp || !this.started || this.winning) return;
    const killer = this.members.get(String(m.killer));
    const victim = this.members.get(from);
    if (!killer || !victim || killer.id === from) return;
    // a player took down a player: everyone hears about it (kill streaks are global); it only scores in a "player kills" room
    this.out({ t: 'kill', killer: killer.name, victim: victim.name, killerId: killer.id, victimId: from });
    if (cfg.winBy === 'monsters') return;
    const n = (this.kills.get(killer.id) || 0) + 1;
    this.kills.set(killer.id, n);
    if (n >= cfg.target) this.finishRound(killer.id);
    this.sendScores();
  }

  // in a "monster kills" room each client reports the monsters it takes down
  hMkill(from) {
    const cfg = this.cfg;
    if (cfg.winBy !== 'monsters' || !this.started || this.winning) return;
    const n = (this.kills.get(from) || 0) + 1;
    this.kills.set(from, n);
    this.sendScores();
    if (n >= cfg.target) this.finishRound(from);
  }

  // a player reached the target: cheer them, then send everyone back to the waiting room
  finishRound(id) {
    this.winning = true;
    this.out({ t: 'win', id, name: this.members.get(id)?.name || 'Someone', target: this.cfg.target });
    clearTimeout(this.timers.back);
    this.timers.back = setTimeout(() => this.returnToLobby(), CELEBRATE_MS);
  }

  returnToLobby() {
    if (!this.channel || !this.isHost) return;
    this.started = false;
    this.winning = false;
    this.introOpen = false;
    this.kills = new Map();
    this.out({ t: 'lobby', room: this.summary(), host: this.hostId, players: [...this.members.values()].map((m) => this.publicPlayer(m)), scores: this.scoreList() });
    this.touchRow({ started: false });
  }
}
