import { loadTheme, loadedThemes } from './assets';
import { KIND, TILE, footprint, isFlat } from './world';

// V2 maps. A map is a 3x3 grid of city blocks cut by streets, and every block is a "district" (suburb, downtown, park...) that
// fills itself with props from the pack. The named maps are different arrangements of districts; the random map shuffles them.
// Everything is deterministic from the map's seed, so a map (and a "new layout" roll) can be recreated and previewed.

export const CELL_W = 48; // a block (40x32 tiles) plus the street band (8 tiles) above it and to its left
export const CELL_H = 40;
const BAND = 8;
const BLOCK_W = CELL_W - BAND;
const BLOCK_H = CELL_H - BAND;
export const MAP_COLS = 3 * CELL_W + BAND;
export const MAP_ROWS = 3 * CELL_H + BAND;

export const NEEDED_THEMES = ['terrain', 'city', 'houses', 'villas', 'props', 'vehicles', 'police', 'fire', 'hotel', 'school', 'shops', 'garden', 'camping', 'graveyard', 'military', 'beach', 'worksite', 'garage'];
export const loadMapThemes = () => Promise.all(NEEDED_THEMES.map(loadTheme));

export const DISTRICTS = {
  suburb: 'Suburb',
  downtown: 'Downtown',
  civic: 'Civic centre',
  market: 'Market',
  park: 'Park',
  camp: 'Campsite',
  forest: 'Forest',
  beach: 'Beach',
  graveyard: 'Graveyard',
  haunted: 'Haunted house',
  military: 'Military base',
  worksite: 'Worksite',
};

// what stirs in each district: ids of MONSTERS (src/game/monsters.js)
export const ZONE_MONSTERS = {
  suburb: ['redcap', 'hand', 'bones'],
  downtown: ['stumbler', 'hound', 'redcap', 'bat'],
  civic: ['stumbler', 'cadaver', 'eye'],
  market: ['hand', 'redcap', 'scarab'],
  park: ['jelly', 'bat', 'myconid'],
  camp: ['hound', 'jelly', 'bat'],
  forest: ['hound', 'myconid', 'bat', 'grimlock'],
  beach: ['scarab', 'ghoul', 'crawler'],
  graveyard: ['bones', 'cadaver', 'revenant', 'archer'],
  haunted: ['revenant', 'ghastly', 'cadaver', 'bat', 'eye'],
  military: ['hound', 'grimlock', 'ogre', 'archer'],
  worksite: ['stumbler', 'slime', 'crawler'],
};

export const MAPS = [
  { id: 'downtown', icon: '🏙️', name: 'Downtown', blurb: 'Shops, a market, the park and a civic centre around a busy crossroads.', cells: [['market', 'downtown', 'park'], ['suburb', 'civic', 'downtown'], ['worksite', 'market', 'downtown']], hour: 9, music: 'city' },
  { id: 'suburbs', icon: '🏡', name: 'Sunny Suburbs', blurb: 'Rows of houses with gardens, small parks and a market on the corner.', cells: [['suburb', 'suburb', 'park'], ['suburb', 'market', 'suburb'], ['park', 'suburb', 'suburb']], hour: 9, music: 'meadow' },
  { id: 'seaside', icon: '🏖️', name: 'Seaside Promenade', blurb: 'A town on the coast: the beach, sand and sea along the south.', cells: [['suburb', 'market', 'park'], ['market', 'downtown', 'suburb'], ['beach', 'beach', 'beach']], hour: 11, music: 'shore' },
  { id: 'greenpark', icon: '⛺', name: 'Green Park and Camp', blurb: 'Lawns, fountains, forests and campsites. Quiet by day.', cells: [['park', 'forest', 'camp'], ['camp', 'park', 'forest'], ['forest', 'park', 'camp']], hour: 10, music: 'mountain' },
  { id: 'haunted', icon: '👻', name: 'Haunted Hill', blurb: 'Graveyards, a haunted house and dark woods. It starts at dusk.', cells: [['forest', 'graveyard', 'haunted'], ['graveyard', 'haunted', 'graveyard'], ['forest', 'graveyard', 'forest']], hour: 19, music: 'ruins' },
  { id: 'army', icon: '🪖', name: 'Army Base', blurb: 'Hangars, tanks, tents and sandbags, with a building site next door.', cells: [['military', 'military', 'worksite'], ['military', 'forest', 'military'], ['worksite', 'military', 'military']], hour: 8, music: 'depot' },
  { id: 'patchwork', icon: '🧩', name: 'Patchwork City', blurb: 'A bit of everything, side by side: a different mix of districts in each block.', cells: null, hour: 10, music: 'city' },
];

export const mapById = (id) => MAPS.find((m) => m.id === id) || MAPS[0];

// ---------- randomness ----------

export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- the generator ----------

export function generateMap(id, roll = '') {
  const def = mapById(id);
  const seed = hashString(`${def.id}${roll ? `@${roll}` : ''}`);
  const rnd = mulberry(seed);
  const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const choice = (arr) => arr[Math.floor(rnd() * arr.length)];
  const cols = MAP_COLS;
  const rows = MAP_ROWS;
  const map = {
    id: def.id, name: def.name, roll, seed, cols, rows, ground: new Uint8Array(cols * rows), props: [], marks: [], zones: [], hour: def.hour, music: def.music,
    spawn: { x: (CELL_W + BAND / 2) * TILE, y: (CELL_H + BAND / 2) * TILE },
  };
  let uid = 1;
  const cache = new Map();
  const all = (theme, re, test) => {
    const key = `${theme}|${re}|${test || ''}`;
    if (!cache.has(key)) cache.set(key, (loadedThemes.get(theme)?.items || []).filter((s) => re.test(s.name) && (!test || test(s))));
    return cache.get(key);
  };
  const one = (theme, re, test) => {
    const l = all(theme, re, test);
    return l.length ? choice(l) : null;
  };
  const occ = []; // footprints already taken, so scattered things do not pile up
  const add = (s, tx, ty, extra = {}) => {
    if (!s) return null;
    const p = { uid: uid++, theme: s.theme, name: s.name, x: Math.round(tx * TILE), y: Math.round(ty * TILE), ...extra };
    map.props.push(p);
    const r = footprint(p, s);
    if (r) occ.push({ x: r.x - 3, y: r.y - 3, w: r.w + 6, h: r.h + 6 });
    return p;
  };
  const fits = (s, tx, ty) => {
    const r = footprint({ name: s.name, x: tx * TILE, y: ty * TILE }, s) || { x: tx * TILE - 4, y: ty * TILE - 4, w: 8, h: 4 };
    return !occ.some((o) => r.x < o.x + o.w && r.x + r.w > o.x && r.y < o.y + o.h && r.y + r.h > o.y);
  };
  // scatter `count` of a kind of sprite over a rectangle of tiles
  const scatter = (list, count, x, y, w, h, opts = {}) => {
    if (!list.length) return;
    for (let i = 0, tries = 0; i < count && tries < count * 12; tries++) {
      const s = choice(list);
      const tx = x + 1 + rnd() * (w - 2);
      const ty = y + Math.ceil(s.h / TILE) + rnd() * Math.max(1, h - Math.ceil(s.h / TILE));
      if (opts.free !== false && !fits(s, tx, ty)) continue;
      add(s, opts.snap ? Math.round(tx) : tx, opts.snap ? Math.round(ty) : ty, opts.extra);
      i++;
    }
  };
  const paint = (kind, x, y, w, h) => {
    for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) if (tx >= 0 && ty >= 0 && tx < cols && ty < rows) map.ground[ty * cols + tx] = kind;
  };
  const trees = (count, x, y, w, h) => scatter(all('camping', /^Tree_\d+$/, (s) => s.w === 80), count, x, y, w, h);
  // sprites left to right, centred between x0 and x1, all standing on the line y
  const lineUp = (list, x0, x1, y, gap = 1.5) => {
    const total = list.reduce((n, s) => n + s.w / TILE + gap, -gap);
    let x = x0 + Math.max(0, (x1 - x0 - total) / 2);
    for (const s of list) {
      add(s, x + s.w / TILE / 2, y);
      x += s.w / TILE + gap;
    }
  };
  // pick sprites that fit side by side in `room` tiles
  const fitRow = (pool, room, gap = 1.5) => {
    const out = [];
    let used = 0;
    for (let i = 0; i < 12 && pool.length; i++) {
      const s = choice(pool);
      if (used + s.w / TILE + (out.length ? gap : 0) > room) continue;
      out.push(s);
      used += s.w / TILE + gap;
    }
    return out;
  };
  const mid = (x, w) => x + w / 2;

  // --- districts: each fills the block at (bx, by), bw x bh tiles ---
  const D = {
    suburb(bx, by, bw, bh) {
      const houses = [...all('houses', /House/, (s) => s.w >= 140 && s.h >= 176 && s.h <= 250 && !/Door|Sign|Balcony|Umbrella|Banister|Roof|Canopy|Base|Basement|Wind|Solar|Modular|Side|Open|Styling|Lantern|Pole|Haunted|Apocalyptic/.test(s.name)), ...all('villas', /^Villa(_\d+)?$/)];
      const decor = all('villas', /Yard_Flowers|Picnic|Hanging|Potted|Toy_Rocking|Toy_Trampoline|Lemonade/);
      for (const base of [by + 16, by + bh - 1]) {
        const row = fitRow(houses, bw - 4, 4);
        lineUp(row, bx + 2, bx + bw - 2, base, 4);
        for (const s of all('props', /^Mailbox/).slice(0, 1)) add(s, bx + 1.5 + rnd() * (bw - 3), base + 0.3);
      }
      trees(7, bx, by, bw, bh);
      scatter(decor, 10, bx, by, bw, bh);
      scatter(all('props', /^(Black|Green|Blue)_Closed_Trash_Can$|^Hydrant/), 3, bx, by, bw, bh);
    },
    downtown(bx, by, bw, bh) {
      paint(KIND.plaza, bx, by, bw, bh);
      const top = [one('shops', /^Mall_1$/), ...all('shops', /^Market_Big_\d+$/).slice(0, 2)].filter(Boolean);
      lineUp(fitRow(top, bw - 2, 2), bx + 1, bx + bw - 1, by + 14, 2);
      const low = [one('fire', /^Building$/), one('shops', /^Market_Medium_\d+$/), one('shops', /^Market_Big_\d+$/)].filter(Boolean);
      lineUp(fitRow(low, bw - 2, 2), bx + 1, bx + bw - 1, by + bh - 1, 2);
      add(one('fire', /^Fire_Truck_(Down|Up)$/), bx + 8, by + 22);
      scatter(all('props', /^ATM|^Phone_Booth|^Bench_\d|^Dumpster|^Billboard|^(Black|Green|Blue)_Closed_Trash_Can$|^Hydrant|^Traffic_Sign$/), 9, bx, by + 14, bw, 10);
      trees(3, bx, by + 14, bw, 10);
    },
    civic(bx, by, bw, bh) {
      paint(KIND.plaza, bx, by, bw, bh);
      const landmark = choice([one('police', /^Police_Station_[123]$/), one('hotel', /^Hospital_1$/), one('school', /^School_1$/), one('hotel', /^Hotel_1$/)].filter(Boolean));
      add(landmark, mid(bx, bw), by + 25);
      add(one('police', /^Police_Box_\d$/), bx + 4, by + 29);
      add(one('vehicles', /^Ambulance_(Left|Right)/), bx + bw - 10, by + 30);
      scatter(all('props', /^Bench_\d|^Black_Closed_Trash_Can$|^Hydrant|^Phone_Booth/), 6, bx, by + 25, bw, 7);
      trees(6, bx, by + 24, bw, 8);
      scatter(all('garden', /Flower_Vase$/), 6, bx, by + 24, bw, 8);
    },
    market(bx, by, bw, bh) {
      paint(KIND.plaza, bx, by, bw, bh);
      lineUp(fitRow(all('shops', /^Market_(Big|Medium)_\d+$/), bw - 2, 2.5), bx + 1, bx + bw - 1, by + 14, 2.5);
      add(one('vehicles', /^Ice_Cream_Truck/), bx + 9, by + 25);
      add(one('vehicles', /^Tacos_Truck_\d/), bx + 27, by + 25);
      scatter(all('garage', /^(Table|Box|Cloth|Signboard)/), 8, bx, by + 16, bw, 14);
      add(one('shops', /^Shopping_Cart/), bx + 18, by + 29);
      scatter(all('props', /^Bench_\d|^Vending|^(Black|Green|Blue)_Closed_Trash_Can$|^Billboard|^Small_Closed_Trash_Can$/), 7, bx, by + 16, bw, 15);
      trees(3, bx, by + 14, bw, 14);
    },
    park(bx, by, bw, bh) {
      add(one('garden', /^Fountain/), mid(bx, bw), by + 19);
      scatter(all('garden', /^(Statue|Angel|Grey_Statue|Light_Brown_Statue)/), 3, bx, by, bw, bh);
      scatter(all('garden', /^Bush(_\d+)?$/), 14, bx, by, bw, bh);
      scatter(all('garden', /Flower.*Vase$|^Big_.*Flower$/), 10, bx, by, bw, bh);
      scatter(all('garden', /^(Square_Bench|Medium_Bench_Horizontal|Big_Bench_Horizontal|Flowers_Bench_Horizontal)/), 5, bx, by, bw, bh);
      trees(10, bx, by, bw, bh);
      scatter(all('garden', /^Grass_Arch/), 1, bx, by, bw, 12);
    },
    camp(bx, by, bw, bh) {
      paint(KIND.dirt, bx + 8, by + 6, bw - 16, bh - 12);
      const tents = all('camping', /^Tent_\d+$/);
      [[-9, 14], [8, 12], [-8, 24], [10, 25]].forEach(([dx, dy]) => add(choice(tents), mid(bx, bw) + dx, by + dy));
      props_anim('campfire', mid(bx, bw), by + 19);
      scatter(all('camping', /^(Benched_Table|Table|Chair|Sleeping_Bag|Lantern|Tiny_Table|Rock)/), 12, bx + 6, by + 6, bw - 12, bh - 10);
      add(one('camping', /^Signboard/), bx + 4, by + 29);
      trees(14, bx, by, bw, bh);
    },
    forest(bx, by, bw, bh) {
      paint(KIND.dirt, bx + 4, by + Math.floor(bh / 2) - 1, bw - 8, 3);
      trees(30, bx, by, bw, bh);
      scatter(all('camping', /^(Rock|Tree_Dead_Stick)/), 12, bx, by, bw, bh);
      scatter(all('camping', /^Tree_Dead_\d+$/), 4, bx, by, bw, bh);
      scatter(all('garden', /^Bush(_\d+)?$/), 8, bx, by, bw, bh);
    },
    beach(bx, by, bw, bh) {
      paint(KIND.plaza, bx, by, bw, 8);
      paint(KIND.sand, bx, by + 8, bw, 12);
      paint(KIND.water, bx, by + 20, bw, bh - 20);
      add(one('beach', /^Bamboo_Bar_Counter_\d+$/), bx + 8, by + 7);
      add(one('beach', /^Ship_Bar$/), bx + 30, by + 8);
      scatter(all('beach', /^Palm_Tree/), 5, bx, by + 6, bw, 12);
      scatter(all('beach', /Beach_Umbrella_Opened/), 5, bx, by + 9, bw, 10);
      scatter(all('beach', /Beach_Towel/), 6, bx, by + 9, bw, 10, { free: false });
      scatter(all('beach', /^Sand_Castle|^Beach_Volley_Net_(Left|Right)|^Big_Sprout|^Small_Sprout/), 6, bx, by + 9, bw, 10);
      scatter(all('beach', /Sea_Rock/), 5, bx, by + 20, bw, bh - 20);
      scatter(all('vehicles', /^Boat_[123]_(Left|Right)/), 2, bx + 2, by + 22, bw - 4, bh - 22, { free: false });
    },
    graveyard(bx, by, bw, bh) {
      add(one('graveyard', /^Grace_Chapel_With_Gate/), bx + 8, by + 12);
      add(one('graveyard', /^Medium_Gate(_\d+)?$/), mid(bx, bw) + 4, by + 5);
      const graves = all('graveyard', /^(Small_(Black|Brown|Grey)_Tombstone|(Black|Brown|Grey|Wood)_Cross|Marble_(Brown|Grey)_Tombstone|Long_Tombstone)/);
      for (let r = 0; r < 5; r++) for (let c = 0; c < 7; c++) if (rnd() > 0.15) add(choice(graves), bx + 13 + c * 3.7 + rnd() * 0.6, by + 14 + r * 3.6);
      scatter(all('camping', /^Tree_Dead_\d+$/), 8, bx, by, bw, bh);
      scatter(all('graveyard', /^(Consumed_Candle|Marble_(Brown|Grey)_Coffin|Little_Sprout|Medium_Tree)/), 8, bx, by + 8, bw, bh - 8);
    },
    haunted(bx, by, bw, bh) {
      add(one('houses', /Haunted_House_16x16$/), mid(bx, bw), by + 27);
      scatter(all('camping', /^Tree_Dead_\d+$/), 10, bx, by, bw, bh);
      scatter(all('graveyard', /^(Small_(Black|Grey)_Tombstone|(Black|Grey)_Cross|Consumed_Candle|Medium_Pumpkin|Big_Pumpkin|Long_Pumpkin)/), 14, bx, by + 14, bw, bh - 14);
      scatter(all('houses', /Haunted_House_Sign/), 1, bx, by + 22, bw, 8);
    },
    military(bx, by, bw, bh) {
      paint(KIND.dirt, bx, by, bw, bh);
      add(one('military', /^Hangar$/), bx + 12, by + 15);
      add(one('military', /^Military_Tent_(Brown|Black)$/), bx + 31, by + 15);
      add(one('military', /^Watch_Tower_Empty|^Watch_Tower$/), bx + 3, by + 14);
      add(one('military', /^Radio_Tower_Base|^Radio_Tower$/), bx + 38, by + 31);
      scatter(all('military', /^(Brown|Green)_Tank_(Left|Right)_Side/), 3, bx, by + 17, bw, 14);
      scatter(all('military', /^Sandbag_Pile/), 7, bx, by + 16, bw, 15);
      scatter(all('military', /^(Target_|Warning_Sign|Military_Tent_Box|Military_Tent_Locker|Barrier)/), 7, bx, by + 16, bw, 15);
      scatter(all('props', /^Barrel(_\d+)?$|^Stacked_Barrels/), 6, bx, by + 16, bw, 15);
    },
    worksite(bx, by, bw, bh) {
      paint(KIND.dirt, bx, by, bw, bh);
      add(one('worksite', /^Building_Skeleton/), bx + 10, by + 14);
      scatter(all('worksite', /^(Excavator|Scissor_Lifter|Portable_Toilet|Light_Tower|Stacked_Material|Tool_Box)/), 7, bx, by + 14, bw, 17);
      scatter(all('props', /^Container(_\d+)?$|^Container_House|^Scrap_Metal|^Barrel(_\d+)?$/), 6, bx, by + 14, bw, 17);
      scatter(all('worksite', /^(Cone|Fence|Bucket|Shovel|Helmet)/).concat(all('props', /^Cone/)), 14, bx, by + 12, bw, 19, { snap: true });
    },
  };
  const props_anim = (anim, tx, ty) => map.props.push({ uid: uid++, anim, theme: 'anim', name: anim === 'campfire' ? 'Campfire' : 'Street lamp', x: Math.round(tx * TILE), y: Math.round(ty * TILE) });

  // --- streets ---
  const lineEnds = [];
  for (let i = 0; i <= 3; i++) lineEnds.push(i * CELL_W); // vertical bands start at these columns
  paint(KIND.walk, 0, 0, cols, rows);
  for (let j = 0; j <= 3; j++) paint(KIND.road, 0, j * CELL_H + 2, cols, 4);
  for (let i = 0; i <= 3; i++) paint(KIND.road, i * CELL_W + 2, 0, 4, rows);
  // blocks start as grass
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) paint(KIND.grass, i * CELL_W + BAND, j * CELL_H + BAND, BLOCK_W, BLOCK_H);

  // --- the districts of this map ---
  let cells = def.cells;
  if (!cells) {
    const types = ['suburb', 'downtown', 'civic', 'market', 'park', 'camp', 'forest', 'beach', 'graveyard', 'haunted', 'military', 'worksite'];
    cells = [0, 1, 2].map(() => [0, 1, 2].map(() => choice(types)));
  }
  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < 3; i++) {
      const type = cells[j][i];
      const bx = i * CELL_W + BAND;
      const by = j * CELL_H + BAND;
      map.zones.push({ x: bx, y: by, w: BLOCK_W, h: BLOCK_H, type });
      D[type](bx, by, BLOCK_W, BLOCK_H);
    }
  }

  // --- street life: lamps, cars, lane markings, crosswalks ---
  const lamp = (tx, ty) => props_anim('streetlamp', tx, ty);
  const nearVertical = (tx) => lineEnds.some((v) => tx > v - 4 && tx < v + BAND + 4);
  const nearHorizontal = (ty) => [0, 1, 2, 3].some((j) => ty > j * CELL_H - 4 && ty < j * CELL_H + BAND + 4);
  for (let j = 0; j <= 3; j++) {
    const y0 = j * CELL_H;
    for (let x = 12; x < cols - 4; x += 16 + rint(0, 4)) if (!nearVertical(x)) lamp(x, y0 + 1.9);
    for (const v of lineEnds) {
      lamp(v + 1.2, y0 + 1.9);
      lamp(v + 6.8, y0 + 6.9);
    }
  }
  for (let i = 0; i <= 3; i++) {
    const x0 = i * CELL_W;
    for (let y = 12; y < rows - 4; y += 16 + rint(0, 4)) if (!nearHorizontal(y)) lamp(x0 + 1.2, y);
  }
  const cars = { left: all('vehicles', /^Car_Left_\d+$/), right: all('vehicles', /^Car_Right_\d+$/), down: all('vehicles', /^Car_Down_\d+$/), up: all('vehicles', /^Car_Up_\d+$/) };
  for (let j = 0; j <= 3; j++) {
    for (let k = 0; k < 6; k++) {
      const x = 8 + rnd() * (cols - 16);
      if (nearVertical(x)) continue;
      const north = rnd() < 0.5;
      add(choice(north ? cars.left : cars.right), x, j * CELL_H + (north ? 3.9 : 5.9) - 0.1);
    }
  }
  for (let i = 0; i <= 3; i++) {
    for (let k = 0; k < 5; k++) {
      const y = 10 + rnd() * (rows - 16);
      if (nearHorizontal(y)) continue;
      const west = rnd() < 0.5;
      add(choice(west ? cars.down : cars.up), i * CELL_W + (west ? 3.5 : 5.5), y);
    }
  }
  // lane lines and zebra crossings, as rectangles in pixels
  const inBandX = (tx) => lineEnds.some((v) => tx >= v && tx < v + BAND);
  const inBandY = (ty) => [0, 1, 2, 3].some((j) => ty >= j * CELL_H && ty < j * CELL_H + BAND);
  for (let j = 0; j <= 3; j++) for (let tx = 0; tx < cols; tx++) if (!inBandX(tx)) map.marks.push([tx * TILE + 3, (j * CELL_H + 4) * TILE - 1, 10, 2]);
  for (let i = 0; i <= 3; i++) for (let ty = 0; ty < rows; ty++) if (!inBandY(ty)) map.marks.push([(i * CELL_W + 4) * TILE - 1, ty * TILE + 3, 2, 10]);
  for (let j = 0; j <= 3; j++) {
    for (let i = 0; i <= 3; i++) {
      const X = i * CELL_W;
      const Y = j * CELL_H;
      for (let o = 2 * TILE + 2; o < 6 * TILE - 4; o += 5) {
        map.marks.push([X * TILE + 2, Y * TILE + o, 28, 3], [(X + 6) * TILE + 2, Y * TILE + o, 28, 3]);
        map.marks.push([X * TILE + o, Y * TILE + 2, 3, 28], [X * TILE + o, (Y + 6) * TILE + 2, 3, 28]);
      }
    }
  }
  return map;
}

// a map from a customised save: the saved props and ground replace the generated ones
export function applyCustom(map, custom) {
  if (!custom?.props) return map;
  map.props = custom.props.map((p, i) => ({ ...p, uid: i + 1 }));
  if (custom.ground && custom.ground.length === map.cols * map.rows) {
    for (let i = 0; i < custom.ground.length; i++) map.ground[i] = custom.ground.charCodeAt(i) - 48;
  }
  map.custom = true;
  return map;
}

export const groundToString = (g) => {
  let s = '';
  for (let i = 0; i < g.length; i++) s += String.fromCharCode(48 + g[i]);
  return s;
};

export { isFlat };
