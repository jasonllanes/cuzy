import { RETRO_COUNT, heroById, retroId } from './heroes';
import { GOAL_D, T } from './world';
import { TEAMS } from './teams';
import { hash2 } from './rng';

// The Beach Ball crowd: spectators stand outside the fence all round the pitch. The left half cheers for the left team (team 0),
// the right half for the right team (team 1). They hop and cheer when their team scores (with a chat bubble and confetti, see the
// engine), groan when the other team does, and now and then shout for their side.

const CHEER = ['LFG!', 'Nice shot!', 'GOOOAL!', 'Yesss!', 'What a strike!', "Let's go!", 'That\'s my team!', 'Beautiful!', 'Unreal!', 'Easy!', 'Woooo!', 'GG!'];
const GROAN = ['Aww…', 'So close!', 'Next one!', 'Keep going!', 'Defend!', 'Come on!', 'Not again…'];

export class Crowd {
  constructor(game) {
    this.g = game;
    this.list = [];
    this.shoutT = 3;
    const seed = game.world.seed;
    const W = game.world.pw * T;
    const H = game.world.ph * T;
    const rumble = !!game.world.rumble;
    let n = 0;
    const add = (x, y, dir, team) => {
      const k = n++;
      const id = (Math.floor(hash2(k, 7, seed + 9100) * RETRO_COUNT) % RETRO_COUNT) + 1;
      this.list.push({ x, y, dir, team, hero: heroById(retroId(id)), anim: hash2(k, 8, seed + 9100) * 6, hop: 0, cheer: 0, bubble: null, bt: 0 });
    };
    // two rows along the top and the bottom fence
    for (const [sy, dir] of [[-1, 'down'], [1, 'up']]) {
      for (let row = 0; row < 2; row++) {
        for (let x = -W + 12 + row * 11; x < W - 6; x += 23) {
          const j = (hash2(Math.round(x), row * 3 + (sy + 2), seed + 9101) - 0.5) * 6;
          add(x + j, sy * (H + 34 + row * 17), dir, rumble && sy < 0 && Math.abs(x) < 120 ? 2 : x < 0 ? 0 : 1);
        }
      }
    }
    // and behind each goal
    for (const sx of [-1, 1]) {
      for (let col = 0; col < 2; col++) {
        for (let y = -44; y <= 44; y += 22) add(sx * (W + (GOAL_D + 2) * T + col * 17), y + col * 9, sx < 0 ? 'right' : 'left', sx < 0 ? 0 : 1);
      }
    }
    if (rumble) {
      // behind the top goal, too (the third team's fans)
      for (let col = 0; col < 2; col++) {
        for (let x = -44; x <= 44; x += 22) add(x + col * 9, -(H + (GOAL_D + 2) * T + col * 17), 'down', 2);
      }
    }
    // (nobody stands on the field or in a goal)
    this.list = this.list.filter((s) => !game.world.isBlocked(s.x - 4, s.y - 4, 8, 6, true) && !game.world.pitchWalk(Math.floor(s.x / T), Math.floor(s.y / T)));
  }

  // `team` scored: its side goes wild, the other side groans
  goal(team, conceded = false) {
    for (const s of this.list) {
      const mine = conceded ? s.team !== team : s.team === team; // (in a Rumble `team` is the one that let it in: its fans groan, the others cheer)
      s.cheer = mine ? 3.2 + Math.random() : 0;
      if (Math.random() < (mine ? 0.3 : 0.12)) {
        const words = mine ? CHEER : GROAN;
        s.bubble = words[Math.floor(Math.random() * words.length)];
        s.bt = 2.8 + Math.random() * 1.2;
      }
    }
  }

  update(dt) {
    for (const s of this.list) {
      s.anim += dt;
      if (s.cheer > 0) {
        s.cheer -= dt;
        s.hop = Math.abs(Math.sin(s.anim * 9 + s.x)) * 3.2;
      } else s.hop = 0;
      if (s.bt > 0 && (s.bt -= dt) <= 0) s.bubble = null;
    }
    // now and then somebody shouts for their team
    this.shoutT -= dt;
    if (this.shoutT <= 0 && this.list.length) {
      this.shoutT = 4 + Math.random() * 5;
      const s = this.list[Math.floor(Math.random() * this.list.length)];
      s.cheer = 1.4;
      s.bubble = `Go ${TEAMS[s.team].name}!`;
      s.bt = 2.2;
    }
  }

  collect(list) {
    const g = this.g;
    for (const s of this.list) {
      if (Math.abs(s.x - g.cam.x) > 330 || Math.abs(s.y - g.cam.y) > 230) continue;
      list.push({ kind: 'crowd', s, y: s.y });
    }
  }

  draw(ctx, s) {
    const g = this.g;
    const c = TEAMS[s.team].color;
    // a little team flag next to them
    const fx = Math.round(s.x) + 7;
    const fy = Math.round(s.y) - 1 - Math.round(s.hop);
    ctx.fillStyle = '#6b4a22';
    ctx.fillRect(fx, fy - 17, 1, 17);
    ctx.fillStyle = c;
    const wave = Math.round(Math.sin(s.anim * (s.cheer > 0 ? 9 : 3)) * 1);
    ctx.fillRect(fx + 1, fy - 17, 6, 4);
    ctx.fillRect(fx + 7, fy - 16 + wave, 1, 2);
    g.drawHeroAt(ctx, s.hero, s.dir, s.cheer > 0, s.anim, s.x, s.y - s.hop);
  }

  drawBubbles(camX, camY) {
    const g = this.g;
    for (const s of this.list) {
      if (!s.bubble) continue;
      const [sx, sy] = g.toScreen(s.x, s.y - 30 - s.hop, camX, camY);
      if (sx < -40 || sy < -40 || sx > g.canvas.width + 40 || sy > g.canvas.height + 40) continue;
      g.pill(s.bubble, sx, sy, g.zoom * 4.2, '#fff', TEAMS[s.team].color);
    }
  }
}
