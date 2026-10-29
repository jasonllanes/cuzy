// Wave Defense content: who shows up, how tough they are, what they drop.
//
// Sprites come from the ENEMY folder (public/assets/monsters), each a 4-frame 16x16 loop.
//   kind: walk  = marches on the base and chews through barricades
//         fly   = floats over walls and water
//         shoot = keeps its distance and fires at barricades, the house or heroes
//   hp: base health   speed: px/s   dmg: hearts taken from a hero   sd: damage to barricades and the house
//   scale: pixel-art size multiplier (2 = big brute, 3 = boss)

export const MONSTERS = {
  bones: { name: 'Decrepit Bones', sprite: 'DecrepitBones', kind: 'walk', hp: 3, speed: 26, dmg: 1, sd: 2 },
  cadaver: { name: 'Bound Cadaver', sprite: 'BoundCadaver', kind: 'walk', hp: 5, speed: 18, dmg: 1, sd: 2 },
  stumbler: { name: 'Mutilated Stumbler', sprite: 'MutilatedStumbler', kind: 'walk', hp: 4, speed: 22, dmg: 1, sd: 2 },
  redcap: { name: 'Red Cap', sprite: 'RedCap', kind: 'walk', hp: 3, speed: 31, dmg: 1, sd: 2 },
  jelly: { name: 'Ochre Jelly', sprite: 'OchreJelly', kind: 'walk', hp: 4, speed: 16, dmg: 1, sd: 2 },
  slime: { name: 'Death Slime', sprite: 'DeathSlime', kind: 'walk', hp: 6, speed: 14, dmg: 1, sd: 3 },
  hand: { name: 'Skittering Hand', sprite: 'SkitteringHand', kind: 'walk', hp: 2, speed: 46, dmg: 1, sd: 1 },
  hound: { name: 'Toxic Hound', sprite: 'ToxicHound', kind: 'walk', hp: 4, speed: 40, dmg: 1, sd: 2 },
  scarab: { name: 'Royal Scarab', sprite: 'RoyalScarab', kind: 'walk', hp: 3, speed: 38, dmg: 1, sd: 2 },
  ghoul: { name: 'Sand Ghoul', sprite: 'SandGhoul', kind: 'walk', hp: 6, speed: 24, dmg: 1, sd: 3 },
  crawler: { name: 'Unraveling Crawler', sprite: 'UnravelingCrawler', kind: 'walk', hp: 5, speed: 20, dmg: 1, sd: 2 },
  feeder: { name: 'Carcass Feeder', sprite: 'CarcassFeeder', kind: 'walk', hp: 3, speed: 33, dmg: 1, sd: 2 },
  dcrawler: { name: 'Dismembered Crawler', sprite: 'DismemberedCrawler', kind: 'walk', hp: 3, speed: 28, dmg: 1, sd: 2 },
  grimlock: { name: 'Blinded Grimlock', sprite: 'BlindedGrimlock', kind: 'walk', hp: 6, speed: 24, dmg: 1, sd: 3 },
  myconid: { name: 'Fungal Myconid', sprite: 'FungalMyconid', kind: 'walk', hp: 7, speed: 18, dmg: 1, sd: 3 },
  revenant: { name: 'Grave Revenant', sprite: 'GraveRevenant', kind: 'walk', hp: 9, speed: 28, dmg: 2, sd: 4 },
  crimson: { name: 'Crimson Slaad', sprite: 'CrimsonSlaad', kind: 'walk', hp: 8, speed: 26, dmg: 2, sd: 4 },
  murky: { name: 'Murky Slaad', sprite: 'MurkySlaad', kind: 'walk', hp: 10, speed: 22, dmg: 2, sd: 4 },

  bat: { name: 'Vampire Bat', sprite: 'VampireBat', kind: 'fly', hp: 2, speed: 48, dmg: 1, sd: 1 },
  eye: { name: 'Bloodshot Eye', sprite: 'BloodshotEye', kind: 'fly', hp: 3, speed: 30, dmg: 1, sd: 1 },
  ghastly: { name: 'Ghastly Eye', sprite: 'GhastlyEye', kind: 'fly', hp: 5, speed: 24, dmg: 1, sd: 2 },

  archer: { name: 'Brittle Archer', sprite: 'BrittleArcher', kind: 'shoot', hp: 4, speed: 20, dmg: 1, sd: 2, range: 84, rate: 2.4 },
  watcher: { name: 'Ocular Watcher', sprite: 'OcularWatcher', kind: 'shoot', fly: true, hp: 4, speed: 22, dmg: 1, sd: 2, range: 70, rate: 2.8 },
  shrieker: { name: 'Shrieker Mushroom', sprite: 'ShriekerMushroom', kind: 'shoot', hp: 4, speed: 10, dmg: 1, sd: 2, range: 60, rate: 2.2 },

  ogre: { name: 'Brawny Ogre', sprite: 'BrawnyOgre', kind: 'walk', hp: 20, speed: 16, dmg: 2, sd: 6, scale: 2, kb: 0.25 },
  stonetroll: { name: 'Stone Troll', sprite: 'StoneTroll', kind: 'walk', hp: 26, speed: 14, dmg: 2, sd: 8, scale: 2, kb: 0.2 },
  swamptroll: { name: 'Swamp Troll', sprite: 'SwampTroll', kind: 'walk', hp: 22, speed: 18, dmg: 2, sd: 7, scale: 2, kb: 0.25 },
  ettin: { name: 'Humongous Ettin', sprite: 'HumongousEttin', kind: 'walk', hp: 30, speed: 14, dmg: 3, sd: 10, scale: 2, kb: 0.15 },
  giantscarab: { name: 'Giant Royal Scarab', sprite: 'GiantRoyalScarab', kind: 'walk', hp: 28, speed: 26, dmg: 2, sd: 7, scale: 2, kb: 0.25 },
  cyclops: { name: 'Crushing Cyclops', sprite: 'CrushingCyclops', kind: 'walk', hp: 100, speed: 12, dmg: 3, sd: 14, scale: 3, kb: 0.05, boss: true },
};

// Survival's zombies (Apocalypse pack). `apoc` names the sheet family, drawn walking in four directions.
Object.assign(MONSTERS, {
  z_small: { name: 'Walker', apoc: 'small', kind: 'walk', hp: 3, speed: 34, dmg: 1, sd: 2 },
  z_axe: { name: 'Axe Zombie', apoc: 'axe', kind: 'walk', hp: 7, speed: 22, dmg: 2, sd: 5, kb: 0.6 },
  z_big: { name: 'Brute', apoc: 'big', kind: 'walk', hp: 26, speed: 15, dmg: 3, sd: 9, kb: 0.2 },
  z_boss: { name: 'The Colossus', apoc: 'big', kind: 'walk', hp: 190, speed: 13, dmg: 5, sd: 16, scale: 2, kb: 0.05, boss: true },
  // Survival's extra threats (same art as the walkers, tinted): a sprinter that is hard to hit, and a slow one that soaks up hits
  z_runner: { name: 'Runner', apoc: 'small', kind: 'walk', hp: 2, speed: 64, dmg: 1, sd: 2, tint: 'hue-rotate(150deg) saturate(2.2) brightness(1.1)' },
  z_armor: { name: 'Armored', apoc: 'axe', kind: 'walk', hp: 16, speed: 21, dmg: 3, sd: 6, kb: 0.25, tint: 'grayscale(0.9) brightness(0.85) contrast(1.4)' },
});

export const MONSTER_IDS = Object.keys(MONSTERS);
export const MONSTER_SPRITES = MONSTER_IDS.map((id) => MONSTERS[id].sprite).filter(Boolean);

export const TOTAL_WAVES = 10;

// [type, count] per wave, before the difficulty multiplier
export const WAVES = [
  [['bones', 6], ['redcap', 3]],
  [['bones', 6], ['stumbler', 4], ['jelly', 3]],
  [['hand', 6], ['cadaver', 4], ['redcap', 4], ['bat', 3]],
  [['hound', 5], ['stumbler', 5], ['archer', 3], ['bat', 4]],
  [['ghoul', 5], ['scarab', 6], ['crawler', 5], ['watcher', 3], ['ogre', 1]],
  [['hound', 6], ['grimlock', 6], ['archer', 4], ['ghastly', 3], ['slime', 4], ['stonetroll', 1]],
  [['revenant', 4], ['crimson', 4], ['myconid', 5], ['bat', 6], ['ogre', 2], ['shrieker', 3]],
  [['murky', 4], ['hound', 8], ['hand', 10], ['archer', 5], ['watcher', 4], ['swamptroll', 2]],
  [['ettin', 2], ['revenant', 6], ['crimson', 5], ['giantscarab', 1], ['ghastly', 5], ['stonetroll', 2], ['bat', 8]],
  [['cyclops', 1], ['ettin', 2], ['giantscarab', 2], ['murky', 6], ['revenant', 6], ['archer', 6], ['bat', 10], ['hound', 8], ['dcrawler', 8], ['feeder', 6], ['eye', 6]],
];

// Survival is meant to be a struggle: bigger waves, sprinters from wave 2, armoured ones from wave 5
export const WAVES_APOC = [
  [['z_small', 10]],
  [['z_small', 10], ['z_runner', 3], ['z_axe', 2]],
  [['z_small', 10], ['z_runner', 5], ['z_axe', 5]],
  [['z_small', 10], ['z_runner', 6], ['z_axe', 6], ['z_big', 2]],
  [['z_small', 12], ['z_runner', 8], ['z_axe', 6], ['z_armor', 3], ['z_big', 2]], // + Colossus bosses (see bossesFor)
  [['z_small', 12], ['z_runner', 10], ['z_axe', 8], ['z_armor', 4], ['z_big', 3]],
  [['z_small', 14], ['z_runner', 12], ['z_axe', 8], ['z_armor', 6], ['z_big', 4]],
  [['z_small', 14], ['z_runner', 14], ['z_axe', 10], ['z_armor', 8], ['z_big', 5]],
  [['z_small', 16], ['z_runner', 16], ['z_axe', 12], ['z_armor', 10], ['z_big', 7]],
  [['z_big', 8], ['z_armor', 10], ['z_axe', 14], ['z_runner', 16], ['z_small', 20]], // + Colossus bosses (see bossesFor)
];

// Survival's Colossus bosses come on wave 5 and wave 10, and how many depends on the difficulty
export const bossesFor = (wave, diff) => (wave === 5 ? diff.boss5 : wave === 10 ? diff.boss10 : 0) || 0;

export const DIFFICULTY = {
  easy: { name: 'Easy', blurb: 'Fewer, softer monsters and a sturdy base.', boss5: 1, boss10: 2, hp: 0.8, count: 0.7, dmg: 0.7, baseHp: 120, barricadeHp: 30, heal: 0.4 },
  medium: { name: 'Medium', blurb: 'A fair fight. Keep those barricades repaired.', boss5: 2, boss10: 4, hp: 1, count: 1, dmg: 1, baseHp: 90, barricadeHp: 24, heal: 0.28 },
  hard: { name: 'Hard', blurb: 'Packed waves and tougher hides. Good luck!', boss5: 4, boss10: 6, hp: 1.35, count: 1.45, dmg: 1.4, baseHp: 65, barricadeHp: 18, heal: 0.18 },
};

export const DIFFICULTY_IDS = Object.keys(DIFFICULTY);

// How many of each type a wave brings, as [[type, count], ...] (the same numbers waveList deals out)
export function waveCounts(wave, diff, theme = 'cozy') {
  const table = (theme === 'apoc' ? WAVES_APOC : WAVES)[wave - 1] || [];
  const out = table.map(([type, n]) => [type, Math.max(1, Math.round(n * diff.count))]);
  const bosses = theme === 'apoc' ? bossesFor(wave, diff) : 0;
  return bosses ? [['z_boss', bosses], ...out] : out;
}

export function waveList(wave, diff, theme = 'cozy') {
  const list = [];
  for (const [type, n] of (theme === 'apoc' ? WAVES_APOC : WAVES)[wave - 1]) {
    const count = Math.max(1, Math.round(n * diff.count)); // never fewer than one, so bosses always show up
    for (let i = 0; i < count; i++) list.push(type);
  }
  if (theme === 'apoc') for (let i = 0; i < bossesFor(wave, diff); i++) list.push('z_boss');
  // shuffle so the strong ones are mixed in with the weak
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// What a defeated monster leaves behind. 'heart' is a health pickup; the rest go into the backpack.
export function rollMonsterLoot(def, diff, theme = 'cozy') {
  const out = [];
  const big = !!def.scale;
  const roll = (id, chance, min = 1, max = 1) => {
    if (Math.random() < chance) out.push({ id, qty: min + Math.floor(Math.random() * (max - min + 1)) });
  };
  const scarce = theme === 'apoc' ? 0.4 : 1; // Survival hands out much less healing, and plenty of wall material instead
  const heal = theme === 'apoc' ? 'hppack' : 'heart'; // Survival: a Health Pack goes in your quick slot
  roll(heal, def.boss ? 1 : big ? Math.min(1, diff.heal * 2.2 * scarce) : diff.heal * scarce);
  if (def.boss) roll(heal, 1);
  // coins pay for upgrades and recruits
  roll('coin', def.boss ? 1 : big ? 1 : 0.6 * scarce, def.boss ? 8 : big ? 2 : 1, def.boss ? 12 : big ? (theme === 'apoc' ? 4 : 5) : 3);
  if (theme === 'apoc') {
    // scavenged supplies instead of trinkets
    roll('soupcan', big ? 0.5 : 0.1);
    roll('barricade', def.boss ? 1 : big ? 0.75 : 0.3, 1, def.boss ? 4 : big ? 2 : 1); // barricades drop far more often than Health Packs
    return out;
  }
  roll('rock', big ? 0.9 : 0.34, 1, big ? 3 : 2);
  roll('acorn', 0.16, 1, 2);
  roll('gold', big ? 0.5 : 0.07);
  roll('gem', def.boss ? 1 : big ? 0.25 : 0.03, 1, def.boss ? 3 : 1);
  roll('barricade', def.boss ? 1 : big ? 0.4 : 0.07, 1, def.boss ? 3 : 1);
  return out;
}

// Monster levels 1-10, shown as a coloured number: green for the common ones up to gold for a huge legendary.
export const MONSTER_RARITY = [
  null,
  { name: 'Common', color: '#5fd16a' },
  { name: 'Common', color: '#9bd94a' },
  { name: 'Uncommon', color: '#3fd0b4' },
  { name: 'Uncommon', color: '#3fa7e8' },
  { name: 'Rare', color: '#5f7df0' },
  { name: 'Rare', color: '#9b6cf0' },
  { name: 'Epic', color: '#d062e8' },
  { name: 'Epic', color: '#f0589a' },
  { name: 'Mythic', color: '#f2693a' },
  { name: 'Legendary', color: '#ffc928' },
];
export const lvHp = (lv) => 1 + 0.3 * (lv - 1); // level 10 has almost four times the health
export const lvDmg = (lv) => 1 + 0.12 * (lv - 1);
export const lvSpeed = (lv) => 1 + 0.015 * (lv - 1);
export const lvSize = (lv) => 1 + 0.08 * (lv - 1); // level 10 is huge
export const lvXp = (lv) => 1 + 0.25 * (lv - 1);

// What level a new monster of this wave (1-10) is: mostly low, with the high ones showing up later and rarely
export function rollMonsterLevel(wave) {
  const cap = Math.min(10, 1 + Math.ceil(wave * 0.9));
  const lv = 1 + Math.floor(Math.pow(Math.random(), 2.4) * cap);
  return Math.min(10, lv);
}
