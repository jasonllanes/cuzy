import { RETRO_COUNT, heroById, retroId } from './heroes';
import { T, WATER } from './world';
import { sfx } from './sfx';
import { splatTone } from './combat';

// Solo "vs AI": computer-controlled rivals. They live in `game.remotes` (flagged `bot`) so they are drawn,
// aimed at, hit and chased exactly like another player's hero, and fight each other as well as you.

const TARGET_KILLS = 10;
const NAMES = ['Biscuit', 'Maple', 'Pebble', 'Clover', 'Nutmeg', 'Sprout', 'Waffle', 'Juniper'];
const WATER_SLOWDOWN = 0.4;
const SIGHT = 170;
const MELEE_REACH = 24;
const RESPAWN = 4;

// per difficulty: speed (px/s), seconds between sword swings, seconds between throws, sight multiplier
const SKILL = {
  easy: { speed: 40, swing: 1.3, throw: 4.2, sight: 0.7 },
  medium: { speed: 52, swing: 0.9, throw: 3, sight: 1 },
  hard: { speed: 62, swing: 0.6, throw: 1.9, sight: 1.3 },
};

export const MAX_BOTS = 8;

export class Bots {
  constructor(game, count, difficulty = 'medium') {
    this.g = game;
    this.skill = SKILL[difficulty] || SKILL.medium;
    this.shots = [];
    this.list = [];
    this.kills = { me: 0 };
    this.target = TARGET_KILLS;
    const sites = game.world.houseList();
    const mine = game.home;
    const homes = sites
      .map((s) => game.world.homePoint(s))
      .filter((p) => Math.hypot(p.x - mine.x, p.y - mine.y) > 24)
      .sort((a, b) => Math.hypot(a.x - mine.x, a.y - mine.y) - Math.hypot(b.x - mine.x, b.y - mine.y));
    // a shuffled handful of the retro heroes, never the one you picked
    const pool = Array.from({ length: RETRO_COUNT }, (_, i) => retroId(i + 1)).filter((id) => id !== game.hero.id);
    pool.sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(MAX_BOTS, count); i++) {
      const home = homes[i] || game.world.randomSpawn();
      const id = `bot${i}`;
      const bot = {
        id,
        bot: true,
        name: NAMES[i % NAMES.length],
        hero: heroById(pool[i % pool.length]),
        home,
        x: home.x,
        y: home.y,
        tx: home.x,
        ty: home.y,
        dir: 'down',
        moving: false,
        hp: 6,
        hidden: false,
        shield: 0,
        animT: Math.random() * 3,
        bubble: null,
        swing: null,
        color: (i + 1) % 10,
        // ai state
        down: 0,
        swingCd: 1 + Math.random(),
        throwCd: 2 + Math.random() * 2,
        thinkT: 0,
        goal: null,
        wander: { a: Math.random() * 6.28, t: 0 },
        stuck: 0,
        side: 0,
        lx: home.x,
        ly: home.y,
      };
      this.list.push(bot);
      this.kills[id] = 0;
      game.remotes.set(id, bot);
    }
  }

  scoreboard() {
    return {
      target: this.target,
      scores: [{ id: 'me', name: this.g.name || 'You', kills: this.kills.me, me: true }, ...this.list.map((b) => ({ id: b.id, name: b.name, kills: this.kills[b.id] }))],
    };
  }

  nameOf(id) {
    return id === 'me' ? this.g.name || 'You' : this.list.find((b) => b.id === id)?.name || 'Someone';
  }

  // ---------- scoring ----------

  // `id` scored on `victim` (both 'me' or a bot id)
  credit(id, victim) {
    if (this.g.celeb) return; // the round is already won
    this.g.streaks.kill(id, victim, { killer: this.nameOf(id), victim: this.nameOf(victim) }, id === 'me');
    this.kills[id] = (this.kills[id] || 0) + 1;
    if (this.kills[id] >= this.target && this.g.winBy !== 'monsters') {
      sfx.play(id === 'me' ? 'win' : 'wave');
      // cheer the winner for a few seconds, then everyone is back at their doors for a fresh round
      this.g.celebrate(id, this.nameOf(id), 6, 'Heading to your room in a moment…', () => {
        this.reset();
        this.g.onRoundWon?.();
      });
    }
  }

  reset() {
    this.g.streaks.reset();
    for (const k of Object.keys(this.kills)) this.kills[k] = 0;
    this.shots = [];
    for (const b of this.list) this.respawn(b);
  }

  respawn(b) {
    b.x = b.tx = b.home.x;
    b.y = b.ty = b.home.y;
    b.hp = 6;
    b.down = 0;
    b.hidden = false;
    b.goal = null;
  }

  // ---------- damage ----------

  // `by` is 'me' or another bot's id
  hurt(b, dmg, by, fromX, fromY) {
    if (b.down > 0 || b.hp <= 0 || b.inv > 0) return;
    const c = this.g.combat;
    b.inv = 0.35;
    b.hp -= dmg;
    c.splat(b.x, b.y, c.hitColor, b.hp <= 0 ? 2 : 1, fromX, fromY);
    c.floaters.push({ x: b.x, y: b.y - 30, text: `-${Math.round(dmg * 10) / 10}`, color: '#ff7a8f', t: 0 });
    const ang = Math.atan2(b.y - fromY, b.x - fromX);
    for (let i = 0; i < 5; i++) this.step(b, Math.cos(ang) * 2, Math.sin(ang) * 2);
    if (b.hp <= 0) {
      b.hp = 0;
      b.down = RESPAWN;
      b.hidden = true;
      b.moving = false;
      this.g.dropKillLoot(b.x, b.y);
      sfx.play(by === 'me' ? 'kill' : 'monsterDie', 0.7);
      this.credit(by, b.id);
      if (by === 'me') {
        c.kills++;
        this.g.addXp(35);
      }
    }
  }

  hurtMe(b, dmg, fromX, fromY) {
    if (this.g.dead) return;
    this.g.combat.hurtPlayer(dmg, fromX, fromY, { invuln: 0.6, by: { kind: 'player', id: b.id, name: b.name } });
  }

  // ---------- movement ----------

  step(b, dx, dy) {
    const g = this.g;
    if (!g.blocked(b.x + dx, b.y, 'bot')) b.x += dx;
    if (!g.blocked(b.x, b.y + dy, 'bot')) b.y += dy;
    b.tx = b.x;
    b.ty = b.y;
  }

  // ---------- thinking ----------

  pickGoal(b) {
    const g = this.g;
    const sight = SIGHT * this.skill.sight;
    let best = null;
    let bd = sight;
    if (!g.dead && !g.combat.hidden) {
      const d = Math.hypot(g.player.x - b.x, g.player.y - b.y);
      if (d < bd) {
        best = { kind: 'me', x: g.player.x, y: g.player.y };
        bd = d;
      }
    }
    for (const o of this.list) {
      if (o === b || o.down > 0) continue;
      const d = Math.hypot(o.x - b.x, o.y - b.y);
      if (d < bd) {
        best = { kind: 'bot', o, x: o.x, y: o.y };
        bd = d;
      }
    }
    return best;
  }

  updateBot(b, dt) {
    const g = this.g;
    const sk = this.skill;
    b.animT += dt;
    if (b.swing && (b.swing.t += dt) > 0.24) b.swing = null;
    if (b.inv > 0) b.inv -= dt;
    if (b.down > 0) {
      b.down -= dt;
      if (b.down <= 0) this.respawn(b);
      return;
    }
    b.swingCd -= dt;
    b.throwCd -= dt;
    b.thinkT -= dt;
    if (b.thinkT <= 0) {
      b.thinkT = 0.35;
      b.goal = this.pickGoal(b);
    }
    let goal = b.goal;
    if (goal) {
      // keep the aim fresh between thoughts
      if (goal.kind === 'me') {
        goal.x = g.player.x;
        goal.y = g.player.y;
        if (g.dead || g.combat.hidden) goal = b.goal = null;
      } else if (goal.o.down > 0) goal = b.goal = null;
      else {
        goal.x = goal.o.x;
        goal.y = goal.o.y;
      }
    }

    let vx = 0;
    let vy = 0;
    let speed = sk.speed;
    if (goal) {
      const dx = goal.x - b.x;
      const dy = goal.y - b.y;
      const d = Math.hypot(dx, dy) || 1;
      const a = Math.atan2(dy, dx);
      if (d > 17) {
        vx = dx / d;
        vy = dy / d;
      }
      // can't make headway: slide around whatever is in the way
      if (b.stuck > 0.5) {
        b.side = Math.random() < 0.5 ? 1 : -1;
        b.stuck = -0.6;
      }
      if (b.stuck < 0) {
        const rot = (Math.PI / 2) * b.side;
        const nx = vx * Math.cos(rot) - vy * Math.sin(rot);
        const ny = vx * Math.sin(rot) + vy * Math.cos(rot);
        vx = nx;
        vy = ny;
      }
      if (d <= MELEE_REACH && b.swingCd <= 0) {
        b.swingCd = sk.swing * (0.85 + Math.random() * 0.3);
        b.swing = { t: 0, a };
        sfx.play('swing', Math.max(0, 1 - Math.hypot(b.x - g.player.x, b.y - g.player.y) / 220) * 0.7);
        b.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
        if (goal.kind === 'me') this.hurtMe(b, 1, b.x, b.y);
        else this.hurt(goal.o, 1, b.id, b.x, b.y);
      } else if (d > 44 && d < 120 && b.throwCd <= 0) {
        b.throwCd = sk.throw * (0.8 + Math.random() * 0.5);
        this.shots.push({ x: b.x, y: b.y - 8, vx: Math.cos(a) * 190, vy: Math.sin(a) * 190, life: 0.8, owner: b.id, rot: 0 });
      }
    } else {
      // nobody in sight: amble about
      b.wander.t -= dt;
      if (b.wander.t <= 0) {
        b.wander.t = 1 + Math.random() * 2;
        b.wander.a = Math.random() < 0.3 ? null : Math.random() * 6.28;
      }
      if (b.wander.a !== null) {
        vx = Math.cos(b.wander.a) * 0.5;
        vy = Math.sin(b.wander.a) * 0.5;
      }
    }

    if (vx || vy) {
      if (g.world.type(Math.floor(b.x / T), Math.floor((b.y - 2) / T)) === WATER) speed *= WATER_SLOWDOWN;
      if (Math.abs(vx) >= Math.abs(vy)) b.dir = vx > 0 ? 'right' : 'left';
      else b.dir = vy > 0 ? 'down' : 'up';
      this.step(b, vx * speed * dt, vy * speed * dt);
    }
    // stuck check: wanting to go somewhere but barely moving
    const moved = Math.hypot(b.x - b.lx, b.y - b.ly);
    b.lx = b.x;
    b.ly = b.y;
    b.moving = (vx || vy) && moved > 0.01;
    if (goal && (vx || vy) && moved < speed * dt * 0.3) b.stuck += dt;
    else if (b.stuck > 0) b.stuck = 0;
    else if (b.stuck < 0) b.stuck = Math.min(0, b.stuck + dt);
  }

  updateShots(dt) {
    const g = this.g;
    this.shots = this.shots.filter((s) => {
      s.life -= dt;
      s.rot += dt * 14;
      if (s.life <= 0) return false;
      for (let i = 0; i < 3; i++) {
        s.x += (s.vx * dt) / 3;
        s.y += (s.vy * dt) / 3;
        if (!g.dead && !g.combat.hidden) {
          const ox = (s.x - g.player.x) / 8;
          const oy = (s.y - (g.player.y - 9)) / 12;
          if (ox * ox + oy * oy < 1) {
            this.hurtMe(this.list.find((b) => b.id === s.owner), 1, s.x - s.vx, s.y - s.vy);
            return false;
          }
        }
        for (const o of this.list) {
          if (o.id === s.owner || o.down > 0) continue;
          const ox = (s.x - o.x) / 8;
          const oy = (s.y - (o.y - 9)) / 12;
          if (ox * ox + oy * oy < 1) {
            this.g.combat.hitColor = splatTone('rock');
            this.hurt(o, 1, s.owner, s.x - s.vx, s.y - s.vy);
            this.g.combat.hitColor = null;
            return false;
          }
        }
        if (g.world.isBlocked(s.x - 1, s.y - 1, 2, 2, false, true)) return false;
      }
      return true;
    });
  }

  update(dt) {
    if (this.g.celeb) return; // everyone watches the winner
    for (const b of this.list) this.updateBot(b, dt);
    this.updateShots(dt);
  }
}
