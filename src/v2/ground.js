import { loadedThemes } from './assets';
import { KIND, TILE } from './world';

// The ground of a V2 map: one byte per tile (see KIND). It is drawn in chunks of 16x16 tiles, each painted once and kept.

const CH = 16; // tiles per chunk side
const SAND = ['#e6cf96', '#e1c98c', '#ead39e', '#dfc488'];

const hash = (x, y) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

export class Ground {
  constructor(map, index) {
    this.map = map;
    this.chunks = new Map();
    const pick = (list) => (list || []).map((s) => {
      const [theme, name] = s.split('/');
      return loadedThemes.get(theme)?.byName.get(name) || null;
    }).filter(Boolean);
    const g = index.ground;
    this.tiles = {
      [KIND.grass]: pick(g.grass),
      [KIND.road]: pick(g.asphalt),
      [KIND.walk]: pick(g.sidewalk).slice(0, 1),
      [KIND.plaza]: pick(g.sidewalk).slice(1, 2).length ? pick(g.sidewalk).slice(1, 2) : pick(g.sidewalk).slice(0, 1),
      [KIND.dirt]: pick(g.dirt),
      [KIND.water]: pick(g.water),
    };
  }

  kind(tx, ty) {
    const m = this.map;
    return tx < 0 || ty < 0 || tx >= m.cols || ty >= m.rows ? KIND.water : m.ground[ty * m.cols + tx];
  }

  set(tx, ty, k) {
    const m = this.map;
    if (tx < 0 || ty < 0 || tx >= m.cols || ty >= m.rows) return;
    m.ground[ty * m.cols + tx] = k;
    // the chunk and the neighbours that draw an edge against it
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) this.chunks.delete(`${Math.floor((tx + dx) / CH)},${Math.floor((ty + dy) / CH)}`);
  }

  reset() {
    this.chunks.clear();
  }

  chunk(cx, cy) {
    const key = `${cx},${cy}`;
    let c = this.chunks.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = CH * TILE;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < CH; y++) {
      for (let x = 0; x < CH; x++) {
        const tx = cx * CH + x;
        const ty = cy * CH + y;
        const k = this.kind(tx, ty);
        const r = hash(tx, ty);
        if (k === KIND.sand) {
          ctx.fillStyle = SAND[Math.floor(r * SAND.length)];
          ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
          ctx.fillStyle = 'rgba(160,120,60,0.22)';
          for (let i = 0; i < 3; i++) ctx.fillRect(x * TILE + Math.floor(hash(tx * 7 + i, ty) * 15), y * TILE + Math.floor(hash(tx, ty * 7 + i) * 15), 1, 1);
          continue;
        }
        const list = this.tiles[k] || this.tiles[KIND.grass];
        const s = list[Math.floor(r * list.length)];
        const th = s && loadedThemes.get(s.theme);
        if (th) ctx.drawImage(th.img, s.x, s.y, s.w, s.h, x * TILE, y * TILE, TILE, TILE);
        else {
          ctx.fillStyle = '#4a9757';
          ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        }
      }
    }
    // a thin dark line where pavements, plazas, sand and water meet something else
    ctx.fillStyle = 'rgba(30,30,25,0.3)';
    for (let y = 0; y < CH; y++) {
      for (let x = 0; x < CH; x++) {
        const tx = cx * CH + x;
        const ty = cy * CH + y;
        const k = this.kind(tx, ty);
        if (k !== KIND.walk && k !== KIND.plaza && k !== KIND.sand && k !== KIND.water) continue;
        if (this.kind(tx, ty - 1) !== k && this.kind(tx, ty - 1) !== KIND.road) ctx.fillRect(x * TILE, y * TILE, TILE, 1);
        if (this.kind(tx, ty + 1) !== k && this.kind(tx, ty + 1) !== KIND.road) ctx.fillRect(x * TILE, y * TILE + 15, TILE, 1);
        if (this.kind(tx - 1, ty) !== k && this.kind(tx - 1, ty) !== KIND.road) ctx.fillRect(x * TILE, y * TILE, 1, TILE);
        if (this.kind(tx + 1, ty) !== k && this.kind(tx + 1, ty) !== KIND.road) ctx.fillRect(x * TILE + 15, y * TILE, 1, TILE);
      }
    }
    // lane markings and zebra crossings
    ctx.fillStyle = 'rgba(240,236,220,0.88)';
    const x0 = cx * CH * TILE;
    const y0 = cy * CH * TILE;
    for (const [mx, my, mw, mh] of this.map.marks || []) {
      if (mx + mw < x0 || mx > x0 + CH * TILE || my + mh < y0 || my > y0 + CH * TILE) continue;
      ctx.fillRect(mx - x0, my - y0, mw, mh);
    }
    this.chunks.set(key, c);
    return c;
  }

  draw(ctx, camX, camY, vw, vh) {
    const m = this.map;
    const c0 = Math.max(0, Math.floor(camX / (CH * TILE)));
    const r0 = Math.max(0, Math.floor(camY / (CH * TILE)));
    const c1 = Math.min(Math.floor((m.cols - 1) / CH), Math.floor((camX + vw) / (CH * TILE)));
    const r1 = Math.min(Math.floor((m.rows - 1) / CH), Math.floor((camY + vh) / (CH * TILE)));
    for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) ctx.drawImage(this.chunk(cx, cy), cx * CH * TILE, cy * CH * TILE);
  }
}
