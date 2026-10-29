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
const SYNC_EVERY = 0.35; // seconds between updates from whoever is moving a ball

export const hasBalls = (world) => !world.apoc && !world.waveMode && (SEA_MAPS.includes(world.tileset) || world.mixed);

export class Balls {
  constructor(game) {
    this.g = game;
    this.list = [];
    this.syncT = 0;
    this.touchT = 0;
    this.mine = new Set(); // the balls this player kicked last (and so keeps everyone up to date on)
    this.spawn();
  }

  // the same two places for everyone in the room: found by searching around the starting point with the world's seed
  spawn() {
    const { world, home } = this.g;
    if (!hasBalls(world)) return;
    const baseX = home.x;
    const baseY = home.y;
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

  // another player's kick: take their word for where the ball is and how it moves
  adopt(m) {
    const b = this.list.find((x) => x.i === m.i);
    if (!b) return;
    Object.assign(b, { x: m.x, y: m.y, vx: m.vx, vy: m.vy, z: m.z, vz: m.vz });
    this.mine.delete(b.i);
  }

  send(b) {
    this.g.mp?.net.send({ t: 'fx', kind: 'ball', i: b.i, x: b.x, y: b.y, vx: b.vx, vy: b.vy, z: b.z, vz: b.vz });
  }

  update(dt) {
    const g = this.g;
    const p = g.player;
    this.touchT = Math.max(0, this.touchT - dt);
    this.syncT -= dt;
    for (const b of this.list) {
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
        if (d < R + 7) {
          const nx = d > 0.5 ? dx / d : 1;
          const ny = d > 0.5 ? dy / d : 0;
          const dashing = !!g.combat?.dash;
          let power = (g.sprinting ? 190 : p.moving ? 150 : 90) + (dashing ? 120 : 0);
          if (wet) power = Math.min(power * 0.3, 34); // a slow nudge: swim after it and push it out
          b.vx = nx * power;
          b.vy = ny * power;
          b.vz = wet ? 0 : 95 + (dashing ? 40 : 0);
          b.z = wet ? 0 : Math.max(b.z, 1);
          this.touchT = 0.18;
          this.mine.add(b.i);
          this.send(b);
          this.syncT = SYNC_EVERY;
          sfx.play('pickup', 0.5);
        }
      }
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
    const x = Math.round(b.x);
    const y = Math.round(b.y);
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
