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
};

// dmg: extra damage per swing   reach: px   cd: seconds between swings   slash/color: which flash it leaves
export const WEAPONS = [
  { id: 'trusty', name: 'Trusty Sword', icon: 1, cost: 0, dmg: 0, reach: 32, cd: 0.42, slash: 1, color: 'g', effect: 'none', tint: '#aeb2bd', blurb: 'The one you started with.' },
  { id: 'rapier', name: 'Fine Rapier', icon: 3, cost: 14, dmg: 0.3, reach: 36, cd: 0.32, slash: 3, color: 1, effect: 'crit', tint: '#d8ff63', blurb: 'Light, quick and a little bit lucky.' },
  { id: 'cleaver', name: 'Bone Cleaver', icon: 15, cost: 20, dmg: 0.6, reach: 34, cd: 0.46, slash: 2, color: 1, effect: 'cleave', tint: '#e8f3a0', blurb: 'Swings in a great big circle.' },
  { id: 'ember', name: 'Ember Blade', icon: 10, cost: 24, dmg: 0.7, reach: 33, cd: 0.42, slash: 1, color: 2, effect: 'burn', tint: '#ff6a3c', blurb: 'Still warm from the forge.' },
  { id: 'storm', name: 'Stormedge', icon: 12, cost: 30, dmg: 0.8, reach: 34, cd: 0.4, slash: 3, color: 3, effect: 'shock', tint: '#79c8ff', blurb: 'Crackles when it connects.' },
  { id: 'maul', name: 'Heavy Scimitar', icon: 29, cost: 32, dmg: 1.3, reach: 35, cd: 0.62, slash: 2, color: 3, effect: 'knock', tint: '#c9b99b', blurb: 'Slow, and it really does hurt.' },
  { id: 'blood', name: 'Bloodthirster', icon: 17, cost: 42, dmg: 1.2, reach: 34, cd: 0.44, slash: 2, color: 2, effect: 'vamp', tint: '#ff4a5e', blurb: 'It drinks what it cuts.' },
  { id: 'sun', name: 'Sunforged Blade', icon: 40, cost: 58, dmg: 1.9, reach: 38, cd: 0.38, slash: 1, color: 3, effect: 'burn', tint: '#ffd24a', blurb: 'Legend says it never goes dull.' },
];

export const weaponById = (id) => WEAPONS.find((w) => w.id === id) || WEAPONS[0];

export const emptyWeapons = () => ({ owned: { trusty: true }, equipped: 'trusty' });

// keep only swords that exist, always owning the starter
export function sanitizeWeapons(saved) {
  const out = emptyWeapons();
  if (saved?.owned) for (const w of WEAPONS) if (saved.owned[w.id]) out.owned[w.id] = true;
  if (saved?.equipped && out.owned[saved.equipped]) out.equipped = saved.equipped;
  return out;
}

export const weaponIconFile = (w) => `weapons/w${String(w.icon).padStart(2, '0')}`;

// Attack speed upgrade: each level trims this much off the time between swings
export const ATK_PER_LEVEL = 0.09;
export const swingTime = (w, level) => w.cd * (1 - ATK_PER_LEVEL * level);
