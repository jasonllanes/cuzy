// Health and character level.
//
// Health is shown out of 100 for a new hero. Inside the game it is still counted in "hearts" (a hero starts with 6),
// so one heart is 100/6 HP. Upgrades and levels add HP, and everything is worked out from the 100 base.

export const BASE_HP = 100;
export const HP_PER_HEART = BASE_HP / 6;
export const HP_PER_UPGRADE = 10; // each level of the Max health upgrade
export const HP_PER_LEVEL = 5; // each character level after the first
export const MAX_CHAR_LEVEL = 25;
export const DMG_PER_LEVEL = 0.02; // each character level after the first adds a little to every blow and throw

// hearts -> the number you see
export const hp100 = (hearts) => Math.round(hearts * HP_PER_HEART);

// max health, in hearts
export const maxHearts = (healthUpgrade, level) => (BASE_HP + HP_PER_UPGRADE * healthUpgrade + HP_PER_LEVEL * (level - 1)) / HP_PER_HEART;

// XP needed to get from this level to the next
export const xpNeed = (level) => Math.round(40 + 25 * (level - 1) + 5 * (level - 1) ** 2);

// how much XP things are worth
export const XP = { skeleton: 12, wave: 8, player: 45, bot: 35 };
export const monsterXp = (hp, boss = false) => Math.round(6 + hp * 2) * (boss ? 3 : 1);
