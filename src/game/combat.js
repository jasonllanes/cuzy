import { CHUNK_PX, WATER } from './world';
import { sfx } from './sfx';
import { BOSS_WIND, POWER_SLOW_TIME } from './waves';
import { ITEMS, RARITIES, breaksOnImpact, iconOf, rarityOf, throwDamage, throwStats } from './items';
import { drawHero } from './heroes';
import { addItem, removeFromSlot } from './inventory';
import { MONSTERS, lvDmg, lvHp, lvXp, rollMonsterLevel } from './monsters';
import { TINY } from './tiny';
import { SUPPLY_CAP } from './upgrades';
import { swingTime, weaponById, weaponIconFile } from './weapons';
import { DMG_PER_LEVEL, HP_PER_HEART, HP_PER_UPGRADE, hp100, maxHearts, monsterXp, XP } from './stats';

// Skeleton camps: three guards that chase you, but give up beyond LEASH and walk home to heal
const CAMP_WAKE = 300; // the camp stirs when you come this close
const CAMP_LEASH = 200; // how far from their post the guards will follow
const CAMP_RESPAWN = 150; // seconds before a wiped-out camp is guarded again

// Wild creatures from the ENEMY pack that roam the free world: ground things by day, flyers and hounds by night
// Every region has its own people: what walks it by day and by night, its night boss and its mini boss.
const BIOME_FOES = {
  clover: { day: ['t_slime', 't_slime', 't_orc', 't_swordsman', 'jelly', 'redcap'], night: ['t_orc', 't_skeleton', 't_archer', 'bat', 'hound', 'z_small'], boss: ['t_eliteorc', 't_templar'], mini: ['t_axeman', 't_knight', 't_swordsman'] },
  tidal: { day: ['t_slime', 't_soldier', 't_soldier', 't_swordsman', 'jelly'], night: ['t_skarcher', 't_skeleton', 't_bat', 'bat', 'watcher'], boss: ['t_orcrider', 't_eliteorc'], mini: ['t_armskel', 't_lancer', 't_orcrider'] },
  emerald: { day: ['t_werewolf', 't_archer', 't_orc', 't_slime', 'redcap'], night: ['t_werewolf', 't_werebear', 't_bat', 'hound'], boss: ['t_werebear'], mini: ['t_werewolf', 't_werebear', 't_archer'] },
  crystal: { day: ['t_wizard', 't_priest', 't_slime', 't_slime', 'jelly'], night: ['t_wizard', 't_necro', 't_bat', 'eye', 'ghastly'], boss: ['t_necro', 't_wizard'], mini: ['t_wizard', 't_priest', 't_necro'] },
  marsh: { day: ['t_slime', 't_slime', 't_skeleton', 'shrieker', 'jelly'], night: ['t_necro', 't_skeleton', 't_skarcher', 'ghoul', 't_bat'], boss: ['t_necro', 't_gskel'], mini: ['t_gskel', 't_necro', 't_armskel'] },
  lava: { day: ['t_orc', 't_armorc', 't_eliteorc', 'hound', 'scarab'], night: ['t_armorc', 't_eliteorc', 't_werebear', 'hound', 'scarab'], boss: ['t_eliteorc'], mini: ['t_armorc', 't_eliteorc', 't_werebear'] },
  beach: { day: ['t_soldier', 't_soldier', 't_lancer', 't_swordsman', 'scarab'], night: ['t_lancer', 't_skarcher', 't_bat', 'ghoul'], boss: ['t_orcrider', 't_gskel'], mini: ['t_lancer', 't_soldier', 't_orcrider'] },
  asphalt: { day: ['z_small', 'z_small', 't_skeleton', 'z_axe', 'hand'], night: ['t_armskel', 't_gskel', 'z_runner', 'z_armor', 'z_axe', 'bat'], boss: ['t_gskel'], mini: ['t_armskel', 't_gskel', 't_axeman'] },
  mountain: { day: ['t_werewolf', 't_knight', 't_lancer', 't_orc', 'redcap'], night: ['t_werebear', 't_orcrider', 't_knight', 't_bat', 'hound'], boss: ['t_werebear', 't_orcrider'], mini: ['t_orcrider', 't_werewolf', 't_knight'] },
  wood: { day: ['t_knight', 't_templar', 't_axeman', 't_priest', 't_swordsman'], night: ['t_templar', 't_necro', 't_skeleton', 't_skarcher', 't_bat'], boss: ['t_templar'], mini: ['t_knight', 't_templar', 't_axeman'] },
};
// the region a spot belongs to (the open world is a patchwork of all of them)
export const biomeOf = (world, x, y) => (world.mixed ? world.biomeAt(Math.floor(x / 16), Math.floor(y / 16)) : world.tileset) || 'clover';
const foesAt = (world, x, y) => BIOME_FOES[biomeOf(world, x, y)] || BIOME_FOES.clover;
const pickOf = (a) => a[Math.floor(Math.random() * a.length)];
const MINION = 't_skeleton';
// some flyers that spit from a distance, besides the shooters in MONSTERS
const RANGED_EXTRA = { eye: { range: 72, rate: 2.6 }, ghastly: { range: 80, rate: 2.8 } };
// [item, chance, min, max]
const WILD_LOOT = [
  ['heart', 0.15, 1, 1],
  ['coin', 0.55, 1, 2],
  ['acorn', 0.2, 1, 2],
  ['egg', 0.08, 1, 1],
];

const SUPPLY_ITEMS = { hppack: 'hp', soupcan: 'stam' };
const MAGNET_R = 60; // how far away loot starts flying to you

const MAX_HP = 6;
const SWORD_DMG = 2;
const SWORD_REACH = 32;
const SWORD_REACH_WAVE = 46; // long enough to hit a monster on the far side of your own wall

// Hold left click: a quick tap swings the sword; holding past HOLD_MIN starts charging a dash.
export const HOLD_MIN = 0.28;
export const CHARGE_TIME = 0.8;
const DASH_COOLDOWN = 1.2;
const DASH_BASE = 22; // a short hop with a tap...
const DASH_CHARGED = 42; // ...up to 64px (four tiles) fully charged, before upgrades
const DASH_STAMINA = 0.2;
// What a hit leaves on the floor: red for blood (swords, dashes, the spiral), otherwise the colour of whatever was thrown
const BLOOD = ['#d6293f', '#a31d33'];
const SPLAT_TONE = {
  berry: '#e0405f', leek: '#5fbf4a', tuber: '#c8a05a', mushroom_red: '#d9453d', mushroom_blue: '#4a8fe0',
  acorn: '#9a6a3a', honey: '#f0b323', jam: '#a02a5a', milk: '#f4f1e8', egg: '#f2cd4a', coin: '#f2c94c',
  bullet: '#b3243a', gold: '#f2c94c', gem: '#4fa8ff', rock: '#a8a39a', mug: '#c9a27a', wool: '#efe2cc', truffle: '#5a4636',
  seeds: '#7fc75a', bandage: '#ece4d2', canned: '#c4c8cf', soup: '#e08a3a', medkit: '#e84a4a', hppack: '#e84a4a', soupcan: '#e08a3a',
};
export const splatTone = (id) => SPLAT_TONE[id] || '#cfc7b6';
const darken = (hex, k) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.round(v * (1 - k)));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, '0')).join('')}`;
};
const SPLAT_LIFE = 1.2; // seconds a splash stays on the ground

export const SHIELD_DUR = 3;
export const SHIELD_CD = 10; // counted from the moment the shield goes up
export const INVIS_DUR = 4;
export const INVIS_CD = 25; // counted from the moment you vanish
const SPIN_DUR = 0.6;
export const SPIN_COOLDOWN = 1.4;

// Wave Defense: right click throws without limit, but each throw drains this meter (like stamina)
const THROW_COST_FREE = 0.11;
const THROW_COST_ITEM = 0.16;
const THROW_REGEN = 0.32;
// Survival: right click fires the pistol. The throw meter doubles as the magazine, and refills while you let go.

const GUN_REGEN = 0.2;

const BULLET_SPEED = 340;
const BULLET_LIFE = 0.55; // about 12 tiles
// the three guns: how much magazine a shot uses, seconds between shots, bullets per shot, spread (radians), damage, range
export const GUNS = {
  pistol: { name: 'Pistol', icon: '🔫', len: 13, mag: 12, reload: 1.2, rate: 0.5, pellets: 1, spread: 0, dmg: 2, life: BULLET_LIFE, price: 0, blurb: 'Steady and accurate. 12 rounds.' },
  shotgun: { name: 'Shotgun', icon: '💥', len: 26, mag: 6, reload: 2, rate: 0.85, pellets: 5, spread: 0.36, dmg: 2.5, life: 0.3, price: 60, blurb: 'Five pellets. Point blank they all stack for huge damage, and every pellet one-shots a normal enemy. 6 shells.' },
  rifle: { name: 'Rifle', icon: '🎯', len: 25, mag: 60, reload: 2.4, rate: 0.11, pellets: 1, spread: 0.05, dmg: 1.4, life: 0.65, price: 90, blurb: 'A fast, accurate assault rifle that holds its aim at range. 60 rounds.' },
  plasma: { name: 'Plasma gun', icon: '⚡', len: 26, mag: 20, reload: 2.4, rate: 0.42, pellets: 1, spread: 0.02, dmg: 4, life: 0.75, price: 160, plasma: true, blurb: 'Glowing bolts that burn straight through two enemies in a line. 20 charges.' },
};
export const POWERS = {
  slowmo: { name: 'Slow-mo', icon: '⏳', color: '#7ea8ff', blurb: 'Monsters crawl and strike slowly for a few seconds.' },
  blast: { name: 'Big Blast', icon: '💣', color: '#ff9a3c', blurb: 'Wipes out every ordinary monster at once.' },
};
export const GUN_ORDER = ['pistol', 'shotgun', 'rifle', 'plasma'];
export const BOMB_R = 46; // blast radius in pixels
export const GRENADE_REACH = 190; // how far a grenade can be thrown
const BOMB_FUSE = 2.8; // seconds from the throw to the bang
// every kind of grenade: what it does, how long until it goes off and how far it reaches
const GRENADES = {
  truffle: { kind: 'blast', fuse: BOMB_FUSE, R: BOMB_R },
  stungrenade: { kind: 'stun', fuse: 1.5, R: 54 },
  smokegrenade: { kind: 'smoke', fuse: 1.1, R: 50 },
};
const STUN_TIME = 3.5;
const SMOKE_TIME = 9;
const THROW_UNLOCK = 0.35; // once empty, wait until it refills this far
export const RECALL_TIME = 2.5;
export const RECALL_CD = 20;

// Skeleton frames are 96x64 with the feet near (48, 40)
const FRAME_W = 96;
const FRAME_H = 64;
const FEET_X = 48;
const FEET_Y = 40;
const ANIMS = {
  idle: { n: 6, fps: 6, loop: true },
  walk: { n: 8, fps: 10, loop: true },
  attack: { n: 7, fps: 11, loop: false },
  hurt: { n: 7, fps: 16, loop: false },
  death: { n: 10, fps: 12, loop: false },
};

// [item, chance, min, max]
const SKELETON_LOOT = [
  ['heart', 0.18, 1, 1], // now and then, a heart
  ['coin', 0.6, 1, 3],
  ['acorn', 0.25, 1, 2],
  ['rock', 0.2, 1, 1],
  ['gold', 0.1, 1, 1],
  ['gem', 0.06, 1, 1],
];

// where a creature's body is centred: flyers hover above the ground, big ones are taller
const bodyY = (m) => {
  const def = MONSTERS[m.type];
  return m.y - (def.tiny ? TINY.chars[def.tiny].h / 2 : 8) * (m.scale || def.scale || 1) - (def.kind === 'fly' || def.fly ? 7 : 0);
};

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));


export class Combat {
  constructor(game, img, kills = 0) {
    this.g = game;
    this.img = img;
    this.hp = MAX_HP;
    this.maxHp = MAX_HP;
    this.kills = kills;
    this.skeletons = [];
    this.wilds = [];
    this.wildShots = []; // what the ranged monsters spit and shoot
    this.spells = []; // spells that are about to land (or just did) on the ground
    this.treeBars = []; // the health bar of a tree you have just hit
    this.wildT = 8;
    this.camps = new Map(); // chunk key -> { on, killed, until }
    this.campT = 0;
    this.campScan = 0;
    this.projectiles = [];
    this.bombs = []; // Sticky Grenades that have been thrown
    this.smokes = []; // clouds from smoke grenades: { x, y, t, life, R }
    this.blasts = []; // the flash of one going off
    this.remoteShots = [];
    this.drops = [];
    this.floaters = [];
    this.decals = []; // splashes lying on the ground for a moment
    this.hitColor = null; // set while a thrown item lands, so its splash takes the item's colour
    this.swing = null;
    this.swingCd = 0;
    this.dots = []; // burning targets
    this.bolts = []; // chain lightning arcs, for show
    this.throwCd = 0;
    this.gun = 'pistol';
    this.owned = { pistol: true }; // the others are bought in the shop
    this.ammo = Object.fromEntries(Object.entries(GUNS).map(([k, g]) => [k, g.mag]));
    this.reloadT = 0; // seconds of reloading left
    this.idleT = 0;
    this.slowT = 0; // Slow-mo still running, for the screen tint
    this.blastT = 0; // the flash of a Big Blast
    this.hold = null; // {t} while the left button is down
    this.skillHold = null; // {t} while Space is held to charge the dash
    this.thrown = null; // the trident in flight: { x, y, a, out, range, hit, ... }
    this.dash = null;
    this.dashCd = 0;
    this.trail = [];
    this.shieldT = 0;
    this.shieldCd = 0;
    this.invisT = 0;
    this.invisCd = 0;
    this.spin = null;
    // hiding: standing inside a house makes you invisible to skeletons and rivals (until you attack)
    this.hidden = false;
    this.insideId = null;
    this.revealT = 0;
    this.tEnergy = 1;
    this.tLocked = false;
    this.recallT = 0;
    this.recallCd = 0;
    this.recallFrom = null;
    this.invuln = 0;
    this.spawnT = 12; // a calm start before the first skeleton
    this.regenT = 0;
    this.nextId = 1;
  }

  // Max health grows with the Max health upgrade (Free Roam only); `gain` hearts arrive full
  refreshMaxHp(fill = false, gain = 0) {
    this.maxHp = maxHearts(this.g.wave ? 0 : this.up('health'), this.g.level || 1);
    this.hp = fill ? this.maxHp : Math.min(this.maxHp, this.hp + gain);
  }

  // ---------- upgrades ----------

  up(id) {
    return this.g.upgrades?.[id] || 0;
  }

  // The equipped sword. Wave Defense has none; Survival swings its baseball bat until you buy and equip a sword in the shop.
  weapon() {
    if (!this.g.wave) return weaponById(this.g.weapons?.equipped);
    if (!this.g.world.apoc) return null;
    const eq = this.g.weapons?.equipped;
    return !eq || eq === 'trusty' ? null : weaponById(eq);
  }

  meleeDmg() {
    return SWORD_DMG + (this.weapon()?.dmg || 0) + this.up('melee') * (this.g.wave ? 1 : 0.4) + (this.g.wave ? 0 : DMG_PER_LEVEL * ((this.g.level || 1) - 1));
  }

  swingCooldown() {
    const w = this.weapon();
    return w ? swingTime(w, this.up('atkspd')) : 0.42;
  }

  // what a dash covers and hits for at a given charge (0..1), with upgrades
  dashDist(power = 1) {
    return (DASH_BASE + DASH_CHARGED * power) * (1 + 0.18 * this.up('dash'));
  }

  dashDmg(power = 1) {
    // 2 for a short charge, up to 4 fully charged, plus a little from upgrades
    return 2 + Math.round(power * 2) + (this.g.wave ? Math.floor(this.up('melee') / 2) : this.up('dashdmg') * 0.35);
  }

  // The spiral: radius around you, and what it deals at a given charge
  spinRadius() {
    return 38 + 7 * this.up('spinrad'); // the tips of the blades reach this far
  }

  spinDmg(power = 1) {
    return 1.5 + 1.5 * power + 0.3 * this.up('spindmg');
  }

  throwBonus() {
    return this.up('throw') * (this.g.wave ? 1 : 0.3) + (this.g.wave ? 0 : DMG_PER_LEVEL * ((this.g.level || 1) - 1));
  }

  // Free Roam: a full second between throws to start, shaved down by Successive throw.
  // (Wave Defense paces throws with its throw meter instead.)
  throwCooldown() {
    return this.g.wave ? 0.2 : 1;
  }

  meleeReach() {
    return this.g.wave ? SWORD_REACH_WAVE : SWORD_REACH;
  }

  // ---------- input ----------

  center() {
    const p = this.g.player;
    return [p.x, p.y - 8];
  }

  aim() {
    // on a touch screen the aim comes from the attack button's drag, or is the nearest enemy
    const o = this.g.aimOverride;
    if (o === 'auto') return this.g.autoAim();
    if (typeof o === 'number') return o;
    const [cx, cy] = this.center();
    const m = this.g.mouseWorld();
    return Math.atan2(m.y - cy, m.x - cx);
  }

  faceAim(a) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    this.g.player.dir = Math.abs(c) >= Math.abs(s) ? (c > 0 ? 'right' : 'left') : (s > 0 ? 'down' : 'up');
  }

  // Fighting is for outdoors: no swinging or throwing from inside a house (Wave Defense's base is exempt)
  canFight() {
    return !!this.g.wave || this.insideId === null || !!this.g.dead;
  }

  warnIndoors() {
    if (this.g.t - (this.indoorToastAt ?? -9) < 2) return;
    this.indoorToastAt = this.g.t;
    this.g.onToast?.('🏠 No fighting indoors. Step outside first.');
  }

  // the host can switch melee or throwing off for a room
  allowed(kind) {
    if (this.g.rules?.[kind] !== false) return true;
    if (this.g.t - (this.ruleToastAt ?? -9) > 2) {
      this.ruleToastAt = this.g.t;
      this.g.onToast?.(kind === 'melee' ? '🚫 Melee is turned off in this room.' : '🚫 Throwing is turned off in this room.');
    }
    return false;
  }

  attack() {
    if (!this.allowed('melee')) return;
    if (!this.canFight()) {
      this.warnIndoors();
      return;
    }
    if (this.swingCd > 0) return;
    const a = this.aim();
    const w = this.weapon();
    if (w?.kind === 'staff') return this.castBolt(w, a);
    if (w?.kind === 'trident' && this.thrown) {
      this.g.onToast?.('🔱 Your trident is out there. Wait for it to come back.');
      return;
    }
    this.swing = { t: 0, a, hit: false, w: w?.id };
    sfx.play('swing');
    this.swingCd = this.swingCooldown();
    this.revealT = 1.5;
    this.g.mp?.net.send({ t: 'fx', kind: 'swing', a, w: w?.id });
    this.faceAim(a);
  }

  // ---------- staffs, slingshots and tridents ----------

  // a bolt of whatever the staff is made of
  castBolt(w, a) {
    const [cx, cy] = this.center();
    const speed = 210;
    const dmg = this.meleeDmg() * 0.9;
    this.swingCd = this.swingCooldown();
    this.revealT = 1.5;
    this.projectiles.push({
      x: cx + Math.cos(a) * 8, y: cy + Math.sin(a) * 8, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      id: 'gem', dmg, life: w.reach / speed, rot: 0, free: true, spell: w.effect, color: w.spell.color, pierce: w.effect === 'arcane' ? 3 : 0,
    });
    sfx.play('throw', 0.8);
    this.g.mp?.net.send({ t: 'fx', kind: 'throw', item: 'gem', x: cx, y: cy, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed });
    this.faceAim(a);
  }

  // hold + release: a spell lands at the cursor after a short warning
  castGround(w, power) {
    const g = this.g;
    const cost = DASH_STAMINA / g.staminaCap();
    if (this.swingCd > 0) return;
    if (g.stamina < cost) {
      g.onToast?.('Too tired to cast!');
      this.attack();
      return;
    }
    g.stamina -= cost;
    const [cx, cy] = this.center();
    const m = g.mouseWorld();
    const range = w.reach * 1.05;
    const d = Math.hypot(m.x - cx, m.y - cy) || 1;
    const k = Math.min(1, range / d);
    const sp = w.spell;
    const radius = 20 + 16 * power;
    this.spells.push({
      x: cx + (m.x - cx) * k, y: cy + (m.y - cy) * k + 8, t: -0.45, delay: 0.45, fx: sp.fx, hue: sp.hue, color: sp.color, frames: TINY.fx[sp.fx],
      radius, dmg: this.meleeDmg() * (1.2 + 1.1 * power), mine: true, effect: w.effect, did: false,
    });
    this.swingCd = this.swingCooldown() * 1.4;
    this.revealT = 1.5;
    sfx.play('wave', 0.6);
    this.faceAim(Math.atan2(m.y - cy, m.x - cx));
  }

  // a slingshot stone, or a fan of them
  shootSling(w, a, range = w.reach) {
    const [cx, cy] = this.center();
    const sh = w.shots;
    const dmg = this.meleeDmg() * sh.mul;
    this.swingCd = this.swingCooldown();
    this.revealT = 1.5;
    for (let i = 0; i < sh.n; i++) {
      const aa = a + (sh.n > 1 ? (i / (sh.n - 1) - 0.5) * 2 * sh.spread : (Math.random() - 0.5) * 2 * sh.spread) + (sh.n > 1 ? (Math.random() - 0.5) * 0.08 : 0);
      const speed = sh.speed * (0.92 + Math.random() * 0.16);
      this.projectiles.push({
        x: cx + Math.cos(aa) * 8, y: cy + Math.sin(aa) * 8, vx: Math.cos(aa) * speed, vy: Math.sin(aa) * speed,
        id: 'rock', dmg, life: range / speed, rot: 0, free: true, pierce: sh.pierce, stone: true,
      });
    }
    sfx.play('throw', 0.7);
    this.g.mp?.net.send({ t: 'fx', kind: 'throw', item: 'rock', x: cx, y: cy, vx: Math.cos(a) * sh.speed, vy: Math.sin(a) * sh.speed });
    this.faceAim(a);
  }

  // how far a trident thrown (or a stone shot) after holding for t seconds would fly
  tridentRange(w, t) {
    if (w.kind === 'sling') return 80 + (w.reach * 1.8 - 80) * Math.min(1, t / 0.9);
    return w.throw.min + (w.throw.max - w.throw.min) * Math.min(1, t / 1.1);
  }

  // let go of a held left click with a trident (hurl it) or a slingshot (fire), as far as the hold allowed
  releaseCharge(w, t) {
    const a = this.aim();
    if (w.kind === 'sling') {
      if (this.swingCd <= 0) this.shootSling(w, a, this.tridentRange(w, t));
      return;
    }
    if (this.thrown) return;
    const [cx, cy] = this.center();
    this.thrown = {
      x: cx, y: cy, a, out: true, range: this.tridentRange(w, t), went: 0, hit: new Set(), rot: a, speed: w.throw.speed, age: 0,
      dmg: this.meleeDmg() * 1.3, w: w.id, effect: w.effect,
    };
    this.swingCd = Math.max(this.swingCd, 0.25);
    this.revealT = 1.5;
    sfx.play('dash', 0.8);
    this.faceAim(a);
  }

  updateTrident(dt) {
    const th = this.thrown;
    const [cx, cy] = this.center();
    th.age += dt;
    th.rot = th.out ? th.a : Math.atan2(cy - th.y, cx - th.x); // the tip leads the way, out and back
    const step = th.speed * (th.out ? 1 : 1.15) * dt;
    if (th.out) {
      const nx = th.x + Math.cos(th.a) * step;
      const ny = th.y + Math.sin(th.a) * step;
      if (this.g.world.isBlocked(nx - 1, ny - 1, 2, 2, true, true)) th.went = th.range; // stuck in something: back it comes (water is no obstacle)
      else {
        th.x = nx;
        th.y = ny;
        th.went += step;
      }
      if (th.went >= th.range) {
        th.out = false;
        th.hit = new Set();
        th.dmg *= 0.7;
      }
    } else {
      const d = Math.hypot(cx - th.x, cy - th.y);
      if (d < 10 || th.age > 8) {
        this.thrown = null;
        sfx.play('pickup', 0.8);
        return;
      }
      th.x += ((cx - th.x) / d) * Math.min(d, step);
      th.y += ((cy - th.y) / d) * Math.min(d, step);
    }
    // everything along the way gets skewered once per leg
    for (const s of this.skeletons) {
      if (s.state === 'dead' || th.hit.has(`s${s.id}`) || Math.hypot(s.x - th.x, s.y - 8 - th.y) > 13) continue;
      th.hit.add(`s${s.id}`);
      this.damageSkeleton(s, th.dmg, th.x - Math.cos(th.a) * 8, th.y - Math.sin(th.a) * 8, 140);
    }
    for (const m of this.monstersNear(th.x, th.y, 9)) {
      if (th.hit.has(`m${m.id}`)) continue;
      th.hit.add(`m${m.id}`);
      this.hitMonster(m, th.dmg, th.x - Math.cos(th.a) * 8, th.y - Math.sin(th.a) * 8, th.effect === 'tide' ? 220 : 140);
      if (th.effect === 'tide') m.slowT = 2.5;
    }
    if (this.g.fight) {
      for (const r of this.g.remotes.values()) {
        if (r.hidden || this.g.sameTeam(r) || th.hit.has(`r${r.id}`) || Math.hypot(r.x - th.x, r.y - 8 - th.y) > 12) continue;
        th.hit.add(`r${r.id}`);
        this.hitRemote(r, th.dmg);
      }
    }
    for (const b of this.g.balls?.list || []) {
      if (th.hit.has(`b${b.i}`) || Math.hypot(th.x - b.x, th.y - (b.y - 5 - b.z)) > 10) continue;
      th.hit.add(`b${b.i}`);
      this.g.balls.hit(b, Math.cos(th.a), Math.sin(th.a), 200);
    }
    this.chopTrees(th.x, th.y, 9, th.dmg * 0.5, null, 0, th.hit);
  }

  // freeze a monster or skeleton in place for a while
  stunTarget(t, secs, color = '#ffe36b') {
    t.stunT = Math.max(t.stunT || 0, secs);
    t.stunColor = color;
    t.swing = null;
    t.skill = null;
  }

  // what a spell does besides damage
  spellEffect(effect, kind, t, dmg, x, y, strong = false) {
    if (!t) return;
    const [bx, by] = this.bodyOf(kind, t);
    if (effect === 'frost') {
      // frostbite: frozen solid for a moment (bosses shrug most of it off), then still slow
      if (kind !== 'rem') this.stunTarget(t, (strong ? 2.4 : 1.6) * (t.nightBoss || t.miniBoss ? 0.5 : 1), '#9fe3ff');
      t.slowT = 2.5;
      this.floaters.push({ x: bx, y: by - 20, text: '❄ FROZEN', color: '#8fd6ff', t: 0 });
    } else if (effect === 'fire') {
      if (!this.dots.some((d) => d.t === t)) this.dots.push({ kind, t, ticks: 3, wait: 0.5, dmg: 0.5 + dmg * 0.12 });
    } else if (effect === 'venom') {
      if (!this.dots.some((d) => d.t === t)) this.dots.push({ kind, t, ticks: 5, wait: 0.6, dmg: 0.45 + dmg * 0.1 });
      this.floaters.push({ x: bx, y: by - 20, text: '☠', color: '#8fe05a', t: 0 });
    } else if (effect === 'storm') {
      this.chain([{ kind, t, dmg }], x, y);
    }
  }

  // ---------- Space: your sword skill (Free Roam) ----------

  skillKeyDown() {
    if (this.skillHold) return;
    if (!this.allowed('melee')) return;
    if (!this.canFight()) {
      this.warnIndoors();
      return;
    }
    if (!this.g.activeSkill()) {
      if (this.g.t - (this.skillToastAt ?? -9) > 2) {
        this.skillToastAt = this.g.t;
        this.g.onToast?.('💨 Dash unlocks at level 6, Spiral Sword at level 8.');
      }
      return;
    }
    this.skillHold = { t: 0 };
  }

  // let go of Space: a tap is a short dash, and holding first makes it stronger
  skillKeyUp() {
    const h = this.skillHold;
    if (!h) return;
    this.skillHold = null;
    const skill = this.g.activeSkill();
    if (!skill || !this.canFight()) return;
    const power = Math.max(0.2, Math.min(1, h.t / (HOLD_MIN + CHARGE_TIME)));
    if (skill === 'spiral') this.startSpin(power, true);
    else this.startDash(power, true);
  }

  // R: whichever utility skill you have equipped
  activateUtil() {
    if (this.g.activeUtil() === 'invis') this.activateInvis();
    else this.activateShield();
  }

  // ---------- dash (hold + release left click) ----------

  holdStart() {
    if (!this.allowed('melee')) return;
    if (!this.canFight()) {
      this.warnIndoors();
      return;
    }
    if (!this.g.wave && this.weapon()?.kind === 'trident' && this.thrown) return; // it is still out there
    this.hold = { t: 0 };
  }

  cancelHold() {
    this.hold = null;
    this.skillHold = null;
  }

  // Left click let go. Free Roam: a tap swings (or bashes, or fires a bolt); holding first does the weapon's big move:
  // a staff drops a spell at the cursor, a trident is hurled and a slingshot fires, as far as you held. Dash and Spiral are on Space.
  // The wave modes keep the old hold-to-dash.
  holdEnd() {
    if (!this.hold) return;
    const t = this.hold.t;
    this.hold = null;
    const w = this.weapon();
    const kind = w?.kind;
    if (!this.canFight()) {
      this.warnIndoors();
      return;
    }
    if (this.g.wave) {
      const skill = this.g.activeSkill();
      if (t < HOLD_MIN || !skill) this.attack();
      else if (skill === 'spiral') this.startSpin(Math.min(1, (t - HOLD_MIN) / CHARGE_TIME));
      else this.startDash(Math.min(1, (t - HOLD_MIN) / CHARGE_TIME));
    } else if (t < HOLD_MIN) this.attack();
    else if (kind === 'staff') this.castGround(w, Math.min(1, (t - HOLD_MIN) / CHARGE_TIME));
    else if (kind === 'trident' || kind === 'sling') this.releaseCharge(w, t);
    else this.attack();
  }

  startDash(power, quiet = false) {
    const g = this.g;
    if (this.dash) return;
    const cost = DASH_STAMINA / g.staminaCap();
    if (this.dashCd > 0 || g.stamina < cost) {
      if (g.stamina < cost) g.onToast?.('Too tired to dash!');
      if (!quiet) this.attack();
      return;
    }
    const a = this.aim();
    g.stamina -= cost;
    this.dashCd = DASH_COOLDOWN;
    sfx.play('dash');
    this.revealT = 1.5;
    this.dash = {
      t: 0,
      a,
      dur: 0.18 + 0.1 * power,
      dist: this.dashDist(power),
      dmg: this.dashDmg(power),
      hit: new Set(),
    };
    this.invuln = Math.max(this.invuln, this.dash.dur + 0.15);
    this.faceAim(a);
    g.mp?.net.send({ t: 'fx', kind: 'swing', a });
  }

  startSpin(power, quiet = false) {
    const g = this.g;
    if (this.spin || this.dash) return;
    const cost = DASH_STAMINA / g.staminaCap();
    if (this.dashCd > 0 || g.stamina < cost) {
      if (g.stamina < cost) g.onToast?.('Too tired to spin!');
      if (!quiet) this.attack();
      return;
    }
    g.stamina -= cost;
    this.dashCd = SPIN_COOLDOWN;
    this.revealT = 1.5;
    this.spin = { t: 0, dur: SPIN_DUR, a0: this.aim(), power, r: this.spinRadius(), dmg: this.spinDmg(power), hit: new Set() };
    sfx.play('dash');
    g.mp?.net.send({ t: 'fx', kind: 'spin', a: this.spin.a0, r: this.spin.r, d: SPIN_DUR }); // others see the whirl too
  }

  // The blade sweeps a full circle; whatever it passes over is cut once
  updateSpin(dt) {
    const sp = this.spin;
    const g = this.g;
    sp.t += dt;
    // The three blades spin 1.5 turns over the move (see drawSpin). A blade cuts whatever it has swept over,
    // so a target is hit the moment any blade touches it.
    const turned = Math.min(1, sp.t / sp.dur) * Math.PI * 3; // how far each blade has travelled
    const [cx, cy] = this.center();
    const TAU = Math.PI * 2;
    const reached = (x, y) => {
      const d = Math.hypot(x - cx, y - cy);
      // creatures are about 12px across, so anything whose body touches the ring counts
      if (d > sp.r + 8) return false;
      if (d < 10) return true; // right on top of you
      const off = (((Math.atan2(y - cy, x - cx) - sp.a0) % TAU) + TAU) % TAU;
      for (let i = 0; i < 3; i++) {
        // blade i started at a0 + i/3 of a turn; the arc it has covered runs from there for `turned`
        const behind = (((off - (i * TAU) / 3) % TAU) + TAU) % TAU;
        if (behind <= turned + 0.35) return true; // a little slack for the blade's own width
      }
      return false;
    };
    for (const s of this.skeletons) {
      if (s.state !== 'dead' && !sp.hit.has(`s${s.id}`) && reached(s.x, s.y - 8)) {
        sp.hit.add(`s${s.id}`);
        this.damageSkeleton(s, sp.dmg, cx, cy, 160);
      }
    }
    for (const o of this.g.world.treesNear(cx, cy, sp.r + 8)) {
      if (!sp.hit.has(`t${o.tkey}`) && reached(o.x, o.y - 5)) this.chopTrees(o.x, o.y - 5, 1, sp.dmg, null, 0, sp.hit);
    }
    for (const m of this.monstersNear(cx, cy, sp.r)) {
      if (sp.hit.has(`m${m.id}`) || !reached(m.x, bodyY(m))) continue;
      sp.hit.add(`m${m.id}`);
      this.hitMonster(m, sp.dmg, cx, cy, 160);
    }
    if (g.fight) {
      for (const r of g.remotes.values()) {
        if (!r.hidden && !sp.hit.has(`r${r.id}`) && reached(r.x, r.y - 8)) {
          sp.hit.add(`r${r.id}`);
          this.hitRemote(r, sp.dmg);
        }
      }
    }
    if (sp.t >= sp.dur) this.spin = null;
  }

  updateDash(dt) {
    const d = this.dash;
    const g = this.g;
    const p = g.player;
    d.t += dt;
    const step = (d.dist / d.dur) * dt;
    const n = Math.max(1, Math.ceil(step / 2));
    for (let i = 0; i < n; i++) {
      const nx = p.x + (Math.cos(d.a) * step) / n;
      const ny = p.y + (Math.sin(d.a) * step) / n;
      if (!g.blocked(nx, ny)) {
        p.x = nx;
        p.y = ny;
      } else if (!g.blocked(nx, p.y)) p.x = nx;
      else if (!g.blocked(p.x, ny)) p.y = ny;
      else {
        d.t = d.dur; // ran into something
        break;
      }
    }
    this.trail.push({ x: p.x, y: p.y, dir: p.dir, t: 0 });

    // everything the hero barrels through gets hit once
    const cx = p.x;
    const cy = p.y - 8;
    for (const s of this.skeletons) {
      if (s.state !== 'dead' && !d.hit.has(`s${s.id}`) && Math.hypot(s.x - cx, s.y - 8 - cy) < 17) {
        d.hit.add(`s${s.id}`);
        this.damageSkeleton(s, d.dmg, cx - Math.cos(d.a) * 10, cy - Math.sin(d.a) * 10, 190);
      }
    }
    this.chopTrees(cx, cy, 17, d.dmg, null, 0, d.hit); // a dash cuts through trees too
    for (const m of this.monstersNear(cx, cy, 17)) {
      if (d.hit.has(`m${m.id}`)) continue;
      d.hit.add(`m${m.id}`);
      this.hitMonster(m, d.dmg, cx - Math.cos(d.a) * 10, cy - Math.sin(d.a) * 10, 190);
    }
    if (g.fight) {
      for (const r of g.remotes.values()) {
        if (!r.hidden && !d.hit.has(`r${r.id}`) && Math.hypot(r.x - cx, r.y - 8 - cy) < 17) {
          d.hit.add(`r${r.id}`);
          this.hitRemote(r, d.dmg);
        }
      }
    }
    if (d.t >= d.dur) this.dash = null;
  }

  // ---------- recall to base (H) ----------

  startRecall() {
    if (this.recallT > 0 || this.dash) return;
    if (this.recallCd > 0) {
      this.g.onToast?.(`Recall is recharging (${Math.ceil(this.recallCd)}s).`);
      return;
    }
    this.recallT = RECALL_TIME;
    this.recallFrom = { x: this.g.player.x, y: this.g.player.y };
  }

  cancelRecall(why) {
    if (this.recallT <= 0) return;
    this.recallT = 0;
    if (why) this.g.onToast?.(why);
  }

  updateRecall(dt) {
    if (this.recallT <= 0) return;
    const p = this.g.player;
    // standing still is part of the spell
    if (Math.hypot(p.x - this.recallFrom.x, p.y - this.recallFrom.y) > 5) {
      this.cancelRecall('Recall cancelled: you moved.');
      return;
    }
    this.recallT -= dt;
    if (this.recallT <= 0) {
      this.recallT = 0;
      this.recallCd = RECALL_CD;
      this.g.recallHome();
    }
  }

  // ---------- shield skill (F) ----------

  activateShield() {
    if (this.shieldCd > 0) return;
    if (this.g.activeUtil() !== 'shield') {
      this.g.onToast?.(this.g.skills.shield ? 'Equip the Shield in the shop (B).' : 'The Shield unlocks at level 10.');
      return;
    }
    this.shieldT = SHIELD_DUR;
    this.shieldCd = SHIELD_CD;
    sfx.play('shield');
    this.g.mp?.net.send({ t: 'fx', kind: 'shield' });
  }

  // ---------- invisibility skill (C) ----------

  activateInvis() {
    if (this.invisCd > 0 || this.invisT > 0) return;
    if (this.g.activeUtil() !== 'invis') {
      this.g.onToast?.(this.g.skills.invis ? 'Equip Invisibility in the shop (B).' : 'Invisibility unlocks at level 15.');
      return;
    }
    this.invisT = INVIS_DUR;
    this.invisCd = INVIS_CD;
    this.revealT = 0;
    sfx.play('shield');
    this.g.onToast?.('You vanish! Attacking will give you away.');
  }

  // Wave Defense throw: a free pebble by default, or the selected throwable item. Costs throw energy.
  throwWave(slot) {
    if (this.throwCd > 0) return;
    if (this.g.inventory[slot]?.id === 'truffle') {
      this.throwGrenade(slot);
      return;
    }
    if (this.tLocked) {
      this.throwCd = 0.25;
      return;
    }
    const inv = this.g.inventory;
    const stack = inv[slot];
    const def = stack && ITEMS[stack.id];
    const ammo = def && def.throw !== undefined && !def.heal && !def.energy && !def.wave;
    if (this.g.world.apoc && !ammo) {
      this.shootGun();
      return;
    }
    const id = ammo ? stack.id : 'rock';
    const dmg = (ammo ? throwDamage(def) : 1) + this.throwBonus();
    const a = this.aim();
    const [cx, cy] = this.center();
    if (ammo) {
      removeFromSlot(inv, slot, 1);
      this.g.emitInventory();
    }
    this.tEnergy -= ammo ? THROW_COST_ITEM : THROW_COST_FREE;
    if (this.tEnergy <= 0.001) {
      this.tEnergy = 0;
      this.tLocked = true;
    }
    this.revealT = 1.5;
    // the free pebble flies like a light item; real ammo flies by its own weight
    const st = throwStats(ammo ? id : 'acorn');
    const shot = {
      x: cx + Math.cos(a) * 8, y: cy + Math.sin(a) * 8,
      vx: Math.cos(a) * st.speed, vy: Math.sin(a) * st.speed,
      id, dmg, life: st.life, rot: 0, free: !ammo,
    };
    this.projectiles.push(shot);
    sfx.play('throw', 0.8);
    this.g.mp?.net.send({ t: 'fx', kind: 'throw', item: id, x: shot.x, y: shot.y, vx: shot.vx, vy: shot.vy });
    this.throwCd = 0.2;
    this.faceAim(a);
  }

  // Throw a Sticky Grenade: it flies a short way, sticks to the first enemy it touches (or just lands), and goes off after a few seconds
  throwGrenade(slot) {
    const inv = this.g.inventory;
    const item = inv[slot]?.id;
    const gren = GRENADES[item];
    if (!gren) return;
    removeFromSlot(inv, slot, 1);
    this.g.emitInventory();
    const a = this.aim();
    const [cx, cy] = this.center();
    // it lands where the cursor points (up to a throw's reach); on a touch screen it goes a medium distance the way you aim
    let dist = 110;
    if (!this.g.touchMode && this.g.aimOverride == null) {
      const m = this.g.mouseWorld();
      dist = Math.hypot(m.x - cx, m.y - cy);
    }
    dist = Math.min(GRENADE_REACH, Math.max(16, dist));
    const flight = Math.max(0.25, dist / 230); // seconds in the air
    const x0 = cx + Math.cos(a) * 8;
    const y0 = cy + Math.sin(a) * 8;
    const tx = cx + Math.cos(a) * Math.max(dist, 10);
    const ty = cy + Math.sin(a) * Math.max(dist, 10);
    this.bombs.push({
      x: x0, y: y0, vx: (tx - x0) / flight, vy: (ty - y0) / flight,
      fly: flight, flightMax: flight, dist, tx, ty,
      fuse: gren.fuse, max: gren.fuse, stuck: null, R: gren.R, kind: gren.kind, item,
    });
    this.revealT = 1.5;
    sfx.play('throw', 0.8);
    this.throwCd = 0.4;
    this.faceAim(a);
  }

  updateBombs(dt) {
    const { world } = this.g;
    this.blasts = this.blasts.filter((bl) => (bl.t += dt) < 0.45);
    if (this.smokes.length) this.smokes = this.smokes.filter((s) => (s.t += dt) < s.life);
    if (!this.bombs.length) return;
    this.bombs = this.bombs.filter((b) => {
      if (b.fly > 0) {
        const step = Math.min(dt, b.fly); // the last step stops exactly on the target
        b.fly -= dt;
        const px = b.x;
        const py = b.y;
        b.x += b.vx * step;
        b.y += b.vy * step;
        for (const m of [...(this.g.wave?.monsters || []), ...this.wilds]) {
          if (m.state === 'dead') continue;
          const sc = MONSTERS[m.type].scale || 1;
          const ox = (b.x - m.x) / (7 * sc + 3);
          const oy = (b.y - bodyY(m)) / (9 * sc + 3);
          if (ox * ox + oy * oy < 1) {
            b.stuck = m;
            b.fly = 0;
            break;
          }
        }
        if (!b.stuck && world.isBlocked(b.x - 1, b.y - 1, 2, 2, true, true)) {
          b.x = px;
          b.y = py;
          b.fly = 0;
        }
      }
      if (b.stuck) {
        if (b.stuck.state === 'dead') b.stuck = null;
        else {
          b.x = b.stuck.x;
          b.y = bodyY(b.stuck) + 4;
        }
      }
      b.fuse -= dt;
      if (b.fuse > 0) return true;
      this.explode(b);
      return false;
    });
  }

  explode(b) {
    if (b.kind === 'smoke') {
      // a thick cloud: whoever stands in it cannot be seen
      this.smokes.push({ x: b.x, y: b.y, t: 0, life: SMOKE_TIME, R: b.R });
      sfx.play('wave', 0.4);
      return;
    }
    if (b.kind === 'stun') {
      this.blasts.push({ x: b.x, y: b.y, t: 0, R: b.R, tone: 'stun' });
      sfx.play('boom', 0.5);
      for (const m of this.monstersNear(b.x, b.y, b.R)) {
        this.stunTarget(m, m.nightBoss || m.miniBoss ? STUN_TIME * 0.5 : STUN_TIME);
        this.floaters.push({ x: m.x, y: m.y - 30, text: 'STUNNED', color: '#ffe36b', t: 0 });
      }
      for (const s of this.skeletons) {
        if (s.state !== 'dead' && Math.hypot(s.x - b.x, s.y - 8 - b.y) <= b.R) {
          this.stunTarget(s, STUN_TIME);
          this.floaters.push({ x: s.x, y: s.y - 30, text: 'STUNNED', color: '#ffe36b', t: 0 });
        }
      }
      return;
    }
    this.blasts.push({ x: b.x, y: b.y, t: 0, R: b.R });
    sfx.play('boom');
    // anything normal inside the circle is blown away; tougher things take a big hit
    // enemies are thrown back away from the blast: the closer, the harder
    for (const m of this.monstersNear(b.x, b.y, b.R)) {
      const d = Math.hypot(m.x - b.x, bodyY(m) - b.y);
      this.hitMonster(m, this.isNormalFoe(m) ? Math.max(9, m.hp) : 9, b.x, b.y, 160 + 240 * Math.max(0, 1 - d / b.R));
    }
    for (const s of this.skeletons) {
      const d = Math.hypot(s.x - b.x, s.y - 8 - b.y);
      if (s.state !== 'dead' && d <= b.R) this.damageSkeleton(s, 9, b.x, b.y, 180 + 240 * (1 - d / b.R));
    }
    // and so are you: a grenade at your feet hurts, and sends you flying back the way you came from
    const p = this.g.player;
    const pd = Math.hypot(p.x - b.x, p.y - 8 - b.y);
    if (pd <= b.R && !this.g.dead && !this.g.inside) {
      const near = 1 - pd / b.R;
      const ang = pd < 3 ? this.aim() + Math.PI : Math.atan2(p.y - 8 - b.y, p.x - b.x);
      const power = 130 + 260 * near;
      this.hurtPlayer(0.4 + 1.1 * near, b.x, b.y, { invuln: 0.6, by: { kind: 'bomb', name: 'your own grenade' } });
      if (!this.g.mount) this.g.push = { vx: Math.cos(ang) * power, vy: Math.sin(ang) * power };
    }
    this.chopTrees(b.x, b.y, b.R * 0.7, 6);
  }

  // Survival: the pistol. Bullets fly fast and straight, and hit like the throwing items do.
  shootGun() {
    if (this.throwCd > 0) return;
    const gun = GUNS[this.gun] || GUNS.pistol;
    if (this.reloadT > 0) return;
    if (this.ammo[this.gun] <= 0) {
      this.reloadT = gun.reload;
      return;
    }
    const a = this.aim();
    const [cx, cy] = this.center();
    this.ammo[this.gun]--;
    this.idleT = 0;
    if (this.ammo[this.gun] <= 0) this.reloadT = gun.reload; // empty: reloads on its own
    this.revealT = 1.5;
    for (let i = 0; i < gun.pellets; i++) {
      // the shotgun fans its pellets out evenly with a little wobble; the machine gun just wanders
      const off = gun.pellets > 1 ? (i / (gun.pellets - 1) - 0.5) * gun.spread * 2 + (Math.random() - 0.5) * 0.06 : (Math.random() - 0.5) * gun.spread;
      const b = a + off;
      const shot = {
        x: cx + Math.cos(b) * 12, y: cy + Math.sin(b) * 12,
        vx: Math.cos(b) * BULLET_SPEED, vy: Math.sin(b) * BULLET_SPEED,
        id: 'bullet', dmg: gun.dmg + this.throwBonus(), life: gun.life, rot: 0, free: true,
        plasma: !!gun.plasma, pierce: gun.plasma ? 1 : 0, // plasma bolts go through one enemy and hit the next
        pellet: gun.pellets > 1, ox: cx + Math.cos(b) * 12, oy: cy + Math.sin(b) * 12, // shotgun pellets remember where they started
      };
      this.projectiles.push(shot);
      this.g.mp?.net.send({ t: 'fx', kind: 'throw', item: gun.plasma ? 'plasma' : 'bullet', x: shot.x, y: shot.y, vx: shot.vx, vy: shot.vy });
    }
    this.muzzleT = this.gun === 'shotgun' ? 0.11 : 0.07;
    this.muzzleA = a;
    sfx.play(gun.plasma ? 'plasma' : 'gun', this.gun === 'rifle' ? 0.5 : 0.8);
    this.throwCd = gun.rate;
    this.faceAim(a);
  }

  // A power-up picked up in a wave: Slow-mo (monsters crawl) or Big Blast (ordinary monsters die at once)
  usePower(kind) {
    const p = POWERS[kind];
    if (!this.g.wave || !p || !this.g.wave.power(kind)) return;
    if (kind === 'slowmo') this.slowT = POWER_SLOW_TIME;
    else this.blastT = 0.5;
    sfx.play(kind === 'blast' ? 'shield' : 'dash');
    this.g.onToast?.(`${p.icon} ${p.name}!`);
  }

  // switch to the next gun (Survival)
  cycleGun() {
    if (!this.g.wave || !this.g.world.apoc) return;
    const have = GUN_ORDER.filter((id) => this.owned[id]);
    if (have.length < 2) {
      this.g.onToast?.('Buy the Shotgun, Rifle or Plasma gun in the shop (B) to switch.');
      return;
    }
    this.equipGun(have[(have.indexOf(this.gun) + 1) % have.length]);
  }

  equipGun(id) {
    if (!this.owned[id]) return;
    this.gun = id;
    this.reloadT = this.ammo[id] <= 0 ? GUNS[id].reload : 0;
    this.throwCd = Math.max(this.throwCd, 0.15);
    this.g.onToast?.(`${GUNS[this.gun].icon} ${GUNS[this.gun].name}`);
    sfx.play('block', 0.5);
  }

  // the gun in your hand (the sprite of whichever one you carry), turned the way you are aiming, and the flash when it fires
  drawGun(ctx, x, y) {
    if (this.g.dead) return;
    const gun = GUNS[this.gun] || GUNS.pistol;
    const sheet = this.img[`guns/${this.gun}`];
    const a = this.aim();
    const [cx, cy] = this.center();
    if (sheet) {
      const w = gun.len;
      const h = (sheet.height / sheet.width) * w;
      ctx.save();
      ctx.translate(Math.round(cx + Math.cos(a) * 3), Math.round(cy + Math.sin(a) * 3 + 1));
      ctx.rotate(a);
      if (Math.cos(a) < 0) ctx.scale(1, -1); // turned the other way, the gun is not upside down
      ctx.drawImage(sheet, -w * 0.28, -h * 0.4, w, h);
      ctx.restore();
    }
    if (this.muzzleT > 0) {
      const mx = cx + Math.cos(this.muzzleA) * (gun.len * 0.75 + 3);
      const my = cy + Math.sin(this.muzzleA) * (gun.len * 0.75 + 3);
      ctx.fillStyle = gun.plasma ? '#cdefff' : '#fff6c2';
      ctx.fillRect(Math.round(mx) - 2, Math.round(my) - 2, 4, 4);
      ctx.fillStyle = gun.plasma ? '#4aa8ff' : '#ffb62e';
      ctx.fillRect(Math.round(mx - Math.cos(this.muzzleA) * 2) - 3, Math.round(my - Math.sin(this.muzzleA) * 2) - 1, 6, 2);
    }
  }

  throwSelected(slot) {
    if (!this.allowed('throw')) return;
    if (!this.canFight()) {
      this.warnIndoors();
      return;
    }
    if (this.g.wave) {
      this.throwWave(slot);
      return;
    }
    if (this.throwCd > 0) return;
    const inv = this.g.inventory;
    const stack = inv[slot];
    if (!stack) return;
    if (GRENADES[stack.id]) {
      this.throwGrenade(slot);
      return;
    }
    const def = ITEMS[stack.id];
    const a = this.aim();
    const [cx, cy] = this.center();
    const st = throwStats(stack.id);
    removeFromSlot(inv, slot, 1);
    this.revealT = 1.5;
    this.g.emitInventory();
    this.projectiles.push({
      x: cx + Math.cos(a) * 8,
      y: cy + Math.sin(a) * 8,
      vx: Math.cos(a) * st.speed,
      vy: Math.sin(a) * st.speed,
      id: stack.id,
      dmg: throwDamage(def) + this.throwBonus(),
      life: st.life,
      rot: 0,
    });
    const shot = this.projectiles[this.projectiles.length - 1];
    sfx.play('throw');
    this.g.mp?.net.send({ t: 'fx', kind: 'throw', item: stack.id, x: shot.x, y: shot.y, vx: shot.vx, vy: shot.vy });
    this.throwCd = this.throwCooldown();
    this.faceAim(a);
  }

  // ---------- simulation ----------

  update(dt) {
    this.updateBombs(dt);
    for (const k in this.g.cds) this.g.cds[k] = Math.max(0, this.g.cds[k] - dt);
    this.swingCd -= dt;
    this.throwCd -= dt;
    this.invuln -= dt;
    if (this.god) this.invuln = Math.max(this.invuln, 1); // cheat: nothing can hurt you
    this.revealT = Math.max(0, this.revealT - dt);
    const room = this.g.inside ? { id: 'interior' } : this.g.world.houseAt(this.g.player.x, this.g.player.y - 2);
    const wasHidden = this.hidden;
    this.insideId = room?.id ?? null;
    const pl = this.g.player;
    const inSmoke = this.smokes.some((s) => Math.hypot(pl.x - s.x, pl.y - 4 - s.y) < s.R);
    this.hidden = this.g.dead ? true : (!!room || this.invisT > 0 || inSmoke) && this.revealT <= 0;
    if (inSmoke && !this.wasInSmoke && !this.g.dead) this.floaters.push({ x: pl.x, y: pl.y - 34, text: 'hidden in the smoke', color: '#cfd6e0', t: 0 });
    this.wasInSmoke = inSmoke;
    if (this.hidden && !wasHidden && !this.g.dead && room && !this.g.inside) this.g.onToast?.('Hiding indoors: skeletons and rivals can’t see you.');
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.recallCd = Math.max(0, this.recallCd - dt);
    this.updateRecall(dt);
    this.slowT = Math.max(0, this.slowT - dt);
    this.blastT = Math.max(0, this.blastT - dt);
    if (this.g.wave) {
      this.tEnergy = Math.min(1, this.tEnergy + (this.g.world.apoc ? GUN_REGEN : THROW_REGEN) * dt);
      if (this.g.world.apoc) {
        const gun = GUNS[this.gun];
        if (this.reloadT > 0) {
          this.reloadT -= dt;
          if (this.reloadT <= 0) this.ammo[this.gun] = gun.mag;
        } else if (this.ammo[this.gun] < gun.mag && (this.idleT += dt) > 2) {
          this.reloadT = gun.reload; // not shooting for a while: top the magazine up
        }
      }
      this.muzzleT = Math.max(0, (this.muzzleT || 0) - dt);
      if (this.tLocked && this.tEnergy >= THROW_UNLOCK) this.tLocked = false;
    }
    this.shieldT = Math.max(0, this.shieldT - dt);
    this.shieldCd = Math.max(0, this.shieldCd - dt);
    this.invisT = Math.max(0, this.invisT - dt);
    this.invisCd = Math.max(0, this.invisCd - dt);
    if (this.spin) this.updateSpin(dt);
    if (this.hold) this.hold.t += dt;
    if (this.skillHold) this.skillHold.t += dt;
    if (this.thrown) this.updateTrident(dt);
    if (this.dash) this.updateDash(dt);
    this.trail = this.trail.filter((tr) => (tr.t += dt) < 0.22);

    if (this.swing) {
      this.swing.t += dt;
      if (!this.swing.hit && this.swing.t >= 0.07) {
        this.swing.hit = true;
        this.swordHit(this.swing.a);
      }
      if (this.swing.t >= 0.24) this.swing = null;
    }

    this.updateDots(dt);
    this.bolts = this.bolts.filter((b) => (b.t += dt) < 0.22);

    if (!this.g.wave && !this.g.inside && !this.g.dungeon) {
      // skeletons roam the free world only (and never come into your house, or follow you underground)
      this.updateSpawns(dt);
      this.updateCamps(dt);
      this.updateWilds(dt);
    }
    this.skeletons = this.skeletons.filter((s) => this.updateSkeleton(s, dt));
    this.projectiles = this.projectiles.filter((p) => this.updateProjectile(p, dt));
    // other players' throws are just for show; their own client works out the damage
    this.remoteShots = this.remoteShots.filter((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += dt * 14;
      return (p.life -= dt) > 0;
    });
    this.drops = this.drops.filter((d) => this.updateDrop(d, dt));
    this.floaters = this.floaters.filter((f) => (f.t += dt) < 1);
    // in Survival the blood stays where it fell; elsewhere it fades after a moment
    this.decals = this.decals.filter((d) => (d.t += dt) < SPLAT_LIFE || d.keep);

    // heart regeneration, only while fed and watered
    // (in Wave Defense, hearts only come back from health pickups)
    if (!this.g.wave && this.hp < this.maxHp) {
      this.regenT += dt;
      if (this.regenT >= 20) {
        this.hp++;
        this.regenT = 0;
      }
    }
  }

  updateSpawns(dt) {
    this.spawnT -= dt;
    if (this.spawnT > 0) return;
    this.spawnT = 2.5 + Math.random() * 2;
    const night = this.g.darkness();
    const cap = night > 0.5 ? 5 : night > 0.15 ? 3 : 1;
    if (this.skeletons.filter((s) => s.state !== 'dead').length >= cap) return;
    const { world, player: p } = this.g;
    for (let i = 0; i < 6; i++) {
      const ang = Math.random() * Math.PI * 2;
      const d = 150 + Math.random() * 80;
      const x = p.x + Math.cos(ang) * d;
      const y = p.y + Math.sin(ang) * d;
      const tx = Math.floor(x / 16);
      const ty = Math.floor(y / 16);
      if (world.type(tx, ty) === WATER || world.isCleared(tx, ty) || world.isBlocked(x - 4, y - 4, 8, 4)) continue;
      this.skeletons.push({
        id: this.nextId++, x, y, hp: 3, state: 'idle', stateT: 0, anim: Math.random() * 3, face: 1,
        cd: 0.8, didHit: false, kx: 0, ky: 0, wx: 0, wy: 0, wanderT: 0,
      });
      return;
    }
  }

  // ---------- dungeons ----------

  // The monsters that wait in one room of a dungeon, woken when you get close. The last room holds the guardian.
  spawnDungeonRoom(L, room, kind, tier, last) {
    const { world } = this.g;
    const pick = () => {
      for (let k = 0; k < 24; k++) {
        const tx = room.x + 1 + Math.floor(Math.random() * (room.w - 2));
        const ty = room.y + 1 + Math.floor(Math.random() * (room.h - 2));
        const x = (L.ox + tx) * 16 + 8;
        const y = (L.oy + ty) * 16 + 10;
        if (!world.isBlocked(x - 4, y - 4, 8, 4)) return [x, y];
      }
      return null;
    };
    const skel = (hp, elite = false) => {
      const pt = pick();
      if (!pt) return;
      this.skeletons.push({
        id: this.nextId++, x: pt[0], y: pt[1], hp, elite, state: 'idle', stateT: 0, anim: Math.random() * 3, face: 1,
        cd: 0.8, didHit: false, kx: 0, ky: 0, wx: 0, wy: 0, wanderT: 0,
      });
    };
    const wild = (type) => {
      const pt = pick();
      if (!pt) return;
      const def = MONSTERS[type];
      const lv = rollMonsterLevel(Math.min(10, tier * 3));
      const hp = Math.round(def.hp * (1 + 0.3 * (tier - 1)) * lvHp(lv));
      this.wilds.push({
        lv, id: `w${this.nextId++}`, wild: true, type, x: pt[0], y: pt[1], hp, max: hp, state: 'move', t: 0,
        anim: Math.random() * 3, face: 1, atk: 0, cd: 0.8, kx: 0, ky: 0, wx: 0, wy: 0, wanderT: 0, phase: Math.random() * 6,
      });
    };
    const n = 2 + tier + Math.floor(room.i / 2);
    if (kind === 'crypt') {
      for (let i = 0; i < n + (last ? 2 : 0); i++) skel(3 + (tier - 1));
      if (last) skel(14 + 4 * tier, true); // the crypt keeper
    } else if (kind === 'cave') {
      const pool = ['jelly', 'redcap', 'hand', 'bat', ...(tier > 1 ? ['hound', 'scarab', 'eye', 'slime'] : []), ...(tier > 2 ? ['grimlock', 'myconid', 'ghoul', 'ghastly'] : [])];
      for (let i = 0; i < n; i++) wild(pool[Math.floor(Math.random() * pool.length)]);
      if (last) wild(['ogre', 'stonetroll', 'ettin'][tier - 1]); // the cave's brute
    } else {
      const pool = ['jelly', 'hand', 'redcap'];
      for (let i = 0; i < n - 1; i++) wild(pool[Math.floor(Math.random() * pool.length)]);
      if (last) {
        wild('cadaver');
        wild('cadaver');
      }
    }
    if (last) this.g.onToast?.('Something big stirs in the dark…');
  }

  // ---------- wild monsters ----------

  updateWilds(dt) {
    this.wildT -= dt;
    if (this.wildT <= 0) {
      this.wildT = 3 + Math.random() * 3;
      const night = this.g.darkness();
      const cap = night > 0.5 ? 5 : night > 0.15 ? 3 : 2;
      if (this.wilds.filter((w) => w.state !== 'dead').length < cap) this.spawnWild(night > 0.15);
      if (!this.g.dungeon && !this.g.wave && !this.g.world.depot) this.updateEvents(night);
    }
    this.wilds = this.wilds.filter((w) => this.updateWild(w, dt));
    if (this.wildQ?.length) this.wilds.push(...this.wildQ.splice(0));
    this.updateWildShots(dt);
    this.updateSpells(dt);
  }

  updateWildShots(dt) {
    const p = this.g.player;
    this.wildShots = this.wildShots.filter((s) => {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (!this.hidden && !this.g.dead && Math.hypot(p.x - s.x, p.y - 6 - s.y) < 8) {
        this.hurtPlayer(s.dmg, s.x - s.vx, s.y - s.vy, { by: s.by });
        return false;
      }
      return s.life > 0 && !this.g.world.isBlocked(s.x - 1, s.y - 1, 2, 2, true);
    });
  }

  // every so often: a bulk spawn of one kind (five bats and so on), and at night a boss that burns up at dawn
  updateEvents(night) {
    this.bulkT = (this.bulkT ?? 40 + Math.random() * 40) - 3.5;
    if (this.bulkT <= 0) {
      this.bulkT = 55 + Math.random() * 60;
      const pool = night > 0.15 ? ['bat', 'bat', 'hound', 'scarab', 'redcap'] : ['jelly', 'redcap', 'hand'];
      this.spawnPack(pool[Math.floor(Math.random() * pool.length)], 5);
    }
    if (night > 0.5 && !this.zombieNight) {
      this.zombieNight = true;
      this.spawnPack('z_small', 5, '🧟 Zombies are shambling out of the dark!');
    } else if (night < 0.1) {
      this.zombieNight = false;
    }
    this.miniT = (this.miniT ?? 55 + Math.random() * 50) - 3.5;
    if (this.miniT <= 0) {
      this.miniT = 25;
      if (!this.wilds.some((w) => w.miniBoss && w.state !== 'dead') && this.spawnMiniBoss()) this.miniT = 140 + Math.random() * 110;
    }
    const boss = this.wilds.some((w) => w.nightBoss && w.state !== 'dead');
    if (night > 0.6 && !boss && !this.nightBossDone) {
      this.nightBossDone = true;
      this.spawnNightBoss();
    } else if (night < 0.1 && !boss) {
      this.nightBossDone = false; // a new night, a new boss
    }
  }

  spawnPack(type, n, message = null) {
    const { world, player: p, home } = this.g;
    const def = MONSTERS[type];
    const flyer = def.kind === 'fly';
    for (let tries = 0; tries < 6; tries++) {
      const ang = Math.random() * Math.PI * 2;
      const d = 170 + Math.random() * 40;
      const cx = p.x + Math.cos(ang) * d;
      const cy = p.y + Math.sin(ang) * d;
      if (Math.hypot(cx - home.x, cy - home.y) < 160) continue;
      let made = 0;
      for (let i = 0; i < n * 3 && made < n; i++) {
        const x = cx + (Math.random() - 0.5) * 50;
        const y = cy + (Math.random() - 0.5) * 36;
        const tx = Math.floor(x / 16);
        const ty = Math.floor(y / 16);
        if (!flyer && (world.type(tx, ty) === WATER || world.isCleared(tx, ty) || world.isBlocked(x - 4, y - 4, 8, 4))) continue;
        this.wilds.push(this.makeWild(type, x, y, Math.max(1, rollMonsterLevel(this.dayLevel()) - 1)));
        made++;
      }
      if (made) {
        this.g.onToast?.(message || `${type === 'bat' ? '🦇' : '👹'} A swarm of ${made} ${def.name}s is coming for you!`);
        sfx.play('wave');
        return;
      }
    }
  }

  spawnNightBoss() {
    const { world, player: p, home } = this.g;
    const type = pickOf(foesAt(world, p.x, p.y).boss); // always one of the animated characters
    for (let i = 0; i < 10; i++) {
      const ang = Math.random() * Math.PI * 2;
      const x = p.x + Math.cos(ang) * (190 + Math.random() * 40);
      const y = p.y + Math.sin(ang) * (190 + Math.random() * 40);
      if (Math.hypot(x - home.x, y - home.y) < 160) continue;
      if (world.type(Math.floor(x / 16), Math.floor(y / 16)) === WATER || world.isBlocked(x - 6, y - 6, 12, 6)) continue;
      const w = this.makeWild(type, x, y, 8);
      w.hp = w.max = Math.round(w.max * 2.2);
      w.nightBoss = true;
      if (MONSTERS[type].tiny) w.scale = 2;
      this.wilds.push(w);
      this.g.announceBoss('🌑 THE NIGHT BOSS HAS BEEN SUMMONED', `${MONSTERS[type].name} · follow the red arrow · it burns at sunrise`);
      return;
    }
    this.nightBossDone = false; // nowhere to put it; try again
  }

  // A small but tough boss from the region you are in: it never burns away, and it pays well
  spawnMiniBoss() {
    const { world, player: p, home } = this.g;
    const type = pickOf(foesAt(world, p.x, p.y).mini);
    for (let i = 0; i < 10; i++) {
      const ang = Math.random() * Math.PI * 2;
      const x = p.x + Math.cos(ang) * (170 + Math.random() * 40);
      const y = p.y + Math.sin(ang) * (170 + Math.random() * 40);
      if (Math.hypot(x - home.x, y - home.y) < 160) continue;
      if (world.type(Math.floor(x / 16), Math.floor(y / 16)) === WATER || world.isBlocked(x - 6, y - 6, 12, 6)) continue;
      const w = this.makeWild(type, x, y, 6);
      w.hp = w.max = Math.round(w.max * 4.5);
      w.miniBoss = true;
      w.dmgMul = 1.3;
      if (MONSTERS[type].tiny) w.scale = 1.5;
      this.wilds.push(w);
      this.g.announceBoss('⚔️ A MINI BOSS APPEARS', `${MONSTERS[type].name} · small but tough · follow the arrow`);
      return true;
    }
    return false;
  }

  // the tougher the days get, the higher the levels that can show up (and at night, two more)
  dayLevel() {
    return Math.min(10, 1 + (this.g.day - 1) + (this.g.darkness() > 0.5 ? 2 : 0));
  }

  // how much meaner the world is today: grows every day, and again after dark
  threat() {
    return (1 + 0.06 * (this.g.day - 1)) * (1 + 0.4 * this.g.darkness());
  }

  makeWild(type, x, y, lv) {
    const def = MONSTERS[type];
    const hp = Math.max(1, Math.round(def.hp * lvHp(lv) * this.threat()));
    return {
      lv, id: `w${this.nextId++}`, wild: true, type, x, y, hp, max: hp, state: 'move', t: 0,
      anim: Math.random() * 3, face: 1, atk: 0, cd: 0.8, kx: 0, ky: 0, wx: 0, wy: 0, wanderT: 0, phase: Math.random() * 6,
    };
  }

  spawnWild(night) {
    const { world, player: p, home } = this.g;
    for (let i = 0; i < 6; i++) {
      const ang = Math.random() * Math.PI * 2;
      const d = 160 + Math.random() * 80;
      const x = p.x + Math.cos(ang) * d;
      const y = p.y + Math.sin(ang) * d;
      const foes = foesAt(world, x, y);
      const type = pickOf(night ? foes.night : foes.day);
      const def = MONSTERS[type];
      const flyer = def.kind === 'fly';
      if (Math.hypot(x - home.x, y - home.y) < 160) continue;
      const tx = Math.floor(x / 16);
      const ty = Math.floor(y / 16);
      if (!flyer && (world.type(tx, ty) === WATER || world.isCleared(tx, ty) || world.isBlocked(x - 4, y - 4, 8, 4))) continue;
      this.wilds.push(this.makeWild(type, x, y, rollMonsterLevel(this.dayLevel())));
      return;
    }
  }

  // returns false once the creature should be removed
  updateWild(w, dt) {
    const def = MONSTERS[w.type];
    const p = this.g.player;
    const dx = p.x - w.x;
    const dy = p.y - w.y;
    const dist = Math.hypot(dx, dy) || 1;
    w.anim += dt;
    if (w.state === 'dead') return (w.t += dt) < (def.tiny ? 0.85 : 0.5);
    if (!w.nightBoss && dist > (this.g.dungeon ? 3000 : w.miniBoss ? 1400 : 430)) return false;
    if (w.nightBoss && !this.g.dungeon && this.g.darkness() < 0.15) w.burning = true; // sunrise
    if (w.burning) {
      // it burns away in the daylight. Nothing drops from something that burned to death.
      w.hp -= w.max * 0.08 * dt;
      if (Math.random() < dt * 6) this.floaters.push({ x: w.x + (Math.random() - 0.5) * 14, y: w.y - 20, text: '🔥', color: '#ff8a3c', t: 0 });
      if (w.hp <= 0) {
        w.state = 'dead';
        w.t = 0;
        w.burned = true;
        sfx.play('monsterDie');
        this.g.onToast?.('☀️ The night boss burned to ash in the sunlight.');
        return true;
      }
    }
    const flyer = def.kind === 'fly';
    const step = (mx, my) => {
      if (flyer) {
        w.x += mx;
        w.y += my;
      } else {
        this.moveSkeleton(w, mx, my);
      }
    };
    if (w.state === 'hurt') {
      w.swing = null;
      w.t += dt;
      step(w.kx * dt, w.ky * dt);
      w.kx *= 0.9;
      w.ky *= 0.9;
      if (w.t >= 0.25) {
        w.state = 'move';
        w.cd = Math.max(w.cd, 0.3);
      }
      return true;
    }
    if (w.stunT > 0) {
      w.stunT -= dt;
      w.swing = null;
      return true;
    }
    w.cd -= dt;
    w.atk = Math.max(0, w.atk - dt);
    const rng = def.kind === 'shoot' ? def : RANGED_EXTRA[w.type];
    const dark = this.g.darkness();
    const hitNow = Math.max(1, Math.round(def.dmg * (w.dmgMul || 1) * lvDmg(w.lv || 1) * (1 + 0.05 * (this.g.day - 1)) * (1 + 0.5 * dark)));
    const by = { kind: 'monster', id: w.id, name: w.nightBoss ? `the night boss ${def.name}` : w.miniBoss ? `the mini boss ${def.name}` : def.name };
    if (w.swing) {
      // in the middle of an attack: it stands its ground until the animation is done
      this.tickSwing(w, dt);
      return true;
    }
    if (def.tiny && dist < 260 && !this.hidden && !this.g.dead && this.tinySkill(w, def, dt, dist, hitNow, by)) return true;
    if ((w.nightBoss || w.miniBoss || def.skill === 'charge') && this.nightBossSkill(w, def, dt, dist, dx, dy, step)) return true;
    const aggro = Math.max(w.nightBoss || w.miniBoss ? 180 : 100, rng ? rng.range + 24 : 0) + dark * 50;
    if (dist < aggro && !this.hidden && !this.g.dead) {
      w.face = dx >= 0 ? 1 : -1;
      w.dirv = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 3) : dy > 0 ? 0 : 1;
      if (w.slowT > 0) w.slowT -= dt;
      const speed = def.speed * 1.25 * (1 + 0.25 * dark) * (w.slowT > 0 ? 0.45 : 1); // faster in the dark, slower when frozen
      // bats swoop in on a weaving line
      const weave = w.type === 'bat' ? Math.sin(w.anim * 5 + w.phase) * 0.7 : 0;
      const ux = dx / dist;
      const uy = dy / dist;
      if (rng) {
        // ranged: keep a distance and fire from there
        if (dist > rng.range * 0.85) step(ux * speed * dt, uy * speed * dt);
        else if (dist < rng.range * 0.4) step(-ux * speed * 0.7 * dt, -uy * speed * 0.7 * dt);
        if (dist < rng.range && w.cd <= 0) {
          w.cd = rng.rate * (0.8 + Math.random() * 0.4);
          if (def.tiny) this.tinyShoot(w, def, hitNow, by);
          else {
            w.atk = 0.3;
            this.wildShots.push({ x: w.x, y: w.y - 6, vx: ux * 95, vy: uy * 95, life: 1.8, dmg: hitNow, by });
          }
        }
      } else if (dist > (def.reach || 14) * (w.scale || 1)) step((ux - uy * weave) * speed * dt, (uy + ux * weave) * speed * dt);
      else if (w.cd <= 0) {
        w.cd = def.tiny ? 1 + Math.random() * 0.6 : 1.2;
        if (def.tiny) {
          // the blow lands partway through the swing, so you can step out of it
          const reach = (def.reach || 14) * (w.scale || 1) + 8;
          const boss = w.nightBoss || w.miniBoss; // a boss winds up slowly, so the red fan is easy to read and dodge
          this.startSwing(w, pickOf(def.swings), boss ? 1.5 : 0.6, boss ? 0.75 : 0.55, () => {
            w.atk = 0.2;
            if (!this.hidden && !this.g.dead && Math.hypot(this.g.player.x - w.x, this.g.player.y - w.y) <= reach) this.hurtPlayer(hitNow, w.x, w.y, { by });
          }, { warn: 'fan', reach });
        } else {
          w.atk = 0.2;
          this.hurtPlayer(hitNow, w.x, w.y, { by });
        }
      }
    } else {
      w.wanderT -= dt;
      if (w.wanderT <= 0) {
        w.wanderT = 1.5 + Math.random() * 2.5;
        const ang = Math.random() * Math.PI * 2;
        const moving = Math.random() < 0.6;
        w.wx = moving ? Math.cos(ang) * def.speed * 0.4 : 0;
        w.wy = moving ? Math.sin(ang) * def.speed * 0.4 : 0;
      }
      step(w.wx * dt, w.wy * dt);
      if (w.wx) w.face = w.wx >= 0 ? 1 : -1;
      if (w.wx || w.wy) w.dirv = Math.abs(w.wx) > Math.abs(w.wy) ? (w.wx > 0 ? 2 : 3) : w.wy > 0 ? 0 : 1;
    }
    return true;
  }

  // coins that burst out for everyone in the room: whoever touches a piece first takes it
  shareCoins(x, y, total, pieces) {
    const n = Math.min(pieces, total);
    for (let k = 0; k < n; k++) {
      const qty = Math.floor(total / n) + (k < total % n ? 1 : 0);
      const lid = `${this.g.mp?.you ?? 'me'}-c${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}${k}`;
      const a = Math.random() * Math.PI * 2;
      const drop = { x, y: y - 4, z: 8, vx: Math.cos(a) * 30, vy: Math.sin(a) * 18, vz: 110, fly: true, burst: true, id: 'coin', qty, age: 0, net: lid, nopick: 0.4 };
      this.drops.push(drop);
      this.g.mp?.net.send({ t: 'fx', kind: 'loot', lid, x, y: y - 4, qty });
    }
  }

  // ---------- the animated (Tiny RPG) monsters ----------

  // start an attack animation; `act` happens `at` (0..1) of the way through it
  startSwing(w, anim, dur, at, act, extra = null) {
    w.swing = { anim, t: 0, dur, at, act, did: false, ...extra };
    const p = this.g.player;
    w.face = p.x >= w.x ? 1 : -1;
  }

  tickSwing(w, dt) {
    const s = w.swing;
    s.t += dt;
    w.anim += dt;
    if (!s.did && s.t >= s.at * s.dur) {
      s.did = true;
      s.act?.();
    }
    if (s.t >= s.dur) w.swing = null;
  }

  // archers loose an arrow, casters mark the ground where you stand and the spell lands a moment later
  tinyShoot(w, def, dmg, by) {
    const p = this.g.player;
    const slow = w.nightBoss || w.miniBoss ? 1.7 : 1; // bosses give a longer warning
    if (def.cast) {
      const fx = pickOf(def.cast);
      this.spells.push({ x: p.x, y: p.y, t: -def.delay * slow, delay: def.delay * slow, fx, frames: TINY.fx[fx], radius: def.radius, dmg, by, did: false });
      this.startSwing(w, pickOf(def.swings), 0.7 * slow, 0.5, null);
      return;
    }
    this.startSwing(w, 'atk1', 0.65 * slow, 0.6, () => {
      const a = Math.atan2(p.y - 6 - (w.y - 8), p.x - w.x);
      w.atk = 0.2;
      sfx.play('swing', 0.5);
      this.wildShots.push({ x: w.x, y: w.y - 8, vx: Math.cos(a) * 125, vy: Math.sin(a) * 125, life: 1.8, dmg, by, arrow: def.arrow });
    }, { warn: 'line', range: def.range });
  }

  // block, summon and heal: the things a monster does between blows
  tinySkill(w, def, dt, dist, dmg, by) {
    if (!def.skill || def.skill === 'charge') return false;
    w.skT = (w.skT ?? 2 + Math.random() * 4) - dt;
    if (w.skT > 0) return false;
    const wake = (secs) => {
      w.skT = secs + Math.random() * 4;
      return true;
    };
    if (def.skill === 'block') {
      if (dist > 150) return false;
      this.startSwing(w, 'special', 1.1, 1, null, { block: true });
      return wake(5);
    }
    if (def.skill === 'summon') {
      const minions = this.wilds.filter((m) => m.minionOf === w.id && m.state !== 'dead').length;
      if (dist > 240 || minions >= 3) {
        w.skT = 2;
        return false;
      }
      this.startSwing(w, 'special', 0.95, 0.55, () => {
        if (def.tiny === 'necromancer') this.spells.push({ x: w.x, y: w.y, t: 0, fx: 'necro_summon', frames: TINY.fx.necro_summon, fxOnly: true });
        for (let k = 0; k < 2; k++) {
          const m = this.makeWild(MINION, w.x + (k ? 20 : -20), w.y + 4, Math.max(1, (w.lv || 1) - 1));
          m.minionOf = w.id;
          m.cd = 1.2;
          (this.wildQ ||= []).push(m); // (joins the others after this update pass)
        }
        sfx.play('wave', 0.5);
      });
      return wake(14);
    }
    if (def.skill === 'heal') {
      const hurt = this.wilds.filter((m) => m !== w && m.state !== 'dead' && m.hp < m.max * 0.75 && Math.hypot(m.x - w.x, m.y - w.y) < 150);
      if (!hurt.length) {
        w.skT = 2;
        return false;
      }
      this.startSwing(w, 'special', 0.8, 0.5, () => {
        for (const m of hurt) {
          m.hp = Math.min(m.max, m.hp + m.max * 0.3);
          this.spells.push({ x: m.x, y: m.y, t: 0, fx: 'priest_heal', frames: TINY.fx.priest_heal, fxOnly: true });
          this.floaters.push({ x: m.x, y: m.y - 24, text: '+', color: '#8fe28a', t: 0 });
        }
      });
      return wake(8);
    }
    return false;
  }

  updateSpells(dt) {
    const p = this.g.player;
    this.spells = this.spells.filter((s) => {
      s.t += dt;
      if (s.mine && !s.did && s.t >= 0.1) {
        s.did = true;
        for (const m of this.monstersNear(s.x, s.y - 4, s.radius)) {
          this.hitMonster(m, s.dmg, s.x, s.y, 150);
          this.spellEffect(s.effect, 'mon', m, s.dmg, s.x, s.y, true);
        }
        for (const sk of this.skeletons) {
          if (sk.state === 'dead' || Math.hypot(sk.x - s.x, sk.y - s.y) > s.radius + 6) continue;
          this.damageSkeleton(sk, s.dmg, s.x, s.y, 150);
          this.spellEffect(s.effect, 'skel', sk, s.dmg, s.x, s.y, true);
        }
        if (this.g.fight) {
          for (const r of this.g.remotes.values()) {
            if (r.hidden || this.g.sameTeam(r) || Math.hypot(r.x - s.x, r.y - s.y) > s.radius + 6) continue;
            this.hitRemote(r, s.dmg);
          }
        }
        this.chopTrees(s.x, s.y - 4, s.radius * 0.8, Math.max(1.5, s.dmg * 0.8));
      }
      if (!s.mine && !s.fxOnly && !s.did && s.t >= 0.1) {
        s.did = true;
        if (!this.hidden && !this.g.dead && Math.hypot(p.x - s.x, p.y - s.y) <= s.radius) this.hurtPlayer(s.dmg, s.x, s.y, { by: s.by });
      }
      return s.t < s.frames / 12;
    });
  }

  // The night boss winds up a skill with a red mark on the ground, then dashes or spins its blade all round it
  nightBossSkill(w, def, dt, dist, dx, dy, step) {
    const scale = w.scale || def.scale || 1;
    const radius = 30 + 14 * scale;
    const wind = BOSS_WIND * (w.nightBoss || w.miniBoss ? 1.9 : 1.3); // the red mark builds up slowly before the blow
    const who = w.nightBoss ? `the night boss ${def.name}` : w.miniBoss ? `the mini boss ${def.name}` : def.name;
    const hit = (mult) => this.hurtPlayer(Math.max(1, Math.round(def.dmg * (w.dmgMul || 1) * lvDmg(w.lv || 1) * (1 + 0.05 * (this.g.day - 1)) * (1 + 0.5 * this.g.darkness()) * mult)), w.x, w.y, { by: { kind: 'monster', id: w.id, name: who } });
    w.skT = (w.skT ?? 3 + (def.skill === 'charge' ? 3 : 0)) - dt;
    let sk = w.skill;
    if (!sk) {
      if (w.skT > 0 || dist > 190 || this.hidden || this.g.dead) return false;
      w.skill = { kind: (w.nightBoss || w.miniBoss) && Math.random() < 0.5 ? 'spiral' : 'dash', phase: 0, t: 0, prog: 0, ang: Math.atan2(dy, dx), hit: false };
      return true;
    }
    sk.t += dt;
    w.face = Math.cos(sk.ang) >= 0 ? 1 : -1;
    if (sk.phase === 0) {
      sk.prog = Math.min(1, sk.t / wind);
      if (sk.t >= wind) {
        sk.phase = 1;
        sk.t = 0;
        sk.prog = 0;
        w.atk = 0.3;
        if (sk.kind === 'spiral' && dist < radius + 6) hit(1.6);
      }
      return true;
    }
    if (sk.kind === 'dash') {
      sk.prog = Math.min(1, sk.t / 0.4);
      step(Math.cos(sk.ang) * 250 * dt, Math.sin(sk.ang) * 250 * dt);
      if (!sk.hit && dist < 12 + 6 * scale) {
        sk.hit = true;
        hit(1.4);
      }
      w.atk = Math.max(w.atk, 0.1);
      if (sk.t >= 0.4) {
        w.skill = null;
        w.skT = 5 + Math.random() * 4;
      }
    } else {
      sk.prog = Math.min(1, sk.t / 0.35);
      if (sk.t >= 0.35) {
        w.skill = null;
        w.skT = 5 + Math.random() * 4;
      }
    }
    return true;
  }

  damageWild(w, dmg, fromX, fromY, kb) {
    if (w.state === 'dead') return;
    const def = MONSTERS[w.type];
    if (w.swing?.block) {
      dmg *= 0.25;
      this.floaters.push({ x: w.x, y: w.y - 26, text: 'blocked', color: '#9ec7ff', t: 0 });
      sfx.play('block');
    }
    w.hp -= dmg;
    sfx.play(w.hp <= 0 ? 'monsterDie' : 'hit');
    if (w.hp <= 0) {
      w.state = 'dead';
      w.t = 0;
      this.kills++;
      this.g.monsterKill(def.name, Math.round(monsterXp(def.hp, def.boss || w.nightBoss || w.miniBoss) * lvXp(w.lv || 1) * (w.minionOf ? 0.3 : 1)), !!(def.boss || w.nightBoss || w.miniBoss), { x: w.x, y: w.y });
      if (w.miniBoss) {
        // a mini boss is worth the trouble
        this.shareCoins(w.x, w.y, 6 + Math.floor(Math.random() * 6), 3);
        for (const [id, qty] of [['gem', 1], ['gold', 2], ['wood', 3]]) this.drops.push({ x: w.x + (Math.random() - 0.5) * 16, y: w.y + (Math.random() - 0.5) * 8, id, qty, age: 0 });
        this.g.onToast?.(`⚔️ The mini boss ${def.name} is down!`);
      }
      if (w.nightBoss) {
        // slain before dawn: a real prize (the coins can be picked up by everyone in the room)
        this.shareCoins(w.x, w.y, 10 + Math.floor(Math.random() * 8), 4);
        for (const [id, qty] of [['gem', 2], ['gold', 3]]) this.drops.push({ x: w.x + (Math.random() - 0.5) * 16, y: w.y + (Math.random() - 0.5) * 8, id, qty, age: 0 });
      }
      for (const [id, chance, min, max] of w.minionOf ? [] : WILD_LOOT) {
        if (Math.random() < chance) {
          const qty = min + Math.floor(Math.random() * (max - min + 1));
          if (id === 'coin' && this.g.mp) this.shareCoins(w.x, w.y, qty, 1);
          else this.drops.push({ x: w.x + (Math.random() - 0.5) * 12, y: w.y + (Math.random() - 0.5) * 6, id, qty, age: 0 });
        }
      }
      return;
    }
    if (w.nightBoss || w.miniBoss || w.swing?.block) return; // bosses (and a raised guard) are not knocked back or staggered
    const ang = Math.atan2(w.y - fromY, w.x - fromX);
    w.state = 'hurt';
    w.t = 0;
    w.kx = Math.cos(ang) * kb * (def.kb ?? 1);
    w.ky = Math.sin(ang) * kb * (def.kb ?? 1);
  }

  // Wake the camps near you: each one is three skeletons standing side by side on their post
  updateCamps(dt) {
    this.campT += dt;
    this.campScan -= dt;
    if (this.campScan > 0) return;
    this.campScan = 0.6;
    const { world, player: p, home } = this.g;
    const ccx = Math.floor(p.x / CHUNK_PX);
    const ccy = Math.floor(p.y / CHUNK_PX);
    for (let j = -2; j <= 2; j++) {
      for (let i = -2; i <= 2; i++) {
        const key = `${ccx + i},${ccy + j}`;
        const st = this.camps.get(key) || { on: false, killed: 0, until: 0 };
        this.camps.set(key, st);
        if (st.on || st.until > this.campT) continue;
        const camp = world.campAt(ccx + i, ccy + j);
        if (!camp || Math.hypot(camp.x - p.x, camp.y - p.y) > CAMP_WAKE) continue;
        if (Math.hypot(camp.x - home.x, camp.y - home.y) < 320) continue;
        st.on = true;
        st.killed = 0;
        for (const ox of [-16, 0, 16]) {
          this.skeletons.push({
            id: this.nextId++, x: camp.x + ox, y: camp.y, hp: 3, state: 'idle', stateT: 0, anim: Math.random() * 3, face: ox >= 0 ? 1 : -1,
            cd: 0.8, didHit: false, kx: 0, ky: 0, wx: 0, wy: 0, wanderT: 0,
            camp: key, home: { x: camp.x + ox, y: camp.y }, returning: false,
          });
        }
      }
    }
  }

  moveSkeleton(s, dx, dy) {
    const { world } = this.g;
    // skeletons do not go indoors
    if (!world.isBlocked(s.x + dx - 4, s.y - 4, 8, 4) && !world.houseAt(s.x + dx, s.y - 2)) s.x += dx;
    if (!world.isBlocked(s.x - 4, s.y + dy - 4, 8, 4) && !world.houseAt(s.x, s.y + dy - 2)) s.y += dy;
  }

  // returns false once the skeleton should be removed
  updateSkeleton(s, dt) {
    const p = this.g.player;
    const dx = p.x - s.x;
    const dy = p.y - s.y;
    const dist = Math.hypot(dx, dy) || 1;
    s.anim += dt;

    if (s.state === 'dead') {
      s.stateT += dt;
      return s.stateT < 1.6;
    }
    if (s.stunT > 0) {
      s.stunT -= dt;
      return true;
    }
    if (dist > (this.g.dungeon ? 3000 : s.camp ? 650 : 430)) {
      // out of sight and out of mind: the camp resets, fully healed, for the next visit
      if (s.camp) {
        const st = this.camps.get(s.camp);
        if (st) st.on = false;
      }
      return false;
    }

    if (s.state === 'hurt') {
      s.stateT += dt;
      this.moveSkeleton(s, s.kx * dt, s.ky * dt);
      s.kx *= 0.9;
      s.ky *= 0.9;
      if (s.stateT >= 0.44) {
        s.state = 'idle';
        s.cd = 0.3;
      }
      return true;
    }

    if (s.state === 'attack') {
      s.stateT += dt;
      if (!s.didHit && s.stateT >= 0.36) {
        s.didHit = true;
        if (dist < 24) this.hurtPlayer(1, s.x, s.y, { by: { kind: 'skeleton', id: s.id, name: 'a Skeleton' } });
      }
      if (s.stateT >= 0.65) {
        s.state = 'idle';
        s.cd = 1;
      }
      return true;
    }

    s.cd -= dt;
    const aggro = 110 + this.g.darkness() * 60;
    if (s.camp) {
      const hx = s.home.x - s.x;
      const hy = s.home.y - s.y;
      const hd = Math.hypot(hx, hy);
      if (!s.returning && hd > CAMP_LEASH) s.returning = true;
      if (s.returning) {
        // too far from the post: ignore the player, walk home and shake off the damage
        if (hd < 4) {
          s.returning = false;
          s.state = 'idle';
          if (s.hp < 3) {
            s.hp = 3;
            this.floaters.push({ x: s.x, y: s.y - 26, text: 'refreshed', color: '#7fd48f', t: 0 });
          }
        } else {
          this.moveSkeleton(s, (hx / hd) * 40 * dt, (hy / hd) * 40 * dt);
          s.state = 'walk';
          s.face = hx >= 0 ? 1 : -1;
        }
        return true;
      }
    }
    if (dist < aggro && !this.hidden) {
      s.face = dx >= 0 ? 1 : -1;
      if (dist > 17) {
        this.moveSkeleton(s, (dx / dist) * 27 * dt, (dy / dist) * 27 * dt);
        s.state = 'walk';
      } else {
        s.state = 'idle';
        if (s.cd <= 0) {
          s.state = 'attack';
          s.stateT = 0;
          s.didHit = false;
        }
      }
    } else {
      s.wanderT -= dt;
      if (s.wanderT <= 0) {
        s.wanderT = 1.5 + Math.random() * 2.5;
        // guards drift around their post rather than wander off
        const ang = s.camp && Math.hypot(s.home.x - s.x, s.home.y - s.y) > 24 ? Math.atan2(s.home.y - s.y, s.home.x - s.x) : Math.random() * Math.PI * 2;
        const moving = Math.random() < 0.5;
        s.wx = moving ? Math.cos(ang) * 10 : 0;
        s.wy = moving ? Math.sin(ang) * 10 : 0;
      }
      this.moveSkeleton(s, s.wx * dt, s.wy * dt);
      s.state = s.wx || s.wy ? 'walk' : 'idle';
      if (s.wx) s.face = s.wx >= 0 ? 1 : -1;
    }
    return true;
  }

  // where a target's body is, whatever kind it is
  bodyOf(kind, t) {
    return kind === 'mon' ? [t.x, bodyY(t)] : [t.x, t.y - 8];
  }

  alive(kind, t) {
    if (kind === 'rem') return this.g.remotes.has(t.id) && !t.hidden;
    return t.state !== 'dead';
  }

  // one hit from a sword, a flame tick or a lightning arc
  applyHit(kind, t, dmg, cx, cy, kb = 110) {
    if (kind === 'skel') this.damageSkeleton(t, dmg, cx, cy, kb);
    else if (kind === 'mon') this.hitMonster(t, dmg, cx, cy, kb);
    else this.hitRemote(t, dmg);
  }

  // a flame tick: hurts without staggering, unless it finishes the target off
  dotHit(kind, t, dmg, bleed = false) {
    if (kind === 'rem') {
      this.hitRemote(t, dmg);
      return;
    }
    if (t.hp - dmg <= 0) {
      this.applyHit(kind, t, dmg, t.x, t.y, 0);
      return;
    }
    t.hp -= dmg;
    const [x, y] = this.bodyOf(kind, t);
    this.floaters.push({ x, y: y - 14, text: `${bleed ? '🩸' : ''}-${Math.round(dmg * 10) / 10}`, color: bleed ? '#e0384a' : '#ff9a3c', t: 0 });
  }

  updateDots(dt) {
    if (!this.dots.length) return;
    this.dots = this.dots.filter((d) => {
      if (!this.alive(d.kind, d.t)) return false;
      d.wait -= dt;
      if (d.wait <= 0) {
        d.wait += 0.5;
        this.dotHit(d.kind, d.t, d.dmg, d.bleed);
        d.ticks--;
      }
      return d.ticks > 0;
    });
  }

  // what a swing does to one target, with the sword's effect
  strike(kind, t, w, cx, cy, struck) {
    const eff = w?.effect || 'none';
    let dmg = this.meleeDmg();
    const [bx, by] = this.bodyOf(kind, t);
    const bash = eff === 'bash' && Math.random() < 0.3; // the Bone Sword now and then bashes
    if (eff === 'crit' && Math.random() < 0.25) {
      dmg *= 2;
      this.floaters.push({ x: bx, y: by - 22, text: 'CRIT!', color: '#ffc94d', t: 0 });
    }
    this.applyHit(kind, t, dmg, cx, cy, eff === 'knock' || bash ? 300 : 110);
    struck.push({ kind, t, dmg });
    if (bash) {
      if (kind !== 'rem') this.stunTarget(t, 1.3);
      this.floaters.push({ x: bx, y: by - 24, text: 'BASH!', color: '#ffe36b', t: 0 });
      sfx.play('thud', 0.8);
    }
    if (eff === 'bleed' && !this.dots.some((d) => d.t === t)) this.dots.push({ kind, t, ticks: 3, wait: 0.5, dmg: 0.6 + (w.dmg || 0) * 0.15, bleed: true });
    if (eff === 'burn' && !this.dots.some((d) => d.t === t)) this.dots.push({ kind, t, ticks: 3, wait: 0.5, dmg: 0.6 + (w.dmg || 0) * 0.15 });
    if (eff === 'vamp' && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + 0.3);
      const p = this.g.player;
      this.floaters.push({ x: p.x, y: p.y - 34, text: `+${hp100(0.3)}`, color: '#ff5d7a', t: 0 });
    }
  }

  // Chain lightning: every target that was hit sends an arc to the nearest other one
  chain(struck, cx, cy) {
    const pool = [];
    for (const s of this.skeletons) if (s.state !== 'dead') pool.push(['skel', s]);
    for (const m of this.monstersNear(cx, cy, 160)) pool.push(['mon', m]);
    if (this.g.fight) for (const r of this.g.remotes.values()) if (!r.hidden) pool.push(['rem', r]);
    const hitAlready = new Set(struck.map((s) => s.t));
    for (const st of struck) {
      const [ax, ay] = this.bodyOf(st.kind, st.t);
      let best = null;
      let bd = 62;
      for (const [kind, t] of pool) {
        if (hitAlready.has(t)) continue;
        const [bx, by] = this.bodyOf(kind, t);
        const d = Math.hypot(bx - ax, by - ay);
        if (d < bd) {
          bd = d;
          best = [kind, t, bx, by];
        }
      }
      if (!best) continue;
      hitAlready.add(best[1]);
      this.applyHit(best[0], best[1], Math.max(0.5, st.dmg * 0.5), ax, ay, 90);
      this.bolts.push({ x1: ax, y1: ay, x2: best[2], y2: best[3], t: 0, seed: Math.random() * 9 });
    }
  }

  // Cut at the trees in reach. A tree falls after a few hits and leaves a Barricade Box.
  chopTrees(cx, cy, reach, dmg, a = null, arc = 1.3, hitSet = null) {
    for (const o of this.g.world.treesNear(cx, cy, reach)) {
      const key = `t${o.tkey}`;
      if (hitSet?.has(key)) continue;
      if (a !== null) {
        const sx = o.x - cx;
        const sy = o.y - 5 - cy;
        if (Math.hypot(sx, sy) > 14 && Math.abs(wrapAngle(Math.atan2(sy, sx) - a)) >= arc) continue;
      }
      hitSet?.add(key);
      const world = this.g.world;
      const max = world.treeMaxHp(o.tk);
      const left = world.hurtTree(o, dmg);
      this.splat(o.x, o.y - 6, '#a8794a', left > 0 ? 1 : 2, cx, cy);
      sfx.play(left > 0 ? 'thud' : 'chest', 0.7);
      this.floaters.push({ x: o.x, y: o.y - 30, text: left > 0 ? `-${Math.round(dmg * 10) / 10}` : 'timber!', color: '#c9a06a', t: 0 });
      if (left > 0) {
        this.treeBars = this.treeBars.filter((b) => b.key !== o.tkey);
        this.treeBars.push({ key: o.tkey, x: o.x, y: o.y - o.sh * 0.5 - 6, hp: left, max, t: 0 });
      } else {
        this.treeBars = this.treeBars.filter((b) => b.key !== o.tkey);
        if (this.g.wave) {
          this.drops.push({ x: o.x, y: o.y - 2, z: 6, vx: (Math.random() - 0.5) * 30, vy: Math.random() * 14, vz: 90, fly: true, burst: true, id: 'barricade', qty: 1, age: 0 });
          this.g.onToast?.('🪵 The tree fell and left a Barricade Box.');
        } else {
          const logs = { large: 3, medium: 2, sapling: 1, stump: 1 }[o.tk] || 1;
          for (let n = 0; n < logs; n++) this.drops.push({ x: o.x + (n - (logs - 1) / 2) * 5, y: o.y - 2, z: 6, vx: (Math.random() - 0.5) * 50, vy: Math.random() * 18, vz: 90 + Math.random() * 30, fly: true, burst: true, id: 'wood', qty: 1, age: 0 });
          this.g.onToast?.(`🪵 The tree fell: ${logs} wood.`);
        }
      }
    }
  }

  swordHit(a) {
    const w = this.weapon();
    const eff = w?.effect || 'none';
    const arc = eff === 'cleave' ? 2.1 : 1.3; // half the angle the blade covers
    const reach = w ? (w.melee ?? w.reach) : SWORD_REACH;
    const [cx, cy] = this.center();
    const struck = [];
    for (const s of this.skeletons) {
      if (s.state === 'dead') continue;
      const sx = s.x - cx;
      const sy = s.y - 8 - cy;
      const d = Math.hypot(sx, sy);
      if (d <= reach && (d < 12 || Math.abs(wrapAngle(Math.atan2(sy, sx) - a)) < arc)) this.strike('skel', s, w, cx, cy, struck);
    }
    for (const m of this.monstersNear(cx, cy, this.meleeReach() + (reach - SWORD_REACH))) {
      const sc = MONSTERS[m.type].scale || 1;
      const sx = m.x - cx;
      const sy = bodyY(m) - cy;
      if (Math.hypot(sx, sy) < 12 + 4 * sc || Math.abs(wrapAngle(Math.atan2(sy, sx) - a)) < arc) this.strike('mon', m, w, cx, cy, struck);
    }
    if (this.g.fight) {
      for (const r of this.g.remotes.values()) {
        if (r.hidden) continue;
        const sx = r.x - cx;
        const sy = r.y - 8 - cy;
        const d = Math.hypot(sx, sy);
        if (d <= reach && (d < 12 || Math.abs(wrapAngle(Math.atan2(sy, sx) - a)) < arc)) this.strike('rem', r, w, cx, cy, struck);
      }
    }
    for (const b of this.g.balls?.list || []) {
      const sx = b.x - cx;
      const sy = b.y - 5 - cy;
      const d = Math.hypot(sx, sy);
      if (d <= reach + 6 && (d < 12 || Math.abs(wrapAngle(Math.atan2(sy, sx) - a)) < arc)) this.g.balls.hit(b, Math.cos(a), Math.sin(a), 230);
    }
    this.chopTrees(cx, cy, reach, this.meleeDmg(), a, arc);
    if (eff === 'shock' && struck.length) this.chain(struck, cx, cy);
  }

  // ---------- wave monsters ----------

  // Hit a Wave Defense monster. The host applies it; guests ask the host to.
  hitMonster(m, dmg, fx, fy, kb = 110) {
    const sc = m.scale || MONSTERS[m.type].scale || 1;
    this.g.setTarget(m, 'mon');
    this.splat(m.x, m.y, this.hitColor, m.state !== 'dead' && m.hp - dmg <= 0 ? 2 : 1, fx, fy);
    if (m.wild) this.damageWild(m, dmg, fx, fy, kb);
    else this.g.wave.hitMonster(m.id, dmg, fx, fy, kb);
    this.floaters.push({ x: m.x, y: m.y - 10 * sc - 6, text: `-${Math.round(dmg * 10) / 10}`, color: '#ff7a8f', t: 0 });
  }

  // monsters whose body overlaps a circle at (cx, cy)
  monstersNear(cx, cy, reach) {
    const out = [];
    for (const m of [...(this.g.wave?.monsters || []), ...this.wilds]) {
      if (m.state === 'dead') continue;
      const sc = m.scale || MONSTERS[m.type].scale || 1;
      if (Math.hypot(m.x - cx, bodyY(m) - cy) <= reach + 4 * sc) out.push(m);
    }
    return out;
  }

  damageSkeleton(s, dmg, fromX, fromY, knockback = 110) {
    if (s.state === 'dead') return;
    this.g.setTarget(s, 'skel');
    s.hp -= dmg;
    this.splat(s.x, s.y, this.hitColor, s.hp <= 0 ? 2 : 1, fromX, fromY);
    this.floaters.push({ x: s.x, y: s.y - 26, text: `-${Math.round(dmg * 10) / 10}`, color: '#ff7a8f', t: 0 });
    sfx.play(s.hp <= 0 ? 'skeletonDie' : 'hit');
    if (s.hp <= 0) {
      s.state = 'dead';
      s.stateT = 0;
      s.anim = 0;
      this.kills++;
      this.g.monsterKill('Skeleton', s.elite ? 60 : XP.skeleton, false, { x: s.x, y: s.y });
      if (s.camp) {
        const st = this.camps.get(s.camp);
        if (st && ++st.killed >= 3) {
          // the whole camp is down: it is guarded again after a while
          st.on = false;
          st.until = this.campT + CAMP_RESPAWN;
        }
      }
      for (const [id, chance, min, max] of SKELETON_LOOT) {
        if (Math.random() < chance) {
          const qty = min + Math.floor(Math.random() * (max - min + 1));
          this.drops.push({ x: s.x + (Math.random() - 0.5) * 16, y: s.y + (Math.random() - 0.5) * 8, id, qty, age: 0 });
        }
      }
    } else {
      const ang = Math.atan2(s.y - 8 - fromY, s.x - fromX);
      s.state = 'hurt';
      s.stateT = 0;
      s.kx = Math.cos(ang) * knockback;
      s.ky = Math.sin(ang) * knockback;
    }
  }

  // `killer` is another player's id when a fight-mode room is being played; they get the point if this lands the last hit
  // `by` says who did it ({ kind: 'player' | 'monster' | 'skeleton', id, name }) for the "killed by" screen
  hurtPlayer(n, fromX, fromY, { killer = null, invuln = 1.1, by = null, knock = true } = {}) {
    if (this.invuln > 0 || this.hidden) return;
    const p = this.g.player;
    if (!this.g.wave) n *= 1 - 0.06 * this.up('armor'); // Armor upgrade
    if (this.shieldT > 0) {
      this.floaters.push({ x: p.x, y: p.y - 34, text: 'blocked!', color: '#5aaee8', t: 0 });
      sfx.play('block');
      this.invuln = 0.25;
      return;
    }
    if (this.g.mount) {
      // the animal takes the hit for you
      this.g.hurtMount(n);
      this.invuln = Math.max(this.invuln, invuln * 0.7);
      this.splat(p.x, p.y, null, 1, fromX, fromY);
      return;
    }
    this.cancelRecall('Recall cancelled: you got hit.');
    sfx.play('hurt');
    this.hp -= n;
    this.invuln = invuln;
    this.splat(p.x, p.y, null, 1, fromX, fromY);
    this.floaters.push({ x: p.x, y: p.y - 34, text: `-${hp100(n)}`, color: '#ff5d7a', t: 0 });
    const ang = Math.atan2(p.y - fromY, p.x - fromX);
    for (let i = 0; knock && i < 6; i++) {
      const nx = p.x + Math.cos(ang) * 1.5;
      const ny = p.y + Math.sin(ang) * 1.5;
      if (!this.g.blocked(nx, ny)) {
        p.x = nx;
        p.y = ny;
      }
    }
    if (this.hp <= 0) {
      if (killer !== null) this.g.mp?.net.send({ t: 'died', killer });
      this.g.die(by || (killer !== null ? { kind: 'player', id: killer } : null));
    }
  }

  // someone else's sword or thrown item landed on us (relayed by the room server)
  hitByPlayer(m) {
    this.hurtPlayer(m.dmg, m.fx, m.fy, { killer: m.from, invuln: 0.5, by: { kind: 'player', id: m.from } });
  }

  // fight-mode rooms only: damage another hero. They apply it to themselves when the server relays it.
  hitRemote(r, dmg) {
    if (this.g.sameTeam(r)) return; // no friendly fire
    sfx.play('hit');
    if (r.bot) {
      this.g.bots.hurt(r, dmg, 'me', this.g.player.x, this.g.player.y);
      return;
    }
    if (r.ai && this.g.aiSim) {
      // we host the room, so we play its computer players
      this.g.aiSim.hurt(r, dmg, 'me', this.g.player.x, this.g.player.y);
      return;
    }
    this.g.mp.net.send({ t: 'hit', target: r.id, dmg });
    this.splat(r.x, r.y, this.hitColor, 1, this.g.player.x, this.g.player.y);
    this.floaters.push({ x: r.x, y: r.y - 30, text: `-${Math.round(dmg * 10) / 10}`, color: '#ff7a8f', t: 0 });
  }

  // A splash on the floor at (x, y) that sprays out away from where the hit came from and fades after about a second.
  // `tone` null means blood. `power` 1 is a hit, 2 a kill.
  splat(x, y, tone, power = 1, fromX = null, fromY = null) {
    const cols = tone ? [tone, darken(tone, 0.28)] : BLOOD;
    const base = fromX === null ? Math.random() * Math.PI * 2 : Math.atan2(y - fromY, x - fromX);
    const blobs = [{ dx: 0, dy: 0, r: 2 + Math.ceil(power), c: cols[1], h: 0 }];
    const n = Math.round(5 + power * 5);
    for (let i = 0; i < n; i++) {
      const a = fromX === null ? Math.random() * Math.PI * 2 : base + (Math.random() - 0.5) * 2.2;
      const dist = 3 + Math.random() * (5 + power * 5);
      blobs.push({
        dx: Math.cos(a) * dist,
        dy: Math.sin(a) * dist * 0.55,
        r: 1 + Math.floor(Math.random() * (power > 1 ? 3 : 2)),
        c: cols[Math.random() < 0.6 ? 0 : 1],
        h: 3 + Math.random() * 9, // how high it flies on the way down
      });
    }
    const keep = !!this.g.world.apoc;
    this.decals.push({ x, y, t: 0, blobs, keep });
    if (this.decals.length > (keep ? 500 : 90)) this.decals.shift();
  }

  drawDecals(ctx) {
    const g = this.g;
    const hw = g.viewW / 2 + 24;
    const hh = g.viewH / 2 + 24;
    for (const d of this.decals) {
      if (Math.abs(d.x - g.cam.x) > hw || Math.abs(d.y - g.cam.y) > hh) continue; // off screen
      const fly = Math.min(1, d.t / 0.22);
      const spread = 1 - (1 - Math.min(1, d.t / 0.16)) ** 2;
      // lasting blood settles to a slightly darker, steady stain instead of fading
      ctx.globalAlpha = d.keep ? (d.t < 0.4 ? 0.92 : 0.8) : 0.92 * Math.min(1, (SPLAT_LIFE - d.t) / 0.45);
      for (const b of d.blobs) {
        const x = Math.round(d.x + b.dx * spread);
        const y = Math.round(d.y + b.dy * spread - Math.sin(fly * Math.PI) * b.h);
        ctx.fillStyle = b.c;
        ctx.fillRect(x - b.r, y, b.r * 2, Math.max(1, b.r - 1));
        ctx.fillRect(x - b.r + 1, y - 1, b.r * 2 - 2, Math.max(1, b.r));
      }
    }
    ctx.globalAlpha = 1;
  }

  clearEnemies() {
    this.bombs = [];
    this.smokes = [];
    this.skeletons = [];
    this.wilds = [];
    this.wildShots = [];
    this.spells = [];
    this.projectiles = [];
    this.swing = null;
    this.dash = null;
    this.spin = null;
    this.invisT = 0;
    this.hold = null;
    this.trail = [];
    this.shieldT = 0;
  }

  // A shotgun pellet: hits harder at point blank (before the spread scatters), and one-shots any normal enemy
  pelletDmg(p, hp, normal) {
    if (!p.pellet) return p.dmg;
    const near = Math.hypot(p.x - p.ox, p.y - p.oy) < 45;
    const d = p.dmg * (near ? 1.6 : 1);
    return normal ? Math.max(d, hp) : d;
  }

  // a plain enemy: not a boss, not a big brute, and not a high level one
  isNormalFoe(m) {
    const def = MONSTERS[m.type];
    return !def.boss && !m.nightBoss && (def.scale || 1) <= 1 && def.hp <= 8 && (m.lv || 1) <= 4;
  }

  updateProjectile(p, dt) {
    const { world } = this.g;
    p.life -= dt;
    p.rot += dt * 14;

    // move in small steps so a fast throw can't skip over a skeleton or a tree
    const steps = Math.max(1, Math.ceil((Math.hypot(p.vx, p.vy) * dt) / 3));
    for (let i = 0; i < steps; i++) {
      const px = p.x;
      const py = p.y;
      p.x += (p.vx * dt) / steps;
      p.y += (p.vy * dt) / steps;

      for (const s of this.skeletons) {
        if (s.state === 'dead') continue;
        // skeletons are roughly 10 wide by 18 tall, so use an oval around their middle
        const ox = (p.x - s.x) / 8;
        const oy = (p.y - (s.y - 9)) / 12;
        if (ox * ox + oy * oy < 1) {
          if (p.hit?.has(`s${s.id}`)) continue;
          this.hitColor = splatTone(p.id);
          this.damageSkeleton(s, this.pelletDmg(p, s.hp, !s.elite), px, py);
          this.hitColor = null;
          if (p.spell) this.spellHit(p, 'skel', s);
          if (p.pierce > 0) {
            p.pierce--;
            (p.hit ||= new Set()).add(`s${s.id}`);
            continue;
          }
          this.land(p, px, py);
          return false;
        }
      }
      for (const m of [...(this.g.wave?.monsters || []), ...this.wilds]) {
        if (m.state === 'dead' || p.hit?.has(m.id)) continue;
        const sc = MONSTERS[m.type].scale || 1;
        const ox = (p.x - m.x) / (7 * sc + 3);
        const oy = (p.y - bodyY(m)) / (9 * sc + 3);
        if (ox * ox + oy * oy < 1) {
          this.hitColor = splatTone(p.id);
          this.hitMonster(m, this.pelletDmg(p, m.hp, this.isNormalFoe(m)), px, py, 90);
          this.hitColor = null;
          if (p.spell) this.spellHit(p, 'mon', m);
          if (p.pierce > 0) {
            p.pierce--;
            (p.hit ||= new Set()).add(m.id);
            continue; // the plasma bolt flies on
          }
          this.land(p, px, py);
          return false;
        }
      }
      for (const b of this.g.balls?.list || []) {
        if (p.hit?.has(`b${b.i}`) || Math.hypot(p.x - b.x, p.y - (b.y - 5 - b.z)) > 9) continue;
        this.g.balls.hit(b, p.vx, p.vy, 120 + Math.hypot(p.vx, p.vy) * 0.45);
        if (p.pierce > 0 || p.spell) {
          (p.hit ||= new Set()).add(`b${b.i}`);
          continue;
        }
        this.land(p, px, py);
        return false;
      }
      if (this.g.fight) {
        for (const r of this.g.remotes.values()) {
          if (r.hidden || this.g.sameTeam(r)) continue;
          const ox = (p.x - r.x) / 8;
          const oy = (p.y - (r.y - 9)) / 12;
          if (ox * ox + oy * oy < 1) {
            this.hitColor = splatTone(p.id);
            this.hitRemote(r, p.dmg);
            this.hitColor = null;
            if (p.spell) this.spellHit(p, 'rem', r);
            this.land(p, px, py);
            return false;
          }
        }
      }
      // bullets fly straight over the bus, so you can shoot from its roof side at whatever is on the other side
      if (world.isBlocked(p.x - 1, p.y - 1, 2, 2, true, true, p.id === 'bullet')) {
        // (water and lava do not stop a shot: it flies right over them)
        if (p.spell || p.stone) this.chopTrees(p.x, p.y, 7, Math.max(1, p.dmg * 0.9)); // bolts and stones cut at the trees they hit
        this.land(p, px, py);
        return false;
      }
    }
    if (p.life <= 0) {
      this.land(p, p.x, p.y);
      return false;
    }
    return true;
  }

  // a staff bolt connects: its element does its thing
  spellHit(p, kind, t) {
    this.spellEffect(p.spell, kind, t, p.dmg, p.x, p.y);
    if (p.spell === 'fire') {
      // a small burst: whatever stands next to it is singed too
      this.splat(p.x, p.y, '#ff8a3c', 2);
      for (const m of this.monstersNear(p.x, p.y, 24)) if (m !== t) this.hitMonster(m, p.dmg * 0.5, p.x, p.y, 90);
    }
  }

  land(p, x, y) {
    if (p.free) return; // the endless default pebble does not need picking up
    if (this.g.world.type(Math.floor(x / 16), Math.floor(y / 16)) === WATER) {
      // it came down in the water (or the lava)
      this.floaters.push({ x, y: y - 6, text: 'plop', color: '#5ab0d8', t: 0 });
      sfx.play('splat', 0.5);
      return;
    }
    sfx.play(breaksOnImpact(ITEMS[p.id]) ? 'splat' : 'thud', 0.7);
    if (breaksOnImpact(ITEMS[p.id])) {
      this.splat(x, y + 2, splatTone(p.id), 0.8);
      this.floaters.push({ x, y: y - 6, text: 'splat!', color: '#e0a060', t: 0 });
      return;
    }
    this.drops.push({ x, y: y + 4, id: p.id, qty: 1, age: 0 });
  }

  // Loot within reach is pulled towards you, faster the closer it gets and always faster than you can run past it
  magnet(d, dx, dy, dist, dt) {
    if (d.manual || dist > MAGNET_R || dist < 1) return; // (what you dropped yourself stays put until you walk over it)
    const speed = 170 + (MAGNET_R - dist) * 4 + (this.g.sprinting ? 60 : 0);
    const step = Math.min(dist, speed * dt);
    d.x += (dx / dist) * step;
    d.y += (dy / dist) * step;
  }

  updateDrop(d, dt) {
    if (!!d.ins !== !!this.g.inside) return true; // things on your house floor wait there until you are in the house
    d.age += dt;
    if (d.fly) {
      // bursting out of a chest: up, out and down with one small bounce
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.z += d.vz * dt;
      d.vz -= 420 * dt;
      if (d.z <= 0) {
        d.z = 0;
        if (!d.bounced && d.vz < -70) {
          d.bounced = true;
          d.vz *= -0.4;
          d.vx *= 0.35;
          d.vy *= 0.35;
        } else {
          d.fly = false;
          d.age = Math.max(d.age, 0.35); // a moment before it can be picked up
        }
      }
      return true;
    }
    const p = this.g.player;
    const dx = p.x - d.x;
    const dy = p.y - 4 - d.y;
    const dist = Math.hypot(dx, dy);
    if (d.nopick > 0) {
      d.nopick -= dt;
      return true;
    }
    if (d.age < 0.5) return true;
    if (d.id === 'heart') {
      // a health pickup: only taken when there is something to heal
      if (d.age > 40) return false;
      if (this.hp < this.maxHp) this.magnet(d, dx, dy, dist, dt);
      if (this.hp < this.maxHp && dist < 10) {
        this.hp = Math.min(this.maxHp, this.hp + 1);
        this.floaters.push({ x: p.x, y: p.y - 34, text: `+${hp100(1)}`, color: '#ff5d7a', t: 0 });
        sfx.play('heal');
        return false;
      }
      return true;
    }
    if (d.pw) {
      // a power-up: walk into it and it goes off (for everybody in the wave)
      if (d.age > 30) return false;
      if (dist < 8) {
        this.g.mp?.net.send({ t: 'fx', kind: 'grab', lid: d.net });
        this.usePower(d.pw);
        return false;
      }
      return true;
    }
    if (SUPPLY_ITEMS[d.id]) {
      // quick-slot supplies go straight to their own slot
      const key = SUPPLY_ITEMS[d.id];
      this.magnet(d, dx, dy, dist, dt);
      if (dist < 10 && this.g.supplies[key] < SUPPLY_CAP) {
        this.g.supplies[key]++;
        this.floaters.push({ x: p.x, y: p.y - 34, text: `+1 ${ITEMS[d.id].name}`, color: '#6fae6a', t: 0 });
        sfx.play('pickup');
        return false;
      }
      return d.age < 120;
    }
    this.magnet(d, dx, dy, dist, dt);
    if (d.id === 'coin' && dist < 10) {
      this.g.giveCoins(d.qty);
      if (d.net) this.g.mp?.net.send({ t: 'fx', kind: 'grab', lid: d.net }); // so the others' copies disappear
      this.floaters.push({ x: p.x, y: p.y - 34, text: `+${d.qty} 🪙`, color: '#e0a83a', t: 0 });
      sfx.play('coin');
      return false;
    }
    if (d.id === 'wood' && dist < 10) {
      this.g.giveWood(d.qty);
      this.floaters.push({ x: p.x, y: p.y - 34, text: `+${d.qty} 🪵`, color: '#b98650', t: 0 });
      sfx.play('pickup');
      return false;
    }
    if (dist < 10) {
      const left = this.g.stow(d.id, d.qty);
      if (left === 0 && d.net) this.g.mp?.net.send({ t: 'fx', kind: 'grab', lid: d.net }); // so the others' copies disappear
      if (left < d.qty) {
        this.g.emitInventory();
        this.floaters.push({ x: p.x, y: p.y - 34, text: `+${d.qty - left} ${ITEMS[d.id].name}`, color: '#6fae6a', t: 0 });
        sfx.play(d.id === 'coin' ? 'coin' : 'pickup');
      }
      d.qty = left;
      return left > 0;
    }
    return dist < 900;
  }

  // ---------- drawing ----------

  collect(list) {
    for (const s of this.skeletons) list.push({ kind: 'skeleton', s, y: s.y });
    for (const w of this.wilds) list.push({ kind: 'monster', m: w, y: w.y });
    for (const p of this.projectiles) list.push({ kind: 'projectile', p, y: p.y + 6 });
    if (this.thrown) list.push({ kind: 'projectile', p: { id: 'trident', th: this.thrown }, y: this.thrown.y + 6 });
    for (const s of this.wildShots) list.push({ kind: 'projectile', p: { x: s.x, y: s.y, id: 'wshot', arrow: s.arrow, ang: Math.atan2(s.vy, s.vx) }, y: s.y + 6 });
    for (const s of this.spells) list.push({ kind: 'projectile', p: { x: s.x, y: s.y, id: 'spell', s }, y: s.y + 1 });
    for (const sm of this.smokes) list.push({ kind: 'projectile', p: { x: sm.x, y: sm.y, id: 'smoke', sm }, y: sm.y + 30 });
    for (const b of this.bombs) list.push({ kind: 'projectile', p: { x: b.x, y: b.y, id: 'bomb', b }, y: b.y + 6 });
    for (const bl of this.blasts) list.push({ kind: 'projectile', p: { x: bl.x, y: bl.y, id: 'blast', bl }, y: bl.y + 40 });
    for (const p of this.remoteShots) list.push({ kind: 'projectile', p, y: p.y + 6 });
    for (const d of this.drops) if (!d.ins) list.push({ kind: 'drop', d, y: d.y });
    if (this.swing) list.push({ kind: 'swing', y: this.g.player.y + 0.5 });
    if (this.spin) list.push({ kind: 'spin', y: this.g.player.y + 0.5 });
    if (this.shieldT > 0) list.push({ kind: 'shield', y: this.g.player.y + 0.6 });
    for (const tr of this.trail) list.push({ kind: 'ghost', tr, y: tr.y - 0.1 });
  }

  drawShield(ctx, x, y, left) {
    // blinks in the last moments so the end of the shield is easy to see
    const alpha = left > 0.8 ? 1 : Math.sin(this.g.t * 30) > 0 ? 1 : 0.35;
    const wobble = Math.sin(this.g.t * 5) * 0.8;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.ellipse(x, y - 12, 13 + wobble, 18 - wobble, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(140,205,255,0.24)';
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(236,248,255,0.95)';
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x, y - 12, 9, 13, 0, Math.PI * 1.15, Math.PI * 1.6);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.stroke();
    ctx.restore();
  }

  drawIcon(ctx, id, x, y, rot = 0) {
    const icon = iconOf(id);
    const image = this.img[icon.file];
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (rot) ctx.rotate(rot);
    ctx.drawImage(image, icon.sx, icon.sy, icon.sw, icon.sh, -icon.sw / 2, -icon.sh / 2, icon.sw, icon.sh);
    ctx.restore();
  }

  drawEntity(ctx, o, t) {
    if (o.kind === 'skeleton') this.drawSkeleton(ctx, o.s);
    else if (o.kind === 'projectile' && o.p.id === 'bullet' && (o.p.plasma || o.p.pl)) {
      // a plasma bolt: a glowing blue streak
      ctx.save();
      ctx.translate(Math.round(o.p.x), Math.round(o.p.y - 8));
      ctx.rotate(Math.atan2(o.p.vy, o.p.vx));
      ctx.fillStyle = 'rgba(80,170,255,0.35)';
      ctx.fillRect(-12, -3, 16, 6);
      ctx.fillStyle = '#5fc4ff';
      ctx.fillRect(-9, -1.5, 11, 3);
      ctx.fillStyle = '#e6faff';
      ctx.fillRect(-4, -0.8, 7, 1.6);
      ctx.restore();
    } else if (o.kind === 'projectile' && o.p.id === 'bullet') {
      // a bright tracer along the way it is flying
      ctx.save();
      ctx.translate(Math.round(o.p.x), Math.round(o.p.y - 8));
      ctx.rotate(Math.atan2(o.p.vy, o.p.vx));
      ctx.fillStyle = '#ffb62e';
      ctx.fillRect(-9, -0.5, 4, 1);
      ctx.fillStyle = '#fff3b0';
      ctx.fillRect(-5, -0.7, 7, 1.4);
      ctx.restore();
    } else if (o.kind === 'projectile' && o.p.id === 'bomb') {
      // the red circle on the ground: it fills up until the blast, and flashes at the end (like a boss skill's warning)
      const b = o.p.b;
      const f = 1 - Math.max(0, b.fuse) / b.max;
      const flash = f > 0.7 && Math.sin(t * 40) > 0 ? 0.25 : 0;
      const air = b.fly > 0 && !b.stuck;
      ctx.save();
      ctx.translate(Math.round(air ? b.tx : b.x), Math.round((air ? b.ty : b.y) + 2));
      const tone = b.kind === 'stun' ? '70,150,255' : b.kind === 'smoke' ? '190,196,210' : '255,30,30';
      ctx.fillStyle = `rgba(${tone},${0.12 + flash})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, b.R, b.R * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(${tone},${0.3 + 0.3 * f})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, b.R * f, b.R * 0.8 * f, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(${b.kind === 'stun' ? '110,180,255' : b.kind === 'smoke' ? '220,224,235' : '255,70,70'},0.95)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, b.R, b.R * 0.8, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      const lift = air ? Math.sin((1 - b.fly / b.flightMax) * Math.PI) * Math.min(22, b.dist * 0.3) : 0; // an arc through the air
      this.drawIcon(ctx, b.item || 'truffle', b.x, b.y - 4 - lift + (f > 0.7 && Math.sin(t * 40) > 0 ? -1 : 0), air ? t * 12 : 0);
    } else if (o.kind === 'projectile' && o.p.id === 'blast') {
      const bl = o.p.bl;
      const p = bl.t / 0.45;
      ctx.save();
      ctx.translate(Math.round(bl.x), Math.round(bl.y - 6));
      ctx.fillStyle = bl.tone === 'stun' ? `rgba(150,200,255,${0.75 * (1 - p)})` : `rgba(255,200,90,${0.75 * (1 - p)})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, bl.R * (0.35 + 0.65 * p), bl.R * 0.8 * (0.35 + 0.65 * p), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${0.9 * (1 - p)})`;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = bl.tone === 'stun' ? `rgba(255,255,200,${0.85 * (1 - p)})` : `rgba(255,120,40,${0.8 * (1 - p)})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, bl.R * 0.4 * (1 - p * 0.4), bl.R * 0.32 * (1 - p * 0.4), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (o.kind === 'projectile' && o.p.id === 'smoke') {
      // a cloud of soft grey puffs that thickens, drifts and thins out at the end
      const sm = o.p.sm;
      const fade = Math.min(1, sm.t / 0.6) * Math.min(1, (sm.life - sm.t) / 1.5);
      ctx.save();
      for (let i = 0; i < 16; i++) {
        const ang = i * 2.4 + sm.t * 0.25 * (i % 2 ? 1 : -1);
        const rr = sm.R * (0.25 + 0.6 * ((i * 37) % 10) / 10);
        const x = sm.x + Math.cos(ang) * rr;
        const y = sm.y - 6 + Math.sin(ang) * rr * 0.6 - Math.sin(sm.t * 1.5 + i) * 2;
        ctx.globalAlpha = 0.5 * fade;
        ctx.fillStyle = i % 3 ? '#dfe3ea' : '#b9bfcb';
        ctx.beginPath();
        ctx.arc(Math.round(x), Math.round(y), 9 + (i % 4) * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (o.kind === 'projectile' && o.p.id === 'spell') {
      const s = o.p.s;
      if (s.t < 0) {
        // the warning: a red ring on the ground that fills up
        const k = 1 + s.t / s.delay;
        ctx.save();
        ctx.globalAlpha = s.mine ? 0.15 + 0.3 * k : 1;
        ctx.fillStyle = s.mine ? s.color : `rgba(255,60,60,${0.1 + 0.25 * k})`;
        ctx.beginPath();
        ctx.ellipse(Math.round(s.x), Math.round(s.y), s.radius, s.radius * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = s.mine ? s.color : `rgba(255,90,70,${0.5 + 0.4 * k})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      } else {
        const f = Math.min(s.frames - 1, Math.floor(s.t * 12));
        ctx.save();
        if (s.hue) ctx.filter = `hue-rotate(${s.hue}deg)`;
        const k = s.mine ? s.radius / 26 : 1;
        ctx.drawImage(this.img[`tiny/fx_${s.fx}`], f * 100, 0, 100, 100, Math.round(s.x - 50 * k), Math.round(s.y - 57 * k), 100 * k, 100 * k);
        ctx.restore();
      }
    } else if (o.kind === 'projectile' && o.p.id === 'trident') {
      const th = o.p.th;
      const icon = this.img[weaponIconFile(weaponById(th.w))];
      ctx.save();
      ctx.translate(Math.round(th.x), Math.round(th.y));
      ctx.rotate(th.rot + Math.PI / 4);
      ctx.drawImage(icon, -16, -16);
      ctx.restore();
    } else if (o.kind === 'projectile' && o.p.spell) {
      // a bolt of magic: a bright core in a soft glow
      const x = Math.round(o.p.x);
      const y = Math.round(o.p.y);
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = o.p.color;
      ctx.beginPath();
      ctx.arc(x, y, 6 + Math.sin(t * 20) * 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - 1, y - 1, 2, 2);
      ctx.restore();
    } else if (o.kind === 'projectile' && o.p.stone) {
      ctx.fillStyle = 'rgba(40,30,20,0.25)';
      ctx.fillRect(Math.round(o.p.x) - 2, Math.round(o.p.y) + 4, 4, 1);
      ctx.fillStyle = '#b9aea0';
      ctx.fillRect(Math.round(o.p.x) - 1, Math.round(o.p.y) - 2, 3, 3);
      ctx.fillStyle = '#e6ddd0';
      ctx.fillRect(Math.round(o.p.x) - 1, Math.round(o.p.y) - 2, 1, 1);
    } else if (o.kind === 'projectile' && o.p.id === 'wshot' && o.p.arrow) {
      ctx.save();
      ctx.translate(Math.round(o.p.x), Math.round(o.p.y));
      ctx.rotate(o.p.ang);
      ctx.drawImage(this.img[`tiny/arrow${o.p.arrow}`], -16, -16);
      ctx.restore();
    } else if (o.kind === 'projectile' && o.p.id === 'wshot') {
      // a monster's spit: a small glowing green orb
      ctx.fillStyle = 'rgba(140,230,90,0.35)';
      ctx.beginPath();
      ctx.arc(Math.round(o.p.x), Math.round(o.p.y - 2), 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#b6f26a';
      ctx.fillRect(Math.round(o.p.x) - 1, Math.round(o.p.y - 2) - 1, 3, 3);
    } else if (o.kind === 'projectile') this.drawIcon(ctx, o.p.id, o.p.x, o.p.y - 8, o.p.rot);
    else if (o.kind === 'drop') this.drawDrop(ctx, o.d, t);
    else if (o.kind === 'swing') this.drawSwing(ctx);
    else if (o.kind === 'spin') this.drawSpin(ctx);
    else if (o.kind === 'shield') this.drawShield(ctx, this.g.player.x, this.g.player.y, this.shieldT);
    else if (o.kind === 'ghost') {
      // fading afterimage along the dash path
      ctx.globalAlpha = 0.35 * (1 - o.tr.t / 0.22);
      drawHero(ctx, this.img, this.g.hero, o.tr.dir, true, this.g.t, o.tr.x, o.tr.y);
      ctx.globalAlpha = 1;
    }
  }

  drawDrop(ctx, d, t) {
    ctx.fillStyle = 'rgba(60,40,30,0.2)';
    ctx.fillRect(Math.round(d.x - 3), Math.round(d.y), 6, 2);
    if (d.pw) {
      // a glowing orb that bobs, and blinks when it is about to fade
      if (d.age > 24 && Math.sin(t * 16) > 0) return;
      const p = POWERS[d.pw];
      const y = Math.round(d.y - 9 + Math.sin(t * 4) * 2);
      const r = 7 + Math.sin(t * 6) * 1.2;
      ctx.fillStyle = `${p.color}55`;
      ctx.beginPath();
      ctx.arc(Math.round(d.x), y, r + 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(Math.round(d.x), y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.icon, Math.round(d.x), y + 1);
      return;
    }
    if (d.id === 'heart' && this.g.world.apoc) {
      // Survival: the health pickup is a bandage
      if (d.age > 32 && Math.sin(t * 16) > 0) return;
      const bandage = this.img['apoc/pick_bandage'];
      ctx.drawImage(bandage, Math.round(d.x - bandage.width / 2), Math.round(d.y - bandage.height - 2 + Math.sin(t * 4 + d.x) * 1.2));
      return;
    }
    if (d.id === 'heart') {
      // a little pixel heart that bobs, and blinks when it is about to disappear
      if (d.age > 32 && Math.sin(t * 16) > 0) return;
      const x = Math.round(d.x - 4);
      const y = Math.round(d.y - 9 + Math.sin(t * 4 + d.x) * 1.2);
      const rows = ['.xx.xx.', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...'];
      rows.forEach((row, j) => {
        for (let i = 0; i < row.length; i++) {
          if (row[i] !== 'x') continue;
          ctx.fillStyle = j === 1 && i === 1 ? '#ffb3c2' : '#ee4a68';
          ctx.fillRect(x + i, y + j, 1, 1);
        }
      });
      ctx.fillStyle = '#a82846';
      ctx.fillRect(x + 3, y + 5, 1, 1);
      return;
    }
    const ly = d.y - 4 - (d.z || 0) + (d.fly ? 0 : Math.sin(t * 4 + d.x) * 1.2);
    if (d.id !== 'coin' && ITEMS[d.id]) this.drawRarityFrame(ctx, d.id, d.x, ly);
    this.drawIcon(ctx, d.id, d.x, ly);
  }

  // a small box around a dropped item, in its rarity's colour (the rarer, the brighter it glows)
  drawRarityFrame(ctx, id, x, y) {
    const tier = rarityOf(id);
    const icon = iconOf(id);
    const w = Math.max(icon.sw, 8) + 4;
    const h = Math.max(icon.sh, 8) + 4;
    const color = RARITIES[tier].color;
    ctx.save();
    if (tier === 'epic' || tier === 'legendary') {
      ctx.shadowColor = color;
      ctx.shadowBlur = tier === 'legendary' ? 7 : 5;
    }
    ctx.fillStyle = `${color}33`;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(Math.round(x - w / 2) + 0.5, Math.round(y - h / 2) + 0.5, w, h, 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // little stars circling a stunned head
  drawStun(ctx, x, y, color = '#ffe36b') {
    const t = this.g.t;
    ctx.save();
    ctx.fillStyle = color;
    for (let i = 0; i < 3; i++) {
      const a = t * 5 + (i * Math.PI * 2) / 3;
      ctx.fillRect(Math.round(x + Math.cos(a) * 7) - 1, Math.round(y + Math.sin(a) * 2.5) - 1, 3, 3);
    }
    ctx.restore();
  }

  drawSkeleton(ctx, s) {
    const key = s.state === 'dead' ? 'death' : s.state;
    const anim = ANIMS[key];
    const sheet = this.img[`skeleton_${key}`];
    const time = ['idle', 'walk'].includes(key) ? s.anim : s.stateT;
    const frame = anim.loop ? Math.floor(time * anim.fps) % anim.n : Math.min(anim.n - 1, Math.floor(time * anim.fps));
    const x = Math.round(s.x);
    const y = Math.round(s.y);

    ctx.fillStyle = 'rgba(60,40,30,0.22)';
    ctx.fillRect(x - 5, y - 1, 10, 3);
    ctx.save();
    if (s.state === 'dead') ctx.globalAlpha = Math.max(0, Math.min(1, (1.6 - s.stateT) / 0.5));
    ctx.translate(x, y - FEET_Y);
    if (s.face < 0) ctx.scale(-1, 1);
    ctx.drawImage(sheet, frame * FRAME_W, 0, FRAME_W, FRAME_H, -FEET_X, 0, FRAME_W, FRAME_H);
    ctx.restore();

    if (s.state !== 'dead' && s.stunT > 0) this.drawStun(ctx, x, y - 26, s.stunColor);
    if (s.state !== 'dead') {
      ctx.fillStyle = 'rgba(60,40,30,0.7)';
      ctx.fillRect(x - 7, y - 24, 14, 3);
      ctx.fillStyle = '#ff7a8f';
      ctx.fillRect(x - 6, y - 23, Math.round(12 * (s.hp / 3)), 1);
      if (!s.lv) s.lv = Math.min(10, rollMonsterLevel(Math.min(10, 1 + Math.floor(this.g.day / 2))) + (s.elite ? 3 : 0));
      this.g.drawLevelTag(ctx, s, x, y, y - 27);
    }
  }

  // A bright whirl: a glowing sweep that follows three big blades round the hero, inside a ring showing the reach
  drawSpin(ctx) {
    this.drawSpinAt(ctx, ...this.center(), this.spin);
  }

  // the whirl around (cx, cy): yours, or another player's (their sp = { t, dur, a0, r })
  drawSpinAt(ctx, cx, cy, sp) {
    const k = Math.min(1, sp.t / sp.dur);
    const swept = k * Math.PI * 2;
    const fade = k > 0.8 ? (1 - k) / 0.2 : 1;
    ctx.save();
    ctx.globalAlpha = fade;
    // the sweep: a pie slice that brightens towards the leading edge
    const lead = sp.a0 + swept * 1.5;
    ctx.fillStyle = 'rgba(255,240,170,0.28)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, sp.r, sp.a0, sp.a0 + swept);
    ctx.closePath();
    ctx.fill();
    // thick trailing arcs
    ctx.lineCap = 'round';
    for (const [w, a, col] of [[5, 0.35, '255,210,90'], [3, 0.85, '255,255,255']]) {
      ctx.strokeStyle = `rgba(${col},${a})`;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.arc(cx, cy, sp.r * 0.92, sp.a0 + swept * 0.5, sp.a0 + swept);
      ctx.stroke();
    }
    // the reach ring
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, sp.r, 0, Math.PI * 2);
    ctx.stroke();
    // three blades, each with a short ghost trail behind it
    for (let i = 0; i < 3; i++) {
      for (let g = 3; g >= 0; g--) {
        const ang = lead + (i * Math.PI * 2) / 3 - g * 0.22;
        ctx.save();
        ctx.globalAlpha = fade * (g === 0 ? 1 : 0.22 * (4 - g) / 3);
        // the blade is about 20px long once scaled, so its tip lands on the ring
        ctx.translate(cx + Math.cos(ang) * (sp.r - 11), cy + Math.sin(ang) * (sp.r - 11));
        ctx.scale(1.5, 1.5);
        if (this.g.world.apoc) {
          ctx.rotate(ang + (Math.PI * 3) / 4);
          ctx.drawImage(this.img['apoc/bat'], -10, -11);
        } else {
          ctx.rotate(ang + Math.PI / 4);
          ctx.drawImage(this.img.sword, -2, -12);
        }
        ctx.restore();
      }
    }
    ctx.restore();
  }

  drawSwing(ctx) {
    const [cx, cy] = this.center();
    this.drawSwingAt(ctx, cx, cy, this.swing);
    this.drawBolts(ctx);
  }

  // chain lightning: a jagged line from one target to the next
  drawBolts(ctx) {
    for (const b of this.bolts) {
      const k = 1 - b.t / 0.22;
      ctx.save();
      ctx.globalAlpha = Math.min(1, k * 1.6);
      for (const [col, wd] of [['#79c8ff', 3], ['#ffffff', 1]]) {
        ctx.strokeStyle = col;
        ctx.lineWidth = wd;
        ctx.beginPath();
        ctx.moveTo(b.x1, b.y1);
        const n = 5;
        for (let i = 1; i < n; i++) {
          const f = i / n;
          const j = Math.sin(b.seed * 7 + i * 5 + b.t * 40) * 4;
          ctx.lineTo(b.x1 + (b.x2 - b.x1) * f + j, b.y1 + (b.y2 - b.y1) * f - j);
        }
        ctx.lineTo(b.x2, b.y2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // also used for other players' swings in multiplayer
  drawSwingAt(ctx, cx, cy, sw) {
    const k = sw.t / 0.24;
    const w = this.g.world.apoc && !sw.w ? null : weaponById(sw.w);
    // the trail is wider and longer with a higher level, and shaped by the kind of sword
    const lvl = 1 + Math.min(1, 0.04 * ((sw.lv || this.g.level || 1) - 1));
    const sweep = w ? (w.effect === 'cleave' ? 1.8 : w.id === 'rapier' ? 0.8 : w.effect === 'knock' ? 1.3 : 1.1) : 1.1;
    const width = (w ? (w.effect === 'cleave' ? 4.6 : w.effect === 'knock' ? 4 : w.id === 'rapier' ? 1.9 : 3) : 3) * lvl;
    const radius = (w ? 14 + 0.16 * (w.melee ?? w.reach) : 19) * lvl;
    const tint = w ? w.tint : '#ffffff';
    const ang = sw.a - sweep + 2 * sweep * k;
    // trail: a soft coloured glow, a brighter band, and a thin white core
    ctx.save();
    ctx.lineCap = 'round';
    const fade = Math.min(1, (1 - k) * 1.3);
    for (const [col, wd, al] of [[tint, width * 2.2, 0.4], [tint, width * 1.3, 0.85], ['#ffffff', Math.max(1, width * 0.5), 1]]) {
      ctx.globalAlpha = al * fade;
      ctx.strokeStyle = col;
      ctx.lineWidth = wd;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, sw.a - sweep, ang);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.translate(cx + Math.cos(ang) * 4, cy + Math.sin(ang) * 4);
    if (this.g.world.apoc) {
      // Survival swings a baseball bat. Its picture points up-left, handle bottom-right.
      ctx.rotate(ang + (Math.PI * 3) / 4);
      ctx.drawImage(this.img['apoc/bat'], -10, -11);
    } else {
      // blade: the icon points up-right, so spin it by +45 degrees around the hilt
      ctx.rotate(ang + Math.PI / 4);
      const icon = this.img[weaponIconFile(w)];
      const s = 0.62;
      ctx.drawImage(icon, -3 * s, -29 * s, 32 * s, 32 * s);
    }
    ctx.restore();
  }

  // Progress bar under the hero while the left button is held. The notch marks where a dash unlocks.
  drawChargeBar(ctx, camX, camY, zoom, t) {
    const wk = this.weapon()?.kind;
    if (!this.g.wave && this.hold && this.hold.t >= HOLD_MIN * 0.8 && (wk === 'trident' || wk === 'sling')) {
      // where the trident would land: a line from the hero to the cursor, cut off at its range
      const w = this.weapon();
      const [cx, cy] = this.center();
      const a = this.aim();
      const range = this.tridentRange(w, this.hold.t);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,250,240,0.85)';
      ctx.lineWidth = zoom * 0.9;
      ctx.setLineDash([zoom * 2.4, zoom * 2]);
      ctx.beginPath();
      ctx.moveTo((cx - camX) * zoom, (cy - camY) * zoom);
      ctx.lineTo((cx + Math.cos(a) * range - camX) * zoom, (cy + Math.sin(a) * range - camY) * zoom);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = this.hold.t >= 1.1 ? '#fff0a8' : w.tint;
      ctx.beginPath();
      ctx.arc((cx + Math.cos(a) * range - camX) * zoom, (cy + Math.sin(a) * range - camY) * zoom, zoom * 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    if (wk === 'staff' && this.hold && this.hold.t >= HOLD_MIN * 0.5) {
      // where the spell would land, and how big it grows the longer you hold
      const w = this.weapon();
      const [cx, cy] = this.center();
      const m = this.g.mouseWorld();
      const d = Math.hypot(m.x - cx, m.y - cy) || 1;
      const k = Math.min(1, (w.reach * 1.05) / d);
      const power = Math.min(1, Math.max(0, (this.hold.t - HOLD_MIN) / CHARGE_TIME));
      const r = 20 + 16 * power;
      ctx.save();
      ctx.strokeStyle = w.spell.color;
      ctx.lineWidth = zoom * 0.9;
      ctx.setLineDash([zoom * 2, zoom * 1.6]);
      ctx.beginPath();
      ctx.ellipse((cx + (m.x - cx) * k - camX) * zoom, (cy + (m.y - cy) * k + 8 - camY) * zoom, r * zoom, r * 0.55 * zoom, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    const held = this.skillHold || (this.g.wave ? this.hold : null);
    if (!held || held.t < 0.12 || this.dash || this.spin || !this.g.activeSkill()) return;
    const total = HOLD_MIN + CHARGE_TIME;
    const frac = Math.min(1, held.t / total);
    const unlock = this.skillHold ? 0 : HOLD_MIN / total;
    const ready = this.skillHold ? true : held.t >= HOLD_MIN;
    const full = frac >= 1;
    const p = this.g.player;
    const w = zoom * 26;
    const h = zoom * 3.4;
    const x = (p.x - camX) * zoom - w / 2;
    const y = (p.y + 7 - camY) * zoom;

    ctx.save();
    ctx.fillStyle = 'rgba(255,250,240,0.92)';
    ctx.beginPath();
    ctx.roundRect(x - zoom, y - zoom, w + zoom * 2, h + zoom * 2, h);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(x, y, Math.max(h, w * frac), h, h / 2);
    ctx.fillStyle = full && Math.sin(t * 24) > 0 ? '#fff0a8' : ready ? '#ffc94d' : '#f6a9bd';
    ctx.fill();
    ctx.fillStyle = 'rgba(91,70,54,0.55)';
    ctx.fillRect(x + w * unlock - zoom * 0.4, y - zoom * 0.5, zoom * 0.8, h + zoom);
    ctx.font = `700 ${zoom * 3.6}px "Pixelify Sans", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.lineWidth = zoom;
    ctx.strokeStyle = 'rgba(255,250,240,0.95)';
    const word = this.g.activeSkill() === 'spiral' ? 'spin' : 'dash';
    const label = full ? `${word.toUpperCase()}! (release)` : ready ? `Release to ${word}` : 'Hold…';
    ctx.strokeText(label, x + w / 2, y + h + zoom * 2);
    ctx.fillStyle = ready ? '#c47a00' : '#8d735f';
    ctx.fillText(label, x + w / 2, y + h + zoom * 2);
    ctx.restore();
  }

  // Progress while channelling the recall spell
  drawRecallBar(ctx, camX, camY, zoom) {
    if (this.recallT <= 0) return;
    const p = this.g.player;
    const frac = 1 - this.recallT / RECALL_TIME;
    const w = zoom * 30;
    const h = zoom * 3.4;
    const x = (p.x - camX) * zoom - w / 2;
    const y = (p.y + 7 - camY) * zoom;
    ctx.save();
    ctx.fillStyle = 'rgba(255,250,240,0.92)';
    ctx.beginPath();
    ctx.roundRect(x - zoom, y - zoom, w + zoom * 2, h + zoom * 2, h);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(x, y, Math.max(h, w * frac), h, h / 2);
    ctx.fillStyle = '#8fd0ff';
    ctx.fill();
    ctx.font = `700 ${zoom * 3.6}px "Pixelify Sans", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.lineWidth = zoom;
    ctx.strokeStyle = 'rgba(255,250,240,0.95)';
    ctx.strokeText('Recalling… stand still', x + w / 2, y + h + zoom * 2);
    ctx.fillStyle = '#2d78b0';
    ctx.fillText('Recalling… stand still', x + w / 2, y + h + zoom * 2);
    ctx.restore();
  }

  drawOverlay(ctx, camX, camY, zoom, t) {
    // a tree you have hit shows how much wood it has left
    this.treeBars = this.treeBars.filter((b) => (b.t += 1 / 60) < 3);
    for (const b of this.treeBars) {
      const sx = (b.x - camX) * zoom;
      const sy = (b.y - camY) * zoom;
      const w = zoom * 14;
      ctx.fillStyle = 'rgba(40,24,20,0.8)';
      ctx.fillRect(sx - w / 2 - 1, sy - 1, w + 2, zoom * 2.2 + 2);
      ctx.fillStyle = '#c9a06a';
      ctx.fillRect(sx - w / 2, sy, w * Math.max(0.05, b.hp / b.max), zoom * 2.2);
    }
    // floating numbers
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${zoom * 4.5}px "Pixelify Sans", monospace`;
    for (const f of this.floaters) {
      const sx = (f.x - camX) * zoom;
      const sy = (f.y - f.t * 14 - camY) * zoom;
      ctx.globalAlpha = Math.min(1, (1 - f.t) * 2);
      ctx.lineWidth = zoom;
      ctx.strokeStyle = 'rgba(255,250,240,0.95)';
      ctx.strokeText(f.text, sx, sy);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, sx, sy);
    }
    ctx.globalAlpha = 1;

    this.drawChargeBar(ctx, camX, camY, zoom, t);
    this.drawRecallBar(ctx, camX, camY, zoom);

    // aim chevron just ahead of the hero
    const a = this.aim();
    const [cx, cy] = this.center();
    const sx = (cx + Math.cos(a) * 22 - camX) * zoom;
    const sy = (cy + Math.sin(a) * 22 - camY) * zoom;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(a);
    ctx.fillStyle = `rgba(238,124,152,${0.55 + 0.25 * Math.sin(t * 6)})`;
    const u = zoom * 2;
    ctx.beginPath();
    ctx.moveTo(u, 0);
    ctx.lineTo(-u * 0.7, -u * 0.8);
    ctx.lineTo(-u * 0.7, u * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
