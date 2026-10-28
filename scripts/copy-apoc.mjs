// Copies the Apocalypse assets that Survival mode uses into public/assets/apoc and records their sizes
// in src/game/apoc.json. Re-run with: node scripts/copy-apoc.mjs
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = join(root, 'Apocalypse');
const dest = join(root, 'public', 'assets', 'apoc');

const FILES = {
  // the survivor, four ways round
  char_idle_down: 'Character/Main/Idle/Character_down_idle-Sheet6.png',
  char_idle_up: 'Character/Main/Idle/Character_up_idle-Sheet6.png',
  char_idle_side: 'Character/Main/Idle/Character_side_idle-Sheet6.png',
  char_idle_left: 'Character/Main/Idle/Character_side-left_idle-Sheet6.png',
  char_run_down: 'Character/Main/Run/Character_down_run-Sheet6.png',
  char_run_up: 'Character/Main/Run/Character_up_run-Sheet6.png',
  char_run_side: 'Character/Main/Run/Character_side_run-Sheet6.png',
  char_run_left: 'Character/Main/Run/Character_side-left_run-Sheet6.png',
  // buildable walls
  wall_h: 'Objects/Buildable/Wooden/Wooden-wall_Horizontal.png',
  wall_v: 'Objects/Buildable/Wooden/Wooden-wall_Vertical.png',
  rwall_h: 'Objects/Buildable/Reinforced/Reinforced_wooden-wall_Horizontal.png',
  rwall_v: 'Objects/Buildable/Reinforced/Reinforced_wooden-wall_Vertical.png',
  // things lying around, and their inventory icons
  pick_bandage: 'Objects/Pickable/Bandage.png',
  pick_canned: 'Objects/Pickable/Canned-food.png',
  pick_soup: 'Objects/Pickable/Canned-soup.png',
  bat: 'Objects/Pickable/Bat.png',
  icon_bandage: 'UI/Inventory/Objects/Icon_Bandage.png',
  icon_canned: 'UI/Inventory/Objects/Icon_Canned-food.png',
  icon_soup: 'UI/Inventory/Objects/Icon_Canned-soup.png',
  icon_medkit: 'UI/Inventory/Objects/Icon_First-Aid-Kit_Red.png',
  icon_rock: 'UI/Inventory/Objects/Icon_Rock.png',
  icon_wall: 'UI/Inventory/Objects/Icon_Wooden-wall.png',
  // nature
  tree_spruce: 'Objects/Nature/Green/Tree_1_Spruce_Green.png',
  tree_normal: 'Objects/Nature/Green/Tree_3_Normal_Green.png',
  tree_big: 'Objects/Nature/Green/Tree_5_Big_Green.png',
  tree_pine: 'Objects/Nature/Green/Tree_6_Pine_Big_Green.png',
  tree_birch: 'Objects/Nature/Green/Tree_7_Birch_Green.png',
  tree_oak: 'Objects/Nature/Green/Tree_9_Small-oak_Green.png',
  tree_small: 'Objects/Nature/Green/Tree_10_Small-oak_Green.png',
  bush1: 'Objects/Nature/Green/Bush_1_Green.png',
  bush2: 'Objects/Nature/Green/Bush_2_Green.png',
  grass3: 'Objects/Nature/Green/Grass_3_Green.png',
  grass4: 'Objects/Nature/Green/Grass_4_Green.png',
  grass5: 'Objects/Nature/Green/Grass_5_Green.png',
  flowers_red: 'Objects/Nature/Flowers_Mashrooms_Other-nature-stuff/Flowers_2_red.png',
  flower_yellow: 'Objects/Nature/Flowers_Mashrooms_Other-nature-stuff/Flower_1_yellow.png',
  rock6: 'Objects/Nature/Flowers_Mashrooms_Other-nature-stuff/Rocks/Rock_6.png',
  rock7: 'Objects/Nature/Flowers_Mashrooms_Other-nature-stuff/Rocks/Rock_7.png',
  stick: 'Objects/Nature/Flowers_Mashrooms_Other-nature-stuff/Stick.png',
  stump: 'Objects/Nature/Flowers_Mashrooms_Other-nature-stuff/Stump_1.png',
  mushroom: 'Objects/Nature/Flowers_Mashrooms_Other-nature-stuff/Mushrooms_2_Red.png',
  puddle: 'Objects/Nature/Flowers_Mashrooms_Other-nature-stuff/Puddles-And-Water-Anim/Puddle_On-Grass_1_Grass_Green.png',
  // wrecks and junk that make the world feel abandoned (and give you things to run around)
  bus: 'Objects/Vehicles/Rust/Car_8_Rust_Bus/Car_8_Rust_Green_Bus.png',
  van: 'Objects/Vehicles/Rust/Car_3_Rust_Van/Car_3_Rust_Blue_Van.png',
  car_blue: 'Objects/Vehicles/Rust/Car_1_Rust/Car_1_Rust_Blue.png',
  car_red: 'Objects/Vehicles/Rust/Car_4_Rust/Car_4_Rust_Red.png',
  container_v: 'Objects/Container/Container_5_Red_Vertical.png',
  container_h: 'Objects/Container/Container_3_Gray_Horizontal.png',
  barrel: 'Objects/Barrel_rust_red_1.png',
  bin: 'Objects/Garbage-Bin_1.png',
  fridge: 'Objects/Refrigerator.png',
  pallet: 'Objects/Pallet_1.png',
  cart: 'Objects/Shopping-cart.png',
  cardboard: 'Objects/Cardboard_1.png',
  hydrant: 'Objects/Hydrant_1_red.png',
  stopsign: 'Objects/Stop-sign_Side_3.png',
  // ground tiles
  bg: 'Tiles/Background_Green_TileSet.png',
};

// zombies: walking in four directions, and a death in the two sideways ones
const ZOMBIES = {
  small: ['Zombie_Small', { walk: 'Sheet6', death: 'Sheet6' }, { down: 'Down_walk', up: 'Up_Walk', side: 'Side_Walk', left: 'Side-left_Walk' }],
  axe: ['Zombie_Axe', { walk: 'Sheet8', death: 'Sheet6' }, { down: 'Down_Walk', up: 'Up_Walk', side: 'Side_Walk', left: 'Side-left_Walk' }],
  big: ['Zombie_Big', { walk: 'Sheet8', death: 'Sheet7' }, { down: 'Down_Walk', up: 'Up_Walk', side: 'Side_Walk', left: 'Side-left_Walk' }],
};
for (const [kind, [folder, sheets, walks]] of Object.entries(ZOMBIES)) {
  for (const [dir, name] of Object.entries(walks)) {
    FILES[`z_${kind}_walk_${dir}`] = `Enemies/${folder}/${folder}_${name.replace('_', `_`)}-${sheets.walk}.png`.replace(/_(Down|Up|Side|Side-left)_(walk|Walk)/, '_$1_$2');
  }
  FILES[`z_${kind}_death_side`] = `Enemies/${folder}/${folder}_Side_First-Death-${sheets.death}.png`;
  FILES[`z_${kind}_death_left`] = `Enemies/${folder}/${folder}_Side-left_First-Death-${sheets.death}.png`;
}

mkdirSync(dest, { recursive: true });
const sizes = {};
for (const [key, rel] of Object.entries(FILES)) {
  const from = join(src, rel);
  let buf;
  try {
    buf = readFileSync(from);
  } catch {
    console.error('MISSING', key, rel);
    process.exitCode = 1;
    continue;
  }
  copyFileSync(from, join(dest, `${key}.png`));
  sizes[key] = { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}
writeFileSync(join(root, 'src', 'game', 'apoc.json'), `${JSON.stringify(sizes, null, 1)}\n`);
console.log(`Copied ${Object.keys(sizes).length} Apocalypse images`);
