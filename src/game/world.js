import { fbm, hash2, hashString, smoothstep } from './rng';
import { mapInfo, splitSeed } from './maps';
import { DREGION, KINDS, ZONE_TILE0, ZONE_TILE1, buildLayout, tierOf, zoneOf } from './dungeon';
import { APOC_DECOR, APOC_PROPS, DEPOT_PROPS, APOC_TREES, FORAGE_APOC, apocSize } from './apoc';

export const T = 16; // tile size in px
const FROST_TREES = ['tree_pine', 'tree_pine', 'tree_spruce'];
const CHEST_RATE = 0.0032; // chance a clear grass tile holds a chest: roughly one per chunk
export const CHUNK = 16; // tiles per chunk side
export const CHUNK_PX = T * CHUNK;

export const WATER = 0;
export const SAND = 1;
export const GRASS = 2;

const BIOMES = ['tidal', 'emerald', 'crystal', 'marsh', 'lava', 'beach', 'asphalt', 'mountain']; // the Patchwork Lands regions
const BIOME_LOW = { tidal: 0.1, emerald: 0.1, crystal: 0.04, marsh: 0.05, lava: 0.05, beach: 0.05, asphalt: 0, mountain: 0 }; // how far each sinks the ground
const SEA = 0.43;
const BEACH = 0.45;
const REGION = 18; // house sites are rolled once per region; small regions make cosy villages

// Source rects inside the provided sprite sheets
export const TREE_SPRITES = {
  large: { sx: 96, sy: 1, sw: 32, sh: 46, cw: 10, ch: 6 },
  medium: { sx: 71, sy: 14, sw: 20, sh: 33, cw: 8, ch: 5 },
  sapling: { sx: 43, sy: 34, sw: 9, sh: 12, cw: 0, ch: 0 },
  stump: { sx: 137, sy: 35, sw: 14, sh: 12, cw: 9, ch: 5 },
};
export const HOUSE_SPRITE = { sx: 148, sy: 3, sw: 72, sh: 95 };
const HOUSE_BASE = 86; // wall bottom inside the sprite

export const FORAGE = [
  { item: 'berry', sx: 80, sy: 16 },
  { item: 'leek', sx: 80, sy: 48 },
  { item: 'tuber', sx: 96, sy: 80 },
];

// Sunnyside mushrooms pop up in the woods instead
export const MUSHROOMS = [
  { item: 'mushroom_red', sheet: 'items/mushroom_red' },
  { item: 'mushroom_blue', sheet: 'items/mushroom_blue' },
];

const FLOWER_COLORS = ['#ff9ec7', '#ffffff', '#c9a7ff', '#ffd94a', '#ffb38a', '#9fd8ff'];

export class World {
  constructor(seedStr, { waves = false, theme = 'cozy' } = {}) {
    this.seedStr = String(seedStr);
    this.seed = hashString(this.seedStr);
    // the island maps (Tidal Isles, Emerald Isles and so on) are drawn with a tileset of their own: Free Roam picks it by the
    // start of the seed, and a Survival map names it
    this.tileset = theme === 'apoc' ? mapInfo(splitSeed(this.seedStr).map).tileset || null : /^tidal-/.test(this.seedStr) ? 'tidal' : /^emerald-/.test(this.seedStr) ? 'emerald' : /^crystal-/.test(this.seedStr) ? 'crystal' : /^marsh-/.test(this.seedStr) ? 'marsh' : /^lava-/.test(this.seedStr) ? 'lava' : /^beach-/.test(this.seedStr) ? 'beach' : /^asphalt-/.test(this.seedStr) ? 'asphalt' : /^mountain-/.test(this.seedStr) ? 'mountain' : /^mixed-/.test(this.seedStr) ? 'mixed' : /^wood-/.test(this.seedStr) ? 'wood' : null;
    // asphalt and mountain are not water tilesets: two kinds of walkable ground, laid out as winding roads and paths
    this.groundSet = this.tileset === 'asphalt' || this.tileset === 'mountain' || this.tileset === 'wood';
    this.mixed = this.tileset === 'mixed'; // the patchwork map: every tileset, in regions side by side
    this.biomeCache = new Map();
    this.tidal = !!this.tileset && !this.groundSet;
    this.lava = this.tileset === 'lava'; // the "water" here is lava: wading in it burns
    this.apoc = theme === 'apoc'; // Survival: the ruined, overgrown look from the Apocalypse pack
    this.map = this.apoc ? splitSeed(this.seedStr).map : 'meadow'; // Survival has more than one map
    this.frost = this.map === 'frost';
    this.depot = this.map === 'depot'; // the indoor map: a warehouse floor instead of open ground
    this.mapInfo = this.apoc ? mapInfo(this.map) : null;
    this.waveMode = waves; // one house in the middle instead of a scattering of cottages
    this.extraRects = []; // movable obstacles (the wave-defense barricades)
    this.chunks = new Map();
    this.felled = new Set(); // trees that have been cut down ("bx,by")
    this.treeHp = new Map(); // damage taken so far by trees that are still standing
    this.typeCache = new Map();
    this.siteCache = new Map();
    this.dsites = new Map(); // dungeon entrances
    this.activeZone = null; // the dungeon you are in (only that one is built)
    this.treeCache = new Map();
  }

  // Patchwork Lands: the world is cut into regions (nearest of some scattered points), and each region is one of the tilesets
  biomeAt(x, y) {
    const key = (x + 32768) * 65536 + (y + 32768);
    let b = this.biomeCache.get(key);
    if (b === undefined) {
      const S = 44;
      const cx = Math.floor(x / S);
      const cy = Math.floor(y / S);
      let best = Infinity;
      let pick = 0;
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          const gx = cx + i;
          const gy = cy + j;
          const px = (gx + hash2(gx, gy, this.seed + 7001)) * S;
          const py = (gy + hash2(gx, gy, this.seed + 7002)) * S;
          const d = (px - x) * (px - x) + (py - y) * (py - y);
          if (d < best) {
            best = d;
            pick = Math.floor(hash2(gx, gy, this.seed + 7003) * BIOMES.length);
          }
        }
      }
      b = BIOMES[pick];
      if (this.biomeCache.size > 300000) this.biomeCache.clear();
      this.biomeCache.set(key, b);
    }
    return b;
  }

  // water only where all the neighbours are in the same region, so a shore never sits on a region's edge
  biomeCalm(x, y) {
    const b = this.biomeAt(x, y);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) if (this.biomeAt(x + dx, y + dy) !== b) return false;
    }
    return true;
  }

  // is the water at this tile lava?
  lavaAt(tx, ty) {
    return this.lava || (this.mixed && this.biomeAt(tx, ty) === 'lava');
  }

  // the winding roads (or paths) of the asphalt and mountain maps: ridges of two noise fields, so they cross and branch
  roadAt(x, y) {
    if (this.tileset === 'wood') return fbm(x / 13, y / 13, this.seed + 3131, 3) > 0.5; // the wooden hall: wide patches of pale and dark boards
    const a = fbm(x / 24, y / 24, this.seed + 4141, 3);
    const b = fbm(x / 30, y / 30, this.seed + 5252, 3);
    return Math.abs(a - 0.5) < 0.034 || Math.abs(b - 0.5) < 0.034;
  }

  elevation(x, y) {
    const e = fbm(x / 44, y / 44, this.seed, 4);
    if (this.mixed) return e - BIOME_LOW[this.biomeAt(x, y)];
    // the island maps sit lower: a lot more sea, and the land breaks up into islands; the crystal lakes only a little
    return this.tileset === 'crystal' ? e - 0.04 : this.tileset === 'marsh' || this.tileset === 'lava' || this.tileset === 'beach' ? e - 0.05 : this.tidal ? e - 0.1 : e;
  }

  forest(x, y) {
    return fbm(x / 20, y / 20, this.seed + 77, 3);
  }

  type(x, y) {
    if (x >= ZONE_TILE0 && x < ZONE_TILE1 && y >= ZONE_TILE0 && y < ZONE_TILE1) return GRASS; // inside a dungeon
    const key = (x + 32768) * 65536 + (y + 32768);
    let t = this.typeCache.get(key);
    if (t === undefined) {
      const e = this.elevation(x, y);
      // Survival has no water: low ground is patchy dry dirt instead
      if (this.mixed) {
        const b = this.biomeAt(x, y);
        if (b === 'asphalt' || b === 'mountain') t = this.roadAt(x, y) || e < BEACH ? SAND : GRASS;
        else t = e < SEA && this.biomeCalm(x, y) ? WATER : e < BEACH ? SAND : GRASS;
      } else if (this.groundSet) t = this.roadAt(x, y) || e < BEACH ? SAND : GRASS; // (roads are open ground: nothing grows on them, and nothing is water)
      else t = this.depot ? GRASS : this.apoc ? (this.tileset && e < SEA ? WATER : e < BEACH && hash2(x, y, this.seed + 90) < 0.92 ? SAND : GRASS) : e < SEA ? WATER : e < BEACH ? SAND : GRASS;
      if (this.typeCache.size > 600000) this.typeCache.clear();
      this.typeCache.set(key, t);
    }
    return t;
  }

  // ---------- dungeons: crypts, caves and ruined houses in Free Roam ----------

  // one entrance per region, sometimes: on clear meadow, away from the cottages and the trees
  dungeonSite(drx, dry) {
    const key = `${drx},${dry}`;
    if (this.dsites.has(key)) return this.dsites.get(key);
    let site = null;
    if (!this.apoc && !this.waveMode && hash2(drx, dry, this.seed + 8800) < 0.55) {
      const kr = hash2(drx, dry, this.seed + 8801);
      const kind = kr < 0.4 ? 'crypt' : kr < 0.75 ? 'cave' : 'ruin';
      const x = drx * DREGION + 8 + Math.floor(hash2(drx, dry, this.seed + 8802) * 24);
      const y = dry * DREGION + 12 + Math.floor(hash2(drx, dry, this.seed + 8803) * 20);
      const rad = kind === 'ruin' ? 5 : 3;
      let ok = true;
      for (let ty = y - 6; ty <= y + 1 && ok; ty++) {
        for (let tx = x - rad; tx <= x + rad; tx++) {
          if (this.type(tx, ty) !== GRASS || this.elevation(tx, ty) < BEACH + 0.02 || this.isCleared(tx, ty)) {
            ok = false;
            break;
          }
        }
      }
      for (let by = (y - 6) >> 1; by <= (y + 1) >> 1 && ok; by++) {
        for (let bx = (x - rad) >> 1; bx <= (x + rad) >> 1; bx++) {
          if (this.treeAt(bx, by)) {
            ok = false;
            break;
          }
        }
      }
      if (ok) site = { x, y, kind, drx, dry };
    }
    this.dsites.set(key, site);
    return site;
  }

  dungeonKind(drx, dry) {
    return this.dungeonSite(drx, dry)?.kind || 'crypt';
  }

  dungeonLayout(rx, ry) {
    return buildLayout(this.seed, rx, ry, this.dungeonKind(rx, ry));
  }

  dungeonTier(rx, ry) {
    return tierOf(rx, ry);
  }

  // build only the dungeon you are in; throw away anything built for another one
  setActiveZone(z) {
    this.activeZone = z;
    for (const k of [...this.chunks.keys()]) {
      const [cx, cy] = k.split(',').map(Number);
      if (zoneOf(cx, cy)) this.chunks.delete(k);
    }
  }

  buildZoneChunk(cx, cy, z) {
    const chunk = { cx, cy, objects: [], rects: [], decor: [], zones: [], doors: [], zone: z };
    const az = this.activeZone;
    if (!az || az.rx !== z.rx || az.ry !== z.ry) return chunk;
    const L = this.dungeonLayout(z.rx, z.ry);
    const x0 = cx * CHUNK;
    const y0 = cy * CHUNK;
    for (let ty = 0; ty < CHUNK; ty++) {
      let run = -1;
      for (let tx = 0; tx <= CHUNK; tx++) {
        const wall = tx < CHUNK && L.isWall(x0 + tx - L.ox, y0 + ty - L.oy);
        if (wall && run < 0) run = tx;
        else if (!wall && run >= 0) {
          chunk.rects.push({ x: (x0 + run) * T, y: (y0 + ty) * T, w: (tx - run) * T, h: T });
          run = -1;
        }
      }
    }
    const here = (p) => Math.floor(p.x / (CHUNK * T)) === cx && Math.floor(p.y / (CHUNK * T)) === cy;
    if (here(L.exit)) chunk.objects.push({ kind: 'dexit', inter: 'dexit', id: `dx${z.rx},${z.ry}`, label: 'Space · leave the dungeon', x: L.exit.x, y: L.exit.y });
    for (const c of L.chests) if (here(c)) chunk.objects.push({ kind: 'chest', inter: 'chest', rich: true, boss: c.boss, id: `dc${z.rx},${z.ry}-${c.k}`, x: c.x, y: c.y });
    for (const t of L.torches) if (here(t)) chunk.objects.push({ kind: 'torch', x: t.x, y: t.y, y2: t.y });
    return chunk;
  }

  deepness(x, y) {
    const e = this.elevation(x, y);
    return e < SEA - 0.14 ? 2 : e < SEA - 0.07 ? 1 : 0;
  }

  // is the ground for a house at this site (in tiles) all meadow?
  siteIsClear(sx, sy) {
    for (let y = sy - 8; y <= sy + 4; y++) {
      for (let x = sx - 2; x <= sx + 7; x++) {
        if (this.type(x, y) !== GRASS || this.elevation(x, y) < BEACH + 0.02) return false;
      }
    }
    return true;
  }

  // Wave Defense: the one house, as close to the centre of the world as the meadows allow
  waveBase() {
    if (!this.base) {
      this.base = { x: -2, y: 3 };
      search: for (let r = 0; r < 120; r++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            if (this.siteIsClear(dx - 2, dy + 3)) {
              this.base = { x: dx - 2, y: dy + 3 };
              break search;
            }
          }
        }
      }
    }
    return this.base;
  }

  // A cottage is rolled per region and only kept if the ground around it is all meadow.
  houseSite(rx, ry) {
    const key = `${rx},${ry}`;
    if (this.siteCache.has(key)) return this.siteCache.get(key);
    let site = null;
    if (this.waveMode) {
      const b = this.waveBase();
      if (Math.floor(b.x / REGION) === rx && Math.floor(b.y / REGION) === ry) site = b;
    } else if (hash2(rx, ry, this.seed + 5) < 0.8) {
      const sx = rx * REGION + 3 + Math.floor(hash2(rx, ry, this.seed + 6) * (REGION - 12));
      const sy = ry * REGION + 9 + Math.floor(hash2(rx, ry, this.seed + 7) * (REGION - 14));
      if (this.siteIsClear(sx, sy)) site = { x: sx, y: sy };
    }
    this.siteCache.set(key, site);
    return site;
  }

  isCleared(x, y) {
    const rx = Math.floor(x / REGION);
    const ry = Math.floor(y / REGION);
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const s = this.houseSite(rx + i, ry + j);
        if (s && x >= s.x - 3 && x <= s.x + 8 && y >= s.y - 9 && y <= s.y + 5) return true;
      }
    }
    return false;
  }

  // Trees live on a 2x2 tile grid so their bases never overlap.
  treeAt(bx, by) {
    if (this.tileset === 'wood') return null; // (no trees growing through the floorboards)
    const key = `${bx},${by}`;
    if (this.treeCache.has(key)) return this.treeCache.get(key);
    let tree = null;
    if (this.depot) {
      this.treeCache.set(key, null); // no trees indoors
      return null;
    }
    const x = bx * 2;
    const y = by * 2;
    const f = this.forest(x + 1, y + 1);
    const p = 0.02 + 0.55 * smoothstep(0.5, 0.66, f);
    if (hash2(bx, by, this.seed + 11) < p) {
      let ok = !this.isCleared(x, y);
      for (let j = 0; j < 2 && ok; j++) {
        for (let i = 0; i < 2; i++) {
          if (this.type(x + i, y + j) !== GRASS || this.elevation(x + i, y + j) < BEACH + 0.015) ok = false;
        }
      }
      if (ok) {
        const r = hash2(bx, by, this.seed + 12);
        const kind = r < 0.5 ? 'large' : r < 0.8 ? 'medium' : r < 0.93 ? 'sapling' : 'stump';
        const jx = (hash2(bx, by, this.seed + 13) - 0.5) * 8;
        const jy = hash2(bx, by, this.seed + 14) * 6;
        tree = { kind, x: Math.round(bx * 32 + 16 + jx), y: Math.round(by * 32 + 20 + jy) };
      }
    }
    this.treeCache.set(key, tree);
    return tree;
  }

  // Wrecks, containers and other junk, on the same 2x2 grid the trees use
  addApocProps(chunk, x0, y0) {
    const s = this.seed;
    for (let by = y0 / 2; by < (y0 + CHUNK) / 2; by++) {
      for (let bx = x0 / 2; bx < (x0 + CHUNK) / 2; bx++) {
        if (hash2(bx, by, s + 71) > (this.depot ? 0.1 : this.frost ? 0.04 : 0.02) || this.treeAt(bx, by)) continue; // the frozen pass is littered with wrecks
        const x = bx * 2;
        const y = by * 2;
        if (this.isCleared(x, y) || this.type(x, y) !== GRASS || this.type(x + 1, y + 1) !== GRASS) continue;
        const list = this.depot ? DEPOT_PROPS : APOC_PROPS;
        const prop = list[Math.floor(hash2(bx, by, s + 72) * list.length)];
        const { w, h } = apocSize(prop.key);
        const px = bx * 32 + 16;
        const py = by * 32 + 24;
        chunk.objects.push({ kind: 'tree', sheet: `apoc/${prop.key}`, sx: 0, sy: 0, sw: w, sh: h, x: px, y: py });
        if (prop.solid) {
          const ch = Math.max(5, Math.min(14, Math.round(h * 0.4)));
          chunk.rects.push({ x: px - w / 2 + 2, y: py - ch - 1, w: Math.max(6, w - 4), h: ch });
        }
      }
    }
  }

  // supply fridges, things to pick up, and scattered ground details for one tile
  addApocTile(chunk, x, y, t, r) {
    if (t === WATER) return; // (the tileset maps have water: nothing grows or lies in it)
    const s = this.seed;
    if (this.treeAt(x >> 1, y >> 1)) return;
    if (t === GRASS && !this.isCleared(x, y)) {
      const spot = this.elevation(x, y) > BEACH + 0.02;
      const rr = hash2(x, y, s + 31);
      if (spot && rr < CHEST_RATE) {
        chunk.objects.push({ kind: 'chest', inter: 'chest', apoc: 'fridge', id: `c${x},${y}`, x: x * T + 8, y: y * T + 14 });
        chunk.rects.push({ x: x * T + 1, y: y * T + 6, w: 14, h: 7 });
        return;
      }
      if (spot && rr < 0.011) {
        const kind = FORAGE_APOC[Math.floor(hash2(x, y, s + 32) * FORAGE_APOC.length)];
        chunk.objects.push({ kind: 'forage', inter: 'forage', forage: kind, id: `f${x},${y}`, x: x * T + 8, y: y * T + 14 });
        return;
      }
    }
    if (!this.depot && r < (t === GRASS ? 0.11 : 0.05)) {
      const total = APOC_DECOR.reduce((n, d) => n + d[1], 0);
      let pick = hash2(x, y, s + 73) * total;
      let key = APOC_DECOR[0][0];
      for (const [k, w] of APOC_DECOR) {
        pick -= w;
        if (pick <= 0) {
          key = k;
          break;
        }
      }
      if (t !== GRASS && !key.startsWith('rock') && key !== 'stick') key = 'rock6';
      chunk.decor.push({
        kind: 'img',
        key,
        x: x * T + 8 + Math.floor((hash2(x, y, s + 74) - 0.5) * 8),
        y: y * T + 13 + Math.floor((hash2(x, y, s + 75) - 0.5) * 6),
      });
    }
  }

  // how many hits a tree takes before it falls
  treeMaxHp(kind) {
    return { large: 8, medium: 6, sapling: 3, stump: 2 }[kind] || 6;
  }

  // the cuttable trees near a point (a tree's trunk is at its base)
  treesNear(x, y, reach) {
    const out = [];
    const ccx = Math.floor(x / CHUNK_PX);
    const ccy = Math.floor(y / CHUNK_PX);
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        for (const o of this.getChunk(ccx + i, ccy + j).objects) {
          if (!o.tkey) continue;
          if (Math.hypot(o.x - x, o.y - 5 - y) <= reach) out.push(o);
        }
      }
    }
    return out;
  }

  // Damage a tree. Returns the hit points it has left (0: it fell, and is gone from the world).
  hurtTree(o, dmg) {
    const max = this.treeMaxHp(o.tk);
    const left = (this.treeHp.get(o.tkey) ?? max) - dmg;
    if (left > 0) {
      this.treeHp.set(o.tkey, left);
      return left;
    }
    this.treeHp.delete(o.tkey);
    this.felled.add(o.tkey);
    for (const c of this.chunks.values()) {
      if (c.objects.some((x) => x.tkey === o.tkey)) {
        c.objects = c.objects.filter((x) => x.tkey !== o.tkey);
        c.rects = c.rects.filter((x) => x.tkey !== o.tkey);
      }
    }
    return 0;
  }

  getChunk(cx, cy) {
    const key = `${cx},${cy}`;
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = this.buildChunk(cx, cy);
      this.chunks.set(key, chunk);
    }
    return chunk;
  }

  buildChunk(cx, cy) {
    const zone = zoneOf(cx, cy);
    if (zone) return this.buildZoneChunk(cx, cy, zone);
    const chunk = { cx, cy, objects: [], rects: [], decor: [], zones: [], doors: [] };
    const x0 = cx * CHUNK;
    const y0 = cy * CHUNK;
    const s = this.seed;

    for (let by = y0 / 2; by < (y0 + CHUNK) / 2; by++) {
      for (let bx = x0 / 2; bx < (x0 + CHUNK) / 2; bx++) {
        const tree = this.treeAt(bx, by);
        if (!tree) continue;
        const tkey = `${bx},${by}`;
        if (this.felled.has(tkey)) continue;
        if (this.apoc) {
          const kind = APOC_TREES[tree.kind];
          const keys = this.frost && tree.kind !== 'sapling' && tree.kind !== 'stump' ? FROST_TREES : kind.keys; // only pines survive the cold
          let key = keys[Math.floor(hash2(tree.x, tree.y, s + 15) * keys.length)];
          if (this.mapInfo?.trees && key !== 'stump') key = `${key}__${this.mapInfo.trees}`; // this map's own colours
          const { w, h } = apocSize(key);
          chunk.objects.push({ kind: 'tree', tkey, tk: tree.kind, sheet: `apoc/${key}`, sx: 0, sy: 0, sw: w, sh: h, x: tree.x, y: tree.y });
          if (kind.cw) chunk.rects.push({ tkey, x: tree.x - kind.cw / 2, y: tree.y - kind.ch - 2, w: kind.cw, h: kind.ch });
          continue;
        }
        const spr = TREE_SPRITES[tree.kind];
        chunk.objects.push({ kind: 'tree', tkey, tk: tree.kind, sheet: 'trees', sx: spr.sx, sy: spr.sy, sw: spr.sw, sh: spr.sh, x: tree.x, y: tree.y });
        if (spr.cw) chunk.rects.push({ tkey, x: tree.x - spr.cw / 2, y: tree.y - spr.ch - 2, w: spr.cw, h: spr.ch });
      }
    }

    if (this.apoc) this.addApocProps(chunk, x0, y0);

    for (let y = y0; y < y0 + CHUNK; y++) {
      for (let x = x0; x < x0 + CHUNK; x++) {
        const t = this.type(x, y);
        const r = hash2(x, y, s + 21);
        if (this.apoc) {
          this.addApocTile(chunk, x, y, t, r);
          continue;
        }
        if (t === GRASS && !this.treeAt(x >> 1, y >> 1) && !this.isCleared(x, y)) {
          const spot = this.elevation(x, y) > BEACH + 0.02;
          const rr = hash2(x, y, s + 31);
          if (spot && rr < CHEST_RATE) {
            chunk.objects.push({ kind: 'chest', inter: 'chest', id: `c${x},${y}`, x: x * T + 8, y: y * T + 14 });
            chunk.rects.push({ x: x * T + 1, y: y * T + 6, w: 14, h: 7 });
            continue;
          }
          if (spot && rr < 0.013) {
            const kinds = this.forest(x, y) > 0.56 ? MUSHROOMS : FORAGE;
            const kind = kinds[Math.floor(hash2(x, y, s + 32) * kinds.length)];
            chunk.objects.push({ kind: 'forage', inter: 'forage', forage: kind, id: `f${x},${y}`, x: x * T + 8, y: y * T + 14 });
            continue;
          }
        }
        if (t === GRASS) {
          if (this.treeAt(x >> 1, y >> 1)) continue;
          const px = x * T + Math.floor(hash2(x, y, s + 22) * 10) + 2;
          const py = y * T + Math.floor(hash2(x, y, s + 23) * 10) + 2;
          const near = this.forest(x, y) < 0.5 ? 0.09 : 0.04;
          if (r < near) {
            const color = FLOWER_COLORS[Math.floor(hash2(x, y, s + 24) * FLOWER_COLORS.length)];
            chunk.decor.push({ kind: 'flower', x: px, y: py, color });
          } else if (r < near + 0.08) {
            chunk.decor.push({ kind: 'tuft', x: px, y: py });
          }
        } else if (t === SAND && r < 0.05) {
          chunk.decor.push({ kind: 'pebble', x: x * T + Math.floor(hash2(x, y, s + 25) * 11) + 2, y: y * T + Math.floor(hash2(x, y, s + 26) * 11) + 2 });
        }
      }
    }

    // Cottage + its stepping-stone path
    const rx = Math.floor(cx * CHUNK / REGION);
    const ry = Math.floor(cy * CHUNK / REGION);
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const site = this.houseSite(rx + i, ry + j);
        if (!site) continue;
        if (Math.floor(site.x / CHUNK) !== cx || Math.floor(site.y / CHUNK) !== cy) continue;
        const left = site.x * T;
        const base = site.y * T;
        const id = `h${left},${base}`;
        if (this.apoc) {
          // Survival's base is a wrecked bus: a solid block in the middle of the barricade ring
          const bus = apocSize('bus');
          chunk.objects.push({ kind: 'tree', id, sheet: 'apoc/bus', sx: 0, sy: 0, sw: bus.w, sh: bus.h, x: left + bus.w / 2, y: base });
          const body = Math.round(bus.h * 0.55); // its footprint: the body, not the roof
          chunk.rects.push({ x: left + 2, y: base - body - 1, w: bus.w - 4, h: body, bus: true });
          continue;
        }
        chunk.objects.push({ kind: 'house', id, sheet: 'house', ...HOUSE_SPRITE, x: left + HOUSE_SPRITE.sw / 2, y: base, ox: left, oy: base - HOUSE_BASE });
        // Walls all round, with a 16px doorway in the front wall (the door is at x 41-56 of the sprite)
        chunk.rects.push(
          { x: left + 2, y: base - 42, w: HOUSE_SPRITE.sw - 4, h: 8 }, // back wall
          { x: left + 2, y: base - 42, w: 6, h: 40 }, // left wall
          { x: left + HOUSE_SPRITE.sw - 8, y: base - 42, w: 6, h: 40 }, // right wall
          { x: left + 2, y: base - 10, w: 38, h: 8 }, // front wall, left of the door
          { x: left + 56, y: base - 10, w: 14, h: 8 }, // front wall, right of the door
        );
        // the doorway and its sill, which a stranger may not step into
        chunk.doors.push({ id, x: left + 38, y: base - 36, w: 20, h: 38 });
        // the cosy indoors: standing here hides you
        chunk.zones.push({ id, x: left + 8, y: base - 34, w: HOUSE_SPRITE.sw - 16, h: 26 });
        for (let k = 0; k < 3; k++) {
          chunk.objects.push({
            kind: 'stone',
            ground: true,
            sheet: 'stones',
            sx: k * 16,
            sy: 0,
            sw: 16,
            sh: 16,
            ox: left + 40 + Math.round((hash2(site.x, k, s + 41) - 0.5) * 4),
            oy: base + 8 + k * 15,
            x: 0,
            y: 0,
          });
        }
      }
    }
    // a crypt, cave or ruined house to walk into
    if (!this.apoc && !this.waveMode) {
      const drx0 = Math.floor(x0 / DREGION);
      const dry0 = Math.floor(y0 / DREGION);
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          const ds = this.dungeonSite(drx0 + i, dry0 + j);
          if (!ds || Math.floor(ds.x / CHUNK) !== cx || Math.floor(ds.y / CHUNK) !== cy) continue;
          const px = ds.x * T + 8;
          const py = ds.y * T + 14;
          const half = ds.kind === 'ruin' ? 36 : 22;
          chunk.objects.push({ kind: 'dungeon', inter: 'dungeon', dkind: ds.kind, drx: ds.drx, dry: ds.dry, id: `dg${ds.x},${ds.y}`, label: KINDS[ds.kind].enter, x: px, y: py });
          chunk.rects.push({ x: px - half, y: py - 12, w: half * 2, h: 10 });
        }
      }
    }
    return chunk;
  }

  animalSpawns(cx, cy) {
    const out = [];
    if (zoneOf(cx, cy)) return out; // none underground
    if (this.apoc) return out; // no friendly farm animals in the apocalypse
    if (hash2(cx, cy, this.seed + 51) > 0.45) return out;
    const n = 1 + Math.floor(hash2(cx, cy, this.seed + 52) * 3);
    const cow = hash2(cx, cy, this.seed + 53) < 0.3;
    for (let i = 0; i < n; i++) {
      const tx = cx * CHUNK + Math.floor(hash2(cx, cy * 7 + i, this.seed + 54) * CHUNK);
      const ty = cy * CHUNK + Math.floor(hash2(cx * 7 + i, cy, this.seed + 55) * CHUNK);
      if (this.type(tx, ty) !== GRASS || this.treeAt(tx >> 1, ty >> 1) || this.isCleared(tx, ty)) continue;
      const variant = Math.floor(hash2(tx, ty, this.seed + 56) * 2);
      out.push({
        id: `${cx},${cy},${i}`,
        type: cow ? 'cow' : 'chicken',
        variant,
        x: tx * T + 8,
        y: ty * T + 12,
      });
    }
    return out;
  }

  // `wadeable` lets heroes paddle through water; skeletons and animals still treat it as a wall
  // `skipExtra` ignores the wave barricades, for things that are shot over the walls
  isBlocked(l, t, w, h, wadeable = false, skipExtra = false, skipBus = false) {
    if (!wadeable) {
      const x0 = Math.floor(l / T);
      const x1 = Math.floor((l + w - 1) / T);
      const y0 = Math.floor(t / T);
      const y1 = Math.floor((t + h - 1) / T);
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          if (this.type(x, y) === WATER) return true;
        }
      }
    }
    if (!skipExtra) for (const r of this.extraRects) {
      if (l < r.x + r.w && l + w > r.x && t < r.y + r.h && t + h > r.y) return true;
    }
    const ccx = Math.floor((l + w / 2) / CHUNK_PX);
    const ccy = Math.floor((t + h / 2) / CHUNK_PX);
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        for (const r of this.getChunk(ccx + i, ccy + j).rects) {
          if (skipBus && r.bus) continue; // shots fly over the bus
          if (l < r.x + r.w && l + w > r.x && t < r.y + r.h && t + h > r.y) return true;
        }
      }
    }
    return false;
  }

  // the indoor area of a house at this point, if any
  // the doorway of a house, if (x, y) is standing in it
  doorAt(x, y) {
    const ccx = Math.floor(x / CHUNK_PX);
    const ccy = Math.floor(y / CHUNK_PX);
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        for (const d of this.getChunk(ccx + i, ccy + j).doors) {
          if (x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h) return d;
        }
      }
    }
    return null;
  }

  houseAt(x, y) {
    const ccx = Math.floor(x / CHUNK_PX);
    const ccy = Math.floor(y / CHUNK_PX);
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        for (const z of this.getChunk(ccx + i, ccy + j).zones) {
          if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) return z;
        }
      }
    }
    return null;
  }

  // Houses around the middle of the world, nearest to the centre first. Everyone computes the
  // same list, so a player's slot number is enough to give each of them a different home.
  houseList() {
    if (!this.homes) {
      const sites = [];
      for (let ry = -8; ry <= 8; ry++) {
        for (let rx = -8; rx <= 8; rx++) {
          const s = this.houseSite(rx, ry);
          if (s) sites.push(s);
        }
      }
      sites.sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));
      this.homes = sites;
    }
    return this.homes;
  }

  // A tight group of `count` houses for a room's players to live in. Every client works out the
  // same group; `pick` (from the room code) chooses between the few most compact ones.
  homeCluster(count, pick) {
    const all = this.houseList();
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const groups = all.slice(0, 16).map((anchor) => {
      const group = [...all].sort((a, b) => dist(a, anchor) - dist(b, anchor)).slice(0, count);
      let span = 0;
      for (const a of group) for (const b of group) span = Math.max(span, dist(a, b));
      return { group, span };
    });
    groups.sort((a, b) => a.span - b.span || a.group[0].x - b.group[0].x || a.group[0].y - b.group[0].y);
    return groups[pick % Math.min(3, groups.length)].group;
  }

  // the doorstep, on the stepping stones in front of the door
  homePoint(site) {
    return this.apoc ? { x: site.x * T + 30, y: site.y * T + 14 } : { x: site.x * T + 48, y: site.y * T + 14 };
  }

  // a 5x5 patch of clear grass around this tile
  isOpenMeadow(dx, dy) {
    for (let j = -2; j <= 2; j++) {
      for (let i = -2; i <= 2; i++) {
        if (this.type(dx + i, dy + j) !== GRASS || this.treeAt((dx + i) >> 1, (dy + j) >> 1)) return false;
      }
    }
    return true;
  }

  findSpawn() {
    for (let radius = 0; radius < 300; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          if (this.isOpenMeadow(dx, dy)) return { x: dx * T + 8, y: dy * T + 12 };
        }
      }
    }
    return { x: 8, y: 12 };
  }

  // A skeleton camp, if this chunk has one: three of them stand guard on an open patch of meadow.
  // The same chunk always gives the same answer for a seed.
  campAt(cx, cy) {
    if (hash2(cx, cy, this.seed + 71) > 0.2) return null;
    const tx = cx * CHUNK + 4 + Math.floor(hash2(cx, cy, this.seed + 72) * (CHUNK - 8));
    const ty = cy * CHUNK + 4 + Math.floor(hash2(cx, cy, this.seed + 73) * (CHUNK - 8));
    if (Math.hypot(tx, ty) < 36) return null; // keep the neighbourhood around the first houses calm
    if (this.type(tx, ty) !== GRASS || !this.isOpenMeadow(tx, ty) || this.isCleared(tx, ty)) return null;
    return { x: tx * T + 8, y: ty * T + 12 };
  }

  // A different open meadow spot every time, within a couple hundred tiles of the world's centre
  randomSpawn() {
    for (let i = 0; i < 400; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 6 + Math.random() * 150;
      const tx = Math.round(Math.cos(ang) * dist);
      const ty = Math.round(Math.sin(ang) * dist);
      if (!this.isOpenMeadow(tx, ty) || this.isCleared(tx, ty)) continue;
      const x = tx * T + 8;
      const y = ty * T + 12;
      if (!this.isBlocked(x - 4, y - 5, 8, 5)) return { x, y };
    }
    return this.findSpawn();
  }
}
