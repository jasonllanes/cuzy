import { T, WATER } from './world';
import { DIFFICULTY, MONSTERS, MONSTER_IDS, TOTAL_WAVES, endlessList, progressOf, lvDmg, lvHp, lvSpeed, rollMonsterLevel, rollMonsterLoot, waveCounts, waveList } from './monsters';
import { ALLIES, ALLY_KINDS, teamCap } from './allies';
import { MAX_LEVEL } from './upgrades';
import { apocSize } from './apoc';

const PREP_FIRST = 20; // seconds to get ready before wave 1
const PREP_BETWEEN = 14;
const PREP_BETWEEN_APOC = 10; // Survival gives you less time to rebuild
const ENRAGE_AFTER = 95; // seconds into a Survival wave before the stragglers get restless
const MAX_ALIVE = 60;
export const MAX_AIR = 3; // aircraft in the sky at once
export const MAX_AIR_PER_WAVE = 3; // and how many a wave (or a batch, in Endless) may call in all
export const POWER_SLOW_TIME = 8; // seconds the Slow-mo power-up lasts
export const BARRICADE_COST = 4; // a Barricade Box from the shop
export const REPAIR_COST = 2; // per destroyed barricade planted back
export const BOSS_WIND = 1.6; // seconds the red mark shows before a boss skill lands
// half the width of the lane a boss dash covers: the red mark is drawn this wide, and that is what the dash hurts
export const bossDashHalf = (scale) => 9 + 4 * scale;
const BOSS_DASH_SPEED = 250;
const BOSS_DASH_TIME = 0.4;
// [[name, how many], ...] of a list of monster types (for the boss announcements)
const countNames = (types) => {
  const out = [];
  for (const t of types) {
    const name = MONSTERS[t].name.replace(/^The /, '');
    const g = out.find((q) => q[0] === name);
    if (g) g[1]++;
    else out.push([name, 1]);
  }
  return out;
};
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
        { kind: 'pistol', x: left - 18, y: floor + 20 },
        { kind: 'guard', x: left - 2, y: floor + 20 },
        { kind: 'rifle', x: left + bw + 9, y: floor + 20 },
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
      { kind: 'pistol', x: left + 2, y: floor + 20 },
      { kind: 'guard', x: left + 18, y: floor + 20 },
      { kind: 'rifle', x: left + 80, y: floor + 20 },
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
    this.lightLevel = 0; // the shelter's lamps (Survival): one level for the whole team
    this.mendLevel = 0; // the shelter's self-repair (Survival): it heals this much more every second, for the whole team
    this.airs = []; // the air strikes in the sky (3 at most at a time, and 3 calls a wave)
    this.airUsed = 0; // aircraft called in during this wave
    this.airBombs = []; // bombs on their way down
    this.total = game.waveCount > 0 ? game.waveCount : TOTAL_WAVES; // how many waves the run lasts (the host picks it); 0 is endless
    this.endless = !!game.world.endless || game.waveCount === 0; // Endless Survival: no waves, the zombies just keep coming
    this.elapsed = 0; // seconds of the round so far
    this.startMode = 'timer'; // what starts the next wave: timer | vote | manual (the host) | instant (as soon as the last zombie falls)
    this.votes = new Set(); // who voted to start the next wave
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
    // Survival's ring is made of sturdier fence sections, flat along the top and bottom, upright on the sides
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
      total: this.endless ? Infinity : this.total,
      endless: this.endless,
      elapsed: Math.floor(this.elapsed),
      startMode: this.endless ? 'timer' : this.startMode,
      votes: this.votes.size,
      votesNeeded: this.votesNeeded(),
      voted: this.votes.has(this.g.mp?.you ?? 0),
      phase: this.phase,
      timer: Math.max(0, this.timer),
      left: alive,
      baseHp: Math.max(0, this.baseHp),
      baseMax: this.baseMax,
      baseLevel: this.baseLevel,
      mendLevel: this.mendLevel || 0,
      air: this.airs.length,
      airUsed: this.airUsed || 0,
      airMax: MAX_AIR_PER_WAVE,
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
      coming: this.phase === 'prep' && nextWave <= this.total && !this.endless ? waveCounts(nextWave, this.diff, this.theme, this.g.waveTargets().length, this.total) : null,
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
      this.elapsed += dt;
      if (this.mendLevel > 0 && this.baseHp > 0 && this.baseHp < this.baseMax) this.baseHp = Math.min(this.baseMax, this.baseHp + this.baseMax * 0.0025 * this.mendLevel * dt); // the shelter mends itself
      this.updateAir(dt);
      this.updateAirBombs(dt);
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
      const mode = this.endless ? 'timer' : this.startMode;
      if (mode === 'vote') {
        // more than half of the people in the room have to agree (alone: you decide)
        if (this.votes.size >= this.votesNeeded()) this.startWave();
      } else if (mode !== 'manual') {
        this.timer -= dt;
        if (this.timer <= 0) this.startWave();
      }
      return;
    }
    // fight: the monsters pour in one after another, a steady crowd (the bosses last, together), then wait for the last one to fall
    this.fightT += dt;
    if (this.theme === 'apoc') this.survivalPressure();
    this.spawnT -= dt;
    if (this.queue.length && this.spawnT <= 0) {
      const alive = this.monsters.filter((m) => m.state !== 'dead').length;
      let came = false;
      if (alive < MAX_ALIVE) {
        if (MONSTERS[this.queue[this.queue.length - 1]].boss) {
          // the finale: every boss at once, once the crowd has thinned a little
          if (alive <= 25 || this.fightT > 90) came = this.spawnBurst(MAX_ALIVE - alive);
        }
        else if (this.spawnMonster(this.queue[this.queue.length - 1])) {
          this.queue.pop();
          came = true;
          // now and then a few come in at the very same moment, from the same side
          if (Math.random() < 0.3) {
            const together = 1 + Math.floor(Math.random() * 3);
            const side = Math.random() * Math.PI * 2;
            for (let k = 0; k < together && this.queue.length && alive + 1 + k < MAX_ALIVE; k++) {
              const t = this.queue[this.queue.length - 1];
              if (MONSTERS[t].boss || !this.spawnMonster(t, side + (Math.random() - 0.5) * 0.5)) break;
              this.queue.pop();
            }
          }
        }
      }
      // one by one at random: sometimes right on the heels of the last one, never a long wait
      this.spawnT = came ? Math.min(1, this.spawnGap * (0.25 + Math.random() * 1.5)) : 0.2; // (nothing could come in just now: it tries again almost at once)
    }
    if (this.endless) {
      // no waves: the next batch follows as soon as the last one is nearly gone (or after a while, whatever is left)
      if (!this.queue.length && (this.monsters.filter((m) => m.state !== 'dead').length <= 10 || this.fightT > 50)) this.startWave();
    } else if (!this.queue.length && this.monsters.every((m) => m.state === 'dead')) this.finishWave();
  }

  // One burst: a pack of the ordinary monsters, all coming in from the same side. When only bosses are left they come together,
  // fanned out along the edge so they never pile up, as the wave's finale.
  spawnBurst(room) {
    const isBoss = (t) => !!MONSTERS[t].boss;
    const last = this.queue[this.queue.length - 1];
    if (!last) return false;
    const bossBurst = isBoss(last);
    const want = bossBurst ? this.queue.length : Math.min(this.burstSize, room);
    let made = 0;
    const madeTypes = [];
    // (a side with only water or a crowd of players on it is skipped: another side is tried)
    for (let attempt = 0; attempt < 14 && !made; attempt++) {
      const base = Math.random() * Math.PI * 2;
      for (let i = 0; i < want; i++) {
        const type = this.queue[this.queue.length - 1];
        if (!type || isBoss(type) !== bossBurst) break;
        const a = bossBurst ? base + (i - (want - 1) / 2) * 0.75 : base + (Math.random() - 0.5) * 0.7;
        if (!this.spawnMonster(type, a)) break;
        this.queue.pop();
        made++;
        madeTypes.push(type);
      }
    }
    if (bossBurst && made) this.emit({ type: 'boss', n: made, wave: this.wave, endless: this.endless, list: countNames(madeTypes) });
    return made > 0;
  }

  startWave() {
    this.wave++;
    if (this.endless) this.airUsed = 0; // (a new batch)
    const players = this.g.waveTargets().length; // (the Colossus bosses are scaled to the size of the team)
    const list = this.endless ? endlessList(this.wave, this.diff, players) : waveList(this.wave, this.diff, this.theme, players, this.total);
    // the bosses go last: the queue is spawned from its end
    this.queue = [...list.filter((t) => MONSTERS[t].boss), ...list.filter((t) => !MONSTERS[t].boss)];
    const normals = list.length - this.queue.filter((t) => MONSTERS[t].boss).length;
    this.burstSize = Math.max(4, Math.ceil(normals / 4)); // (only used for the boss finale and the pressure packs)
    this.votes.clear();
    this.waveTotal = this.queue.length;
    if (this.endless && this.wave > 1) {
      // every new batch, the builders patch things up a little
      for (const b of this.barricades) b.hp = Math.min(b.max, b.hp + b.max * 0.12);
      this.baseHp = Math.min(this.baseMax, this.baseHp + this.baseMax * 0.03);
    }
    this.spawnGap = this.endless
      ? Math.max(0.3, 1.2 - 0.04 * this.wave)
      : this.theme === 'apoc'
      ? Math.min(1.2, Math.max(0.18, (11 + this.wave * 1.2) / Math.max(1, normals))) // Survival: they pour in fast, the whole wave within about 12 seconds
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
    this.emit({ type: 'start', wave: this.wave, boss: !this.endless && this.wave === this.total, bosses, endless: this.endless, list: countNames(this.queue.filter((t) => MONSTERS[t].boss)) });
  }

  finishWave() {
    this.airUsed = 0; // the next wave may call three more
    if (this.wave >= this.total) {
      this.phase = 'victory';
      this.emit({ type: 'win' });
      return;
    }
    this.phase = 'prep';
    this.timer = this.startMode === 'instant' ? 2 : this.theme === 'apoc' ? PREP_BETWEEN_APOC : PREP_BETWEEN;
    // the builders patch things up between waves
    for (const b of this.barricades) b.hp = Math.min(b.max, b.hp + b.max * 0.35);
    this.baseHp = Math.min(this.baseMax, this.baseHp + this.baseMax * 0.1);
    this.emit({ type: 'cleared', wave: this.wave });
  }

  // Survival only: halfway through a wave a pack of runners comes in from one side, and a wave that drags on
  // sends the survivors into a frenzy.
  survivalPressure() {
    if (!this.surged && this.wave >= 3 && (!this.endless || this.wave % 3 === 0) && this.queue.length <= this.waveTotal / 2) {
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

  // is there water within `d` px of this spot? (zombies are not spawned on the shore)
  nearWater(x, y, d) {
    for (let k = 0; k < 8; k++) {
      const px = x + Math.cos((k * Math.PI) / 4) * d;
      const py = y + Math.sin((k * Math.PI) / 4) * d;
      if (this.world.type(Math.floor(px / 16), Math.floor(py / 16)) === WATER) return true;
    }
    return this.world.type(Math.floor(x / 16), Math.floor(y / 16)) === WATER;
  }

  // Zombies come in from outside every player's screen and not from the shore. If that cannot be done (a shelter on a small
  // island, say), they stop being picky after a few tries, so the wave never stalls with monsters that cannot appear.
  spawnMonster(type, angle = null, extra = false) {
    const def = MONSTERS[type];
    const flyer = def.kind === 'fly' || def.fly;
    const relax = (this.spawnFail || 0) >= 1; // (one failed try, and it stops being picky about the screen and the shore)
    for (let i = 0; i < 48; i++) {
      const ang = angle ?? Math.random() * Math.PI * 2;
      const r = 210 + Math.random() * 50 + (i > 14 ? (i - 14) * 6 : 0); // (a little further out each time it is turned down)
      const x = this.center.x + Math.cos(ang) * r;
      const y = this.center.y + Math.sin(ang) * r;
      if (!flyer && this.world.isBlocked(x - 4, y - 3, 8, 3)) continue;
      if (!relax && !flyer && this.nearWater(x, y, 28)) continue;
      if (!relax && this.g.seenFrom(x, y)) continue; // zombies come in from outside the screen, never on it
      this.spawnFail = 0;
      this.makeMonster(type, x, y);
      return true;
    }
    this.spawnFail = (this.spawnFail || 0) + 1;
    return false;
  }

  // a new monster at (x, y)
  makeMonster(type, x, y, level = 0) {
    const def = MONSTERS[type];
    // in Survival every wave is a little tougher and quicker than the last
    const apoc = this.theme === 'apoc';
    // monsters (the bosses too) get stronger the further into the run it is, whatever its length
    const prog = progressOf(this.wave, this.endless ? 0 : this.total);
    const lv = level || (def.boss ? Math.min(10, Math.max(1, Math.ceil(prog * 0.8))) : rollMonsterLevel(prog));
    const hp = Math.max(1, Math.round(def.hp * this.diff.hp * lvHp(lv) * (apoc ? 1 + 0.06 * (prog - 1) : 1)));
    const m = {
      lv, sp: (apoc ? Math.min(1.6, 1 + 0.03 * (prog - 1)) : 1) * lvSpeed(lv), id: this.nextId++, type, x, y, hp, max: hp, face: 1, state: 'walk', t: 0, anim: Math.random() * 4,
      cd: 0.5 + Math.random(), atk: 0, kx: 0, ky: 0, stuck: 0, dirv: 0,
    };
    this.monsters.push(m);
    return m;
  }

  // The Zombie Wizard raises a pair of zombies beside it now and then (never more than four of its own at a time)
  wizardSummon(m, def, dt) {
    m.sumT = (m.sumT ?? 3 + Math.random() * 3) - dt;
    if (m.sumT > 0) return;
    const mine = this.monsters.filter((q) => q.maker === m.id && q.state !== 'dead').length;
    if (mine >= 4 || this.monsters.length >= MAX_ALIVE + 12) {
      m.sumT = 2;
      return;
    }
    m.sumT = 9 + Math.random() * 4;
    m.atk = 0.5;
    const kind = this.wave >= 7 && Math.random() < 0.4 ? 'z_runner' : this.wave >= 5 && Math.random() < 0.3 ? 'z_axe' : def.summon;
    for (let k = 0; k < 2; k++) {
      const z = this.makeMonster(kind, m.x + (k ? 18 : -18), m.y + 6, Math.max(1, (m.lv || 1) - 1));
      z.maker = m.id;
      z.cd = 1;
    }
    this.emit({ type: 'summon', x: Math.round(m.x), y: Math.round(m.y) });
  }

  // ---------- monsters ----------

  updateMonster(m, dt) {
    const def = MONSTERS[m.type];
    m.anim += dt;
    m.t += dt;
    if (m.state === 'dead') return;
    if (m.stunT > 0) {
      // stunned by a grenade: it stands still
      m.stunT -= dt;
      return;
    }
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

    if (def.summon && m.state !== 'dead') this.wizardSummon(m, def, dt);
    if (def.kind === 'shoot') {
      const inRange = dist <= def.range;
      if (!inRange) this.step(m, def, (dx / dist) * speed * dt, (dy / dist) * speed * dt);
      else if (dist < def.range * 0.5) this.step(m, def, (-dx / dist) * speed * 0.6 * dt, (-dy / dist) * speed * 0.6 * dt);
      const houseNear = distToRect(m.x, m.y, this.house) < def.range;
      if (m.cd <= 0 && (inRange || (kind === 'house' && houseNear))) {
        const sx = kind === 'house' ? this.center.x - m.x : dx;
        const sy = kind === 'house' ? this.center.y - m.y : dy;
        const sl = Math.hypot(sx, sy) || 1;
        const sp = def.bolt ? 80 : 95;
        this.shots.push({
          x: m.x, y: m.y - 6, vx: (sx / sl) * sp, vy: (sy / sl) * sp, life: 1.8,
          dmg: this.heartDamage(def, m), sd: def.sd * this.diff.dmg, spit: !!def.fly, arrow: def.arrow || 0, bolt: !!def.bolt, by: { kind: 'monster', id: m.id, name: def.name },
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
      // caught on a tree or a rock: it slides round it (a side is picked and kept for a moment) instead of pushing on for ever
      let mx = (dx / dist) * speed * dt;
      let my = (dy / dist) * speed * dt;
      if (def.airborne) {
        // a bat does not fly straight: it swoops from side to side
        const w = Math.sin(m.anim * 6 + m.id) * 0.9;
        [mx, my] = [mx - (dy / dist) * speed * dt * w, my + (dx / dist) * speed * dt * w];
      }
      if (m.slideT > 0) {
        m.slideT -= dt;
        const c = Math.cos((Math.PI / 2.2) * m.slideDir);
        const sn = Math.sin((Math.PI / 2.2) * m.slideDir);
        [mx, my] = [mx * c - my * sn, mx * sn + my * c];
      }
      const moved = this.step(m, def, mx, my);
      m.stuck = moved ? 0 : m.stuck + dt;
      if (m.stuck > 0.15 && def.kind !== 'fly') {
        // a wall of barricades is in the way, so chew through it
        const b = this.nearestBarricade(m.x, m.y, reach + 8);
        if (b) this.strikeBarricade(m, def, b);
        else if (m.stuck > 0.4 && !(m.slideT > 0)) {
          m.slideDir = Math.random() < 0.5 ? 1 : -1;
          m.slideT = 0.9;
        }
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
        // (the spiral hurts inside the red ellipse it showed, and nowhere else)
        if (sk.kind === 'spiral') this.bossHit(m, def, players, (p) => ((p.x - m.x) / radius) ** 2 + ((p.y - (m.y - 2)) / (radius * 0.8)) ** 2 <= 1, 1.6);
      }
      return true;
    }
    if (sk.kind === 'dash') {
      sk.prog = Math.min(1, sk.t / BOSS_DASH_TIME);
      this.step(m, def, Math.cos(sk.ang) * BOSS_DASH_SPEED * dt, Math.sin(sk.ang) * BOSS_DASH_SPEED * dt);
      if (!sk.hit) sk.hit = this.bossHit(m, def, players, (p) => Math.hypot(p.x - m.x, p.y - m.y) < bossDashHalf(scale), 1.4);
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
    m.cd = Math.max(m.cd, 1.3); // it catches its breath before the next blow
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
      // monsters swim: water never stops them (the shelter may stand by the sea), they only go slower in it
      const swim = this.world.type(Math.floor(m.x / 16), Math.floor(m.y / 16)) === WATER ? 0.6 : 1;
      dx *= swim;
      dy *= swim;
      if (!this.world.isBlocked(m.x + dx - 4, m.y - 3, 8, 3, true)) m.x += dx;
      if (!this.world.isBlocked(m.x - 4, m.y + dy - 3, 8, 3, true)) m.y += dy;
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
    m.cd = def.boss ? 1.6 : 1.1; // a boss swings less often
    m.atk = 0.3;
    this.g.waveHurt(p.id, this.heartDamage(def, m), m.x, m.y, { kind: 'monster', id: m.id, name: def.name });
  }

  strikeHouse(m, def) {
    if (m.cd > 0) return;
    m.cd = 1.1;
    m.atk = 0.3;
    this.hitHouse(def.sd * this.diff.dmg * HOUSE_SOFTNESS, m.x, m.y);
  }

  // the shelter takes a hit: everyone sees it shake and splinter (the event carries where it landed)
  hitHouse(amount, x, y) {
    this.baseHp -= amount;
    this.emit({ type: 'bhit', n: Math.round(amount * 10) / 10, x: Math.round(x), y: Math.round(y) });
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
        this.hitHouse(s.sd * HOUSE_SOFTNESS, s.x, s.y);
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
    const pad = this.pads.find((p) => p.kind === kind) || this.pads.find((p) => p.kind === def?.pad);
    if (!def || !pad || this.allies.length >= teamCap(this.baseLevel)) return false;
    const n = this.allies.length;
    let ax = pad.x + ((n % 3) - 1) * 12;
    let ay = pad.y - 16 - Math.floor(n / 3) * 11;
    let px = pad.x;
    let py = pad.y;
    if (this.theme === 'apoc' && def.ai === 'ranged') {
      // Survival: the shooters stand on top of the bus and fire down from there
      const k = this.allies.filter((a) => ALLIES[a.kind].ai === 'ranged').length;
      ax = px = this.sprite.x + Math.round(([30, 18, 42, 10, 50, 24, 36, 6][k % 8] * this.sprite.w) / 61) + (Math.floor(k / 8) % 2 ? 3 : 0);
      ay = py = this.sprite.y + Math.round(this.sprite.h * 0.35) - Math.floor(k / 8) * 6; // (a crowd of them stands in more rows along the roof)
    }
    this.allies.push({ id: this.nextId++, kind, x: px, y: py, ax, ay, dir: 0, aim: Math.PI / 2, cd: 0.8, anim: Math.random() * 3, moving: false, atk: 0 });
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
          // it turns to face its target, then fires the gun it carries along that line
          const cy = a.y - 10;
          a.aim = Math.atan2(target.y - 8 - cy, dx);
          if (a.cd <= 0 && def.lob) {
            // a grenade: up in an arc to where the target stands, and it goes off there
            const dist = Math.hypot(target.x - a.x, target.y - 8 - cy) || 1;
            this.ashots.push({ x: a.x, y: cy, vx: (target.x - a.x) / dist, vy: (target.y - 8 - cy) / dist, sx: a.x, sy: cy, tx: target.x, ty: target.y - 6, t: 0, dur: 0.45 + dist / 220, dmg: def.dmg, R: def.R, k: 3, grenade: true });
            a.cd = def.rate;
            a.atk = 0.3;
          } else if (a.cd <= 0) {
            const sp = def.shotSpeed;
            this.ashots.push({ x: a.x + Math.cos(a.aim) * 10, y: cy + Math.sin(a.aim) * 10, vx: Math.cos(a.aim) * sp, vy: Math.sin(a.aim) * sp, dmg: def.dmg, life: def.range / sp + 0.1, k: def.gun === 'plasma' ? 2 : 1, pierce: def.pierce || 0, hit: [] });
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
      if (s.grenade) {
        s.t += dt;
        const p = Math.min(1, s.t / s.dur);
        s.x = s.sx + (s.tx - s.sx) * p;
        s.y = s.sy + (s.ty - s.sy) * p - Math.sin(p * Math.PI) * 18; // the arc
        if (p < 1) return true;
        for (const m of this.monsters) {
          if (m.state === 'dead') continue;
          const sc = MONSTERS[m.type].scale || 1;
          const ox = (m.x - s.tx) / (s.R + 6 * sc);
          const oy = (m.y - 6 * sc - s.ty) / ((s.R + 6 * sc) * 0.8);
          if (ox * ox + oy * oy <= 1) this.hitMonster(m.id, s.dmg, s.tx, s.ty, 150, true, 'ally');
        }
        this.emit({ type: 'boom', x: Math.round(s.tx), y: Math.round(s.ty), R: s.R });
        return false;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      for (const m of this.monsters) {
        if (m.state === 'dead') continue;
        const sc = MONSTERS[m.type].scale || 1;
        const ox = (s.x - m.x) / (7 * sc + 2);
        const oy = (s.y - (m.y - 8 * sc)) / (9 * sc + 2);
        if (ox * ox + oy * oy < 1) {
          if (s.hit?.includes(m.id)) continue; // a plasma bolt that went through this one already
          this.hitMonster(m.id, s.dmg, s.x - s.vx, s.y - s.vy, 60, true, 'ally');
          if (s.pierce > 0) {
            s.pierce--;
            s.hit.push(m.id);
            continue;
          }
          return false;
        }
      }
      return s.life > 0;
    });
  }

  // ---------- starting the next wave ----------

  setStartMode(mode) {
    if (['timer', 'vote', 'manual', 'instant'].includes(mode)) this.startMode = mode;
  }

  votesNeeded() {
    return Math.floor(this.g.waveTargets().length / 2) + 1;
  }

  // The V key (or the Start button). Vote: it toggles your vote. Manual: the host starts the wave. Returns what happened.
  pressStart(id) {
    if (this.phase !== 'prep' || this.endless) return null;
    if (this.startMode === 'vote') {
      if (this.votes.has(id)) this.votes.delete(id);
      else this.votes.add(id);
      return 'voted';
    }
    if (this.startMode === 'manual' && id === (this.g.mp?.you ?? 0) && (!this.g.mp || this.g.hostId === this.g.mp.you)) {
      this.startWave();
      return 'started';
    }
    if (this.startMode === 'manual') return 'host-only';
    return null;
  }

  // the host changed how many waves the run lasts (0 = endless): it applies from the next wave on
  setWaves(n) {
    const k = Math.round(Number(n));
    if (!Number.isFinite(k) || k < 0 || k > 99) return;
    this.endless = !!this.g.world.endless || k === 0;
    if (k > 0) this.total = k;
    if (this.endless && this.phase === 'fight' && !this.queue.length) this.fightT = Math.max(this.fightT, 0);
  }

  // ---------- air support (bought in the shop) ----------

  // 'carpet': a helicopter sweeps across the whole map and drops bombs along its path. 'gunship': a chopper circles the shelter
  // for a minute, firing its machine gun at the zombies. They can be bought any time, as many as you like (a few at once is plenty).
  callAir(kind) {
    if (this.phase === 'victory' || this.phase === 'defeat' || this.airs.length >= MAX_AIR || this.airUsed >= MAX_AIR_PER_WAVE) return false;
    const c = this.center;
    if (kind === 'carpet') {
      const ang = Math.random() * Math.PI * 2;
      this.airs.push({ kind, t: 0, dur: 5.6, ang, x: c.x - Math.cos(ang) * 460, y: c.y - Math.sin(ang) * 460, dropT: 0.4 });
    } else if (kind === 'gunship') {
      this.airs.push({ kind, t: 0, dur: 60, ang: Math.random() * Math.PI * 2, x: c.x, y: c.y, fireT: 0.5, firing: false });
    } else return false;
    this.airUsed++;
    this.emit({ type: 'air', kind });
    return true;
  }

  updateAir(dt) {
    if (this.airs.length) this.airs = this.airs.filter((a) => this.updateOneAir(a, dt));
  }

  // (false once it has flown its time)
  updateOneAir(a, dt) {
    a.t += dt;
    const c = this.center;
    if (a.kind === 'carpet') {
      const sp = 920 / a.dur;
      a.x += Math.cos(a.ang) * sp * dt;
      a.y += Math.sin(a.ang) * sp * dt;
      a.dropT -= dt;
      while (a.dropT <= 0) {
        // a bomb, a little to either side of the line, that lands a moment later
        a.dropT += 0.14;
        const side = (Math.random() - 0.5) * 120;
        this.airBombs.push({ x: a.x + Math.cos(a.ang) * 60 - Math.sin(a.ang) * side, y: a.y + Math.sin(a.ang) * 60 + Math.cos(a.ang) * side, fall: 0.9, R: 34 });
      }
    } else {
      // the gunship circles the shelter, a little wide, and shoots whatever walks into range
      a.ang += 0.55 * dt;
      a.x = c.x + Math.cos(a.ang) * 130;
      a.y = c.y + Math.sin(a.ang) * 80;
      a.fireT -= dt;
      a.firing = false;
      if (a.fireT <= 0) {
        let target = null;
        let td = 240;
        for (const m of this.monsters) {
          if (m.state === 'dead') continue;
          const d = Math.hypot(m.x - a.x, m.y - a.y);
          if (d < td) {
            td = d;
            target = m;
          }
        }
        if (target) {
          a.firing = true;
          a.fireT = 0.09;
          const ang = Math.atan2(target.y - 8 - a.y, target.x - a.x) + (Math.random() - 0.5) * 0.1;
          this.ashots.push({ x: a.x, y: a.y, vx: Math.cos(ang) * 330, vy: Math.sin(ang) * 330, dmg: 1.3, life: td / 330 + 0.1, k: 1, pierce: 0, hit: [] });
        } else a.fireT = 0.25;
      }
    }
    return a.t < a.dur;
  }

  updateAirBombs(dt) {
    if (!this.airBombs?.length) return;
    this.airBombs = this.airBombs.filter((b) => {
      b.fall -= dt;
      if (b.fall > 0) return true;
      for (const m of this.monsters) {
        if (m.state === 'dead') continue;
        const ox = (m.x - b.x) / (b.R + 6);
        const oy = (m.y - 6 - b.y) / ((b.R + 6) * 0.8);
        if (ox * ox + oy * oy <= 1) this.hitMonster(m.id, MONSTERS[m.type].boss ? 14 : 18, b.x, b.y, 180, true, 'ally');
      }
      this.emit({ type: 'boom', x: Math.round(b.x), y: Math.round(b.y), R: b.R });
      return false;
    });
  }

  // Survival's shelter: one more level of self-repair, or a repair kit that heals a chunk of it now (anyone can, everyone benefits)
  upgradeMend() {
    this.mendLevel = (this.mendLevel || 0) + 1;
    this.emit({ type: 'mended', what: 'level', level: this.mendLevel });
    return true;
  }

  repairShelter(share) {
    if (this.baseHp >= this.baseMax) return false;
    this.baseHp = Math.min(this.baseMax, this.baseHp + this.baseMax * share);
    this.emit({ type: 'mended', what: 'heal' });
    return true;
  }

  // the base can be made tougher by anyone, and everyone benefits
  upgradeBase() {
    if (this.baseLevel >= MAX_LEVEL && this.theme !== 'apoc') return false; // (Survival's shelter can be upgraded for ever)
    this.baseLevel++;
    const before = this.baseMax;
    this.baseMax = Math.round(this.diff.baseHp * (1 + 0.3 * this.baseLevel));
    this.baseHp += this.baseMax - before;
    this.emit({ type: 'upgrade', what: 'house', level: this.baseLevel });
    return true;
  }

  // the shelter's lamps are shared: whoever buys the next level lights them for everyone
  setLight(level) {
    this.lightLevel = Math.max(this.lightLevel || 0, Math.min(MAX_LEVEL, Math.round(Number(level)) || 0));
  }

  // messages from guests
  onMessage(k, d, from) {
    if (k === 'hit') this.hitMonster(d.id, d.dmg, d.fx, d.fy, d.kb, false, from);
    else if (k === 'power') this.power(d.kind, from);
    else if (k === 'light') this.setLight(d.lvl);
    else if (k === 'vote') this.pressStart(from);
    else if (k === 'repair') this.g.mp?.net.send({ t: 'w', to: from, k: 'ack', d: { op: 'repair', placed: this.repairAll(), asked: Math.max(0, Math.min(200, Number(d.n) || 0)) } });
    else if (k === 'place') this.g.mp?.net.send({ t: 'w', to: from, k: 'ack', d: { op: 'place', ok: this.placeBarricade(d.x, d.y, d.v) } });
    else if (k === 'pick') this.g.mp?.net.send({ t: 'w', to: from, k: 'ack', d: { op: 'pick', ok: this.pickBarricade(d.id) } });
    else if (k === 'recruit') this.g.mp?.net.send({ t: 'w', to: from, k: 'ack', d: { op: 'recruit', ok: ALLY_KINDS.includes(d.kind) && this.recruit(d.kind), cost: ALLIES[d.kind]?.cost } });
    else if (k === 'upg') this.g.mp?.net.send({ t: 'w', to: from, k: 'ack', d: { op: 'upg', ok: this.upgradeBase() } });
    else if (k === 'mend') this.g.mp?.net.send({ t: 'w', to: from, k: 'ack', d: { op: d.what === 'heal' ? 'mendHeal' : 'mendUp', ok: d.what === 'heal' ? this.repairShelter(0.3) : this.upgradeMend() } });
    else if (k === 'air') this.g.mp?.net.send({ t: 'w', to: from, k: 'ack', d: { op: 'air', ok: this.callAir(d.kind) } });
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
      s: this.shots.map((s) => [Math.round(s.x), Math.round(s.y), s.bolt ? 5 : s.arrow ? 1 + s.arrow : s.spit ? 1 : 0, Math.round(Math.atan2(s.vy, s.vx) * 100)]),
      a: this.allies.map((a) => [a.id, ALLY_KINDS.indexOf(a.kind), Math.round(a.x * 10) / 10, Math.round(a.y * 10) / 10, a.dir, a.moving ? 1 : 0, a.atk > 0 ? 1 : 0]),
      as: this.ashots.map((s) => [Math.round(s.x), Math.round(s.y), s.k || 0, Math.round(Math.atan2(s.vy, s.vx) * 100)]),
      bl: this.baseLevel,
      sl: this.lightLevel || 0,
      ml: this.mendLevel || 0,
      ar: this.airs.map((a) => [a.kind === 'carpet' ? 1 : 2, Math.round(a.x * 10) / 10, Math.round(a.y * 10) / 10, Math.round(a.ang * 100) / 100, a.firing ? 1 : 0, Math.round(a.t * 10) / 10]),
      ab: (this.airBombs || []).map((b) => [Math.round(b.x), Math.round(b.y), Math.round(b.fall * 100) / 100, b.R]),
      au: this.airUsed || 0,
      el: Math.round(this.elapsed),
      sm: this.startMode,
      tw: this.endless ? 0 : this.total,
      vl: [...this.votes],
      vn: this.votesNeeded(),
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
    this.lightLevel = 0;
    this.mendLevel = 0;
    this.airs = []; // the air strikes in the sky: { kind, x, y, tx, ty, ang, firing }
    this.airBombs = [];
    this.endless = !!game.world.endless || game.waveCount === 0;
    this.total = game.waveCount > 0 ? game.waveCount : TOTAL_WAVES;
    this.elapsed = 0;
    this.startMode = 'timer';
    this.voteList = [];
    this.votesNeeded = 1;
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
      coming: this.phase === 'prep' && nextWave <= this.total && !this.endless ? waveCounts(nextWave, this.diff, this.theme, 1 + this.g.remotes.size, this.total) : null,
      queued,
      waveTotal,
      queuedBy: this.phase === 'fight' ? queuedBy : null,
    };
  }

  hudState() {
    const boss = this.monsters.find((m) => MONSTERS[m.type].boss && m.state !== 'dead');
    return {
      wave: this.wave,
      total: this.endless ? Infinity : this.total,
      endless: this.endless,
      elapsed: Math.floor(this.elapsed),
      startMode: this.endless ? 'timer' : this.startMode,
      votes: this.voteList.length,
      votesNeeded: this.votesNeeded,
      voted: this.voteList.includes(this.g.mp?.you),
      phase: this.phase,
      timer: Math.max(0, this.timer),
      left: this.left,
      baseHp: Math.max(0, this.baseHp),
      baseMax: this.baseMax,
      baseLevel: this.baseLevel,
      allies: this.allies.length,
      teamCap: teamCap(this.baseLevel),
      mendLevel: this.mendLevel || 0,
      air: this.airs.length,
      airUsed: this.airUsed || 0,
      airMax: MAX_AIR_PER_WAVE,
      wrecks: this.wrecks.length,
      kills: { ...this.kills },
      boss: boss ? { hp: boss.hp, max: boss.max, name: MONSTERS[boss.type].name } : null,
      ...this.forecast(this.qn || 0, this.wt || 0, this.qb || []),
    };
  }

  update(dt) {
    const k = 1 - Math.exp(-dt * 14);
    this.timer -= dt;
    this.elapsed += dt;
    for (const a of this.airs) {
      if (a.tx === undefined) continue;
      a.x += (a.tx - a.x) * k;
      a.y += (a.ty - a.y) * k;
    }
    for (const b of this.airBombs) b.fall -= dt;
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
    this.shots = s.s.map(([x, y, k, ang]) => ({ x, y, spit: k === 1, arrow: k >= 2 && k <= 4 ? k - 1 : 0, bolt: k === 5, ang: (ang || 0) / 100 }));
    const oldAllies = new Map(this.allies.map((a) => [a.id, a]));
    this.allies = (s.a || []).map(([id, ki, x, y, dir, moving, atk]) => {
      const a = oldAllies.get(id) || { id, x, y, anim: Math.random() * 3 };
      Object.assign(a, { kind: ALLY_KINDS[ki], tx: x, ty: y, dir, moving: !!moving, atk: atk ? 0.25 : a.atk || 0 });
      return a;
    });
    this.ashots = (s.as || []).map(([x, y, k, ang]) => ({ x, y, k: k || 0, ang: (ang || 0) / 100 }));
    this.baseLevel = s.bl || 0;
    this.lightLevel = s.sl || 0;
    this.mendLevel = s.ml || 0;
    const sky = Array.isArray(s.ar) && Array.isArray(s.ar[0]) ? s.ar : [];
    this.airs.length = Math.min(this.airs.length, sky.length);
    sky.forEach(([k, x, y, ang, firing], i) => {
      if (!this.airs[i]) this.airs[i] = { x, y };
      Object.assign(this.airs[i], { kind: k === 1 ? 'carpet' : 'gunship', tx: x, ty: y, ang, firing: !!firing });
    });
    this.airBombs = (s.ab || []).map(([x, y, fall, R]) => ({ x, y, fall, R }));
    this.airUsed = s.au || 0;
    this.elapsed = s.el || 0;
    this.startMode = s.sm || 'timer';
    if (s.tw !== undefined) {
      this.endless = !!this.g.world.endless || s.tw === 0;
      if (s.tw > 0) this.total = s.tw;
    }
    this.voteList = s.vl || [];
    this.votesNeeded = s.vn || 1;
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

  setStartMode(mode) {
    if (['timer', 'vote', 'manual', 'instant'].includes(mode)) this.startMode = mode; // (the host's sim is the one that acts on it)
  }

  // a guest asks the host for a repair or an air strike; the answer comes back as an ack
  upgradeMend() {
    this.g.mp?.net.send({ t: 'w', to: 'host', k: 'mend', d: { what: 'level' } });
    return 'pending';
  }

  repairShelter() {
    this.g.mp?.net.send({ t: 'w', to: 'host', k: 'mend', d: { what: 'heal' } });
    return 'pending';
  }

  callAir(kind) {
    this.g.mp?.net.send({ t: 'w', to: 'host', k: 'air', d: { kind } });
    return 'pending';
  }

  setWaves() {} // (the host's sim decides, and the snapshots say)

  // V: vote for the next wave (the host decides when it is "manual")
  pressStart() {
    if (this.phase !== 'prep' || this.endless) return null;
    if (this.startMode === 'vote') {
      this.g.mp?.net.send({ t: 'w', to: 'host', k: 'vote', d: {} });
      return 'voted';
    }
    return this.startMode === 'manual' ? 'host-only' : null;
  }

  // a level of the shelter's lamps bought here: tell the host once, and it tells everyone
  setLight(level) {
    if (level > (this.lightSent || 0)) {
      this.lightSent = level;
      this.g.mp?.net.send({ t: 'w', to: 'host', k: 'light', d: { lvl: level } });
    }
    this.lightLevel = Math.max(this.lightLevel || 0, level);
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
