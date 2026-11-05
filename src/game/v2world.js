import { hash2 } from './rng';
import { DREGION } from './dungeon';
import { loadSheet, loadTheme, loadedThemes } from '../v2/assets';
import { CONTAINER, footprint, isFlat } from '../v2/world';

// Free Roam V2: the same world as Free Roam (the same land, houses, trees, caves and chests), with the Modern Exteriors props added
// on top. Some of them are things to open (bins, crates, ATMs...), some are buildings you can walk into, some are just scenery.
// A V2 world is a world whose seed ends with "~v2". Everything here is a pure function of the seed, so rooms agree on it.

export const isV2Seed = (s) => /~v2$/.test(String(s));
export const stripV2 = (s) => String(s).replace(/~v2$/, '');

// Halloween: the Graveyard pack dresses the world (Free Roam's "haunted-" seeds and Survival's Halloween Graveyard map)
export const isHalloweenSeed = (s) => /^haunted-/.test(String(s));
export const HALLOWEEN_THEMES = ['graveyard', 'camping'];

const THEMES = ['props', 'vehicles', 'houses', 'villas', 'shops', 'garden', 'camping', 'graveyard', 'police', 'fire', 'hotel', 'school', 'garage', 'military', 'worksite', 'pool'];

// Animated scenery (Modern Exteriors, Animated_16x16): a row of equal frames each, played in the world. The sheets are copied by scripts/add-v2-anim.py.
export const ANIMS = {
  fountain1: { fw: 32, fh: 48, frames: 6, fps: 6 },
  fountain3: { fw: 48, fh: 96, frames: 6, fps: 6 },
  fountain5: { fw: 64, fh: 80, frames: 6, fps: 6 },
  fountain8: { fw: 32, fh: 48, frames: 8, fps: 8 },
  flag: { fw: 48, fh: 144, frames: 8, fps: 5 },
  cookpot: { fw: 48, fh: 32, frames: 6, fps: 7 },
};
const animSprite = (id) => ({ name: `anim_${id}`, theme: 'anim', anim: id, w: ANIMS[id].fw, h: ANIMS[id].fh, x: 0, y: 0 });

// the atlases become images the engine can draw as `v2/<theme>`
export const SURVIVAL_THEMES = ['props', 'vehicles', 'military', 'garage', 'camping', 'worksite', 'police', 'houses', 'shops', 'graveyard', 'fire'];

export async function loadV2Images(img, themes = THEMES) {
  await Promise.all(themes.map(async (id) => {
    const t = await loadTheme(id);
    img[`v2/${id}`] = t.img;
  }));
  await Promise.all(Object.keys(ANIMS).map(async (id) => {
    img[`v2anim/${id}`] = await loadSheet(`anim/${id}.png`);
  }));
}

const cache = new Map();
const list = (theme, re, test) => {
  const key = `${theme}|${re.source}|${test || ''}`;
  if (!cache.has(key)) cache.set(key, (loadedThemes.get(theme)?.items || []).filter((s) => re.test(s.name) && (!test || test(s))).sort((a, b) => a.name.localeCompare(b.name)));
  return cache.get(key);
};

const BAD_HOUSE = /Door|Sign|Balcony|Umbrella|Banister|Roof|Canopy|Base|Basement|Wind|Solar|Modular|Side|Open|Styling|Lantern|Pole|Haunted|Apocalyptic|Chimney|Ladder|Window|Yard|Doormat|Toy|Tree|Hanging|Potted|Propeller|Picnic|Lemonade/;

const pickFrom = (l, r) => l[Math.floor(r(1) * l.length)];

// ---- the kinds of places ----
// each: how big it is (tiles), and how to fill it. `s` is the main sprite.
const KINDS = [
  { id: 'house', weight: 26, enter: 'house', pick: (r) => { const l = [...list('houses', /House/, (s) => s.w >= 128 && s.h >= 160 && s.h <= 260 && !BAD_HOUSE.test(s.name)), ...list('villas', /^Villa(_\d+)?$/)]; return l[Math.floor(r(1) * l.length)]; } },
  { id: 'shop', weight: 20, enter: 'shop', pick: (r) => { const l = list('shops', /^Market_(Big|Medium|Small)_\d+$/); return l[Math.floor(r(1) * l.length)]; } },
  { id: 'civic', weight: 8, enter: 'civic', pick: (r) => { const l = [...list('police', /^Police_Station_[123]$/), ...list('fire', /^Building$/), ...list('hotel', /^(Hospital|Hotel)_1$/), ...list('school', /^School_1$/)]; return l[Math.floor(r(1) * l.length)]; } },
  { id: 'gas', weight: 9, min: [24, 18], pick: (r) => { const l = list('vehicles', /^Gas_Station_[12]$/); return l[Math.floor(r(1) * l.length)]; } },
  // the small places: a caravan to look round, a kiosk, and a few loungers by an umbrella (each caravan and kiosk can be walked into)
  { id: 'cabin', weight: 12, enter: 'cabin', pick: (r) => pickFrom(list('camping', /^Mobile_House_Small_\d$/), r) },
  { id: 'kiosk', weight: 9, enter: 'kiosk', pick: (r) => pickFrom(list('props', /^Kiosk_(Icecream|Coffee_Cup|Mushroom_1|Infopoint_1|Infopoint_2)$/), r) },
  { id: 'poolside', weight: 8, min: [22, 18], pick: (r) => pickFrom(list('pool', /^Umbrella_[1-8]$/), r) },
  { id: 'camp', weight: 16, min: [22, 20], pick: (r) => { const l = list('camping', /^Tent_\d+$/); return l[Math.floor(r(1) * l.length)]; } },
  { id: 'park', weight: 14, min: [22, 20], pick: () => list('garden', /^Fountain/)[0] },
  { id: 'junk', weight: 14, min: [22, 18], pick: (r) => { const l = list('props', /^Dumpster/); return l[Math.floor(r(1) * l.length)]; } },
  { id: 'graves', weight: 9, min: [20, 20], pick: (r) => { const l = list('graveyard', /^Medium_Gate(_\d+)?$/); return l[Math.floor(r(1) * l.length)]; } },
];
// Halloween: graveyards and gates, a chapel, pumpkin patches and dead groves
const KINDS_HW = [
  { id: 'hwgraves', weight: 30, min: [20, 20], pick: (r) => pickFrom(list('graveyard', /^(Medium|Big|High|Small)_Gate(_Red_Orb)?$/), r) },
  { id: 'chapel', weight: 9, pick: () => list('graveyard', /^Grace_Chapel_With_Gate$/)[0] },
  { id: 'patch', weight: 22, min: [22, 20], pick: (r) => pickFrom(list('graveyard', /^Big_(Yellow_Lights_)?Pumpkin_\d$/), r) },
  { id: 'grove', weight: 16, min: [22, 18], pick: (r) => pickFrom(list('graveyard', /^Big_Tree_(Pumpkins_)?$/), r) },
];
const TOTAL = KINDS.reduce((n, k) => n + k.weight, 0);
// the Escape zone is full of places to loot: the buildings come up three times as often
const KINDS_ESC = KINDS.map((k) => (k.enter ? { ...k, weight: k.weight * 3 } : k));
const TOTAL_ESC = KINDS_ESC.reduce((n, k) => n + k.weight, 0);
const TOTAL_HW = KINDS_HW.reduce((n, k) => n + k.weight, 0);
const CELL = 30; // a place is rolled per 30x30 tiles

export const BUILDING_NAMES = {
  house: ['Cosy House', 'Family Home', 'Little House', 'Old Villa'],
  shop: ['General Store', 'Corner Market', 'Fruit Stand', 'Trading Post'],
  civic: ['Town Hall', 'Clinic', 'Station', 'Old School'],
  cabin: ['Little Caravan', 'Camper Van', 'Tiny Home', 'Wheeled Cabin'],
  kiosk: ['Corner Kiosk', 'Snack Stand', 'Little Kiosk', 'Info Point'],
};

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
  if (r(0) < (world.hw ? 0.85 : world.sv2 ? 0.5 : world.escape ? 0.95 : 0.8)) {
    const kinds = world.hw ? KINDS_HW : world.escape ? KINDS_ESC : KINDS;
    let pick = r(2) * (world.hw ? TOTAL_HW : world.escape ? TOTAL_ESC : TOTAL);
    const kind = kinds.find((k) => (pick -= k.weight) <= 0) || kinds[0];
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
      for (let k = 0; k < (world.escape ? 44 : 28) && !out; k++) {
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
      const road = world.escape && world.groundSet; // (on a road map, roads are ground too)
      if (road ? world.type(x, y) === 0 : world.type(x, y) !== 2 || world.elevation(x, y) < 0.46) return false;
      if (world.isCleared(x, y)) return false;
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

const GRAVES = /^(Small_(Black|Brown|Grey)_Tombstone|(Black|Brown|Grey)_Cross|Marble_(Brown|Grey)_Tombstone|Long_Tombstone|Wood_Cross|Wood_Large_Cross)/;
const DEAD_TREE = /^Tree_Dead_\d+$/;
const PUMPKIN = /^(Medium|Big|Long)_(Blood_|Yellow_Lights_)?Pumpkin/;
const CANDLE = /^(Consumed_Candle|Big_Brown_Candle|Big_Red_Candle|Small_Red_Candle)/;

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
      if (r(12) < 0.6) add(animSprite('flag'), cx + sw / 2 + 4, feet + 1);
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
    case 'cabin': {
      add(s, cx, feet, { enter: 'cabin', name: BUILDING_NAMES.cabin[Math.floor(r(5) * 4)] });
      dec('camping', /^Benched_Table/, 6, cx - sw / 2 - 2, feet + 2);
      dec('camping', /^(Campfire(_\d+)?|Barbecue)/, 7, cx + sw / 2 + 2, feet + 2);
      dec('camping', /^(Rock|Lantern|Tiny_Table)/, 8, cx + sw / 2 + 1, feet + 4);
      dec('props', /^Mailbox/, 9, cx - 1, feet + 3);
      dec('props', /^(Black|Green|Blue)_Closed_Trash_Can$/, 10, cx - sw / 2 - 2, feet + 4);
      break;
    }
    case 'kiosk': {
      add(s, cx, feet, { enter: 'kiosk', name: BUILDING_NAMES.kiosk[Math.floor(r(5) * 4)] });
      dec('props', /^Bench_\d/, 6, cx - 4, feet + 3);
      dec('props', /^Vending/, 7, cx + sw / 2 + 1.5, feet + 1);
      dec('props', /^(Black|Green|Blue)_Closed_Trash_Can$/, 8, cx - sw / 2 - 1, feet + 2);
      if (r(10) < 0.5) add(animSprite('fountain1'), cx + sw / 2 + 5, feet + 4);
      break;
    }
    case 'poolside': {
      add(s, cx, top + 6);
      for (let i = 0; i < 3; i++) {
        const sunbed = one('pool', /^Sunbed_\d+$/, 20 + i);
        if (sunbed) add(sunbed, cx - 5 + i * 5, top + 9 + (i % 2) * 2);
      }
      dec('pool', /^Palm_\d$/, 6, cx - 9, top + 6);
      dec('pool', /^Palm_\d$/, 7, cx + 9, top + 7);
      dec('pool', /^Toy_(Floating_)?\d+$/, 8, cx - 6, top + 13);
      dec('pool', /^Toy_(Floating_)?\d+$/, 9, cx + 4, top + 13);
      dec('pool', /^Lifeguard_Chair_\d$/, 10, cx + 9, top + 12);
      dec('pool', /^Buoy_\d$/, 11, cx - 10, top + 12);
      break;
    }
    case 'camp': {
      add(s, cx - 4, top + 8);
      dec('camping', /^Tent_\d+$/, 6, cx + 4, top + 9);
      if (r(8) < 0.5) add(animSprite('cookpot'), cx, top + 13); // a pot on the fire, with its flames playing
      else dec('camping', /^Campfire(_\d+)?$/, 7, cx, top + 13);
      dec('camping', /^Benched_Table/, 8, cx - 5, top + 15);
      dec('camping', /^Sleeping_Bag/, 9, cx + 6, top + 14);
      dec('military', /^Military_Tent_Box_\d_Open|^Military_Tent_Locker/, 10, cx + 2, top + 16);
      dec('camping', /^Rock/, 11, cx - 8, top + 12);
      break;
    }
    case 'park': {
      add(animSprite(['fountain3', 'fountain5', 'fountain8'][Math.floor(r(5) * 3)]), cx, top + 8); // (the fountain plays)
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
    case 'hwgraves': {
      add(s, cx, top + 4);
      const graves = list('graveyard', GRAVES);
      for (let j = 0; j < 4; j++) for (let i = 0; i < 5; i++) if (r(20 + j * 5 + i) > 0.25) add(graves[Math.floor(r(50 + j * 5 + i) * graves.length)], cx - 8 + i * 4, top + 9 + j * 3.5);
      dec('graveyard', /^Marble_(Brown|Grey)_Coffin|^Silver_Coffin|^Red_Coffin|^Yellow_Coffin/, 13, cx + 8, top + 6);
      dec('graveyard', /^Dirt_Ditch_2/, 14, cx - 8, top + 7);
      dec('camping', DEAD_TREE, 15, cx - 10, top + 5);
      dec('camping', DEAD_TREE, 16, cx + 10, top + 6);
      dec('graveyard', CANDLE, 17, cx - 2, top + 8);
      dec('graveyard', PUMPKIN, 18, cx + 3, top + 7);
      dec('graveyard', /^Crow_(Front|Back)/, 19, cx - 5, top + 6);
      break;
    }
    case 'chapel': {
      add(s, cx, feet);
      const graves = list('graveyard', GRAVES);
      for (let i = 0; i < 5; i++) {
        add(graves[Math.floor(r(20 + i) * graves.length)], cx - sw / 2 - 3, feet - 8 + i * 3);
        add(graves[Math.floor(r(30 + i) * graves.length)], cx + sw / 2 + 3, feet - 8 + i * 3);
      }
      dec('graveyard', /^Candle_Holder_On$/, 6, cx - 3, feet + 2);
      dec('graveyard', /^Candle_Holder_On$/, 7, cx + 3, feet + 2);
      dec('graveyard', PUMPKIN, 8, cx - 6, feet + 4);
      dec('graveyard', PUMPKIN, 9, cx + 6, feet + 4);
      dec('camping', DEAD_TREE, 10, cx - sw / 2 - 6, feet - 1);
      dec('camping', DEAD_TREE, 11, cx + sw / 2 + 6, feet);
      break;
    }
    case 'patch': {
      add(s, cx, top + 6);
      const pumpkins = list('graveyard', /Pumpkin/, (x) => x.w <= 32 && !/Tree|Brunch/.test(x.name));
      for (let i = 0; i < 14; i++) {
        const a = r(20 + i) * Math.PI * 2;
        const d = 3 + r(40 + i) * 7;
        add(pumpkins[Math.floor(r(60 + i) * pumpkins.length)], cx + Math.cos(a) * d * 1.3, top + 7 + Math.sin(a) * d * 0.8);
      }
      dec('graveyard', /^Pumpikin_Brunch/, 6, cx - 6, top + 11);
      dec('graveyard', /^Pumpikin_Brunch/, 7, cx + 6, top + 11);
      dec('graveyard', /^Shovel/, 8, cx + 8, top + 5);
      dec('graveyard', /^Tree_Trunk_Pumpkin$/, 9, cx - 9, top + 6);
      dec('camping', DEAD_TREE, 10, cx + 10, top + 4);
      break;
    }
    case 'grove': {
      add(s, cx, top + 7);
      for (let i = 0; i < 6; i++) dec('camping', DEAD_TREE, 20 + i, cx - 9 + r(30 + i) * 18, top + 3 + r(40 + i) * 12);
      for (let i = 0; i < 5; i++) dec('graveyard', /^Brown_\d_Mushrooms|^Red_Mushrooms|^Skull$|^Ribcage_1$|^Stone_\d/, 50 + i, cx - 8 + r(60 + i) * 16, top + 8 + r(70 + i) * 6);
      dec('graveyard', /^Skeleton$/, 12, cx + 2, top + 12);
      dec('graveyard', /^Crow_(Left|Right)/, 13, cx - 3, top + 10);
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
        if (n > 1 && (world.treeAt(x >> 5, y >> 5) || (world.escape && world.groundSet ? world.type(x >> 4, y >> 4) === 0 : world.type(x >> 4, y >> 4) !== 2) || world.isCleared(x >> 4, y >> 4))) continue;
        addProp(world, chunk, s, x, y, id, world.sv2 ? null : extra); // (in Survival the buildings are ruins: nothing to open or enter)
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
// on a Halloween map the meadows hold tombstones, pumpkins, candles and dead trees instead
const SCATTER_HW = [
  ['graveyard', GRAVES, 14],
  ['graveyard', /^(Medium|Big|Long|Little|Tiny)_(Blood_|Yellow_Lights_)?Pumpkin/, 12],
  ['graveyard', /^(Consumed_Candle|Big_Brown_Candle|Big_Red_Candle|Medium_Red_Candle|Candle_Holder_On)/, 5],
  ['graveyard', /^(Skull|Bones|Ribcage_1|Skeleton|Shovel|Crow_Front|Crow_Back)/, 4],
  ['graveyard', /^(Brown_\d_Mushrooms|Red_Mushrooms|Stone_\d|Grass_Tufts)/, 6],
  ['graveyard', /^Marble_(Brown|Grey)_Coffin|^Squared_(Closed|Open)_Coffin/, 3],
  ['camping', DEAD_TREE, 10],
  ['camping', /^Tree_Dead_Stick_\d+$/, 6],
];
const SCATTER_HW_TOTAL = SCATTER_HW.reduce((n, e) => n + e[2], 0);

function scatter(world, chunk, cx, cy) {
  const s = world.seed;
  for (let by = cy * 8; by < cy * 8 + 8; by++) {
    for (let bx = cx * 8; bx < cx * 8 + 8; bx++) {
      const x = bx * 2;
      const y = by * 2;
      // more along the edge of a cottage's yard, a little over open meadow
      const near = world.isCleared(x - 5, y) || world.isCleared(x + 5, y) || world.isCleared(x, y - 5) || world.isCleared(x, y + 5);
      if (hash2(bx, by, s + 9300) >= (world.hw ? (near ? 0.11 : 0.06) : near ? 0.085 : 0.03)) continue;
      if (Math.hypot(x, y) < 10) continue; // the starting spot stays clear
      if (world.treeAt(bx, by) || world.isCleared(x, y) || world.type(x, y) !== 2 || world.type(x + 1, y + 1) !== 2 || world.elevation(x, y) < 0.46) continue;
      const table = world.hw ? SCATTER_HW : SCATTER;
      let pick = hash2(bx, by, s + 9301) * (world.hw ? SCATTER_HW_TOTAL : SCATTER_TOTAL);
      const entry = table.find((e) => (pick -= e[2]) <= 0) || table[0];
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
  if (s.anim) {
    // animated scenery: a prop whose frames are played (see ANIMS)
    const a = ANIMS[s.anim];
    chunk.objects.push({ kind: 'tree', vid: id, sheet: `v2anim/${s.anim}`, sx: 0, sy: 0, sw: a.fw, sh: a.fh, x, y, anim: { frames: a.frames, fps: a.fps } });
    const rect = footprint(o, s);
    if (rect) chunk.rects.push({ vid: id, ...rect });
    return;
  }
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
  if (world.escape && /^(Car|Ambulance|Van|Truck|Taxi|Police_Car|Jeep|Bus)/i.test(s.name)) {
    // in the Escape zone you can search the cars (an ambulance has medicine in it)
    chunk.objects.push({ kind: 'chest', inter: 'chest', id: `v2c${id}`, vid: id, sheet: `v2/${s.theme}`, sx: s.x, sy: s.y, sw: s.w, sh: s.h, lootKind: /^Ambulance/i.test(s.name) ? 'ambulance' : 'car', label: 'F · search the vehicle', x, y });
    if (rect) chunk.rects.push({ vid: id, ...rect });
    return;
  }
  if (CONTAINER.test(s.name) && !world.sv2) {
    chunk.objects.push({ kind: 'chest', inter: 'chest', id: `v2c${id}`, vid: id, sheet: `v2/${s.theme}`, sx: s.x, sy: s.y, sw: s.w, sh: s.h, lootKind: lootKind(s.name), x, y });
    if (rect) chunk.rects.push({ vid: id, ...rect });
    return;
  }
  chunk.objects.push({ kind: 'tree', vid: id, sheet: `v2/${s.theme}`, sx: s.x, sy: s.y, sw: s.w, sh: s.h, x, y });
  if (rect) chunk.rects.push({ vid: id, ...rect });
}

