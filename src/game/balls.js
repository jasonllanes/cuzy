import { hash2 } from './rng';
import { T, WATER } from './world';
import { sfx } from './sfx';

// Beach balls: two of them lie around on the maps with a sea (Sunny Shores, Tidal Isles, Emerald Isles and the patchwork
// map). Walk, run or dash into one and it bounces away. Everyone in a room can kick them: whoever touches a ball
// last tells the others where it is going, and each game carries on the flight by itself.

const SEA_MAPS = ['beach', 'tidal', 'emerald'];
const COUNT = 2;
const R = 6; // radius of the ball, for bumping into things
const FRICTION = 0.9; // per second, on the ground: it rolls a good while
const GRAVITY = 260;
const SYNC_EVERY = 0.2;
const LAG = 0.07; // seconds a ball update takes to arrive, about // seconds between updates from whoever is moving a ball

export const hasBalls = (world) => !world.apoc && !world.waveMode && (!world.arena || world.pitch); // (every Free Roam map, and the Beach Ball pitch)

export class Balls {
  constructor(game) {
    this.g = game;
    this.list = [];
    this.syncT = 0;
    this.touchT = 0;
    this.kickAge = 9; // seconds since this player last kicked a ball (and which one)
    this.kickBall = -1;
    this.mine = new Set(); // the balls this player kicked last (and so keeps everyone up to date on)
    this.spawn();
  }

  // the same two places for everyone in the room: found by searching around the starting point with the world's seed
  spawn() {
    const { world, home } = this.g;
    if (!hasBalls(world)) return;
    if (world.pitch) {
      // the match ball: in the middle of the pitch
      this.list.push({ i: 0, x: 8, y: 8, vx: 0, vy: 0, z: 0, vz: 0, spin: 0, match: true });
      return;
    }
    // (everyone in the room starts from the same place: the house nearest the middle of the world, not their own)
    const first = world.houseList()[0];
    const anchor = first ? world.homePoint(first) : { x: home.x, y: home.y };
    const baseX = anchor.x;
    const baseY = anchor.y;
    for (let i = 0; i < COUNT; i++) {
      for (let tries = 0; tries < 80; tries++) {
        const a = hash2(i, tries, world.seed + 6101) * Math.PI * 2;
        const d = 50 + hash2(i, tries, world.seed + 6102) * 150 + tries * 3;
        const x = baseX + Math.cos(a) * d;
        const y = baseY + Math.sin(a) * d;
        const t = world.type(Math.floor(x / T), Math.floor(y / T));
        if (t === WATER || world.isBlocked(x - R, y - R, R * 2, R * 2, true)) continue;
        this.list.push({ i, x, y, vx: 0, vy: 0, z: 0, vz: 0, spin: 0 });
        break;
      }
    }
  }

  // who touches a ball is remembered (`by`): a goal only counts for the team of whoever touched it last
  myId() {
    return String(this.g.mp?.you ?? 'me');
  }

  // another player's kick: take their word for where the ball is and how it moves
  adopt(m) {
    const b = this.list.find((x) => x.i === m.i);
    if (!b) return;
    // a "lying still" report from the host must not undo a ball that is moving here or was just kicked (it was sent before the kick arrived)
    const still = Math.hypot(m.vx, m.vy) < 4 && !m.z;
    const kickoff = this.g.world.pitch && m.x === 8 && m.y === 8; // (the reset to the middle after a goal always counts)
    if (still && !kickoff && (Math.hypot(b.vx, b.vy) > 4 || b.z > 0 || (this.g.t || 0) - (b.adoptT ?? -9) < 1.2 || this.mine.has(b.i))) return;
    const ox = b.x, oy = b.y;
    if (this.kickAge < 0.5 && this.kickBall === b.i) {
      // two players kicked it at nearly the same moment: the same rule on both games decides whose kick stands (the lower id), so the ball
      // does not ping-pong between the two views (that was the ball jumping over to the other team)
      if (this.myId() < String(m.id ?? '')) return; // mine stands; they will adopt it from my next update
    }
    b.by = m.by !== undefined && m.by !== null ? String(m.by) : m.id !== undefined ? String(m.id) : b.by;
    b.adoptT = this.g.t || 0;
    Object.assign(b, { x: m.x, y: m.y, vx: m.vx, vy: m.vy, z: m.z, vz: m.vz });
    this.mine.delete(b.i);
    this.touchT = Math.max(this.touchT, 0.15);
    // the update took a moment to arrive: carry the ball on a little way, as it has moved since
    const lag = LAG;
    const lx = b.x + b.vx * lag, ly = b.y + b.vy * lag;
    if (!this.g.world.isBlocked(lx - R, ly - R, R * 2, R * 2, true, true)) { b.x = lx; b.y = ly; }
    b.z = Math.max(0, b.z + b.vz * lag);
    // instead of jumping to the new place, the picture glides there (a big jump, like a kickoff, still snaps)
    const ex = ox - b.x, ey = oy - b.y;
    if (Math.hypot(ex, ey) < 40) { b.ox = (b.ox || 0) + ex; b.oy = (b.oy || 0) + ey; } else { b.ox = 0; b.oy = 0; }
  }

  // something other than a footstep hits a ball (a sword, a thrown item): it flies off the way the hit was going
  hit(b, dx, dy, power, who = null) {
    b.by = who !== null ? String(who) : this.myId();
    const d = Math.hypot(dx, dy) || 1;
    const wet = this.g.world.type(Math.floor(b.x / T), Math.floor(b.y / T)) === WATER;
    const k = wet ? Math.min(power, 120) : power;
    b.vx = (dx / d) * k;
    b.vy = (dy / d) * k;
    b.vz = wet ? 0 : 90;
    b.z = wet ? 0 : Math.max(b.z, 1);
    this.kickAge = 0;
    this.kickBall = b.i;
    this.mine.add(b.i);
    this.send(b);
    this.syncT = SYNC_EVERY;
    sfx.play('pickup', 0.5);
  }

  send(b) {
    this.g.mp?.net.send({ t: 'fx', kind: 'ball', i: b.i, x: b.x, y: b.y, vx: b.vx, vy: b.vy, z: b.z, vz: b.vz, by: b.by });
  }

  update(dt) {
    const g = this.g;
    const p = g.player;
    this.touchT = Math.max(0, this.touchT - dt);
    this.kickAge += dt;
    this.syncT -= dt;
    const glide = Math.exp(-dt * 12);
    for (const b of this.list) {
      if (b.ox || b.oy) { b.ox *= glide; b.oy *= glide; if (Math.abs(b.ox) < 0.05 && Math.abs(b.oy) < 0.05) b.ox = b.oy = 0; }
      // in water or lava the ball floats: it loses its hop at once and rolls on ever more slowly until it stops
      const wet = g.world.type(Math.floor(b.x / T), Math.floor(b.y / T)) === WATER;
      if (wet) {
        b.z = 0;
        b.vz = 0;
        const k = Math.exp(-dt * 3);
        b.vx *= k;
        b.vy *= k;
        const sp = Math.hypot(b.vx, b.vy);
        if (sp > 35) {
          b.vx *= 35 / sp;
          b.vy *= 35 / sp;
        }
      }
      // flight: along the ground, with a hop that comes down and bounces smaller each time
      const speed = Math.hypot(b.vx, b.vy);
      if (speed > 1 || b.z > 0 || b.vz) {
        const nx = b.x + b.vx * dt;
        if (g.world.isBlocked(nx - R, b.y - R, R * 2, R * 2, true, true)) {
          b.vx *= -0.8;
          if (!wet) sfx.play('thud', 0.35);
        } else b.x = nx;
        const ny = b.y + b.vy * dt;
        if (g.world.isBlocked(b.x - R, ny - R, R * 2, R * 2, true, true)) {
          b.vy *= -0.8;
          sfx.play('thud', 0.35);
        } else b.y = ny;
        b.vz -= GRAVITY * dt;
        b.z += b.vz * dt;
        if (b.z <= 0) {
          b.z = 0;
          if (b.vz < -40) {
            b.vz *= -0.55; // bounce
            sfx.play('thud', 0.2);
          } else b.vz = 0;
        }
        if (!wet) {
          const k = b.z > 0 ? 1 : Math.pow(FRICTION, dt * 3);
          b.vx *= k;
          b.vy *= k;
        }
        b.spin += (b.vx > 0 ? 1 : -1) * Math.min(14, speed / 12) * dt;
        if (Math.hypot(b.vx, b.vy) < 4) {
          b.vx = 0;
          b.vy = 0;
        }
      }
      // you run into it
      if (!g.inside && !g.dungeon && !g.dead && this.touchT <= 0) {
        const dx = b.x - p.x;
        const dy = b.y - (p.y - 4);
        const d = Math.hypot(dx, dy);
        // (a ball that is already leaving this player fast is not kicked again: nothing to send)
        const away = d > 0.5 ? (b.vx * dx + b.vy * dy) / d : 0;
        if (d < R + 7 && away < 110) {
          const nx = d > 0.5 ? dx / d : 1;
          const ny = d > 0.5 ? dy / d : 0;
          const dashing = !!g.combat?.dash;
          let power = (g.sprinting ? 190 : p.moving ? 150 : 90) + (dashing ? 120 : 0);
          if (wet) power = Math.min(power * 0.3, 34); // a slow nudge: swim after it and push it out
          b.vx = nx * power;
          b.vy = ny * power;
          b.vz = wet ? 0 : 95 + (dashing ? 40 : 0);
          b.z = wet ? 0 : Math.max(b.z, 1);
          this.touchT = 0.25;
          this.kickAge = 0;
          this.kickBall = b.i;
          b.by = this.myId();
          this.mine.add(b.i);
          this.send(b);
          this.syncT = SYNC_EVERY;
          sfx.play('pickup', 0.5);
        }
      }
    }
    // Beach Ball match: the host's game sees the ball roll into a goal, tells the room, and puts the ball back in the middle
    if (g.world.pitch) {
      this.goalLock = Math.max(0, (this.goalLock || 0) - dt);
      if (this.kickoffT > 0 && (this.kickoffT -= dt) <= 0) {
        for (const b of this.list) Object.assign(b, { x: 8, y: 8, vx: 0, vy: 0, z: 0, vz: 0, by: undefined });
        this.mine.add(0);
        this.send(this.list[0]);
        this.syncT = SYNC_EVERY;
      }
      if (g.mp && g.hostId === g.mp.you && !this.goalLock) {
        for (const b of this.list) {
          const side = g.world.goalSide(b.x, b.y);
          if (side < 0) continue;
          this.goalLock = 4;
          this.kickoffT = 2.6;
          // (the ball in the left goal: the right team could score; in a Rumble it is whichever team's goal it is) and who touched it last, because only their team can score
          g.mp.net.send({ t: 'goal', team: side === 0 ? 1 : 0, by: b.by, ...(g.world.rumble ? { conceded: side } : {}) });
        }
      }
    }
    // the host now and then tells everyone where the balls lie at rest (so a player who joined late sees them where they are)
    this.restT = (this.restT ?? 3) - dt;
    if (this.restT <= 0) {
      this.restT = 3;
      if (g.mp && g.hostId === g.mp.you) for (const b of this.list) if (!this.mine.has(b.i) && Math.hypot(b.vx, b.vy) < 4 && b.z === 0) this.send(b);
    }
    // keep the others in step with a ball you are still moving
    if (this.syncT <= 0 && this.mine.size) {
      this.syncT = SYNC_EVERY;
      for (const b of this.list) {
        if (!this.mine.has(b.i)) continue;
        this.send(b);
        if (Math.hypot(b.vx, b.vy) < 4 && b.z === 0) this.mine.delete(b.i);
      }
    }
  }

  collect(list) {
    for (const b of this.list) list.push({ kind: 'ball', b, y: b.y + 1 });
  }

  draw(ctx, img, b) {
    const sheet = img['props/beach_ball'];
    const x = Math.round(b.x + (b.ox || 0));
    const y = Math.round(b.y + (b.oy || 0));
    // its shadow stays on the ground and shrinks as the ball goes up
    const s = Math.max(0.5, 1 - b.z / 40);
    ctx.fillStyle = 'rgba(40,40,30,0.25)';
    ctx.beginPath();
    ctx.ellipse(x, y + 1, 6 * s, 2.4 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    if (!sheet) return;
    ctx.save();
    ctx.translate(x, y - 7 - b.z);
    ctx.rotate(b.spin);
    ctx.drawImage(sheet, -sheet.width / 4, -sheet.height / 4, sheet.width / 2, sheet.height / 2); // (the art is drawn double size)
    ctx.restore();
  }
}
