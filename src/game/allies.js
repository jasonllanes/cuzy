// Helpers you can hire in Wave Defense and Survival from the upgrades window (U or Tab) with enough coins.
// They live at the base and cannot be hurt, so they are a bonus rather than another thing to protect.
// ai: 'ranged' stands (on top of the shelter in Survival) and shoots with the gun it carries, 'melee' runs enemies down below.
// gun: which of the player's guns it holds (its picture and its sound); the shot stats are here, not in combat.js.
// The multiplayer snapshot sends a helper as its place in this list.

export const MAX_ALLIES = 8;

// How many helpers the base has room for, by base (house / bus) level: upgrading it makes space for more
const TEAM_CAPS = [2, 3, 4, 5, 6, 8];
export const teamCap = (level = 0) => TEAM_CAPS[Math.min(level, TEAM_CAPS.length - 1)];

export const ALLIES = {
  pistol: { name: 'Pistol Survivor', cost: 6, hero: 'alex', color: '#7cc5f2', pips: 1, ai: 'ranged', gun: 'pistol', range: 110, rate: 0.8, dmg: 1, shotSpeed: 190, blurb: 'Stands on the roof with a pistol and picks off anything that gets close.' },
  guard: { name: 'Guard', cost: 9, hero: 'adam', color: '#f2b05e', pips: 2, ai: 'melee', range: 120, rate: 0.9, dmg: 2, speed: 55, blurb: 'Stays below on the ground, runs down nearby enemies and cuts them with a grey slash.' },
  rifle: { name: 'Rifle Survivor', cost: 14, hero: 'bob', color: '#e8506a', pips: 2, ai: 'ranged', gun: 'rifle', range: 150, rate: 0.55, dmg: 1.2, shotSpeed: 240, blurb: 'A rifle on the roof: quick, accurate shots from a good way off.' },
  plasma: { name: 'Plasma Survivor', cost: 24, hero: 'amelia', color: '#4aa8ff', pips: 3, ai: 'ranged', gun: 'plasma', range: 140, rate: 1.0, dmg: 3.5, shotSpeed: 160, pierce: 1, pad: 'rifle', blurb: 'A plasma gun on the roof. Slow glowing bolts that burn through two enemies in a line.' },
  // lob: it throws grenades instead of shooting: a slow arc, then a blast that hits everything inside its circle (R, px)
  grenadier: { name: 'Grenadier', cost: 18, hero: 'alex', color: '#ff9a3c', pips: 3, ai: 'ranged', lob: true, icon: '💣', range: 150, rate: 2.6, dmg: 4, R: 30, pad: 'rifle', blurb: 'Watches from the roof and lobs grenades into the crowd. The blast hits every zombie in its circle.' },
};

export const ALLY_KINDS = Object.keys(ALLIES);
