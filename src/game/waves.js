import { T } from './world';
import { DIFFICULTY, MONSTERS, MONSTER_IDS, TOTAL_WAVES, lvDmg, lvHp, lvSpeed, rollMonsterLevel, rollMonsterLoot, waveCounts, waveList } from './monsters';
import { ALLIES, ALLY_KINDS, teamCap } from './allies';
import { MAX_LEVEL } from './upgrades';
import { apocSize } from './apoc';

const PREP_FIRST = 20; // seconds to get ready before wave 1
const PREP_BETWEEN = 14;
const PREP_BETWEEN_APOC = 10; // Survival gives you less time to rebuild
const ENRAGE_AFTER = 95; // seconds into a Survival wave before the stragglers get restless
const MAX_ALIVE = 45;
export const POWER_SLOW_TIME = 8; // seconds the Slow-mo power-up lasts
export const BARRICADE_COST = 4; // a Barricade Box from the shop
export const REPAIR_COST = 2; // per destroyed barricade planted back
export const BOSS_WIND = 1.15; // seconds the red mark shows before a boss skill lands
const BOSS_DASH_SPEED = 250;
const BOSS_DASH_TIME = 0.4;
const POWER_SLOW = 0.35; // monsters move and strike at this fraction of their normal pace while it lasts
const SNAPSHOT_EVERY = 0.125; // Wave Defense and Survival snapshots per second to the room: a few less keeps busy rooms under Supabase's message limit
const HOUSE_SOFTNESS = 0.35; // the house shrugs off hits better than a single barricade does
export const BARRICADE_RECT = (b) => ({ x: b.x - 8, y: b.y - 14, w: 16, h: 16 });

const distToRect = (x, y, r) => Math.hypot(Math.max(r.x - x, 0, x - (r.x + r.w)), Math.max(r.y - y, 0, y - (r.y + r.h)));
const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// Where the house, its barricade ring and the middle of the base are, for a base site (in tiles)
function layout(base, theme) {
  const left = base.x * T;
  const floor = base.y * T;
  if (theme === 'apoc') {
    // Survival: a camper RV (its size comes from the image) with a tighter ring around it
    const { w: bw, h: bh } = apocSize('bus');
    const body = Math.round(bh * 0.55); // the part of it that stands on the ground; the rest is the roof
    return {
      left,
      floor,
      house: { x: left + 2, y: floor - body - 2, w: bw - 4, h: body },
      sprite: { x: left, y: floor - bh, w: bw, h: bh },
      center: { x: left + Math.round(bw / 2), y: floor - Math.round(body / 2) },
      bar: { x: left, y: floor - bh - 9, w: bw },
      ring: { x0: left - 34, x1: left + bw + 33, y0: floor - bh - 39, y1: floor + 40, gate: [left + 8, left + bw - 7] },
      pads: [
        { kind: 'thrower', x: left - 18, y: floor + 20 },
        { kind: 'guard', x: left - 2, y: floor + 20 },
        { kind: 'sniper', x: left + bw + 9, y: floor + 20 },
      ],
    };
  }
  return {
    left,
    floor,
    house: { x: left + 2, y: floor - 62, w: 68, h: 60 },
    sprite: { x: left, y: floor - 86, w: 72, h: 86 },
    center: { x: left + 36, y: floor - 24 },
    bar: { x: left + 6, y: floor - 96, w: 60 },
    ring: { x0: left - 18, x1: left + 94, y0: floor - 104, y1: floor + 40, gate: [left + 22, left + 70] },
    pads: [
      { kind: 'thrower', x: left + 2, y: floor + 20 },
      { kind: 'guard', x: left + 18, y: floor + 20 },
      { kind: 'sniper', x: left + 80, y: floor + 20 },
    ],
  };
}

// ------------------------------------------------------------------------------------------
// The real thing. Runs on whoever hosts (or on the only player in solo) and decides everything:
// where monsters walk, what they hit, when waves start. Other players just mirror it.
// ------------------------------------------------------------------------------------------
export class WaveSim {
  constructor(game, difficultyId) {
    this.g = game;
    this.world = game.world;
    this.diff = DIFFICULTY[difficultyId] || DIFFICULTY.medium;
    this.theme = game.world.apoc ? 'apoc' : 'cozy';
    Object.assign(this, layout(this.world.waveBase(), this.theme));
    this.monsters = [];
    this.barricades = [];
    this.wrecks = []; // where a barricade stood until it was destroyed (not the ones you picked up yourself)
    this.shots = [];
    this.allies = [];
    this.kills = {}; // monsters defeated per player (id), 'ally' for your helpers
    this.ashots = [];
    this.baseLevel = 0;
    this.nextId = 1;
    this.wave = 0;
    this.phase = 'prep'; // prep | fight | victory | defeat
    this.timer = PREP_FIRST;
    this.queue = [];
    this.spawnT = 0;
    this.spawnGap = 1;
    this.fightT = 0; // how long this wave has been going
    this.surged = false;
    this.enraged = false;
    this.baseMax = this.diff.baseHp;
    this.baseHp = this.baseMax;
    this.snapT = 0;
    this.buildRing();
    this.syncRects();
  }

  // A wall of tree barricades round the house, with a gate at the front where the path comes in
  buildRing() {
    const { x0, x1, y0, y1, gate: [g0, g1] } = this.ring;
    const gate = (x) => x > g0 && x < g1;
    // Survival's ring is made of sturdier reinforced planks, laid flat on top and bottom, upright on the sides
    const hp = this.theme === 'apoc' ? Math.round(this.diff.barricadeHp * 1.4) : this.diff.barricadeHp;
    const post = (x, y, v) => this.barricades.push({ id: this.nextId++, x, y, hp, max: hp, v, r: this.theme === 'apoc' });
    for (let x = x0; x <= x1; x += 16) {
      post(x, y0, false);
      if (!gate(x)) post(x, y1, false);
    }
    for (let y = y0 + 16; y < y1; y += 16) {
      post(x0, y, true);
      post(x1, y, true);
    }
  }

  syncRects() {
    this.world.extraRects = this.barricades.map(BARRICADE_RECT);
  }

  emit(ev) {
    this.g.onWaveEvent(ev);
    this.g.mp?.net.send({ t: 'w', k: 'ev', d: ev });
  }

  hudState() {
    const alive = this.monsters.filter((m) => m.state !== 'dead').length + this.queue.length;
    const boss = this.monsters.find((m) => MONSTERS[m.type].boss && m.state !== 'dead');
    return {
      wave: this.wave,
      total: TOTAL_WAVES,
      phase: this.phase,
      timer: Math.max(0, this.timer),
      left: alive,
      baseHp: Math.max(0, this.baseHp),
      baseMax: this.baseMax,
      baseLevel: this.baseLevel,
      wrecks: this.wrecks.length,
      kills: { ...this.kills },
      allies: this.allies.length,
      teamCap: teamCap(this.baseLevel),
      boss: boss ? { hp: boss.hp, max: boss.max, name: MONSTERS[boss.type].name } : null,
      ...this.forecast(this.queue.length, this.waveTotal || 0, this.queueCounts()),
    };
  }

  // what is still waiting to spawn, as [[type, count], ...]
  queueCounts() {
    const counts = new Map();
    for (const t of this.queue) counts.set(t, (counts.get(t) || 0) + 1);
    return [...counts];
  }

  // the wave panel's extras: what the next wave brings while preparing, what has yet to spawn while fighting
  forecast(queued, waveTotal, queuedBy) {
    const nextWave = this.wave + 1;
    return {
      coming: this.phase === 'prep' && nextWave <= TOTAL_WAVES ? waveCounts(nextWave, this.diff, this.theme) : null,
      queued,
      waveTotal,
      queuedBy: this.phase === 'fight' ? queuedBy : null,
    };
  }

  // ---------- main loop ----------

  // the host changed the difficulty: it applies to everything that happens from now on, and the base keeps the same share of its health
  setDifficulty(id) {
    const d = DIFFICULTY[id];
    if (!d || d === this.diff) return;
    const share = this.baseMax > 0 ? this.baseHp / this.baseMax : 1;
    this.diff = d;
    this.baseMax = Math.round(d.baseHp * (1 + 0.3 * this.baseLevel));
    this.baseHp = Math.max(1, Math.round(share * this.baseMax));
  }

  // Power-ups, from anyone in the room. Slow-mo drags every monster down for a while; the Big Blast wipes out
  // the ordinary ones outright and only dents a boss.
  power(kind, by = null) {
    if (this.phase === 'victory' || this.phase === 'defeat') return false;
    if (kind === 'slowmo') {
      this.slowT = POWER_SLOW_TIME;
      return true;
    }
    if (kind === 'blast') {
      for (const m of this.monsters) {
        if (m.state === 'dead') continue;
        this.hitMonster(m.id, MONSTERS[m.type].boss ? m.max * 0.2 : 9999, m.x, m.y + 10, 160, true, by);
      }
      return true;
    }
    return false;
  }

  update(dt) {
    if (this.slowT > 0) this.slowT -= dt;
    if (this.phase !== 'victory' && this.phase !== 'defeat') {
      this.updateFlow(dt);
      this.updateShots(dt);
      this.updateAllies(dt);
      this.updateAshots(dt);
      for (const m of this.monsters) this.updateMonster(m, dt);
      this.monsters = this.monsters.filter((m) => m.state !== 'dead' || m.t < 0.5);
      if (this.baseHp <= 0) {
        this.phase = 'defeat';
        this.emit({ type: 'lose' });
      }
    }
    this.snapT -= dt;
    if (this.snapT <= 0) {
      this.snapT = SNAPSHOT_EVERY;
      this.g.mp?.net.send({ t: 'w', k: 'snap', d: this.snapshot() });
    }
  }

  updateFlow(dt) {
    if (this.phase === 'prep') {
      this.timer -= dt;
      if (this.timer <= 0) this.startWave();
      return;
    }
    // fight: trickle monsters in, then wait for the last one to fall
    this.fightT += dt;
    if (this.theme === 'apoc') this.survivalPressure();
    this.spawnT -= dt;
    if (this.queue.length && this.spawnT <= 0 && this.monsters.filter((m) => m.state !== 'dead').length < MAX_ALIVE) {
      if (this.spawnMonster(this.queue[this.queue.length - 1])) this.queue.pop();
      this.spawnT = this.spawnGap;
    }
    if (!this.queue.length && this.monsters.every((m) => m.state === 'dead')) this.finishWave();
  }

  startWave() {
    this.wave++;
    this.queue = waveList(this.wave, this.diff, this.theme);
    this.waveTotal = this.queue.length;
    this.spawnGap = this.theme === 'apoc'
      ? Math.min(1.6, Math.max(0.22, (12 + this.wave * 1.5) / this.queue.length)) // Survival: they pour in faster
      : Math.min(2, Math.max(0.3, (16 + this.wave * 2) / this.queue.length));
    this.spawnT = 0;
    this.fightT = 0;
    this.surged = false;
    this.enraged = false;
    // somewhere around the 10th kill of the wave, a power-up may drop (not every wave)
    this.killN = 0;
    this.powerAt = Math.random() < 0.75 ? Math.min(7 + Math.floor(Math.random() * 6), Math.max(3, Math.floor(this.waveTotal * 0.6))) : 0;
    this.phase = 'fight';
    const bosses = this.queue.filter((t) => MONSTERS[t].boss).length;
    this.emit({ type: 'start', wave: this.wave, boss: this.wave === TOTAL_WAVES, bosses });
  }

  finishWave() {
    if (this.wave >= TOTAL_WAVES) {
      this.phase = 'victory';
      this.emit({ type: 'win' });
      return;
    }
    this.phase = 'prep';
    this.timer = this.theme === 'apoc' ? PREP_BETWEEN_APOC : PREP_BETWEEN;
    // the builders patch things up between waves
    for (const b of this.barricades) b.hp = Math.min(b.max, b.hp + b.max * 0.35);
    this.baseHp = Math.min(this.baseMax, this.baseHp + this.baseMax * 0.1);
    this.emit({ type: 'cleared', wave: this.wave });
  }

  // Survival only: halfway through a wave a pack of runners comes in from one side, and a wave that drags on
  // sends the survivors into a frenzy.
  survivalPressure() {
    if (!this.surged && this.wave >= 3 && this.queue.length <= this.waveTotal / 2) {
      this.surged = true;
      const ang = Math.random() * Math.PI * 2;
      const n = Math.min(10, 2 + this.wave);
      for (let i = 0; i < n; i++) this.spawnMonster('z_runner', ang + (Math.random() - 0.5) * 0.5, true);
      this.emit({ type: 'surge', n, dir: ['east', 'south', 'west', 'north'][Math.round(((ang / (Math.PI * 2)) % 1) * 4 + 4) % 4] });
    }
    if (!this.enraged && this.fightT > ENRAGE_AFTER) {
      this.enraged = true;
      this.emit({ type: 'enrage' });
    }
  }

  spawnMonster(type, angle = null, extra = false) {
    const def = MONSTERS[type];
    const flyer = def.kind === 'fly' || def.fly;
    for (let i = 0; i < 12; i++) {
      const ang = angle ?? Math.random() * Math.PI * 2;
      const r = 210 + Math.random() * 50;
      const x = this.center.x + Math.cos(ang) * r;
      const y = this.center.y + Math.sin(ang) * r;
      if (!flyer && this.world.isBlocked(x - 4, y - 3, 8, 3)) continue;
      // in Survival every wave is a little tougher and quicker than the last
      const apoc = this.theme === 'apoc';
      const lv = def.boss ? 1 : rollMonsterLevel(this.wave);
      const hp = Math.max(1, Math.round(def.hp * this.diff.hp * lvHp(lv) * (apoc ? 1 + 0.06 * (this.wave - 1) : 1)));
      this.monsters.push({
        lv, sp: (apoc ? 1 + 0.03 * (this.wave - 1) : 1) * lvSpeed(lv), id: this.nextId++, type, x, y, hp, max: hp, face: 1, state: 'walk', t: 0, anim: Math.random() * 4,
        cd: 0.5 + Math.random(), atk: 0, kx: 0, ky: 0, stuck: 0, dirv: 0,
      });
      return true;
    }
    return false;
  }

  // ---------- monsters ----------

  updateMonster(m, dt) {
    const def = MONSTERS[m.type];
    m.anim += dt;
    m.t += dt;
    if (m.state === 'dead') return;
    const slow = this.slowT > 0 ? POWER_SLOW : 1;
    m.cd -= dt * slow;
    m.atk = Math.max(0, m.atk - dt);

    if (m.state === 'hurt') {
      this.step(m, def, m.kx * dt, m.ky * dt);
      m.kx *= 0.88;
      m.ky *= 0.88;
      if (m.t >= 0.26) {
        m.state = 'walk';
        m.t = 0;
      }
      return;
    }

    const players = this.g.waveTargets().filter((p) => !p.hidden);
    if (def.boss && this.bossSkill(m, def, dt, players)) return;
    const speed = def.speed * (m.sp || 1) * (this.enraged ? 1.25 : 1) * slow;
    const scale = def.scale || 1;
    const reach = 8 + scale * 5;

    let target = null;
    let tx = this.center.x;
    let ty = this.center.y + 8;
    let kind = 'house';
    // Monsters want the base. They only turn on a hero who is practically in their way.
    let best = def.kind === 'shoot' ? 44 : 30;
    for (const p of players) {
      const d = Math.hypot(p.x - m.x, p.y - m.y);
      if (d < best) {
        best = d;
        target = p;
      }
    }
    if (target) {
      kind = 'player';
      tx = target.x;
      ty = target.y;
    } else if (def.kind === 'shoot') {
      // archers soften the walls from a distance
      let bd = def.range * 1.15;
      for (const b of this.barricades) {
        const d = Math.hypot(b.x - m.x, b.y - m.y);
        if (d < bd) {
          bd = d;
          kind = 'barricade';
          target = b;
          tx = b.x;
          ty = b.y;
        }
      }
    }

    const dx = tx - m.x;
    const dy = ty - m.y;
    const dist = Math.hypot(dx, dy) || 1;
    m.face = dx >= 0 ? 1 : -1;
    // which way a four-direction sprite should look: 0 down, 1 up, 2 right, 3 left
    m.dirv = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 2 : 3) : dy >= 0 ? 0 : 1;

    if (def.kind === 'shoot') {
      const inRange = dist <= def.range;
      if (!inRange) this.step(m, def, (dx / dist) * speed * dt, (dy / dist) * speed * dt);
      else if (dist < def.range * 0.5) this.step(m, def, (-dx / dist) * speed * 0.6 * dt, (-dy / dist) * speed * 0.6 * dt);
      const houseNear = distToRect(m.x, m.y, this.house) < def.range;
      if (m.cd <= 0 && (inRange || (kind === 'house' && houseNear))) {
        const sx = kind === 'house' ? this.center.x - m.x : dx;
        const sy = kind === 'house' ? this.center.y - m.y : dy;
        const sl = Math.hypot(sx, sy) || 1;
        this.shots.push({
          x: m.x, y: m.y - 6, vx: (sx / sl) * 95, vy: (sy / sl) * 95, life: 1.8,
          dmg: this.heartDamage(def, m), sd: def.sd * this.diff.dmg, spit: !!def.fly, by: { kind: 'monster', id: m.id, name: def.name },
        });
        m.cd = def.rate;
        m.atk = 0.3;
      }
      return;
    }

    // melee: close the gap, then hit whatever is in the way
    const nearHouse = distToRect(m.x, m.y, this.house) < reach;
    if (kind === 'player' && dist < reach) {
      this.strikePlayer(m, def, target);
    } else if (kind === 'house' && nearHouse) {
      this.strikeHouse(m, def);
    } else {
      const moved = this.step(m, def, (dx / dist) * speed * dt, (dy / dist) * speed * dt);
      m.stuck = moved ? 0 : m.stuck + dt;
      if (m.stuck > 0.15 && def.kind !== 'fly') {
        // a wall of barricades is in the way, so chew through it
        const b = this.nearestBarricade(m.x, m.y, reach + 8);
        if (b) this.strikeBarricade(m, def, b);
      }
    }
  }

  // A boss now and then winds up a skill (a red mark shows where it will land), then does it: a short dash, or a spiral slash all round it.
  // Returns true while the skill is taking over the boss.
  bossSkill(m, def, dt, players) {
    const scale = def.scale || 1;
    const radius = 30 + 14 * scale;
    let sk = m.skill;
    m.skT = (m.skT ?? 3.5) - dt;
    if (!sk) {
      if (m.skT > 0) return false;
      let near = null;
      let nd = 190;
      for (const p of players) {
        const d = Math.hypot(p.x - m.x, p.y - m.y);
        if (d < nd) {
          nd = d;
          near = p;
        }
      }
      if (!near) {
        m.skT = 1;
        return false;
      }
      m.skill = sk = { kind: Math.random() < 0.5 ? 'dash' : 'spiral', phase: 0, t: 0, prog: 0, ang: Math.atan2(near.y - m.y, near.x - m.x), hit: false };
      return true;
    }
    sk.t += dt;
    m.face = Math.cos(sk.ang) >= 0 ? 1 : -1;
    if (sk.phase === 0) {
      sk.prog = Math.min(1, sk.t / BOSS_WIND);
      if (sk.t >= BOSS_WIND) {
        sk.phase = 1;
        sk.t = 0;
        sk.prog = 0;
        m.atk = 0.3;
        if (sk.kind === 'spiral') this.bossHit(m, def, players, (p) => Math.hypot(p.x - m.x, p.y - m.y) < radius + 6, 1.6);
      }
      return true;
    }
    if (sk.kind === 'dash') {
      sk.prog = Math.min(1, sk.t / BOSS_DASH_TIME);
      this.step(m, def, Math.cos(sk.ang) * BOSS_DASH_SPEED * dt, Math.sin(sk.ang) * BOSS_DASH_SPEED * dt);
      if (!sk.hit) sk.hit = this.bossHit(m, def, players, (p) => Math.hypot(p.x - m.x, p.y - m.y) < 12 + 6 * scale, 1.4);
      m.atk = Math.max(m.atk, 0.1);
      if (sk.t >= BOSS_DASH_TIME) this.endSkill(m);
    } else {
      sk.prog = Math.min(1, sk.t / 0.35);
      if (sk.t >= 0.35) this.endSkill(m);
    }
    return true;
  }

  endSkill(m) {
    m.skill = null;
    m.skT = 5 + Math.random() * 4;
  }

  // hurt every hero the test picks; true if anyone was hit
  bossHit(m, def, players, test, mult) {
    let any = false;
    for (const p of players) {
      if (!test(p)) continue;
      any = true;
      this.g.waveHurt(p.id, Math.max(1, Math.round(this.heartDamage(def, m) * mult)), m.x, m.y, { kind: 'monster', id: m.id, name: def.name });
    }
    return any;
  }

  step(m, def, dx, dy) {
    const sx = m.x;
    const sy = m.y;
    if (def.kind === 'fly' || def.fly) {
      m.x += dx;
      m.y += dy;
    } else {
      if (!this.world.isBlocked(m.x + dx - 4, m.y - 3, 8, 3)) m.x += dx;
      if (!this.world.isBlocked(m.x - 4, m.y + dy - 3, 8, 3)) m.y += dy;
    }
    return Math.hypot(m.x - sx, m.y - sy) > Math.hypot(dx, dy) * 0.35;
  }

  heartDamage(def, m) {
    return Math.max(1, Math.round(def.dmg * this.diff.dmg * lvDmg(m?.lv || 1)));
  }

  nearestBarricade(x, y, within) {
    let best = null;
    let bd = within;
    for (const b of this.barricades) {
      const d = distToRect(x, y, BARRICADE_RECT(b));
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    return best;
  }

  strikePlayer(m, def, p) {
    if (m.cd > 0) return;
    m.cd = 1.1;
    m.atk = 0.3;
    this.g.waveHurt(p.id, this.heartDamage(def, m), m.x, m.y, { kind: 'monster', id: m.id, name: def.name });
  }

  strikeHouse(m, def) {
    if (m.cd > 0) return;
    m.cd = 1.1;
    m.atk = 0.3;
    this.baseHp -= def.sd * this.diff.dmg * HOUSE_SOFTNESS;
  }

  strikeBarricade(m, def, b) {
    if (m.cd > 0) return;
    m.cd = 1;
    m.atk = 0.3;
    this.damageBarricade(b, def.sd * this.diff.dmg);
  }

  damageBarricade(b, amount) {
    b.hp -= amount;
    if (b.hp <= 0) {
      this.barricades = this.barricades.filter((x) => x !== b);
      if (!this.wrecks.some((r) => Math.hypot(r.x - b.x, r.y - b.y) < 4)) this.wrecks.push({ x: b.x, y: b.y, v: b.v });
      this.syncRects();
      this.emit({ type: 'bbreak', x: b.x, y: b.y });
    }
  }

  updateShots(dt) {
    const players = this.g.waveTargets().filter((p) => !p.hidden);
    this.shots = this.shots.filter((s) => {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      for (const p of players) {
        if (Math.hypot(p.x - s.x, p.y - 8 - s.y) < 7) {
          this.g.waveHurt(p.id, s.dmg, s.x - s.vx, s.y - s.vy, s.by);
          return false;
        }
      }
      for (const b of this.barricades) {
        const r = BARRICADE_RECT(b);
        if (s.x > r.x && s.x < r.x + r.w && s.y > r.y && s.y < r.y + r.h) {
          this.damageBarricade(b, s.sd);
          return false;
        }
      }
      if (s.x > this.house.x && s.x < this.house.x + this.house.w && s.y > this.house.y && s.y < this.house.y + this.house.h) {
        this.baseHp -= s.sd * HOUSE_SOFTNESS;
        return false;
      }
      return s.life > 0;
    });
  }

  // ---------- things players do ----------

  // `splat`: helpers' hits leave blood here (your own hits already did, in Combat)
  hitMonster(id, dmg, fx, fy, kb = 110, splat = false, by = null) {
    const m = this.monsters.find((x) => x.id === id);
    if (!m || m.state === 'dead') return;
    const def = MONSTERS[m.type];
    if (splat) this.g.combat?.splat(m.x, m.y, null, m.hp - dmg <= 0 ? 2 : 1, fx, fy);
    m.hp -= dmg;
    if (m.hp <= 0) {
      m.state = 'dead';
      m.t = 0;
      const who = String(by ?? this.g.mp?.you ?? 'me');
      this.kills[who] = (this.kills[who] || 0) + 1;
      const power = ++this.killN === this.powerAt ? (Math.random() < 0.5 ? 'slowmo' : 'blast') : undefined;
      this.emit({ type: 'mdie', name: def.name, x: m.x, y: m.y, boss: !!def.boss, loot: rollMonsterLoot(def, this.diff, this.theme), power, pid: this.wave, lv: m.lv || 1 });
      return;
    }
    if (def.boss) return; // a boss shrugs hits off: no knock-back, no stagger, it keeps its pace
    const ang = Math.atan2(m.y - 8 - fy, m.x - fx);
    const power = kb * (def.kb ?? 1);
    m.state = 'hurt';
    m.t = 0;
    m.kx = Math.cos(ang) * power;
    m.ky = Math.sin(ang) * power;
  }

  // Why a wall can't go here, or null if it can
  placeCheck(x, y) {
    const r = BARRICADE_RECT({ x, y });
    if (this.world.isBlocked(r.x, r.y, r.w, r.h)) return 'blocked'; // trees, walls, water and other barricades
    if (overlaps(r, this.sprite)) return 'base';
    // only block when someone's feet would really be inside the spot; standing right beside it is fine
    for (const p of this.g.waveTargets()) if (overlaps(r, { x: p.x - 5, y: p.y - 6, w: 10, h: 7 })) return 'hero';
    for (const m of this.monsters) if (m.state !== 'dead' && overlaps(r, { x: m.x - 6, y: m.y - 5, w: 12, h: 6 })) return 'monster';
    return null;
  }

  canPlace(x, y) {
    return !this.placeCheck(x, y);
  }

  requestPlace(x, y, v = false) {
    return this.placeBarricade(x, y, v);
  }

  placeBarricade(x, y, v = false) {
    if (!this.canPlace(x, y)) return false;
    this.barricades.push({ id: this.nextId++, x, y, hp: this.diff.barricadeHp, max: this.diff.barricadeHp, v: !!v, r: false });
    this.wrecks = this.wrecks.filter((r) => Math.hypot(r.x - x, r.y - y) >= 6);
    this.syncRects();
    return true;
  }

  // plant every destroyed barricade back where it stood (as far as the spot is free); returns how many went back
  repairAll() {
    let placed = 0;
    for (const r of [...this.wrecks]) {
      if (this.placeCheck(r.x, r.y)) continue;
      this.barricades.push({ id: this.nextId++, x: r.x, y: r.y, hp: this.diff.barricadeHp, max: this.diff.barricadeHp, v: !!r.v, r: false });
      this.wrecks = this.wrecks.filter((x) => x !== r);
      this.syncRects();
      placed++;
    }
    return placed;
  }

  requestRepair() {
    return this.repairAll();
  }

  requestPick(id) {
    return this.pickBarricade(id);
  }

  pickBarricade(id) {
    const b = this.barricades.find((x) => x.id === id);
    if (!b) return false;
    this.barricades = this.barricades.filter((x) => x !== b);
    this.syncRects();
    return true;
  }

  // ---------- helpers you hire ----------

  recruit(kind) {
    const def = ALLIES[kind];
    const pad = this.pads.find((p) => p.kind === kind);
    if (!def || !pad || this.allies.length >= teamCap(this.baseLevel)) return false;
    const n = this.allies.length;
    let ax = pad.x + ((n % 3) - 1) * 12;
    let ay = pad.y - 16 - Math.floor(n / 3) * 11;
    let px = pad.x;
    let py = pad.y;
    if (this.theme === 'apoc' && def.ai === 'ranged') {
      // Survival: the shooters stand on top of the bus and fire down from there
      const k = this.allies.filter((a) => ALLIES[a.kind].ai === 'ranged').length;
      ax = px = this.sprite.x + Math.round(([30, 18, 42, 10, 50, 24, 36, 6][k % 8] * this.sprite.w) / 61);
      ay = py = this.sprite.y + Math.round(this.sprite.h * 0.35);
    }
    this.allies.push({ id: this.nextId++, kind, x: px, y: py, ax, ay, dir: 0, cd: 0.8, anim: Math.random() * 3, moving: false, atk: 0 });
    this.emit({ type: 'recruit', kind, x: px, y: py });
    return true;
  }

  updateAllies(dt) {
    for (const a of this.allies) {
      const def = ALLIES[a.kind];
      a.cd -= dt;
      a.anim += dt;
      a.atk = Math.max(0, a.atk - dt);
      let target = null;
      let td = def.range;
      for (const m of this.monsters) {
        if (m.state === 'dead') continue;
        const d = Math.hypot(m.x - a.x, m.y - 8 - (a.y - 8));
        if (d < td) {
          td = d;
          target = m;
        }
      }
      let goal = { x: a.ax, y: a.ay };
      if (target) {
        const dx = target.x - a.x;
        const dy = target.y - a.y;
        a.dir = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 2 : 3) : dy >= 0 ? 0 : 1;
        if (def.ai === 'ranged') {
          if (a.cd <= 0) {
            const len = Math.hypot(dx, dy) || 1;
            this.ashots.push({ x: a.x, y: a.y - 10, vx: (dx / len) * 150, vy: ((dy - 4) / len) * 150, dmg: def.dmg, life: 1.1 });
            a.cd = def.rate;
            a.atk = 0.25;
          }
        } else {
          // guards walk up to the nearest monster, then bash it
          if (td > 20) goal = { x: target.x, y: target.y };
          else if (a.cd <= 0) {
            this.hitMonster(target.id, def.dmg, a.x, a.y, 90, true, 'ally');
            a.cd = def.rate;
            a.atk = 0.25;
          }
        }
      }
      // wander to the goal (guards chase, shooters drift back to their post)
      const gx = goal.x - a.x;
      const gy = goal.y - a.y;
      const gl = Math.hypot(gx, gy);
      a.moving = false;
      if (gl > (target && def.ai === 'melee' ? 4 : 5)) {
        const speed = (def.speed || 28) * dt;
        const nx = a.x + (gx / gl) * speed;
        const ny = a.y + (gy / gl) * speed;
        if (!this.world.isBlocked(nx - 4, a.y - 3, 8, 3, true)) a.x = nx;
        if (!this.world.isBlocked(a.x - 4, ny - 3, 8, 3, true)) a.y = ny;
        a.moving = true;
        if (!target) a.dir = Math.abs(gx) >= Math.abs(gy) ? (gx >= 0 ? 2 : 3) : gy >= 0 ? 0 : 1;
      }
    }
  }

  updateAshots(dt) {
    this.ashots = this.ashots.filter((s) => {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      for (const m of this.monsters) {
        if (m.state === 'dead') continue;
        const sc = MONSTERS[m.type].scale || 1;
        const ox = (s.x - m.x) / (7 * sc + 2);
        const oy = (s.y - (m.y - 8 * sc)) / (9 * sc + 2);
        if (ox * ox + oy * oy < 1) {
          this.hitMonster(m.id, s.dmg, s.x - s.vx, s.y - s.vy, 60, true, 'ally');
          return false;
        }
      }
      return s.life > 0;
    });
  }

  // the base can be made tougher by anyone, and everyone benefits
  upgradeBase() {
    if (this.baseLevel >= MAX_LEVEL) return false;
    this.baseLevel++;
    const before = this.baseMax;
    this.baseMax = Math.round(this.diff.baseHp * (1 + 0.3 * this.baseLevel));
    this.baseHp += this.baseMax - before;
    this.emit({ type: 'upgrade', what: 'house', level: this.baseLevel });
    return true;
  }

  // messages from guests
  onMessage(k, d, from) {
    if (k === 'hit') this.hitMonster(d.id, d.dmg, d.fx, d.fy, d.kb, false, from);
    else if (k === 'power') this.power(d.kind, from);
    else if (k === 'repair') this.g.mp?.net.send({ t: 'w', to: from, k: 'ack', d: { op: 'repair', placed: this.repairAll(), asked: Math.max(0, Math.min(200, Number(d.n) || 0)) } });
    else if (k === 'place') this.g.mp?.net.send({ t: 'w', to: from, k: 'ack', d: { op: 'place', ok: this.placeBarricade(d.x, d.y, d.v) } });
    else if (k === 'pick') this.g.mp?.net.send({ t: 'w', to: from, k: 'ack', d: { op: 'pick', ok: this.pickBarricade(d.id) } });
    else if (k === 'recruit') this.g.mp?.net.send({ t: 'w', to: from, k: 'ack', d: { op: 'recruit', ok: ALLY_KINDS.includes(d.kind) && this.recruit(d.kind), cost: ALLIES[d.kind]?.cost } });
    else if (k === 'upg') this.g.mp?.net.send({ t: 'w', to: from, k: 'ack', d: { op: 'upg', ok: this.upgradeBase() } });
  }

  snapshot() {
    return {
      w: this.wave,
      ph: this.phase,
      tm: Math.round(this.timer * 10) / 10,
      bh: Math.round(this.baseHp * 10) / 10,
      bm: this.baseMax,
      left: this.hudState().left,
      qn: this.queue.length,
      wt: this.waveTotal || 0,
      qb: this.queueCounts().map(([t, n]) => [MONSTER_IDS.indexOf(t), n]),
      m: this.monsters.map((m) => [m.id, MONSTER_IDS.indexOf(m.type), Math.round(m.x * 10) / 10, Math.round(m.y * 10) / 10, m.hp, m.max, m.face, m.state === 'dead' ? 2 : m.state === 'hurt' ? 1 : 0, m.atk > 0 ? 1 : 0, m.dirv, m.lv || 1, m.skill ? [m.skill.kind === 'dash' ? 1 : 2, m.skill.phase, Math.round(m.skill.prog * 100) / 100, Math.round(m.skill.ang * 100) / 100] : 0]),
      b: this.barricades.map((b) => [b.id, b.x, b.y, Math.round(b.hp * 10) / 10, b.max, b.v ? 1 : 0, b.r ? 1 : 0]),
      s: this.shots.map((s) => [Math.round(s.x), Math.round(s.y), s.spit ? 1 : 0]),
      a: this.allies.map((a) => [a.id, ALLY_KINDS.indexOf(a.kind), Math.round(a.x * 10) / 10, Math.round(a.y * 10) / 10, a.dir, a.moving ? 1 : 0, a.atk > 0 ? 1 : 0]),
      as: this.ashots.map((s) => [Math.round(s.x), Math.round(s.y)]),
      bl: this.baseLevel,
      k: Object.entries(this.kills),
      wk: this.wrecks.map((r) => [r.x, r.y, r.v ? 1 : 0]),
    };
  }
}

// ------------------------------------------------------------------------------------------
// What the other players see: the host's snapshots, glided smoothly between updates.
// ------------------------------------------------------------------------------------------
export class WaveMirror {
  constructor(game, difficultyId) {
    this.g = game;
    this.world = game.world;
    this.diff = DIFFICULTY[difficultyId] || DIFFICULTY.medium;
    this.theme = game.world.apoc ? 'apoc' : 'cozy';
    Object.assign(this, layout(this.world.waveBase(), this.theme));
    this.monsters = [];
    this.barricades = [];
    this.wrecks = []; // where a barricade stood until it was destroyed (not the ones you picked up yourself)
    this.shots = [];
    this.allies = [];
    this.kills = {}; // monsters defeated per player (id), 'ally' for your helpers
    this.ashots = [];
    this.baseLevel = 0;
    this.wave = 0;
    this.phase = 'prep';
    this.timer = PREP_FIRST;
    this.left = 0;
    this.baseHp = this.baseMax = this.diff.baseHp;
  }

  syncRects() {
    this.world.extraRects = this.barricades.map(BARRICADE_RECT);
  }

  forecast(queued, waveTotal, queuedBy) {
    const nextWave = this.wave + 1;
    return {
      coming: this.phase === 'prep' && nextWave <= TOTAL_WAVES ? waveCounts(nextWave, this.diff, this.theme) : null,
      queued,
      waveTotal,
      queuedBy: this.phase === 'fight' ? queuedBy : null,
    };
  }

  hudState() {
    const boss = this.monsters.find((m) => MONSTERS[m.type].boss && m.state !== 'dead');
    return {
      wave: this.wave,
      total: TOTAL_WAVES,
      phase: this.phase,
      timer: Math.max(0, this.timer),
      left: this.left,
      baseHp: Math.max(0, this.baseHp),
      baseMax: this.baseMax,
      baseLevel: this.baseLevel,
      allies: this.allies.length,
      teamCap: teamCap(this.baseLevel),
      wrecks: this.wrecks.length,
      kills: { ...this.kills },
      boss: boss ? { hp: boss.hp, max: boss.max, name: MONSTERS[boss.type].name } : null,
      ...this.forecast(this.qn || 0, this.wt || 0, this.qb || []),
    };
  }

  update(dt) {
    const k = 1 - Math.exp(-dt * 14);
    this.timer -= dt;
    for (const m of this.monsters) {
      m.anim += dt;
      m.t += dt;
      m.atk = Math.max(0, m.atk - dt);
      m.x += (m.tx - m.x) * k;
      m.y += (m.ty - m.y) * k;
    }
    for (const a of this.allies) {
      a.anim += dt;
      a.atk = Math.max(0, a.atk - dt);
      a.x += (a.tx - a.x) * k;
      a.y += (a.ty - a.y) * k;
    }
  }

  applySnapshot(s) {
    this.wave = s.w;
    this.phase = s.ph;
    this.timer = s.tm;
    this.baseHp = s.bh;
    this.baseMax = s.bm;
    this.left = s.left;
    this.qn = s.qn;
    this.wt = s.wt;
    this.qb = (s.qb || []).map(([ti, n]) => [MONSTER_IDS[ti], n]);
    const old = new Map(this.monsters.map((m) => [m.id, m]));
    this.monsters = s.m.map(([id, ti, x, y, hp, max, face, st, atk, dirv, lv, sk]) => {
      const m = old.get(id) || { id, x, y, anim: Math.random() * 4, t: 0 };
      const state = st === 2 ? 'dead' : st === 1 ? 'hurt' : 'walk';
      if (state !== m.state) m.t = 0;
      Object.assign(m, { type: MONSTER_IDS[ti], tx: x, ty: y, hp, max, face, dirv: dirv ?? 0, lv: lv || 1, skill: sk ? { kind: sk[0] === 1 ? 'dash' : 'spiral', phase: sk[1], prog: sk[2], ang: sk[3] } : null, state, atk: atk ? 0.3 : m.atk || 0 });
      return m;
    });
    this.barricades = s.b.map(([id, x, y, hp, max, v, r]) => ({ id, x, y, hp, max, v: !!v, r: !!r }));
    this.shots = s.s.map(([x, y, spit]) => ({ x, y, spit: !!spit }));
    const oldAllies = new Map(this.allies.map((a) => [a.id, a]));
    this.allies = (s.a || []).map(([id, ki, x, y, dir, moving, atk]) => {
      const a = oldAllies.get(id) || { id, x, y, anim: Math.random() * 3 };
      Object.assign(a, { kind: ALLY_KINDS[ki], tx: x, ty: y, dir, moving: !!moving, atk: atk ? 0.25 : a.atk || 0 });
      return a;
    });
    this.ashots = (s.as || []).map(([x, y]) => ({ x, y }));
    this.baseLevel = s.bl || 0;
    this.kills = Object.fromEntries(s.k || []);
    this.wrecks = (s.wk || []).map(([x, y, v]) => ({ x, y, v: !!v }));
    this.syncRects();
  }

  onMessage(k, d) {
    if (k === 'snap') this.applySnapshot(d);
    else if (k === 'ev') this.g.onWaveEvent(d);
    else if (k === 'ack') this.g.onWaveAck(d);
    else if (k === 'hurt') this.g.combat.hurtPlayer(d.dmg, d.fx, d.fy, { by: d.by });
  }

  hitMonster(id, dmg, fx, fy, kb) {
    this.g.mp?.net.send({ t: 'w', to: 'host', k: 'hit', d: { id, dmg, fx, fy, kb } });
  }

  power(kind) {
    this.g.mp?.net.send({ t: 'w', to: 'host', k: 'power', d: { kind } });
    return true;
  }

  setDifficulty(id) {
    if (DIFFICULTY[id]) this.diff = DIFFICULTY[id];
  }

  // a guest asks the host to plant the destroyed barricades back; the answer comes as an ack
  requestRepair(n) {
    this.g.mp?.net.send({ t: 'w', to: 'host', k: 'repair', d: { n } });
  }

  placeCheck(x, y) {
    const r = BARRICADE_RECT({ x, y });
    if (this.world.isBlocked(r.x, r.y, r.w, r.h)) return 'blocked';
    if (overlaps(r, this.sprite)) return 'base';
    return null;
  }

  canPlace(x, y) {
    return !this.placeCheck(x, y);
  }

  // the host decides whether the team has room; the answer comes back as an 'ack'
  recruit(kind) {
    this.g.mp?.net.send({ t: 'w', to: 'host', k: 'recruit', d: { kind } });
    return 'pending';
  }

  upgradeBase() {
    this.g.mp?.net.send({ t: 'w', to: 'host', k: 'upg', d: {} });
    return 'pending';
  }

  requestPlace(x, y, v = false) {
    if (!this.canPlace(x, y)) return false;
    this.g.mp?.net.send({ t: 'w', to: 'host', k: 'place', d: { x, y, v: !!v } });
    return 'pending';
  }

  requestPick(id) {
    this.g.mp?.net.send({ t: 'w', to: 'host', k: 'pick', d: { id } });
    return 'pending';
  }
}
