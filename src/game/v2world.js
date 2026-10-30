import { hash2 } from './rng';
import { DREGION } from './dungeon';
import { loadTheme, loadedThemes } from '../v2/assets';
import { CONTAINER, footprint, isFlat } from '../v2/world';

// Free Roam V2: the same world as Free Roam (the same land, houses, trees, caves and chests), with the Modern Exteriors props added
// on top. Some of them are things to open (bins, crates, ATMs...), some are buildings you can walk into, some are just scenery.
// A V2 world is a world whose seed ends with "~v2". Everything here is a pure function of the seed, so rooms agree on it.

export const isV2Seed = (s) => /~v2$/.test(String(s));
export const stripV2 = (s) => String(s).replace(/~v2$/, '');

const THEMES = ['props', 'vehicles', 'houses', 'villas', 'shops', 'garden', 'camping', 'graveyard', 'police', 'fire', 'hotel', 'school', 'garage', 'military', 'worksite'];

// the atlases become images the engine can draw as `v2/<theme>`
export async function loadV2Images(img) {
  await Promise.all(THEMES.map(async (id) => {
    const t = await loadTheme(id);
    img[`v2/${id}`] = t.img;
  }));
}

const cache = new Map();
const list = (theme, re, test) => {
  const key = `${theme}|${re.source}|${test || ''}`;
  if (!cache.has(key)) cache.set(key, (loadedThemes.get(theme)?.items || []).filter((s) => re.test(s.name) && (!test || test(s))).sort((a, b) => a.name.localeCompare(b.name)));
  return cache.get(key);
};

const BAD_HOUSE = /Door|Sign|Balcony|Umbrella|Banister|Roof|Canopy|Base|Basement|Wind|Solar|Modular|Side|Open|Styling|Lantern|Pole|Haunted|Apocalyptic|Chimney|Ladder|Window|Yard|Doormat|Toy|Tree|Hanging|Potted|Propeller|Picnic|Lemonade/;

// ---- the kinds of places ----
// each: how big it is (tiles), and how to fill it. `s` is the main sprite.
const KINDS = [
  { id: 'house', weight: 26, enter: 'house', pick: (r) => { const l = [...list('houses', /House/, (s) => s.w >= 128 && s.h >= 160 && s.h <= 260 && !BAD_HOUSE.test(s.name)), ...list('villas', /^Villa(_\d+)?$/)]; return l[Math.floor(r(1) * l.length)]; } },
  { id: 'shop', weight: 20, enter: 'shop', pick: (r) => { const l = list('shops', /^Market_(Big|Medium|Small)_\d+$/); return l[Math.floor(r(1) * l.length)]; } },
  { id: 'civic', weight: 8, enter: 'civic', pick: (r) => { const l = [...list('police', /^Police_Station_[123]$/), ...list('fire', /^Building$/), ...list('hotel', /^(Hospital|Hotel)_1$/), ...list('school', /^School_1$/)]; return l[Math.floor(r(1) * l.length)]; } },
  { id: 'gas', weight: 9, min: [24, 18], pick: (r) => { const l = list('vehicles', /^Gas_Station_[12]$/); return l[Math.floor(r(1) * l.length)]; } },
  { id: 'camp', weight: 16, min: [22, 20], pick: (r) => { const l = list('camping', /^Tent_\d+$/); return l[Math.floor(r(1) * l.length)]; } },
  { id: 'park', weight: 14, min: [22, 20], pick: () => list('garden', /^Fountain/)[0] },
  { id: 'junk', weight: 14, min: [22, 18], pick: (r) => { const l = list('props', /^Dumpster/); return l[Math.floor(r(1) * l.length)]; } },
  { id: 'graves', weight: 9, min: [20, 20], pick: (r) => { const l = list('graveyard', /^Medium_Gate(_\d+)?$/); return l[Math.floor(r(1) * l.length)]; } },
];
const TOTAL = KINDS.reduce((n, k) => n + k.weight, 0);
const CELL = 30; // a place is rolled per 30x30 tiles

export const BUILDING_NAMES = { house: ['Cosy House', 'Family Home', 'Little House', 'Old Villa'], shop: ['General Store', 'Corner Market', 'Fruit Stand', 'Trading Post'], civic: ['Town Hall', 'Clinic', 'Station', 'Old School'] };

// what a container gives
const lootKind = (name) => (/ATM/i.test(name) ? 'atm' : /Vending/i.test(name) ? 'food' : /Mailbox/i.test(name) ? 'mail' : /Dumpster|Trash/i.test(name) ? 'junk' : /Coffin/i.test(name) ? 'grave' : 'supply');

// ---- placing the places ----

function place(world, ci, cj) {
  const key = `${ci},${cj}`;
  world.v2cells ||= new Map();
  if (world.v2cells.has(key)) return world.v2cells.get(key);
  const seed = world.seed;
  const r = (k) => hash2(ci * 31 + k, cj * 17 + k * 3, seed + 9200 + k * 7);
  let out = null;
  if (r(0) < 0.8) {
    let pick = r(2) * TOTAL;
    const kind = KINDS.find((k) => (pick -= k.weight) <= 0) || KINDS[0];
    const s = kind.pick(r);
    if (s) {
      const sw = Math.ceil(s.w / 16);
      const sh = Math.ceil(s.h / 16);
      // the ground that must be clear is the main thing itself (a cluster only needs its middle); the little things around it
      // are each dropped where a tree, the water or a cottage yard is in the way
      const cluster = !!kind.min;
      const W = Math.min(CELL - 2, cluster ? 10 : sw + 2);
      const H = Math.min(CELL - 2, cluster ? 10 : sh + 3);
      const BW = Math.min(CELL - 2, Math.max(sw + 6, kind.min?.[0] || 0)); // (the room the place takes, for the sprites around it)
      for (let k = 0; k < 28 && !out; k++) {
        const ox = ci * CELL + 1 + Math.floor(r(30 + k * 2) * (CELL - BW - 1)) + Math.floor((BW - W) / 2);
        const oy = cj * CELL + 1 + Math.floor(r(31 + k * 2) * (CELL - (H + 4) - 1));
        if (spotOk(world, ox, oy, W, H, kind)) out = { kind, s, ox: ox - Math.floor((BW - W) / 2), oy, W: BW, H, ci, cj, r };
      }
    }
  }
  world.v2cells.set(key, out);
  return out;
}

// clear meadow, no cottage yard, no entrance or camp nearby, no trees, and not on top of the starting spot
function spotOk(world, ox, oy, W, H) {
  if (Math.hypot(ox + W / 2, oy + H / 2) < 18 + Math.max(W, H) / 2) return false;
  for (let y = oy; y < oy + H; y += 2) {
    for (let x = ox; x < ox + W; x += 2) {
      if (world.type(x, y) !== 2 || world.elevation(x, y) < 0.46 || world.isCleared(x, y)) return false;
      if (world.treeAt(x >> 1, y >> 1)) return false;
    }
  }
  const cx0 = Math.floor(ox / 16) - 1;
  const cx1 = Math.floor((ox + W) / 16) + 1;
  const cy0 = Math.floor(oy / 16) - 1;
  const cy1 = Math.floor((oy + H) / 16) + 1;
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      const c = world.campAt(cx, cy);
      if (c && c.x / 16 > ox - 5 && c.x / 16 < ox + W + 5 && c.y / 16 > oy - 8 && c.y / 16 < oy + H + 5) return false;
    }
  }
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const d = world.dungeonSite(Math.floor(ox / DREGION) + i, Math.floor(oy / DREGION) + j);
      if (d && d.x > ox - 8 && d.x < ox + W + 8 && d.y > oy - 8 && d.y < oy + H + 8) return false;
    }
  }
  return true;
}

// the sprites of one place, as [sprite, tileX, tileY (bottom centre), extra]
function fill(P) {
  const { kind, s, ox, oy, W, H, r } = P;
  const out = [];
  const add = (sp, tx, ty, extra) => sp && out.push([sp, tx, ty, extra]);
  const sw = s.w / 16;
  const sh = s.h / 16;
  const cx = ox + W / 2;
  const top = oy + 1;
  const feet = top + sh; // the bottom of the main sprite
  const one = (theme, re, k, test) => {
    const l = list(theme, re, test);
    return l.length ? l[Math.floor(r(k) * l.length)] : null;
  };
  const dec = (theme, re, k, tx, ty) => add(one(theme, re, k), tx, ty);
  switch (kind.id) {
    case 'house': {
      add(s, cx, feet, { enter: P.kind.enter, name: BUILDING_NAMES.house[Math.floor(r(5) * 4)] });
      dec('props', /^Mailbox/, 6, cx - sw / 2 - 1.5, feet + 2.5);
      dec('villas', /Yard_Flowers|Potted|Hanging/, 7, cx + sw / 2 + 1.5, feet + 1);
      dec('props', /^(Black|Green|Blue)_Closed_Trash_Can$/, 8, cx + sw / 2 + 2.5, feet + 2.5);
      dec('props', /^Bench_\d/, 9, cx - 3, feet + 5);
      if (r(10) < 0.5) dec('vehicles', /^Car_(Left|Right)_\d+$/, 11, cx + sw / 2 + 5, feet + 5);
      break;
    }
    case 'shop': {
      add(s, cx, feet, { enter: 'shop', name: BUILDING_NAMES.shop[Math.floor(r(5) * 4)] });
      dec('props', /^Vending/, 6, cx + sw / 2 + 1.5, feet + 1.5);
      dec('props', /^ATM/, 7, cx - sw / 2 - 1.5, feet + 1.5);
      dec('garage', /^(Table|Box)/, 8, cx - 4, feet + 5);
      dec('garage', /^(Table|Box|Cloth)/, 9, cx + 4, feet + 5);
      dec('props', /^Dumpster/, 10, cx + sw / 2 + 3, feet + 4);
      break;
    }
    case 'civic': {
      add(s, cx, feet, { enter: 'civic', name: BUILDING_NAMES.civic[Math.floor(r(5) * 4)] });
      dec('props', /^Bench_\d/, 6, cx - 4, feet + 5);
      dec('props', /^Hydrant/, 7, cx + sw / 2 + 1, feet + 2);
      dec('props', /^Phone_Booth/, 8, cx - sw / 2 - 1.5, feet + 3);
      dec('vehicles', /^Ambulance_(Left|Right)/, 9, cx + sw / 2 + 5, feet + 6);
      break;
    }
    case 'gas': {
      add(s, cx, feet);
      dec('vehicles', /^Gas_Station_Petrol_Pump_\d/, 6, cx - 5, feet + 4);
      dec('vehicles', /^Gas_Station_Petrol_Pump_\d/, 7, cx + 3, feet + 4);
      dec('props', /^Barrel(_\d+)?$/, 8, cx + sw / 2 + 2, feet + 1);
      dec('props', /^Barrel(_\d+)?$/, 9, cx + sw / 2 + 3.5, feet + 2);
      dec('vehicles', /^Car_(Left|Right)_\d+$/, 10, cx + 8, feet + 7);
      dec('props', /^Dumpster/, 11, cx - sw / 2 - 2, feet + 1);
      break;
    }
    case 'camp': {
      add(s, cx - 4, top + 8);
      dec('camping', /^Tent_\d+$/, 6, cx + 4, top + 9);
      dec('camping', /^Campfire(_\d+)?$/, 7, cx, top + 13);
      dec('camping', /^Benched_Table/, 8, cx - 5, top + 15);
      dec('camping', /^Sleeping_Bag/, 9, cx + 6, top + 14);
      dec('military', /^Military_Tent_Box_\d_Open|^Military_Tent_Locker/, 10, cx + 2, top + 16);
      dec('camping', /^Rock/, 11, cx - 8, top + 12);
      break;
    }
    case 'park': {
      add(s, cx, top + 7);
      dec('garden', /^(Square_Bench|Medium_Bench_Horizontal)/, 6, cx - 6, top + 11);
      dec('garden', /^(Square_Bench|Medium_Bench_Horizontal)/, 7, cx + 6, top + 11);
      dec('garden', /Flower.*Vase$|^Big_.*Flower$/, 8, cx - 3, top + 3);
      dec('garden', /Flower.*Vase$|^Big_.*Flower$/, 9, cx + 3, top + 3);
      dec('garden', /^Bush(_\d+)?$/, 10, cx - 8, top + 6);
      dec('garden', /^Bush(_\d+)?$/, 11, cx + 8, top + 6);
      dec('garden', /^Statue/, 12, cx, top + 14);
      break;
    }
    case 'junk': {
      add(s, cx - 2, top + 5);
      dec('vehicles', /^Car_(Left|Right)_\d+$/, 6, cx + 5, top + 8);
      dec('vehicles', /^Car_(Left|Right)_\d+$/, 7, cx - 6, top + 11);
      dec('props', /^Barrel(_\d+)?$/, 8, cx + 1, top + 10);
      dec('props', /^Barrel(_\d+)?$/, 9, cx + 2.5, top + 10.5);
      dec('props', /^Container(_\d+)?$/, 10, cx + 8, top + 5);
      dec('props', /^Trash_Pile(_\d+)?$/, 11, cx - 8, top + 6);
      dec('props', /^Cone$/, 12, cx - 3, top + 13);
      break;
    }
    case 'graves': {
      add(s, cx, top + 4);
      const graves = list('graveyard', /^(Small_(Black|Brown|Grey)_Tombstone|(Black|Brown|Grey|Wood)_Cross)/);
      for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) if (r(20 + j * 4 + i) > 0.2) add(graves[Math.floor(r(40 + j * 4 + i) * graves.length)], cx - 6 + i * 4, top + 9 + j * 4);
      dec('graveyard', /^Marble_(Brown|Grey)_Coffin/, 13, cx + 7, top + 6);
      dec('camping', /^Tree_Dead_\d+$/, 14, cx - 9, top + 5);
      break;
    }
    default:
  }
  return out;
}

// ---- into the chunks ----

// Called by World.buildChunk for a Free Roam chunk of a V2 world: adds the objects, collision and doors of every place that has
// something standing in this chunk.
export function addV2Chunk(world, chunk, cx, cy) {
  const CH = 16;
  const x0 = cx * CH * 16;
  const y0 = cy * CH * 16;
  const inside = (x, y) => x >= x0 && x < x0 + CH * 16 && y >= y0 && y < y0 + CH * 16;
  const ci0 = Math.floor((cx * CH) / CELL) - 1;
  const ci1 = Math.floor((cx * CH + CH) / CELL) + 1;
  const cj0 = Math.floor((cy * CH) / CELL) - 1;
  const cj1 = Math.floor((cy * CH + CH) / CELL) + 1;
  for (let cj = cj0; cj <= cj1; cj++) {
    for (let ci = ci0; ci <= ci1; ci++) {
      const P = place(world, ci, cj);
      if (!P) continue;
      let n = 0;
      for (const [s, tx, ty, extra] of fill(P)) {
        n++;
        const x = Math.round(tx * 16);
        const y = Math.round(ty * 16);
        if (!inside(x, y)) continue;
        const id = `v2:${ci},${cj}:${n}`;
        if (world.v2removed?.has(id)) continue;
        // the little things around a place are skipped where a tree or the water is
        if (n > 1 && (world.treeAt(x >> 5, y >> 5) || world.type(x >> 4, y >> 4) !== 2 || world.isCleared(x >> 4, y >> 4))) continue;
        addProp(world, chunk, s, x, y, id, extra);
      }
    }
  }
  scatter(world, chunk, cx, cy);
  // the player's own additions (built in the game)
  for (const p of world.v2custom || []) {
    if (!inside(p.x, p.y)) continue;
    const s = loadedThemes.get(p.theme)?.byName.get(p.name);
    if (s) addProp(world, chunk, s, p.x, p.y, p.id, p.enter ? { enter: p.enter, name: p.label } : null);
  }
}

// ---- things scattered over the meadows and along the cottage yards ----
const SCATTER = [
  // containers: things to open
  ['props', /^(Black|Green|Blue)_Closed_Trash_Can$|^Dumpster|^Trashbin|^Small_Closed_Trash_Can/, 14],
  ['props', /^Barrel(_\d+)?$|^Stacked_Barrels/, 10],
  ['props', /^Mailbox/, 6],
  ['props', /^Vending/, 3],
  ['props', /^ATM/, 2],
  ['garage', /^Box(_\d+)?$/, 8],
  ['military', /^Military_Tent_Box_\d/, 3],
  // scenery
  ['props', /^Bench_\d/, 9],
  ['props', /^Hydrant/, 5],
  ['props', /^Cone$|^Traffic_Sign$|^Danger_Sign|^Info_Sign|^Sign$/, 8],
  ['props', /^Street_Lamp_\d/, 8],
  ['props', /^Pole$|^Electric_Pole/, 3],
  ['camping', /^(Rock|Table|Chair|Armchair|Lantern|Tiny_Table|Barbecue)/, 10],
  ['garden', /^Bush(_\d+)?$|Flower.*Vase$|^Big_.*Flower$|^Square_Bench/, 10],
  ['vehicles', /^Car_(Left|Right|Up|Down)_\d+$/, 3],
];
const SCATTER_TOTAL = SCATTER.reduce((n, e) => n + e[2], 0);

function scatter(world, chunk, cx, cy) {
  const s = world.seed;
  for (let by = cy * 8; by < cy * 8 + 8; by++) {
    for (let bx = cx * 8; bx < cx * 8 + 8; bx++) {
      const x = bx * 2;
      const y = by * 2;
      // more along the edge of a cottage's yard, a little over open meadow
      const near = world.isCleared(x - 5, y) || world.isCleared(x + 5, y) || world.isCleared(x, y - 5) || world.isCleared(x, y + 5);
      if (hash2(bx, by, s + 9300) >= (near ? 0.085 : 0.03)) continue;
      if (Math.hypot(x, y) < 10) continue; // the starting spot stays clear
      if (world.treeAt(bx, by) || world.isCleared(x, y) || world.type(x, y) !== 2 || world.type(x + 1, y + 1) !== 2 || world.elevation(x, y) < 0.46) continue;
      let pick = hash2(bx, by, s + 9301) * SCATTER_TOTAL;
      const entry = SCATTER.find((e) => (pick -= e[2]) <= 0) || SCATTER[0];
      const l = list(entry[0], entry[1]);
      if (!l.length) continue;
      const sp = l[Math.floor(hash2(bx, by, s + 9302) * l.length)];
      const px = bx * 32 + 16 + Math.round((hash2(bx, by, s + 9303) - 0.5) * 8);
      const py = by * 32 + 26 + Math.round(hash2(bx, by, s + 9304) * 5);
      const id = `v2s:${bx},${by}`;
      if (world.v2removed?.has(id)) continue;
      addProp(world, chunk, sp, px, py, id, null);
    }
  }
}

// one prop as chunk objects: scenery you walk around, containers you open, buildings you can walk into
export function addProp(world, chunk, s, x, y, id, extra) {
  const o = { theme: s.theme, name: s.name, x, y };
  if (isFlat(s.name, s.w, s.h)) {
    chunk.objects.push({ kind: 'tree', ground: true, vid: id, sheet: `v2/${s.theme}`, sx: s.x, sy: s.y, sw: s.w, sh: s.h, ox: Math.round(x - s.w / 2), oy: y - s.h, x: 0, y: 0 });
    return;
  }
  const rect = footprint(o, s);
  if (extra?.enter) {
    chunk.objects.push({ kind: 'tree', vid: id, sheet: `v2/${s.theme}`, sx: s.x, sy: s.y, sw: s.w, sh: s.h, x, y });
    // the way in: stand at the door and press Space
    chunk.objects.push({ kind: 'bdoor', inter: 'building', id: `bd${id}`, vid: id, label: `Space · go inside (${extra.name})`, b: { id, type: extra.enter, name: extra.name, x, y }, x, y: y - 1 });
    if (rect) chunk.rects.push({ vid: id, ...rect });
    return;
  }
  if (CONTAINER.test(s.name)) {
    chunk.objects.push({ kind: 'chest', inter: 'chest', id: `v2c${id}`, vid: id, sheet: `v2/${s.theme}`, sx: s.x, sy: s.y, sw: s.w, sh: s.h, lootKind: lootKind(s.name), x, y });
    if (rect) chunk.rects.push({ vid: id, ...rect });
    return;
  }
  chunk.objects.push({ kind: 'tree', vid: id, sheet: `v2/${s.theme}`, sx: s.x, sy: s.y, sw: s.w, sh: s.h, x, y });
  if (rect) chunk.rects.push({ vid: id, ...rect });
}

