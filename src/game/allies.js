// Helpers you can hire in Wave Defense and Survival from the upgrades window (U or Tab) with enough coins.
// They live at the base and cannot be hurt, so they are a bonus rather than another thing to protect.

export const MAX_ALLIES = 8;

// How many helpers the base has room for, by base (house / bus) level: upgrading it makes space for more
const TEAM_CAPS = [2, 3, 4, 5, 6, 8];
export const teamCap = (level = 0) => TEAM_CAPS[Math.min(level, TEAM_CAPS.length - 1)];

export const ALLIES = {
  thrower: { name: 'Thrower', cost: 6, hero: 'alex', color: '#7cc5f2', pips: 1, ai: 'ranged', range: 100, rate: 1.1, dmg: 1, blurb: 'Lobs stones at anything that gets close.' },
  guard: { name: 'Guard', cost: 9, hero: 'adam', color: '#f2b05e', pips: 2, ai: 'melee', range: 120, rate: 0.9, dmg: 2, speed: 55, blurb: 'Runs down nearby enemies on the ground and slashes them.' },
  sniper: { name: 'Sharpshooter', cost: 14, hero: 'bob', color: '#e8506a', pips: 3, ai: 'ranged', range: 160, rate: 1.9, dmg: 3, blurb: 'Slow, steady shots from a long way off.' },
};

export const ALLY_KINDS = Object.keys(ALLIES);
