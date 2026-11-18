// Do or Die: a Werebear (one of the players) hunts the others. The survivors share a list of tasks, and when they are all done a chopper
// lands somewhere on the map. Everyone sees the progress; survivors carry a flashlight in the fog, the Werebear has traps, a hook and
// the Killer Eye. A fallen survivor stays where they fell as a body and can be brought back (as many times as the host allows).
//
// The host (SupaNet.hDod) is the referee for what everyone must agree on (tasks done, who fell, who got back up, who made it onto the
// chopper); this file is everything one player's game does: the fog, the abilities, the tasks and the pictures.
import { sfx } from './sfx';
import { TINY } from './tiny';

const TYPES = ['wires', 'math', 'colors', 'ricochet', 'switches', 'engine'];
export const TASK_NAMES = {
  wires: 'Connect the wires',
  math: 'Crack the lock (maths)',
  colors: 'Repeat the colours',
  ricochet: 'Bounce the shot',
  switches: 'Switch everything on',
  engine: 'Start the engine',
};
const TASK_ICON = { wires: '🔌', math: '🔢', colors: '🎨', ricochet: '🎯', switches: '🔦', engine: '🚗' };
const HUMAN_FOG = 'rgba(1,2,6,0.985)';
const REVIVE_TIME = 6;
const CRATE_TIME = 1.4;
const ITEM_CD = 4; // seconds between two grenades
const FLASH_R = 330; // a flashbang blinds the Werebear when it goes off this close
const FLASH_TIME = 5;
const SMOKE_TIME = 6;
const HOOK_CD = 12;
const HOOK_RANGE = 200;
const EYE_CD = 30;
const EYE_TIME = 5;
const SWING_CD = 0.9;
const KILL_R = 30;
const MAX_TRAPS = 3;
const hash = (a, b) => {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

export class DodSystem {
  constructor(g, saved = null) {
    this.g = g;
    this.me = String(g.mp?.you ?? 'me');
    this.killer = null; // the Werebear's id (null: nobody is hunting, a practice round)
    this.ph = 'tasks';
    this.tot = 0;
    this.done = new Set();
    this.ch = -1;
    this.lives = 1;
    this.players = new Map(); // id -> { st: 'alive' | 'dead' | 'out', rv, bx, by }
    this.got = false; // the host's first message has arrived
    this.positioned = false;
    this.light = 0; // flashlight level
    this.items = { flash: 0, smoke: 0 };
    this.itemCd = 0;
    this.opened = new Set(); // crates already looted
    this.flashT = 0; // the Werebear's blindness (seconds left)
    this.smokeT = 0;
    this.stunT = 0;
    this.pull = null;
    this.traps = [];
    this.eyeT = 0;
    this.eyeCd = 0;
    this.hookCd = 0;
    this.swingCd = 0;
    this.swingT = 0;
    this.hooks = []; // ropes drawn for a moment
    this.clouds = []; // smoke
    this.pings = []; // a revive somewhere (for the Werebear)
    this.alert = null; // a line of text for the HUD
    this.task = null; // the task window that is open: { i, type }
    this.hold = null; // { kind: 'revive' | 'crate', id, t, need }
    this.fDown = false;
    this.warnT = 0; // a red edge on the screen for a moment (the Eye is looking)
    this.prompt = null;
    this.fogCv = null;
    this.solidCache = new Map();
    this.bot = null; // the computer Werebear (when the room chose one)
    this.botNet = null;
    this.t = 0;
    this.lastSt = 'alive';
    this.sel = 2; // the inventory slot in hand: 1 compass, 2 flashlight, 3 flashbang, 4 smoke (the compass only shows while it is in hand)
    this.revealT = 0; // the big "you are ..." card when the round begins
    this.syncT = 0.5;
    if (saved) this.applyState(saved, true);
    else if (!g.mp) this.localStart(); // (no room: a practice round of your own, with a little referee of its own)
  }

  // ---------- no room: the same rules, played alone ----------
  localStart() {
    this.localHostState = { k: null, ph: 'tasks', tot: 3, done: [], ch: -1, lives: 1, p: [[this.me, 'alive', 0, 0, 0]] };
    this.applyState({ ...this.localHostState });
  }

  localHost(op, m) {
    const s = this.localHostState;
    if (!s) return;
    const me = s.p.find((x) => x[0] === this.me);
    if (op === 'task' && s.ph === 'tasks' && !s.done.includes(m.i)) {
      s.done.push(m.i);
      if (s.done.length >= s.tot) {
        s.ph = 'extract';
        s.ch = Math.floor(Math.random() * 6);
      }
    } else if (op === 'kill') {
      const t = s.p.find((x) => x[0] === String(m.id));
      if (t && t[1] === 'alive') {
        t[1] = 'dead';
        t[3] = m.x;
        t[4] = m.y;
      }
    } else if (op === 'revive') {
      const t = s.p.find((x) => x[0] === String(m.id));
      if (t && t[1] === 'dead' && t[2] < s.lives) {
        t[1] = 'alive';
        t[2]++;
      }
    } else if (op === 'out' && me) me[1] = 'out';
    this.applyState({ ...s, done: [...s.done], p: s.p.map((x) => [...x]) });
  }

  // ---------- who is who ----------
  get isKiller() {
    return this.killer === this.me;
  }

  get botKiller() {
    return this.killer === 'bot';
  }

  get my() {
    return this.players.get(this.me);
  }

  get ghost() {
    return this.my?.st === 'dead';
  }

  get out() {
    return this.my?.st === 'out';
  }

  isKillerId(id) {
    return this.killer !== null && String(id) === this.killer;
  }

  // ---------- the world's things (the same on every computer) ----------
  stationPos(i) {
    return this.g.world.dodSpot(i, 1, 14, 78);
  }

  stationType(i) {
    return TYPES[Math.floor(hash(i + 3, this.g.world.seed) * 997 + i) % TYPES.length];
  }

  crateCount() {
    return Math.max(8, Math.round(this.tot * 1.2) + 4);
  }

  cratePos(i) {
    return this.g.world.dodSpot(i, 2, 10, 85);
  }

  crateItem(i) {
    const r = hash(i + 11, this.g.world.seed);
    return r < 0.4 ? 'flash' : r < 0.78 ? 'smoke' : 'light';
  }

  chopperPos(ch) {
    return this.g.world.dodSpot(ch, 3, 75, 115);
  }

  // ---------- the host's word ----------
  applyState(m, first = false) {
    const g = this.g;
    const wasMine = this.my?.st;
    this.killer = m.k ? String(m.k) : null;
    this.tot = Number(m.tot) || 0;
    this.lives = Number(m.lives) || 0;
    this.done = new Set((m.done || []).map(Number));
    this.players = new Map((m.p || []).map(([id, st, rv, bx, by]) => [String(id), { st, rv, bx, by }]));
    const prevPh = this.ph;
    this.ph = m.ph || 'tasks';
    this.ch = Number.isFinite(m.ch) ? m.ch : -1;
    this.got = true;
    if (this.ph === 'extract' && this.ch >= 0 && !g.chopper) {
      const c = this.chopperPos(this.ch);
      g.chopper = { x: c.x, y: c.y, t: first ? 10 : 0, lift: 0 };
      if (!first) {
        sfx.play('wave');
        g.onAnnounce?.({ title: '🚁 THE CHOPPER IS COMING', sub: this.isKiller ? 'Wait for them there…' : 'Follow your compass and run!', tier: 2, mine: true });
      }
    }
    if (!this.positioned) {
      this.positioned = true;
      if (this.isKiller && !first) {
        const s = g.world.dodSpot(0, 4, 55, 75);
        g.player.x = s.x;
        g.player.y = s.y;
        g.cam.x = s.x;
        g.cam.y = s.y;
        this.revealT = 5.5;
        sfx.play('wave');
      } else if (!first) {
        this.revealT = 5.5;
        sfx.play('wave', 0.7);
      }
    }
    const now = this.my?.st;
    if (wasMine && now !== wasMine) this.myChanged(wasMine, now);
    if (prevPh !== this.ph && this.ph === 'extract' && this.isKiller) this.alert = { text: 'The chopper has landed: the survivors will come to it.', t: 6 };
  }

  myChanged(from, to) {
    const g = this.g;
    this.hold = null;
    if (to === 'dead') {
      this.task = null;
      g.combat.hidden = true;
      sfx.play('death');
      const left = this.lives - (this.my?.rv || 0);
      this.alert = { text: left > 0 ? 'You were caught! Stay put: a survivor can bring you back.' : 'You were caught, and there is no way back. Watch how it ends.', t: 8 };
      g.onToast?.(left > 0 ? '💀 You were caught! A survivor can revive you.' : '💀 You were caught for good.');
    } else if (from === 'dead' && to === 'alive') {
      sfx.play('levelup');
      this.alert = { text: 'You are back! Get on with it.', t: 5 };
      g.onToast?.('✨ You were revived!');
      g.combat.invuln = Math.max(g.combat.invuln || 0, 3);
    }
  }

  onNet(m) {
    const g = this.g;
    if (m.t === 'dod') return this.applyState(m);
    if (m.t !== 'dodfx') return;
    const from = String(m.from ?? '');
    if (m.k === 'bot') {
      if (!this.amHost()) this.botNet = { x: m.x, y: m.y, dir: ['down', 'up', 'left', 'right'][m.a] || 'down', moving: !!(m.i & 1), swing: m.i & 2 ? 0.3 : 0 };
      return;
    }
    if (m.k === 'flash') {
      this.puff(m.x, m.y, '#ffffff');
      if (this.botKiller && this.bot && this.amHost() && Math.hypot(m.x - this.bot.x, m.y - this.bot.y) < FLASH_R) this.bot.flashT = FLASH_TIME;
      if (this.isKiller && this.flashT <= 0.2 && Math.hypot(m.x - g.player.x, m.y - g.player.y) < FLASH_R) {
        this.flashT = FLASH_TIME; // (only the first one counts: while you are blind another one adds nothing)
        sfx.play('boom', 0.6);
      }
    } else if (m.k === 'smoke') {
      this.clouds.push({ x: m.x, y: m.y, t: 0 });
    } else if (m.k === 'trap') {
      this.traps = this.traps.filter((t) => t.i !== m.i);
      this.traps.push({ i: m.i, x: m.x, y: m.y, by: from, t: 0 });
    } else if (m.k === 'trapoff') {
      this.traps = this.traps.filter((t) => t.i !== m.i);
    } else if (m.k === 'hook') {
      const r = this.g.remotes.get(from);
      this.hooks.push({ x: r ? r.x : m.x, y: (r ? r.y : m.y) - 8, tx: m.a, ty: m.i, t: 0 });
      if (m.to === this.me && !this.ghost && !this.out) {
        this.pull = { x: m.x, y: m.y, t: 0 };
        this.stunT = Math.max(this.stunT, 1);
        this.task = null;
        sfx.play('hurt', 0.7);
        g.onToast?.('🪝 The Werebear hooked you!');
      }
    } else if (m.k === 'revive') {
      if (this.isKiller) {
        this.pings.push({ x: m.x, y: m.y, t: 0 });
        this.alert = { text: '⚠️ Someone is reviving a survivor!', t: 5 };
        sfx.play('wave', 0.6);
      }
    } else if (m.k === 'eye') {
      if (!this.isKiller && !this.ghost) {
        this.warnT = 1.6;
        g.onToast?.('👁 The Werebear is searching for you…');
      }
    } else if (m.k === 'swing') {
      const r = this.g.remotes.get(from);
      if (r) r.dodSwing = 0.3;
    } else if (m.k === 'loot') {
      this.opened.add(m.i);
    }
  }

  send(op, extra = {}) {
    if (!this.g.mp) return this.localHost(op, extra);
    this.g.mp.net.send({ t: 'dodreq', op, ...extra });
  }

  fx(k, extra = {}) {
    const p = this.g.player;
    this.g.mp?.net.send({ t: 'dodfx', k, x: p.x, y: p.y, ...extra });
  }

  puff(x, y) {
    this.g.pfx?.spawn('impacts/hit-spark', x, y - 10, { scale: 1.4, seed: 1 });
  }

  // ---------- input ----------
  // true when the key is ours
  key(e) {
    const g = this.g;
    if (g.dead && !this.ghost) return false;
    const c = e.code;
    if (c === 'KeyF') {
      if (e.repeat) return true;
      if (this.ghost || this.out) return false;
      const near = this.nearThing();
      if (!near) return false;
      this.fDown = true;
      if (near.kind === 'station') this.openTask(near.i);
      else if (near.kind === 'body') this.startHold('revive', near.id, REVIVE_TIME);
      else if (near.kind === 'crate') this.startHold('crate', near.i, CRATE_TIME);
      return true;
    }
    if (/^Digit[1-4]$/.test(c)) {
      if (!e.repeat) this.select(Number(c[5]));
      return true;
    }
    if (['KeyQ', 'KeyE', 'KeyR', 'KeyH', 'KeyB', 'KeyM', 'KeyK', 'KeyX', 'KeyC'].includes(c)) {
      if (e.repeat || this.ghost || this.out || this.stunT > 0 || this.task) return true;
      if (this.isKiller) {
        if (c === 'KeyQ') this.hook();
        else if (c === 'KeyE') this.placeTrap();
        else if (c === 'KeyR') this.eye();
      } else if (c === 'KeyQ') this.useFlash();
      else if (c === 'KeyE') this.useSmoke();
      return true;
    }
    return false;
  }

  // pick a slot of the inventory (the compass again puts it away)
  select(n) {
    this.sel = n === 1 && this.sel === 1 ? 2 : n;
    this.g.emitHud();
  }

  // a chest or car in the city: it holds one of the three things you can find
  chestItem(o) {
    const r = hash(Math.round(o.x) * 31 + Math.round(o.y), this.g.world.seed + 9);
    return r < 0.4 ? 'flash' : r < 0.78 ? 'smoke' : 'light';
  }

  openWorldChest(o) {
    this.gotItem(this.chestItem(o));
  }

  keyUp(e) {
    if (e.code === 'KeyF') {
      this.fDown = false;
      this.hold = null;
    }
  }

  // The survivors hiding in the house the Werebear is standing in (a hidden survivor in a house is reported at the door of it: the same spot)
  found() {
    const g = this.g;
    if (!g.inside?.out) return [];
    const o = g.inside.out;
    const list = [];
    for (const [id, v] of this.players) {
      if (v.st !== 'alive') continue;
      const r = g.remotes.get(id);
      if (r && r.hidden && Math.abs(r.x - o.x) < 4 && Math.abs(r.y - o.y) < 4) list.push({ id, r });
    }
    return list.map((f, k) => ({ ...f, x: g.cam.x - 40 + k * 30, y: g.cam.y + 22 }));
  }

  drawInside(ctx) {
    if (!this.isKiller) return;
    for (const f of this.found()) {
      this.g.drawHeroAt(ctx, f.r.hero, 'down', false, this.g.animT, f.x, f.y);
      ctx.fillStyle = 'rgba(255,60,70,0.95)';
      ctx.font = '5px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('found you!', f.x, f.y - 26);
    }
  }

  click() {
    if (!this.isKiller || this.ghost || this.stunT > 0 || this.swingCd > 0 || this.flashT > 2.5) return;
    const g = this.g;
    this.swingCd = SWING_CD;
    this.swingT = 0.3;
    const p = g.player;
    this.fx('swing');
    sfx.play('swing', 0.7);
    if (g.inside) {
      // inside a house: the ones found in it are right there
      for (const f of this.found()) {
        if (Math.hypot(f.x - p.x, f.y - p.y) < 44) {
          this.send('kill', { id: f.id, x: f.r.x, y: f.r.y });
          g.onToast?.('🐻 Got one!');
        }
      }
      return;
    }
    for (const [id, v] of this.players) {
      if (v.st !== 'alive') continue;
      const r = g.remotes.get(id);
      if (!r) continue;
      if (Math.hypot(r.x - p.x, r.y - p.y) <= KILL_R) {
        this.send('kill', { id, x: r.x, y: r.y });
        sfx.play('hit', 0.8);
        g.onToast?.('🐻 Got one!');
      }
    }
  }

  // ---------- things near me ----------
  nearThing() {
    const g = this.g;
    const p = g.player;
    if (this.stunT > 0 || this.pull || g.inside || this.ghost || this.out) return null;
    if (!this.isKiller) {
      for (const [id, v] of this.players) {
        if (v.st === 'dead' && id !== this.me && v.rv < this.lives && Math.hypot(v.bx - p.x, v.by - p.y) < 26) return { kind: 'body', id, x: v.bx, y: v.by };
      }
      if (this.ph === 'tasks') {
        for (let i = 0; i < this.tot; i++) {
          if (this.done.has(i)) continue;
          const s = this.stationPos(i);
          if (Math.hypot(s.x - p.x, s.y - p.y) < 24) return { kind: 'station', i, x: s.x, y: s.y };
        }
      }
      for (let i = 0; i < this.crateCount(); i++) {
        if (this.opened.has(i)) continue;
        const s = this.cratePos(i);
        if (Math.hypot(s.x - p.x, s.y - p.y) < 22) return { kind: 'crate', i, x: s.x, y: s.y };
      }
    }
    return null;
  }

  startHold(kind, id, need) {
    this.hold = { kind, id, t: 0, need };
    if (kind === 'revive') {
      const v = this.players.get(id);
      this.fx('revive', { x: v?.bx, y: v?.by });
    }
  }

  openTask(i) {
    this.task = { i, type: this.stationType(i), seed: Math.floor(hash(i, this.g.world.seed + 5) * 1e6) };
    this.g.emitHud();
  }

  finishTask(ok) {
    const t = this.task;
    this.task = null;
    if (ok && t && !this.done.has(t.i)) {
      this.send('task', { i: t.i });
      sfx.play('levelup', 0.6);
    }
    this.g.emitHud();
  }

  // ---------- survivors' items ----------
  useFlash() {
    if (this.items.flash <= 0 || this.itemCd > 0) return;
    this.items.flash--;
    this.itemCd = ITEM_CD;
    const p = this.g.player;
    this.fx('flash');
    this.puff(p.x, p.y);
    sfx.play('boom', 0.4);
    this.g.onToast?.('💥 Flashbang!');
    this.g.emitHud();
  }

  useSmoke() {
    if (this.items.smoke <= 0 || this.itemCd > 0) return;
    this.items.smoke--;
    this.itemCd = ITEM_CD;
    const p = this.g.player;
    this.smokeT = SMOKE_TIME;
    this.g.combat.invisT = SMOKE_TIME;
    this.clouds.push({ x: p.x, y: p.y, t: 0 });
    this.fx('smoke');
    sfx.play('whoosh', 0.5);
    this.g.onToast?.('💨 Smoke! The Werebear cannot see you for a moment.');
    this.g.emitHud();
  }

  gotItem(k) {
    const g = this.g;
    if (k === 'flash') this.items.flash = Math.min(3, this.items.flash + 1);
    else if (k === 'smoke') this.items.smoke = Math.min(3, this.items.smoke + 1);
    else {
      this.light = Math.min(3, this.light + 1);
    }
    sfx.play('pickup', 0.7);
    g.onToast?.(k === 'flash' ? '💥 Flashbang (Q)' : k === 'smoke' ? '💨 Smoke grenade (E)' : `🔦 Flashlight upgrade! (level ${this.light})`);
    g.emitHud();
  }

  // ---------- the Werebear's skills ----------
  aim() {
    const g = this.g;
    const p = g.player;
    if (g.touchMode) return { right: 0, left: Math.PI, up: -Math.PI / 2, down: Math.PI / 2 }[p.dir] ?? 0;
    const m = g.mouseWorld();
    return Math.atan2(m.y - (p.y - 8), m.x - p.x);
  }

  hook() {
    if (this.hookCd > 0 || this.flashT > 2.5) return;
    const g = this.g;
    const p = g.player;
    const a = this.aim();
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    let best = null;
    let bd = 1e9;
    for (const [id, v] of this.players) {
      if (v.st !== 'alive') continue;
      const r = g.remotes.get(id);
      if (!r) continue;
      const dx = r.x - p.x;
      const dy = r.y - 8 - (p.y - 8);
      const along = dx * ux + dy * uy;
      if (along < 0 || along > HOOK_RANGE) continue;
      if (Math.abs(dx * uy - dy * ux) <= 20 && along < bd) {
        bd = along;
        best = { id, r };
      }
    }
    this.hookCd = HOOK_CD;
    const ex = best ? best.r.x : p.x + ux * HOOK_RANGE;
    const ey = best ? best.r.y - 8 : p.y - 8 + uy * HOOK_RANGE;
    this.hooks.push({ x: p.x, y: p.y - 8, tx: ex, ty: ey, t: 0 });
    sfx.play('throw', 0.7);
    this.g.mp?.net.send({ t: 'dodfx', k: 'hook', x: p.x, y: p.y, a: ex, i: ey, ...(best ? { to: best.id } : {}) });
    if (!best) g.onToast?.('🪝 Missed…');
    g.emitHud();
  }

  placeTrap() {
    if (this.itemCd > 0) return;
    const mine = this.traps.filter((t) => t.by === this.me);
    if (mine.length >= MAX_TRAPS) {
      this.g.onToast?.(`🪤 You can only have ${MAX_TRAPS} traps out.`);
      return;
    }
    this.itemCd = 1;
    const p = this.g.player;
    let i = 0;
    while (this.traps.some((t) => t.i === i)) i++;
    this.traps.push({ i, x: p.x, y: p.y, by: this.me, t: 0 });
    this.fx('trap', { i });
    sfx.play('equip', 0.7);
    this.g.emitHud();
  }

  eye() {
    if (this.eyeCd > 0) return;
    this.eyeCd = EYE_CD;
    this.eyeT = EYE_TIME;
    this.fx('eye');
    sfx.play('recall', 0.7);
    this.g.onToast?.('👁 Killer Eye: they cannot hide!');
    this.g.emitHud();
  }

  // ---------- the computer Werebear (it runs on the host's game, and everybody is told where it is) ----------
  amHost() {
    return !this.g.mp || this.g.hostId === this.me;
  }

  updateBot(dt) {
    const g = this.g;
    if (!this.bot) {
      const s = g.world.dodSpot(0, 4, 55, 75);
      this.bot = { x: s.x, y: s.y, dir: 'down', moving: false, swing: 0, cd: 1, flashT: 0, goal: null, stuck: 0, sendT: 0, wander: 0 };
    }
    const b = this.bot;
    b.cd = Math.max(0, b.cd - dt);
    b.swing = Math.max(0, b.swing - dt);
    b.flashT = Math.max(0, b.flashT - dt);
    // who could it go after
    let tgt = null;
    let td = 1e9;
    for (const [id, v] of this.players) {
      if (v.st !== 'alive') continue;
      const pos = id === this.me ? g.player : g.remotes.get(id);
      if (!pos || (id === this.me && g.inside)) continue;
      const hidden = id === this.me ? g.combat.hidden : !!pos.hidden;
      const d = Math.hypot(pos.x - b.x, pos.y - b.y);
      if (hidden && d > 60) continue;
      if (d < td) {
        td = d;
        tgt = { id, x: pos.x, y: pos.y };
      }
    }
    let gx = null;
    let gy = null;
    let speed = 44;
    if (tgt && td < 330) {
      gx = tgt.x;
      gy = tgt.y;
      speed = 56;
    } else {
      // nobody in sight: look round the places the survivors have to go to
      if (!b.goal || Math.hypot(b.goal.x - b.x, b.goal.y - b.y) < 18 || (b.wander -= dt) <= 0) {
        const open = [];
        for (let i = 0; i < this.tot; i++) if (!this.done.has(i)) open.push(this.stationPos(i));
        const pick = open.length && Math.random() < 0.7 ? open[Math.floor(Math.random() * open.length)] : { x: b.x + (Math.random() - 0.5) * 500, y: b.y + (Math.random() - 0.5) * 500 };
        b.goal = pick;
        b.wander = 12;
      }
      gx = b.goal.x;
      gy = b.goal.y;
    }
    if (b.flashT > 0) speed = 14; // (blinded: it stumbles about)
    const dx = gx - b.x;
    const dy = gy - b.y;
    const dist = Math.hypot(dx, dy) || 1;
    const step = Math.min(dist, speed * dt);
    const nx = b.x + (dx / dist) * step;
    const ny = b.y + (dy / dist) * step;
    let moved = 0;
    if (!g.blocked(nx, b.y, true)) {
      moved += Math.abs(nx - b.x);
      b.x = nx;
    }
    if (!g.blocked(b.x, ny, true)) {
      moved += Math.abs(ny - b.y);
      b.y = ny;
    }
    b.moving = moved > 0.01;
    b.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
    if (moved < step * 0.3) {
      b.stuck += dt;
      if (b.stuck > 0.5) {
        b.stuck = 0;
        b.goal = { x: b.x + (Math.random() - 0.5) * 300, y: b.y + (Math.random() - 0.5) * 300 };
        b.wander = 4;
      }
    } else b.stuck = 0;
    // a strike
    if (tgt && td < 26 && b.cd <= 0 && b.flashT <= 0) {
      b.cd = 1.4;
      b.swing = 0.3;
      this.send('kill', { id: tgt.id, x: tgt.x, y: tgt.y });
    }
    if (g.mp) {
      b.sendT -= dt;
      if (b.sendT <= 0) {
        b.sendT = 0.1;
        g.mp.net.send({ t: 'dodfx', k: 'bot', x: b.x, y: b.y, a: ['down', 'up', 'left', 'right'].indexOf(b.dir), i: (b.moving ? 1 : 0) + (b.swing > 0 ? 2 : 0) });
      }
    }
  }

  // ---------- every frame ----------
  speedMul() {
    if (this.task || this.hold || this.stunT > 0 || this.pull) return 0;
    if (this.isKiller) return this.flashT > 0.5 ? 0.7 : 1.1;
    return 1;
  }

  update(dt) {
    const g = this.g;
    this.t += dt;
    this.revealT = Math.max(0, this.revealT - dt);
    if (this.botKiller) {
      if (this.amHost()) this.updateBot(dt);
      else if (this.botNet) {
        const n = this.botNet;
        const b = (this.bot ||= { x: n.x, y: n.y });
        const k = 1 - Math.exp(-dt * 12);
        b.x += (n.x - b.x) * k;
        b.y += (n.y - b.y) * k;
        Object.assign(b, { dir: n.dir, moving: n.moving, swing: n.swing });
      }
    }
    if (!this.got && g.mp && (this.syncT -= dt) <= 0) {
      this.syncT = 2;
      this.send('sync'); // (the host's word has not reached us: ask for it)
    }
    this.itemCd = Math.max(0, this.itemCd - dt);
    this.eyeCd = Math.max(0, this.eyeCd - dt);
    this.hookCd = Math.max(0, this.hookCd - dt);
    this.swingCd = Math.max(0, this.swingCd - dt);
    this.swingT = Math.max(0, this.swingT - dt);
    this.eyeT = Math.max(0, this.eyeT - dt);
    this.flashT = Math.max(0, this.flashT - dt);
    this.stunT = Math.max(0, this.stunT - dt);
    this.smokeT = Math.max(0, this.smokeT - dt);
    this.warnT = Math.max(0, this.warnT - dt);
    if (this.alert && (this.alert.t -= dt) <= 0) this.alert = null;
    this.hooks = this.hooks.filter((h) => (h.t += dt) < 0.45);
    this.clouds = this.clouds.filter((c) => (c.t += dt) < SMOKE_TIME);
    this.pings = this.pings.filter((p) => (p.t += dt) < 6);
    for (const r of g.remotes.values()) if (r.dodSwing > 0) r.dodSwing = Math.max(0, r.dodSwing - dt);
    const p = g.player;
    // the hook drags you to the Werebear
    if (this.pull) {
      this.pull.t += dt;
      const dx = this.pull.x - p.x;
      const dy = this.pull.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > 14 && this.pull.t < 0.6) {
        const step = Math.min(d - 12, 330 * dt);
        const nx = p.x + (dx / d) * step;
        const ny = p.y + (dy / d) * step;
        if (!g.blocked?.(nx, ny)) {
          p.x = nx;
          p.y = ny;
        }
      } else this.pull = null;
    }
    // traps: a survivor who steps on one is stunned, and the trap is spent
    if (!this.isKiller && !this.ghost && !this.out && this.stunT <= 0) {
      for (const tr of this.traps) {
        if (Math.hypot(tr.x - p.x, tr.y - p.y) < 11) {
          this.stunT = 2;
          this.task = null;
          this.hold = null;
          this.traps = this.traps.filter((t) => t !== tr);
          this.fx('trapoff', { i: tr.i });
          sfx.play('hurt', 0.8);
          g.onToast?.('🪤 Caught in a bear trap!');
          break;
        }
      }
    }
    // a task window or a held action ends when you are caught, or walk away
    if (this.task && (this.ghost || this.stunT > 0)) this.task = null;
    if (this.hold) {
      const h = this.hold;
      let ok = this.fDown && !this.ghost && this.stunT <= 0;
      if (ok) {
        if (h.kind === 'revive') {
          const v = this.players.get(h.id);
          ok = v && v.st === 'dead' && Math.hypot(v.bx - p.x, v.by - p.y) < 30;
        } else ok = !this.opened.has(h.id) && Math.hypot(this.cratePos(h.id).x - p.x, this.cratePos(h.id).y - p.y) < 28;
      }
      if (!ok) this.hold = null;
      else {
        h.t += dt;
        if (h.t >= h.need) {
          this.hold = null;
          if (h.kind === 'revive') {
            this.send('revive', { id: h.id });
            sfx.play('levelup', 0.7);
          } else {
            this.opened.add(h.id);
            this.fx('loot', { i: h.id });
            this.gotItem(this.crateItem(h.id));
          }
        }
      }
    }
    // the chopper: climb aboard
    const c = g.chopper;
    if (c) {
      c.t += dt;
      if (this.out) c.lift += dt;
      if (this.ph === 'extract' && !this.isKiller && this.my?.st === 'alive' && !this.out && c.t > 4 && Math.hypot(p.x - c.x, p.y - c.y) < 34 && !g.inside) {
        g.boarded = true;
        g.spectating = true;
        g.combat.invuln = 1e9;
        this.task = null;
        this.send('out');
        sfx.play('levelup');
        g.onAnnounce?.({ title: '🚁 YOU MADE IT', sub: 'Waiting to see how the others do…', tier: 3, mine: true });
      }
    }
    // what F would do right now
    const n = this.nearThing();
    this.prompt = null;
    if (n && !this.task && !this.hold) {
      this.prompt = n.kind === 'station' ? { x: n.x, y: n.y - 26, text: `F · ${TASK_NAMES[this.stationType(n.i)]}` } : n.kind === 'body' ? { x: n.x, y: n.y - 20, text: 'Hold F · bring them back' } : { x: n.x, y: n.y - 22, text: 'Hold F · search the crate' };
    }
    if (this.hold) this.prompt = null;
    // the Werebear caught nobody: his Eye also lights up the map for a moment (nothing to do here: drawing does it)
  }

  // can I see this other player right now?
  canSee(r) {
    if (this.ghost) return true; // the fallen see everything
    const p = this.g.player;
    const d = Math.hypot(r.x - p.x, r.y - p.y);
    if (this.isKiller && this.eyeT > 0 && this.players.has(String(r.id))) return true;
    if (r.hidden && !(this.isKillerId(r.id) ? d < 22 : this.isKiller && d < 22)) return false; // tucked away: only found by someone who comes right up to them
    return this.lit(r.x, r.y);
  }

  // is this point inside my light?
  lit(x, y) {
    const p = this.g.player;
    const d = Math.hypot(x - p.x, y - p.y);
    if (this.ghost) return true;
    if (this.isKiller) return d < 235;
    if (d < 34 + this.light * 6) return true;
    const a = this.faceAngle();
    const diff = Math.abs(Math.atan2(Math.sin(Math.atan2(y - p.y, x - p.x) - a), Math.cos(Math.atan2(y - p.y, x - p.x) - a)));
    return d < this.beamLen() && diff < this.beamHalf() && this.clear(p.x, p.y - 8, x, y - 8);
  }

  // ---------- sight lines ----------
  // is there something solid at this point (cached by 6px cell: it only asks the world once for each)?
  solid(x, y) {
    const cx = Math.floor(x / 6);
    const cy = Math.floor(y / 6);
    const key = (cx + 40000) * 100000 + (cy + 40000);
    let v = this.solidCache.get(key);
    if (v === undefined) {
      if (this.solidCache.size > 60000) this.solidCache.clear();
      v = this.g.world.isBlocked(cx * 6 - 3, cy * 6 - 3, 12, 12, true, true);
      this.solidCache.set(key, v);
    }
    return v;
  }

  // can a ray from (x0, y0) reach (x1, y1)?
  clear(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    for (let k = 10; k < d - 6; k += 5) if (this.solid(x0 + ((x1 - x0) * k) / d, y0 + ((y1 - y0) * k) / d)) return false;
    return true;
  }

  // how far the light reaches along each ray between two angles (each stops at the first solid thing)
  cast(x, y, a0, a1, step, maxLen) {
    const out = [];
    for (let a = a0; a <= a1 + 1e-6; a += step) {
      const c = Math.cos(a);
      const s = Math.sin(a);
      let d = 10;
      while (d < maxLen) {
        if (this.solid(x + c * d, y + s * d)) break;
        d += 5;
      }
      out.push({ a, d: Math.min(maxLen, d) });
    }
    return out;
  }

  beamLen() {
    return 135 + this.light * 42;
  }

  beamHalf() {
    return 0.5 + this.light * 0.05;
  }

  faceAngle() {
    const g = this.g;
    const p = g.player;
    if (g.touchMode) return { right: 0, left: Math.PI, up: -Math.PI / 2, down: Math.PI / 2 }[p.dir] ?? 0;
    const m = g.mouseWorld();
    return Math.atan2(m.y - (p.y - 8), m.x - p.x);
  }

  stateHidden() {
    return this.ghost || this.out;
  }

  // ---------- drawing in the world ----------
  draw(ctx, t) {
    const g = this.g;
    if (!this.got) return;
    // the stations
    if (this.ph === 'tasks') {
      for (let i = 0; i < this.tot; i++) {
        if (this.done.has(i)) continue;
        const s = this.stationPos(i);
        this.drawStation(ctx, s.x, s.y, TASK_ICON[this.stationType(i)], t);
      }
    }
    for (let i = 0; i < this.crateCount(); i++) {
      if (this.opened.has(i)) continue;
      const s = this.cratePos(i);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(Math.round(s.x - 8), Math.round(s.y - 1), 16, 3);
      ctx.fillStyle = '#7b5a35';
      ctx.fillRect(Math.round(s.x - 7), Math.round(s.y - 10), 14, 10);
      ctx.fillStyle = '#a97c47';
      ctx.fillRect(Math.round(s.x - 7), Math.round(s.y - 10), 14, 3);
      ctx.fillStyle = '#e8c96a';
      ctx.fillRect(Math.round(s.x - 1), Math.round(s.y - 7), 2, 3);
    }
    if (this.botKiller && this.bot) this.drawKiller(ctx, this.bot.x, this.bot.y, { moving: this.bot.moving, dir: this.bot.dir, swing: this.bot.swing || 0 });
    // bodies
    for (const [id, v] of this.players) {
      if (v.st !== 'dead') continue;
      this.drawBody(ctx, v, id, t);
    }
    // traps (the Werebear's own are bright; the others are barely there)
    for (const tr of this.traps) {
      const mine = tr.by === this.me;
      ctx.globalAlpha = mine || this.ghost ? 1 : 0.55;
      ctx.fillStyle = '#4a4d5a';
      ctx.beginPath();
      ctx.ellipse(Math.round(tr.x), Math.round(tr.y - 2), 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#c9ccd8';
      ctx.lineWidth = 1;
      for (let k = -2; k <= 2; k++) {
        ctx.beginPath();
        ctx.moveTo(tr.x + k * 3, tr.y - 2);
        ctx.lineTo(tr.x + k * 3 + 1, tr.y - 6);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // smoke
    for (const c of this.clouds) {
      const k = c.t / SMOKE_TIME;
      ctx.fillStyle = `rgba(190,196,210,${0.5 * (1 - k)})`;
      for (let i = 0; i < 7; i++) {
        const a = i * 0.9 + c.t * 0.4;
        ctx.beginPath();
        ctx.arc(c.x + Math.cos(a) * (10 + k * 12), c.y - 8 + Math.sin(a) * (6 + k * 8), 12 + k * 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // the hook's rope
    for (const h of this.hooks) {
      const k = Math.min(1, h.t / 0.2);
      ctx.strokeStyle = '#d9c9a0';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(h.x, h.y);
      ctx.lineTo(h.x + (h.tx - h.x) * k, h.y + (h.ty - h.y) * k);
      ctx.stroke();
      ctx.fillStyle = '#9aa0b0';
      ctx.fillRect(Math.round(h.x + (h.tx - h.x) * k) - 2, Math.round(h.y + (h.ty - h.y) * k) - 2, 4, 4);
    }
    // the Werebear's swing
    if (this.swingT > 0 && this.isKiller) {
      const p = g.player;
      const a = this.aim();
      ctx.strokeStyle = `rgba(255,70,70,${this.swingT / 0.3})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 10, 24, a - 0.9, a + 0.9);
      ctx.stroke();
    }
    // a revive in progress
    if (this.hold?.kind === 'revive') {
      const v = this.players.get(this.hold.id);
      if (v) {
        ctx.strokeStyle = '#7dffa0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(v.bx, v.by - 6, 16, -Math.PI / 2, -Math.PI / 2 + (this.hold.t / this.hold.need) * Math.PI * 2);
        ctx.stroke();
      }
    }
    if (this.hold?.kind === 'crate') {
      const s = this.cratePos(this.hold.id);
      ctx.fillStyle = '#ffe9a0';
      ctx.fillRect(Math.round(s.x - 10), Math.round(s.y - 18), Math.round(20 * (this.hold.t / this.hold.need)), 3);
    }
  }

  drawStation(ctx, x, y, icon, t) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(Math.round(x - 9), Math.round(y - 1), 18, 3);
    ctx.fillStyle = '#3a4150';
    ctx.fillRect(Math.round(x - 8), Math.round(y - 17), 16, 17);
    ctx.fillStyle = '#566074';
    ctx.fillRect(Math.round(x - 8), Math.round(y - 17), 16, 3);
    const on = Math.sin(t * 4 + x) > 0;
    ctx.fillStyle = on ? '#7dffa0' : '#2e8a4a';
    ctx.fillRect(Math.round(x - 5), Math.round(y - 12), 10, 7);
    ctx.fillStyle = '#ffd36b';
    ctx.fillRect(Math.round(x - 1), Math.round(y - 22 - Math.abs(Math.sin(t * 3 + y)) * 2), 2, 4); // a little beacon mark
    ctx.fillRect(Math.round(x - 1), Math.round(y - 16 - Math.abs(Math.sin(t * 3 + y)) * 2), 2, 1);
  }

  drawBody(ctx, v, id, t) {
    const g = this.g;
    const x = v.bx;
    const y = v.by;
    g.drawGrave?.(ctx, x, y);
    const final = v.rv >= this.lives;
    ctx.fillStyle = final ? 'rgba(180,180,190,0.9)' : `rgba(125,255,160,${0.55 + 0.25 * Math.sin(t * 4)})`;
    ctx.beginPath();
    ctx.arc(Math.round(x), Math.round(y - 22 + Math.sin(t * 3) * 1.5), 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // the Werebear himself: the Tiny RPG sprite (100x100 cells), flipped to face the way he goes
  drawKiller(ctx, x, y, o) {
    const g = this.g;
    const info = TINY.chars.werebear;
    const sheet = g.img['tiny/werebear'];
    if (!sheet || !info) return;
    const sc = 1.6;
    let row = 'idle';
    let f = Math.floor(this.t * 6);
    if (o.swing > 0) {
      row = 'atk1';
      f = Math.min(info.atk1[1] - 1, Math.floor((1 - o.swing / 0.3) * info.atk1[1]));
    } else if (o.moving) {
      row = 'walk';
      f = Math.floor(this.t * 10);
    }
    const [r, n] = info[row];
    f = row === 'atk1' ? f : f % n;
    ctx.fillStyle = 'rgba(40,20,20,0.3)';
    ctx.fillRect(Math.round(x - 9), Math.round(y - 1), 18, 3);
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (o.dir === 'left') ctx.scale(-1, 1);
    ctx.shadowColor = 'rgba(255,40,40,0.8)';
    ctx.shadowBlur = 7;
    ctx.drawImage(sheet, f * 100, r * 100, 100, 100, -info.cx * sc, -info.foot * sc, 100 * sc, 100 * sc);
    ctx.restore();
  }

  // ---------- the fog (and everything laid over the screen) ----------
  drawFog(ctx, camX, camY) {
    const g = this.g;
    if (!this.got) return;
    const cv = g.canvas;
    const W = cv.width;
    const H = cv.height;
    const z = g.zoom;
    if (!this.ghost && !g.inside) {
      if (!this.fogCv) this.fogCv = document.createElement('canvas');
      const f = this.fogCv;
      if (f.width !== W || f.height !== H) {
        f.width = W;
        f.height = H;
      }
      const fc = f.getContext('2d');
      fc.globalCompositeOperation = 'source-over';
      fc.clearRect(0, 0, W, H);
      fc.fillStyle = HUMAN_FOG;
      fc.fillRect(0, 0, W, H);
      fc.globalCompositeOperation = 'destination-out';
      const p = g.player;
      const [sx, sy] = g.toScreen(p.x, p.y - 8, camX, camY);
      const wx = p.x;
      const wy = p.y - 8;
      // what you can see is what the light can reach in a straight line: trees, buildings and other solid things cast shadows (like Among Us)
      const hole = (rays, from, to, grad) => {
        fc.save();
        fc.beginPath();
        fc.moveTo(sx, sy);
        for (const r of rays) {
          if (r.a < from || r.a > to) continue;
          fc.lineTo(sx + Math.cos(r.a) * r.d * z, sy + Math.sin(r.a) * r.d * z);
        }
        fc.closePath();
        fc.clip();
        fc.fillStyle = grad;
        fc.fillRect(0, 0, W, H);
        fc.restore();
      };
      const soft = (R, al) => {
        const gr = fc.createRadialGradient(sx, sy, R * 0.1, sx, sy, R);
        gr.addColorStop(0, `rgba(0,0,0,${al})`);
        gr.addColorStop(0.72, `rgba(0,0,0,${al * 0.72})`);
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        return gr;
      };
      if (this.isKiller) {
        // the Werebear sees all round him, a little less far
        hole(this.cast(wx, wy, -Math.PI, Math.PI, 0.04, 235), -Math.PI, Math.PI, soft(235 * z, 1));
      } else {
        const a = this.faceAngle();
        const L = this.beamLen();
        const half = this.beamHalf();
        // the cone of the flashlight, soft at the edges (a wide faint one, a narrow bright one), cut off by whatever stands in the way
        const rays = this.cast(wx, wy, a - half * 1.2, a + half * 1.2, 0.022, L);
        hole(rays, a - half * 1.2, a + half * 1.2, soft(L * z, 0.55));
        hole(rays, a - half * 0.85, a + half * 0.85, soft(L * 0.92 * z, 0.8));
        hole(rays, a - half * 0.5, a + half * 0.5, soft(L * 0.72 * z, 1));
        // the little glow round you (it also stops at walls)
        const R = 36 + this.light * 8;
        hole(this.cast(wx, wy, -Math.PI, Math.PI, 0.13, R), -Math.PI, Math.PI, soft(R * z, 1));
      }
      // the Killer Eye: the survivors stand out of the dark
      if (this.isKiller && this.eyeT > 0) {
        for (const [id, v] of this.players) {
          if (v.st === 'out') continue;
          const r = g.remotes.get(id);
          const x = v.st === 'dead' ? v.bx : r?.x;
          const y = v.st === 'dead' ? v.by : r?.y;
          if (x === undefined) continue;
          const [ex, ey] = g.toScreen(x, y - 8, camX, camY);
          const gr3 = fc.createRadialGradient(ex, ey, 2, ex, ey, 30 * z);
          gr3.addColorStop(0, 'rgba(0,0,0,1)');
          gr3.addColorStop(1, 'rgba(0,0,0,0)');
          fc.fillStyle = gr3;
          fc.beginPath();
          fc.arc(ex, ey, 30 * z, 0, Math.PI * 2);
          fc.fill();
        }
      }
      ctx.drawImage(f, 0, 0);
    }
    // the Eye's marks: a red outline round every survivor, even through walls and bushes
    if (this.isKiller && this.eyeT > 0) {
      for (const [id, v] of this.players) {
        if (v.st === 'out') continue;
        const r = g.remotes.get(id);
        const x = v.st === 'dead' ? v.bx : r?.x;
        const y = v.st === 'dead' ? v.by : r?.y;
        if (x === undefined) continue;
        const [ex, ey] = g.toScreen(x, y - 12, camX, camY);
        ctx.strokeStyle = `rgba(255,50,60,${0.5 + 0.4 * Math.sin(this.t * 10)})`;
        ctx.lineWidth = 3;
        ctx.strokeRect(ex - 7 * z, ey - 12 * z, 14 * z, 26 * z);
        ctx.fillStyle = 'rgba(255,60,70,0.9)';
        ctx.font = `${Math.round(3.4 * z)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(g.remotes.get(id)?.name || '', ex, ey - 14 * z);
        // (and an arrow at the edge when they are off the screen)
        if (ex < 0 || ey < 0 || ex > W || ey > H) {
          const cx = W / 2;
          const cy = H / 2;
          const ang = Math.atan2(ey - cy, ex - cx);
          const m = 22;
          const px = Math.min(W - m, Math.max(m, cx + Math.cos(ang) * W));
          const py = Math.min(H - m, Math.max(m, cy + Math.sin(ang) * H));
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(ang);
          ctx.fillStyle = '#ff3c46';
          ctx.beginPath();
          ctx.moveTo(14, 0);
          ctx.lineTo(-8, -9);
          ctx.lineTo(-8, 9);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }
    }
    // a revive somewhere: a ping for the Werebear
    if (this.isKiller) {
      for (const pg of this.pings) {
        const [ex, ey] = g.toScreen(pg.x, pg.y, camX, camY);
        const k = (pg.t % 1.2) / 1.2;
        ctx.strokeStyle = `rgba(125,255,160,${1 - k})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(ex, ey, (10 + k * 40) * z * 0.6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // the prompt for the thing in reach
    if (this.prompt) {
      const [px, py] = g.toScreen(this.prompt.x, this.prompt.y, camX, camY);
      g.pill(this.prompt.text, px, py, z * 4, '#fff', 'rgba(232,124,150,0.95)');
    }
    // the red edge when the Eye looks for you
    if (this.warnT > 0) {
      const gr = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
      gr.addColorStop(0, 'rgba(255,0,0,0)');
      gr.addColorStop(1, `rgba(255,0,0,${Math.min(0.6, this.warnT * 0.5)})`);
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, W, H);
    }
    // the flashbang: white, then a slow, dizzy fade back
    if (this.flashT > 0) {
      const k = this.flashT / FLASH_TIME;
      const white = k > 0.7 ? 1 : k / 0.7;
      ctx.fillStyle = `rgba(255,255,255,${Math.min(1, white * 1.05)})`;
      ctx.fillRect(0, 0, W, H);
      if (k <= 0.7) {
        const wob = Math.sin(this.t * 3) * 6 * z;
        ctx.globalAlpha = 0.25 * white;
        ctx.drawImage(cv, wob, 0);
        ctx.globalAlpha = 1;
      }
    }
  }

  // ---------- what the React side shows ----------
  hud() {
    const g = this.g;
    const p = g.player;
    const names = (id) => (id === this.me ? g.name || 'You' : id === 'bot' ? 'Computer' : g.remotes.get(id)?.name || 'Friend');
    const list = [...this.players].map(([id, v]) => ({ id, name: names(id), st: v.st, rv: v.rv, me: id === this.me }));
    let compass;
    if (g.chopper) {
      const dx = g.chopper.x - p.x;
      const dy = g.chopper.y - p.y;
      compass = { spin: false, ang: Math.atan2(dx, -dy), dist: Math.round(Math.hypot(dx, dy) / 16) };
    } else compass = { spin: true };
    const myLeft = this.my ? Math.max(0, this.lives - this.my.rv) : 0;
    return {
      got: this.got,
      role: !this.got ? 'wait' : this.isKiller ? 'killer' : this.out ? 'out' : this.ghost ? 'ghost' : 'survivor',
      killer: this.killer ? names(this.killer) : null,
      tot: this.tot,
      done: this.done.size,
      ph: this.ph,
      players: list,
      lives: this.lives,
      myLeft,
      items: { ...this.items },
      light: this.light,
      itemCd: Math.ceil(this.itemCd * 10) / 10,
      hookCd: Math.ceil(this.hookCd),
      eyeCd: Math.ceil(this.eyeCd),
      eyeT: this.eyeT > 0,
      traps: this.traps.filter((t) => t.by === this.me).length,
      maxTraps: MAX_TRAPS,
      compass,
      task: this.task,
      reviving: this.hold?.kind === 'revive' ? this.hold.t / this.hold.need : 0,
      looting: this.hold?.kind === 'crate' ? this.hold.t / this.hold.need : 0,
      stun: this.stunT > 0,
      blind: this.flashT > 0,
      alert: this.alert?.text || null,
      sel: this.sel,
      reveal: this.revealT > 0 ? (this.isKiller ? 'killer' : 'survivor') : null,
      practice: !this.killer,
    };
  }
}
