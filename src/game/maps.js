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
];

// Free Roam (and Wave Defense) maps: each is a hand-picked world with a name. The seed behind it is fixed.
export const FREE_MAPS = [
  { id: 'clover', icon: '🏡', name: 'Clover Vale', blurb: 'A village on a big lake, with woods and chests close by.', seed: 'clover-317' },
  { id: 'woods', icon: '🌲', name: 'Whispering Woods', blurb: 'Thick forest all around, with cottages tucked between the trees.', seed: 'meadow-682' },
  { id: 'isles', icon: '🏝️', name: 'Heron Isles', blurb: 'Sandy islands and shallow seas. Wade, or ride a chicken across.', seed: 'heron-130' },
  { id: 'meadows', icon: '🌼', name: 'Golden Meadows', blurb: 'Wide open grass, a busy village and plenty of treasure chests.', seed: 'lantern-393' },
  { id: 'harbor', icon: '⚓', name: 'Mosshaven Harbor', blurb: 'A seaside town with a long shoreline and woods behind it.', seed: 'moss-545' },
  { id: 'treasure', icon: '💎', name: 'Treasure Hollow', blurb: 'A quiet valley that hides more chests than anywhere else.', seed: 'heron-114' },
];

// Survival maps all use this base seed; the map itself is the difference
export const SURVIVAL_BASE = 'cuzy-survival';

// a friendly name for whatever world a seed makes
export function mapNameOf(seed) {
  const { base, map } = splitSeed(seed);
  const free = FREE_MAPS.find((m) => m.seed === base);
  if (free) return free.name;
  if (base === SURVIVAL_BASE || SURVIVAL_MAPS.some((m) => m.id === map && map !== 'ruins')) return mapInfo(map).name;
  return base === SURVIVAL_BASE ? mapInfo(map).name : `Custom world (${base})`;
}

export const mapInfo = (id) => SURVIVAL_MAPS.find((m) => m.id === id) || SURVIVAL_MAPS[0];

export const splitSeed = (seed) => {
  const [base, map] = String(seed).split('~');
  return { base, map: SURVIVAL_MAPS.some((m) => m.id === map) ? map : 'ruins' };
};

export const joinSeed = (base, map) => (map && map !== 'ruins' ? `${base}~${map}` : base);
