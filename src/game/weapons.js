import { rarityByCost } from './items';

// Free Roam swords. Icons are cut from "32 Free Weapon Icons" (public/assets/weapons/wNN.png) and every swing leaves one
// of three slash animations from the "64x64" pack (public/assets/slash/sXcY.png: 9 frames, 5 per row).
// Survival keeps its baseball bat, so none of this applies there.

export const SLASH_TYPES = 3; // the three different slashes
export const SLASH_COLORS = 3;
export const SLASH_FRAMES = 9;
export const SLASH_COLS = 5;

export const EFFECTS = {
  none: { name: 'Plain steel', desc: 'No tricks, just a reliable blade.' },
  crit: { name: 'Lucky strike', desc: 'One hit in four lands for double damage.' },
  burn: { name: 'Burning', desc: 'Sets targets alight: extra damage over the next couple of seconds.' },
  shock: { name: 'Chain lightning', desc: 'Every hit arcs on to a second target nearby.' },
  vamp: { name: 'Vampiric', desc: 'Heals you a little with every hit.' },
  cleave: { name: 'Cleave', desc: 'A much wider sweep that hits everything in front of you.' },
  knock: { name: 'Heavy blow', desc: 'Sends targets flying back.' },
  bash: { name: 'Bashing', desc: 'About one hit in three bashes the target: a hard knock-back and a short stun.' },
  bleed: { name: 'Bleed', desc: 'Opens a wound that keeps bleeding: extra damage over the next couple of seconds.' },
  // staffs: left click fires a bolt, hold left click and let go to drop a spell where the cursor is
  frost: { name: 'Frostbite', desc: 'Bolts freeze what they hit: stunned for a moment, then slowed. Hold left click and release to freeze the ground at your cursor.' },
  fire: { name: 'Fireball', desc: 'Bolts burn and burst in a small blast. Hold left click and release to call a column of fire.' },
  storm: { name: 'Lightning', desc: 'Bolts arc on to a second target. Hold left click and release to call down a lightning strike.' },
  venom: { name: 'Venom', desc: 'Bolts poison, which hurts over time. Hold left click and release to burst a toxic cloud.' },
  arcane: { name: 'Arcane pierce', desc: 'Bolts fly through up to three targets. Hold left click and release for an arcane burst.' },
  // slingshots: left click bashes, hold right click and let go to fire (the longer you hold, the farther the stone flies)
  stone: { name: 'Endless stones', desc: 'Tap left click to bash. Hold left click and release to fire: hold longer to shoot farther. Never runs out of ammo.' },
  scatter: { name: 'Scatter shot', desc: 'Hold left click and release to fire a fan of five stones like a shotgun (hold longer for more reach). Brutal up close. A tap bashes.' },
  pierce: { name: 'Piercing stone', desc: 'Hold left click and release to fire a stone that punches through up to four enemies (hold longer for more reach). A tap bashes.' },
  rapid: { name: 'Quick draw', desc: 'Hold left click and release to fire fast, small stones (hold longer for more reach). A tap bashes.' },
  // tridents
  skewer: { name: 'Skewer', desc: 'Tap left click to slash. Hold left click and let go to hurl it: the longer you hold, the farther it flies. It always comes back.' },
  tide: { name: 'Tidecaller', desc: 'Tap to slash, or hold left click to hurl it far. It slows whatever it hits and returns quickly.' },
};

// what the weapon does with a left click
export const KINDS = { sword: 'Sword', staff: 'Staff', sling: 'Slingshot', trident: 'Trident' };

// cost: coins   wood: logs to craft it (chop trees)   dmg: extra damage per swing   reach: px   cd: seconds between swings   slash/color: which flash it leaves
// kind: sword (default), staff (spell: the effect strip it uses), sling (shots: how many stones, spread, pierce) or trident (a tap slashes, a held left click throws).
// Right click always throws what is selected in the backpack.
export const WEAPONS = [
  { id: 'trusty', name: 'Trusty Sword', icon: 1, cost: 0, wood: 0, dmg: 0, reach: 32, cd: 0.42, slash: 1, color: 'g', effect: 'none', tint: '#aeb2bd', blurb: 'The one you started with.' },
  { id: 'rapier', name: 'Fine Rapier', icon: 3, cost: 14, wood: 2, dmg: 0.3, reach: 36, cd: 0.32, slash: 3, color: 1, effect: 'crit', tint: '#d8ff63', blurb: 'Light, quick and a little bit lucky.' },
  { id: 'cleaver', name: 'Bone Sword', icon: 15, cost: 20, wood: 3, dmg: 0.6, reach: 34, cd: 0.46, slash: 2, color: 1, effect: 'bash', tint: '#e8f3a0', blurb: 'Heavy bone, and now and then it bashes.' },
  { id: 'ember', name: 'Ember Blade', icon: 10, cost: 24, wood: 4, dmg: 0.7, reach: 33, cd: 0.42, slash: 1, color: 2, effect: 'burn', tint: '#ff6a3c', blurb: 'Still warm from the forge.' },
  { id: 'storm', name: 'Stormedge', icon: 12, cost: 30, wood: 5, dmg: 0.8, reach: 34, cd: 0.4, slash: 3, color: 3, effect: 'shock', tint: '#79c8ff', blurb: 'Crackles when it connects.' },
  { id: 'maul', name: 'Heavy Scimitar', icon: 29, cost: 32, wood: 6, dmg: 1.3, reach: 35, cd: 0.62, slash: 2, color: 3, effect: 'bleed', tint: '#c9b99b', blurb: 'Slow, it really does hurt, and the cut keeps bleeding.' },
  { id: 'blood', name: 'Bloodthirster', icon: 17, cost: 42, wood: 7, dmg: 1.2, reach: 34, cd: 0.44, slash: 2, color: 2, effect: 'vamp', tint: '#ff4a5e', blurb: 'It drinks what it cuts.' },
  { id: 'sun', name: 'Sunforged Blade', icon: 40, cost: 58, wood: 10, dmg: 1.9, reach: 38, cd: 0.38, slash: 1, color: 3, effect: 'burn', tint: '#ffd24a', blurb: 'Legend says it never goes dull.' },

  // staffs (art: the V2 weapon icons)
  { id: 's_frost', kind: 'staff', name: 'Frost Staff', file: 'x_69', cost: 28, wood: 4, dmg: 0, reach: 150, cd: 0.7, effect: 'frost', spell: { fx: 'wizard1', hue: 0, color: '#8fd6ff' }, tint: '#8fd6ff', blurb: 'Cold bolts that freeze whatever they hit.' },
  { id: 's_ember', kind: 'staff', name: 'Ember Staff', file: 'x_77', cost: 34, wood: 5, dmg: 0.3, reach: 150, cd: 0.8, effect: 'fire', spell: { fx: 'wizard2', hue: 0, color: '#ff8a3c' }, tint: '#ff8a3c', blurb: 'Fireballs that burn and burst.' },
  { id: 's_storm', kind: 'staff', name: 'Storm Rod', file: 'x_81', cost: 40, wood: 6, dmg: 0.2, reach: 160, cd: 0.7, effect: 'storm', spell: { fx: 'priest_attack', hue: 0, color: '#9fd8ff' }, tint: '#9fd8ff', blurb: 'Lightning that jumps from foe to foe.' },
  { id: 's_venom', kind: 'staff', name: 'Venom Staff', file: 'x_83', cost: 38, wood: 5, dmg: 0, reach: 140, cd: 0.65, effect: 'venom', spell: { fx: 'necro_attack', hue: 0, color: '#8fe05a' }, tint: '#8fe05a', blurb: 'Spits poison that keeps on hurting.' },
  { id: 's_moon', kind: 'staff', name: 'Moon Staff', file: 'x_87', cost: 52, wood: 8, dmg: 0.5, reach: 170, cd: 0.75, effect: 'arcane', spell: { fx: 'wizard1', hue: 250, color: '#b78cff' }, tint: '#b78cff', blurb: 'Bolts of moonlight that pierce through a crowd.' },
  // slingshots: infinite stones
  { id: 'sl_wood', kind: 'sling', melee: 28, slash: 1, color: 1, name: 'Wooden Slingshot', file: 'x_141', cost: 16, wood: 2, dmg: 0, reach: 130, cd: 0.45, effect: 'stone', shots: { n: 1, spread: 0, pierce: 0, speed: 230, mul: 0.7 }, tint: '#c98a54', blurb: 'A forked branch and an endless pile of pebbles.' },
  { id: 'sl_scatter', kind: 'sling', melee: 28, slash: 1, color: 1, name: 'Scatter Sling', file: 'x_142', cost: 30, wood: 4, dmg: 0, reach: 90, cd: 0.8, effect: 'scatter', shots: { n: 5, spread: 0.5, pierce: 0, speed: 220, mul: 0.5 }, tint: '#cfc7b6', blurb: 'Five stones in a fan: a shotgun made of leather.' },
  { id: 'sl_pierce', kind: 'sling', melee: 28, slash: 1, color: 1, name: 'Piercing Sling', file: 'x_143', cost: 36, wood: 5, dmg: 0.2, reach: 150, cd: 0.65, effect: 'pierce', shots: { n: 1, spread: 0, pierce: 4, speed: 280, mul: 0.7 }, tint: '#a37cff', blurb: 'Hard, fast stones that go straight through.' },
  { id: 'sl_hunter', kind: 'sling', melee: 28, slash: 1, color: 1, name: "Hunter's Sling", file: 'x_147', cost: 24, wood: 3, dmg: 0, reach: 120, cd: 0.28, effect: 'rapid', shots: { n: 1, spread: 0.06, pierce: 0, speed: 250, mul: 0.45 }, tint: '#5fd08a', blurb: 'Light, quick and good at keeping them busy.' },
  // tridents: slash with left click, hurl with right click
  { id: 'tr_iron', kind: 'trident', name: 'Iron Trident', file: 'x_121', cost: 26, wood: 4, dmg: 0.4, reach: 38, cd: 0.5, slash: 2, color: 1, effect: 'skewer', throw: { min: 50, max: 170, speed: 260 }, tint: '#d49a5a', blurb: 'Three prongs on a long wooden shaft.' },
  { id: 'tr_silver', kind: 'trident', name: 'Silver Trident', file: 'x_117', cost: 44, wood: 6, dmg: 0.9, reach: 40, cd: 0.46, slash: 3, color: 2, effect: 'skewer', throw: { min: 55, max: 200, speed: 290 }, tint: '#cfe3ec', blurb: 'Light as a feather and just as quick.' },
  { id: 'tr_tide', kind: 'trident', name: 'Tide Trident', file: 'x_125', cost: 60, wood: 8, dmg: 1.4, reach: 42, cd: 0.44, slash: 3, color: 3, effect: 'tide', throw: { min: 60, max: 230, speed: 320 }, tint: '#4fa8ff', blurb: 'It remembers the sea, and brings it back to you.' },
];

export const weaponRarity = (w) => rarityByCost(w.cost);

export const weaponById = (id) => WEAPONS.find((w) => w.id === id) || WEAPONS[0];

export const emptyWeapons = () => ({ owned: { trusty: true }, equipped: 'trusty' });

// keep only swords that exist, always owning the starter
export function sanitizeWeapons(saved) {
  const out = emptyWeapons();
  if (saved?.owned) for (const w of WEAPONS) if (saved.owned[w.id]) out.owned[w.id] = true;
  if (saved?.equipped && out.owned[saved.equipped]) out.equipped = saved.equipped;
  return out;
}

export const weaponIconFile = (w) => (w.file ? `weapons/${w.file}` : `weapons/w${String(w.icon).padStart(2, '0')}`);

// Attack speed upgrade: each level trims this much off the time between swings
export const ATK_PER_LEVEL = 0.09;
export const swingTime = (w, level) => w.cd * (1 - ATK_PER_LEVEL * level);
