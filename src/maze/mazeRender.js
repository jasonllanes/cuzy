// Maze Rush: drawing. The maze is baked once per level (the tileset floor and walls, with Modern Exteriors props standing in the frame around it)
// and the movers are drawn over it every frame. Everything is in 16px tiles; the page scales the canvas.

import { drawHero, heroById } from '../game/heroes';
import { TINY } from '../game/tiny';
import { loadTheme, loadedThemes } from '../v2/assets';
import { hashString } from '../game/rng';
import { DECOR_ATLASES, placeOf } from './themes';
import { FOES, T, mulberry, posOf } from './mazeLogic';
import { fruitSprite, powerSprite } from './mazeArt';

// the tilesets: 16 tiles for every way two kinds of ground meet at the four corners of a tile (the same table render.js uses)
const WANG = { 0: [0, 3], 1: [1, 3], 2: [0, 0], 3: [3, 0], 4: [0, 2], 5: [1, 0], 6: [2, 3], 7: [1, 1], 8: [3, 3], 9: [0, 1], 10: [3, 2], 11: [2, 0], 12: [1, 2], 13: [2, 2], 14: [3, 1], 15: [2, 1] };

export const MARGIN = { t: 4, l: 3, r: 3, b: 3 }; // the frame of wall (in tiles) around the maze, where the props stand
export const SLOT_COLORS = ['#4aa3ff', '#ff6fa8', '#ffd23f', '#6fe08a'];

export const loadDecor = () => Promise.all(DECOR_ATLASES.map((id) => loadTheme(id)));

export const sceneSize = (lvl) => ({ w: (lvl.W + MARGIN.l + MARGIN.r) * T, h: (lvl.H + MARGIN.t + MARGIN.b) * T });

const ease = (x) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;

// ---- the baked floor and walls ----
function bake(img, lvl, level, runSeed) {
  const place = placeOf(level);
  const { w, h } = sceneSize(lvl);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = place.bg;
  ctx.fillRect(0, 0, w, h);
  const set = img[`maps/${place.set}`];
  // a tile is a path tile when it is inside the maze and open; everything else (the walls, the frame) is wall
  const isPath = (x, y) => {
    const mx = x - MARGIN.l;
    const my = y - MARGIN.t;
    return mx >= 0 && my >= 0 && mx < lvl.W && my < lvl.H && lvl.grid[mx + my * lvl.W] === 0;
  };
  const bit = (x, y) => (isPath(x, y) === place.pathShape ? 1 : 0);
  const tw = lvl.W + MARGIN.l + MARGIN.r;
  const th = lvl.H + MARGIN.t + MARGIN.b;
  for (let y = 0; y <= th; y++) {
    for (let x = 0; x <= tw; x++) {
      const key = bit(x - 1, y - 1) * 8 + bit(x, y - 1) * 4 + bit(x - 1, y) * 2 + bit(x, y);
      const [sc, sr] = WANG[key];
      ctx.drawImage(set, sc * T, sr * T, T, T, x * T - T / 2, y * T - T / 2, T, T);
    }
  }

  // the props: they stand in the frame, never over the maze itself
  const rand = mulberry(hashString(`decor|${runSeed}|${level}`));
  const sprites = [];
  for (const [atlas, names] of place.decor) {
    const th2 = loadedThemes.get(atlas);
    if (!th2) continue;
    for (const n of names) {
      const s = th2.byName.get(n);
      if (s) sprites.push({ img: th2.img, ...s });
    }
  }
  if (sprites.length) {
    const occupied = new Set();
    const inMaze = (x, y) => x >= MARGIN.l && x < MARGIN.l + lvl.W && y >= MARGIN.t && y < MARGIN.t + lvl.H;
    const placed = [];
    const want = Math.round((tw * th - lvl.W * lvl.H) / 9);
    for (let tries = 0; tries < 700 && placed.length < want; tries++) {
      const s = sprites[Math.floor(rand() * sprites.length)];
      const x = Math.floor(rand() * tw);
      const y = Math.floor(rand() * th);
      const cols = Math.ceil(s.w / T);
      const rows = Math.ceil(s.h / T);
      const x0 = x - Math.floor((cols - 1) / 2);
      const y0 = y - rows + 1;
      let ok = x0 >= 0 && y0 >= 0 && x0 + cols <= tw && y < th;
      for (let yy = y0; ok && yy <= y; yy++) {
        for (let xx = x0; ok && xx < x0 + cols; xx++) {
          if (inMaze(xx, yy) || occupied.has(xx + yy * tw)) ok = false;
        }
      }
      if (!ok) continue;
      for (let yy = y0; yy <= y; yy++) for (let xx = x0; xx < x0 + cols; xx++) occupied.add(xx + yy * tw);
      placed.push({ s, x: x0 * T + (cols * T - s.w) / 2, y: (y + 1) * T - s.h });
    }
    placed.sort((a, b) => a.y + a.s.h - (b.y + b.s.h));
    for (const p of placed) ctx.drawImage(p.s.img, p.s.x, p.s.y, p.s.w, p.s.h, Math.round(p.x), Math.round(p.y), p.s.w, p.s.h);
  }
  if (place.tint) {
    ctx.fillStyle = place.tint;
    ctx.fillRect(0, 0, w, h);
  }
  return c;
}

export class MazeView {
  constructor(assets) {
    this.assets = assets;
    this.key = '';
    this.layer = null;
    this.parts = [];
    this.flash = 0;
    this.shake = 0;
    this.t = 0;
    this.snow = 0;
    this.hero = document.createElement('canvas'); // the hero is drawn here first, to cut them in two
    this.hero.width = 40;
    this.hero.height = 44;
  }

  // call before drawing: (re)bakes the level when it changed
  ensure(sim) {
    const key = `${sim.runSeed}|${sim.level}`;
    if (key === this.key) return;
    this.key = key;
    this.layer = bake(this.assets.img, sim.lvl, sim.level, sim.runSeed);
    this.parts = [];
    this.flash = 0;
  }

  // little visual bursts for the things that happen
  onEvent(e, sim) {
    const at = (x, y) => ({ x: (MARGIN.l + x) * T + 8, y: (MARGIN.t + y) * T + 8 });
    if (e.k === 'fruit') this.burst(at(e.x, e.y), ['#fff3a6', '#ffd93b', '#ffffff'], 10, 42);
    else if (e.k === 'power') this.burst(at(e.x, e.y), e.type === 'freeze' ? ['#9fdcff', '#ffffff', '#4aa3df'] : ['#ffd93b', '#ff9f1c', '#ffffff'], 16, 60);
    else if (e.k === 'portal') this.burst(at(sim.lvl.portal.x, sim.lvl.portal.y), ['#9b5cff', '#5ad8ff', '#ffffff'], 36, 80);
    else if (e.k === 'clear') this.burst(at(sim.lvl.portal.x, sim.lvl.portal.y), ['#9b5cff', '#5ad8ff', '#ffffff', '#ffd93b'], 50, 100);
    else if (e.k === 'kill') {
      this.flash = 1;
      this.shake = 1;
    }
  }

  burst(p, colors, n, speed) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.7);
      this.parts.push({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 14, life: 0, max: 0.5 + Math.random() * 0.5, color: colors[i % colors.length], size: 1 + (Math.random() < 0.3 ? 1 : 0) });
    }
  }

  step(sim, dt) {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt * 2.2);
    this.shake = Math.max(0, this.shake - dt * 1.6);
    for (const q of this.parts) {
      q.life += dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vy += 90 * dt;
    }
    this.parts = this.parts.filter((q) => q.life < q.max);
    if (sim.phase === 'play') {
      // a boosted player leaves speed dust behind
      for (const pl of sim.players) {
        if (!pl.alive || pl.boostT <= 0 || !pl.moving) continue;
        const pp = posOf(pl);
        this.parts.push({ x: (MARGIN.l + pp.x) * T + 8 + (Math.random() - 0.5) * 6, y: (MARGIN.t + pp.y) * T + 12, vx: 0, vy: -6, life: 0, max: 0.3, color: '#ffe066', size: 1 });
      }
      if (sim.freezeT > 0 && Math.random() < dt * 40) {
        this.parts.push({ x: Math.random() * (sim.lvl.W + MARGIN.l + MARGIN.r) * T, y: -2, vx: (Math.random() - 0.5) * 10, vy: 22 + Math.random() * 20, life: 0, max: 5, color: '#ffffff', size: 1 });
      }
    }
  }

  // ---- the frame ----
  draw(ctx, sim, assets = this.assets) {
    this.ensure(sim);
    const { w, h } = sceneSize(sim.lvl);
    const k = sim.phase === 'kill' && sim.kill ? sim.kill : null;
    const victim = k ? sim.players[k.pi] : null;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    // the caught animation zooms in on the player
    let zoom = 1;
    let pvx = 0;
    let pvy = 0;
    if (k && victim) {
      const dp = sim.deaths.find((d) => d.pi === k.pi) || posOf(victim);
      pvx = (MARGIN.l + dp.x) * T + 8;
      pvy = (MARGIN.t + dp.y) * T + 8;
      zoom = 1 + 1.9 * ease(k.t / 0.45);
      const ox = Math.min(0, Math.max(w - w * zoom, w / 2 - pvx * zoom));
      const oy = Math.min(0, Math.max(h - h * zoom, h / 2 - pvy * zoom));
      ctx.translate(ox, oy);
      ctx.scale(zoom, zoom);
    }
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * 3 * this.shake, (Math.random() - 0.5) * 3 * this.shake);
    ctx.drawImage(this.layer, 0, 0);

    const px = (x) => (MARGIN.l + x) * T;
    const py = (y) => (MARGIN.t + y) * T;
    this.drawPortal(ctx, sim, px(sim.lvl.portal.x) + 8, py(sim.lvl.portal.y) + 8);
    for (const d of sim.deaths) if (!(k && k.pi === d.pi)) this.drawRemains(ctx, sim, d, 99, null);
    for (const it of sim.items) {
      if (it.got) continue;
      const bob = Math.sin(this.t * 3 + it.id * 1.7) * 1.2;
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.ellipse(px(it.x) + 8, py(it.y) + 13, 4.5, 1.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.drawImage(fruitSprite(it.kind), px(it.x) + 2, py(it.y) + 1 + bob);
    }
    for (const q of sim.powers) {
      const bob = Math.sin(this.t * 4 + q.id) * 1.4;
      const glow = 0.35 + 0.2 * Math.sin(this.t * 5);
      ctx.fillStyle = q.type === 'freeze' ? `rgba(120,200,255,${glow})` : `rgba(255,200,60,${glow})`;
      ctx.beginPath();
      ctx.arc(px(q.x) + 8, py(q.y) + 8, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.drawImage(powerSprite(q.type), px(q.x) + 2, py(q.y) + 2 + bob);
    }

    // movers, the lowest on screen drawn last
    const list = [];
    for (const e of sim.enemies) list.push({ y: posOf(e).y, draw: () => this.drawEnemy(ctx, sim, e, k) });
    for (const pl of sim.players) {
      if (pl.alive) list.push({ y: posOf(pl).y, draw: () => this.drawPlayer(ctx, sim, pl) });
    }
    if (k && victim) list.push({ y: posOf(victim).y, draw: () => this.drawRemains(ctx, sim, sim.deaths.find((d) => d.pi === k.pi) || { x: posOf(victim).x, y: posOf(victim).y, seed: k.seed, pi: k.pi }, k.t, k) });
    list.sort((a, b) => a.y - b.y);
    for (const o of list) o.draw();

    for (const q of this.parts) {
      ctx.globalAlpha = 1 - q.life / q.max;
      ctx.fillStyle = q.color;
      ctx.fillRect(Math.round(q.x), Math.round(q.y), q.size, q.size);
    }
    ctx.globalAlpha = 1;
    for (const f of sim.floaters) {
      ctx.globalAlpha = 1 - f.t / 1.1;
      ctx.font = '700 6px "Pixelify Sans", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000';
      ctx.fillText(f.text, px(f.x) + 9, py(f.y) - f.t * 12 + 1);
      ctx.fillStyle = '#ffe066';
      ctx.fillText(f.text, px(f.x) + 8, py(f.y) - f.t * 12);
    }
    ctx.globalAlpha = 1;
    if (sim.freezeT > 0) {
      ctx.fillStyle = `rgba(120, 190, 255, ${Math.min(0.2, sim.freezeT * 0.2)})`;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();

    if (k && victim) this.drawKillOverlay(ctx, sim, k, victim, w, h, zoom, pvx, pvy);
    if (this.flash > 0.01) {
      ctx.fillStyle = `rgba(255, 255, 255, ${this.flash * 0.65})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  drawPortal(ctx, sim, cx, cy) {
    const open = sim.portalOpen;
    const t = this.t;
    if (!open) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 3, 7, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7d8591';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 6.5, 7.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#2b2f3a';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 4.6, 5.6, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const pulse = 0.55 + 0.25 * Math.sin(t * 5);
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 16);
    g.addColorStop(0, `rgba(160, 110, 255, ${pulse})`);
    g.addColorStop(1, 'rgba(160, 110, 255, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - 18, cy - 18, 36, 36);
    const cols = ['#5b2db8', '#8a5cf5', '#5ad8ff', '#d8f6ff'];
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = cols[i];
      ctx.beginPath();
      ctx.ellipse(cx, cy, 7.4 - i * 1.7, 8.4 - i * 1.9, t * (1.2 + i * 0.5) * (i % 2 ? -1 : 1), 0, Math.PI * (1.45 + 0.1 * i));
      ctx.lineTo(cx, cy);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 4; i++) {
      const a = t * 2 + i * 1.57;
      ctx.fillRect(Math.round(cx + Math.cos(a) * 9), Math.round(cy + Math.sin(a) * 10), 1, 1);
    }
  }

  drawEnemy(ctx, sim, e, k) {
    const info = TINY.chars[e.type];
    const sheet = this.assets.img[`tiny/${e.type}`];
    if (!info || !sheet) return;
    let { x, y } = posOf(e);
    let row = e.moving ? 'walk' : 'idle';
    let f = Math.floor(this.t * (e.moving ? 10 : 6));
    const frozen = sim.freezeT > 0 && sim.phase !== 'intro';
    const striker = k && k.ei === e.id;
    if (striker && sim.players[k.pi]) {
      // the enemy that caught someone leaps at them and swings
      const dp = sim.deaths.find((d) => d.pi === k.pi) || posOf(sim.players[k.pi]);
      const u = ease(k.t / 0.28) * 0.78;
      x += (dp.x - x) * u;
      y += (dp.y - y) * u;
      row = 'atk1';
      f = Math.min(info.atk1[1] - 1, Math.floor((k.t / 0.7) * info.atk1[1]));
    }
    const [r, n] = info[row] || info.idle;
    if (frozen) f = 0;
    const cx = (MARGIN.l + x) * T + 8;
    const cy = (MARGIN.t + y) * T + 12;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    const face = striker && sim.players[k.pi] ? ((sim.deaths.find((d) => d.pi === k.pi)?.x ?? posOf(sim.players[k.pi]).x) < x ? -1 : 1) : e.dir === 'left' ? -1 : e.dir === 'right' ? 1 : e.face || 1;
    e.face = face;
    ctx.save();
    ctx.translate(Math.round(cx), Math.round(cy));
    if (face < 0) ctx.scale(-1, 1);
    ctx.drawImage(sheet, (f % n) * 100, r * 100, 100, 100, -info.cx, -info.foot, 100, 100);
    ctx.restore();
    if (frozen) {
      // frozen solid: a block of ice
      ctx.fillStyle = 'rgba(160, 220, 255, 0.55)';
      ctx.fillRect(cx - 7, cy - info.h - 2, 14, info.h + 3);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(cx - 7, cy - info.h - 2, 14, info.h + 3);
      ctx.fillStyle = '#fff';
      ctx.fillRect(cx - 5, cy - info.h, 2, 1);
    }
  }

  drawPlayer(ctx, sim, pl) {
    const hero = heroById(pl.hero);
    const pp = posOf(pl);
    const cx = (MARGIN.l + pp.x) * T + 8;
    const cy = (MARGIN.t + pp.y) * T + 13;
    const blink = pl.inv > 0 && Math.floor(this.t * 12) % 2 === 0 && sim.phase === 'play';
    if (blink) return;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    if (pl.boostT > 0) {
      ctx.fillStyle = 'rgba(255, 220, 80, 0.35)';
      ctx.beginPath();
      ctx.ellipse(cx, cy - 6, 8, 11, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    drawHero(ctx, this.assets.img, hero, pl.dir, pl.moving && sim.phase === 'play', this.t, cx, cy);
    // a coloured arrow over the head tells the players apart
    const col = SLOT_COLORS[pl.slot % SLOT_COLORS.length];
    const top = cy - (hero?.kind === 'retro' ? 21 : 30);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(cx - 2.5, top - 4);
    ctx.lineTo(cx + 2.5, top - 4);
    ctx.lineTo(cx, top - 1);
    ctx.fill();
    if (sim.players.length > 1) {
      ctx.font = '700 4.5px "Pixelify Sans", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000';
      ctx.fillText(pl.name.slice(0, 8), cx + 0.4, top - 5.4);
      ctx.fillStyle = col;
      ctx.fillText(pl.name.slice(0, 8), cx, top - 5.8);
    }
  }

  // ---- the caught animation: the enemy lunges, a slash, and the hero comes apart (the way a crewmate does) ----
  drawRemains(ctx, sim, d, t, k) {
    const pl = sim.players[d.pi];
    const hero = heroById(pl?.hero);
    const cx = (MARGIN.l + d.x) * T + 8;
    const cy = (MARGIN.t + d.y) * T + 13;
    const rand = mulberry(d.seed || 1);
    const from = k && sim.enemies[k.ei] ? posOf(sim.enemies[k.ei]).x : d.x - 1;
    const side = from <= d.x ? 1 : -1; // the top half falls away from the enemy
    // the standing hero, until the blow lands
    if (t < 0.3) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 5, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      drawHero(ctx, this.assets.img, hero, pl.dir || 'down', false, this.t, cx, cy);
      return;
    }
    const u = Math.min(1, (t - 0.3) / 0.9);
    const e = ease(u);
    // the puddle spreads under them
    ctx.fillStyle = '#a3141f';
    ctx.beginPath();
    ctx.ellipse(cx + side * 3 * e, cy + 0.5, 3 + 7 * ease((t - 0.3) / 1.3), 1.4 + 3 * ease((t - 0.3) / 1.3), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d1202f';
    ctx.beginPath();
    ctx.ellipse(cx + side * 3 * e, cy, 2 + 5 * ease((t - 0.3) / 1.3), 1 + 2 * ease((t - 0.3) / 1.3), 0, 0, Math.PI * 2);
    ctx.fill();
    // draw the hero once, then show the two halves of it
    const tmp = this.hero.getContext('2d');
    tmp.imageSmoothingEnabled = false;
    tmp.clearRect(0, 0, 40, 44);
    drawHero(tmp, this.assets.img, hero, pl.dir || 'down', false, 0, 20, 38);
    const cut = 28; // the line they are cut along (a bit above the feet)
    // the bottom half stays, swaying a little
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(side * -0.12 * e);
    ctx.drawImage(this.hero, 0, cut, 40, 44 - cut, -20, -38 + cut, 40, 44 - cut);
    // the red cut, and the bone sticking out of it
    ctx.fillStyle = '#c4151f';
    ctx.fillRect(-4, -38 + cut - 1, 8, 2);
    ctx.fillStyle = '#f4efe1';
    ctx.fillRect(-1, -38 + cut - 5, 2, 5);
    ctx.fillRect(-2, -38 + cut - 6, 1, 2);
    ctx.fillRect(1, -38 + cut - 6, 1, 2);
    ctx.restore();
    // the top half slides and tips over
    ctx.save();
    ctx.translate(cx + side * (3 + 9 * e), cy - 38 + cut + 6 * e * e);
    ctx.rotate(side * 1.35 * e);
    ctx.drawImage(this.hero, 0, 0, 40, cut, -20, -cut, 40, cut);
    ctx.fillStyle = '#c4151f';
    ctx.fillRect(-4, -1, 8, 2);
    ctx.restore();
    // the blood: thrown up from the cut, landing around them
    const tt = t - 0.3;
    for (let i = 0; i < 30; i++) {
      const a = -Math.PI / 2 + (rand() - 0.5) * 2.4;
      const v = 25 + rand() * 55;
      const vx = Math.cos(a) * v + side * 10;
      const vy = Math.sin(a) * v;
      let x = cx + vx * tt;
      let y = cy - 10 + vy * tt + 0.5 * 170 * tt * tt;
      if (y > cy + 2 + rand() * 3) y = cy + 2 + rand() * 3; // landed
      ctx.fillStyle = i % 3 ? '#d1202f' : '#8f0f1a';
      ctx.fillRect(Math.round(x), Math.round(y), 1 + (i % 4 === 0 ? 1 : 0), 1 + (i % 5 === 0 ? 1 : 0));
    }
  }

  drawKillOverlay(ctx, sim, k, victim, w, h, zoom, pvx, pvy) {
    const e = ease(k.t / 0.5);
    // the screen darkens around them
    const ox = Math.min(0, Math.max(w - w * zoom, w / 2 - pvx * zoom));
    const oy = Math.min(0, Math.max(h - h * zoom, h / 2 - pvy * zoom));
    const sx = pvx * zoom + ox;
    const sy = pvy * zoom + oy;
    const g = ctx.createRadialGradient(sx, sy, 20, sx, sy, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'rgba(60, 0, 8, 0)');
    g.addColorStop(1, `rgba(30, 0, 6, ${0.78 * e})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // the slash
    if (k.t > 0.28 && k.t < 0.62) {
      const s = (k.t - 0.28) / 0.34;
      ctx.save();
      ctx.strokeStyle = `rgba(255,255,255,${1 - s})`;
      ctx.lineWidth = 2.4 * (1 - s) + 0.6;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(sx - 26 + i * 7, sy - 34 + i * 3);
        ctx.lineTo(sx - 26 + i * 7 + 52 * Math.min(1, s * 2.2), sy + 10 + i * 3 + 10 * s);
        ctx.stroke();
      }
      ctx.restore();
    }
    // the words
    if (k.t > 0.85) {
      const s = ease((k.t - 0.85) / 0.25);
      const foe = FOES[sim.enemies[k.ei]?.type]?.name || 'a monster';
      ctx.save();
      ctx.translate(w / 2, h * 0.2);
      ctx.scale(0.6 + 0.4 * s, 0.6 + 0.4 * s);
      ctx.globalAlpha = s;
      ctx.textAlign = 'center';
      ctx.font = '700 22px "Pixelify Sans", monospace';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#2a0006';
      ctx.strokeText('CAUGHT!', 0, 0);
      ctx.fillStyle = '#ff3b4a';
      ctx.fillText('CAUGHT!', 0, 0);
      ctx.font = '700 9px "Pixelify Sans", monospace';
      ctx.fillStyle = '#ffe3e6';
      ctx.fillText(`${victim.name} was caught by the ${foe}`, 0, 14);
      ctx.restore();
    }
  }
}
