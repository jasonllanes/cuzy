import { apocIcon } from './apoc';

// Icons point at files in public/assets. `sheet` sizes are only needed when the icon is a crop of a bigger image.
// heal: share (0..1) of your max HP restored when eaten.  energy: fraction (0..1) of the stamina bar restored.
const crops = (sx, sy) => ({ file: 'crops', sx, sy, sw: 16, sh: 16, sheetW: 224, sheetH: 128 });
const single = (file, sw, sh) => ({ file: `items/${file}`, sx: 0, sy: 0, sw, sh, sheetW: sw, sheetH: sh });
const strip = (file) => ({ file: `items/${file}`, sx: 0, sy: 0, sw: 16, sh: 16, sheetW: 64, sheetH: 16 });

export const ITEMS = {
  berry: { name: 'Wild Strawberry', desc: 'Sweet, juicy and a little bit sticky.', icon: crops(128, 16), stack: 20, heal: 0.08, energy: 0.2 },
  leek: { name: 'Spring Leek', desc: 'Crunchy, fresh and very soup-ready.', icon: crops(128, 48), stack: 20, heal: 0.12, energy: 0.1 },
  tuber: { name: 'Sweet Tuber', desc: 'Dug up from the meadow. Very filling!', icon: crops(128, 80), stack: 20, heal: 0.25 },
  mushroom_red: { name: 'Red Mushroom', desc: 'A polka-dotted little cap. Pretty, not for snacking.', icon: strip('mushroom_red'), stack: 20 },
  mushroom_blue: { name: 'Glow Cap', desc: 'A blue mushroom that hums softly at night.', icon: strip('mushroom_blue'), stack: 20 },
  acorn: { name: 'Shiny Acorn', desc: 'Polished by many squirrel paws.', icon: single('acron', 10, 9), stack: 30, throw: 1 },
  honey: { name: 'Jar of Honey', desc: 'Golden and sweet. A spoonful goes a long way.', icon: single('jar_01', 10, 12), stack: 10, heal: 0.17, energy: 0.3 },
  jam: { name: 'Berry Jam', desc: "Somebody's grandma made this.", icon: single('jar_02', 10, 13), stack: 10, heal: 0.25 },
  milk: { name: 'Fresh Milk', desc: 'Still a little bit warm. Smooth and refreshing.', icon: single('milk', 10, 12), stack: 10, heal: 0.08, energy: 0.5 },
  egg: { name: 'Soft Egg', desc: 'Laid this morning, probably.', icon: single('egg', 10, 11), stack: 10, heal: 0.17, throw: 1 },
  coin: { name: 'Lucky Coin', desc: 'Warm to the touch. Always lands on its good side.', icon: single('coin', 8, 7), stack: 9999, throw: 1 },
  gold: { name: 'Gold Nugget', desc: 'Heavier than it looks. Great for throwing.', icon: single('ore_gold', 10, 10), stack: 30, throw: 2 },
  gem: { name: 'Blue Gemstone', desc: 'Twinkles even in the dark. Hits hard when thrown.', icon: single('ore_bluestone', 10, 10), stack: 30, throw: 3 },
  rock: { name: 'Smooth Rock', desc: 'A good, honest throwing rock.', icon: single('rock', 10, 10), stack: 20, throw: 2 },
  mug: { name: 'Cozy Mug', desc: 'Best friend of rainy afternoons. Breaks when thrown!', icon: single('mug_01', 5, 9), stack: 5, throw: 2, fragile: true },
  wood: { name: 'Wood', desc: 'Logs and sticks from the trees you chop. Swords and other weapons are crafted from it at the shop.', icon: single('wood', 11, 11), stack: 99 },
  wool: { name: 'Ball of Wool', desc: 'Soft enough to nap on.', icon: single('wool', 10, 10), stack: 20 },
  // (the id stays "truffle" so old saves keep working)
  truffle: { name: 'Sticky Grenade', desc: 'Throw it: it sticks to whatever it hits and explodes a few seconds later. A red circle on the ground shows the blast.', icon: single('grenade', 12, 14), stack: 10, throw: 2, bomb: true },
  stungrenade: { name: 'Stun Grenade', desc: 'Throw it: after a moment it flashes and stuns every monster nearby for a few seconds. A blue circle on the ground shows how far it reaches.', icon: single('grenade_stun', 12, 14), stack: 10, throw: 1, bomb: true },
  landmine: { name: 'Landmine', desc: 'Right-click to lay it on the ground. After a moment it arms, and the first enemy that walks over it sets off a big blast. Rival heroes set it off too, so mind where you step.', icon: single('landmine', 19, 18), stack: 10 },
  beartrap: { name: 'Stun Trap', desc: 'Right-click to set it on the ground. Whatever steps into it, a monster or a rival hero, is stunned for a few seconds.', icon: single('beartrap', 20, 12), stack: 10 },
  smokegrenade: { name: 'Smoke Grenade', desc: 'Throw it: it puffs out a thick cloud for several seconds. Stand inside and enemies cannot see you (attacking gives you away for a moment).', icon: single('grenade_smoke', 12, 14), stack: 10, throw: 1, bomb: true },
  sword: { name: 'Sword', desc: 'Select this slot, then left-click to swing (hold to charge a dash). Select another slot and left-click does whatever that slot is for.', icon: { file: 'sword', sx: 0, sy: 0, sw: 14, sh: 14, sheetW: 14, sheetH: 14 }, stack: 1, wave: true },
  barricade: { name: 'Barricade Box', desc: 'Select it and left-click where you want the wall (or press Q). Hold left-click to lock it, move the mouse to turn it, release to place. Pick one up again with Space.', icon: single('crate_top', 16, 14), stack: 9, wave: true },
  // Survival (Apocalypse) pickups
  bandage: { name: 'Bandage', desc: 'Not pretty, but it holds.', icon: apocIcon('icon_bandage'), stack: 10, heal: 0.17 },
  canned: { name: 'Canned Food', desc: 'Dented, undated, delicious.', icon: apocIcon('icon_canned'), stack: 10, heal: 0.25, energy: 0.1 },
  soup: { name: 'Canned Soup', desc: 'Still a little bit warm somehow.', icon: apocIcon('icon_soup'), stack: 10, heal: 0.17, energy: 0.4 },
  medkit: { name: 'First Aid Kit', desc: 'The good stuff. Heals a lot.', icon: apocIcon('icon_medkit'), stack: 5, heal: 0.58 },
  // Free Roam supplies: they live in the two quick slots (Z / X), not in the backpack
  hppack: { name: 'HP Pack', desc: 'Bandages, a tonic and a tiny pillow. Restores 90% of your health.', icon: apocIcon('icon_medkit'), stack: 9, heal: 0.9 },
  soupcan: { name: 'Soup Can', desc: 'A warm can of soup. Restores 60% of your stamina.', icon: apocIcon('icon_soup'), stack: 9, energy: 0.6 },
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
  ['truffle', 3, 1, 2],
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
  ['truffle', 3, 1, 2],
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

// Survival's guns are backpack items too: select one and right click shoots with it. (Defined after the loop below, they are one to a slot.)
const gunItem = (id, name, sw, sh, desc) => ({ name, desc, icon: { file: `guns/${id}`, sx: 0, sy: 0, sw, sh, sheetW: sw, sheetH: sh, fit: 34 }, stack: 1, wave: true, gun: id });

// A slot holds up to 99 of anything (a sword just the one). Coins are not backpack items at all: they live in your purse.
for (const [id, def] of Object.entries(ITEMS)) {
  if (id === 'sword') continue;
  if (id === 'coin') {
    delete def.throw; // coins can be dropped, never thrown
    continue;
  }
  def.stack = 99;
}

ITEMS.gun_pistol = gunItem('pistol', 'Pistol', 55, 41, 'Select it, then right-click to shoot. Steady and accurate. 12 rounds, and it reloads by itself.');
ITEMS.gun_shotgun = gunItem('shotgun', 'Shotgun', 117, 32, 'Select it, then right-click to shoot. Five pellets that stack up at point blank. 6 shells.');
ITEMS.gun_rifle = gunItem('rifle', 'Rifle', 107, 50, 'Select it, then right-click to shoot. A fast, accurate assault rifle. 60 rounds.');
ITEMS.gun_sidearm = gunItem('sidearm', 'Sidearm', 28, 20, 'Select it, then right-click to shoot. A small, cheap spare. 10 rounds.');
ITEMS.gun_glock = gunItem('glock', 'Glock 19', 30, 23, 'Select it, then right-click to shoot. Light and quick, with a big magazine. 17 rounds.');
ITEMS.gun_m1911 = gunItem('m1911', 'M1911', 36, 22, 'Select it, then right-click to shoot. An old classic that hits harder. 8 rounds.');
ITEMS.gun_sawedoff = gunItem('sawedoff', 'Sawed-off', 50, 20, 'Select it, then right-click to shoot. Two barrels, seven pellets: terrible at range, a wall at point blank. 2 shells.');
ITEMS.gun_uzi = gunItem('uzi', 'Mini Uzi', 41, 28, 'Select it, then right-click to shoot. A stream of small bullets. 32 rounds.');
ITEMS.gun_lever = gunItem('lever', 'Lever rifle', 56, 19, 'Select it, then right-click to shoot. Slow, accurate and long-ranged. 10 rounds.');
ITEMS.gun_magnum = gunItem('magnum', 'Magnum', 46, 21, 'Select it, then right-click to shoot. A revolver that goes through one enemy and hits the next. 6 rounds.');
ITEMS.gun_pump = gunItem('pump', 'Pump shotgun', 64, 16, 'Select it, then right-click to shoot. Six pellets and eight shells: the long, reliable shotgun.');
ITEMS.gun_deagle = gunItem('deagle', 'Desert Eagle', 43, 26, 'Select it, then right-click to shoot. A handcannon that punches through. 7 rounds.');
ITEMS.gun_ak47 = gunItem('ak47', 'AK-47', 56, 21, 'Select it, then right-click to shoot. A tough automatic rifle. 30 rounds.');
ITEMS.gun_raygun = gunItem('raygun', 'Ray gun', 35, 21, 'Select it, then right-click to shoot. Zaps that burn through two enemies. 24 charges.');
ITEMS.gun_sniper = gunItem('sniper', 'Sniper rifle', 58, 17, 'Select it, then right-click to shoot. One slow, huge shot that goes through up to three zombies. 5 rounds.');
ITEMS.gun_laser = gunItem('laser', 'Blue laser', 50, 21, 'Select it, then right-click to shoot. A rapid beam of blue bolts. 40 charges.');
ITEMS.gun_fireplasma = gunItem('fireplasma', 'Flamethrower', 41, 22, 'Select it, then hold right-click to spray fire. Everything in the cone burns. 120 shots of fuel.');
ITEMS.gun_quantum = gunItem('quantum', 'Quantum plasma', 53, 21, 'Select it, then right-click to shoot. The best gun there is: a fast stream of plasma through whole lines of zombies. 30 charges.');
ITEMS.gun_plasma = gunItem('plasma', 'Plasma gun', 111, 35, 'Select it, then right-click to shoot. Glowing bolts that burn through two enemies. 20 charges.');

// Rarity: the colour of the frame around an item, in the backpack, the shop and on the ground.
export const RARITIES = {
  common: { name: 'Common', color: '#a79c8c' },
  uncommon: { name: 'Uncommon', color: '#58b85c' },
  rare: { name: 'Rare', color: '#3f95f0' },
  epic: { name: 'Epic', color: '#a366ee' },
  legendary: { name: 'Legendary', color: '#f0a21e' },
};
const RARITY_OF = {
  tuber: 'uncommon', mushroom_red: 'uncommon', milk: 'uncommon', honey: 'uncommon', jam: 'uncommon', soup: 'uncommon', barricade: 'uncommon', hppack: 'uncommon', soupcan: 'uncommon',
  mushroom_blue: 'rare', gold: 'rare', truffle: 'rare', stungrenade: 'rare', smokegrenade: 'rare', landmine: 'rare', beartrap: 'rare', medkit: 'rare', sword: 'uncommon',
  gem: 'epic',
};
export const rarityOf = (id) => RARITY_OF[id] || 'common';
RARITY_OF.gun_shotgun = 'uncommon';
RARITY_OF.gun_rifle = 'rare';
RARITY_OF.gun_plasma = 'epic';
RARITY_OF.gun_sidearm = 'common';
RARITY_OF.gun_glock = 'common';
RARITY_OF.gun_m1911 = 'uncommon';
RARITY_OF.gun_sawedoff = 'uncommon';
RARITY_OF.gun_uzi = 'uncommon';
RARITY_OF.gun_lever = 'uncommon';
RARITY_OF.gun_magnum = 'rare';
RARITY_OF.gun_pump = 'rare';
RARITY_OF.gun_deagle = 'rare';
RARITY_OF.gun_ak47 = 'rare';
RARITY_OF.gun_raygun = 'epic';
RARITY_OF.gun_sniper = 'epic';
RARITY_OF.gun_laser = 'epic';
RARITY_OF.gun_fireplasma = 'epic';
RARITY_OF.gun_quantum = 'legendary';
// swords, staffs and the rest: the dearer, the rarer
export const rarityByCost = (cost) => (cost <= 14 ? 'common' : cost <= 28 ? 'uncommon' : cost <= 40 ? 'rare' : cost <= 52 ? 'epic' : 'legendary');

// What a shop pays when you sell something back. Items without a price here can't be sold.
const SELL = {
  berry: 1, leek: 1, tuber: 2, mushroom_red: 1, mushroom_blue: 2, acorn: 1, honey: 3, jam: 3, milk: 2, egg: 1, gold: 8, gem: 12,
  rock: 1, mug: 2, wool: 1, stungrenade: 4, smokegrenade: 3, landmine: 5, beartrap: 4, truffle: 4, barricade: 2, bandage: 2, canned: 2, soup: 2, medkit: 5, seeds: 1,
};
export const sellValue = (id) => SELL[id] || 0;
// Swords, guns and shop supplies go back for half of what they cost
export const sellPrice = (cost) => Math.max(1, Math.floor(cost / 2));

// How many things the HP ('hp') or Stamina ('stam') slot can use: the pack, plus every food and drink that does the same job
export const supplyTotal = (kind, supplies = {}, consumables = {}) =>
  (supplies[kind] || 0) + Object.entries(consumables).reduce((n, [id, q]) => n + (ITEMS[id] && (kind === 'hp' ? ITEMS[id].heal : ITEMS[id].energy) ? q : 0), 0);
