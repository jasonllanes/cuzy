// Survival maps. The map rides along in the world seed after a "~" (for example "sunny-meadow-101~frost"), so rooms,
// saved settings and invites carry it without any extra field.
//   trees:   which painted set of trees the map uses (the files are named tree_big__orange and so on)
//   ground:  which ground tileset it is built from
//   climate: which weather it gets (see weather.js); indoor maps have none

export const SURVIVAL_MAPS = [
  { id: 'ruins', icon: '🏚️', name: 'Overgrown Town', blurb: 'Ruined streets, wrecks and wild trees.', ground: 'bg', trees: null, climate: 'mild' },
  { id: 'frost', icon: '❄️', name: 'Frostbite Pass', blurb: 'A frozen highway: snow, pines and pile-ups to hide behind.', ground: 'bg', trees: null, climate: 'frost' },
  { id: 'autumn', icon: '🍂', name: 'Rust Orchard', blurb: 'Orange woods and abandoned farm machinery.', ground: 'bg', trees: 'orange', climate: 'mild' },
  { id: 'dust', icon: '🏜️', name: 'Dry Plains', blurb: 'Bleached grass, open ground and long sight lines.', ground: 'bg_yellow', trees: 'yellow', climate: 'dry' },
  { id: 'swamp', icon: '🌫️', name: 'Dead Hollow', blurb: 'Dark, wet woods. It rains here a lot.', ground: 'bg_dark', trees: 'dark', climate: 'wet' },
  { id: 'depot', icon: '🏭', name: 'Cargo Depot', blurb: 'Indoors: a huge warehouse floor packed with crates, containers and wrecks.', ground: 'concrete', trees: null, climate: 'none', indoor: true },
  // the island maps: the same ruined world, on the Free Roam tilesets (water, or lava, where there is no ground)
  { id: 'tidal', icon: '🌊', name: 'Tidal Isles', blurb: 'Survive on brown islands in glittering teal water.', ground: 'bg', trees: null, climate: 'wet', tileset: 'tidal' },
  { id: 'emerald', icon: '🌴', name: 'Emerald Isles', blurb: 'Daylight survival: lush flowered islands ringed by earthen cliffs and deep sea, under the sun.', ground: 'bg', trees: null, climate: 'mild', tileset: 'emerald', day: true },
  { id: 'crystal', icon: '💎', name: 'Crystal Lakes', blurb: 'Daylight survival: dirt fields around glimmering crystal-blue lakes, in the bright of day.', ground: 'bg', trees: null, climate: 'mild', tileset: 'crystal', day: true },
  { id: 'marsh', icon: '🐸', name: 'Mossy Marsh', blurb: 'Murky green ponds and mushy banks. It rains a lot.', ground: 'bg', trees: null, climate: 'wet', tileset: 'marsh' },
  { id: 'lava', icon: '🌋', name: 'Magma Fields', blurb: 'Cracked stone between rivers of lava. Wade in and it burns you.', ground: 'bg', trees: null, climate: 'dry', tileset: 'lava' },
  { id: 'beach', icon: '🏖️', name: 'Sunny Shores', blurb: 'Daylight survival: golden sand and glowing turquoise sea, bright and hot.', ground: 'bg', trees: null, climate: 'dry', tileset: 'beach', day: true },
  { id: 'asphalt', icon: '🛣️', name: 'Cracked Roads', blurb: 'Cracked asphalt roads winding through a dark wasteland.', ground: 'bg', trees: null, climate: 'mild', tileset: 'asphalt' },
  { id: 'mountain', icon: '⛰️', name: 'Mountain Paths', blurb: 'Sunny meadows crossed by old rock roads, until a Colossus shows up: then the sky goes black and thunder rolls.', ground: 'bg', trees: null, climate: 'mild', tileset: 'mountain', bossStorm: true },
  { id: 'wood', icon: '🏯', name: 'Wooden Halls', blurb: 'Survive on an endless wooden floor of pale and dark boards.', ground: 'bg', trees: null, climate: 'mild', tileset: 'wood' },
  { id: 'mixed', icon: '🌍', name: 'Open World', blurb: 'Every biome in one endless world: islands, lakes, marsh, lava, beach, roads and mountains, each with its own monsters.', ground: 'bg', trees: null, climate: 'mild', tileset: 'mixed' },
  // Halloween: graveyards, pumpkin patches and dead trees from the Graveyard pack, under a purple dusk
  { id: 'haunted', icon: '🎃', name: 'Halloween Graveyard', blurb: 'Graveyards, pumpkin patches and dead groves under a purple dusk. Happy Halloween!', ground: 'bg_dark', trees: 'dark', climate: 'wet', halloween: true },
];

// Free Roam (and Wave Defense) maps: each is a hand-picked world with a name. The seed behind it is fixed.
export const FREE_MAPS = [
  { id: 'clover', icon: '🏡', name: 'Clover Vale', blurb: 'A village on a big lake, with woods and chests close by.', seed: 'clover-317' },
  { id: 'tidal', icon: '🌊', name: 'Tidal Isles', blurb: 'Brown earth islands in glittering teal water, with a tileset of its own.', seed: 'tidal-908' },
  { id: 'crystal', icon: '💎', name: 'Crystal Lakes', blurb: 'Dirt and grass fields around glimmering crystal-blue lakes.', seed: 'crystal-274' },
  { id: 'marsh', icon: '🐸', name: 'Mossy Marsh', blurb: 'Murky green ponds and mushy banks: a swamp of tides and mud.', seed: 'marsh-531' },
  { id: 'lava', icon: '🌋', name: 'Magma Fields', blurb: 'Cracked stone paths between rivers of lava. Wade in and it burns you.', seed: 'lava-777' },
  { id: 'beach', icon: '🏖️', name: 'Sunny Shores', blurb: 'Golden sand and glowing turquoise sea: a beach with open water all around.', seed: 'beach-482' },
  { id: 'asphalt', icon: '🛣️', name: 'Cracked Roads', blurb: 'Dark cracked asphalt roads winding through a dark blue wasteland.', seed: 'asphalt-358' },
  { id: 'mountain', icon: '⛰️', name: 'Mountain Paths', blurb: 'Green meadows crossed by old rock roads and mountain paths.', seed: 'mountain-206' },
  { id: 'wood', icon: '🏯', name: 'Wooden Halls', blurb: 'An endless pale and dark wooden floor, with cottages standing on it.', seed: 'wood-119' },
  { id: 'emerald', icon: '🌴', name: 'Emerald Isles', blurb: 'Lush green islands with flowers, ringed by earthen cliffs and deep teal sea.', seed: 'emerald-615' },
  { id: 'haunted', icon: '🎃', name: 'Halloween Graveyard', blurb: 'Graveyards behind iron gates, a chapel, pumpkin patches and dead groves, all under a purple dusk.', seed: 'haunted-666' },
  { id: 'mixed', icon: '🌍', name: 'Open World', blurb: 'An endless world made of every biome side by side: islands, lakes, marsh, lava, beach, roads and mountains. Each region has its own monsters, and the bosses change with the land.', seed: 'mixed-640' },
];

// Survival maps all use this base seed; the map itself is the difference
export const SURVIVAL_BASE = 'cuzy-survival';

// a friendly name for whatever world a seed makes
export function mapNameOf(seed) {
  if (isArenaSeed(seed)) return 'Colosseum';
  if (isRumbleSeed(seed)) return 'Beach Rumble Pitch';
  if (isPitchSeed(seed)) return 'Beach Ball Pitch';
  if (isEscapeSeed(seed)) return 'Escape Zone';
  const { base, map } = splitSeed(seed);
  const free = FREE_MAPS.find((m) => m.seed === base);
  if (free) return free.name;
  if (base === SURVIVAL_BASE || SURVIVAL_MAPS.some((m) => m.id === map && map !== 'ruins')) return mapInfo(map).name;
  return base === SURVIVAL_BASE ? mapInfo(map).name : `Custom world (${base})`;
}

export const mapInfo = (id) => SURVIVAL_MAPS.find((m) => m.id === id) || SURVIVAL_MAPS[0];

// A "@abc1" after the base is a layout roll: the same named map, but a freshly generated world (trees, houses, spawn)
export const splitSeed = (seed) => {
  const [rawBase, map] = String(seed).split('~');
  const base = rawBase.split('@')[0];
  return { base, map: SURVIVAL_MAPS.some((m) => m.id === map) ? map : 'ruins' };
};

// The Duel colosseum: a small walled square of sand with crates and pillars to hide behind (Free Roam rooms with Duel on)
export const ARENA_SEED = 'colosseum-1~arena';
export const isArenaSeed = (s) => /~arena$/.test(String(s));
export const stripArena = (s) => String(s).replace(/~arena$/, '');
// The Beach Ball pitch: a sand field with a goal at each end, in the sea (a Free Roam room with the Beach Ball match on)
export const PITCH_SEED = 'beachpitch-1~pitch';
export const isPitchSeed = (s) => /~pitch$/.test(String(s));
export const stripPitch = (s) => String(s).replace(/~pitch$/, '');
// The Beach Rumble pitch: a free for all with three teams and three goals (left, right and top), made on its own beach
export const RUMBLE_SEED = 'beachrumble-1~rumble';
export const isRumbleSeed = (s) => /~rumble$/.test(String(s));
export const stripRumble = (s) => String(s).replace(/~rumble$/, '');
// The Escape zone: an open world full of buildings to loot, zombies, and a chopper that arrives somewhere far away (Free Roam room with Escape on)
export const ESCAPE_SEED = 'asphalt-358~esc';
export const isEscapeSeed = (s) => /~esc$/.test(String(s));
export const stripEscape = (s) => String(s).replace(/~esc$/, '');

// Endless Survival (no waves) is a flag at the end of the seed: the same map, played differently
export const ENDLESS_TAG = '~endless';
export const isEndlessSeed = (s) => /~endless$/.test(String(s));
export const stripEndless = (s) => String(s).replace(/~endless$/, '');

export const joinSeed = (base, map) => (map && map !== 'ruins' ? `${base}~${map}` : base);

// Which map a world is (its id in FREE_MAPS or SURVIVAL_MAPS), and the same world on another map (the layout roll and the V2 tag stay)
export function mapIdOf(seed, mode) {
  if (mode === 'survival') return splitSeed(seed).map;
  const base = splitSeed(seed).base;
  return FREE_MAPS.find((m) => m.seed === base)?.id || '';
}

export function seedWithMap(seed, mode, mapId) {
  const roll = String(seed).split('~')[0].split('@')[1];
  if (mode === 'survival') {
    const map = SURVIVAL_MAPS.some((m) => m.id === mapId) ? mapId : 'ruins';
    return joinSeed(roll ? `${SURVIVAL_BASE}@${roll}` : SURVIVAL_BASE, map);
  }
  const free = FREE_MAPS.find((m) => m.id === mapId);
  if (!free) return seed;
  return `${roll ? `${free.seed}@${roll}` : free.seed}${/~v2$/.test(String(seed)) ? '~v2' : ''}`;
}

// The host switched a room between Free Roam and Survival: the matching map (same name where both have one, otherwise
// the first of the other mode), keeping a layout roll if there was one
export function seedForMode(seed, mode) {
  const { base, map } = splitSeed(seed);
  const roll = String(seed).split('~')[0].split('@')[1];
  if (mode === 'survival') {
    if (base === SURVIVAL_BASE) return seed;
    const id = FREE_MAPS.find((m) => m.seed === base)?.id;
    return joinSeed(roll ? `${SURVIVAL_BASE}@${roll}` : SURVIVAL_BASE, SURVIVAL_MAPS.some((m) => m.id === id) ? id : 'ruins');
  }
  if (base !== SURVIVAL_BASE) return seed;
  const free = FREE_MAPS.find((m) => m.id === map) || FREE_MAPS[0];
  return roll ? `${free.seed}@${roll}` : free.seed;
}
