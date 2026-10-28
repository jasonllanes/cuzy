import { hash2 } from './rng';

// Free Roam dungeons: crypts, caves and ruined houses you can walk into, with their own rooms, monsters and loot.
//
// Each one is a real stretch of the world, far off the map, so walking, fighting, monsters and drawing all work exactly
// as outside. Entering teleports you to your dungeon's entrance room; only the dungeon you are in is built.

export const DREGION = 40; // tiles: each region of the world may hold one entrance
export const ZBASE = 1500; // chunk coordinates of the far-off area the dungeons live in
export const ZW = 4; // chunks per dungeon
export const ZSPAN = 110; // how many regions each way
export const DW = 56; // tiles
export const DH = 44;
const CH = 16; // tiles per chunk

export const ZONE_TILE0 = (ZBASE - ZSPAN * ZW) * CH;
export const ZONE_TILE1 = (ZBASE + ZSPAN * ZW) * CH;

export const KINDS = {
  crypt: { name: 'Crypt', enter: 'Space · enter the crypt', rooms: 5 },
  cave: { name: 'Cave', enter: 'Space · enter the cave', rooms: 5 },
  ruin: { name: 'Ruined house', enter: 'Space · enter the ruined house', rooms: 3 },
};

// which dungeon (region) a chunk belongs to, if it is in the far-off area
export function zoneOf(cx, cy) {
  const lo = ZBASE - ZSPAN * ZW;
  const hi = ZBASE + ZSPAN * ZW;
  if (cx < lo || cx >= hi || cy < lo || cy >= hi) return null;
  return { rx: Math.floor((cx - ZBASE) / ZW), ry: Math.floor((cy - ZBASE) / ZW) };
}

// top-left tile of a dungeon's layout
export const originOf = (rx, ry) => ({ x: (ZBASE + rx * ZW) * CH + 4, y: (ZBASE + ry * ZW) * CH + 8 });

export const tierOf = (rx, ry) => Math.min(3, 1 + Math.floor(Math.hypot(rx, ry) / 1.5));

const cache = new Map();

// A chain of rooms joined by wide corridors. Floor cells are 1, everything else 0 (walls are drawn around the floor).
export function buildLayout(seed, rx, ry, kind) {
  const key = `${seed}:${rx},${ry}:${kind}`;
  if (cache.has(key)) return cache.get(key);
  const R = (k) => hash2(rx, ry, seed + 1000 + k);
  const n = KINDS[kind].rooms;
  const floor = new Uint8Array(DW * DH);
  const set = (x, y, v) => {
    if (x >= 1 && x < DW - 1 && y >= 1 && y < DH - 1) floor[y * DW + x] = v;
  };
  const colW = Math.floor((DW - 4) / n);
  const rooms = [];
  for (let i = 0; i < n; i++) {
    const w = Math.min(colW - 3, 8 + Math.floor(R(i * 5 + 1) * 5));
    const h = 8 + Math.floor(R(i * 5 + 2) * 9);
    const x = 2 + i * colW + Math.floor(R(i * 5 + 3) * Math.max(1, colW - w - 2));
    const y = 3 + Math.floor(R(i * 5 + 4) * (DH - 6 - h));
    rooms.push({ i, x, y, w, h, cx: x + Math.floor(w / 2), cy: y + Math.floor(h / 2) });
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) set(xx, yy, 1);
  }
  // pillars and rubble in every room but the first, then the corridors (which cut through anything in the way)
  rooms.forEach((r, i) => {
    if (i === 0) return;
    const count = Math.floor((r.w * r.h) / 38);
    for (let k = 0; k < count; k++) {
      const px = r.x + 1 + Math.floor(hash2(rx * 31 + k, ry, seed + 2000 + i) * (r.w - 3));
      const py = r.y + 1 + Math.floor(hash2(rx, ry * 31 + k, seed + 2100 + i) * (r.h - 3));
      for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) set(px + a, py + b, 0);
    }
  });
  for (let i = 0; i + 1 < n; i++) {
    const a = rooms[i];
    const b = rooms[i + 1];
    for (let x = Math.min(a.cx, b.cx); x <= Math.max(a.cx, b.cx); x++) for (let d = -1; d <= 1; d++) set(x, a.cy + d, 1);
    for (let y = Math.min(a.cy, b.cy); y <= Math.max(a.cy, b.cy); y++) for (let d = -1; d <= 1; d++) set(b.cx + d, y, 1);
  }
  // every treasure corner is kept clear
  rooms.forEach((r, i) => {
    if (i > 0) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) set(r.x + 1 + a, r.y + 1 + b, 1);
  });
  // the entrance room is kept clear
  const r0 = rooms[0];
  for (let yy = r0.y; yy < r0.y + r0.h; yy++) for (let xx = r0.x; xx < r0.x + r0.w; xx++) set(xx, yy, 1);

  const o = originOf(rx, ry);
  const px = (tx, ty) => ({ x: (o.x + tx) * 16 + 8, y: (o.y + ty) * 16 + 12 });
  const chests = [];
  const torches = [];
  rooms.forEach((r, i) => {
    if (i > 0) chests.push({ ...px(r.x + 1, r.y + 1), room: i, boss: i === n - 1, k: i });
    torches.push({ x: (o.x + r.x + 2) * 16 + 8, y: (o.y + r.y) * 16 + 6 }, { x: (o.x + r.x + r.w - 3) * 16 + 8, y: (o.y + r.y) * 16 + 6 });
  });
  const layout = {
    rx, ry, kind, w: DW, h: DH, ox: o.x, oy: o.y, floor, rooms, chests, torches,
    entry: px(r0.x + 3, r0.cy),
    exit: px(r0.x + 1, r0.cy),
    isFloor: (tx, ty) => tx >= 0 && ty >= 0 && tx < DW && ty < DH && floor[ty * DW + tx] === 1,
  };
  // wall = not floor, but touching the floor (everything else is black void)
  layout.isWall = (tx, ty) => {
    if (layout.isFloor(tx, ty)) return false;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (layout.isFloor(tx + i, ty + j)) return true;
    return false;
  };
  if (cache.size > 6) cache.clear();
  cache.set(key, layout);
  return layout;
}
