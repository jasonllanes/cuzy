import { Bots } from './bots';
import { splatTone } from './combat';
import { T, WATER } from './world';

// Computer players in a room. Whoever hosts the room plays them: they are the room's seated "ai" heroes, found in
// `game.remotes`, and move exactly like the solo rivals do (this builds on Bots). Everyone else just sees them as other
// players: the host sends their positions, swings and thrown rocks through the room, a hit on one is sent to the host
// to work out, and the room server keeps the score like it does for real heroes.

const SIGHT = 170;
const SEND_EVERY = 0.07;

export class AiPlayers extends Bots {
  constructor(game, difficulty = 'medium') {
    super(game, 0, difficulty);
    this.sendT = 0;
  }

  // take the computer players the room has seated, and let go of any that were taken out of it
  sync() {
    const ids = new Set();
    for (const r of this.g.remotes.values()) {
      if (!r.ai) continue;
      ids.add(r.id);
      if (!r.sim) this.adopt(r);
    }
    if (this.list.length !== ids.size || this.list.some((b) => !ids.has(b.id))) this.list = this.list.filter((b) => ids.has(b.id));
  }

  adopt(r) {
    const g = this.g;
    if (g.soccer || g.escape) return this.adoptMode(r);
    const site = g.roomHomes?.[Math.min((g.teamCount ? g.teamMap[r.id] : r.slot) ?? 0, g.roomHomes.length - 1)]; // (a team's computer players live in the team's camp)
    const home = site ? g.world.homePoint(site) : g.world.randomSpawn();
    Object.assign(r, {
      sim: true, // this game moves it: it does not glide towards network positions
      home,
      x: home.x,
      y: home.y,
      tx: home.x,
      ty: home.y,
      hp: 6,
      hidden: false,
      down: 0,
      inv: 0,
      swingCd: 1 + Math.random(),
      throwCd: 2 + Math.random() * 2,
      thinkT: 0,
      goal: null,
      wander: { a: Math.random() * 6.28, t: 0 },
      stuck: 0,
      side: 0,
      lx: home.x,
      ly: home.y,
    });
    this.list.push(r);
  }

  // the Beach Ball match and the Escape zone: the computer player starts on its own half, or by the host's hero
  adoptMode(r) {
    const g = this.g;
    let home;
    if (g.soccer) {
      const team = g.teamMap[r.id] ?? 0;
      const mates = [...g.remotes.values()].filter((x) => (g.teamMap[x.id] ?? 0) === team).length;
      home = g.world.pitchSpawn(team, Math.max(0, mates - 1), Math.max(1, mates));
    } else home = { x: g.player.x + (Math.random() - 0.5) * 40, y: g.player.y + 14 + Math.random() * 20 };
    Object.assign(r, {
      sim: true, home, x: home.x, y: home.y, tx: home.x, ty: home.y, hp: 6, hidden: false, down: 0, inv: 0,
      swingCd: 0.5 + Math.random(), kickCd: 0, thinkT: 0, goal: null, wander: { a: Math.random() * 6.28, t: 0 },
      stuck: 0, side: 0, lx: home.x, ly: home.y, boarded: false,
    });
    this.list.push(r);
  }

  // walks `b` towards (tx, ty) at its pace (it slides round whatever is in the way)
  walkTo(b, tx, ty, dt, speed = this.skill.speed, stop = 4) {
    const g = this.g;
    const dx = tx - b.x;
    const dy = ty - b.y;
    const d = Math.hypot(dx, dy);
    let vx = 0;
    let vy = 0;
    if (d > stop) {
      vx = dx / d;
      vy = dy / d;
    }
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
    if (vx || vy) {
      if (g.world.type(Math.floor(b.x / T), Math.floor((b.y - 2) / T)) === WATER) speed *= 0.4;
      if (Math.abs(vx) >= Math.abs(vy)) b.dir = vx > 0 ? 'right' : 'left';
      else b.dir = vy > 0 ? 'down' : 'up';
      this.step(b, vx * speed * dt, vy * speed * dt);
    }
    const moved = Math.hypot(b.x - b.lx, b.y - b.ly);
    b.lx = b.x;
    b.ly = b.y;
    b.moving = !!(vx || vy) && moved > 0.01;
    if ((vx || vy) && moved < speed * dt * 0.3) b.stuck += dt;
    else if (b.stuck > 0) b.stuck = 0;
    else if (b.stuck < 0) b.stuck = Math.min(0, b.stuck + dt);
  }

  // Beach Ball: the team mate nearest the ball goes for it and drives it at the other team's goal; the rest hold their spots
  updateSoccer(b, dt) {
    const g = this.g;
    const ball = g.balls?.list[0];
    b.animT += dt;
    b.kickCd = Math.max(0, (b.kickCd || 0) - dt);
    if (!ball) return;
    const team = g.teamMap[b.id] ?? 0;
    // the goal it drives at: the other team's (the left team attacks the right goal); in a Rumble it picks one of the two others, switching now and then
    const w = g.world;
    const target = w.rumble ? (team + 1 + (Math.floor(g.t / 25) + b.slot) % 2) % 3 : team === 0 ? 1 : 0;
    const goal = w.goalCenter(target);
    const own = w.goalCenter(w.rumble ? team % 3 : team === 0 ? 0 : 1);
    const goalX = goal.x;
    const gdx = goalX - ball.x;
    const gdy = goal.y - ball.y;
    const gd = Math.hypot(gdx, gdy) || 1;
    const mates = [...g.remotes.values()].filter((r) => r.ai && (g.teamMap[r.id] ?? 0) === team);
    const dist = (o) => Math.hypot(ball.x - o.x, ball.y - o.y);
    // the one nearest the ball plays it (a real team mate who is clearly closer gets backed up instead)
    const humanNear = !g.dead && (g.teamMap[g.mp.you] ?? 0) === team && Math.hypot(ball.x - g.player.x, ball.y - g.player.y) + 30 < dist(b);
    const chaser = mates.reduce((best, o) => (dist(o) < dist(best) ? o : best), b) === b && !humanNear;
    if (chaser) {
      // get behind the ball (on the far side from the goal), then run through it
      const behind = (b.x - ball.x) * (gdx / gd) + (b.y - ball.y) * (gdy / gd) < -4;
      const tx = behind ? ball.x : ball.x - (gdx / gd) * 11;
      const ty = (behind ? ball.y : ball.y - (gdy / gd) * 11) + 4;
      this.walkTo(b, tx, ty, dt, this.skill.speed * 1.1, 2);
      const d = Math.hypot(ball.x - b.x, ball.y - (b.y - 4));
      if (d < 15 && b.kickCd <= 0) {
        b.kickCd = 0.4;
        // a bit of aim: the easier the level, the more it strays
        const miss = (1 - this.skill.speed / 70) * 0.7 * (Math.random() - 0.5);
        const a = Math.atan2(gdy, gdx) + miss;
        g.balls.hit(ball, Math.cos(a), Math.sin(a), 120 + this.skill.speed * 1.6, b.id);
      }
    } else {
      // the others stand between the ball and their own goal, a little back
      const sx = own.x * 0.55 + ball.x * 0.35;
      const sy = own.y * 0.55 + ball.y * 0.4 + (mates.indexOf(b) % 2 ? 40 : -40);
      this.walkTo(b, sx, sy, dt, this.skill.speed * 0.9, 8);
    }
  }

  // Escape: the computer player is a companion. It stays close to the host's hero, fights the zombies that come near, and
  // runs for the chopper once it has landed
  updateEscapeBot(b, dt) {
    const g = this.g;
    b.animT += dt;
    if (b.swing && (b.swing.t += dt) > 0.24) b.swing = null;
    b.swingCd -= dt;
    if (b.boarded) {
      b.hidden = true;
      return;
    }
    const e = g.escapeState;
    if (g.chopper && e?.phase === 'extract' && g.chopper.t > 4 && !g.inside) {
      this.walkTo(b, g.chopper.x, g.chopper.y, dt, this.skill.speed * 1.7, 6);
      if (Math.hypot(b.x - g.chopper.x, b.y - g.chopper.y) < 30) b.boarded = true;
      return;
    }
    if (g.inside || g.dungeon) {
      b.moving = false; // (it waits outside while you are in a building)
      return;
    }
    // zombies close to it, or to the one it follows
    let foe = null;
    let fd = 110 * this.skill.sight;
    for (const w of g.combat.wilds) {
      if (w.state === 'dead' || !String(w.type).startsWith('z_')) continue;
      const d = Math.min(Math.hypot(w.x - b.x, w.y - b.y), Math.hypot(w.x - g.player.x, w.y - g.player.y) + 25);
      if (d < fd) {
        foe = w;
        fd = d;
      }
    }
    if (foe) {
      this.walkTo(b, foe.x, foe.y, dt, this.skill.speed, 14);
      if (Math.hypot(foe.x - b.x, foe.y - b.y) <= 24 && b.swingCd <= 0) {
        b.swingCd = this.skill.swing * (0.85 + Math.random() * 0.3);
        b.swing = { t: 0, a: Math.atan2(foe.y - b.y, foe.x - b.x) };
        b.dir = Math.abs(foe.x - b.x) > Math.abs(foe.y - b.y) ? (foe.x > b.x ? 'right' : 'left') : foe.y > b.y ? 'down' : 'up';
        g.combat.damageWild(foe, 1.5, b.x, b.y, 70);
      }
      return;
    }
    const far = Math.hypot(g.player.x - b.x, g.player.y - b.y);
    if (far > 42) this.walkTo(b, g.player.x + (b.slot % 2 ? 22 : -22), g.player.y + 12, dt, this.skill.speed * (far > 160 ? 1.6 : 1), 6);
    else b.moving = false;
    if (far > 420) Object.assign(b, { x: g.player.x - 20, y: g.player.y + 10 }); // (lost it: it catches up)
  }

  // computer players and real ones on the same team leave each other alone
  friendly(aId, otherId) {
    const g = this.g;
    return !!g.teamCount && g.teamMap[aId] !== undefined && g.teamMap[aId] === g.teamMap[otherId];
  }

  // the nearest enemy in sight: you, another player, or another computer player
  pickGoal(b) {
    const g = this.g;
    let best = null;
    let bd = SIGHT * this.skill.sight;
    const consider = (kind, o, x, y) => {
      const d = Math.hypot(x - b.x, y - b.y);
      if (d < bd) {
        best = { kind, o, x, y };
        bd = d;
      }
    };
    if (!g.dead && !g.combat.hidden && !g.inside && !g.dungeon && !this.friendly(b.id, g.mp.you)) consider('me', null, g.player.x, g.player.y);
    for (const r of g.remotes.values()) {
      if (r === b || r.hidden || r.hp <= 0 || (r.ai && r.down > 0) || this.friendly(b.id, r.id)) continue;
      consider(r.ai ? 'bot' : 'peer', r, r.x, r.y);
    }
    return best;
  }

  // a computer player hurt someone. Another computer player is dealt with here; a real player's own game works out its hit.
  hurt(o, dmg, by, fromX, fromY) {
    if (o.ai) {
      super.hurt(o, dmg, by, fromX, fromY);
      return;
    }
    this.g.mp.net.send({ t: 'aiattack', ai: by, target: o.id, dmg, fx: fromX, fy: fromY });
  }

  // this one hurts the host's own hero (the point goes to whoever lands the last hit, through the room)
  hurtMe(b, dmg, fromX, fromY) {
    if (this.g.dead) return;
    this.g.combat.hurtPlayer(dmg, fromX, fromY, { killer: b.id, invuln: 0.6, by: { kind: 'player', id: b.id, name: b.name } });
  }

  // a computer player went down: the room server counts the point for whoever did it ('me' is the host's own hero)
  credit(by, victim) {
    this.g.mp.net.send({ t: 'aidied', ai: victim, killer: by === 'me' ? this.g.mp.you : by });
  }

  // (the 'kill' announcement that follows already gives the host's hero its experience)
  award() {
    this.g.combat.kills++;
  }

  // someone else's hit on a computer player, relayed through the room
  hurtBy(m) {
    const b = this.list.find((x) => x.id === String(m.ai));
    if (b) this.hurt(b, m.dmg, m.from, m.fx, m.fy);
  }

  updateShots(dt) {
    const g = this.g;
    this.shots = this.shots.filter((s) => {
      s.life -= dt;
      s.rot += dt * 14;
      const owner = this.list.find((b) => b.id === s.owner);
      if (s.life <= 0 || !owner) return false;
      for (let i = 0; i < 3; i++) {
        s.x += (s.vx * dt) / 3;
        s.y += (s.vy * dt) / 3;
        if (!g.dead && !g.combat.hidden && !g.inside && !this.friendly(owner.id, g.mp.you)) {
          const ox = (s.x - g.player.x) / 8;
          const oy = (s.y - (g.player.y - 9)) / 12;
          if (ox * ox + oy * oy < 1) {
            this.hurtMe(owner, 1, s.x - s.vx, s.y - s.vy);
            return false;
          }
        }
        for (const o of g.remotes.values()) {
          if (o.id === s.owner || o.hidden || o.hp <= 0 || (o.ai && o.down > 0) || this.friendly(owner.id, o.id)) continue;
          const ox = (s.x - o.x) / 8;
          const oy = (s.y - (o.y - 9)) / 12;
          if (ox * ox + oy * oy < 1) {
            g.combat.hitColor = splatTone('rock');
            this.hurt(o, 1, s.owner, s.x - s.vx, s.y - s.vy);
            g.combat.hitColor = null;
            return false;
          }
        }
        if (g.world.isBlocked(s.x - 1, s.y - 1, 2, 2, false, true)) return false;
      }
      return true;
    });
  }

  update(dt) {
    const g = this.g;
    this.sync();
    if (!g.celeb) {
      for (const b of this.list) {
        if (g.soccer) this.updateSoccer(b, dt);
        else if (g.escape) this.updateEscapeBot(b, dt);
        else this.updateBot(b, dt);
        if (b.swing && b.swing.t === 0) g.mp.net.send({ t: 'aifx', id: b.id, kind: 'swing', a: b.swing.a });
      }
      this.updateShots(dt);
      for (const s of this.shots) {
        if (s.sent) continue;
        s.sent = true;
        g.mp.net.send({ t: 'aifx', id: s.owner, kind: 'throw', x: s.x, y: s.y, vx: s.vx, vy: s.vy });
      }
    }
    // everyone else sees where they are
    this.sendT -= dt;
    if (this.sendT <= 0 && this.list.length) {
      this.sendT = SEND_EVERY;
      g.mp.net.send({ t: 'aistate', list: this.list.map((b) => ({ id: b.id, x: b.x, y: b.y, dir: b.dir, moving: !!b.moving, hp: b.hp, hidden: !!b.hidden })) });
    }
  }
}
