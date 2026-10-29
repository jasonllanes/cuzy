import { apocIcon } from './apoc';

// Icons point at files in public/assets. `sheet` sizes are only needed when the icon is a crop of a bigger image.
// heal: hearts of HP restored when eaten.  energy: fraction (0..1) of the stamina bar restored.
const crops = (sx, sy) => ({ file: 'crops', sx, sy, sw: 16, sh: 16, sheetW: 224, sheetH: 128 });
const single = (file, sw, sh) => ({ file: `items/${file}`, sx: 0, sy: 0, sw, sh, sheetW: sw, sheetH: sh });
const strip = (file) => ({ file: `items/${file}`, sx: 0, sy: 0, sw: 16, sh: 16, sheetW: 64, sheetH: 16 });

export const ITEMS = {
  berry: { name: 'Wild Strawberry', desc: 'Sweet, juicy and a little bit sticky.', icon: crops(128, 16), stack: 20, heal: 0.5, energy: 0.2 },
  leek: { name: 'Spring Leek', desc: 'Crunchy, fresh and very soup-ready.', icon: crops(128, 48), stack: 20, heal: 0.75, energy: 0.1 },
  tuber: { name: 'Sweet Tuber', desc: 'Dug up from the meadow. Very filling!', icon: crops(128, 80), stack: 20, heal: 1.5 },
  mushroom_red: { name: 'Red Mushroom', desc: 'A polka-dotted little cap. Pretty, not for snacking.', icon: strip('mushroom_red'), stack: 20 },
  mushroom_blue: { name: 'Glow Cap', desc: 'A blue mushroom that hums softly at night.', icon: strip('mushroom_blue'), stack: 20 },
  acorn: { name: 'Shiny Acorn', desc: 'Polished by many squirrel paws.', icon: single('acron', 10, 9), stack: 30, throw: 1 },
  honey: { name: 'Jar of Honey', desc: 'Golden and sweet. A spoonful goes a long way.', icon: single('jar_01', 10, 12), stack: 10, heal: 1, energy: 0.3 },
  jam: { name: 'Berry Jam', desc: "Somebody's grandma made this.", icon: single('jar_02', 10, 13), stack: 10, heal: 1.5 },
  milk: { name: 'Fresh Milk', desc: 'Still a little bit warm. Smooth and refreshing.', icon: single('milk', 10, 12), stack: 10, heal: 0.5, energy: 0.5 },
  egg: { name: 'Soft Egg', desc: 'Laid this morning, probably.', icon: single('egg', 10, 11), stack: 10, heal: 1, throw: 1 },
  coin: { name: 'Lucky Coin', desc: 'Warm to the touch. Always lands on its good side.', icon: single('coin', 8, 7), stack: 9999, throw: 1 },
  gold: { name: 'Gold Nugget', desc: 'Heavier than it looks. Great for throwing.', icon: single('ore_gold', 10, 10), stack: 30, throw: 2 },
  gem: { name: 'Blue Gemstone', desc: 'Twinkles even in the dark. Hits hard when thrown.', icon: single('ore_bluestone', 10, 10), stack: 30, throw: 3 },
  rock: { name: 'Smooth Rock', desc: 'A good, honest throwing rock.', icon: single('rock', 10, 10), stack: 20, throw: 2 },
  mug: { name: 'Cozy Mug', desc: 'Best friend of rainy afternoons. Breaks when thrown!', icon: single('mug_01', 5, 9), stack: 5, throw: 2, fragile: true },
  wool: { name: 'Ball of Wool', desc: 'Soft enough to nap on.', icon: single('wool', 10, 10), stack: 20 },
  truffle: { name: 'Truffle', desc: 'A rare, earthy treat.', icon: single('truffle', 10, 10), stack: 10, heal: 2 },
  sword: { name: 'Sword', desc: 'Select this slot, then left-click to swing (hold to charge a dash). Select another slot and left-click does whatever that slot is for.', icon: { file: 'sword', sx: 0, sy: 0, sw: 14, sh: 14, sheetW: 14, sheetH: 14 }, stack: 1, wave: true },
  barricade: { name: 'Barricade Box', desc: 'Select it and left-click where you want the wall (or press Q). Hold left-click to lock it, move the mouse to turn it, release to place. Pick one up again with Space.', icon: single('crate_top', 16, 14), stack: 9, wave: true },
  // Survival (Apocalypse) pickups
  bandage: { name: 'Bandage', desc: 'Not pretty, but it holds.', icon: apocIcon('icon_bandage'), stack: 10, heal: 1 },
  canned: { name: 'Canned Food', desc: 'Dented, undated, delicious.', icon: apocIcon('icon_canned'), stack: 10, heal: 1.5, energy: 0.1 },
  soup: { name: 'Canned Soup', desc: 'Still a little bit warm somehow.', icon: apocIcon('icon_soup'), stack: 10, heal: 1, energy: 0.4 },
  medkit: { name: 'First Aid Kit', desc: 'The good stuff. Heals a lot.', icon: apocIcon('icon_medkit'), stack: 5, heal: 3.5 },
  // Free Roam supplies: they live in the two quick slots (Z / X), not in the backpack
  hppack: { name: 'HP Pack', desc: 'Bandages, a tonic and a tiny pillow. Restores 50 HP. Press Z.', icon: apocIcon('icon_medkit'), stack: 9, heal: 3 },
  soupcan: { name: 'Soup Can', desc: 'A warm can of soup. Restores 60% stamina. Press X.', icon: apocIcon('icon_soup'), stack: 9, energy: 0.6 },
  seeds: { name: 'Mystery Seeds', desc: 'Who knows what they will grow into?', icon: single('seeds_generic', 11, 10), stack: 50 },
};

// Survival swaps a couple of icons for their Apocalypse versions
let theme = 'cozy';
export const setTheme = (t) => {
  theme = t;
};
const APOC_ICONS = { rock: apocIcon('icon_rock'), barricade: apocIcon('icon_wall'), sword: { file: 'apoc/bat', sx: 0, sy: 0, sw: 11, sh: 12, sheetW: 11, sheetH: 12 } };
export const iconOf = (id) => (theme === 'apoc' && APOC_ICONS[id]) || ITEMS[id].icon;

// How far each item flies when thrown, in pixels (16px = 1 tile). Light things sail, heavy things thud.
const THROW_RANGE = {
  acorn: 150, coin: 140, seeds: 140, gem: 130, egg: 125, berry: 120, wool: 105, mug: 115,
  leek: 105, truffle: 100, rock: 100, gold: 92, tuber: 90, milk: 85, honey: 85, jam: 85,
};
const DEFAULT_RANGE = 110;
export const throwRange = (id) => THROW_RANGE[id] ?? DEFAULT_RANGE;
export const throwWeight = (id) => {
  const r = throwRange(id);
  return r >= 130 ? 'Light' : r <= 100 ? 'Heavy' : 'Medium';
};
// Lighter things also leave the hand faster. `life` is how long the throw flies before it drops.
export function throwStats(id) {
  const range = throwRange(id);
  const speed = 120 + range * 0.6;
  return { range, speed, life: range / speed };
}

export const isConsumable = (def) => !!(def.heal || def.energy);
// Anything can be hurled; items without an explicit `throw` value just do 1 damage.
export const throwDamage = (def) => def.throw ?? 1;
// Food, drink and glassware splat instead of surviving the throw
export const breaksOnImpact = (def) => isConsumable(def) || def.fragile === true;
export const consumeVerb = (def) => ((def.energy || 0) * 2 >= (def.heal || 0) && def.energy ? 'Drink' : 'Eat');

// What a chest can hold: [item, weight, min, max]
export const LOOT = [
  ['acorn', 3, 1, 3],
  ['honey', 2, 1, 1],
  ['jam', 2, 1, 1],
  ['milk', 2, 1, 2],
  ['egg', 2, 1, 3],
  ['coin', 4, 2, 6],
  ['rock', 2, 1, 3],
  ['gold', 1, 1, 2],
  ['gem', 1, 1, 1],
  ['mug', 1, 1, 1],
  ['wool', 2, 1, 2],
  ['truffle', 1, 1, 1],
  ['seeds', 3, 2, 5],
];

// Where each item can be found, besides chests (see LOOT for those odds)
export const FOUND_BY_FORAGING = {
  berry: 'Wild plants in open meadows',
  leek: 'Wild plants in open meadows',
  tuber: 'Wild plants in open meadows',
  mushroom_red: 'Growing between trees in forests',
  mushroom_blue: 'Growing between trees in forests',
};

export const WATER_STAMINA = 0.3;

// Chance of each item per chest roll (a chest rolls twice) and its quantity range
export function chestOdds(id) {
  const total = LOOT.reduce((s, l) => s + l[1], 0);
  const row = LOOT.find((l) => l[0] === id);
  return row ? { chance: row[1] / total, min: row[2], max: row[3] } : null;
}

// What a supply fridge can hold in Survival
export const LOOT_APOC = [
  ['hppack', 2, 1, 2],
  ['soupcan', 3, 1, 2],
  ['barricade', 8, 1, 3],
  ['coin', 3, 2, 5],
];

export function rollLoot(r1, r2, table = LOOT) {
  const total = table.reduce((s, l) => s + l[1], 0);
  let pick = r1 * total;
  for (const [item, weight, min, max] of table) {
    pick -= weight;
    if (pick <= 0) return { item, qty: min + Math.floor(r2 * (max - min + 1)) };
  }
  return { item: 'acorn', qty: 1 };
}

// A slot holds up to 99 of anything (a sword just the one). Coins are not backpack items at all: they live in your purse.
for (const [id, def] of Object.entries(ITEMS)) {
  if (id === 'sword') continue;
  if (id === 'coin') {
    delete def.throw; // coins can be dropped, never thrown
    continue;
  }
  def.stack = 99;
}
