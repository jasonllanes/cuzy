// Maze Rush: the rules. A pure simulation (no drawing, no browser), so it runs the same for one player, two players on one keyboard,
// and online (the host runs it and sends snapshots; the others only draw what they are sent, see `remote`).
//
// Everybody moves along the maze one tile at a time, Pac-Man style: a mover is on a tile (tx,ty) heading for the next one (nx,ny), `p` of the
// way there. A player keeps going the way they were going and takes the turn they asked for at the next crossing.

import { hashString } from '../game/rng';
import { FRUITS } from './themes';

export const T = 16;
export const DIRS = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
export const DIR_NAMES = ['up', 'right', 'down', 'left'];
const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
const LETTER = { u: 'up', d: 'down', l: 'left', r: 'right' };

export const PLAYER_SPEED = 5; // tiles a second
export const BOOST_SPEED = 7.6;
export const BOOST_TIME = 7;
export const FREEZE_TIME = 5;
const KILL_TIME = 2.3; // the length of the caught animation
const INTRO_TIME = 2.4;
const CLEAR_TIME = 1.9;

// a small seeded random number generator, so a run's seed and level number always make the same maze
export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- the enemies: simple at first, then more of them, new kinds, and quicker ----
export const FOES = {
  slime: { ai: 'wander', mult: 0.82, from: 1, name: 'Slime' },
  skeleton: { ai: 'chase', mult: 0.98, from: 3, name: 'Skeleton' },
  orc: { ai: 'ambush', mult: 0.95, from: 5, name: 'Orc' },
  bat: { ai: 'flit', mult: 1.2, from: 7, name: 'Bat' },
  werewolf: { ai: 'hunt', mult: 1.06, from: 10, name: 'Werewolf' },
  elite_orc: { ai: 'hunt', mult: 1.12, from: 15, name: 'Elite Orc' },
  werebear: { ai: 'hunt', mult: 1.2, from: 20, name: 'Werebear' },
};
const FOE_ORDER = Object.keys(FOES);

export const foeCount = (level) => Math.min(8, 1 + Math.floor(level / 2));
export const foeBaseSpeed = (level) => Math.min(3.9, 2.5 + 0.1 * level);
export const newFoes = (level) => FOE_ORDER.filter((k) => FOES[k].from === level);

// ---- building a level ----
const shuffle = (list, rand) => {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
};

export function bfsField(grid, W, H, sx, sy) {
  const dist = new Int16Array(W * H).fill(-1);
  const queue = [sx + sy * W];
  dist[sx + sy * W] = 0;
  for (let qi = 0; qi < queue.length; qi++) {
    const i = queue[qi];
    const x = i % W;
    const y = (i / W) | 0;
    for (const k of DIR_NAMES) {
      const nx = x + DIRS[k][0];
      const ny = y + DIRS[k][1];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = nx + ny * W;
      if (grid[j] || dist[j] >= 0) continue;
      dist[j] = dist[i] + 1;
      queue.push(j);
    }
  }
  return dist;
}

// what a level asks for: strawberries first, then more kinds and bigger piles as the levels go up
export function goalsFor(level, rand) {
  const kinds = Math.min(FRUITS.length, 1 + Math.floor(level / 2));
  const goals = [];
  for (let i = 0; i < kinds; i++) {
    const base = i === 0 ? 3 : 2;
    goals.push({ kind: FRUITS[i], need: Math.min(7, base + Math.floor(level / 4) + Math.floor(rand() * 2)) });
  }
  return goals;
}

export function buildLevel(level, runSeed) {
  const rand = mulberry(hashString(`${runSeed}|${level}`));
  const cw = Math.min(16, 6 + Math.ceil(level / 2));
  const ch = Math.min(9, 4 + Math.ceil(level / 3));
  const W = cw * 2 + 1;
  const H = ch * 2 + 1;
  const grid = new Uint8Array(W * H).fill(1);
  const open = (x, y) => {
    grid[y * W + x] = 0;
  };
  // a perfect maze first (every tile reachable one way)...
  const seen = new Uint8Array(cw * ch);
  const stack = [[0, 0]];
  seen[0] = 1;
  open(1, 1);
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const next = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx >= 0 && ny >= 0 && nx < cw && ny < ch && !seen[ny * cw + nx]) next.push([nx, ny, dx, dy]);
    }
    if (!next.length) {
      stack.pop();
      continue;
    }
    const [nx, ny, dx, dy] = next[Math.floor(rand() * next.length)];
    seen[ny * cw + nx] = 1;
    open(cx * 2 + 1 + dx, cy * 2 + 1 + dy);
    open(nx * 2 + 1, ny * 2 + 1);
    stack.push([nx, ny]);
  }
  // ...then loops, so there is always another way round (that is what makes it a chase and not a dead-end trap)
  const sides = (cx, cy) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => grid[(cy * 2 + 1 + dy) * W + cx * 2 + 1 + dx] === 0);
  for (let cy = 0; cy < ch; cy++) {
    for (let cx = 0; cx < cw; cx++) {
      if (sides(cx, cy).length !== 1 || rand() > 0.6) continue;
      const closed = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => {
        const nx = cx + dx;
        const ny = cy + dy;
        return nx >= 0 && ny >= 0 && nx < cw && ny < ch && grid[(cy * 2 + 1 + dy) * W + cx * 2 + 1 + dx] === 1;
      });
      if (closed.length) {
        const [dx, dy] = closed[Math.floor(rand() * closed.length)];
        open(cx * 2 + 1 + dx, cy * 2 + 1 + dy);
      }
    }
  }
  for (let n = Math.floor(cw * ch * 0.07); n > 0; n--) {
    const cx = Math.floor(rand() * cw);
    const cy = Math.floor(rand() * ch);
    const [dx, dy] = [[1, 0], [0, 1]][Math.floor(rand() * 2)];
    if (cx + dx < cw && cy + dy < ch) open(cx * 2 + 1 + dx, cy * 2 + 1 + dy);
  }

  const dist = bfsField(grid, W, H, 1, 1);
  const floor = [];
  let maxD = 0;
  for (let i = 0; i < W * H; i++) {
    if (dist[i] >= 0) {
      floor.push(i);
      maxD = Math.max(maxD, dist[i]);
    }
  }
  const tile = (i) => ({ x: i % W, y: (i / W) | 0 });
  const taken = new Set();
  const far = (a, b) => Math.abs((a % W) - (b % W)) + Math.abs(((a / W) | 0) - ((b / W) | 0));
  const pick = (pool, spacing, mine = []) => {
    const list = shuffle(pool.filter((i) => !taken.has(i)), rand);
    for (let gap = spacing; gap >= 0; gap--) {
      const found = list.find((i) => mine.every((j) => far(i, j) >= gap));
      if (found !== undefined) {
        taken.add(found);
        mine.push(found);
        return found;
      }
    }
    return -1;
  };

  // the players start in the top left corner, in a row along the first corridor
  const byDist = [...floor].sort((a, b) => dist[a] - dist[b]);
  const spawn = byDist.slice(0, 4).map(tile);
  for (const i of byDist.slice(0, 4)) taken.add(i);
  // the portal is as far away as the maze gets (and goes at the end of a corridor if it can)
  const ends = floor.filter((i) => dist[i] >= maxD - 2);
  const portalI = ends[Math.floor(rand() * ends.length)];
  taken.add(portalI);
  const portal = tile(portalI);

  const goals = goalsFor(level, rand);
  const items = [];
  const placed = [];
  const itemPool = floor.filter((i) => dist[i] >= 4);
  for (const g of goals) {
    for (let n = 0; n < g.need; n++) {
      const i = pick(itemPool, 3, placed);
      if (i >= 0) items.push({ id: items.length, kind: g.kind, ...tile(i), got: false });
    }
  }
  // (a goal the maze had no room for is shortened to what is there)
  for (const g of goals) g.need = items.filter((it) => it.kind === g.kind).length;

  const foeCnt = foeCount(level);
  const pool = FOE_ORDER.filter((k) => FOES[k].from <= level);
  const foeSpawns = [];
  const foePlaced = [];
  const foeTiles = floor.filter((i) => dist[i] >= Math.max(8, maxD * 0.5));
  for (let n = 0; n < foeCnt; n++) {
    const i = pick(foeTiles.length ? foeTiles : floor, 5, foePlaced);
    if (i < 0) break;
    foeSpawns.push({ ...tile(i), type: pool[pool.length - 1 - (n % pool.length)] });
  }
  // each enemy retreats to its own corner when it is told to scatter
  const corners = [{ x: W - 2, y: 1 }, { x: W - 2, y: H - 2 }, { x: 1, y: H - 2 }, { x: Math.floor(W / 2), y: Math.floor(H / 2) }];

  const powers = [];
  const powerPool = floor.filter((i) => dist[i] >= 5 && dist[i] <= maxD * 0.85);
  for (const type of ['boost', 'freeze']) {
    const i = pick(powerPool, 4);
    if (i >= 0) powers.push({ id: powers.length, type, ...tile(i) });
  }

  return { level, W, H, grid, dist, maxD, spawn, portal, goals, items, foeSpawns, corners, powers };
}

// ---- the simulation ----
const blank = () => ({ tx: 0, ty: 0, nx: 0, ny: 0, p: 0, moving: false });
const r2 = (n) => Math.round(n * 100) / 100;
const r3 = (n) => Math.round(n * 1000) / 1000;

export const posOf = (m) => ({ x: m.tx + (m.nx - m.tx) * m.p, y: m.ty + (m.ny - m.ty) * m.p });

export class MazeSim {
  // players: [{ id, name, hero }]. `remote` is a copy that only draws what the host sends it.
  constructor({ runSeed, players, remote = false }) {
    this.runSeed = runSeed;
    this.remote = remote;
    this.level = 0;
    this.score = 0;
    this.phase = 'intro';
    this.phaseT = 0;
    this.playT = 0;
    this.t = 0;
    this.events = [];
    this.kill = null;
    this.deaths = [];
    this.floaters = [];
    this.nextPower = 0;
    this.scatter = false;
    this.rand = mulberry(hashString(`${runSeed}|sim`));
    this.players = players.map((p, i) => ({ id: p.id, name: p.name, hero: p.hero, slot: i, ...blank(), alive: true, want: null, run: false, dir: 'down', boostT: 0, inv: 0, got: 0 }));
    this.startLevel(1);
  }

  emit(e) {
    this.events.push(e);
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  // ---- levels ----
  loadLevel(n) {
    this.level = n;
    this.lvl = buildLevel(n, this.runSeed);
    this.items = this.lvl.items.map((i) => ({ ...i }));
    this.itemAt = new Map(this.items.map((i) => [i.x + i.y * this.lvl.W, i]));
    this.goals = this.lvl.goals.map((g) => ({ ...g, have: 0 }));
    this.powers = this.lvl.powers.map((p) => ({ ...p }));
    this.powerId = this.powers.length;
    this.portalOpen = false;
    this.freezeT = 0;
    this.kill = null;
    this.deaths = [];
    this.floaters = [];
  }

  startLevel(n) {
    this.loadLevel(n);
    const { lvl } = this;
    this.players.forEach((pl, i) => {
      const s = lvl.spawn[i % lvl.spawn.length];
      Object.assign(pl, { tx: s.x, ty: s.y, nx: s.x, ny: s.y, p: 0, moving: false, alive: true, want: null, run: false, dir: 'down', boostT: 0, inv: 2 });
    });
    const base = foeBaseSpeed(n);
    this.enemies = lvl.foeSpawns.map((s, i) => {
      const e = { id: i, type: s.type, ...blank(), tx: s.x, ty: s.y, nx: s.x, ny: s.y, dir: DIR_NAMES[Math.floor(this.rand() * 4)], speed: base * FOES[s.type].mult, home: lvl.corners[i % lvl.corners.length] };
      return e;
    });
    this.phase = 'intro';
    this.phaseT = 0;
    this.playT = 0;
    this.nextPower = 15;
    this.emit({ k: 'level', n });
  }

  free(x, y) {
    const { W, H, grid } = this.lvl;
    return x >= 0 && y >= 0 && x < W && y < H && grid[x + y * W] === 0;
  }

  alivePlayers() {
    return this.players.filter((p) => p.alive);
  }

  // a player asks for a way to go. Turning back is at once; any other turn waits for the next crossing
  setWant(i, dir) {
    const pl = this.players[i];
    if (!pl || !pl.alive || !DIRS[dir]) return;
    pl.want = dir;
    pl.run = true; // (nobody starts running until they press a key)
    if (pl.moving && OPP[pl.dir] === dir) {
      [pl.tx, pl.nx] = [pl.nx, pl.tx];
      [pl.ty, pl.ny] = [pl.ny, pl.ty];
      pl.p = 1 - pl.p;
      pl.dir = dir;
    }
  }

  // ---- moving along the tiles ----
  stepMover(m, dist, choose) {
    let left = dist;
    for (let guard = 0; left > 1e-6 && guard < 6; guard++) {
      if (!m.moving) {
        const d = choose(m);
        if (!d) {
          m.p = 0;
          return;
        }
        m.nx = m.tx + DIRS[d][0];
        m.ny = m.ty + DIRS[d][1];
        m.p = 0;
        m.moving = true;
        m.dir = d;
      }
      const need = 1 - m.p;
      if (left < need) {
        m.p += left;
        return;
      }
      left -= need;
      m.tx = m.nx;
      m.ty = m.ny;
      m.p = 0;
      m.moving = false;
    }
  }

  choosePlayer(pl) {
    if (!pl.run) return null;
    if (pl.want && this.free(pl.tx + DIRS[pl.want][0], pl.ty + DIRS[pl.want][1])) return pl.want;
    if (this.free(pl.tx + DIRS[pl.dir][0], pl.ty + DIRS[pl.dir][1])) return pl.dir;
    return null;
  }

  // the player an enemy is after: the nearest one still standing
  prey(e) {
    const ep = posOf(e);
    let best = null;
    let bd = Infinity;
    for (const pl of this.players) {
      if (!pl.alive) continue;
      const pp = posOf(pl);
      const d = Math.hypot(pp.x - ep.x, pp.y - ep.y);
      if (d < bd) {
        bd = d;
        best = pl;
      }
    }
    return best;
  }

  chooseFoe(e) {
    const opts = DIR_NAMES.filter((d) => this.free(e.tx + DIRS[d][0], e.ty + DIRS[d][1]));
    if (!opts.length) return null;
    const forward = opts.filter((d) => d !== OPP[e.dir]);
    const list = forward.length ? forward : opts;
    if (list.length === 1) return list[0];
    const ai = FOES[e.type].ai;
    const prey = this.prey(e);
    const scatter = this.scatter && ai !== 'wander' && ai !== 'flit';
    const by = (tx, ty) => list.reduce((best, d) => {
      const dd = Math.hypot(e.tx + DIRS[d][0] - tx, e.ty + DIRS[d][1] - ty);
      return !best || dd < best.dd ? { d, dd } : best;
    }, null).d;
    if (scatter || !prey) return ai === 'wander' || !prey ? this.wander(e, list) : by(e.home.x, e.home.y);
    const pp = posOf(prey);
    if (ai === 'wander') return this.wander(e, list);
    if (ai === 'flit') return this.rand() < 0.35 ? by(pp.x, pp.y) : this.wander(e, list);
    if (ai === 'chase') return by(pp.x, pp.y);
    if (ai === 'ambush') {
      const [dx, dy] = DIRS[prey.dir];
      return by(Math.min(this.lvl.W - 2, Math.max(1, pp.x + dx * 4)), Math.min(this.lvl.H - 2, Math.max(1, pp.y + dy * 4)));
    }
    // the hunters follow the real way through the maze
    const field = bfsField(this.lvl.grid, this.lvl.W, this.lvl.H, Math.round(pp.x), Math.round(pp.y));
    return list.reduce((best, d) => {
      const v = field[e.tx + DIRS[d][0] + (e.ty + DIRS[d][1]) * this.lvl.W];
      return v >= 0 && (best === null || v < best.v) ? { d, v } : best;
    }, null)?.d || list[0];
  }

  wander(e, list) {
    if (list.includes(e.dir) && this.rand() < 0.55) return e.dir;
    return list[Math.floor(this.rand() * list.length)];
  }

  // ---- the clock ----
  update(dt) {
    this.t += dt;
    this.phaseT += dt;
    for (const f of this.floaters) f.t += dt;
    this.floaters = this.floaters.filter((f) => f.t < 1.1);
    if (this.remote) return this.extrapolate(dt);
    if (this.phase === 'intro') {
      if (this.phaseT >= INTRO_TIME) {
        this.phase = 'play';
        this.phaseT = 0;
        this.emit({ k: 'go' });
      }
    } else if (this.phase === 'play') {
      this.play(dt);
    } else if (this.phase === 'kill') {
      this.kill.t += dt;
      if (this.kill.t >= KILL_TIME) {
        if (this.alivePlayers().length) {
          this.phase = 'play';
          this.phaseT = 0;
          this.kill = null;
          for (const pl of this.players) if (pl.alive) pl.inv = Math.max(pl.inv, 1);
        } else {
          this.phase = 'over';
          this.phaseT = 0;
          this.emit({ k: 'over' });
        }
      }
    } else if (this.phase === 'clear') {
      if (this.phaseT >= CLEAR_TIME) this.startLevel(this.level + 1);
    }
    return undefined;
  }

  play(dt) {
    this.playT += dt;
    this.freezeT = Math.max(0, this.freezeT - dt);
    // the enemies take turns chasing and scattering to their corners (a breather for the player, longer at the start)
    const cycle = this.playT % 26;
    this.scatter = this.playT < 5 || cycle < Math.max(1.5, 6 - this.level * 0.25);
    for (const pl of this.players) {
      if (!pl.alive) continue;
      pl.inv = Math.max(0, pl.inv - dt);
      pl.boostT = Math.max(0, pl.boostT - dt);
      this.stepMover(pl, (pl.boostT > 0 ? BOOST_SPEED : PLAYER_SPEED) * dt, (m) => this.choosePlayer(m));
      this.pickUp(pl);
    }
    if (this.freezeT <= 0) for (const e of this.enemies) this.stepMover(e, e.speed * dt, (m) => this.chooseFoe(m));
    // enemies that touch a player catch them
    if (this.freezeT <= 0) {
      for (const e of this.enemies) {
        const ep = posOf(e);
        for (const pl of this.players) {
          if (!pl.alive || pl.inv > 0) continue;
          const pp = posOf(pl);
          if (Math.hypot(pp.x - ep.x, pp.y - ep.y) < 0.62) {
            this.catchPlayer(pl, e);
            return;
          }
        }
      }
    }
    this.nextPower -= dt;
    if (this.nextPower <= 0) this.spawnPower();
    if (this.portalOpen) {
      for (const pl of this.players) {
        if (!pl.alive) continue;
        const pp = posOf(pl);
        if (Math.hypot(pp.x - this.lvl.portal.x, pp.y - this.lvl.portal.y) < 0.5) {
          const bonus = 500 + Math.max(0, Math.round(90 - this.playT)) * 5;
          this.score += bonus;
          this.phase = 'clear';
          this.phaseT = 0;
          this.enteredBy = pl.slot;
          this.emit({ k: 'clear', pi: pl.slot, bonus });
          this.floaters.push({ x: this.lvl.portal.x, y: this.lvl.portal.y, text: `+${bonus}`, t: 0 });
          return;
        }
      }
    }
  }

  pickUp(pl) {
    const pp = posOf(pl);
    const x = Math.round(pp.x);
    const y = Math.round(pp.y);
    if (Math.hypot(pp.x - x, pp.y - y) > 0.55) return;
    const it = this.itemAt.get(x + y * this.lvl.W);
    if (it && !it.got) {
      it.got = true;
      const g = this.goals.find((q) => q.kind === it.kind);
      if (g) g.have++;
      this.score += 100;
      pl.got++;
      this.emit({ k: 'fruit', pi: pl.slot, kind: it.kind, x, y });
      this.floaters.push({ x, y, text: '+100', t: 0 });
      if (!this.portalOpen && this.goals.every((q) => q.have >= q.need)) {
        this.portalOpen = true;
        this.emit({ k: 'portal' });
      }
    }
    const pw = this.powers.find((q) => q.x === x && q.y === y);
    if (pw) {
      this.powers = this.powers.filter((q) => q !== pw);
      if (pw.type === 'freeze') this.freezeT = FREEZE_TIME;
      else pl.boostT = BOOST_TIME;
      this.emit({ k: 'power', pi: pl.slot, type: pw.type, x, y });
    }
  }

  spawnPower() {
    this.nextPower = 12 + this.rand() * 6;
    if (this.powers.length >= 3) return;
    const { W, H, grid } = this.lvl;
    const near = this.alivePlayers().map(posOf);
    for (let tries = 0; tries < 40; tries++) {
      const x = 1 + Math.floor(this.rand() * (W - 2));
      const y = 1 + Math.floor(this.rand() * (H - 2));
      if (grid[x + y * W] || this.itemAt.get(x + y * W) || this.powers.some((q) => q.x === x && q.y === y)) continue;
      if (near.some((q) => Math.abs(q.x - x) + Math.abs(q.y - y) < 6)) continue;
      this.powers.push({ id: this.powerId++, type: this.rand() < 0.5 ? 'freeze' : 'boost', x, y });
      this.emit({ k: 'spawn' });
      return;
    }
  }

  catchPlayer(pl, e) {
    pl.alive = false;
    pl.want = null;
    const pp = posOf(pl);
    this.kill = { pi: pl.slot, ei: e.id, t: 0, seed: Math.floor(this.rand() * 1e9) };
    this.deaths.push({ pi: pl.slot, x: pp.x, y: pp.y, seed: this.kill.seed });
    this.phase = 'kill';
    this.phaseT = 0;
    this.emit({ k: 'kill', pi: pl.slot, ei: e.id });
  }

  // a copy that only draws: the movers keep going along their tile until the next snapshot corrects them
  extrapolate(dt) {
    if (this.phase === 'kill' && this.kill) this.kill.t += dt;
    if (this.phase === 'play') {
      this.playT += dt;
      this.freezeT = Math.max(0, this.freezeT - dt);
      for (const pl of this.players) pl.boostT = Math.max(0, pl.boostT - dt);
      for (const pl of this.players) if (pl.alive && pl.moving) pl.p = Math.min(1, pl.p + (pl.boostT > 0 ? BOOST_SPEED : PLAYER_SPEED) * dt);
      if (this.freezeT <= 0) for (const e of this.enemies) if (e.moving) e.p = Math.min(1, e.p + e.speed * dt);
    }
  }

  // ---- online: what the host sends ----
  snapshot() {
    return {
      ph: this.phase,
      pt: r2(this.phaseT),
      lv: this.level,
      rs: this.runSeed,
      sc: this.score,
      ft: r2(this.freezeT),
      po: this.portalOpen ? 1 : 0,
      tp: r2(this.playT),
      got: this.items.map((i) => (i.got ? 1 : 0)).join(''),
      gl: this.goals.map((g) => g.have),
      pw: this.powers.map((q) => [q.id, q.type, q.x, q.y]),
      ps: this.players.map((p) => [p.tx, p.ty, p.nx, p.ny, r3(p.p), p.moving ? 1 : 0, p.dir[0], p.alive ? 1 : 0, r2(p.boostT), r2(p.inv), p.got]),
      es: this.enemies.map((e) => [e.id, e.type, e.tx, e.ty, e.nx, e.ny, r3(e.p), e.moving ? 1 : 0, e.dir[0], r2(e.speed)]),
      k: this.kill ? [this.kill.pi, this.kill.ei, r2(this.kill.t), this.kill.seed] : 0,
      dt: this.deaths.map((d) => [d.pi, r2(d.x), r2(d.y), d.seed]),
      ev: this.drainEvents(),
    };
  }

  applySnapshot(s) {
    if (s.lv !== this.level) {
      this.loadLevel(s.lv);
      this.enemies = [];
    }
    this.phase = s.ph;
    this.phaseT = s.pt;
    this.score = s.sc;
    this.freezeT = s.ft;
    this.portalOpen = !!s.po;
    this.playT = s.tp;
    this.scatter = false;
    this.items.forEach((it, i) => {
      it.got = s.got[i] === '1';
    });
    this.goals.forEach((g, i) => {
      g.have = s.gl[i] ?? g.have;
    });
    this.powers = s.pw.map(([id, type, x, y]) => ({ id, type, x, y }));
    s.ps.forEach((a, i) => {
      const pl = this.players[i];
      if (!pl) return;
      const same = pl.tx === a[0] && pl.ty === a[1] && pl.nx === a[2] && pl.ny === a[3];
      const p = same && Math.abs(pl.p - a[4]) < 0.35 ? pl.p + (a[4] - pl.p) * 0.5 : a[4];
      Object.assign(pl, { tx: a[0], ty: a[1], nx: a[2], ny: a[3], p, moving: !!a[5], dir: LETTER[a[6]] || 'down', alive: !!a[7], boostT: a[8], inv: a[9], got: a[10] });
    });
    const old = new Map(this.enemies.map((e) => [e.id, e]));
    this.enemies = s.es.map((a) => {
      const e = old.get(a[0]) || { id: a[0], type: a[1], ...blank() };
      const same = e.tx === a[2] && e.ty === a[3] && e.nx === a[4] && e.ny === a[5];
      const p = same && Math.abs(e.p - a[6]) < 0.35 ? e.p + (a[6] - e.p) * 0.5 : a[6];
      Object.assign(e, { type: a[1], tx: a[2], ty: a[3], nx: a[4], ny: a[5], p, moving: !!a[7], dir: LETTER[a[8]] || 'left', speed: a[9] });
      return e;
    });
    this.kill = s.k ? { pi: s.k[0], ei: s.k[1], t: s.k[2], seed: s.k[3] } : null;
    this.deaths = s.dt.map(([pi, x, y, seed]) => ({ pi, x, y, seed }));
    for (const e of s.ev) {
      if (e.k === 'fruit' || e.k === 'clear') this.floaters.push({ x: e.x ?? this.lvl.portal.x, y: e.y ?? this.lvl.portal.y, text: e.k === 'clear' ? `+${e.bonus}` : '+100', t: 0 });
      this.events.push(e);
    }
  }
}
