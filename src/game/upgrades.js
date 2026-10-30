// Wave Defense and Survival: things you can buy with coins from monster drops (press U).

export const MAX_LEVEL = 5;

export const UPGRADES = [
  { id: 'house', icon: '🏠', name: 'Reinforce the base', desc: '+30% base health per level (arriving already repaired) and room for more helpers. Shared by everyone.', cost: [5, 8, 12, 17, 24] },
  { id: 'stamina', icon: '⚡', name: 'Endurance', desc: 'Sprinting and dashing cost less, and stamina refills faster.', cost: [4, 6, 9, 13, 18] },
  { id: 'melee', icon: '🗡️', name: 'Melee damage', desc: '+1 damage on every swing (and a little more on dashes).', cost: [5, 8, 12, 18, 26] },
  { id: 'throw', icon: '🎯', name: 'Throw damage', desc: '+1 damage on every throw.', cost: [4, 6, 9, 13, 18], survIcon: '🔫', survName: 'Gun damage', survDesc: '+1 damage on every bullet from your pistol.' },
  { id: 'light', icon: '🔦', name: 'Lantern', desc: 'A bigger, brighter glow around you, so the night is easier to see through.', cost: [3, 5, 8, 12, 16] },
];

export const emptyUpgrades = () => ({ armor: 0, chest: 0, atkspd: 0, house: 0, stamina: 0, melee: 0, throw: 0, light: 0, dash: 0, dashdmg: 0, spinrad: 0, spindmg: 0, rapid: 0, health: 0 });

export const upgradeCost = (id, level) => UPGRADES.find((u) => u.id === id).cost[level];

// ---------- Free Roam shop (press U): coins from chests and skeletons ----------

// Levelled upgrades. `per` is what each level adds, shown next to the current value in the shop.
// Free Roam fights are 6-heart duels, so these are gentler than the Wave Defense versions.
export const FREE_UPGRADES = [
  {
    id: 'health', icon: '❤️', name: 'Max health', cost: [6, 10, 15, 21, 28],
    desc: '+10 max HP per level, and the extra health arrives full.',
    value: (l) => `+${10 * l}% max HP`,
  },
  {
    id: 'stamina', icon: '⚡', name: 'Endurance', cost: [4, 6, 9, 13, 18],
    desc: 'A bigger stamina pool: sprinting and dashing take a smaller bite, and it refills faster.',
    value: (l) => `+${20 * l}% stamina`,
  },
  {
    id: 'melee', icon: '🗡️', name: 'Melee damage', cost: [4, 7, 11, 16, 22],
    desc: 'Sword swings hit harder. Fully upgraded, two swings drop a rival.',
    value: (l) => `+${20 * l}% sword damage`,
  },
  {
    id: 'armor', icon: '🦺', name: 'Armor', cost: [5, 9, 14, 20, 28],
    desc: 'Tougher skin: every hit you take is softened. (Real armor pieces to wear are coming later.)',
    value: (l) => `${l * 6}% less damage taken`,
  },
  {
    // sold from the storage chest at home, not from the shop
    id: 'chest', icon: '📦', name: 'Chest space', cost: [4, 7, 11, 16, 22], home: true,
    desc: 'Room for 9 more stacks in the storage chest at home.',
    value: (l) => `+${Math.round((900 * l) / 27)}% chest space (${27 + 9 * l} slots)`,
  },
  {
    id: 'atkspd', icon: '⚔️', name: 'Attack speed', cost: [5, 8, 12, 17, 24],
    desc: 'Swing your sword more often. Works with whichever sword you carry.',
    value: (l) => `${l * 9}% faster swings`,
  },
  {
    id: 'dash', icon: '💨', name: 'Dash distance', cost: [3, 6, 9, 13, 18], needs: 'dash',
    desc: 'Your dash carries you further.',
    value: (l) => `+${18 * l}% dash distance`,
  },
  {
    id: 'dashdmg', icon: '⚡', name: 'Dash damage', cost: [4, 7, 11, 16, 22], needs: 'dash',
    desc: 'Everything you barrel through takes more.',
    value: (l) => `+${Math.round(8.75 * l)}% dash damage`,
  },
  {
    id: 'spinrad', icon: '🌀', name: 'Spiral radius', cost: [3, 6, 9, 13, 18], needs: 'spiral',
    desc: 'The spiral sweeps a wider circle around you.',
    value: (l) => `+${Math.round(18.4 * l)}% spiral radius`,
  },
  {
    id: 'spindmg', icon: '🗡️', name: 'Spiral damage', cost: [4, 7, 11, 16, 22], needs: 'spiral',
    desc: 'Every blade of the spiral cuts deeper.',
    value: (l) => `+${10 * l}% spiral damage`,
  },
  {
    id: 'throw', icon: '💥', name: 'Throw damage', cost: [4, 6, 9, 13, 18],
    desc: 'Every thrown item hits a little harder.',
    value: (l) => `+${15 * l}% throw damage`,
  },
];

export const SUPPLY_CAP = 99;
export const SHIELD_CAP = 3;

// One-off purchases that stock the quick slots at the bottom of the screen
export const SUPPLY_SHOP = [
  { id: 'hp', item: 'hppack', name: 'HP Pack', desc: 'Restores 90% of your health.', cost: 5, cap: SUPPLY_CAP },
  { id: 'stam', item: 'soupcan', name: 'Soup Can', desc: 'Restores 60% of your stamina.', cost: 3, cap: SUPPLY_CAP },
];

// Skills are not sold: you unlock each one by reaching its character level, then pick what to equip.
// You use ONE from each group:
//   sword   - Dash or Spiral Sword (the Space skill)
//   utility - Shield or Invisibility
export const SKILL_SHOP = [
  { id: 'dash', icon: '💨', name: 'Dash', group: 'sword', level: 6, sword: true, desc: 'Press Space (hold it to charge) to dash through enemies. Upgrade distance and damage in the shop.' },
  { id: 'spiral', icon: '🌀', name: 'Spiral Sword', group: 'sword', level: 8, sword: true, desc: 'Press Space (hold it to charge) to spin your blade around you. Upgrade radius and damage in the shop.' },
  { id: 'shield', icon: '🛡️', name: 'Shield', group: 'utility', level: 10, desc: 'Press R: blocks all damage for 3 seconds. 10 second cooldown.' },
  { id: 'invis', icon: '👻', name: 'Invisibility', group: 'utility', level: 15, desc: 'Press R: enemies can no longer see you for 4 seconds (attacking reveals you). 25 second cooldown.' },
];

// Wood for crafting weapons: [how much, price]
export const WOOD_SHOP = [
  { qty: 5, cost: 10 },
  { qty: 20, cost: 36 },
  { qty: 50, cost: 80 },
];

// Throwables: [item, how many in a bundle, price]. Damage comes from the item itself.
export const THROW_SHOP = [
  { item: 'acorn', qty: 5, cost: 2 },
  { item: 'rock', qty: 3, cost: 5 },
  { item: 'mug', qty: 2, cost: 5 },
  { item: 'gold', qty: 2, cost: 7 },
  { item: 'gem', qty: 1, cost: 6 },
  { item: 'truffle', qty: 2, cost: 8 },
  { item: 'stungrenade', qty: 2, cost: 9 },
  { item: 'smokegrenade', qty: 2, cost: 7 },
];
