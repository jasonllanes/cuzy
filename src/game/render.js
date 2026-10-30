import { CHUNK, CHUNK_PX, T, WATER, GRASS } from './world';
import { GROUND_DIRT, GROUND_GRASS } from './apoc';
import { hash2 } from './rng';
import { frostPixels } from './assets';

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

// The warehouse map: poured concrete with seams, oil stains, hazard lines, and the odd crack
function renderDepotFloor(world, canvas, ctx, chunk) {
  const tones = ['#8e9096', '#868990', '#92949a', '#898b92'];
  for (let ty = 0; ty < CHUNK; ty++) {
    for (let tx = 0; tx < CHUNK; tx++) {
      const x = chunk.cx * CHUNK + tx;
      const y = chunk.cy * CHUNK + ty;
      const h = hash2(x, y, world.seed + 95);
      ctx.fillStyle = tones[Math.floor(h * tones.length)];
      ctx.fillRect(tx * T, ty * T, T, T);
      // slab seams every 4 tiles
      ctx.fillStyle = 'rgba(40,42,50,0.35)';
      if (x % 4 === 0) ctx.fillRect(tx * T, ty * T, 1, T);
      if (y % 4 === 0) ctx.fillRect(tx * T, ty * T, T, 1);
      // a yellow safety lane every 12 tiles
      if (y % 12 === 5) {
        ctx.fillStyle = 'rgba(230,190,40,0.75)';
        ctx.fillRect(tx * T, ty * T + 6, T, 2);
      }
      if (h < 0.05) {
        ctx.fillStyle = 'rgba(30,30,40,0.3)'; // oil
        ctx.fillRect(tx * T + 3, ty * T + 4, 10, 7);
        ctx.fillRect(tx * T + 5, ty * T + 3, 6, 9);
      } else if (h < 0.1) {
        ctx.fillStyle = 'rgba(40,42,50,0.5)'; // a crack
        ctx.fillRect(tx * T + 2, ty * T + 5, 5, 1);
        ctx.fillRect(tx * T + 6, ty * T + 6, 4, 1);
        ctx.fillRect(tx * T + 9, ty * T + 7, 4, 1);
      }
    }
  }
  return canvas;
}

// Survival: every tile is a 16px square cut from the Apocalypse ground tileset
function renderApocChunk(world, img, chunk) {
  const canvas = document.createElement('canvas');
  canvas.width = CHUNK_PX;
  canvas.height = CHUNK_PX;
  const ctx = canvas.getContext('2d');
  const sheet = img[`apoc/${world.mapInfo?.ground === 'concrete' ? 'bg' : world.mapInfo?.ground || 'bg'}`];
  if (world.depot) return renderDepotFloor(world, canvas, ctx, chunk);
  for (let ty = 0; ty < CHUNK; ty++) {
    for (let tx = 0; tx < CHUNK; tx++) {
      const x = chunk.cx * CHUNK + tx;
      const y = chunk.cy * CHUNK + ty;
      const cells = world.type(x, y) === GRASS ? GROUND_GRASS : GROUND_DIRT;
      const [cx, cy] = cells[Math.floor(hash2(x, y, world.seed + 95) * cells.length)];
      ctx.drawImage(sheet, cx * 16, cy * 16, 16, 16, tx * T, ty * T, 16, 16);
    }
  }
  if (world.frost) {
    // snow over everything: a pale wash, frozen mud where the ground is bare, and a sprinkling of drifts
    frostPixels(ctx, CHUNK_PX, CHUNK_PX, 0.88);
    for (let ty = 0; ty < CHUNK; ty++) {
      for (let tx = 0; tx < CHUNK; tx++) {
        const x = chunk.cx * CHUNK + tx;
        const y = chunk.cy * CHUNK + ty;
        if (world.type(x, y) !== GRASS) {
          ctx.fillStyle = 'rgba(105,140,195,0.34)';
          ctx.fillRect(tx * T, ty * T, T, T);
        }
        const h = hash2(x, y, world.seed + 96);
        if (h < 0.3) {
          ctx.fillStyle = h < 0.1 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)';
          ctx.fillRect(tx * T + Math.floor(h * 90) % 11, ty * T + Math.floor(h * 400) % 12, 3 + (Math.floor(h * 50) % 3), 2);
        }
      }
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

// The floor and walls of the dungeon you are in. Only the dungeon you are in has any; the rest is black.
function renderDungeonFloor(world, canvas, ctx, chunk) {
  ctx.fillStyle = '#0b090e';
  ctx.fillRect(0, 0, CHUNK_PX, CHUNK_PX);
  const az = world.activeZone;
  if (!az || az.rx !== chunk.zone.rx || az.ry !== chunk.zone.ry) return canvas;
  const L = world.dungeonLayout(az.rx, az.ry);
  const pal = {
    crypt: { floor: ['#555a6e', '#5b6076', '#50556a', '#5f647a'], seam: 'rgba(20,22,34,0.35)', wall: '#2b2d3d', top: '#454860', hi: '#5d6079' },
    cave: { floor: ['#6b5a46', '#725f4a', '#645441', '#6e5c47'], seam: 'rgba(30,20,12,0.3)', wall: '#2f2620', top: '#4a3d31', hi: '#5c4c3d' },
    ruin: { floor: ['#9a7448', '#a07a4e', '#946d42', '#a47e52'], seam: 'rgba(60,35,15,0.4)', wall: '#4a3020', top: '#6e4a2c', hi: '#8a6038' },
  }[L.kind];
  for (let ty = 0; ty < CHUNK; ty++) {
    for (let tx = 0; tx < CHUNK; tx++) {
      const wx = chunk.cx * CHUNK + tx;
      const wy = chunk.cy * CHUNK + ty;
      const lx = wx - L.ox;
      const ly = wy - L.oy;
      const h = hash2(wx, wy, world.seed + 97);
      if (L.isFloor(lx, ly)) {
        ctx.fillStyle = pal.floor[Math.floor(h * pal.floor.length)];
        ctx.fillRect(tx * T, ty * T, T, T);
        ctx.fillStyle = pal.seam;
        if (L.kind === 'ruin') ctx.fillRect(tx * T, ty * T + 15, T, 1);
        else {
          ctx.fillRect(tx * T, ty * T, T, 1);
          ctx.fillRect(tx * T, ty * T, 1, T);
        }
        if (h < 0.06) {
          ctx.fillStyle = 'rgba(235,230,215,0.8)'; // bones
          ctx.fillRect(tx * T + 4, ty * T + 6, 5, 1);
          ctx.fillRect(tx * T + 6, ty * T + 4, 1, 5);
          ctx.fillRect(tx * T + 10, ty * T + 9, 3, 1);
        } else if (h < 0.1) {
          ctx.fillStyle = pal.seam;
          ctx.fillRect(tx * T + 3, ty * T + 5, 6, 1);
          ctx.fillRect(tx * T + 8, ty * T + 6, 4, 1);
        }
      } else if (L.isWall(lx, ly)) {
        ctx.fillStyle = pal.wall;
        ctx.fillRect(tx * T, ty * T, T, T);
        ctx.fillStyle = pal.top;
        ctx.fillRect(tx * T, ty * T, T, T - 3);
        ctx.fillStyle = pal.hi;
        ctx.fillRect(tx * T, ty * T, T, 2);
        if (L.kind !== 'cave') {
          ctx.fillStyle = pal.wall;
          ctx.fillRect(tx * T, ty * T + 7, T, 1);
          ctx.fillRect(tx * T + ((wy % 2) ? 4 : 10), ty * T, 1, 7);
        } else if (h < 0.4) {
          ctx.fillStyle = pal.hi;
          ctx.fillRect(tx * T + 3 + Math.floor(h * 20), ty * T + 5, 4, 3);
        }
      }
    }
  }
  return canvas;
}

// the little flowers, tufts and pebbles scattered over the ground
function drawDecor(ctx, chunk, img) {
  const ox = chunk.cx * CHUNK_PX;
  const oy = chunk.cy * CHUNK_PX;
  for (const d of chunk.decor) {
    const x = d.x - ox;
    const y = d.y - oy;
    if (d.kind === 'img') {
      // Survival's rubble, rocks and weeds
      const image = img[`apoc/${d.key}`];
      ctx.drawImage(image, Math.round(d.x - ox - image.width / 2), Math.round(d.y - oy - image.height));
      continue;
    }
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
}

// The island maps' tilesets (public/assets/maps/tidal.png and emerald.png) are 4x4 tiles of 16px, one for each way water and ground can meet at
// the four corners of a tile. Key = topLeft * 8 + topRight * 4 + bottomLeft * 2 + bottomRight (1 = ground), value = [col, row].
const TIDAL = { 0: [0, 3], 1: [1, 3], 2: [0, 0], 3: [3, 0], 4: [0, 2], 5: [1, 0], 6: [2, 3], 7: [1, 1], 8: [3, 3], 9: [0, 1], 10: [3, 2], 11: [2, 0], 12: [1, 2], 13: [2, 2], 14: [3, 1], 15: [2, 1] };

// Each tile is drawn half a tile off the world grid, centred on the meeting point of four world tiles, so every tile
// looks at those four to pick its edge. The chunk draws one extra row and column, because the tiles on its border straddle its neighbours.
function renderTidalChunk(world, img, chunk) {
  const canvas = document.createElement('canvas');
  canvas.width = CHUNK_PX;
  canvas.height = CHUNK_PX;
  const ctx = canvas.getContext('2d');
  // Crystal Lakes, Mossy Marsh, Magma Fields and Sunny Shores are drawn the other way round: the water is the shape, with the ground all around it
  const FLIPPED = ['crystal', 'marsh', 'lava', 'beach'];
  // which of the tileset's two kinds of ground a world tile is: 1 for the "shape" kind, 0 for the one around it
  const bit = (set, x, y) => {
    if (set === 'asphalt' || set === 'wood') return world.roadAt(x, y) ? 1 : 0; // the road (or the pale boards) is the shape
    if (set === 'mountain') return world.roadAt(x, y) ? 0 : 1; // the grass is the shape
    const water = world.type(x, y) === WATER;
    return FLIPPED.includes(set) ? (water ? 1 : 0) : water ? 0 : 1;
  };
  for (let ty = 0; ty <= CHUNK; ty++) {
    for (let tx = 0; tx <= CHUNK; tx++) {
      const x = chunk.cx * CHUNK + tx;
      const y = chunk.cy * CHUNK + ty;
      const set = world.mixed ? world.biomeAt(x, y) : world.tileset; // (in the patchwork map every tile belongs to a region)
      const key = bit(set, x - 1, y - 1) * 8 + bit(set, x, y - 1) * 4 + bit(set, x - 1, y) * 2 + bit(set, x, y);
      const [c, r] = TIDAL[key];
      ctx.drawImage(img[`maps/${set}`], c * T, r * T, T, T, tx * T - T / 2, ty * T - T / 2, T, T);
    }
  }
  if (world.tileset !== 'wood') drawDecor(ctx, chunk, img); // (no flowers or tufts on a wooden floor)
  return canvas;
}

export function renderChunk(world, img, chunk) {
  if (chunk.zone) {
    const c = document.createElement('canvas');
    c.width = CHUNK_PX;
    c.height = CHUNK_PX;
    return renderDungeonFloor(world, c, c.getContext('2d'), chunk);
  }
  if (world.tileset) return renderTidalChunk(world, img, chunk); // (Survival's tileset maps too)
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

  drawDecor(ctx, chunk, img);
  return canvas;
}
