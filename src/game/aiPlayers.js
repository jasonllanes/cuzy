import { Bots } from './bots';
import { splatTone } from './combat';

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
    const site = g.roomHomes?.[Math.min(r.slot ?? 0, g.roomHomes.length - 1)];
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
        this.updateBot(b, dt);
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
