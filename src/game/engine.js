import { CHUNK_PX, GRASS, SAND, T, WATER } from './world';
import { ITEMS, LOOT_APOC, isConsumable, rollLoot, throwStats } from './items';
import { SURVIVOR, ZOMBIE_FRAMES } from './apoc';
import { Combat, SHIELD_DUR } from './combat';
import { MONSTERS } from './monsters';
import { WaveMirror, WaveSim } from './waves';
import { ALLIES } from './allies';
import { Bots } from './bots';
import { Streaks } from './streaks';
import { sfx } from './sfx';
import { TEAMS } from './teams';
import { store } from './store';
import { FREE_UPGRADES, MAX_LEVEL, SKILL_SHOP, SUPPLY_CAP, SUPPLY_SHOP, THROW_SHOP, UPGRADES, emptyUpgrades, upgradeCost } from './upgrades';

// how far above the feet a hero's name tag floats; the villager is shorter than the others
const tagHeight = (hero) => (hero.kind === 'retro' ? 26 : hero.kind === 'sunny' ? 27 : hero.kind === 'apoc' ? 25 : 36);

const PEER_COLORS = ['#7cc5f2', '#f2b05e', '#b49cf2', '#7fd48f', '#f28fb0', '#e6d35a', '#5fd0c4', '#e98a5b', '#9aa7f0', '#c4d86a'];
import { addItem, emptyInventory, moveSlot, removeFromSlot, sanitize } from './inventory';
import { hash2, hashString } from './rng';
import { renderChunk } from './render';
import { drawHero, heroById } from './heroes';

// how much longer than you a mount can sprint: a chicken lasts 2x, a cow 3x as long
export const MONSTER_TARGET = 15; // monster kills that win a "monster kills" round
const MOUNT_POOL = { chicken: 2, cow: 3 };
const MOUNT_HP = { chicken: 3, cow: 6 }; // hearts; hits that would land on a rider land on the animal instead

const FOOT_W = 8;
const FOOT_H = 5;
const SPEED = 62;
const SPRINT_MULT = 1.75;
const RESPAWN_TIME = 5; // seconds spent downed
const WADE_SLOWDOWN = 0.4; // speed multiplier while paddling through water
const DIR_VEC = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const HOURS_PER_SECOND = 24 / 360; // a full day lasts six real minutes
const MIN_ZOOM_OFFSET = -2;
const MAX_ZOOM_OFFSET = 3;

// Multiply-blend colour of the sky at a given hour
const SKY = [
  [0, [62, 72, 140]], [5, [78, 86, 150]], [7, [255, 196, 176]], [9, [255, 255, 255]],
  [17, [255, 255, 255]], [19, [255, 176, 128]], [21, [84, 86, 154]], [24, [62, 72, 140]],
];

function skyTint(hour) {
  for (let i = 1; i < SKY.length; i++) {
    if (hour <= SKY[i][0]) {
      const [h0, c0] = SKY[i - 1];
      const [h1, c1] = SKY[i];
      const k = (hour - h0) / (h1 - h0);
      return c0.map((v, j) => Math.round(v + (c1[j] - v) * k));
    }
  }
  return SKY[SKY.length - 1][1];
}
const MAX_CACHED_CHUNKS = 120;

const CONTROL_KEYS = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
};

const saveKey = (seed) => `cuzi-save:${seed}`;

function readSave(seed) {
  try {
    return JSON.parse(store.get(saveKey(seed))) || null;
  } catch {
    return null;
  }
}

export class Game {
  constructor({ canvas, world, assets, hero, name = '', demo = false, minimap = null, net = null, session = null, mode = 'free', difficulty = 'medium', bots = 0, winBy = 'duel', onRoundWon, onAnnounce, onHud, onToast, onInventory, onHotbarScroll }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.world = world;
    this.img = assets.img;
    this.mbox = assets.mbox;
    this.hero = hero;
    this.name = name;
    this.onRoundWon = onRoundWon; // solo: called once the winner has been cheered
    this.winBy = mode === 'free' ? winBy : 'duel'; // 'duel' (player kills) or 'monsters'; kill targets are for Free Roam only, not Wave Defense or Survival
    this.demo = demo;
    this.minimap = minimap;
    this.onHud = onHud;
    // kill streaks between heroes: a banner at the top, a stinger and a voice
    this.streaks = new Streaks((a) => {
      sfx.play(`streak${a.tier}`);
      sfx.speak(a.title, a.tier);
      onAnnounce?.(a);
    });
    this.onToast = onToast;
    this.onInventory = onInventory;
    this.onHotbarScroll = onHotbarScroll;

    // Local multiplayer: other heroes in the same room, and a shared day/night clock
    this.mp = !demo && net && session
      ? { net, you: session.you, pvp: !!session.room.pvp, streakMonsters: !!session.room.streakMonsters, clockHour: session.clock.hour, clockDay: session.clock.day, clockAt: performance.now(), sendT: 0 }
      : null;
    // what the room allows (everything, when playing alone)
    this.rules = { melee: session?.room?.allowMelee !== false, throw: session?.room?.allowThrow !== false };
    // teams: who is on which team (player id -> team number); a room with teams = 0 is free for all
    this.teamMap = { ...(session?.teams || {}) };
    this.teamCount = this.mp ? session.room.teams || 0 : 0;
    this.remotes = new Map();
    this.myBubble = null;
    this.dead = null; // set while you are downed: { t, dur, by, last }
    this.upgrades = emptyUpgrades(); // bought with coins in Wave Defense and Survival
    this.padState = {}; // how long you have stood on each recruit pad
    for (const p of this.mp ? session.players : []) this.addRemote(p);

    // Wave Defense: the room's host (or a solo player) runs the monsters, everyone else mirrors them
    const isHost = !session || session.host === session.you;
    this.theme = world.apoc ? 'apoc' : 'cozy';
    this.wave = (mode === 'waves' || mode === 'survival') && !demo ? (isHost ? new WaveSim(this, difficulty) : new WaveMirror(this, difficulty)) : null;
    this.hostId = session?.host ?? null;
    // in Free Roam rooms every player slot has its own house in a tight cluster
    this.roomHomes = this.mp && mode === 'free' ? world.homeCluster(Math.max(session.room.max || 4, 2), hashString(session.room.code)) : null;
    this.faces = new Map();

    this.keys = new Set();
    this.mouse = { x: 0, y: 0 }; // canvas pixels
    this.mouseHeld = { 0: false, 2: false };
    // the round's winner, cheered with confetti: { key, name, t, dur, sub, bits, after }
    this.frozen = false; // true while the opening scene plays: nothing moves and no keys count
    this.celeb = null;
    this.monsterKills = 0; // skeletons and monsters you have taken down this round
    // riding: hold Space beside a chicken or a cow to hop on, tap Space to hop off
    this.placeV = false; // the wall you are about to place stands upright (Survival: hold left-click to turn it)
    this.wallHold = null;
    this.mount = null;
    this.rideTarget = null;
    this.spaceDown = false;
    this.spaceLock = false;
    this.spaceHold = 0;
    this.selectedSlot = 0;
    this.camX = 0;
    this.camY = 0;
    this.chunkCanvases = new Map();
    this.animals = [];
    this.spawned = new Set();
    this.t = 0;
    this.zoom = 3;
    this.viewW = 0;
    this.viewH = 0;
    this.hudTimer = 0;
    this.saveTimer = 0;
    this.miniTimer = 0;
    this.interactPressed = false;
    this.zoomOffset = 0;
    this.stamina = 1;
    this.exhausted = false;
    this.sprinting = false;
    this.inWater = false;
    this.animT = 0;
    this.glows = [];
    this.motes = Array.from({ length: 26 }, (_, i) => ({
      x: hash2(i, 1, 9), y: hash2(i, 2, 9), s: 0.5 + hash2(i, 3, 9), p: hash2(i, 4, 9) * 6,
    }));

    const saved = demo || this.wave ? null : readSave(world.seedStr);
    const tp = new URLSearchParams(window.location.search).get('tp');
    // every hero has a home house; in rooms each player's slot picks a different one
    this.home = demo ? { x: 8, y: 12 } : this.chooseHome(saved, session);
    let spawn = !session && saved && Number.isFinite(saved.x) ? { x: saved.x, y: saved.y } : this.homeSpawn();
    if (tp && !demo) {
      const [tx, ty] = tp.split(',').map(Number);
      spawn = { x: tx * T + 8, y: ty * T + 12 };
    }
    this.player = { x: spawn.x, y: spawn.y, dir: 'down', moving: false };
    const hourParam = Number(new URLSearchParams(window.location.search).get('hour'));
    this.hour = demo ? 10 : Number.isFinite(saved?.hour) ? saved.hour : 8;
    if (!demo && hourParam > 0) this.hour = hourParam;
    else if (this.wave && this.theme === 'apoc') this.hour = 17.3; // Survival starts as the light begins to fail
    this.day = saved?.day || 1;
    this.inventory = sanitize(saved?.inventory);
    if (this.wave) {
      addItem(this.inventory, 'sword', 1); // your weapon lives in the first slot, so left-click can do other jobs when something else is selected
      addItem(this.inventory, 'barricade', 4); // a few boxes to get started
    }
    const give = new URLSearchParams(window.location.search).get('give');
    if (give && !demo) {
      for (const part of give.split(',')) {
        const [id, qty] = part.split(':');
        if (ITEMS[id]) addItem(this.inventory, id, Number(qty) || 1);
      }
    }
    this.collected = new Set(saved?.collected || []);
    this.combat = demo ? null : new Combat(this, assets.img, saved?.kills || 0);
    // solo vs AI: computer rivals in the free world
    this.bots = !demo && !session && mode === 'free' && bots > 0 ? new Bots(this, bots, difficulty) : null;
    // Free Roam keeps its shop upgrades and quick-slot supplies with the seed's save
    if (saved?.upgrades) this.upgrades = { ...emptyUpgrades(), ...saved.upgrades };
    this.supplies = {
      hp: Math.min(SUPPLY_CAP, saved?.supplies?.hp || 0),
      stam: Math.min(SUPPLY_CAP, saved?.supplies?.stam || 0),
    };
    // skills are bought once in the shop; Dash and Spiral are the two hold-to-charge sword skills, one equipped at a time
    this.skills = { shield: false, invis: false, dash: false, spiral: false, equipped: 'dash', equippedUtil: null, ...saved?.skills };
    this.combat?.refreshMaxHp(true);
    this.treasures = saved?.treasures || 0;
    this.foraged = saved?.foraged || 0;
    this.cam = { x: spawn.x, y: spawn.y };
    this.prompt = null;

    this.onKeyDown = (e) => {
      if (this.frozen) return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
      // a HUD button that kept focus after a click would otherwise react to Space/Enter
      if (tag === 'BUTTON') e.target.blur();
      if (e.code === 'AltLeft' || e.code === 'AltRight') e.preventDefault(); // keep the browser menu bar from grabbing Alt
      if (CONTROL_KEYS[e.code]) {
        this.keys.add(CONTROL_KEYS[e.code]);
        e.preventDefault();
      } else if (e.code === 'Equal' || e.code === 'NumpadAdd') {
        this.zoomBy(1);
      } else if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
        this.zoomBy(-1);
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) {
          this.spaceDown = true;
          if (this.mount) this.dismount();
          else this.interactPressed = true;
        }
      } else if (this.dead) {
        // downed heroes just wait for the respawn
      } else if (e.code === 'KeyF' && !e.repeat) {
        this.combat?.activateShield();
      } else if (e.code === 'KeyC' && !e.repeat) {
        this.combat?.activateInvis();
      } else if (e.code === 'KeyQ' && !e.repeat) {
        this.placeBarricade();
      } else if (e.code === 'KeyH' && !e.repeat) {
        this.combat?.startRecall();
      }
    };
    this.onKeyUp = (e) => {
      if (e.code === 'AltLeft' || e.code === 'AltRight') e.preventDefault();
      if (CONTROL_KEYS[e.code]) this.keys.delete(CONTROL_KEYS[e.code]);
      if (e.code === 'Space') {
        this.spaceDown = false;
        this.spaceLock = false;
        this.spaceHold = 0;
      }
    };
    this.onBlur = () => {
      this.spaceDown = false;
      this.keys.clear();
      this.mouseHeld[0] = false;
      this.combat?.cancelHold();
    };
    // Wheel cycles the hotbar; hold Alt while scrolling to zoom instead
    this.onWheel = (e) => {
      if (this.paused || !e.deltaY) return;
      e.preventDefault();
      if (e.altKey) this.zoomBy(e.deltaY < 0 ? 1 : -1);
      else this.onHotbarScroll?.(e.deltaY > 0 ? 1 : -1);
    };
    // Left click swings the sword, right click throws the selected hotbar item, both toward the cursor
    this.onMouseMove = (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - r.left) * (this.canvas.width / r.width);
      this.mouse.y = (e.clientY - r.top) * (this.canvas.height / r.height);
    };
    this.onMouseDown = (e) => {
      if (e.target !== this.canvas || this.paused || this.celeb || this.frozen || (e.button !== 0 && e.button !== 2)) return;
      this.onMouseMove(e);
      this.mouseHeld[e.button] = true;
      if (e.button === 0 && !this.dead) {
        if (this.wave) {
          // Wave Defense / Survival: left-click does what the selected slot does
          const held = this.inventory[this.selectedSlot]?.id;
          if (held === 'barricade') {
            // Survival walls can be turned: holding locks the wall onto its tile and moving the mouse swings it round; letting go places it
            if (this.world.apoc) {
              const { x, y } = this.snapPlacement();
              this.wallHold = { x, y, mx: this.mouse.x, my: this.mouse.y };
            }
            else this.placeBarricade();
            return;
          }
          if (held !== 'sword') return;
        }
        this.combat.holdStart(); // tap = sword swing, hold + release = dash
      }
    };
    this.onMouseUp = (e) => {
      if (e.button === 0 && this.wallHold) {
        if (!this.dead) this.placeBarricade();
        this.wallHold = null;
      }
      if (e.button === 0 && this.mouseHeld[0]) this.combat.holdEnd();
      this.mouseHeld[e.button] = false;
    };
    this.onContextMenu = (e) => {
      if (e.target === this.canvas) e.preventDefault();
    };
    this.resize = this.resize.bind(this);
    this.loop = this.loop.bind(this);
  }

  start() {
    if (import.meta.env.DEV) window.__game = this; // handy for poking at state from the console
    if (!this.demo) {
      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('keyup', this.onKeyUp);
      window.addEventListener('blur', this.onBlur);
      window.addEventListener('wheel', this.onWheel, { passive: false });
      window.addEventListener('mousemove', this.onMouseMove);
      window.addEventListener('mousedown', this.onMouseDown);
      window.addEventListener('mouseup', this.onMouseUp);
      window.addEventListener('contextmenu', this.onContextMenu);
    }
    this.offNet = this.mp?.net.on((m) => this.onNetMessage(m));
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(this.canvas.parentElement || this.canvas);
    this.resize();
    this.emitInventory();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('contextmenu', this.onContextMenu);
    this.offNet?.();
    this.observer?.disconnect();
    if (!this.demo) this.save();
  }

  save() {
    if (this.wave) return; // wave runs are one-off
    try {
      store.set(
        saveKey(this.world.seedStr),
        JSON.stringify({
          x: this.player.x,
          y: this.player.y,
          collected: [...this.collected],
          treasures: this.treasures,
          foraged: this.foraged,
          hour: this.hour,
          day: this.day,
          inventory: this.inventory,
          kills: this.combat?.kills || 0,
          upgrades: this.upgrades,
          supplies: this.supplies,
          skills: this.skills,
          home: this.home,
        }),
      );
    } catch {
      /* storage may be unavailable */
    }
  }

  chooseHome(saved, session) {
    if (this.wave) {
      // everybody starts together on the doorstep of the one house, spread out a little by slot
      const slot = session?.slot || 0;
      const door = this.world.homePoint(this.world.waveBase());
      return { x: door.x + ((slot % 3) - 1) * 14, y: door.y + Math.floor(slot / 3) * 9 };
    }
    const sites = this.world.houseList();
    if (session && sites.length) {
      // the room gets a tight little cluster of houses, one for each player slot
      const group = this.world.homeCluster(Math.max(session.room.max || 4, 2), hashString(session.room.code));
      return this.world.homePoint(group[Math.min(session.slot || 0, group.length - 1)]);
    }
    if (!session && saved?.home && Number.isFinite(saved.home.x)) return saved.home;
    return this.pickRandomHome();
  }

  pickRandomHome() {
    const sites = this.world.houseList();
    if (!sites.length) return this.world.randomSpawn();
    return this.world.homePoint(sites[Math.floor(Math.random() * Math.min(8, sites.length))]);
  }

  // heroes start (and wake up) indoors, in the middle of their own house; Wave Defense and Survival have no cottage to be in
  homeSpawn() {
    if (this.wave || this.world.apoc || this.demo) return this.home;
    return { x: this.home.x, y: this.home.y - 30 };
  }

  // `inside` puts you in your house, otherwise you land on its doorstep
  goHome(inside = false) {
    const p = inside ? this.homeSpawn() : this.home;
    this.player.x = p.x;
    this.player.y = p.y;
    this.cam.x = p.x;
    this.cam.y = p.y;
  }

  // Wipes the seed's progress and puts the hero back at spawn.
  resetProgress() {
    this.collected.clear();
    this.inventory = emptyInventory();
    this.emitInventory();
    this.treasures = 0;
    this.foraged = 0;
    this.bots?.reset();
    this.upgrades = emptyUpgrades();
    this.supplies = { hp: 0, stam: 0 };
    this.skills = { shield: false, invis: false, dash: false, spiral: false, equipped: 'dash', equippedUtil: null };
    this.combat?.refreshMaxHp(true);
    if (this.combat) {
      this.combat.kills = 0;
      this.combat.hp = this.combat.maxHp;
      this.combat.clearEnemies();
    }
    if (!this.mp) this.home = this.pickRandomHome();
    this.goHome(true);
    this.save();
  }

  // Out of hearts: wake up at your own front door, a little hungry but whole
  faint(message = 'You fainted… and woke up at home.') {
    this.dead = null;
    this.dismount();
    sfx.play('respawn');
    this.goHome(true);
    this.combat.hp = this.combat.maxHp;
    this.combat.invuln = 2;
    this.combat.clearEnemies();
    this.combat.spawnT = 15;
    this.stamina = Math.max(this.stamina, 0.5);
    this.onToast?.(message);
    this.save();
  }

  // ---------- round winner ----------

  celebMine() {
    const c = this.celeb;
    if (c && c.team !== undefined) return c.team === this.myTeam();
    return !!c && (c.key === 'me' || (!!this.mp && String(c.key) === String(this.mp.you)));
  }

  // where the winner stands (you, a hero in the room, or a rival)
  celebPoint() {
    const c = this.celeb;
    if (!c) return null;
    if (c.key === 'me' || (!!this.mp && String(c.key) === String(this.mp.you))) return { x: this.player.x, y: this.player.y }; // the one who scored
    const r = this.remotes.get(c.key) ?? this.remotes.get(Number(c.key));
    return r ? { x: r.x, y: r.y } : null;
  }

  // Cheer the winner: the camera goes to them, they are lit up, and confetti rains for `dur` seconds. `after` runs at the end.
  celebrate(key, name, dur = 6, sub = '', after = null) {
    if (this.celeb) return;
    this.celeb = { key, name, t: 0, dur, sub, bits: [], after, burst: false };
    this.combat.invuln = Math.max(this.combat.invuln, dur + 1);
    this.combat.hold = null;
    this.mouseHeld[0] = false;
    this.mouseHeld[2] = false;
    this.dismount();
    if (this.celebMine()) sfx.play('win');
  }

  updateCelebration(dt) {
    const c = this.celeb;
    if (!c) return;
    c.t += dt;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const z = this.zoom;
    const colors = ['#ff5d7a', '#ffd24a', '#5ac8fa', '#7ddc6f', '#c28bff', '#ff9a3d', '#ffffff'];
    const piece = (x, y, vx, vy) => c.bits.push({
      x, y, vx, vy, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 12, flip: Math.random() * 6.28,
      w: z * (1.4 + Math.random() * 1.6), h: z * (0.9 + Math.random() * 1.2), color: colors[Math.floor(Math.random() * colors.length)],
    });
    if (!c.burst) {
      // two cannons at the bottom corners
      c.burst = true;
      for (let i = 0; i < 70; i++) {
        piece(W * 0.04, H * 0.95, z * (50 + Math.random() * 150), -z * (170 + Math.random() * 190));
        piece(W * 0.96, H * 0.95, -z * (50 + Math.random() * 150), -z * (170 + Math.random() * 190));
      }
    }
    if (c.t < c.dur - 1.5) {
      // then a steady rain from the top
      c.rain = (c.rain || 0) + dt * 90;
      while (c.rain >= 1) {
        c.rain -= 1;
        piece(Math.random() * W, -10, (Math.random() - 0.5) * z * 30, z * (25 + Math.random() * 45));
      }
    }
    for (const b of c.bits) {
      b.vy += z * 190 * dt; // gravity
      b.vy = Math.min(b.vy, z * 70 + (b.vy < 0 ? b.vy : 0)); // drifts down slowly, like paper
      b.vx *= 1 - Math.min(1, 1.4 * dt);
      b.x += (b.vx + Math.sin(c.t * 3 + b.flip) * z * 14) * dt;
      b.y += b.vy * dt;
      b.rot += b.vr * dt;
      b.flip += dt * 9;
    }
    c.bits = c.bits.filter((b) => b.y < H + 20);
    if (c.t >= c.dur) {
      const after = c.after;
      this.celeb = null;
      after?.();
    }
  }

  // Dim everything but the winner, ring and crown them, then rain confetti over the lot
  drawCelebration(camX, camY) {
    const c = this.celeb;
    if (!c) return;
    const { ctx, canvas, zoom } = this;
    const pt = this.celebPoint();
    const fade = Math.min(1, c.t / 0.5) * Math.min(1, (c.dur - c.t) / 0.6);
    if (pt) {
      const [fx, fy] = this.toScreen(pt.x, pt.y, camX, camY);
      const cy = fy - zoom * 9;
      const R = zoom * 44;
      const g = ctx.createRadialGradient(fx, cy, R * 0.4, fx, cy, R * 2.8);
      g.addColorStop(0, 'rgba(25,12,40,0)');
      g.addColorStop(1, `rgba(25,12,40,${0.55 * fade})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.globalAlpha = fade;
      // a golden pillar of light
      const beam = ctx.createLinearGradient(0, fy - zoom * 70, 0, fy);
      beam.addColorStop(0, 'rgba(255,226,120,0)');
      beam.addColorStop(1, 'rgba(255,226,120,0.38)');
      ctx.fillStyle = beam;
      ctx.fillRect(fx - zoom * 9, fy - zoom * 70, zoom * 18, zoom * 70);
      // pulsing rings at their feet
      const pulse = 1 + 0.1 * Math.sin(this.t * 7);
      ctx.lineWidth = zoom * 1.5;
      ctx.strokeStyle = 'rgba(255,214,74,0.98)';
      ctx.fillStyle = 'rgba(255,214,74,0.22)';
      ctx.beginPath();
      ctx.ellipse(fx, fy - zoom, zoom * 16 * pulse, zoom * 7 * pulse, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = zoom;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.ellipse(fx, fy - zoom, zoom * 22 * pulse, zoom * 10 * pulse, 0, 0, Math.PI * 2);
      ctx.stroke();
      // sparkles circling them
      ctx.fillStyle = '#fff6c2';
      for (let i = 0; i < 6; i++) {
        const a = this.t * 2.2 + (i * Math.PI) / 3;
        const sx = fx + Math.cos(a) * zoom * 19;
        const sy = fy - zoom * 10 + Math.sin(a) * zoom * 9 - Math.abs(Math.sin(this.t * 3 + i)) * zoom * 6;
        ctx.fillRect(sx - zoom, sy - zoom * 2, zoom * 2, zoom * 4);
        ctx.fillRect(sx - zoom * 2, sy - zoom, zoom * 4, zoom * 2);
      }
      ctx.restore();
      this.pill(`👑 ${c.name} wins!`, fx, fy - zoom * 38, zoom * 5.5, '#4b3000', 'rgba(255,214,74,0.97)');
    }
    for (const b of c.bits) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      ctx.scale(1, Math.cos(b.flip)); // tumbling paper
      ctx.fillStyle = b.color;
      ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      ctx.restore();
    }
  }

  // the key your own kills and deaths go under in the streak tracker
  myKey() {
    return this.mp ? String(this.mp.you) : 'me';
  }

  // you took down a skeleton or monster
  monsterKill(name) {
    this.monsterKills++;
    if (this.winBy === 'monsters') {
      if (this.mp) this.mp.net.send({ t: 'mkill' });
      else if (this.monsterKills >= MONSTER_TARGET && !this.celeb) {
        // solo: reaching the target wins the round, and a fresh count starts afterwards
        sfx.play('win');
        this.celebrate('me', this.name || 'You', 6, 'Heading to your room in a moment…', () => {
          this.monsterKills = 0;
          this.streaks.reset();
          this.onRoundWon?.();
        });
      }
    }
    // kill streaks are for taking down players; monsters only count (and are announced to the whole room) when the room allows it
    if (this.mp?.streakMonsters) this.mp.net.send({ t: 'skill', victim: name });
  }

  // ---------- riding ----------

  // how high a rider sits above the ground
  rideLift() {
    return this.mount ? (this.mount.type === 'chicken' ? 5 : 11) : 0;
  }

  dismount() {
    const a = this.mount;
    if (!a) return;
    this.mount = null;
    this.spaceLock = true; // the same key press must not hop straight back on
    a.moving = false;
    a.timer = 1.5;
    // step the animal off to one side if there is room
    const nx = a.x + 12;
    if (!this.world.isBlocked(nx - 4, a.y - 4, 8, 4)) a.x = nx;
    this.onToast?.('You hop off.');
  }

  updateMount(dt) {
    const p = this.player;
    const a = this.mount;
    if (a) {
      if (this.dead || !this.animals.includes(a)) {
        this.mount = null;
        return;
      }
      // the animal goes where you go
      a.x = p.x;
      a.y = p.y;
      a.moving = p.moving;
      if (a.type !== 'chicken' || p.dir === 'left' || p.dir === 'right') a.dir = p.dir;
      if (p.moving) a.phase += dt * (this.sprinting ? 1.7 : 1);
      a.chunk = `${Math.floor(p.x / CHUNK_PX)},${Math.floor(p.y / CHUNK_PX)}`; // so it is not forgotten as you travel
      this.rideTarget = null;
      return;
    }
    let best = null;
    let bd = 24;
    for (const an of this.animals) {
      const d = Math.hypot(an.x - p.x, an.y - 2 - p.y);
      if (d < bd) {
        bd = d;
        best = an;
      }
    }
    this.rideTarget = this.dead || this.combat.insideId ? null : best;
    if (this.rideTarget && this.spaceDown && !this.spaceLock) {
      this.spaceHold += dt;
      if (this.spaceHold >= 0.6) {
        this.mount = this.rideTarget;
        this.rideTarget = null;
        this.spaceHold = 0;
        this.interactPressed = false;
        sfx.play('pickup');
        this.onToast?.(`You hopped on the ${this.mount.type}! Tap Space to hop off.`);
      }
    } else if (!this.spaceDown) {
      this.spaceHold = 0;
    }
  }

  // "Hold Space to ride" over a nearby animal, with a ring that fills while you hold
  drawRideHint(camX, camY) {
    const a = this.rideTarget;
    if (!a || this.mount || this.dead) return;
    const [sx, sy] = this.toScreen(a.x, a.y - (a.type === 'cow' ? 34 : 22), camX, camY);
    const pct = Math.min(1, this.spaceHold / 0.6);
    this.pill(`Hold Space · ride the ${a.type}`, sx, sy, this.zoom * 4, '#fff', 'rgba(232,124,150,0.95)');
    if (pct > 0) {
      const { ctx, zoom } = this;
      const w = zoom * 26;
      ctx.fillStyle = 'rgba(255,250,240,0.9)';
      ctx.fillRect(sx - w / 2, sy + zoom * 5, w, zoom * 2.4);
      ctx.fillStyle = '#e87c96';
      ctx.fillRect(sx - w / 2, sy + zoom * 5, w * pct, zoom * 2.4);
    }
  }

  // true when swords and throws can hurt other heroes (a fight-mode room, or AI rivals)
  get fight() {
    return !!(this.mp?.pvp || this.bots);
  }

  // ---------- being downed ----------

  // Called when your hearts run out. You sit out a short respawn timer, watching whoever did it.
  die(by) {
    if (this.dead) return;
    const c = this.combat;
    c.cancelHold();
    c.dash = null;
    c.cancelRecall();
    c.shieldT = 0;
    this.mouseHeld[0] = false;
    this.mouseHeld[2] = false;
    this.player.moving = false;
    if (by?.kind === 'player' && this.remotes.get(by.id)?.bot) this.bots.credit(by.id, 'me');
    sfx.play('death');
    this.streaks.died(this.myKey());
    if (this.mp && by?.kind !== 'player') this.mp.net.send({ t: 'fell' });
    this.dead = { t: 0, dur: RESPAWN_TIME, by, x: this.player.x, y: this.player.y, last: null };
  }

  // where the one who killed you is right now (or was last seen)
  killerPoint() {
    const by = this.dead?.by;
    if (!by) return null;
    let found = null;
    if (by.kind === 'player') found = this.remotes.get(by.id);
    else if (by.kind === 'monster') found = this.wave?.monsters.find((m) => m.id === by.id) || this.combat.wilds.find((m) => m.id === by.id);
    else if (by.kind === 'skeleton') found = this.combat.skeletons.find((s) => s.id === by.id);
    if (found) this.dead.last = { x: found.x, y: found.y };
    return this.dead.last;
  }

  killerName() {
    const by = this.dead?.by;
    if (!by) return null;
    if (by.kind === 'player') return this.remotes.get(by.id)?.name || 'another hero';
    return by.name || 'something nasty';
  }

  updateDeath(dt) {
    if (!this.dead) return;
    this.dead.t += dt;
    this.killerPoint();
    if (this.dead.t >= this.dead.dur) this.faint('Back on your feet!');
  }

  drawGrave(ctx, x, y) {
    x = Math.round(x);
    y = Math.round(y);
    ctx.fillStyle = 'rgba(60,40,30,0.25)';
    ctx.fillRect(x - 6, y - 1, 12, 3);
    ctx.fillStyle = '#6f6a7a';
    ctx.fillRect(x - 5, y - 11, 10, 11);
    ctx.fillRect(x - 3, y - 13, 6, 2);
    ctx.fillStyle = '#9d98ab';
    ctx.fillRect(x - 5, y - 11, 10, 2);
    ctx.fillRect(x - 3, y - 13, 6, 1);
    ctx.fillStyle = '#4a4656';
    ctx.fillRect(x - 1, y - 9, 2, 6);
    ctx.fillRect(x - 3, y - 7, 6, 2);
  }

  // A pulsing red ring and name tag on the one who got you
  drawKillerHighlight(camX, camY) {
    if (!this.dead) return;
    const p = this.killerPoint();
    if (!p) return;
    const { ctx, zoom } = this;
    const [sx, sy] = this.toScreen(p.x, p.y, camX, camY);
    const pulse = 1 + 0.12 * Math.sin(this.t * 7);
    ctx.save();
    ctx.lineWidth = zoom * 1.4;
    ctx.strokeStyle = 'rgba(255,70,90,0.95)';
    ctx.fillStyle = 'rgba(255,70,90,0.18)';
    ctx.beginPath();
    ctx.ellipse(sx, sy - zoom, zoom * 14 * pulse, zoom * 6 * pulse, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    const name = this.killerName();
    if (name) this.pill(`☠ ${name}`, sx, sy - zoom * 34, zoom * 5, '#fff', 'rgba(224,56,84,0.96)');
    // a bobbing arrow above their head
    ctx.save();
    ctx.fillStyle = '#ff465a';
    const ay = sy - zoom * 26 + Math.sin(this.t * 8) * zoom * 2;
    ctx.beginPath();
    ctx.moveTo(sx, ay + zoom * 4);
    ctx.lineTo(sx - zoom * 3.2, ay - zoom * 1.5);
    ctx.lineTo(sx + zoom * 3.2, ay - zoom * 1.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ---------- Wave Defense ----------

  waveTargets() {
    const out = [{ id: this.mp?.you ?? 0, x: this.player.x, y: this.player.y, hidden: this.combat.hidden }];
    for (const r of this.remotes.values()) out.push({ id: r.id, x: r.x, y: r.y, hidden: !!r.hidden });
    return out;
  }

  // a monster hurt hero `id` (that is us, or a guest who is told over the network)
  waveHurt(id, dmg, fx, fy, by) {
    if (id === (this.mp?.you ?? 0)) this.combat.hurtPlayer(dmg, fx, fy, { by });
    else this.mp?.net.send({ t: 'w', to: id, k: 'hurt', d: { dmg, fx, fy, by } });
  }

  onWaveEvent(ev) {
    const c = this.combat;
    if (ev.type === 'start') {
      sfx.play('wave');
      this.onToast?.(ev.boss ? 'FINAL WAVE! The Crushing Cyclops is coming!' : `Wave ${ev.wave} is coming!`);
    } else if (ev.type === 'cleared') {
      this.onToast?.(`Wave ${ev.wave} cleared! You catch your breath (+2 ♥).`);
      c.hp = Math.min(c.maxHp, c.hp + 2);
      this.stamina = 1;
    } else if (ev.type === 'mdie') {
      c.kills++;
      this.monsterKill(ev.name || 'Monster');
      sfx.play('monsterDie', 0.6);
      for (const l of ev.loot) {
        c.drops.push({ x: ev.x + (Math.random() - 0.5) * 16, y: ev.y + (Math.random() - 0.5) * 8, id: l.id, qty: l.qty, age: 0 });
      }
    } else if (ev.type === 'bbreak') {
      c.floaters.push({ x: ev.x, y: ev.y - 20, text: 'crack!', color: '#e0a060', t: 0 });
    } else if (ev.type === 'recruit') {
      sfx.play('buy');
      this.onToast?.(`A ${ALLIES[ev.kind].name} joined the defense!`);
      c.floaters.push({ x: ev.x, y: ev.y - 24, text: '+1 helper', color: '#7cc5f2', t: 0 });
    } else if (ev.type === 'upgrade') {
      sfx.play('levelup');
      this.onToast?.(`🏠 The base was reinforced! (level ${ev.level})`);
    }
  }

  // the host's answer to a barricade request we sent
  onWaveAck(d) {
    if (d.op === 'place' && !d.ok) {
      this.giveBarricade();
      this.onToast?.('Could not set that barricade up.');
    } else if (d.op === 'pick' && d.ok) {
      this.giveBarricade();
    } else if (d.op === 'recruit' && !d.ok) {
      this.giveCoins(d.cost || 0);
      this.onToast?.(`Your team is full. Upgrade the ${this.world.apoc ? 'bus' : 'base'} (Tab) to make room for more helpers.`);
    } else if (d.op === 'upg' && !d.ok) {
      this.giveCoins(this.houseCostPaid || 0);
      this.onToast?.('The base is already as strong as it gets.');
    }
  }

  giveBarricade() {
    if (addItem(this.inventory, 'barricade', 1) > 0) {
      this.combat.drops.push({ x: this.player.x, y: this.player.y, id: 'barricade', qty: 1, age: 0 });
    }
    this.emitInventory();
  }

  // Q: set a barricade box down where the cursor points
  placeBarricade() {
    if (!this.wave) return;
    const inv = this.inventory;
    let slot = inv[this.selectedSlot]?.id === 'barricade' ? this.selectedSlot : inv.findIndex((s) => s && s.id === 'barricade');
    if (slot < 0) {
      this.onToast?.('No barricade boxes left. Monsters sometimes drop them, or pick one up with Space.');
      return;
    }
    const { x, y } = this.snapPlacement();
    if (Math.hypot(x - this.player.x, y - this.player.y) > 110) {
      this.onToast?.('Too far away. Walk closer first.');
      return;
    }
    const why = this.wave.placeCheck(x, y);
    if (why) {
      this.onToast?.(this.placeMessage(why));
      return;
    }
    if (!this.wave.requestPlace(x, y, this.placeV)) return;
    removeFromSlot(inv, slot, 1); // a guest gets the box back if the host says no
    this.emitInventory();
  }

  // While left-click is held with a wall selected, the wall stays on its tile and the mouse decides which way it faces:
  // pulled sideways it lies flat, pulled up or down it stands upright. A small wobble changes nothing.
  updateWallHold(dt) {
    const h = this.wallHold;
    if (!h) return;
    if (this.inventory[this.selectedSlot]?.id !== 'barricade') {
      this.wallHold = null;
      return;
    }
    const dx = this.mouse.x - h.mx;
    const dy = this.mouse.y - h.my;
    if (Math.hypot(dx, dy) < this.zoom * 6) return;
    const upright = Math.abs(dy) > Math.abs(dx);
    if (upright !== this.placeV) {
      this.placeV = upright;
      sfx.play('click');
    }
  }

  placeMessage(why) {
    return why === 'far' ? 'Too far away. Walk closer first.'
      : why === 'hero' ? 'Someone is standing there. Step aside first.'
        : why === 'monster' ? 'A monster is in the way.'
          : why === 'base' ? 'Too close to the base.'
            : 'Something is in the way.';
  }

  // Where a wall would go: flush with the nearest existing wall when you aim near one, otherwise on an 8px grid
  snapPlacement() {
    if (this.wallHold) return { x: this.wallHold.x, y: this.wallHold.y }; // locked in while you aim it
    const m = this.mouseWorld();
    let near = null;
    let nd = 28;
    for (const b of this.wave.barricades) {
      const d = Math.hypot(b.x - m.x, b.y - 6 - m.y);
      if (d < nd) {
        nd = d;
        near = b;
      }
    }
    const fy = m.y + 6; // the cursor points at the middle of the plank, but walls are placed by their feet
    if (near) return { x: near.x + Math.round((m.x - near.x) / 16) * 16, y: near.y + Math.round((fy - near.y) / 16) * 16 };
    return { x: Math.round(m.x / 8) * 8, y: Math.round(fy / 8) * 8 };
  }

  // ---------- coins, upgrades and recruits ----------

  coinCount() {
    return this.inventory.reduce((n, s) => n + (s && s.id === 'coin' ? s.qty : 0), 0);
  }

  spendCoins(n) {
    if (this.coinCount() < n) return false;
    let left = n;
    for (let i = 0; i < this.inventory.length && left > 0; i++) {
      const s = this.inventory[i];
      if (s && s.id === 'coin') {
        const take = Math.min(left, s.qty);
        removeFromSlot(this.inventory, i, take);
        left -= take;
      }
    }
    this.emitInventory();
    return true;
  }

  giveCoins(n) {
    if (n <= 0) return;
    const left = addItem(this.inventory, 'coin', n);
    if (left > 0) this.combat.drops.push({ x: this.player.x, y: this.player.y, id: 'coin', qty: left, age: 0 });
    this.emitInventory();
  }

  // Whoever goes down in a fight leaves a little something behind: hearts, and sometimes a Soup Can
  dropKillLoot(x, y) {
    const d = this.combat.drops;
    const spot = () => ({ x: x + (Math.random() - 0.5) * 18, y: y + (Math.random() - 0.5) * 8, qty: 1, age: 0 });
    d.push({ ...spot(), id: 'heart' }, { ...spot(), id: 'heart' });
    if (Math.random() < 0.5) d.push({ ...spot(), id: 'soupcan' });
    else if (Math.random() < 0.3) d.push({ ...spot(), id: 'hppack' });
  }

  // Wave Defense and Survival give you the shield and the dash for free; Free Roam sells them
  hasSkill(id) {
    if (this.wave) return id === 'shield' || id === 'dash';
    return !!this.skills[id];
  }

  // The equipped utility skill: 'shield', 'invis' or null (Wave Defense and Survival always have the shield)
  activeUtil() {
    if (this.wave) return 'shield';
    const s = this.skills;
    return s.equippedUtil && s[s.equippedUtil] ? s.equippedUtil : null;
  }

  // Which hold-to-charge sword skill a left-click hold triggers: 'dash', 'spiral' or null
  activeSkill() {
    if (this.wave) return 'dash';
    const s = this.skills;
    if (s.equipped === 'spiral' && s.spiral) return 'spiral';
    if (s.equipped === 'dash' && s.dash) return 'dash';
    return s.dash ? 'dash' : s.spiral ? 'spiral' : null;
  }

  // The id of the house you live in (it is the only one you can walk into)
  myHouseId() {
    return `h${this.home.x - (this.world.apoc ? 26 : 48)},${this.home.y - 14}`;
  }

  // How big the stamina pool is compared to the start: each Endurance level adds 20% in Free Roam
  // (in Wave Defense, +/-15% off every cost per level instead)
  staminaCap() {
    const l = this.upgrades.stamina;
    return this.wave ? 1 / 0.85 ** l : 1 + 0.2 * l;
  }

  // The numbers the top-left panel shows, so upgrades are visible
  statsHud() {
    const c = this.combat;
    const skill = this.activeSkill();
    return {
      melee: c.meleeDmg(),
      skill,
      skillText: skill === 'spiral' ? `r${(c.spinRadius() / 16).toFixed(1)}t · ${c.spinDmg(1).toFixed(1)}` : skill === 'dash' ? `${(c.dashDist(1) / 16).toFixed(1)}t · ${c.dashDmg(1).toFixed(1)}` : 'none',
      dashTiles: c.dashDist(1) / 16,
      dashDmg: c.dashDmg(1),
      throwBonus: c.throwBonus(),
      throwCd: c.throwCooldown(),
      staminaTotal: Math.round(100 * this.staminaCap()),
    };
  }

  // Z / X: the two quick slots
  useSupply(kind) {
    if (this.dead || this.wave) return;
    const c = this.combat;
    const item = kind === 'hp' ? ITEMS.hppack : ITEMS.soupcan;
    if (this.supplies[kind] <= 0) {
      this.onToast?.(`No ${item.name}s left. Find them in fights, or buy some in the shop (U).`);
      return;
    }
    if (kind === 'hp' && c.hp >= c.maxHp) {
      this.onToast?.('Your hearts are already full.');
      return;
    }
    if (kind === 'stam' && this.stamina >= 0.98) {
      this.onToast?.('You are not tired.');
      return;
    }
    this.supplies[kind]--;
    sfx.play(kind === 'hp' ? 'heal' : 'drink');
    if (kind === 'hp') {
      const healed = Math.min(c.maxHp - c.hp, item.heal);
      c.hp += healed;
      c.floaters.push({ x: this.player.x, y: this.player.y - 34, text: `+${Math.round(healed * 10) / 10} ♥`, color: '#ff5d7a', t: 0 });
    } else {
      this.stamina = Math.min(1, this.stamina + item.energy);
      if (this.exhausted && this.stamina >= 0.3) this.exhausted = false;
      c.floaters.push({ x: this.player.x, y: this.player.y - 34, text: '+stamina', color: '#5fc58a', t: 0 });
    }
    this.save();
  }

  // The Free Roam shop: kind is 'upgrade' | 'supply' | 'throw'
  buyShop(kind, id) {
    if (this.wave) return;
    const pay = (cost, what) => {
      if (this.spendCoins(cost)) return true;
      sfx.play('nope');
      this.onToast?.(`${what} costs ${cost} coins. You have ${this.coinCount()}.`);
      return false;
    };
    if (kind === 'upgrade') {
      const info = FREE_UPGRADES.find((u) => u.id === id);
      const level = this.upgrades[id];
      if (level >= MAX_LEVEL) return;
      if (info.needs && !this.skills[info.needs]) {
        this.onToast?.(`Buy the ${SKILL_SHOP.find((s) => s.id === info.needs).name} first.`);
        return;
      }
      if (!pay(info.cost[level], info.name)) return;
      this.upgrades[id] = level + 1;
      sfx.play('levelup');
      if (id === 'health') this.combat.refreshMaxHp(false, 1);
      this.onToast?.(`${info.icon} ${info.name} is now level ${level + 1}!`);
    } else if (kind === 'supply') {
      const info = SUPPLY_SHOP.find((s) => s.id === id);
      if (this.supplies[id] >= info.cap) {
        this.onToast?.(`You can't carry more than ${info.cap}.`);
        return;
      }
      if (!pay(info.cost, info.name)) return;
      this.supplies[id]++;
      sfx.play('buy');
    } else if (kind === 'skill') {
      const info = SKILL_SHOP.find((s) => s.id === id);
      if (this.skills[id]) return;
      if (!pay(info.cost, info.name)) return;
      this.skills[id] = true;
      // a newly bought skill is equipped straight away (one sword skill and one utility skill at a time)
      this.skills[info.sword ? 'equipped' : 'equippedUtil'] = id;
      sfx.play('levelup');
      this.onToast?.(`${info.icon} ${info.name} unlocked and equipped!`);
    } else if (kind === 'equip') {
      const info = SKILL_SHOP.find((s) => s.id === id);
      if (!this.skills[id]) return;
      this.skills[info.sword ? 'equipped' : 'equippedUtil'] = id;
      this.onToast?.(`${info.icon} ${info.name} equipped.`);
    } else if (kind === 'throw') {
      const info = THROW_SHOP.find((t) => t.item === id);
      if (!pay(info.cost, ITEMS[id].name)) return;
      sfx.play('buy');
      const left = addItem(this.inventory, id, info.qty);
      if (left > 0) this.combat.drops.push({ x: this.player.x, y: this.player.y, id, qty: left, age: 0 });
      this.emitInventory();
    }
    this.save();
    this.emitHud();
  }

  buyUpgrade(id) {
    if (!this.wave) return;
    const info = UPGRADES.find((u) => u.id === id);
    const house = id === 'house';
    const level = house ? this.wave.baseLevel || 0 : this.upgrades[id];
    if (level >= MAX_LEVEL) {
      this.onToast?.(`${info.name} is already at its best.`);
      return;
    }
    const cost = upgradeCost(id, level);
    if (!this.spendCoins(cost)) {
      this.onToast?.(`${info.name} costs ${cost} coins. You have ${this.coinCount()}.`);
      return;
    }
    if (house) {
      this.houseCostPaid = cost; // handed back if the host says the base is already maxed
      if (this.wave.upgradeBase() === false) this.giveCoins(cost);
      return;
    }
    this.upgrades[id] = level + 1;
    this.onToast?.(`${info.icon} ${info.name} is now level ${level + 1}!`);
  }

  // Stand on a glowing pad for a moment and the coins go in; a helper turns up
  updatePads(dt) {
    const p = this.player;
    for (const pad of this.wave.pads) {
      const st = (this.padState[pad.kind] ||= { hold: 0, cd: 0 });
      st.cd = Math.max(0, st.cd - dt);
      const on = Math.abs(p.x - pad.x) < 9 && Math.abs(p.y - 3 - pad.y) < 7;
      if (on && st.cd <= 0 && !this.dead) {
        st.hold += dt;
        if (st.hold >= 0.35) {
          st.hold = 0;
          st.cd = 1.6;
          this.tryRecruit(pad.kind);
        }
      } else if (!on) {
        st.hold = 0;
      }
    }
  }

  tryRecruit(kind) {
    const def = ALLIES[kind];
    if (!this.spendCoins(def.cost)) {
      this.onToast?.(`A ${def.name} costs ${def.cost} coins. You have ${this.coinCount()}.`);
      return;
    }
    if (this.wave.recruit(kind) === false) {
      this.giveCoins(def.cost);
      this.onToast?.(`Your team is full. Upgrade the ${this.world.apoc ? 'bus' : 'base'} (Tab) to make room for more helpers.`);
    }
    // a guest's request comes back as an 'ack', which refunds the coins if the host said no
  }

  nearBarricade() {
    let best = null;
    let bd = 24;
    for (const b of this.wave.barricades) {
      const d = Math.hypot(b.x - this.player.x, b.y - 6 - this.player.y);
      if (d < bd) {
        bd = d;
        best = { inter: 'barricade', id: b.id, x: b.x, y: b.y };
      }
    }
    return best;
  }

  pickBarricade(id) {
    if (this.wave.requestPick(id) === true) this.giveBarricade();
  }

  // H: arrive back at the house's front door
  recallHome() {
    this.goHome();
    this.onToast?.('Whoosh! Back at the base.');
  }

  // Survival's zombies: a walking strip for each of four directions, and a death strip for sideways falls
  drawZombie(ctx, m, def) {
    const sc = def.scale || 1;
    const dead = m.state === 'dead';
    const way = ['down', 'up', 'side', 'left'][m.dirv ?? 0];
    const frames = ZOMBIE_FRAMES[def.apoc];
    const sheet = this.img[dead ? `apoc/z_${def.apoc}_death_${m.dirv === 3 ? 'left' : 'side'}` : `apoc/z_${def.apoc}_walk_${way}`];
    const n = dead ? frames.death : frames.walk;
    const fw = sheet.width / n;
    const fh = sheet.height;
    const frame = dead ? Math.min(n - 1, Math.floor((m.t / 0.5) * n)) : Math.floor(m.anim * 9) % n;
    const x = Math.round(m.x);
    const y = Math.round(m.y);

    ctx.fillStyle = 'rgba(30,20,30,0.28)';
    ctx.fillRect(x - 5 * sc, y - 1, 10 * sc, 2 + sc);
    ctx.save();
    if (dead) ctx.globalAlpha = Math.max(0, 1.4 - m.t * 2);
    const dx = -Math.round((fw * sc) / 2) + (m.atk > 0 && !dead ? m.face * 2 : 0);
    ctx.drawImage(sheet, frame * fw, 0, fw, fh, x + dx, y - fh * sc, fw * sc, fh * sc);
    if (m.state === 'hurt') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5;
      ctx.drawImage(sheet, frame * fw, 0, fw, fh, x + dx, y - fh * sc, fw * sc, fh * sc);
    }
    ctx.restore();

    if (!dead && (m.hp < m.max || m.wild)) {
      const w = Math.max(12, fw * sc * 0.7);
      const by = y - fh * sc - 4;
      ctx.fillStyle = 'rgba(40,20,30,0.8)';
      ctx.fillRect(x - w / 2 - 1, by - 1, w + 2, 4);
      ctx.fillStyle = '#e8506a';
      ctx.fillRect(x - w / 2, by, Math.max(1, Math.round(w * (m.hp / m.max))), 2);
    }
  }

  drawMonster(ctx, m) {
    const def = MONSTERS[m.type];
    if (def.apoc) {
      this.drawZombie(ctx, m, def);
      return;
    }
    const sc = def.scale || 1;
    const box = this.mbox[def.sprite];
    const sheet = this.img[`monsters/${def.sprite}`];
    const flyer = def.kind === 'fly' || def.fly;
    const frame = Math.floor(m.anim * 6) % 4;
    const hover = flyer ? 7 + Math.sin(m.anim * 4) * 1.5 : 0;
    const x = Math.round(m.x);
    const y = Math.round(m.y);
    const dead = m.state === 'dead';

    ctx.fillStyle = 'rgba(60,40,30,0.22)';
    ctx.fillRect(x - 5 * sc, y - 1, 10 * sc, 2 + sc);
    ctx.save();
    ctx.translate(x + (m.atk > 0 ? m.face * 2 : 0), Math.round(y - hover));
    if (m.face < 0) ctx.scale(-1, 1);
    if (dead) {
      ctx.globalAlpha = Math.max(0, 1 - m.t / 0.5);
      ctx.scale(1, Math.max(0.2, 1 - m.t * 1.4));
    }
    const dy = -(box.bottom + 1) * sc;
    ctx.drawImage(sheet, frame * 16, 0, 16, 16, -8 * sc, dy, 16 * sc, 16 * sc);
    if (m.state === 'hurt') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.55;
      ctx.drawImage(sheet, frame * 16, 0, 16, 16, -8 * sc, dy, 16 * sc, 16 * sc);
    }
    ctx.restore();

    if (!dead && (m.hp < m.max || m.wild)) {
      const w = Math.max(10, (box.right - box.left + 1) * sc);
      const by = y - hover - (box.bottom - box.top + 1) * sc - 4;
      ctx.fillStyle = 'rgba(60,40,30,0.75)';
      ctx.fillRect(x - w / 2 - 1, by - 1, w + 2, 4);
      ctx.fillStyle = '#ff7a8f';
      ctx.fillRect(x - w / 2, by, Math.max(1, Math.round(w * (m.hp / m.max))), 2);
    }
  }

  // A tree standing guard; it turns into a stump as it takes a beating
  // Survival's barricades are wooden planks: flat along the top and bottom, upright down the sides
  drawWall(ctx, b) {
    const x = Math.round(b.x);
    const y = Math.round(b.y);
    const ratio = b.hp / b.max;
    const im = this.img[`apoc/${b.r ? 'rwall' : 'wall'}_${b.v ? 'v' : 'h'}`];
    const top = y - im.height + 2;
    ctx.fillStyle = 'rgba(30,20,30,0.25)';
    ctx.fillRect(x - Math.floor(im.width / 2), y, im.width, 2);
    ctx.save();
    if (ratio < 0.34) ctx.globalAlpha = 0.72;
    ctx.drawImage(im, x - Math.round(im.width / 2), top);
    if (ratio < 0.67) {
      // splintered planks
      ctx.fillStyle = 'rgba(20,12,12,0.5)';
      ctx.fillRect(x - 3, top + 3, 1, 4);
      ctx.fillRect(x + 2, top + 6, 1, 5);
      if (ratio < 0.34) ctx.fillRect(x - 1, top + 8, 3, 1);
    }
    ctx.restore();
    if (ratio < 1) {
      const by = top - 4;
      ctx.fillStyle = 'rgba(40,20,30,0.8)';
      ctx.fillRect(x - 8, by - 1, 16, 4);
      ctx.fillStyle = ratio > 0.5 ? '#7fd48f' : ratio > 0.25 ? '#f2b05e' : '#ee5d7d';
      ctx.fillRect(x - 7, by, Math.max(1, Math.round(14 * ratio)), 2);
    }
  }

  drawBarricade(ctx, b) {
    if (this.world.apoc) {
      this.drawWall(ctx, b);
      return;
    }
    const x = Math.round(b.x);
    const y = Math.round(b.y);
    const ratio = b.hp / b.max;
    ctx.fillStyle = 'rgba(60,40,30,0.2)';
    ctx.fillRect(x - 7, y - 1, 14, 3);
    if (ratio > 0.34) ctx.drawImage(this.img.trees, 71, 14, 20, 33, x - 10, y - 31, 20, 33);
    else ctx.drawImage(this.img.trees, 137, 35, 14, 12, x - 7, y - 11, 14, 12);
    if (ratio < 1) {
      const top = ratio > 0.34 ? y - 34 : y - 14;
      ctx.fillStyle = 'rgba(60,40,30,0.75)';
      ctx.fillRect(x - 8, top - 1, 16, 4);
      ctx.fillStyle = ratio > 0.5 ? '#7fd48f' : ratio > 0.25 ? '#f2b05e' : '#ee5d7d';
      ctx.fillRect(x - 7, top, Math.max(1, Math.round(14 * ratio)), 2);
    }
  }

  // Glowing plates on the ground: stand on one with enough coins to hire a helper
  drawPads(ctx) {
    for (const pad of this.wave.pads) {
      const def = ALLIES[pad.kind];
      const st = this.padState[pad.kind];
      const x = Math.round(pad.x);
      const y = Math.round(pad.y);
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 3 + pad.x);
      ctx.fillStyle = 'rgba(30,26,40,0.62)';
      ctx.fillRect(x - 8, y - 5, 16, 10);
      ctx.globalAlpha = 0.3 + 0.3 * pulse;
      ctx.fillStyle = def.color;
      ctx.fillRect(x - 7, y - 4, 14, 8);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 7.5, y - 4.5, 15, 9);
      ctx.fillStyle = '#ffd24d';
      ctx.fillRect(x - 2, y - 2, 4, 4);
      ctx.fillStyle = '#b8860b';
      ctx.fillRect(x - 1, y - 1, 2, 2);
      if (st?.hold > 0) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(x - 7, y + 6, Math.round((14 * st.hold) / 0.35), 1);
      }
    }
  }

  // price tags for pads you are close to
  drawPadLabels(camX, camY) {
    for (const pad of this.wave.pads) {
      if (Math.hypot(pad.x - this.player.x, pad.y - this.player.y) > 44) continue;
      const def = ALLIES[pad.kind];
      const [sx, sy] = this.toScreen(pad.x, pad.y - 12, camX, camY);
      this.pill(`🪙 ${def.cost} · ${def.name}`, sx, sy, this.zoom * 3.8, '#fff', def.color);
    }
  }

  // A hired helper: a hero-style character with a coloured ring and rank pips
  drawAlly(ctx, a) {
    const def = ALLIES[a.kind];
    const hero = this.world.apoc ? SURVIVOR : heroById(def.hero);
    const dir = ['down', 'up', 'right', 'left'][a.dir || 0];
    const x = Math.round(a.x);
    const y = Math.round(a.y);
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.ellipse(x, y - 1, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    this.drawHeroAt(ctx, hero, dir, a.moving, a.anim, a.x, a.y);
    const width = def.pips * 3 - 1;
    for (let i = 0; i < def.pips; i++) {
      ctx.fillStyle = def.color;
      ctx.fillRect(Math.round(x - width / 2) + i * 3, y - tagHeight(hero) + 5, 2, 2);
    }
  }

  // enemy shots, the house's health, and a ghost of the barricade you are about to place
  drawWaveExtras(ctx) {
    const w = this.wave;
    this.ghostWhy = null;
    for (const s of w.shots) {
      ctx.fillStyle = s.spit ? '#8fe35a' : '#f4e9cf';
      ctx.fillRect(Math.round(s.x) - 1, Math.round(s.y) - 1, 3, 3);
      ctx.fillStyle = s.spit ? '#4c9a2c' : '#8a6a44';
      ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
    }
    const st = w.hudState();
    const { x: bx, y: by, w: bw } = w.bar;
    ctx.fillStyle = 'rgba(60,40,30,0.8)';
    ctx.fillRect(bx - 1, by - 1, bw + 2, 6);
    ctx.fillStyle = st.baseHp / st.baseMax > 0.4 ? '#7fd48f' : '#ee5d7d';
    ctx.fillRect(bx, by, Math.max(1, Math.round(bw * (st.baseHp / st.baseMax))), 4);

    const held = this.inventory[this.selectedSlot];
    if (held?.id === 'barricade' && !this.paused) {
      const { x, y } = this.snapPlacement();
      const why = Math.hypot(x - this.player.x, y - this.player.y) > 110 ? 'far' : w.placeCheck(x, y);
      const ok = !why;
      if (why) this.ghostWhy = { x, y, why };
      ctx.globalAlpha = 0.55;
      if (this.world.apoc) {
        const im = this.img[`apoc/wall_${this.placeV ? 'v' : 'h'}`];
        ctx.drawImage(im, x - Math.round(im.width / 2), y - im.height + 2);
      } else {
        ctx.drawImage(this.img.trees, 71, 14, 20, 33, x - 10, y - 31, 20, 33);
      }
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = ok ? '#5fe08a' : '#ff5d5d';
      ctx.fillRect(x - 8, y - 14, 16, 16);
      ctx.globalAlpha = 1;
    }
  }

  // ---------- multiplayer ----------

  addRemote(p) {
    this.remotes.set(p.id, {
      id: p.id,
      name: p.name,
      // in Survival everyone is a survivor, in whichever jacket colour they picked
      slot: p.slot,
      hero: this.world.apoc ? (String(p.hero).startsWith('survivor') ? heroById(p.hero) : SURVIVOR) : heroById(p.hero),
      x: p.x ?? 0,
      y: p.y ?? 0,
      tx: p.x ?? 0,
      ty: p.y ?? 0,
      dir: p.dir || 'down',
      moving: false,
      hp: p.hp ?? 6,
      lv: p.lv || 1,
      hidden: !!p.hidden,
      shield: 0,
      animT: 0,
      bubble: null,
      swing: null,
      spin: null,
      mt: p.mt || '', // what they are riding
      variant: [...String(p.id)].reduce((n, c) => n + c.charCodeAt(0), 0) % 2, // which colour of animal
      color: this.remotes.size % PEER_COLORS.length,
    });
    if (p.team !== undefined && p.team !== null) this.teamMap[p.id] = p.team;
  }

  // ---------- teams ----------

  myTeam() {
    return this.mp ? this.teamMap[this.mp.you] : undefined;
  }

  teamOf(r) {
    return this.teamCount ? this.teamMap[r.id] : undefined;
  }

  sameTeam(r) {
    const t = this.teamOf(r);
    return t !== undefined && t !== null && t === this.myTeam();
  }

  // the colour of a player's name, ring and health bar
  peerColor(r) {
    const t = this.teamOf(r);
    return t !== undefined && t !== null && TEAMS[t] ? TEAMS[t].color : PEER_COLORS[r.color];
  }

  // a coloured ring under everyone's feet in a team game
  drawTeamRing(ctx, x, y, team) {
    if (team === undefined || team === null || !TEAMS[team]) return;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = TEAMS[team].color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(Math.round(x), Math.round(y), 8, 3.2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // how high another player's mount lifts them
  remoteLift(r) {
    return r.mt === 'cow' ? 11 : r.mt === 'chicken' ? 5 : 0;
  }

  onNetMessage(m) {
    if (m.t === 'peer_join') {
      this.addRemote(m.player);
    } else if (m.t === 'peer_leave') {
      this.remotes.delete(m.id);
      delete this.teamMap[m.id];
    } else if (m.t === 'teams') {
      this.teamMap = { ...m.teams };
    } else if (m.t === 'state') {
      const r = this.remotes.get(m.id);
      if (!r) return;
      if (this.fight && r.hp > 0 && m.hp <= 0) this.dropKillLoot(r.x, r.y);
      r.tx = m.x;
      r.ty = m.y;
      r.dir = m.dir;
      r.moving = m.moving;
      r.hp = m.hp;
      if (m.lv) r.lv = m.lv;
      r.mt = m.mt || '';
      r.hidden = !!m.hidden;
    } else if (m.t === 'hit') {
      this.combat.hitByPlayer(m);
    } else if (m.t === 'kill') {
      this.streaks.kill(String(m.killerId), String(m.victimId), { killer: m.killer, victim: m.victim }, m.killerId === this.mp.you);
    } else if (m.t === 'fell') {
      this.streaks.died(String(m.id));
    } else if (m.t === 'win') {
      this.streaks.reset();
      sfx.play(m.id === this.mp.you ? 'win' : 'wave');
      // the server sends everyone back to the waiting room once the cheering is over
      this.celebrate(m.id, m.name, 6.9, 'Back to the room in a moment…');
      if (m.team !== undefined && m.team !== null && this.celeb) this.celeb.team = m.team; // a team won: everyone on it shares the cheer
    } else if (m.t === 'fx' && m.kind === 'shield') {
      const r = this.remotes.get(m.id);
      if (r) r.shield = SHIELD_DUR;
    } else if (m.t === 'fx' && m.kind === 'throw') {
      if (ITEMS[m.item]) this.combat.remoteShots.push({ x: m.x, y: m.y, vx: m.vx, vy: m.vy, id: m.item, rot: 0, life: throwStats(m.item).life });
    } else if (m.t === 'w') {
      this.wave?.onMessage(m.k, m.d, m.from);
    } else if (m.t === 'chat') {
      const r = this.remotes.get(m.id);
      if (r) r.bubble = { text: m.text, t: 0 };
    } else if (m.t === 'fx' && m.kind === 'swing') {
      const r = this.remotes.get(m.id);
      if (r) r.swing = { t: 0, a: m.a };
    } else if (m.t === 'fx' && m.kind === 'spin') {
      const r = this.remotes.get(m.id);
      if (r) r.spin = { t: 0, dur: m.d || 0.6, a0: m.a || 0, r: Math.min(80, m.r || 40) };
    }
  }

  updateMultiplayer(dt) {
    const p = this.player;
    this.mp.sendT -= dt;
    if (this.mp.sendT <= 0) {
      this.mp.sendT = 0.07;
      this.mp.net.send({ t: 'state', x: p.x, y: p.y, dir: p.dir, moving: p.moving, hp: this.combat.hp, lv: (this.upgrades.melee || 0) + 1, hidden: this.combat.hidden, mt: this.mount?.type || '' });
    }
    const k = 1 - Math.exp(-dt * 12);
    for (const r of this.remotes.values()) {
      // snap if we are far apart (first packet, teleport), otherwise glide
      if (Math.hypot(r.tx - r.x, r.ty - r.y) > 160) {
        r.x = r.tx;
        r.y = r.ty;
      } else {
        r.x += (r.tx - r.x) * k;
        r.y += (r.ty - r.y) * k;
      }
      r.animT += dt;
      if (r.bubble && (r.bubble.t += dt) > 5) r.bubble = null;
      if (r.swing && (r.swing.t += dt) > 0.24) r.swing = null;
      if (r.spin && (r.spin.t += dt) > r.spin.dur) r.spin = null;
      if (r.shield > 0) r.shield -= dt;
    }
    if (this.myBubble && (this.myBubble.t += dt) > 5) this.myBubble = null;
  }

  sendChat(text) {
    this.myBubble = { text, t: 0 };
    this.mp?.net.send({ t: 'chat', text });
  }

  teleportToPeer(id) {
    const r = this.remotes.get(id);
    if (!r) return;
    this.player.x = r.x + 14;
    this.player.y = r.y + 4;
    this.cam.x = this.player.x;
    this.cam.y = this.player.y;
    this.onToast?.(`Hopped over to ${r.name}!`);
  }

  // Where the cursor points in world pixels
  mouseWorld() {
    return { x: this.camX + this.mouse.x / this.zoom, y: this.camY + this.mouse.y / this.zoom };
  }

  resize() {
    const parent = this.canvas.parentElement || this.canvas;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(parent.clientWidth * dpr));
    const h = Math.max(1, Math.round(parent.clientHeight * dpr));
    this.canvas.width = w;
    this.canvas.height = h;
    this.baseZoom = Math.max(2, Math.round(Math.min(w, h) / 230));
    this.zoom = Math.min(10, Math.max(1, this.baseZoom + this.zoomOffset));
    this.viewW = w / this.zoom;
    this.viewH = h / this.zoom;
  }

  zoomBy(step) {
    const next = Math.min(MAX_ZOOM_OFFSET, Math.max(MIN_ZOOM_OFFSET, this.zoomOffset + step));
    if (next === this.zoomOffset) return;
    this.zoomOffset = next;
    this.resize();
  }

  // 0 in full daylight, up to 1 in the dead of night
  darkness() {
    const g = skyTint(this.hour)[1];
    return Math.min(1, Math.max(0, (255 - g) / 150));
  }

  loop(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000 || 0);
    this.last = now;
    this.t += dt;
    if (this.frozen) {
      // the opening scene is on top: the world waits
    } else if (!this.paused || this.mp) this.update(dt); // in a room the world carries on while you shop or read
    else if (!this.demo) {
      // paused menus (shop, backpack...) still need fresh numbers on screen
      this.hudTimer -= dt;
      if (this.hudTimer <= 0) {
        this.hudTimer = 0.15;
        this.emitHud();
      }
    }
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  }

  // ---------- simulation ----------

  // `who` is 'bot' for a computer rival, who never goes indoors; you may only enter your own house
  blocked(x, y, who) {
    // heroes can wade through water, so only trees, walls and the like stop them
    if (this.world.isBlocked(x - FOOT_W / 2, y - FOOT_H, FOOT_W, FOOT_H, true)) return true;
    if (this.mount) {
      // farm animals will not swim or go indoors
      if (this.world.type(Math.floor(x / T), Math.floor((y - 2) / T)) === WATER) return true;
      // ...but your own house is fine: you can ride right in (other people's stay shut, see below)
      const h = this.world.houseAt(x, y - 2) || this.world.doorAt(x, y);
      if (h && (this.wave || h.id !== this.myHouseId())) return true;
    }
    if (this.wave || this.demo) return false;
    const house = this.world.houseAt(x, y - 2) || this.world.doorAt(x, y);
    if (house && (who === 'bot' || house.id !== this.myHouseId())) {
      if (!who) this.bumpedHouse = house.id;
      return true;
    }
    return false;
  }

  update(dt) {
    const p = this.player;
    if (this.demo) {
      this.cam.x += dt * 7;
      this.cam.y += Math.sin(this.t * 0.15) * dt * 4;
    } else {
      let dx = this.dead || this.celeb ? 0 : (this.keys.has('right') ? 1 : 0) - (this.keys.has('left') ? 1 : 0);
      let dy = this.dead || this.celeb ? 0 : (this.keys.has('down') ? 1 : 0) - (this.keys.has('up') ? 1 : 0);
      const dashing = !!this.combat.dash; // the dash moves the hero itself
      p.moving = dashing || dx !== 0 || dy !== 0;
      // wading is slow going, and too splashy to sprint
      this.inWater = this.world.type(Math.floor(p.x / T), Math.floor((p.y - 2) / T)) === WATER;
      // a mount has its own, bigger stamina pool: sprinting tires the animal and spares you
      const m = this.mount;
      const tired = m ? m.exhausted : this.exhausted;
      const wantsSprint = p.moving && this.keys.has('sprint') && !tired && !this.inWater;
      this.sprinting = wantsSprint;
      if (m) {
        const pool = m.type === 'chicken' ? MOUNT_POOL.chicken : MOUNT_POOL.cow;
        m.stamina = m.stamina ?? 1;
        if (wantsSprint) {
          m.stamina = Math.max(0, m.stamina - (0.28 / pool) * dt);
          if (m.stamina === 0) m.exhausted = true;
        } else {
          m.stamina = Math.min(1, m.stamina + (p.moving ? 0.12 : 0.3) * dt);
          if (m.exhausted && m.stamina >= 0.3) m.exhausted = false;
        }
        // your own stamina recovers while the animal does the running
        this.stamina = Math.min(1, this.stamina + 0.3 * (1 + 0.25 * this.upgrades.stamina) * dt);
        if (this.exhausted && this.stamina >= 0.3) this.exhausted = false;
      } else if (wantsSprint) {
        this.stamina = Math.max(0, this.stamina - (0.28 / this.staminaCap()) * dt);
        if (this.stamina === 0) this.exhausted = true;
      } else {
        this.stamina = Math.min(1, this.stamina + (p.moving ? 0.12 : 0.3) * (1 + 0.25 * this.upgrades.stamina) * dt);
        if (this.exhausted && this.stamina >= 0.3) this.exhausted = false;
      }
      const ride = this.mount ? (this.mount.type === 'chicken' ? 1.35 : 1.15) : 1; // a chicken hurries, a cow ambles along
      const speed = SPEED * ride * (this.sprinting ? SPRINT_MULT : 1) * (this.inWater ? WADE_SLOWDOWN : 1);
      this.animT += dt * (this.sprinting ? 1.7 : 1);
      if (p.moving && !dashing) {
        if (dx && dy) {
          dx *= Math.SQRT1_2;
          dy *= Math.SQRT1_2;
        }
        if (Math.abs(dx) >= Math.abs(dy)) p.dir = dx > 0 ? 'right' : 'left';
        else p.dir = dy > 0 ? 'down' : 'up';
        const nx = p.x + dx * speed * dt;
        if (!this.blocked(nx, p.y)) p.x = nx;
        const ny = p.y + dy * speed * dt;
        if (!this.blocked(p.x, ny)) p.y = ny;
        if (this.bumpedHouse) {
          // someone else's front door: say whose it is, now and then
          if (this.t - (this.bumpToastAt ?? -9) > 2.5) {
            this.bumpToastAt = this.t;
            const id = this.bumpedHouse;
            const owner = this.houseOwners().find((o) => `h${o.home.x - 48},${o.home.y - 14}` === id);
            this.onToast?.(owner ? `🔒 That's ${owner.name}'s house.` : "🔒 That's not your house.");
          }
        }
        this.bumpedHouse = null;
      }
      this.updateMount(dt);
      // while downed, the camera drifts over to whoever did it
      // and when a round is won, over to the winner
      const focus = this.dead ? this.killerPoint() || { x: p.x, y: p.y } : this.celeb ? this.celebPoint() || p : p;
      const k = 1 - Math.exp(-dt * (this.dead || this.celeb ? 3.5 : 9));
      this.cam.x += (focus.x - this.cam.x) * k;
      this.cam.y += (focus.y - 10 - this.cam.y) * k;
    }

    this.updateAnimals(dt);
    if (!this.demo) {
      if (!this.dead) this.updateInteraction();
      this.updateDeath(dt);
      if (this.mouseHeld[2] && !this.dead && !this.celeb) this.combat.throwSelected(this.selectedSlot);
      this.updateCelebration(dt);
      this.updateWallHold(dt);
      this.combat.update(dt);
      this.bots?.update(dt);
      this.wave?.update(dt);
      if (this.mp) {
        // everyone in the room reads the same clock
        const total = this.mp.clockHour + ((performance.now() - this.mp.clockAt) / 1000) * HOURS_PER_SECOND;
        this.hour = total % 24;
        this.day = this.mp.clockDay + Math.floor(total / 24) - Math.floor(this.mp.clockHour / 24);
        this.updateMultiplayer(dt);
      } else {
        this.hour += dt * HOURS_PER_SECOND;
        if (this.hour >= 24) {
          this.hour -= 24;
          this.day++;
        }
      }
      this.hudTimer -= dt;
      if (this.hudTimer <= 0) {
        this.hudTimer = 0.15;
        this.emitHud();
      }
      this.saveTimer -= dt;
      if (this.saveTimer <= 0) {
        this.saveTimer = 5;
        this.save();
      }
      this.miniTimer -= dt;
      if (this.miniTimer <= 0) {
        this.miniTimer = 0.2;
        this.drawMinimap();
      }
    }
  }

  // everything the React HUD shows; sent a few times a second
  emitHud() {
    const p = this.player;
    this.onHud?.({
      tx: Math.floor(p.x / T),
      ty: Math.floor(p.y / T),
      treasures: this.treasures,
      foraged: this.foraged,
      stamina: this.stamina,
      exhausted: this.exhausted,
      sprinting: this.sprinting,
      hour: this.hour,
      day: this.day,
      zoom: this.zoom,
      hidden: this.combat.hidden && !this.dead,
      dead: this.dead ? { name: this.killerName(), left: Math.max(0, this.dead.dur - this.dead.t), total: this.dead.dur } : null,
      wave: this.wave?.hudState() || null,
      fight: this.bots?.scoreboard() || null,
      upg: this.upgrades,
      stats: this.statsHud(),
      supplies: { ...this.supplies },
      mount: this.mount ? { type: this.mount.type, hp: this.mount.hp ?? MOUNT_HP[this.mount.type], maxHp: MOUNT_HP[this.mount.type], stamina: this.mount.stamina ?? 1, exhausted: !!this.mount.exhausted, total: Math.round(100 * (MOUNT_POOL[this.mount.type] || 1)) } : null,
      mkills: this.winBy === 'monsters' && !this.mp ? { count: this.monsterKills, target: MONSTER_TARGET } : null,
      celeb: this.celeb ? { name: this.celeb.name, mine: this.celebMine(), sub: this.celeb.sub } : null,
      skills: { ...this.skills },
      activeSkill: this.activeSkill(),
      util: this.activeUtil(),
      invisT: this.combat.invisT,
      invisCd: this.combat.invisCd,
      coins: this.coinCount(),
      tEnergy: this.combat.tEnergy,
      tLocked: this.combat.tLocked,
      recallCd: this.combat.recallCd,
      recallT: this.combat.recallT,
      inWater: this.inWater,
      shieldT: this.combat.shieldT,
      shieldCd: this.combat.shieldCd,
      dashCd: this.combat.dashCd,
      hp: this.combat.hp,
      maxHp: this.combat.maxHp,
      kills: this.combat.kills,
    });
  }

  nearbyObjects(cx, cy, radius = 1) {
    const list = [];
    for (let j = -radius; j <= radius; j++) {
      for (let i = -radius; i <= radius; i++) list.push(...this.world.getChunk(cx + i, cy + j).objects);
    }
    return list;
  }

  updateInteraction() {
    const p = this.player;
    const cx = Math.floor(p.x / CHUNK_PX);
    const cy = Math.floor(p.y / CHUNK_PX);
    let best = null;
    let bestD = 22;
    for (const o of this.nearbyObjects(cx, cy)) {
      if (!o.inter || this.collected.has(o.id)) continue;
      const d = Math.hypot(o.x - p.x, o.y - 4 - p.y);
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    if (!best && this.wave) best = this.nearBarricade();
    if (!best) best = this.waterAhead();
    this.prompt = best;
    if (this.interactPressed && best?.inter === 'water') {
      this.stamina = Math.min(1, this.stamina + 0.3);
      if (this.exhausted && this.stamina >= 0.3) this.exhausted = false;
      sfx.play('drink');
      this.onToast?.('Ahh, cool and fresh water! Stamina up.');
    } else if (this.interactPressed && best?.inter === 'barricade') {
      this.pickBarricade(best.id);
    } else if (this.interactPressed && best) {
      const seed = this.world.seed;
      const loot = this.world.apoc ? LOOT_APOC : undefined;
      const drops = best.inter === 'chest'
        ? [rollLoot(hash2(best.x, best.y, seed), hash2(best.y, best.x, seed), loot), rollLoot(hash2(best.x, 1, seed + 3), hash2(1, best.y, seed + 3), loot)]
        : [{ item: best.forage.item, qty: 1 }];
      // merge duplicate rolls so the space check is exact
      const merged = drops.reduce((m, d) => ({ ...m, [d.item]: (m[d.item] || 0) + d.qty }), {});
      const trial = this.inventory.map((slot) => slot && { ...slot });
      const fits = Object.entries(merged).every(([id, qty]) => addItem(trial, id, qty) === 0);
      if (!fits) {
        this.onToast?.('Your backpack is full!');
      } else {
        this.collected.add(best.id);
        sfx.play(best.inter === 'chest' ? 'chest' : 'forage');
        for (const [id, qty] of Object.entries(merged)) addItem(this.inventory, id, qty);
        const text = Object.entries(merged).map(([id, qty]) => (qty > 1 ? `${qty}× ${ITEMS[id].name}` : ITEMS[id].name)).join(' & ');
        if (best.inter === 'chest') {
          this.treasures++;
          this.onToast?.(`You found ${text}!`);
        } else {
          this.foraged++;
          this.onToast?.(`You picked up ${text}.`);
        }
        this.emitInventory();
        this.save();
      }
    }
    this.interactPressed = false;
  }

  // A water tile just in front of the hero counts as a drinking spot
  waterAhead() {
    const p = this.player;
    const [vx, vy] = DIR_VEC[p.dir];
    const x = p.x + vx * 10;
    const y = p.y - 2 + vy * 10;
    if (this.world.type(Math.floor(x / T), Math.floor(y / T)) !== WATER) return null;
    return { inter: 'water', x: p.x + vx * 6, y: p.y + vy * 6 + 4 };
  }

  emitInventory() {
    if (this.wave && !this.inventory.some((s) => s?.id === 'sword')) addItem(this.inventory, 'sword', 1); // never without a weapon
    this.onInventory?.(this.inventory.map((slot) => slot && { ...slot }));
  }

  moveItem(from, to) {
    moveSlot(this.inventory, from, to);
    this.emitInventory();
  }

  tossItem(i, all = false) {
    const slot = this.inventory[i];
    if (!slot) return;
    if (slot.id === 'sword') {
      this.onToast?.('You need your weapon!');
      return;
    }
    removeFromSlot(this.inventory, i, all ? slot.qty : 1);
    this.emitInventory();
    this.save();
  }

  useItem(i) {
    const slot = this.inventory[i];
    const def = slot && ITEMS[slot.id];
    if (!def || !isConsumable(def)) return;
    if (this.mount) {
      this.feedMount(i, def);
      return;
    }
    removeFromSlot(this.inventory, i, 1);
    const c = this.combat;
    const healed = Math.min(c.maxHp - c.hp, def.heal || 0);
    c.hp = Math.min(c.maxHp, c.hp + (def.heal || 0));
    this.stamina = Math.min(1, this.stamina + (def.energy || 0));
    if (this.exhausted && this.stamina >= 0.3) this.exhausted = false;
    const bits = [];
    if (healed > 0) bits.push(`+${Math.round(healed * 10) / 10} HP`);
    if (def.energy) bits.push('+stamina');
    this.onToast?.(`${(def.energy || 0) * 2 >= (def.heal || 0) && def.energy ? 'Glug!' : 'Yum!'} ${def.name}${bits.length ? ` (${bits.join(', ')})` : ''}.`);
    sfx.play(def.energy && !def.heal ? 'drink' : 'eat');
    this.emitInventory();
    this.save();
  }

  // While riding, food goes to the animal: hearts heal it, energy tops up its stamina
  feedMount(i, def) {
    const m = this.mount;
    const max = MOUNT_HP[m.type];
    m.hp ??= max;
    m.stamina ??= 1;
    const name = m.type === 'cow' ? 'cow' : 'chicken';
    const heal = Math.min(max - m.hp, def.heal || 0);
    const boost = Math.min(1 - m.stamina, def.energy || 0);
    if (heal <= 0 && boost <= 0) {
      this.onToast?.(`Your ${name} is already in top shape.`);
      return;
    }
    removeFromSlot(this.inventory, i, 1);
    m.hp = Math.min(max, m.hp + (def.heal || 0));
    m.stamina = Math.min(1, m.stamina + (def.energy || 0));
    if (m.exhausted && m.stamina >= 0.3) m.exhausted = false;
    if (heal > 0) this.combat.floaters.push({ x: this.player.x, y: this.player.y - 26, text: `+${Math.round(heal * 10) / 10} ♥`, color: '#ff5d7a', t: 0 });
    this.onToast?.(`Your ${name} munches the ${def.name}${heal > 0 ? ` (+${Math.round(heal * 10) / 10} HP)` : ''}${boost > 0 ? ' and perks up' : ''}.`);
    sfx.play('eat');
    this.emitInventory();
  }

  // A hit that would have landed on the rider lands on the mount. At zero it is knocked out and you drop to the ground.
  hurtMount(n) {
    const m = this.mount;
    if (!m) return;
    const max = MOUNT_HP[m.type];
    m.hp = (m.hp ?? max) - n;
    this.combat.floaters.push({ x: this.player.x, y: this.player.y - 26, text: `-${n} ♥`, color: '#ff5d7a', t: 0 });
    sfx.play('hurt');
    if (m.hp > 0) return;
    this.animals = this.animals.filter((a) => a !== m);
    this.mount = null;
    this.spaceLock = true;
    this.combat.invuln = Math.max(this.combat.invuln, 1.2);
    this.onToast?.(`Your ${m.type === 'cow' ? 'cow' : 'chicken'} was knocked out! You land on the ground.`);
  }

  updateAnimals(dt) {
    const ccx = Math.floor(this.cam.x / CHUNK_PX);
    const ccy = Math.floor(this.cam.y / CHUNK_PX);
    for (let j = -2; j <= 2; j++) {
      for (let i = -2; i <= 2; i++) {
        const key = `${ccx + i},${ccy + j}`;
        if (this.spawned.has(key)) continue;
        this.spawned.add(key);
        for (const a of this.world.animalSpawns(ccx + i, ccy + j)) {
          this.animals.push({ ...a, chunk: key, dir: 'left', moving: false, timer: hash2(a.x, a.y, 3) * 2, phase: hash2(a.x, a.y, 4) * 6 });
        }
      }
    }
    // forget animals that wandered far from the camera
    if (this.animals.length > 60 || this.spawned.size > 200) {
      this.animals = this.animals.filter((a) => {
        const [ax, ay] = a.chunk.split(',').map(Number);
        return Math.abs(ax - ccx) <= 3 && Math.abs(ay - ccy) <= 3;
      });
      this.spawned = new Set([...this.spawned].filter((k) => {
        const [ax, ay] = k.split(',').map(Number);
        return Math.abs(ax - ccx) <= 3 && Math.abs(ay - ccy) <= 3;
      }));
    }

    for (const a of this.animals) {
      if (a === this.mount) continue; // being ridden
      if (a.stamina !== undefined && a.stamina < 1) {
        a.stamina = Math.min(1, a.stamina + 0.1 * dt); // resting animals catch their breath
        if (a.exhausted && a.stamina >= 0.3) a.exhausted = false;
      }
      a.timer -= dt;
      if (a.timer <= 0) {
        if (a.moving || Math.random() < 0.45) {
          a.moving = false;
          a.timer = 1.5 + Math.random() * 3;
        } else {
          a.moving = true;
          a.dir = ['left', 'right', 'up', 'down'][Math.floor(Math.random() * 4)];
          if (a.type === 'chicken' && (a.dir === 'up' || a.dir === 'down')) a.dir = Math.random() < 0.5 ? 'left' : 'right';
          a.timer = 0.8 + Math.random() * 1.8;
        }
      }
      if (a.moving) {
        const speed = a.type === 'cow' ? 9 : 15;
        const nx = a.x + (a.dir === 'right' ? 1 : a.dir === 'left' ? -1 : 0) * speed * dt;
        const ny = a.y + (a.dir === 'down' ? 1 : a.dir === 'up' ? -1 : 0) * speed * dt;
        const ok = this.world.type(Math.floor(nx / T), Math.floor((ny - 2) / T)) !== WATER
          && this.world.type(Math.floor(nx / T), Math.floor((ny - 2) / T)) === GRASS
          && !this.world.isBlocked(nx - 4, ny - 4, 8, 4);
        if (ok) {
          a.x = nx;
          a.y = ny;
          a.phase += dt;
        } else {
          a.moving = false;
          a.timer = 0.6;
        }
      }
    }
  }

  // ---------- drawing ----------

  chunkCanvas(cx, cy) {
    const key = `${cx},${cy}`;
    let entry = this.chunkCanvases.get(key);
    if (!entry) {
      entry = { canvas: renderChunk(this.world, this.img, this.world.getChunk(cx, cy)), used: 0 };
      this.chunkCanvases.set(key, entry);
    }
    entry.used = this.t;
    return entry.canvas;
  }

  trimChunkCache() {
    if (this.chunkCanvases.size <= MAX_CACHED_CHUNKS) return;
    const sorted = [...this.chunkCanvases.entries()].sort((a, b) => a[1].used - b[1].used);
    for (let i = 0; i < sorted.length - MAX_CACHED_CHUNKS; i++) this.chunkCanvases.delete(sorted[i][0]);
  }

  draw() {
    const { ctx, canvas, zoom, img } = this;
    const camX = Math.round(this.cam.x - this.viewW / 2);
    const camY = Math.round(this.cam.y - this.viewH / 2);
    this.camX = camX;
    this.camY = camY;

    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#86d3e8';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(zoom, 0, 0, zoom, -camX * zoom, -camY * zoom);

    // twinkling water
    const tx0 = Math.floor(camX / T);
    const ty0 = Math.floor(camY / T);
    const tx1 = Math.ceil((camX + this.viewW) / T);
    const ty1 = Math.ceil((camY + this.viewH) / T);
    const seed = this.world.seed;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let y = ty0; !this.world.apoc && y <= ty1; y++) { // (no water in Survival)
      for (let x = tx0; x <= tx1; x++) {
        const h = hash2(x, y, seed + 61);
        if (h > 0.22) continue;
        const phase = (this.t * 0.5 + h * 20) % 1;
        if (phase > 0.55) continue;
        const wob = Math.round(Math.sin(phase * Math.PI) * 2);
        ctx.fillRect(x * T + 3 + Math.floor(h * 40) % 6, y * T + 4 + Math.floor(h * 90) % 8, 3 + wob, 1);
      }
    }

    // terrain
    const cx0 = Math.floor(camX / CHUNK_PX);
    const cy0 = Math.floor(camY / CHUNK_PX);
    const cx1 = Math.floor((camX + this.viewW) / CHUNK_PX);
    const cy1 = Math.floor((camY + this.viewH) / CHUNK_PX);
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) ctx.drawImage(this.chunkCanvas(cx, cy), cx * CHUNK_PX, cy * CHUNK_PX);
    }

    if (!this.demo) this.combat.drawDecals(ctx); // splashes lie on the ground, under everything standing on it

    // objects (y-sorted)
    this.glows.length = 0;
    const drawList = [];
    for (let cy = cy0 - 1; cy <= cy1 + 1; cy++) {
      for (let cx = cx0 - 1; cx <= cx1 + 1; cx++) {
        for (const o of this.world.getChunk(cx, cy).objects) {
          if (o.ground) {
            ctx.drawImage(img[o.sheet], o.sx, o.sy, o.sw, o.sh, o.ox, o.oy, o.sw, o.sh);
          } else if (!(o.inter === 'forage' && this.collected.has(o.id))) {
            drawList.push(o);
          }
        }
      }
    }
    for (const a of this.animals) drawList.push({ kind: 'animal', a, y: a.y });
    if (!this.demo) {
      drawList.push({ kind: 'player', y: this.player.y + (this.mount ? 0.2 : 0) });
      this.combat.collect(drawList);
      for (const r of this.remotes.values()) if (!r.hidden) drawList.push({ kind: 'remote', r, y: r.y });
      if (this.bots) for (const s of this.bots.shots) drawList.push({ kind: 'projectile', p: { x: s.x, y: s.y, id: 'rock', rot: s.rot }, y: s.y + 6 });
    }
    if (this.wave) {
      for (const m of this.wave.monsters) drawList.push({ kind: 'monster', m, y: m.y });
      for (const b of this.wave.barricades) drawList.push({ kind: 'barricade', b, y: b.y });
      for (const a of this.wave.allies) drawList.push({ kind: 'ally', a, y: a.y });
      for (const s of this.wave.ashots) drawList.push({ kind: 'projectile', p: { x: s.x, y: s.y, id: 'rock', rot: this.t * 14 }, y: s.y + 6 });
    }
    drawList.sort((a, b) => a.y - b.y);

    for (const o of drawList) {
      switch (o.kind) {
        case 'tree':
          ctx.drawImage(img[o.sheet], o.sx, o.sy, o.sw, o.sh, Math.round(o.x - o.sw / 2), o.y - o.sh, o.sw, o.sh);
          break;
        case 'house':
          // see-through while you are indoors, so you can still spot yourself
          if (this.combat?.insideId === o.id) ctx.globalAlpha = 0.4;
          ctx.drawImage(img.house, o.sx, o.sy, o.sw, o.sh, o.ox, o.oy, o.sw, o.sh);
          ctx.globalAlpha = 1;
          this.drawSmoke(o.ox + 12, o.oy + 12);
          this.glows.push([o.ox + 22, o.oy + 68, 26], [o.ox + 36, o.oy + 47, 22], [o.ox + 48, o.oy + 78, 20]);
          break;
        case 'chest':
          if (o.apoc) {
            // a supply fridge: dimmed once it has been searched
            const f = img[`apoc/${o.apoc}`];
            if (this.collected.has(o.id)) ctx.globalAlpha = 0.45;
            ctx.drawImage(f, Math.round(o.x - f.width / 2), o.y - f.height + 2);
            ctx.globalAlpha = 1;
          } else {
            ctx.drawImage(img.chest, 0, this.collected.has(o.id) ? 16 : 0, 32, 16, o.x - 16, o.y - 16, 32, 16);
          }
          break;
        case 'forage':
          if (o.forage.img) {
            const f = img[`apoc/${o.forage.img}`];
            ctx.drawImage(f, Math.round(o.x - f.width / 2), Math.round(o.y - f.height - 2 + Math.sin(this.t * 3 + o.x) * 0.8));
          } else if (o.forage.sheet) ctx.drawImage(img[o.forage.sheet], (Math.floor(this.t * 3 + o.x) % 4) * 16, 0, 16, 16, o.x - 8, o.y - 15, 16, 16);
          else ctx.drawImage(img.crops, o.forage.sx, o.forage.sy, 16, 16, o.x - 8, o.y - 15, 16, 16);
          break;
        case 'animal':
          this.drawAnimal(o.a);
          break;
        case 'player':
          // blink while recovering from a hit
          if (this.dead) {
            this.drawGrave(ctx, this.dead.x, this.dead.y);
            break;
          }
          if (this.teamCount) this.drawTeamRing(ctx, this.player.x, this.player.y, this.myTeam());
          ctx.globalAlpha = this.combat.invisT > 0 && this.combat.hidden ? 0.3 : this.combat.invuln > 0 && Math.floor(this.t * 14) % 2 ? 0.4 : 1;
          this.drawHeroAt(ctx, this.hero, this.player.dir, this.player.moving && !this.mount, this.animT, this.player.x, this.player.y - this.rideLift());
          ctx.globalAlpha = 1;
          if (!this.wave) this.drawHealthBar(ctx, { x: this.player.x, y: this.player.y - this.rideLift(), hp: this.combat.hp, max: this.combat.maxHp, hero: this.hero, lv: (this.upgrades.melee || 0) + 1 });
          break;
        case 'remote': {
          const lift = this.remoteLift(o.r);
          this.drawTeamRing(ctx, o.r.x, o.r.y, this.teamOf(o.r));
          // riding: the animal under them, and they sit a little higher
          if (o.r.mt) this.drawAnimal({ type: o.r.mt, x: o.r.x, y: o.r.y, dir: o.r.dir, moving: o.r.moving, phase: o.r.animT * 2, variant: o.r.variant, timer: 0 });
          this.drawHeroAt(ctx, o.r.hero, o.r.dir, o.r.moving && !o.r.mt, o.r.animT, o.r.x, o.r.y - lift);
          if (this.fight && o.r.hp > 0) this.drawHealthBar(ctx, { ...o.r, y: o.r.y - lift, teamColor: this.teamCount ? this.peerColor(o.r) : null });
          if (o.r.shield > 0) this.combat.drawShield(ctx, o.r.x, o.r.y - lift, o.r.shield);
          if (o.r.swing) this.combat.drawSwingAt(ctx, o.r.x, o.r.y - lift - 8, o.r.swing);
          if (o.r.spin) this.combat.drawSpinAt(ctx, o.r.x, o.r.y - lift - 8, o.r.spin);
          break;
        }
        case 'monster':
          this.drawMonster(ctx, o.m);
          break;
        case 'barricade':
          this.drawBarricade(ctx, o.b);
          break;
        case 'ally':
          this.drawAlly(ctx, o.a);
          break;
        case 'skeleton':
        case 'projectile':
        case 'drop':
        case 'swing':
        case 'spin':
        case 'shield':
        case 'ghost':
          this.combat.drawEntity(ctx, o, this.t);
          break;
        default:
      }
    }

    if (this.wave) this.drawWaveExtras(ctx);

    // screen-space overlay
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.drawDaylight(camX, camY);
    this.drawMotes();
    if (!this.demo) {
      this.combat.drawOverlay(ctx, camX, camY, zoom, this.t);
      this.drawHouseOwners(camX, camY);
      this.drawNameTag(camX, camY);
      this.drawRideHint(camX, camY);
      this.drawPeers(camX, camY);
      this.drawKillerHighlight(camX, camY);
      this.drawCelebration(camX, camY);
      if (this.ghostWhy) {
        // tell the player why the placement ghost is red
        const [sx, sy] = this.toScreen(this.ghostWhy.x, this.ghostWhy.y - 34, camX, camY);
        this.pill(this.placeMessage(this.ghostWhy.why).replace(/\.$/, ''), sx, sy, this.zoom * 3.6, '#fff', 'rgba(224,70,90,0.95)');
      }
      if (this.prompt) this.drawPrompt(this.prompt, camX, camY);
    }

    if (Math.floor(this.t) % 3 === 0) this.trimChunkCache();
  }

  drawDaylight(camX, camY) {
    const { ctx, canvas, zoom } = this;
    const [r, g, b] = skyTint(this.hour);
    if (r < 255 || g < 255 || b < 255) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    const n = this.darkness();
    if (n > 0.05) {
      ctx.globalCompositeOperation = 'lighter';
      const glow = (x, y, radius, alpha) => {
        const sx = (x - camX) * zoom;
        const sy = (y - camY) * zoom;
        const rad = radius * zoom;
        if (sx < -rad || sy < -rad || sx > canvas.width + rad || sy > canvas.height + rad) return;
        const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, rad);
        grad.addColorStop(0, `rgba(255,190,100,${alpha * n})`);
        grad.addColorStop(1, 'rgba(255,190,100,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(sx - rad, sy - rad, rad * 2, rad * 2);
      };
      for (const [x, y, rad] of this.glows) glow(x, y, rad, 0.5);
      // the lantern upgrade widens and brightens the glow around you
      const lamp = this.upgrades.light;
      if (!this.demo) glow(this.player.x, this.player.y - 10, 46 + 26 * lamp, 0.3 + 0.07 * lamp);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  drawSmoke(x, y) {
    const { ctx } = this;
    for (let i = 0; i < 4; i++) {
      const ph = (this.t * 0.3 + i / 4) % 1;
      const r = 1 + ph * 2.5;
      ctx.fillStyle = `rgba(255,250,245,${0.55 * (1 - ph)})`;
      ctx.fillRect(Math.round(x + Math.sin(ph * 5 + i) * 2 - r / 2), Math.round(y - ph * 20), Math.ceil(r), Math.ceil(r));
    }
  }

  drawAnimal(a) {
    const { ctx, img } = this;
    const x = Math.round(a.x);
    const y = Math.round(a.y);
    if (a.type === 'chicken') {
      const sheet = a.variant ? img.chicken_green : img.chicken_red;
      const frame = a.moving ? Math.floor(a.phase * 8) % 4 : Math.floor(this.t * 1.5 + a.timer) % 2;
      ctx.drawImage(sheet, frame * 16, a.dir === 'right' ? 16 : 0, 16, 16, x - 8, y - 14, 16, 16);
    } else {
      const sheet = a.variant ? img.cow_m : img.cow_f;
      const frame = a.moving ? Math.floor(a.phase * 5) % 4 : 0;
      const row = a.dir === 'down' ? 1 : a.dir === 'up' ? 2 : 0;
      if (row === 0 && a.dir === 'right') {
        ctx.save();
        ctx.translate(x, y - 28);
        ctx.scale(-1, 1);
        ctx.drawImage(sheet, frame * 32, 0, 32, 32, -16, 0, 32, 32);
        ctx.restore();
      } else {
        ctx.drawImage(sheet, frame * 32, row * 32, 32, 32, x - 16, y - 28, 32, 32);
      }
    }
  }

  drawMotes() {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;
    const px = Math.max(2, this.zoom);
    for (const m of this.motes) {
      const x = (((m.x + this.t * 0.012 * m.s) % 1) + 1) % 1;
      const y = (((m.y - this.t * 0.01 * m.s) % 1) + 1) % 1;
      const a = 0.25 + 0.25 * Math.sin(this.t * 1.5 + m.p) + this.darkness() * 0.35;
      ctx.fillStyle = `rgba(255,244,190,${a})`;
      ctx.fillRect(Math.round(x * w), Math.round(y * h + Math.sin(this.t + m.p) * 6), px, px);
    }
  }

  toScreen(x, y, camX, camY) {
    return [(x - camX) * this.zoom, (y - camY) * this.zoom];
  }

  pill(text, sx, sy, fontPx, fg, bg) {
    const { ctx } = this;
    ctx.font = `700 ${fontPx}px "Pixelify Sans", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + fontPx * 1.2;
    const h = fontPx * 1.7;
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(sx - w / 2, sy - h / 2, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.fillText(text, sx, sy + 1);
  }

  // Everyone who lives in a house, with the house's doorstep
  houseOwners() {
    const out = [{ name: this.name || 'Friend', hero: this.hero, home: this.home, me: true }];
    for (const b of this.bots?.list || []) out.push({ name: b.name, hero: b.hero, home: b.home });
    if (this.roomHomes) {
      for (const r of this.remotes.values()) {
        const site = this.roomHomes[Math.min(r.slot ?? 0, this.roomHomes.length - 1)];
        if (r.slot !== undefined && site) out.push({ name: r.name, hero: r.hero, home: this.world.homePoint(site), color: PEER_COLORS[r.color] });
      }
    }
    return out;
  }

  // A small portrait of the hero's head: cropped from the sheet for the retro heroes, an initial for the rest
  faceOf(hero, name, color) {
    const key = `${hero.id}|${hero.kind === 'retro' ? '' : name}`;
    let cv = this.faces.get(key);
    if (cv) return cv;
    cv = document.createElement('canvas');
    cv.width = 12;
    cv.height = 11;
    const c = cv.getContext('2d');
    if (hero.kind === 'retro') {
      c.drawImage(this.img[`retro/c${hero.n}`], 18, 0, 12, 11, 0, 0, 12, 11);
    } else {
      c.fillStyle = color || '#f2b05e';
      c.fillRect(0, 0, 12, 11);
      c.fillStyle = '#fff';
      c.font = '700 9px monospace';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText((name || '?')[0].toUpperCase(), 6, 6);
    }
    this.faces.set(key, cv);
    return cv;
  }

  // Name and face above each house, so you can tell whose it is
  drawHouseOwners(camX, camY) {
    if (this.wave || this.world.apoc) return;
    const { ctx, canvas, zoom } = this;
    for (const o of this.houseOwners()) {
      // the house is centred 12px left of its doorstep and its roof sits 100px above it
      const [sx, sy] = this.toScreen(o.home.x - 12, o.home.y - 106, camX, camY);
      if (sx < -150 || sy < -60 || sx > canvas.width + 150 || sy > canvas.height + 60) continue;
      const fontPx = zoom * 4.5;
      const face = this.faceOf(o.hero, o.name, o.color);
      const fh = fontPx * 1.7;
      const fw = fh * (12 / 11);
      ctx.font = `700 ${fontPx}px "Pixelify Sans", monospace`;
      const tw = ctx.measureText(o.name).width;
      const w = fw + tw + fontPx * 1.7;
      const h = fh + fontPx * 0.5;
      const x = sx - w / 2;
      const y = sy - h / 2;
      ctx.fillStyle = 'rgba(255,248,235,0.92)';
      ctx.strokeStyle = o.me ? '#e87c96' : '#c9a77a';
      ctx.lineWidth = Math.max(2, zoom * 0.8);
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, h / 2);
      ctx.fill();
      ctx.stroke();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(face, x + fontPx * 0.45, y + (h - fh) / 2, fw, fh);
      ctx.fillStyle = '#5b4636';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(o.name, x + fontPx * 0.45 + fw + fontPx * 0.4, sy + 1);
    }
  }

  drawNameTag(camX, camY) {
    if (!this.name) return;
    const [sx, sy] = this.toScreen(this.player.x, this.player.y - this.rideLift() - tagHeight(this.hero), camX, camY);
    this.pill(this.name, sx, sy, this.zoom * 4.5, '#5b4636', 'rgba(255,248,235,0.88)');
    if (this.myBubble) this.pill(this.myBubble.text, sx, sy - this.zoom * 9, this.zoom * 4.2, '#5b4636', '#fff');
  }

  // Draws a hero; anyone standing in water sinks in a little, with ripples around the feet
  drawHeroAt(ctx, hero, dir, moving, animT, x, y) {
    const wet = this.world.type(Math.floor(x / T), Math.floor((y - 2) / T)) === WATER;
    if (!wet) {
      drawHero(ctx, this.img, hero, dir, moving, animT, x, y);
      return;
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 40, y - 80, 80, 77); // hides the bottom few pixels under the surface
    ctx.clip();
    drawHero(ctx, this.img, hero, dir, moving, animT, x, y + 1);
    ctx.restore();
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#fff';
    for (let k = 0; k < 2; k++) {
      const ph = (this.t * 1.3 + k * 0.5) % 1;
      ctx.globalAlpha = (1 - ph) * 0.85;
      ctx.beginPath();
      ctx.ellipse(Math.round(x), Math.round(y - 1), 4 + ph * 8, 1.5 + ph * 3, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // tiny heart bar over a rival's head in fight-mode rooms (6 hearts max)
  drawHealthBar(ctx, r) {
    const w = 14;
    const x = Math.round(r.x - w / 2);
    const y = Math.round(r.y - tagHeight(r.hero) + 3);
    ctx.fillStyle = 'rgba(60,40,30,0.75)';
    ctx.fillRect(x - 1, y - 1, w + 2, 4);
    ctx.fillStyle = '#ff7a8f';
    ctx.fillRect(x, y, Math.round(w * Math.min(1, r.hp / (r.max || 6))), 2);
    // the level of their sword, beside the bar
    if (r.lv) {
      ctx.save();
      ctx.font = '700 5px "Pixelify Sans", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = 'rgba(60,40,30,0.9)';
      ctx.fillStyle = '#ffe9a8';
      ctx.strokeText(`Lv${r.lv}`, x + w + 3, y + 1);
      ctx.fillText(`Lv${r.lv}`, x + w + 3, y + 1);
      ctx.restore();
    }
  }

  // Name tags, chat bubbles and off-screen arrows for the other players in the room
  drawPeers(camX, camY) {
    if (!this.mp && !this.bots) return;
    const { ctx, canvas, zoom } = this;
    for (const r of this.remotes.values()) {
      if (r.hidden) continue; // tucked away indoors
      const [sx, sy] = this.toScreen(r.x, r.y - this.remoteLift(r) - tagHeight(r.hero), camX, camY);
      const off = sx < 0 || sy < 0 || sx > canvas.width || sy > canvas.height;
      if (!off) {
        this.pill(r.name, sx, sy, zoom * 4.5, '#fff', this.peerColor(r));
        if (r.bubble) this.pill(r.bubble.text, sx, sy - zoom * 9, zoom * 4.2, '#5b4636', '#fff');
        continue;
      }
      // a small arrow on the screen edge pointing at the friend
      const m = zoom * 14;
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const ang = Math.atan2(sy - cy, sx - cx);
      const ex = Math.min(canvas.width - m, Math.max(m, cx + Math.cos(ang) * canvas.width));
      const ey = Math.min(canvas.height - m, Math.max(m, cy + Math.sin(ang) * canvas.height));
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(ang);
      ctx.fillStyle = this.peerColor(r);
      ctx.beginPath();
      ctx.moveTo(zoom * 4, 0);
      ctx.lineTo(-zoom * 3, -zoom * 3.2);
      ctx.lineTo(-zoom * 3, zoom * 3.2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      this.pill(r.name, ex - Math.cos(ang) * zoom * 12, ey - Math.sin(ang) * zoom * 12, zoom * 3.6, '#fff', this.peerColor(r));
    }
  }

  drawPrompt(o, camX, camY) {
    const bob = Math.sin(this.t * 5) * 1.5;
    const [sx, sy] = this.toScreen(o.x, o.y - (o.inter === 'chest' ? 24 : 22) + bob, camX, camY);
    this.pill(o.inter === 'chest' ? 'Space · open' : o.inter === 'water' ? 'Space · drink' : 'Space · pick up', sx, sy, this.zoom * 4, '#fff', 'rgba(232,124,150,0.95)');
  }

  // The small corner map, and the big one opened with M
  drawMinimap() {
    this.paintMap(this.minimap, 2, 0.8);
    if (this.bigMap) this.paintMap(this.bigMap, 1, 3);
  }

  // Terrain is repainted now and then (`every` seconds); the dots for creatures and heroes every time.
  paintMap(c, step, every) {
    if (!c) return;
    const ctx = c.getContext('2d');
    const size = c.width;
    const ptx = Math.floor(this.player.x / T);
    const pty = Math.floor(this.player.y / T);
    const cache = (c._terrain ||= { at: -99, cv: document.createElement('canvas') });
    if (this.t - cache.at > every || cache.size !== size) {
      cache.at = this.t;
      cache.size = size;
      cache.ox = ptx;
      cache.oy = pty;
      cache.cv.width = size;
      cache.cv.height = size;
      const cctx = cache.cv.getContext('2d');
      const img = cctx.createImageData(size, size);
      const palette = {
        [WATER]: [126, 203, 230],
        [SAND]: [236, 217, 166],
        [GRASS]: [139, 198, 106],
      };
      const forest = [92, 160, 87];
      for (let j = 0; j < size; j++) {
        for (let i = 0; i < size; i++) {
          const x = ptx + (i - size / 2) * step;
          const y = pty + (j - size / 2) * step;
          const t = this.world.type(x, y);
          let col = palette[t];
          if (t === GRASS && this.world.forest(x, y) > 0.6) col = forest;
          const o = (j * size + i) * 4;
          img.data[o] = col[0];
          img.data[o + 1] = col[1];
          img.data[o + 2] = col[2];
          img.data[o + 3] = 255;
        }
      }
      cctx.putImageData(img, 0, 0);
    }
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(cache.cv, Math.round(((cache.ox - ptx) * 1) / step), Math.round(((cache.oy - pty) * 1) / step));
    const dot = (x, y, color, r) => {
      const mx = size / 2 + (x / T - this.player.x / T) / step;
      const my = size / 2 + (y / T - this.player.y / T) / step;
      if (mx < 1 || my < 1 || mx > size - 1 || my > size - 1) return;
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(mx - r), Math.round(my - r), r * 2, r * 2);
    };
    const r = size > 120 ? 2 : 1;
    if (!this.demo && this.combat) {
      for (const s of this.combat.skeletons) if (s.state !== 'dead') dot(s.x, s.y, '#f4f0e6', r);
      for (const w of this.combat.wilds) if (w.state !== 'dead') dot(w.x, w.y, '#b45cd8', r);
      for (const m of this.wave?.monsters || []) if (m.state !== 'dead') dot(m.x, m.y, '#e0384a', r);
      for (const o of this.remotes.values()) if (!o.hidden) dot(o.x, o.y, o.bot ? '#f2a33c' : '#5aaee8', r);
    }
    const pr = size > 120 ? 3 : 2;
    ctx.fillStyle = '#ff6f91';
    ctx.fillRect(size / 2 - pr, size / 2 - pr, pr * 2, pr * 2);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(size / 2 - pr - 0.5, size / 2 - pr - 0.5, pr * 2 + 1, pr * 2 + 1);
  }

  // Called by the map overlay: give the game a canvas to keep painting, or null to let go
  setBigMap(canvas) {
    this.bigMap = canvas;
    if (canvas) this.paintMap(canvas, 1, 0);
  }
}
