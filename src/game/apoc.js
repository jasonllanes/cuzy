// Everything Survival mode borrows from the Apocalypse asset pack (copied by scripts/copy-apoc.mjs).
import sizes from './apoc.json';

export const APOC_KEYS = Object.keys(sizes);
export const apocSize = (key) => sizes[key];
export const apocIcon = (key) => {
  const { w, h } = sizes[key];
  return { file: `apoc/${key}`, sx: 0, sy: 0, sw: w, sh: h, sheetW: w, sheetH: h };
};

// 16px cells in Background_Green_TileSet.png: plain grass in a few shades, and flat dirt
export const GROUND_GRASS = [[0, 0], [2, 0], [0, 2], [2, 2], [14, 0], [14, 2], [16, 0], [16, 2]];
export const GROUND_DIRT = [[15, 1]];

// Trees come in four sizes. Each size picks one of these looks, and has a small trunk to bump into.
export const APOC_TREES = {
  large: { keys: ['tree_big', 'tree_pine', 'tree_birch', 'tree_oak'], cw: 8, ch: 5 },
  medium: { keys: ['tree_normal', 'tree_spruce', 'tree_small'], cw: 6, ch: 4 },
  sapling: { keys: ['bush1', 'bush2'], cw: 0, ch: 0 },
  stump: { keys: ['stump'], cw: 8, ch: 4 },
};

// Wrecks and junk lying around. `solid` props block the way with a footprint along their bottom edge.
export const APOC_PROPS = [
  { key: 'van', solid: true },
  { key: 'car_blue', solid: true },
  { key: 'car_red', solid: true },
  { key: 'container_v', solid: true },
  { key: 'container_h', solid: true },
  { key: 'barrel', solid: true },
  { key: 'bin', solid: true },
  { key: 'fridge', solid: true },
  { key: 'pallet', solid: false },
  { key: 'cart', solid: true },
  { key: 'hydrant', solid: true },
  { key: 'stopsign', solid: false },
  { key: 'cardboard', solid: false },
  { key: 'cont_gray_v', solid: true },
  { key: 'cont_green_v', solid: true },
  { key: 'cont_green_h', solid: true },
  { key: 'cont_red_h', solid: true },
  { key: 'car_gray', solid: true },
  { key: 'car_orange', solid: true },
  { key: 'car_green', solid: true },
  { key: 'car_yellow', solid: true },
  { key: 'car_scrap', solid: true },
  { key: 'car_flipped', solid: true },
  { key: 'truck_blue', solid: true },
  { key: 'truck_orange', solid: true },
  { key: 'van_green', solid: true },
  { key: 'tractor', solid: true },
  { key: 'moto', solid: false },
  { key: 'barrel_blue', solid: true },
  { key: 'barrel_red2', solid: true },
  { key: 'bin2', solid: true },
  { key: 'trash_can', solid: true },
  { key: 'trash_bag', solid: false },
  { key: 'tires', solid: false },
  { key: 'cone', solid: false },
  { key: 'bench', solid: true },
  { key: 'bench_side', solid: true },
  { key: 'streetlight', solid: true },
  { key: 'streetlight_up', solid: true },
  { key: 'pallet2', solid: false },
  { key: 'cardboard2', solid: false },
  { key: 'metal_plates', solid: false },
  { key: 'iron_beam', solid: false },
  { key: 'brick_debris', solid: false },
  { key: 'hvac', solid: true },
  { key: 'wall_ruin', solid: true },
  { key: 'wall_ruin_corner', solid: true },
  { key: 'brick_lying', solid: true },
  { key: 'ammo_green', solid: true },
  { key: 'ammo_red', solid: true },
  { key: 'manhole', solid: false },
];

// the warehouse map is packed with these instead
export const DEPOT_PROPS = [
  'cont_gray_v', 'cont_green_v', 'cont_green_h', 'cont_red_h', 'container_v', 'container_h', 'barrel', 'barrel_blue', 'barrel_red2',
  'pallet', 'pallet2', 'cardboard', 'cardboard2', 'hvac', 'ammo_green', 'ammo_red', 'metal_plates', 'bin', 'bin2', 'cart', 'fridge',
  'wall_ruin', 'wall_ruin_corner', 'van', 'van_green', 'truck_blue', 'truck_orange', 'car_scrap', 'iron_beam', 'brick_debris', 'tires', 'cone',
].map((key) => APOC_PROPS.find((p) => p.key === key)).filter(Boolean);

// small bits scattered on the ground, as [key, weight]
export const APOC_DECOR = [
  ['grass3', 20], ['grass4', 20], ['grass5', 20], ['flowers_red', 6], ['flower_yellow', 8],
  ['rock6', 6], ['rock7', 5], ['stick', 8], ['mushroom', 4], ['puddle', 4],
];

// what lies on the ground for you to pick up
export const FORAGE_APOC = [
  { item: 'canned', img: 'pick_canned' },
  { item: 'soup', img: 'pick_soup' },
  { item: 'bandage', img: 'pick_bandage' },
];

// zombie sheets: how many frames each walk and death strip has
export const ZOMBIE_FRAMES = {
  small: { walk: 6, death: 6 },
  axe: { walk: 8, death: 6 },
  big: { walk: 8, death: 7 },
};

export const SURVIVOR = { id: 'survivor', kind: 'apoc', label: 'Survivor', title: 'Last one standing', blurb: 'Seen things. Still standing.' };
