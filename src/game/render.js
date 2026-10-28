import { CHUNK, CHUNK_PX, T, WATER, GRASS } from './world';
import { GROUND_DIRT, GROUND_GRASS } from './apoc';
import { hash2 } from './rng';

// Quadrant table for the 4x4-style grass autotile in the pack.
// Each entry is [cellX, cellY] in tiles; the quadrant offset is added separately.
const FULL = [9, 2];
const Q = {
  tl: { outer: [8, 0], h: [10, 0], v: [8, 1], inner: [9, 1], ox: 0, oy: 0 },
  tr: { outer: [11, 0], h: [10, 0], v: [11, 1], inner: [10, 2], ox: 8, oy: 0 },
  bl: { outer: [8, 3], h: [9, 3], v: [8, 2], inner: [10, 2], ox: 0, oy: 8 },
  br: { outer: [11, 3], h: [9, 3], v: [11, 2], inner: [9, 1], ox: 8, oy: 8 },
};

function quad(ctx, sheet, q, hasH, hasV, hasD, dx, dy) {
  // hasH: neighbour above/below (the horizontal edge side) is land; hasV: neighbour left/right is land
  let cell;
  if (!hasH && !hasV) cell = q.outer;
  else if (!hasH) cell = q.h;
  else if (!hasV) cell = q.v;
  else if (!hasD) cell = q.inner;
  else cell = FULL;
  ctx.drawImage(sheet, cell[0] * T + q.ox, cell[1] * T + q.oy, 8, 8, dx + q.ox, dy + q.oy, 8, 8);
}

function drawAuto(ctx, sheet, dx, dy, x, y, mask) {
  const n = mask(x, y - 1);
  const s = mask(x, y + 1);
  const w = mask(x - 1, y);
  const e = mask(x + 1, y);
  quad(ctx, sheet, Q.tl, n, w, mask(x - 1, y - 1), dx, dy);
  quad(ctx, sheet, Q.tr, n, e, mask(x + 1, y - 1), dx, dy);
  quad(ctx, sheet, Q.bl, s, w, mask(x - 1, y + 1), dx, dy);
  quad(ctx, sheet, Q.br, s, e, mask(x + 1, y + 1), dx, dy);
}

// Survival: every tile is a 16px square cut from the Apocalypse ground tileset
function renderApocChunk(world, img, chunk) {
  const canvas = document.createElement('canvas');
  canvas.width = CHUNK_PX;
  canvas.height = CHUNK_PX;
  const ctx = canvas.getContext('2d');
  const sheet = img['apoc/bg'];
  for (let ty = 0; ty < CHUNK; ty++) {
    for (let tx = 0; tx < CHUNK; tx++) {
      const x = chunk.cx * CHUNK + tx;
      const y = chunk.cy * CHUNK + ty;
      const cells = world.type(x, y) === GRASS ? GROUND_GRASS : GROUND_DIRT;
      const [cx, cy] = cells[Math.floor(hash2(x, y, world.seed + 95) * cells.length)];
      ctx.drawImage(sheet, cx * 16, cy * 16, 16, 16, tx * T, ty * T, 16, 16);
    }
  }
  const ox = chunk.cx * CHUNK_PX;
  const oy = chunk.cy * CHUNK_PX;
  for (const d of chunk.decor) {
    const image = img[`apoc/${d.key}`];
    ctx.drawImage(image, Math.round(d.x - ox - image.width / 2), Math.round(d.y - oy - image.height));
  }
  return canvas;
}

export function renderChunk(world, img, chunk) {
  if (world.apoc) return renderApocChunk(world, img, chunk);
  const canvas = document.createElement('canvas');
  canvas.width = CHUNK_PX;
  canvas.height = CHUNK_PX;
  const ctx = canvas.getContext('2d');
  const isLand = (x, y) => world.type(x, y) !== WATER;
  const isGrass = (x, y) => world.type(x, y) === GRASS;

  for (let ty = 0; ty < CHUNK; ty++) {
    for (let tx = 0; tx < CHUNK; tx++) {
      const x = chunk.cx * CHUNK + tx;
      const y = chunk.cy * CHUNK + ty;
      const t = world.type(x, y);
      if (t === WATER) {
        const d = world.deepness(x, y);
        if (d) {
          ctx.fillStyle = d === 1 ? 'rgba(60,120,200,0.14)' : 'rgba(40,90,180,0.26)';
          ctx.fillRect(tx * T, ty * T, T, T);
        }
        continue;
      }
      drawAuto(ctx, img.sand, tx * T, ty * T, x, y, isLand);
      if (t === GRASS) drawAuto(ctx, img.grass, tx * T, ty * T, x, y, isGrass);
    }
  }

  const ox = chunk.cx * CHUNK_PX;
  const oy = chunk.cy * CHUNK_PX;
  for (const d of chunk.decor) {
    const x = d.x - ox;
    const y = d.y - oy;
    if (d.kind === 'flower') {
      ctx.fillStyle = '#4f9a4a';
      ctx.fillRect(x + 1, y + 3, 1, 2);
      ctx.fillStyle = d.color;
      ctx.fillRect(x + 1, y, 1, 1);
      ctx.fillRect(x, y + 1, 1, 1);
      ctx.fillRect(x + 2, y + 1, 1, 1);
      ctx.fillRect(x + 1, y + 2, 1, 1);
      ctx.fillStyle = '#ffe27a';
      ctx.fillRect(x + 1, y + 1, 1, 1);
    } else if (d.kind === 'tuft') {
      ctx.fillStyle = '#4b9648';
      ctx.fillRect(x, y, 1, 2);
      ctx.fillRect(x + 2, y, 1, 2);
      ctx.fillRect(x + 1, y + 1, 1, 1);
      ctx.fillStyle = '#9ad86f';
      ctx.fillRect(x + 1, y, 1, 1);
    } else if (d.kind === 'pebble') {
      ctx.fillStyle = '#b79b6e';
      ctx.fillRect(x, y + 1, 3, 2);
      ctx.fillStyle = '#e6d3a8';
      ctx.fillRect(x, y + 1, 2, 1);
    }
  }
  return canvas;
}
