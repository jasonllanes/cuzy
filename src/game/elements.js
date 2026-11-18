import { PAL } from '../pixelfx/core/index.js';
import { bakedLoop, drawBaked } from './pfx';
import { sfx } from './sfx';

// The Elemental Lands: no swords, no guns. You pick an element and level up its six skills:
//   left click = Bolt (hold to keep firing) · Space tap = Dash · R = Block · Q and E = the element's own skills · X = the Ultimate
//   hold Space (stand still) = gather mana, like a ninja
// Everything you see is pixelfx. Mana is spent on skills and comes back slowly, quickly while you charge, or from potions the critters drop.

const AIR_PAL = ['#10303a', '#1d5a66', '#2f8c94', '#5cc6c0', '#9ae6dc', '#d2fbf2', '#effffa', '#ffffff'];
const TAU = Math.PI * 2;
const hexRgb = (h) => {
  const n = parseInt(String(h).slice(1), 16) || 0xff5050;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rnd = (a, b) => a + Math.random() * (b - a);
const seed = () => 1 + Math.floor(Math.random() * 50);

export const SKILL_KEYS = ['shoot', 'dash', 'block', 'a', 'b', 'ult'];
export const SKILL_LABEL = { shoot: 'L-Click', dash: 'R-Click', block: '1', a: '2', b: '3', ult: '4' };
const MAX_LV = { shoot: 1, dash: 1, block: 5, a: 5, b: 5, ult: 3 };
const NEED_CHAR_LV = { shoot: 1, dash: 1, block: 1, a: 2, b: 3, ult: 4 }; // the character level at which a skill is yours (no points needed: points only make it stronger) // the character level that lets you learn a skill
export const BASE = { shoot: { mana: 2, cd: 0.6 }, dash: { mana: 8, cd: 1.3 }, block: { mana: 12, cd: 5 }, a: { mana: 16, cd: 4.5 }, b: { mana: 24, cd: 8 }, ult: { mana: 70, cd: 40 } };
export const PASSIVES = {
  pool: { name: 'Mana pool', icon: '🔷', desc: '+20 max mana', max: 8 },
  focus: { name: 'Focus', icon: '🧘', desc: 'Holding Space gathers mana faster', max: 6 },
};

// each skill: kind + numbers. `fx` ids are pixelfx effects (ground ones stand at the spot, others face the aim)
export const ELEMENTS = {
  earth: {
    name: 'Earth', icon: '🪨', color: '#b08a58', pal: PAL.earth, blurb: 'Stone and stun. Slow to hurt, hard to stop.',
    skills: {
      shoot: { name: 'Rock Throw', desc: 'Hurls a boulder that cracks on impact.', kind: 'proj', dmg: 1.7, speed: 200, r: 9, proj: { id: 'projectiles/energy-disc', o: { palette: PAL.earth }, k: 0.28 }, hitFx: ['impacts/hit-spark', 0.5] },
      dash: { name: 'Stone Rush', desc: 'Charge forward in a shower of rubble, knocking foes aside.', kind: 'dash', dist: 80, dur: 0.2, dmg: 2, trail: 'moves/earth-stomp', trailScale: 0.35, stun: 0.6 },
      block: { name: 'Stone Skin', desc: 'Stone wraps around you: nothing gets through for a moment.', kind: 'block', dur: 2.2, fx: 'holy/divine-shield', fxO: { palette: PAL.earth } },
      a: { name: 'Earth Spikes', desc: 'A line of spikes bursts from the ground, hurting and stunning.', kind: 'line', len: 150, step: 22, dmg: 3, stun: 1.2, w: 16, fx: 'nature/earth-spike', fxScale: 0.5 },
      b: { name: 'Quake', desc: 'The ground shakes around you: damage and a long stun.', kind: 'nova', r: 80, dmg: 4, stun: 2, fx: [['nature/quake', 0.7]] },
      ult: { name: 'Titan Slam', desc: 'Slam the world: a huge quake, then rocks fall from the sky.', kind: 'combo', parts: [{ kind: 'nova', r: 150, dmg: 12, stun: 3, fx: [['nature/quake', 1.3], ['explosions/dirt-explosion', 0.8]] }, { kind: 'rain', n: 7, rad: 120, gap: 0.18, r: 34, dmg: 9, stun: 1.5, fx: [['nature/earth-spike', 0.8]] }] },
    },
  },
  fire: {
    name: 'Fire', icon: '🔥', color: '#ff7a2a', pal: PAL.fire, blurb: 'Burn everything. Big damage, burning over time.',
    skills: {
      shoot: { name: 'Fireball', desc: 'A fireball that burns what it hits.', kind: 'proj', dmg: 1.9, speed: 230, r: 9, burn: 3, proj: { id: 'fire/fireball', k: 0.26 }, hitFx: ['explosions/small-explosion', 0.4] },
      dash: { name: 'Flame Dash', desc: 'Rocket forward on a trail of fire that scorches foes.', kind: 'dash', dist: 100, dur: 0.18, dmg: 2.5, trail: 'fire/spirit-flame', trailO: { palette: PAL.fire }, trailScale: 0.4, burn: 3 },
      block: { name: 'Flame Barrier', desc: 'A ring of fire guards you.', kind: 'block', dur: 2.2, fx: 'fire/fire-ring', fxO: {}, fxScale: 0.5 },
      a: { name: 'Fire Breath', desc: 'A cone of flame in front of you.', kind: 'cone', r: 90, half: 0.65, dmg: 4, burn: 4, kb: 40, fx: [['fire/fire-breath', 0.7]] },
      b: { name: 'Flame Pillar', desc: 'A pillar of fire erupts where you aim.', kind: 'point', range: 220, delay: 0.45, r: 36, dmg: 6, burn: 4, fx: [['fire/flame-pillar', 0.7]] },
      ult: { name: 'Meteor Storm', desc: 'Meteors rain down where you point.', kind: 'rain', n: 9, rad: 100, gap: 0.22, r: 44, dmg: 11, burn: 4, range: 240, fx: [['fire/meteor', 0.7]], boom: 'explosions/small-explosion' },
    },
  },
  ice: {
    name: 'Ice', icon: '❄️', color: '#7fd4ff', pal: PAL.ice, blurb: 'Freeze and shatter. Control the crowd.',
    skills: {
      shoot: { name: 'Ice Lance', desc: 'A piercing lance that slows what it hits.', kind: 'proj', dmg: 1.6, speed: 260, r: 8, pierce: true, slow: 2, proj: { id: 'ice/ice-lance', k: 0.24 }, hitFx: ['ice/ice-shatter', 0.5] },
      dash: { name: 'Ice Slide', desc: 'Skate forward leaving frost behind.', kind: 'dash', dist: 100, dur: 0.2, dmg: 1.5, trail: 'ice/snowflake-burst', trailScale: 0.35, slow: 2.5 },
      block: { name: 'Ice Armor', desc: 'Crystal armor takes every blow.', kind: 'block', dur: 2.4, fx: 'ice/ice-crystal', fxO: {}, fxScale: 0.5 },
      a: { name: 'Frost Nova', desc: 'A freezing ring that locks everything nearby in ice.', kind: 'nova', r: 85, dmg: 3, stun: 2.2, fx: [['ice/frost-nova', 0.7]] },
      b: { name: 'Ice Spikes', desc: 'A line of ice spikes in front of you.', kind: 'line', len: 160, step: 24, dmg: 4, slow: 3, w: 16, fx: 'ice/ice-spikes', fxScale: 0.55 },
      ult: { name: 'Blizzard', desc: 'A raging blizzard where you aim: it hurts and freezes for seconds.', kind: 'zone', range: 200, r: 100, dur: 6, tick: 0.5, dmg: 3, stun: 0.8, slow: 2, fx: 'ice/blizzard-vortex', fxScale: 0.9 },
    },
  },
  lightning: {
    name: 'Lightning', icon: '⚡', color: '#ffe84a', pal: PAL.electric, blurb: 'Fast and sharp: chains, blinks and stuns.',
    skills: {
      shoot: { name: 'Spark Bolt', desc: 'A fast ball of lightning that zaps on impact.', kind: 'proj', dmg: 1.6, speed: 300, r: 8, proj: { id: 'lightning/ball-lightning', k: 0.22, mid: true }, hitFx: ['lightning/zap-hit', 0.5] },
      dash: { name: 'Lightning Step', desc: 'Blink along the lightning: zaps everything on the way.', kind: 'dash', dist: 110, dur: 0, dmg: 2.5, blink: true, trail: 'lightning/zap-hit', trailScale: 0.5, endFx: 'lightning/lightning-strike' },
      block: { name: 'Static Field', desc: 'A crackling field blocks everything.', kind: 'block', dur: 2.2, fx: 'lightning/electrified', fxO: {}, fxScale: 0.5 },
      a: { name: 'Chain Lightning', desc: 'Jumps from foe to foe, stunning each.', kind: 'chain', n: 5, reach: 150, dmg: 3.5, stun: 0.9, fx: 'lightning/chain-lightning' },
      b: { name: 'Thunderclap', desc: 'A deafening blast: big stun all around you.', kind: 'nova', r: 95, dmg: 4, stun: 2.5, fx: [['lightning/thunderclap', 0.7]] },
      ult: { name: 'Storm Cloud', desc: 'Summon a storm that strikes the foes beneath it again and again.', kind: 'zone', range: 200, r: 120, dur: 6, tick: 0.4, dmg: 0, strike: 7, stun: 0.5, fx: 'lightning/storm-cloud', fxScale: 0.8 },
    },
  },
  water: {
    name: 'Water', icon: '💧', color: '#4fb0ff', pal: PAL.water, blurb: 'Heal yourself, push foes around.',
    skills: {
      shoot: { name: 'Water Orb', desc: 'A rolling orb of water.', kind: 'proj', dmg: 1.7, speed: 210, r: 9, kb: 30, proj: { id: 'water/water-orb', k: 0.24, mid: true }, hitFx: ['water/splash', 0.5] },
      dash: { name: 'Wave Rush', desc: 'Ride a wave forward and wash foes aside.', kind: 'dash', dist: 100, dur: 0.2, dmg: 1.5, trail: 'water/splash', trailScale: 0.4, slow: 1.5 },
      block: { name: 'Bubble', desc: 'A bubble swallows every blow.', kind: 'block', dur: 2.4, fx: 'water/bubbles', fxO: {}, fxScale: 0.5 },
      a: { name: 'Healing Spring', desc: 'A spring heals you (a third of your health).', kind: 'heal', pct: 0.34, fx: [['holy/heal', 0.7], ['water/fountain', 0.5]] },
      b: { name: 'Water Jet', desc: 'A hard jet that shoves foes back.', kind: 'cone', r: 120, half: 0.25, dmg: 5, kb: 90, fx: [['water/water-jet', 0.8]] },
      ult: { name: 'Whirlpool', desc: 'A whirlpool drags foes in and tears at them.', kind: 'zone', range: 200, r: 100, dur: 6, tick: 0.4, dmg: 3.5, pull: 70, fx: 'water/whirlpool', fxScale: 0.8 },
    },
  },
  air: {
    name: 'Air', icon: '🌪️', color: '#a9f0e4', pal: AIR_PAL, blurb: 'Fastest of all: tornadoes, gusts and speed.',
    skills: {
      shoot: { name: 'Air Slash', desc: 'A razor of wind that cuts through foes.', kind: 'proj', dmg: 1.5, speed: 280, r: 9, pierce: true, proj: { id: 'projectiles/energy-disc', o: { palette: AIR_PAL }, k: 0.28 }, hitFx: ['impacts/hit-spark', 0.4] },
      dash: { name: 'Gust Dash', desc: 'The longest dash: you ride the wind.', kind: 'dash', dist: 130, dur: 0.2, dmg: 1, trail: 'weather/clouds', trailScale: 0.25, trailO: { palette: AIR_PAL } },
      block: { name: 'Wind Wall', desc: 'A wall of wind turns everything away.', kind: 'block', dur: 2.2, fx: 'holy/divine-shield', fxO: { palette: AIR_PAL } },
      a: { name: 'Tornado', desc: 'A tornado at your aim that sucks foes in and hurts them.', kind: 'zone', range: 190, r: 60, dur: 4, tick: 0.35, dmg: 2.2, pull: 60, fx: 'nature/tornado', fxScale: 0.55 },
      b: { name: 'Gale Push', desc: 'A blast that throws foes back and stuns them.', kind: 'cone', r: 110, half: 0.9, dmg: 3, kb: 110, stun: 1.4, fx: [['moves/dash-strike', 0.6]] },
      ult: { name: 'Cyclone', desc: 'You become a cyclone: you hurt all around you and run faster for seconds.', kind: 'zone', self: true, r: 95, dur: 6, tick: 0.35, dmg: 3.2, pull: 40, haste: 6, fx: 'fire/fire-tornado', fxO: { palette: AIR_PAL }, fxScale: 0.7 },
    },
  },
  arcane: {
    name: 'Arcane', icon: '🔮', color: '#c27cff', pal: PAL.arcane, blurb: 'Blink, stop time, call down stars.',
    skills: {
      shoot: { name: 'Arcane Orb', desc: 'A slow orb that hits hard.', kind: 'proj', dmg: 2.3, speed: 190, r: 10, proj: { id: 'arcane/arcane-orb', k: 0.22, mid: true }, hitFx: ['arcane/mana-burst', 0.4] },
      dash: { name: 'Blink', desc: 'Vanish and appear a few steps ahead.', kind: 'dash', dist: 120, dur: 0, dmg: 0, blink: true, startFx: 'arcane/blink-out', endFx: 'arcane/blink-in' },
      block: { name: 'Mana Ward', desc: 'A rune ward that holds everything back.', kind: 'block', dur: 2.4, fx: 'holy/divine-shield', fxO: { palette: PAL.arcane } },
      a: { name: 'Arcane Missiles', desc: 'Five homing missiles for the nearest foes.', kind: 'chain', n: 5, reach: 190, dmg: 2.2, fx: 'arcane/arcane-missiles', spark: 'arcane/mana-burst' },
      b: { name: 'Time Stop', desc: 'Time halts: everything near you is frozen in place.', kind: 'nova', r: 150, dmg: 0, stun: 3.2, fx: [['arcane/time-stop', 0.8]] },
      ult: { name: 'Star Fall', desc: 'Stars fall from the sky onto your foes.', kind: 'rain', n: 10, rad: 110, gap: 0.2, r: 40, dmg: 10, range: 240, fx: [['arcane/star-fall', 0.8]], boom: 'arcane/mana-burst' },
    },
  },
  nature: {
    name: 'Nature', icon: '🌿', color: '#6ccf5a', pal: PAL.leaf, blurb: 'Heal, root and poison. The healer of the group.',
    skills: {
      shoot: { name: 'Thorn Shot', desc: 'A thorn that poisons.', kind: 'proj', dmg: 1.6, speed: 260, r: 8, burn: 3, proj: { id: 'projectiles/arrow', o: { palette: PAL.leaf }, k: 0.3 }, hitFx: ['nature/spore-burst', 0.4] },
      dash: { name: 'Vine Dash', desc: 'Vines whip you forward.', kind: 'dash', dist: 95, dur: 0.2, dmg: 1.5, trail: 'nature/vine-whip', trailScale: 0.4, slow: 1.5 },
      block: { name: 'Bark Skin', desc: 'Your skin turns to bark.', kind: 'block', dur: 2.4, fx: 'holy/divine-shield', fxO: { palette: PAL.leaf } },
      a: { name: 'Healing Bloom', desc: 'A flower blooms and heals you (40% of your health).', kind: 'heal', pct: 0.4, fx: [['nature/healing-bloom', 0.7], ['holy/heal', 0.6]] },
      b: { name: 'Root Snare', desc: 'Roots hold every foe near your aim in place.', kind: 'point', range: 200, delay: 0.25, r: 70, dmg: 3, stun: 3, fx: [['nature/root-snare', 0.8]] },
      ult: { name: 'Leaf Storm', desc: 'A storm of leaves circles you: it cuts foes and heals you.', kind: 'zone', self: true, r: 90, dur: 6, tick: 0.4, dmg: 3, heal: 0.025, fx: 'nature/leaf-storm', fxScale: 0.7 },
    },
  },
};
// the skill pictures (public/assets/skillicons): pixel icons from the Clockwork Raven pack and the Spells/Buffs packs
export const SKILL_ICONS = {
  fire: { shoot: 'cw0', dash: 'cw9', block: 'cw15', a: 'cw5', b: 'cw14', ult: 'cw3' },
  ice: { shoot: 'cw56', dash: 'cw57', block: 'cw63', a: 'cw60', b: 'cw69', ult: 'cw70' },
  lightning: { shoot: 'cw128', dash: 'cw129', block: 'cw143', a: 'cw133', b: 'cw131', ult: 'cw134' },
  earth: { shoot: 'cw208', dash: 'cw217', block: 'cw223', a: 'cw222', b: 'cw213', ult: 'cw214' },
  water: { shoot: 'water_spell', dash: 'cw57', block: 'cw63', a: 'healing_spell', b: 'cw73', ult: 'cw59' },
  air: { shoot: 'cw266', dash: 'cw267', block: 'cw271', a: 'cw270', b: 'cw263', ult: 'cw262' },
  arcane: { shoot: 'cw120', dash: 'cw121', block: 'cw127', a: 'cw114', b: 'cw175', ult: 'cw115' },
  nature: { shoot: 'cw88', dash: 'cw89', block: 'cw95', a: 'healing_spell', b: 'cw198', ult: 'cw86' },
};
export const PASS_ICONS = { pool: 'mana_replenish', focus: 'regeneration' };
export const iconUrl = (n) => `${import.meta.env.BASE_URL}assets/skillicons/${n}.png`;
export const ELEMENT_IDS = Object.keys(ELEMENTS);

export class ElementSystem {
  constructor(g, saved) {
    this.g = g;
    this.el = ELEMENTS[saved?.el] ? saved.el : null;
    this.lv = { ...(saved?.lv || {}) };
    this.pass = { pool: saved?.pass?.pool || 0, focus: saved?.pass?.focus || 0 };
    this.spent = saved?.spent ?? 0; // skill points spent
    this.bonus = saved?.bonus ?? 2; // points you start with (and the ones levels give)
    this.pointsGiven = saved?.given ?? 1; // the character level that points were last given for
    this.mana = saved?.mana ?? this.maxMana();
    this.cd = {};
    this.projs = [];
    this.zones = [];
    this.q = [];
    this.teles = []; // warning marks on the ground (my own)
    this.remoteTeles = []; // and other players' ones, so you can dodge them
    this.castT = 0;
    this.burns = new Map();
    this.dashS = null;
    this.charging = false;
    this.spaceAt = 0;
    this.holding = false;
    this.empower = 0;
    this.haste = 0;
    this.regenT = 0;
    this.chargeFx = null;
    this.panel = false;
    this.fireHeld = false;
    if (!this.el) this.g.paused = true; // the first thing is picking an element
  }

  // ---------- data ----------
  def() {
    return ELEMENTS[this.el];
  }

  maxMana() {
    return 100 + 8 * ((this.g?.level || 1) - 1) + 20 * (this.pass?.pool || 0);
  }

  points() {
    return Math.max(0, this.bonus - this.spent);
  }

  level(k) {
    if (k === 'shoot' || k === 'dash') return 1; // the two default skills: left and right click, always there
    return Math.max(this.lv[k] ?? 0, this.g.level >= NEED_CHAR_LV[k] ? 1 : 0);
  }

  // take one level back off a skill and get the point again (the three starting skills keep their first level, which was free)
  downgrade(k) {
    const g = this.g;
    if (!this.el) return false;
    if (k === 'pool' || k === 'focus') {
      if (this.pass[k] < 1) return false;
      this.pass[k]--;
      this.spent = Math.max(0, this.spent - 1);
      this.mana = Math.min(this.maxMana(), this.mana);
    } else {
      if (!SKILL_KEYS.includes(k) || k === 'shoot' || k === 'dash' || this.level(k) <= 0) return false;
      this.lv[k] = this.level(k) - 1;
      this.spent = Math.max(0, this.spent - 1);
    }
    sfx.play('click', 0.6);
    g.save?.();
    g.emitHud();
    return true;
  }

  mult(k) {
    return 1 + 0.3 * (this.level(k) - 1);
  }

  costOf(k) {
    return Math.max(1, Math.round(BASE[k].mana * (this.empower > 0 ? 0 : 1) * (1 - 0.04 * (this.level(k) - 1))));
  }

  cdOf(k) {
    return BASE[k].cd * (1 - 0.06 * (this.level(k) - 1));
  }

  save() {
    return { el: this.el, lv: this.lv, pass: this.pass, spent: this.spent, bonus: this.bonus, given: this.pointsGiven, mana: Math.round(this.mana) };
  }

  // ---------- choosing and upgrading ----------
  choose(id) {
    if (!ELEMENTS[id]) return;
    const g = this.g;
    const changing = !!this.el;
    this.el = id;
    this.lv = {};
    this.spent = 0; // (a new element: every point is yours again)
    this.pass = { pool: 0, focus: 0 };
    this.mana = this.maxMana();
    this.cd = {};
    this.projs.length = 0;
    this.zones.length = 0;
    this.q.length = 0;
    this.empower = 0;
    this.haste = 0;
    if (!changing || g.paused) g.paused = false;
    g.pfx.spawn('spawn/summon-rise', g.player.x, g.player.y + 4, { scale: 0.7, seed: seed(), palette: this.def().pal });
    g.pfx.spawn('spawn/spawn-portal', g.player.x, g.player.y + 4, { scale: 0.6, seed: seed() });
    sfx.play('levelup', 0.6);
    g.onToast?.(`${this.def().icon} You are now a ${this.def().name} bender! Spend your skill points (press E).`);
    g.save?.();
    g.emitHud();
  }

  upgrade(k) {
    const g = this.g;
    if (!this.el) return false;
    if (k === 'pool' || k === 'focus') {
      if (this.points() < 1 || this.pass[k] >= PASSIVES[k].max) return false;
      this.pass[k]++;
      this.spent++;
      if (k === 'pool') this.mana = Math.min(this.maxMana(), this.mana + 20);
    } else {
      if (!SKILL_KEYS.includes(k) || this.points() < 1 || this.level(k) >= MAX_LV[k] || g.level < NEED_CHAR_LV[k]) return false;
      this.lv[k] = this.level(k) + 1;
      this.spent++;
    }
    sfx.play('pickup', 0.6);
    g.pfx.spawn('arcane/mana-burst', g.player.x, g.player.y - 4, { scale: 0.3, seed: seed(), palette: this.def().pal });
    g.save?.();
    g.emitHud();
    return true;
  }

  // a new character level gives skill points
  onLevel(level) {
    const gained = Math.max(0, level - this.pointsGiven) * (level >= 12 ? 2 : 1);
    if (gained) {
      this.bonus += gained;
      this.pointsGiven = level;
      this.g.onToast?.(`✨ +${gained} skill point${gained > 1 ? 's' : ''}: press E to upgrade your skills.`);
    }
    this.g.combat.refreshMaxHp(true);
    this.mana = this.maxMana();
  }

  hud() {
    const d = this.def();
    return {
      el: this.el,
      pick: !this.el,
      name: d?.name,
      icon: d?.icon,
      color: d?.color,
      mana: Math.round(this.mana),
      hp: Math.round(this.g.combat.hp * (100 / 6)),
      maxHp: Math.round(this.g.combat.maxHp * (100 / 6)),
      maxMana: this.maxMana(),
      points: this.points(),
      charging: this.charging,
      empower: this.empower > 0,
      panel: this.panel,
      pass: { ...this.pass },
      skills: d
        ? SKILL_KEYS.map((k) => ({
            k,
            key: SKILL_LABEL[k],
            ico: SKILL_ICONS[this.el][k],
            name: d.skills[k].name,
            desc: d.skills[k].desc,
            lv: this.level(k),
            max: MAX_LV[k],
            needLv: NEED_CHAR_LV[k],
            locked: this.g.level < NEED_CHAR_LV[k],
            cd: this.cd[k] || 0,
            cdMax: this.cdOf(k),
            mana: this.costOf(k),
          }))
        : [],
    };
  }

  // ---------- input ----------
  spaceDown() {
    if (!this.el || this.holding) return;
    this.holding = true;
    this.spaceAt = this.g.t;
  }

  spaceUp() {
    if (!this.holding) return;
    this.holding = false;
    const held = this.g.t - this.spaceAt;
    if (this.charging) {
      if (!this.recharge) this.stopCharge();
    } else if (held < 0.25) this.cast('dash');
  }

  // the recharge hotkey (Space, or the button): hold it and you stand still in an aura while your mana fills
  rechargeHold(on) {
    if (!this.el) return;
    this.recharge = !!on;
  }

  key(code) {
    if (!this.el || this.g.dead) return false;
    if (code === 'KeyQ') return void this.g.useSupply('hp'), true; // health potion
    if (code === 'KeyR') return void this.g.useSupply('stam'), true; // mana potion
    const k = { Digit1: 'block', Digit2: 'a', Digit3: 'b', Digit4: 'ult' }[code];
    if (!k) return false;
    this.cast(k);
    return true;
  }

  togglePanel() {
    if (!this.el) return;
    this.panel = !this.panel;
    this.g.emitHud();
  }

  // ---------- effects (and a copy for the other players) ----------
  vis(id, x, y, o = {}) {
    const g = this.g;
    const { noNet, palette, ...rest } = o;
    g.pfx.spawn(id, x, y, { seed: seed(), ...rest, ...(palette ? { palette } : {}) });
    if (g.mp && !o.noNet) g.mp.net.send({ t: 'fx', kind: 'pfx', fid: id, x: Math.round(x), y: Math.round(y), s: o.scale || 1, a: Math.round((o.angle || 0) * 100) / 100 });
  }

  // ---------- casting ----------
  aimAngle(from) {
    const m = this.g.mouseWorld();
    const [cx, cy] = from || this.g.combat.center();
    return Math.atan2(m.y - cy, m.x - cx);
  }

  canCast(k, quiet = false) {
    const g = this.g;
    if (g.dead || g.frozen || g.cutscene || g.paused || g.stunnedT > 0 || g.inside) return false;
    if (this.level(k) < 1 || g.level < NEED_CHAR_LV[k]) {
      if (!quiet) g.onToast?.(`${this.def().skills[k].name}: it unlocks at character level ${NEED_CHAR_LV[k]}.`);
      return false;
    }
    if ((this.cd[k] || 0) > 0) return false;
    if (this.mana < this.costOf(k)) {
      if (!quiet && (this.noManaAt ?? -9) < g.t - 1) {
        this.noManaAt = g.t;
        g.combat.addFloater({ x: g.player.x, y: g.player.y - 44, text: 'no mana', color: '#7aa8ff', t: 0 });
        g.onToast?.('🔷 Out of mana: hold Space to charge it, or grab a blue potion.');
      }
      return false;
    }
    return true;
  }

  cast(k, quiet = false) {
    if (!this.el || !this.canCast(k, quiet)) return false;
    const g = this.g;
    if (this.charging) this.stopCharge();
    const spec = this.def().skills[k];
    const m = this.mult(k) * (this.empower > 0 ? 1.5 : 1) * (1 + 0.03 * (g.level - 1));
    this.mana -= this.costOf(k);
    this.cd[k] = this.cdOf(k);
    const [cx, cy] = g.combat.center();
    const a = this.aimAngle([cx, cy]);
    g.combat.faceAim(a);
    const wind = this.windOf(spec, k);
    if (wind > 0) {
      // the big skills take a moment: a mark on the ground shows everybody where it will land (and you move slowly while you gather it)
      const pt = spec.kind === 'rain' ? this.cursorPoint(spec.range || 220, cx, cy) : null;
      this.windTele(spec, wind, a, pt);
      this.castT = wind;
      this.later(wind, () => {
        if (g.dead) return;
        const [x2, y2] = g.combat.center();
        this.run(spec, k, m, x2, y2, a, pt);
      });
    } else this.run(spec, k, m, cx, cy, a);
    return true;
  }

  windOf(s, k) {
    if (s.kind === 'nova') return k === 'ult' ? 0.7 : 0.35;
    if (s.kind === 'cone') return 0.3;
    if (s.kind === 'line') return 0.35;
    if (s.kind === 'combo' || s.kind === 'rain') return 0.7;
    return 0;
  }

  windTele(s, wind, a, pt) {
    const first = s.kind === 'combo' ? s.parts[0] : s;
    if (s.kind === 'rain') this.addTele({ k: 'c', x: pt.x, y: pt.y, r: s.rad, d: wind });
    else if (first.kind === 'cone') this.addTele({ k: 'k', r: first.r, a, h: first.half, d: wind, f: 1 });
    else if (first.kind === 'line') this.addTele({ k: 'l', l: first.len, w: first.w, a, d: wind, f: 1 });
    else this.addTele({ k: 'c', r: first.r, d: wind, f: 1 });
  }

  // a warning mark: k = c (circle) | k (cone) | l (line); f = it moves with whoever cast it; d = how long it shows
  addTele(o) {
    const g = this.g;
    const p = g.player;
    const T = { grow: true, ...o, x: o.x ?? p.x, y: o.y ?? p.y - 4, t: 0, c: this.def().color };
    this.teles.push(T);
    if (g.mp) g.mp.net.send({ t: 'fx', kind: 'tele', k: T.k, x: Math.round(T.x), y: Math.round(T.y), r: T.r || 0, a: T.a || 0, h: T.h || 0, l: T.l || 0, w: T.w || 0, d: T.d, f: T.f ? 1 : 0, gr: T.grow ? 1 : 0, c: T.c });
  }

  addRemoteTele(m, src) {
    if (!['c', 'k', 'l'].includes(m.k) || !(m.d > 0)) return;
    this.remoteTeles.push({ k: m.k, x: m.x, y: m.y, r: Math.min(260, m.r || 0), a: m.a || 0, h: m.h || 0, l: Math.min(300, m.l || 0), w: Math.min(60, m.w || 0), d: Math.min(12, m.d), f: !!m.f, grow: !!m.gr, c: m.c, src, t: 0 });
    if (this.remoteTeles.length > 40) this.remoteTeles.shift();
  }

  updateTeles(dt) {
    const g = this.g;
    for (const T of this.teles) {
      T.t += dt;
      if (T.f) {
        T.x = g.player.x;
        T.y = g.player.y - 4;
      }
    }
    this.teles = this.teles.filter((T) => T.t < T.d + 0.15);
    for (const T of this.remoteTeles) {
      T.t += dt;
      const r = T.f && T.src ? g.remotes.get(T.src) : null;
      if (r) {
        T.x = r.x;
        T.y = r.y - 4;
      }
    }
    this.remoteTeles = this.remoteTeles.filter((T) => T.t < T.d + 0.15);
  }

  drawTeles(ctx, t) {
    for (const T of [...this.teles, ...this.remoteTeles]) {
      const [r, gg, b] = hexRgb(T.c);
      const p = Math.min(1, T.t / T.d);
      const fade = T.t > T.d ? Math.max(0, 1 - (T.t - T.d) / 0.15) : 1;
      const pulse = 0.65 + 0.35 * Math.sin(t * 12);
      ctx.save();
      ctx.translate(Math.round(T.x), Math.round(T.y + 4));
      ctx.globalAlpha = fade;
      ctx.scale(1, 0.85);
      ctx.fillStyle = `rgba(${r},${gg},${b},0.16)`;
      ctx.strokeStyle = `rgba(255,255,255,${0.55 * pulse + 0.25})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      const shape = (sc) => {
        ctx.beginPath();
        if (T.k === 'c') ctx.arc(0, 0, T.r * sc, 0, TAU);
        else if (T.k === 'k') {
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, T.r * sc, T.a - T.h, T.a + T.h);
          ctx.closePath();
        } else {
          const ca = Math.cos(T.a);
          const sa = Math.sin(T.a);
          const L = T.l * sc;
          ctx.moveTo(-sa * T.w, ca * T.w);
          ctx.lineTo(ca * L - sa * T.w, sa * L + ca * T.w);
          ctx.lineTo(ca * L + sa * T.w, sa * L - ca * T.w);
          ctx.lineTo(sa * T.w, -ca * T.w);
          ctx.closePath();
        }
      };
      shape(1);
      ctx.fill();
      ctx.stroke();
      if (T.grow) {
        // the inner shape fills up as the skill gets ready: when it is full, it lands
        ctx.setLineDash([]);
        ctx.fillStyle = `rgba(${r},${gg},${b},${0.2 + 0.22 * pulse})`;
        shape(p);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  run(s, k, m, cx, cy, a, pt) {
    const g = this.g;
    const p = g.player;
    const kind = s.kind;
    if (kind === 'proj') {
      const sp = s.speed;
      this.projs.push({ x: cx + Math.cos(a) * 10, y: cy + Math.sin(a) * 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, a, s, dmg: s.dmg * m, life: 1.4, hit: new Set(), m });
      sfx.play(`e_${this.el}`, 0.8);
    } else if (kind === 'dash') {
      this.startDash(s, m, a);
    } else if (kind === 'block') {
      g.combat.shieldT = Math.max(g.combat.shieldT || 0, s.dur * (1 + 0.1 * (this.level('block') - 1)));
      g.mp?.net.send({ t: 'fx', kind: 'shield' });
      const dur = g.combat.shieldT;
      g.pfx.spawn(s.fx, p.x, p.y - 2, { scale: s.fxScale || 0.55, life: dur, follow: () => ({ x: g.player.x, y: g.player.y - 2 }), key: 'eblock', seed: seed(), palette: this.def().pal, ...(s.fxO || {}) });
      sfx.play('e_block', 0.7);
    } else if (kind === 'heal') {
      this.heal(g.combat.maxHp * s.pct * m);
      for (const [id, sc] of s.fx) this.vis(id, p.x, p.y + 2, { scale: sc });
      sfx.play('heal', 0.6);
    } else if (kind === 'nova') {
      this.nova(s, m, p.x, p.y - 4);
    } else if (kind === 'cone') {
      this.cone(s, m, cx, cy, a);
    } else if (kind === 'line') {
      this.line(s, m, cx, cy, a);
    } else if (kind === 'chain') {
      this.chain(s, m, cx, cy, a);
    } else if (kind === 'point') {
      const t = pt || this.cursorPoint(s.range, cx, cy);
      this.addTele({ k: 'c', x: t.x, y: t.y, r: s.r, d: s.delay });
      this.vis(s.fx[0][0], t.x, t.y + 4, { scale: s.fx[0][1] * 0.6, noNet: false });
      this.later(s.delay, () => {
        for (const [id, sc] of s.fx) this.vis(id, t.x, t.y + 6, { scale: sc });
        this.areaHit(t.x, t.y, s.r, s, m);
        sfx.play('explosion', 0.4);
      });
    } else if (kind === 'rain') {
      const t = pt || this.cursorPoint(s.range || 220, cx, cy);
      this.rain(s, m, t);
    } else if (kind === 'zone') {
      this.zone(s, m, cx, cy);
    } else if (kind === 'combo') {
      s.parts.forEach((part, i) => this.later(i * 0.45, () => this.run(part, k, m, cx, cy, a, pt)));
    }
    if (kind === 'nova' || kind === 'cone' || kind === 'zone' || kind === 'rain' || kind === 'combo') sfx.play(k === 'ult' ? 'e_ult' : 'explosion', k === 'ult' ? 0.9 : 0.5);
  }

  later(t, fn) {
    this.q.push({ t, fn });
  }

  cursorPoint(range, cx, cy) {
    const m = this.g.mouseWorld();
    const d = Math.hypot(m.x - cx, m.y - cy);
    const f = d > range ? range / d : 1;
    return { x: cx + (m.x - cx) * f, y: cy + (m.y - cy) * f };
  }

  foes() {
    return this.g.combat.wilds.filter((w) => w.state !== 'dead');
  }

  heal(n) {
    const c = this.g.combat;
    const before = c.hp;
    c.hp = Math.min(c.maxHp, c.hp + n);
    if (c.hp > before) c.addFloater({ x: this.g.player.x, y: this.g.player.y - 40, text: `+${Math.round((c.hp - before) * (100 / 6))} ❤`, color: '#5fd16a', t: 0, big: true });
  }

  // damage one foe: the number, the combo, the hit spark, and what else the skill does
  hurt(w, dmg, ox, oy, s = {}, m = 1) {
    if (w.state === 'dead') return;
    const g = this.g;
    const c = g.combat;
    const v = Math.max(0.1, dmg);
    g.comboHit?.();
    c.damageWild(w, v, ox, oy, s.kb || 0);
    if (w.state !== 'dead') {
      c.addFloater({ x: w.x, y: w.y - 24, text: `-${v >= 10 ? Math.round(v) : Math.round(v * 10) / 10}`, color: '#ff7a8f', t: 0 });
      if (s.stun) c.stunTarget(w, s.stun * (m > 1 ? Math.min(1.4, 1 + (m - 1) * 0.2) : 1), this.def().color);
      if (s.slow) w.slowT = Math.max(w.slowT || 0, s.slow);
      if (s.burn) this.burns.set(w, { t: s.burn, dps: Math.max(0.4, v * 0.25) });
      if (s.kb) {
        const d = Math.hypot(w.x - ox, w.y - oy) || 1;
        w.kx = ((w.x - ox) / d) * s.kb * 3;
        w.ky = ((w.y - oy) / d) * s.kb * 3;
      }
    }
  }

  areaHit(x, y, r, s, m) {
    for (const w of this.foes()) {
      const wy = w.y - 6;
      if (Math.hypot(w.x - x, wy - y) <= r + 6) this.hurt(w, (s.dmg || 0) * m, x, y, s, m);
    }
  }

  nova(s, m, x, y) {
    for (const [id, sc] of s.fx) this.vis(id, x, y + 8, { scale: sc });
    this.areaHit(x, y, s.r, s, m);
  }

  cone(s, m, cx, cy, a) {
    for (const [id, sc] of s.fx) this.vis(id, cx + Math.cos(a) * 14, cy + Math.sin(a) * 14 + 4, { scale: sc, angle: a });
    for (const w of this.foes()) {
      const dx = w.x - cx;
      const dy = w.y - 6 - cy;
      const d = Math.hypot(dx, dy);
      if (d > s.r + 8) continue;
      let da = Math.atan2(dy, dx) - a;
      while (da > Math.PI) da -= TAU;
      while (da < -Math.PI) da += TAU;
      if (Math.abs(da) <= s.half || d < 18) this.hurt(w, s.dmg * m, cx, cy, s, m);
    }
  }

  line(s, m, cx, cy, a) {
    const n = Math.floor(s.len / s.step);
    for (let i = 1; i <= n; i++) {
      const x = cx + Math.cos(a) * s.step * i;
      const y = cy + Math.sin(a) * s.step * i;
      this.later(i * 0.06, () => {
        this.vis(s.fx, x, y + 8, { scale: s.fxScale || 0.5 });
        this.areaHit(x, y, s.w, s, m);
      });
    }
  }

  chain(s, m, cx, cy, a) {
    const left = this.foes().filter((w) => Math.hypot(w.x - cx, w.y - cy) <= s.reach + 40);
    left.sort((p, q) => Math.hypot(p.x - cx, p.y - cy) - Math.hypot(q.x - cx, q.y - cy));
    let fx = cx;
    let fy = cy;
    const hit = left.slice(0, s.n);
    if (!hit.length) {
      this.vis(s.fx, cx + Math.cos(a) * 14, cy + Math.sin(a) * 14, { scale: 0.6, angle: a });
      return;
    }
    hit.forEach((w, i) => {
      this.later(i * 0.1, () => {
        const ang = Math.atan2(w.y - 6 - fy, w.x - fx);
        this.vis(s.fx, fx, fy, { scale: 0.55, angle: ang });
        this.vis(s.spark || 'lightning/zap-hit', w.x, w.y - 6, { scale: 0.5 });
        this.hurt(w, s.dmg * m, fx, fy, s, m);
        fx = w.x;
        fy = w.y - 6;
      });
    });
  }

  rain(s, m, t) {
    for (let i = 0; i < s.n; i++) {
      const x = t.x + rnd(-s.rad, s.rad) * 0.9;
      const y = t.y + rnd(-s.rad, s.rad) * 0.6;
      this.later(i * s.gap, () => {
        this.addTele({ k: 'c', x, y, r: s.r, d: 0.4 });
        for (const [id, sc] of s.fx) this.vis(id, x, y + 8, { scale: sc });
        this.later(0.35, () => {
          if (s.boom) this.vis(s.boom, x, y + 4, { scale: 0.55 });
          this.areaHit(x, y, s.r, s, m);
        });
      });
    }
  }

  zone(s, m, cx, cy) {
    const g = this.g;
    const t = s.self ? { x: g.player.x, y: g.player.y - 4 } : this.cursorPoint(s.range, cx, cy);
    const z = { s, m, x: t.x, y: t.y, t: 0, dur: s.dur, acc: 0 };
    this.addTele({ k: 'c', x: t.x, y: t.y, r: s.r, d: s.dur, f: s.self ? 1 : 0, grow: false });
    this.zones.push(z);
    const follow = s.self ? () => ({ x: g.player.x, y: g.player.y + 4 }) : null;
    g.pfx.spawn(s.fx, t.x, t.y + 6, { scale: s.fxScale || 0.7, life: s.dur, follow, seed: seed(), ...(s.fxO || {}) });
    if (g.mp) g.mp.net.send({ t: 'fx', kind: 'pfx', fid: s.fx, x: Math.round(t.x), y: Math.round(t.y + 6), s: s.fxScale || 0.7, a: 0 });
    if (s.haste) this.haste = Math.max(this.haste, s.haste);
  }

  startDash(s, m, a) {
    const g = this.g;
    const p = g.player;
    // (dash the way you are walking, or at the mouse when you stand still)
    const k = g.keys;
    const mx = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0);
    const my = (k.has('down') ? 1 : 0) - (k.has('up') ? 1 : 0);
    const ang = mx || my ? Math.atan2(my, mx) : a;
    if (s.startFx) this.vis(s.startFx, p.x, p.y - 6, { scale: 0.5 });
    this.dashS = { s, m, ang, t: 0, moved: 0, hit: new Set(), trailT: 0 };
    g.combat.invuln = Math.max(g.combat.invuln, (s.dur || 0.1) + 0.3);
    g.combat.faceAim(ang);
    sfx.play(s.blink ? 'e_blink' : 'dash', 0.7);
    if (s.blink) this.finishDash(true);
  }

  finishDash(blink = false) {
    const g = this.g;
    const d = this.dashS;
    if (!d) return;
    const p = g.player;
    if (blink) {
      const x0 = p.x;
      const y0 = p.y;
      for (let dist = 0; dist < d.s.dist; dist += 4) {
        const nx = p.x + Math.cos(d.ang) * 4;
        const ny = p.y + Math.sin(d.ang) * 4;
        if (g.blocked(nx, ny)) break;
        p.x = nx;
        p.y = ny;
      }
      if (d.s.trail) this.vis(d.s.trail, x0, y0 - 6, { scale: d.s.trailScale || 0.5 });
      if (d.s.dmg) this.sweep(d, x0, y0, p.x, p.y);
      if (d.s.endFx) this.vis(d.s.endFx, p.x, p.y + 4, { scale: 0.5 });
    }
    this.dashS = null;
  }

  // hurt everything near the segment the hero just travelled
  sweep(d, x0, y0, x1, y1) {
    const s = d.s;
    for (const w of this.foes()) {
      if (d.hit.has(w)) continue;
      const vx = x1 - x0;
      const vy = y1 - y0;
      const L2 = vx * vx + vy * vy || 1;
      const t = Math.max(0, Math.min(1, ((w.x - x0) * vx + (w.y - 6 - y0) * vy) / L2));
      if (Math.hypot(w.x - (x0 + vx * t), w.y - 6 - (y0 + vy * t)) < 16) {
        d.hit.add(w);
        this.hurt(w, s.dmg * d.m, x0, y0, s, d.m);
      }
    }
  }

  // ---------- charging mana (hold Space) ----------
  startCharge() {
    const g = this.g;
    this.charging = true;
    g.keys.clear();
    sfx.play('e_charge', 0.6);
    this.chargeFx = g.pfx.spawn('arcane/spell-charge', g.player.x, g.player.y, { scale: 0.55, life: 600, follow: () => ({ x: g.player.x, y: g.player.y - 2 }), seed: seed(), palette: this.def().pal });
    g.emitHud();
  }

  stopCharge() {
    this.charging = false;
    if (this.chargeFx) this.chargeFx.life = 0;
    this.chargeFx = null;
    this.g.emitHud();
  }

  speedMul() {
    return (this.haste > 0 ? 1.45 : 1) * (this.castT > 0 ? 0.45 : 1);
  }

  // taking a hit breaks your concentration
  onHurt() {
    if (this.charging) this.stopCharge();
    this.holding = false;
    this.recharge = false;
  }

  // ---------- pickups and kills ----------
  pickup(kind) {
    const g = this.g;
    const p = g.player;
    if (kind === 'mana') {
      this.mana = Math.min(this.maxMana(), this.mana + 30);
      g.combat.addFloater({ x: p.x, y: p.y - 40, text: '+30 mana', color: '#7aa8ff', t: 0 });
      g.pfx.spawn('pickups/collect-burst', p.x, p.y - 4, { scale: 0.45 });
    } else if (kind === 'star') {
      this.mana = this.maxMana();
      this.empower = 10;
      g.combat.addFloater({ x: p.x, y: p.y - 44, text: 'POWER!', color: '#ffe36b', t: 0, big: true });
      g.pfx.spawn('pickups/collect-burst', p.x, p.y - 4, { scale: 0.7 });
      g.pfx.spawn('holy/sunburst', p.x, p.y + 4, { scale: 0.45, seed: seed() });
      g.onToast?.('⭐ Power star! Full mana and 1.5x damage for 10 seconds, skills cost nothing.');
    }
    else if (kind === 'xp') {
      const n = 6 + g.level * 2;
      g.addXp(n, true);
      g.combat.addFloater({ x: p.x, y: p.y - 40, text: `+${n} XP`, color: '#9cf09c', t: 0 });
      g.pfx.spawn('pickups/collect-burst', p.x, p.y - 4, { scale: 0.4 });
    }
    sfx.play('pickup', 0.6);
  }

  onMobDie(w) {
    const g = this.g;
    g.pfx.spawn(Math.random() < 0.5 ? 'spawn/soul-rise' : 'spawn/dissolve-burn', w.x, w.y + 2, { scale: 0.4, seed: seed() });
    const drops = g.combat.drops;
    const r = Math.random();
    // the only things that fall here: a mana potion, a life pack, gold coins and an experience orb
    const kind = r < 0.28 ? 'mana' : r < 0.38 ? 'heart' : null;
    if (kind) drops.push({ x: w.x, y: w.y - 2, id: kind, qty: 1, age: 0, ...(kind === 'heart' ? {} : { em: kind }) });
    if (Math.random() < 0.45) drops.push({ x: w.x + rnd(-6, 6), y: w.y, id: 'coin', qty: 1 + Math.floor(Math.random() * 3), age: 0 });
    if (Math.random() < 0.3) drops.push({ x: w.x + rnd(-8, 8), y: w.y - 2, id: 'xp', qty: 1, age: 0, em: 'xp' });
  }

  onDie() {
    const g = this.g;
    this.stopCharge();
    this.projs.length = 0;
    this.zones.length = 0;
    this.q.length = 0;
    this.teles.length = 0;
    this.castT = 0;
    this.dashS = null;
    this.empower = 0;
    this.haste = 0;
    g.pfx.spawn('spawn/shatter-death', g.player.x, g.player.y, { scale: 0.6, seed: seed(), palette: this.def()?.pal });
    g.pfx.spawn('spawn/soul-rise', g.player.x, g.player.y, { scale: 0.6, seed: seed() });
  }

  onRespawn() {
    const g = this.g;
    this.mana = this.maxMana();
    g.pfx.spawn('spawn/respawn-beam', g.player.x, g.player.y + 4, { scale: 0.6, seed: seed() });
  }

  // ---------- every frame ----------
  update(dt) {
    const g = this.g;
    this.updateTeles(dt);
    // only a life pack, mana, gold and experience can lie on the ground here: anything else that turns up becomes coins
    for (const d of g.combat.drops) {
      if (d.em || d.id === 'coin' || d.id === 'heart' || d.id === 'hppack') continue;
      d.id = 'coin';
      d.qty = 3;
      delete d.wid;
    }
    if (!this.el) {
      g.paused = true; // (nothing moves until you have picked an element)
      return;
    }
    const p = g.player;
    this.castT = Math.max(0, this.castT - dt);
    for (const k in this.cd) this.cd[k] = Math.max(0, this.cd[k] - dt);
    if (this.empower > 0) this.empower = Math.max(0, this.empower - dt);
    if (this.haste > 0) this.haste = Math.max(0, this.haste - dt);
    if (g.dead) {
      if (this.charging) this.stopCharge();
      return;
    }
    // mana: a trickle all the time, much more while you charge
    const max = this.maxMana();
    const want = this.recharge || (this.holding && g.t - this.spaceAt >= 0.25);
    if (want && !this.charging && !this.dashS && !g.paused && !g.inside) this.startCharge();
    else if (!want && this.charging) this.stopCharge();
    if (this.charging) {
      g.keys.clear();
      this.mana = Math.min(max, this.mana + (24 + 7 * this.pass.focus) * dt);
      p.moving = false;
      if (this.mana >= max && !this.fullToast) {
        this.fullToast = true;
        g.combat.addFloater({ x: p.x, y: p.y - 44, text: 'mana full', color: '#7aa8ff', t: 0 });
      }
    } else {
      this.fullToast = false;
      this.mana = Math.min(max, this.mana + 1.6 * dt);
    }
    // the bolt keeps firing while the mouse button is held
    if (g.mouseHeld[0] && !g.paused && !this.charging && !g.touchMode && !this.panel) this.cast('shoot', true);
    // timed things
    if (this.q.length) {
      const due = [];
      this.q = this.q.filter((e) => ((e.t -= dt) <= 0 ? (due.push(e), false) : true));
      for (const e of due) e.fn();
    }
    this.updateDash(dt);
    this.updateProjs(dt);
    this.updateZones(dt);
    this.updateBurns(dt);
  }

  updateDash(dt) {
    const d = this.dashS;
    if (!d) return;
    const g = this.g;
    const p = g.player;
    const s = d.s;
    const speed = s.dist / s.dur;
    const step = speed * dt;
    const x0 = p.x;
    const y0 = p.y;
    let left = step;
    while (left > 0) {
      const st = Math.min(2, left);
      const nx = p.x + Math.cos(d.ang) * st;
      const ny = p.y + Math.sin(d.ang) * st;
      if (g.blocked(nx, ny)) {
        d.t = s.dur;
        break;
      }
      p.x = nx;
      p.y = ny;
      left -= st;
    }
    d.t += dt;
    p.moving = true;
    d.trailT -= dt;
    if (s.trail && d.trailT <= 0) {
      d.trailT = 0.05;
      g.pfx.spawn(s.trail, x0, y0 - 2, { scale: s.trailScale || 0.4, seed: seed(), ...(s.trailO || {}) });
    }
    this.sweep(d, x0, y0 - 2, p.x, p.y - 2);
    if (d.t >= s.dur) this.dashS = null;
  }

  updateProjs(dt) {
    for (const b of this.projs) {
      b.life -= dt;
      const nx = b.x + b.vx * dt;
      const ny = b.y + b.vy * dt;
      b.x = nx;
      b.y = ny;
      for (const w of this.foes()) {
        if (b.hit.has(w)) continue;
        if (Math.hypot(w.x - b.x, w.y - 6 - b.y) <= b.s.r + 6) {
          b.hit.add(w);
          this.vis(b.s.hitFx[0], b.x, b.y, { scale: b.s.hitFx[1] });
          this.hurt(w, b.dmg, b.x - b.vx * 0.05, b.y - b.vy * 0.05, b.s, b.m);
          if (!b.s.pierce) {
            b.life = 0;
            break;
          }
        }
      }
    }
    this.projs = this.projs.filter((b) => b.life > 0);
  }

  updateZones(dt) {
    const g = this.g;
    for (const z of this.zones) {
      const s = z.s;
      z.t += dt;
      if (s.self) {
        z.x = g.player.x;
        z.y = g.player.y - 4;
      }
      if (s.pull) {
        for (const w of this.foes()) {
          const dx = z.x - w.x;
          const dy = z.y - (w.y - 6);
          const d = Math.hypot(dx, dy);
          if (d < z.s.r && d > 6) {
            w.x += (dx / d) * s.pull * dt;
            w.y += (dy / d) * s.pull * dt;
          }
        }
      }
      z.acc += dt;
      if (z.acc >= s.tick) {
        z.acc -= s.tick;
        if (s.strike) {
          // lightning falls on a foe inside the storm
          const inside = this.foes().filter((w) => Math.hypot(w.x - z.x, w.y - 6 - z.y) < s.r);
          const w = inside.length ? inside[Math.floor(Math.random() * inside.length)] : null;
          const x = w ? w.x : z.x + rnd(-s.r, s.r) * 0.7;
          const y = w ? w.y - 6 : z.y + rnd(-s.r, s.r) * 0.5;
          this.vis('lightning/lightning-strike', x, y + 8, { scale: 0.7 });
          if (w) this.hurt(w, s.strike * z.m, x, y, { stun: s.stun }, z.m);
        }
        if (s.dmg) this.areaHit(z.x, z.y, s.r, s, z.m);
        if (s.heal) this.heal(g.combat.maxHp * s.heal);
      }
    }
    this.zones = this.zones.filter((z) => z.t < z.dur);
  }

  updateBurns(dt) {
    for (const [w, b] of this.burns) {
      b.t -= dt;
      b.acc = (b.acc || 0) + dt;
      if (w.state === 'dead' || b.t <= 0) {
        this.burns.delete(w);
        continue;
      }
      if (b.acc >= 0.5) {
        b.acc -= 0.5;
        this.g.combat.damageWild(w, b.dps * 0.5, w.x, w.y, 0, true);
        if (w.state !== 'dead' && Math.random() < 0.5) this.g.pfx.spawn('status/burning', w.x, w.y - 8, { scale: 0.3, seed: seed() });
      }
    }
  }

  // ---------- drawing ----------
  draw(ctx, t) {
    this.drawTeles(ctx, t);
    if (!this.el) return;
    for (const b of this.projs) {
      const bk = bakedLoop(b.s.proj.id, b.s.proj.o || {}, 15);
      if (!bk) continue;
      ctx.save();
      ctx.translate(Math.round(b.x), Math.round(b.y));
      ctx.rotate(b.a);
      const kk = b.s.proj.k || 0.3;
      // (round ones are centred on the bolt; the streaks are drawn from their bright head so the tail trails behind)
      if (b.s.proj.mid) drawBaked(ctx, bk, (bk.ox - bk.W / 2) * kk, (bk.oy - bk.H / 2) * kk, t + b.x * 0.01, false, 1, kk);
      else drawBaked(ctx, bk, 0, 0, t + b.x * 0.01, false, 1, kk);
      ctx.restore();
    }
  }
}

// What a skill looks like, for the previews in the picker and the tutorial: a looping picture, or one-shot effects played over and over
export function previewOf(skill, el) {
  const s = skill;
  const pal = ELEMENTS[el].pal;
  if (s.kind === 'proj') return { loop: s.proj, shots: [[s.hitFx[0], s.hitFx[1], {}]], mode: 'proj' };
  if (s.kind === 'dash') return { shots: [s.startFx && [s.startFx, 0.5, {}], s.trail && [s.trail, (s.trailScale || 0.4) * 1.3, s.trailO || {}], s.endFx && [s.endFx, 0.5, {}]].filter(Boolean), mode: 'dash' };
  if (s.kind === 'block') return { shots: [[s.fx, s.fxScale || 0.55, { palette: pal, ...(s.fxO || {}), life: 1.8 }]], mode: 'still' };
  if (s.kind === 'line') return { shots: [1, 2, 3, 4].map((i) => [s.fx, s.fxScale || 0.5, { dx: i * 18 - 40, delay: i * 0.1 }]), mode: 'still' };
  if (s.kind === 'chain') return { shots: [[s.fx, 0.55, { angle: -0.3 }], [s.spark || 'lightning/zap-hit', 0.5, { dx: 40, dy: -12 }]], mode: 'still' };
  if (s.kind === 'zone') return { shots: [[s.fx, (s.fxScale || 0.7) * 0.6, { ...(s.fxO || {}), life: 1.8 }]], mode: 'still' };
  if (s.kind === 'combo') return { shots: s.parts[0].fx.map(([id, sc]) => [id, sc * 0.6, {}]), mode: 'still' };
  if (s.kind === 'rain') return { shots: [1, 2, 3].map((i) => [s.fx[0][0], s.fx[0][1] * 0.7, { dx: (i - 2) * 28, dy: (i % 2) * 8, delay: i * 0.2 }]), mode: 'still' };
  return { shots: (s.fx || []).map(([id, sc]) => [id, sc * (s.kind === 'cone' ? 0.8 : 0.7), s.kind === 'cone' ? { angle: 0, dx: 12 } : {}]), mode: 'still' };
}
