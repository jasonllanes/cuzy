// Wave Defense and Survival: things you can buy with coins from monster drops (press U).

export const MAX_LEVEL = 5;

export const UPGRADES = [
  { id: 'house', icon: '🏠', name: 'Reinforce the base', desc: '+30% base health per level (arriving already repaired) and room for more helpers. Shared by everyone.', cost: [5, 8, 12, 17, 24] },
  { id: 'stamina', icon: '⚡', name: 'Endurance', desc: 'Sprinting and dashing cost less, and stamina refills faster.', cost: [4, 6, 9, 13, 18] },
  { id: 'melee', icon: '🗡️', name: 'Melee damage', desc: '+1 damage on every swing (and a little more on dashes).', cost: [5, 8, 12, 18, 26] },
  { id: 'throw', icon: '🎯', name: 'Throw damage', desc: '+1 damage on every throw.', cost: [4, 6, 9, 13, 18], survIcon: '🔫', survName: 'Gun damage', survDesc: '+1 damage on every bullet from your pistol.' },
  { id: 'light', icon: '🔦', name: 'Lantern', desc: 'A bigger, brighter glow around you, so the night is easier to see through.', cost: [3, 5, 8, 12, 16] },
];

export const emptyUpgrades = () => ({ chest: 0, atkspd: 0, house: 0, stamina: 0, melee: 0, throw: 0, light: 0, dash: 0, dashdmg: 0, spinrad: 0, spindmg: 0, rapid: 0, health: 0 });

export const upgradeCost = (id, level) => UPGRADES.find((u) => u.id === id).cost[level];

// ---------- Free Roam shop (press U): coins from chests and skeletons ----------

// Levelled upgrades. `per` is what each level adds, shown next to the current value in the shop.
// Free Roam fights are 6-heart duels, so these are gentler than the Wave Defense versions.
export const FREE_UPGRADES = [
  {
    id: 'health', icon: '❤️', name: 'Max health', cost: [6, 10, 15, 21, 28],
    desc: '+10 max HP per level, and the extra health arrives full.',
    value: (l) => `${100 + 10 * l} max HP`,
  },
  {
    id: 'stamina', icon: '⚡', name: 'Endurance', cost: [4, 6, 9, 13, 18],
    desc: 'A bigger stamina pool: sprinting and dashing take a smaller bite, and it refills faster.',
    value: (l) => `${100 + 20 * l} total stamina`,
  },
  {
    id: 'melee', icon: '🗡️', name: 'Melee damage', cost: [4, 7, 11, 16, 22],
    desc: 'Sword swings hit harder. Fully upgraded, two swings drop a rival.',
    value: (l) => `${(2 + 0.4 * l).toFixed(1)} damage per swing`,
  },
  {
    id: 'chest', icon: '📦', name: 'Chest space', cost: [4, 7, 11, 16, 22],
    desc: 'Room for 9 more stacks in the storage chest at home.',
    value: (l) => `${27 + 9 * l} chest slots`,
  },
  {
    id: 'atkspd', icon: '⚔️', name: 'Attack speed', cost: [5, 8, 12, 17, 24],
    desc: 'Swing your sword more often. Works with whichever sword you carry.',
    value: (l) => `${Math.round(l * 9)}% less time between swings`,
  },
  {
    id: 'dash', icon: '💨', name: 'Dash distance', cost: [3, 6, 9, 13, 18], needs: 'dash',
    desc: 'Your dash carries you further.',
    value: (l) => `${(4 * (1 + 0.18 * l)).toFixed(1)} tiles at full charge`,
  },
  {
    id: 'dashdmg', icon: '⚡', name: 'Dash damage', cost: [4, 7, 11, 16, 22], needs: 'dash',
    desc: 'Everything you barrel through takes more.',
    value: (l) => `${(4 + 0.35 * l).toFixed(1)} damage at full charge`,
  },
  {
    id: 'spinrad', icon: '🌀', name: 'Spiral radius', cost: [3, 6, 9, 13, 18], needs: 'spiral',
    desc: 'The spiral sweeps a wider circle around you.',
    value: (l) => `${((38 + 7 * l) / 16).toFixed(1)} tiles around you`,
  },
  {
    id: 'spindmg', icon: '🗡️', name: 'Spiral damage', cost: [4, 7, 11, 16, 22], needs: 'spiral',
    desc: 'Every blade of the spiral cuts deeper.',
    value: (l) => `${(3 + 0.3 * l).toFixed(1)} damage at full charge`,
  },
  {
    id: 'throw', icon: '💥', name: 'Throw damage', cost: [4, 6, 9, 13, 18],
    desc: 'Every thrown item hits a little harder.',
    value: (l) => `+${(l * 0.3).toFixed(1)} damage on every throw`,
  },
  {
    id: 'rapid', icon: '🎯', name: 'Successive throw', cost: [3, 5, 8, 12, 17],
    desc: 'Less wait between back-to-back throws, so holding right click keeps them coming.',
    value: (l) => `${(1 - 0.12 * l).toFixed(2)}s between throws`,
  },
];

export const SUPPLY_CAP = 9;
export const SHIELD_CAP = 3;

// One-off purchases that stock the quick slots at the bottom of the screen
export const SUPPLY_SHOP = [
  { id: 'hp', item: 'hppack', name: 'HP Pack', desc: 'Restores 50 HP. Press Z.', cost: 5, cap: SUPPLY_CAP },
  { id: 'stam', item: 'soupcan', name: 'Soup Can', desc: 'Restores 60% stamina. Press X.', cost: 3, cap: SUPPLY_CAP },
];

// Skills: bought once, then used with a cooldown. You pick ONE from each group:
//   sword   - Dash or Spiral Sword (the hold-left-click skill)
//   utility - Shield or Invisibility
export const SKILL_SHOP = [
  { id: 'shield', icon: '🛡️', name: 'Shield', group: 'utility', cost: 12, desc: 'Press F: blocks all damage for 3 seconds. 10 second cooldown.' },
  { id: 'invis', icon: '👻', name: 'Invisibility', group: 'utility', cost: 16, desc: 'Press C: enemies can no longer see you for 4 seconds (attacking reveals you). 25 second cooldown.' },
  { id: 'dash', icon: '💨', name: 'Dash', group: 'sword', cost: 8, sword: true, desc: 'Hold left click, release to dash through enemies. Upgrade distance and damage.' },
  { id: 'spiral', icon: '🌀', name: 'Spiral Sword', group: 'sword', cost: 14, sword: true, desc: 'Hold left click, release to spin your blade around you. Upgrade radius and damage.' },
];

// Throwables: [item, how many in a bundle, price]. Damage comes from the item itself.
export const THROW_SHOP = [
  { item: 'acorn', qty: 5, cost: 2 },
  { item: 'rock', qty: 3, cost: 5 },
  { item: 'mug', qty: 2, cost: 5 },
  { item: 'gold', qty: 2, cost: 7 },
  { item: 'gem', qty: 1, cost: 6 },
];
