// Do or Die: a Werebear (one of the players) hunts the others. The survivors share a list of tasks, and when they are all done a chopper
// lands somewhere on the map. Everyone sees the progress; survivors carry a flashlight in the fog, the Werebear has traps, a hook and
// the Killer Eye. A fallen survivor stays where they fell as a body and can be brought back (as many times as the host allows).
//
// The host (SupaNet.hDod) is the referee for what everyone must agree on (tasks done, who fell, who got back up, who made it onto the
// chopper); this file is everything one player's game does: the fog, the abilities, the tasks and the pictures.
import { sfx } from './sfx';
import { TINY } from './tiny';
import { dodHouseNear } from './v2world';
import { DESIGNS } from './interior';

const TYPES = ['wires', 'math', 'colors', 'ricochet', 'switches', 'engine'];
export const TASK_ICON_OF = null;
export const TASK_NAMES = {
  wires: 'Connect the wires',
  math: 'Crack the lock (maths)',
  colors: 'Repeat the colours',
  ricochet: 'Bounce the shot',
  switches: 'Switch everything on',
  engine: 'Start the engine',
};
export const TASK_ICON = { wires: '🔌', math: '🔢', colors: '🎨', ricochet: '🎯', switches: '🔦', engine: '🚗' };
const HUMAN_FOG = 'rgba(4,6,20,0.66)';
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
const NEAR_KILLER = 110; // the Werebear this close shuts a task window
const SWING_CD = 1.1;
const SWING_DUR = 0.5; // the claw animation
const SWING_HIT = 0.22; // ...and the moment in it when the claws land
const WOUND_RUN = 4; // seconds a wounded survivor runs fast
const WOUND_SEE = 6; // seconds the Werebear is lit up for the one he hit
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
    this.guideI = -1; // the task a glittering trail leads to
    this.guideT = 0;
    this.sprung = []; // traps that were stepped on (the Werebear is told where)
    this.rings = []; // green rings where a task was just finished
    this.news = null;
    this.taskDoneT = 0;
    this.doneBy = new Map();
    this.mineDone = new Set();
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
        t[5] = (t[5] ?? 2) - 1;
        if (t[5] <= 0) {
          t[1] = 'dead';
          t[3] = m.x;
          t[4] = m.y;
        }
      }
    } else if (op === 'revive') {
      const t = s.p.find((x) => x[0] === String(m.id));
      if (t && t[1] === 'dead' && t[2] < s.lives) {
        t[1] = 'alive';
        t[5] = 2;
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

  // every third task is inside a house (the nearest one to its spot): you find it when you walk in
  taskHome(i) {
    if (i % 3 !== 1) return null;
    this.homes ||= new Map();
    if (!this.homes.has(i)) {
      const s = this.stationPos(i);
      this.homes.set(i, dodHouseNear(this.g.world, s.x, s.y));
    }
    return this.homes.get(i);
  }

  // a number for a building (the same on every computer), for its room's layout
  roomSeed(b) {
    let h = this.g.world.seed >>> 0;
    for (const ch of String(b.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return h;
  }

  indoorKey(i) {
    const b = this.g.inside?.b;
    return b ? 100 + (this.roomSeed(b) % 900000) * 10 + i : -1;
  }

  chestsHere() {
    return DESIGNS[this.g.inside?.design]?.chests || [];
  }

  indoorOpened(i) {
    return this.opened.has(this.indoorKey(i));
  }

  // a chest in a room: what it holds depends on how good it is
  openIndoor(i) {
    const g = this.g;
    const D = DESIGNS[g.inside?.design];
    const c = D?.chests?.[i];
    if (!c || this.isKiller || this.ghost) {
      if (this.isKiller) g.onToast?.('Only the survivors can use the chests.');
      return;
    }
    const key = this.indoorKey(i);
    if (this.opened.has(key)) {
      g.onToast?.('The chest is empty.');
      return;
    }
    this.opened.add(key);
    this.fx('loot', { i: key });
    sfx.play('chest');
    const any = () => (Math.random() < 0.5 ? 'flash' : 'smoke');
    const give = { common: [any()], rare: [any(), any()], epic: ['light', any()], legendary: ['light', 'flash', 'smoke'] }[c.rar] || [any()];
    give.forEach((k, n) => setTimeout(() => this.gotItem(k), n * 350));
    g.onToast?.(`📦 A ${c.rar} chest!`);
  }

  // where to point to for a task: the station, or the door of the house it is in
  taskTarget(i) {
    const h = this.taskHome(i);
    return h ? { x: h.x, y: h.y + 14 } : this.stationPos(i);
  }

  // the tasks in the house you are standing in, with their place in the room
  insideTasks() {
    const g = this.g;
    const b = g.inside?.b;
    if (!b) return [];
    const out = [];
    let k = 0;
    for (let i = 0; i < this.tot; i++) {
      if (this.done.has(i) || this.taskHome(i)?.id !== b.id) continue;
      out.push({ i, x: g.cam.x + 95 - k * 34, y: g.cam.y + 55 });
      k++;
    }
    return out;
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
    if (!this.gotItems && Array.isArray(m.si)) {
      this.gotItems = true;
      this.items.flash = Math.min(3, m.si[0] || 0);
      this.items.smoke = Math.min(3, m.si[1] || 0);
      this.light = Math.min(3, m.si[2] || 0);
    }
    const doneBefore = new Set(this.done);
    const hpWas = this.my?.hp;
    this.players = new Map((m.p || []).map(([id, st, rv, bx, by, hp]) => [String(id), { st, rv, bx, by, hp: hp ?? 2 }]));
    if (hpWas !== undefined && this.my && this.my.st === 'alive' && this.my.hp < hpWas) this.wounded();
    const prevPh = this.ph;
    this.ph = m.ph || 'tasks';
    this.ch = Number.isFinite(m.ch) ? m.ch : -1;
    this.got = true;
    // tasks that were just finished: a green ring where it was, and a line of news (for the ones somebody else did)
    if (!first) {
      for (const i of this.done) {
        if (doneBefore.has(i)) continue;
        const pos = this.taskTarget(i);
        this.rings.push({ x: pos.x, y: pos.y, t: 0 });
        if (this.mineDone?.has(i)) continue;
        setTimeout(() => {
          this.news = { text: `✅ ${this.doneBy?.get(i) || 'A survivor'} finished a task (${this.done.size}/${this.tot})`, t: 4 };
          sfx.play('pickup', 0.6);
          g.emitHud();
        }, 350);
      }
    }
    // somebody else got there first: leave the window
    if (this.task && this.done.has(this.task.i)) {
      this.task = null;
      g.onToast?.('Someone else just finished that task.');
    }
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
      if (g.inside && !first) g.exitHouse(true); // (everybody starts outside)
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

  // the Werebear hit me, and I am still up: I run, and I can see where he is
  wounded() {
    const g = this.g;
    this.speedT = WOUND_RUN;
    this.seeKillerT = WOUND_SEE;
    this.warnT = 1.2;
    this.task = null;
    this.hold = null;
    sfx.play('hurt', 0.9);
    g.onToast?.('🩸 The Werebear hit you! Run: you are faster for a moment, and you can see him.');
    this.alert = { text: 'One more hit and you are down!', t: 5 };
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

  // the round is over: the end scene takes the screen
  finish(m) {
    const g = this.g;
    this.end = { who: m.who, outN: m.outN, total: m.total };
    g.frozen = true;
    sfx.play(m.who === 'survivors' ? 'win' : 'wave');
    g.emitHud();
  }

  onNet(m) {
    const g = this.g;
    if (m.t === 'dod') return this.applyState(m);
    if (m.t !== 'dodfx') return;
    const from = String(m.from ?? '');
    if (m.k === 'bot') {
      if (!this.amHost()) this.botNet = { x: m.x, y: m.y, dir: ['down', 'up', 'left', 'right'][m.a] || 'down', moving: !!(m.i & 1), swing: m.i & 2 ? SWING_DUR : 0 };
      return;
    }
    if (m.k === 'flash') {
      this.puff(m.x, m.y, '#ffffff');
      this.flashBot(m.x, m.y);
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
      if (r) {
        r.dodSwing = SWING_DUR;
        r.dodSwingDir = Math.cos(m.a) < 0 ? 'left' : 'right';
      }
    } else if (m.k === 'sprung') {
      const r = g.remotes.get(from);
      if (r) r.dodStun = 2;
      if (this.isKiller) {
        this.sprung.push({ x: m.x, y: m.y, t: 0 });
        this.alert = { text: '🪤 A survivor stepped on your trap!', t: 5 };
        sfx.play('wave', 0.7);
      }
    } else if (m.k === 'done') {
      this.doneBy.set(m.i, g.remotes.get(from)?.name || 'A survivor');
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

  // a glittering trail to a task (click it in the list)
  guide(i) {
    if (this.done.has(i)) return;
    this.guideI = this.guideI === i && this.guideT > 0 ? -1 : i;
    this.guideT = this.guideI < 0 ? 0 : 14;
    this.g.emitHud();
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
    // the better the chest (its skin), the better what is in it
    const rank = (o.skin ?? 0) & 3;
    const any = () => (Math.random() < 0.5 ? 'flash' : 'smoke');
    const give = [[this.chestItem(o)], [any(), any()], ['light', any()], ['light', 'flash', 'smoke']][rank] || [this.chestItem(o)];
    give.forEach((k, n) => setTimeout(() => this.gotItem(k), n * 350));
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
    if (!this.got) return;
    if (this.ph === 'tasks') {
      for (const t of this.insideTasks()) {
        this.drawStation(ctx, t.x, t.y, TASK_ICON[this.stationType(t.i)], this.t);
        if (!this.isKiller && Math.hypot(t.x - this.g.player.x, t.y - this.g.player.y) < 28 && !this.task) {
          ctx.fillStyle = 'rgba(232,124,150,0.95)';
          ctx.fillRect(t.x - 42, t.y - 40, 84, 11);
          ctx.fillStyle = '#fff';
          ctx.font = '7px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`F · ${TASK_NAMES[this.stationType(t.i)]}`, t.x, t.y - 32);
        }
      }
    }
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
    this.swingT = SWING_DUR;
    const aim = this.aim();
    this.swingDir = Math.cos(aim) < 0 ? 'left' : 'right'; // (the Werebear turns to where the mouse is)
    this.fx('swing', { a: aim });
    sfx.play('swing', 0.7);
    this.strike = { t: SWING_HIT, aim }; // (the claws land in the middle of the animation: that is when it is decided whether they hit)
  }

  // the moment the claws land
  doStrike(aim) {
    const g = this.g;
    const p = g.player;
    if (g.inside) {
      // inside a house: the ones found in it are right there
      for (const f of this.found()) {
        if (Math.hypot(f.x - p.x, f.y - p.y) < 44) {
          this.send('kill', { id: f.id, x: f.r.x, y: f.r.y });
          g.onToast?.('🐻 Hit!');
        }
      }
      return;
    }
    for (const [id, v] of this.players) {
      if (v.st !== 'alive') continue;
      const r = g.remotes.get(id);
      if (!r) continue;
      const dx = r.x - p.x;
      const dy = r.y - p.y;
      const dd = Math.hypot(dx, dy);
      // only what is in front of the claws (within a half circle towards the mouse), or right on top of him
      if (dd <= KILL_R && (dd < 12 || dx * Math.cos(aim) + dy * Math.sin(aim) > 0)) {
        this.send('kill', { id, x: r.x, y: r.y });
        sfx.play('hit', 0.8);
        g.onToast?.('🐻 Hit!');
      }
    }
  }

  // ---------- things near me ----------
  nearThing() {
    const g = this.g;
    const p = g.player;
    if (this.stunT > 0 || this.pull || this.ghost || this.out) return null;
    if (g.inside) {
      if (this.isKiller || this.ph !== 'tasks') return null;
      for (const t of this.insideTasks()) if (Math.hypot(t.x - p.x, t.y - p.y) < 28) return { kind: 'station', i: t.i, x: t.x, y: t.y };
      return null;
    }
    if (!this.isKiller) {
      for (const [id, v] of this.players) {
        if (v.st === 'dead' && id !== this.me && v.rv < this.lives && Math.hypot(v.bx - p.x, v.by - p.y) < 26) return { kind: 'body', id, x: v.bx, y: v.by };
      }
      if (this.ph === 'tasks') {
        for (let i = 0; i < this.tot; i++) {
          if (this.done.has(i) || this.taskHome(i)) continue;
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
      this.mineDone.add(t.i);
      this.send('task', { i: t.i });
      this.fx('done', { i: t.i }); // (the others are told who did it)
      sfx.play('levelup', 0.8);
      this.taskDoneT = 2.4;
      const p = this.g.player;
      this.g.pfx?.spawn('pickups/collect-burst', p.x, p.y - 8, { scale: 1.2 });
      this.g.pfx?.spawn('holy/sunburst', p.x, p.y + 2, { scale: 0.5, seed: 3 });
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
    this.flashBot(p.x, p.y); // (the message does not come back to me, and I am the one who runs the computer Werebear)
    this.puff(p.x, p.y);
    sfx.play('boom', 0.4);
    this.g.onToast?.('💥 Flashbang!');
    this.g.emitHud();
  }

  // a flashbang went off here: the computer Werebear (run by the host's game) is blinded if it is close
  flashBot(x, y) {
    if (!this.botKiller || !this.bot || !this.amHost() || this.bot.flashT > 0.2) return;
    if (Math.hypot(x - this.bot.x, y - this.bot.y) >= FLASH_R) return;
    this.bot.flashT = FLASH_TIME;
    this.bot.hitT = 0; // (a swing in the middle of its wind-up is lost)
    this.g.pfx?.spawn('status/stunned', this.bot.x, this.bot.y - 20, { scale: 0.6, seed: 2 });
    this.g.onToast?.('💥 The Werebear is blinded!');
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

  // which way the Werebear (me) faces: the mouse's side while striking or standing, the way he walks otherwise
  facing() {
    const g = this.g;
    if (this.swingT > 0 && this.swingDir) return this.swingDir;
    if (!g.touchMode && !g.player.moving) return Math.cos(this.aim()) < 0 ? 'left' : 'right';
    return g.player.dir === 'left' ? 'left' : g.player.dir === 'right' ? 'right' : this.swingDir || 'right';
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

  // ---------- computer survivors (a computer seat plays a survivor when the player is the Werebear) ----------
  killerPos() {
    const g = this.g;
    if (this.killer === 'bot') return this.bot;
    if (this.isKiller) return g.player;
    return g.remotes.get(this.killer) || null;
  }

  updateAiSurvivors(dt) {
    const g = this.g;
    this.aiS ||= {};
    this.aiSendT = (this.aiSendT || 0) - dt;
    const list = [];
    for (const [id, v] of this.players) {
      const r = g.remotes.get(id);
      if (!r || !r.ai) continue;
      r.sim = true; // (this game moves it: nothing glides it about)
      const a = (this.aiS[id] ||= { work: 0, i: -1, stuck: 0 });
      if (v.st === 'alive') this.stepAi(a, r, id, dt);
      else {
        r.moving = false;
        if (v.st === 'dead') {
          r.x = v.bx || r.x;
          r.y = v.by || r.y;
        }
      }
      r.hidden = v.st !== 'alive';
      list.push({ id, x: r.x, y: r.y, dir: r.dir || 'down', moving: !!r.moving, hidden: r.hidden, hp: 6 });
    }
    if (list.length && this.aiSendT <= 0) {
      this.aiSendT = 0.1;
      g.mp.net.send({ t: 'aistate', list });
    }
  }

  stepAi(a, r, id, dt) {
    const g = this.g;
    const kp = this.killerPos();
    const dk = kp ? Math.hypot(kp.x - r.x, kp.y - r.y) : 1e9;
    let gx = r.x;
    let gy = r.y;
    let speed = 46;
    let working = false;
    if (dk < 150) {
      // the Werebear is close: run the other way
      gx = r.x + (r.x - kp.x);
      gy = r.y + (r.y - kp.y);
      speed = 76;
      a.work = 0;
    } else if (this.ph === 'extract' && g.chopper) {
      gx = g.chopper.x;
      gy = g.chopper.y;
      speed = 60;
      if (Math.hypot(gx - r.x, gy - r.y) < 30 && g.chopper.t > 4) {
        this.send('aiout', { id });
        return;
      }
    } else if (this.ph === 'tasks') {
      if (a.i < 0 || this.done.has(a.i)) {
        // the nearest task that is not done
        let best = -1;
        let bd = 1e9;
        for (let i = 0; i < this.tot; i++) {
          if (this.done.has(i)) continue;
          const s = this.stationPos(i);
          const d = Math.hypot(s.x - r.x, s.y - r.y);
          if (d < bd) {
            bd = d;
            best = i;
          }
        }
        a.i = best;
        a.work = 0;
      }
      if (a.i >= 0) {
        const s = this.stationPos(a.i);
        if (Math.hypot(s.x - r.x, s.y - r.y) < 16) {
          working = true;
          a.work += dt;
          if (a.work >= 7) {
            this.send('aitask', { id, i: a.i });
            a.i = -1;
            a.work = 0;
          }
        } else {
          gx = s.x;
          gy = s.y;
        }
      }
    }
    if (working) {
      r.moving = false;
      return;
    }
    const dx = gx - r.x;
    const dy = gy - r.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 2) {
      r.moving = false;
      return;
    }
    const step = Math.min(dist, speed * dt);
    const nx = r.x + (dx / dist) * step;
    const ny = r.y + (dy / dist) * step;
    let moved = 0;
    if (!g.blocked(nx, r.y, true)) {
      moved += Math.abs(nx - r.x);
      r.x = nx;
    }
    if (!g.blocked(r.x, ny, true)) {
      moved += Math.abs(ny - r.y);
      r.y = ny;
    }
    r.tx = r.x;
    r.ty = r.y;
    r.moving = moved > 0.01;
    r.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
    if (moved < step * 0.3) {
      a.stuck += dt;
      if (a.stuck > 0.4) {
        a.stuck = 0;
        r.x += (Math.random() - 0.5) * 24; // (nudge past whatever is in the way)
        r.y += (Math.random() - 0.5) * 24;
      }
    } else a.stuck = 0;
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
      b.cd = 1.5;
      b.swing = SWING_DUR;
      b.hitT = SWING_HIT;
      b.hitId = tgt.id;
    }
    if (b.hitT > 0 && (b.hitT -= dt) <= 0) {
      const hid = b.hitId;
      const pos = hid === this.me ? g.player : g.remotes.get(hid);
      if (pos && Math.hypot(pos.x - b.x, pos.y - b.y) < 34 && this.players.get(hid)?.st === 'alive') this.send('kill', { id: hid, x: pos.x, y: pos.y });
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
    return this.speedT > 0 ? 1.65 : 1; // (a wounded survivor is much faster than the Werebear)
  }

  update(dt) {
    const g = this.g;
    this.t += dt;
    this.revealT = Math.max(0, this.revealT - dt);
    if (g.mp && this.amHost()) this.updateAiSurvivors(dt);
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
    this.taskDoneT = Math.max(0, this.taskDoneT - dt);
    this.guideT = Math.max(0, this.guideT - dt);
    this.sprung = this.sprung.filter((s) => (s.t += dt) < 8);
    for (const r of g.remotes.values()) if (r.dodStun > 0) r.dodStun = Math.max(0, r.dodStun - dt);
    this.rings = this.rings.filter((r) => (r.t += dt) < 1.6);
    if (this.news && (this.news.t -= dt) <= 0) this.news = null;
    this.speedT = Math.max(0, (this.speedT || 0) - dt);
    this.seeKillerT = Math.max(0, (this.seeKillerT || 0) - dt);
    if (this.strike) {
      if (this.ghost || this.stunT > 0) this.strike = null;
      else if ((this.strike.t -= dt) <= 0) {
        const a = this.strike.aim;
        this.strike = null;
        this.doStrike(a);
      }
    }
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
          this.fx('sprung');
          sfx.play('hurt', 0.8);
          g.onToast?.('🪤 Caught in a bear trap!');
          break;
        }
      }
    }
    // the Werebear comes close: the window shuts at once
    if ((this.task || this.hold) && !this.isKiller && this.killer) {
      const kp = this.killerPos();
      if (kp && Math.hypot(kp.x - p.x, kp.y - p.y) < NEAR_KILLER && !g.inside) {
        this.task = null;
        this.hold = null;
        this.nearT = 3;
        sfx.play('wave', 0.7);
        g.emitHud();
      }
    }
    this.nearT = Math.max(0, (this.nearT || 0) - dt);
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
    if (this.seeKillerT > 0 && this.isKillerId(r.id)) return true; // (he hit me: I can see him)
    if (r.ai && !this.players.has(String(r.id))) return false; // (a computer seat that is not playing is only a stand-in: the computer Werebear is drawn by the game itself)
    if (this.ghost) return true; // the fallen see everything
    const p = this.g.player;
    const d = Math.hypot(r.x - p.x, r.y - p.y);
    if (this.isKiller && this.eyeT > 0 && this.players.has(String(r.id))) return true;
    if (r.hidden && !(this.isKillerId(r.id) ? d < 22 : this.isKiller && d < 22)) return false; // tucked away: only found by someone who comes right up to them
    return this.lit(r.x, r.y);
  }

  // the radius of my glow: a small one for a survivor (each flashlight upgrade widens it), a bigger one for the Werebear
  glowR() {
    return this.isKiller ? 150 : 112 + 10 * this.light; // a survivor starts with 3/4 of the Werebear's glow, and each upgrade widens it
  }

  // is this point inside my glow? (what moves out there cannot be seen)
  lit(x, y) {
    if (this.ghost) return true;
    const p = this.g.player;
    return Math.hypot(x - p.x, y - p.y) < this.glowR();
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
        if (this.done.has(i) || this.taskHome(i)) continue;
        const s = this.stationPos(i);
        this.drawStation(ctx, s.x, s.y, TASK_ICON[this.stationType(i)], t);
      }
    }
    for (let i = 0; i < this.crateCount(); i++) {
      if (this.opened.has(i)) continue;
      const s = this.cratePos(i);
      if (!this.lit(s.x, s.y) && !(this.isKiller && this.eyeT > 0)) continue; // (loot is only seen up close, inside the glow)
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(Math.round(s.x - 8), Math.round(s.y - 1), 16, 3);
      ctx.fillStyle = '#7b5a35';
      ctx.fillRect(Math.round(s.x - 7), Math.round(s.y - 10), 14, 10);
      ctx.fillStyle = '#a97c47';
      ctx.fillRect(Math.round(s.x - 7), Math.round(s.y - 10), 14, 3);
      ctx.fillStyle = '#e8c96a';
      ctx.fillRect(Math.round(s.x - 1), Math.round(s.y - 7), 2, 3);
    }
    if (this.botKiller && this.bot && (this.lit(this.bot.x, this.bot.y) || this.seeKillerT > 0 || (this.isKiller && this.eyeT > 0))) this.drawKiller(ctx, this.bot.x, this.bot.y, { moving: this.bot.moving, dir: this.bot.dir, swing: this.bot.swing || 0 });
    for (const r of this.rings) {
      const k = r.t / 1.6;
      ctx.strokeStyle = `rgba(125,255,160,${1 - k})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y - 4, 10 + k * 46, (10 + k * 46) * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // bodies
    for (const [id, v] of this.players) {
      if (v.st !== 'dead' || !(this.lit(v.bx, v.by) || (this.isKiller && this.eyeT > 0))) continue;
      this.drawBody(ctx, v, id, t);
    }
    // traps (the Werebear's own are bright; the others are barely there)
    for (const tr of this.traps) {
      const mine = tr.by === this.me;
      if (!mine && !this.ghost && !this.lit(tr.x, tr.y)) continue;
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
      f = Math.min(info.atk1[1] - 1, Math.floor((1 - o.swing / SWING_DUR) * info.atk1[1]));
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
    // the map is always there (dimly), but what moves is only seen inside your glow; the Killer Eye lifts the veil for a moment
    if (!this.ghost && !g.inside && !(this.isKiller && this.eyeT > 0)) {
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
      const R = this.glowR() * z;
      const gr = fc.createRadialGradient(sx, sy, R * 0.3, sx, sy, R);
      gr.addColorStop(0, 'rgba(0,0,0,1)');
      gr.addColorStop(0.6, 'rgba(0,0,0,0.92)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      fc.fillStyle = gr;
      fc.beginPath();
      fc.arc(sx, sy, R, 0, Math.PI * 2);
      fc.fill();
      ctx.drawImage(f, 0, 0);
      // a warm edge to the glow
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const warm = ctx.createRadialGradient(sx, sy, R * 0.15, sx, sy, R * 0.85);
      warm.addColorStop(0, 'rgba(255,214,140,0.14)');
      warm.addColorStop(1, 'rgba(255,214,140,0)');
      ctx.fillStyle = warm;
      ctx.beginPath();
      ctx.arc(sx, sy, R * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // the Eye's marks: a red blinking outline round every survivor (or the house they hide in), even through walls and bushes;
    // far off the screen it is an arrow instead
    if (this.isKiller && this.eyeT > 0 && !g.inside) {
      const blink = 0.45 + 0.45 * Math.sin(this.t * 10);
      for (const [id, v] of this.players) {
        if (v.st === 'out') continue;
        const r = g.remotes.get(id);
        const x = v.st === 'dead' ? v.bx : r?.x;
        const y = v.st === 'dead' ? v.by : r?.y;
        if (x === undefined) continue;
        const house = v.st === 'alive' && r?.hidden ? dodHouseNear(g.world, x, y - 14, 12) : null;
        let cx;
        let cy;
        if (house) {
          const [x0, y0] = g.toScreen(house.x - house.w / 2, house.y - house.h, camX, camY);
          const [x1, y1] = g.toScreen(house.x + house.w / 2, house.y, camX, camY);
          cx = (x0 + x1) / 2;
          cy = (y0 + y1) / 2;
          if (x1 > 0 && x0 < W && y1 > 0 && y0 < H) {
            ctx.strokeStyle = `rgba(255,50,60,${blink + 0.1})`;
            ctx.lineWidth = 5;
            ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
          }
        } else {
          const [ex, ey] = g.toScreen(x, y - 12, camX, camY);
          cx = ex;
          cy = ey;
          if (ex > 0 && ey > 0 && ex < W && ey < H) {
            ctx.strokeStyle = `rgba(255,50,60,${blink + 0.1})`;
            ctx.lineWidth = 3;
            ctx.strokeRect(ex - 7 * z, ey - 12 * z, 14 * z, 26 * z);
            ctx.fillStyle = 'rgba(255,60,70,0.9)';
            ctx.font = `${Math.round(3.4 * z)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(r?.name || '', ex, ey - 14 * z);
          }
        }
        if (cx < 0 || cy < 0 || cx > W || cy > H) this.edgeArrow(ctx, cx, cy, W, H, '#ff3c46', house ? '🏠' : '');
      }
    }
    // the one he hit sees him lit up in red (an arrow when he is off the screen)
    if (this.seeKillerT > 0 && !this.isKiller && !this.ghost && !g.inside) {
      const kp = this.killerPos();
      if (kp) {
        const blink = 0.45 + 0.45 * Math.sin(this.t * 12);
        const [kx, ky] = g.toScreen(kp.x, kp.y - 12, camX, camY);
        if (kx > 0 && ky > 0 && kx < W && ky < H) {
          ctx.strokeStyle = `rgba(255,50,60,${blink + 0.1})`;
          ctx.lineWidth = 4;
          ctx.strokeRect(kx - 10 * z, ky - 14 * z, 20 * z, 30 * z);
        } else this.edgeArrow(ctx, kx, ky, W, H, '#ff3c46', '🐻');
      }
    }
    // the trail: faded glitter along the way to the task you picked, and a wisp that runs ahead of you
    if (this.guideI >= 0 && this.guideT > 0 && !this.isKiller && !g.inside && !this.done.has(this.guideI)) {
      const t = this.taskTarget(this.guideI);
      const p = g.player;
      const dx = t.x - p.x;
      const dy = t.y - (p.y - 8);
      const dist = Math.hypot(dx, dy);
      if (dist < 24) this.guideT = 0;
      else {
        const ux = dx / dist;
        const uy = dy / dist;
        const L = Math.min(dist, 300);
        const fade = Math.min(1, this.guideT / 2);
        const spark = (wx, wy, a, r, col) => {
          const [sx, sy] = g.toScreen(wx, wy, camX, camY);
          ctx.globalAlpha = a * fade;
          ctx.fillStyle = col;
          ctx.fillRect(sx - r, sy - 1, r * 2, 2);
          ctx.fillRect(sx - 1, sy - r, 2, r * 2);
          ctx.fillRect(sx - 1, sy - 1, 2, 2);
        };
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        // a faint ribbon under the glitter
        const [r0x, r0y] = g.toScreen(p.x, p.y - 8, camX, camY);
        const [r1x, r1y] = g.toScreen(p.x + ux * L, p.y - 8 + uy * L, camX, camY);
        const rib = ctx.createLinearGradient(r0x, r0y, r1x, r1y);
        rib.addColorStop(0, `rgba(255,233,160,${0.35 * fade})`);
        rib.addColorStop(1, 'rgba(255,233,160,0)');
        ctx.strokeStyle = rib;
        ctx.lineWidth = 5 * z * 0.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(r0x, r0y);
        ctx.lineTo(r1x, r1y);
        ctx.stroke();
        for (let k = 1; k <= 26; k++) {
          const u = k / 26;
          const w = Math.sin(this.t * 3 + k * 0.9) * 5 * (1 - u * 0.4);
          const wx = p.x + ux * L * u - uy * w;
          const wy = p.y - 8 + uy * L * u + ux * w;
          const tw = 0.5 + 0.5 * Math.sin(this.t * 7 + k * 1.7);
          spark(wx, wy, (1 - u * 0.7) * (0.55 + 0.45 * tw), 2 + ((k + Math.floor(this.t * 3)) % 3), k % 2 ? '#ffe9a0' : '#9ff0ff');
        }
        // the wisp itself
        const run = (this.t * 0.5) % 1;
        const wx = p.x + ux * L * run;
        const wy = p.y - 8 + uy * L * run + Math.sin(this.t * 9) * 2;
        const [wsx, wsy] = g.toScreen(wx, wy, camX, camY);
        const gr = ctx.createRadialGradient(wsx, wsy, 1, wsx, wsy, 14 * z);
        gr.addColorStop(0, `rgba(255,245,200,${0.9 * fade * (1 - run * 0.5)})`);
        gr.addColorStop(1, 'rgba(255,200,120,0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(wsx, wsy, 14 * z, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    }
    // the Werebear: where his traps were stepped on
    if (this.isKiller) {
      for (const sp of this.sprung) {
        const [ex, ey] = g.toScreen(sp.x, sp.y - 6, camX, camY);
        const k = (sp.t % 1) / 1;
        if (ex > 0 && ey > 0 && ex < W && ey < H) {
          ctx.strokeStyle = `rgba(255,60,70,${1 - k})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(ex, ey, (8 + k * 36) * z * 0.6, 0, Math.PI * 2);
          ctx.stroke();
        } else this.edgeArrow(ctx, ex, ey, W, H, '#ff3c46', '🪤');
      }
    }
    // survivors: an arrow to every task that is not done (to the door of the house when it is inside one)
    if (!this.isKiller && !this.ghost && !this.out && !g.inside && this.ph === 'tasks') {
      for (let i = 0; i < this.tot; i++) {
        if (this.done.has(i)) continue;
        const t = this.taskTarget(i);
        const [tx, ty] = g.toScreen(t.x, t.y - 20, camX, camY);
        const icon = this.taskHome(i) ? '🏠' : TASK_ICON[this.stationType(i)];
        if (tx > 30 && ty > 30 && tx < W - 30 && ty < H - 30) {
          // on the screen: a small bobbing mark over the spot
          const bob = Math.sin(this.t * 4 + i) * 3;
          ctx.fillStyle = 'rgba(255,211,107,0.95)';
          ctx.beginPath();
          ctx.moveTo(tx, ty + 12 + bob);
          ctx.lineTo(tx - 7, ty + bob);
          ctx.lineTo(tx + 7, ty + bob);
          ctx.closePath();
          ctx.fill();
          ctx.font = '14px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(icon, tx, ty - 4 + bob);
        } else this.edgeArrow(ctx, tx, ty, W, H, '#ffd36b', icon);
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

  // an arrow on the edge of the screen pointing at something that is off it
  edgeArrow(ctx, tx, ty, W, H, color, icon) {
    const cx = W / 2;
    const cy = H / 2;
    const ang = Math.atan2(ty - cy, tx - cx);
    const m = 58; // (clear of the buttons down the right side)
    const px = Math.min(W - m, Math.max(m, cx + Math.cos(ang) * W));
    const py = Math.min(H - m, Math.max(m, cy + Math.sin(ang) * H));
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(ang);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(-9, -10);
    ctx.lineTo(-9, 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    if (icon) {
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(icon, px - Math.cos(ang) * 22, py - Math.sin(ang) * 22 + 5);
    }
  }

  // ---------- what the React side shows ----------
  hud() {
    const g = this.g;
    const p = g.player;
    const names = (id) => (id === this.me ? g.name || 'You' : id === 'bot' ? 'Computer' : g.remotes.get(id)?.name || 'Friend');
    const list = [...this.players].map(([id, v]) => ({ id, name: names(id), st: v.st, rv: v.rv, hp: v.hp ?? 2, me: id === this.me }));
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
      taskDone: this.taskDoneT > 0,
      nearKiller: this.nearT > 0,
      tasks: Array.from({ length: this.tot }, (_, i) => ({ i, name: TASK_NAMES[this.stationType(i)], icon: TASK_ICON[this.stationType(i)], done: this.done.has(i), indoor: !!this.taskHome(i), guiding: this.guideI === i && this.guideT > 0 })),
      news: this.news?.text || null,
      sel: this.sel,
      inside: !!g.inside,
      end: this.end
        ? {
            mode: this.end.who,
            role: this.isKiller ? 'killer' : 'survivor',
            heroes: [...this.players.keys()].map((id) => (id === this.me ? g.hero?.id : g.remotes.get(id)?.hero?.id)).filter(Boolean),
          }
        : null,
      reveal: this.revealT > 0 ? (this.isKiller ? 'killer' : 'survivor') : null,
      practice: !this.killer,
    };
  }
}
