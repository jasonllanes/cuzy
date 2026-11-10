// Maze Rush: the places. Each level is a maze in one of the world's tilesets (public/assets/maps), dressed with Modern Exteriors props
// (the AssetPackV2 atlases) standing around the maze walls. The places repeat every ten levels, harder each time.
//   set:       which tileset draws the maze (render.js's wang tilesets: 16 tiles for every way two kinds of ground can meet)
//   pathShape: true when the corridors are the tileset's "shape" kind (the island, the road), false when they are the ground around it
//   decor:     [atlas, [sprite names]] props that stand in the frame around the maze
//   tint:      a colour laid over the whole place (the graveyard's dusk)

export const PLACES = [
  { id: 'emerald', name: 'Emerald Isles', icon: '🌴', set: 'emerald', pathShape: true, tune: 'island', bg: '#17505a', tint: null, decor: [['beach', ['Medium_Sea_Rock_1_Vers_1', 'Medium_Sea_Rock_2_Vers_1', 'Medium_Sea_Rock_3_Vers_1', 'Medium_Sea_Rock_4_Vers_1']]] },
  { id: 'beach', name: 'Sunny Shores', icon: '🏖️', set: 'beach', pathShape: false, tune: 'shore', bg: '#2fc2e8', tint: null, decor: [['beach', ['Medium_Sea_Rock_1_Vers_2', 'Medium_Sea_Rock_2_Vers_2', 'Medium_Sea_Rock_3_Vers_2', 'Broken_Arch_Sea_Rock_1_Vers_2', 'Broken_Arch_Sea_Rock_2_Vers_1', 'Broken_Arch_Sea_Rock_2_Vers_2']]] },
  { id: 'mountain', name: 'Mountain Paths', icon: '⛰️', set: 'mountain', pathShape: false, tune: 'mountain', bg: '#2d7a3a', tint: null, decor: [['camping', ['Tree_206', 'Tree_207', 'Tree_208', 'Tree_209', 'Tree_210', 'Tree_211', 'Tree_212', 'Tree_213']]] },
  { id: 'crystal', name: 'Crystal Lakes', icon: '💎', set: 'crystal', pathShape: false, tune: 'crystal', bg: '#2a8fe0', tint: null, decor: [['pool', ['Toy_Floating_1', 'Toy_Floating_2', 'Toy_Floating_3', 'Toy_Floating_4', 'Toy_Floating_5', 'Toy_Floating_6', 'Toy_Floating_7', 'Toy_Floating_8']]] },
  { id: 'tidal', name: 'Tidal Isles', icon: '🌊', set: 'tidal', pathShape: true, tune: 'island', bg: '#3fb6b0', tint: null, decor: [['beach', ['Medium_Sea_Rock_1_Vers_1', 'Medium_Sea_Rock_3_Vers_2', 'Broken_Arch_Sea_Rock_1_Vers_2', 'Broken_Arch_Sea_Rock_2_Vers_1']]] },
  { id: 'asphalt', name: 'Cracked Roads', icon: '🛣️', set: 'asphalt', pathShape: true, tune: 'wasteland', bg: '#1b2b44', tint: null, decor: [['props', ['Street_Lamp_1', 'Street_Lamp_2', 'Street_Lamp_3', 'Stacked_Barrels_1', 'Black_Open_Full_Trash_Can', 'Green_Open_Full_Trash_Can']], ['vehicles', ['Car_Down_1', 'Car_Down_2', 'Car_Down_3', 'Car_Down_4', 'Car_Up_5', 'Car_Up_6']]] },
  { id: 'marsh', name: 'Mossy Marsh', icon: '🐸', set: 'marsh', pathShape: false, tune: 'marsh', bg: '#2c5a2c', tint: null, decor: [['graveyard', ['Medium_Tree_1', 'Medium_Tree_2', 'Medium_Tree_3']]] },
  { id: 'wood', name: 'Wooden Halls', icon: '🏯', set: 'wood', pathShape: true, tune: 'halls', bg: '#4b3a2d', tint: null, decor: [['worksite', ['Stacked_Material_1', 'Stacked_Material_2', 'Stacked_Material_3', 'Stacked_Material_4', 'Tool_Box_2', 'Tool_Box_3']], ['props', ['Barrel_3', 'Barrel_4']]] },
  { id: 'lava', name: 'Magma Fields', icon: '🌋', set: 'lava', pathShape: false, tune: 'lava', bg: '#ff6a1f', tint: null, decor: [['graveyard', ['Black_Cross_3', 'Black_Cross_4', 'Grey_Cross_3', 'Grey_Cross_4']]] },
  { id: 'haunted', name: 'Halloween Graveyard', icon: '🎃', set: 'mountain', pathShape: false, tune: 'ruins', bg: '#241a3a', tint: 'rgba(110, 60, 170, 0.36)', decor: [['graveyard', ['Medium_Tree_1', 'Medium_Tree_2', 'Black_Cross_3', 'Brown_Cross_3', 'Brown_Cross_4', 'Grey_Cross_3', 'Marble_Grey_Coffin_1', 'Squared_Skull_Coffin']]] },
];

export const placeOf = (level) => PLACES[(level - 1) % PLACES.length];

// the atlases the places need
export const DECOR_ATLASES = [...new Set(PLACES.flatMap((p) => p.decor.map((d) => d[0])))];

// the five corner colours of a fruit are drawn in code (see mazeArt.js); these are the goals a level can ask for, in the order they come in
export const FRUITS = ['strawberry', 'cherry', 'lemon', 'grape', 'orange', 'apple', 'watermelon', 'blueberry'];
export const FRUIT_NAMES = { strawberry: 'Strawberry', cherry: 'Cherries', lemon: 'Lemon', grape: 'Grapes', orange: 'Orange', apple: 'Apple', watermelon: 'Watermelon', blueberry: 'Blueberries' };
