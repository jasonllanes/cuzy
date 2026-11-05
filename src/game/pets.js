// Pets: a little companion that follows you, fights whatever is hurting you (or whatever you are hitting) and has a trick of its own.
// The art is AssetPackV2/pets/spritesheet.png: 16x16 cells. Every kind comes in blocks of 4 frames; a block has three rows: the side
// (facing right), the front and the back. A block's top-left cell is [col, row].
import { sfx } from './sfx';

const b4 = (list) => list.map(([c, r]) => ({ c, r }));

export const PETS = {
  mouse: { name: 'Rat', icon: '🐀', cost: 25, hp: 4, dmg: 0.8, cd: 0.7, speed: 92, reach: 9, scale: 1, blocks: b4([[4, 9], [12, 9], [4, 12], [12, 12]]), blurb: 'A cheap little friend: quick, and it nips at your enemies. A basic attack, nothing more.' },
  snake: { name: 'Snake', icon: '🐍', cost: 80, hp: 6, dmg: 1, cd: 1.1, speed: 68, reach: 10, scale: 1.1, poison: { ticks: 5, dmg: 0.55 }, blocks: b4([[0, 0], [4, 0], [0, 3], [4, 3], [0, 6], [4, 6], [8, 6], [12, 6]]), blurb: 'Its bite is poisonous: the venom keeps hurting for a few seconds.' },
  cobra: { name: 'Cobra', icon: '🐍', cost: 120, hp: 7, dmg: 1.3, cd: 1.05, speed: 70, reach: 11, scale: 1.15, poison: { ticks: 7, dmg: 0.75 }, blocks: b4([[8, 0], [12, 0], [8, 3], [12, 3]]), blurb: 'A hooded snake with a much stronger venom.' },
  pigeon: { name: 'Pigeon', icon: '🕊️', cost: 100, hp: 3, dmg: 0.4, cd: 1.2, speed: 96, reach: 9, scale: 1.1, fly: true, sees: true, blocks: b4([[0, 15]]), air: b4([[4, 15]]), blurb: 'It sees what you cannot: hidden chests, full of loot, show up when it is near. (It only pecks a little.)' },
  seagull: { name: 'Seagull', icon: '🐦', cost: 120, hp: 3, dmg: 0.5, cd: 1.2, speed: 96, reach: 9, scale: 1.1, fly: true, glide: true, blocks: b4([[8, 15]]), air: b4([[12, 15]]), blurb: 'Lifts you over the water: you fly across rivers and lakes without being slowed down.' },
  bear: { name: 'Bear', icon: '🐻', cost: 220, hp: 18, dmg: 4.5, cd: 1.9, speed: 42, reach: 13, scale: 1.35, kb: 220, blocks: b4([[0, 18], [4, 18], [8, 18]]), blurb: 'Slow and heavy, but every swipe hits very hard and sends enemies flying.' },
  sheep: { name: 'Sheep', icon: '🐑', cost: 150, hp: 14, dmg: 1, cd: 1.5, speed: 72, reach: 11, scale: 1.4, ride: true, blocks: b4([[0, 21], [4, 21]]), blurb: 'A ride that never leaves you: press F next to it to hop on (it takes the hits for you). If it is knocked out it just falls asleep where it was, and wakes up later.' },
  wolf: { name: 'Wolf', icon: '🐺', cost: 160, hp: 9, dmg: 1.6, cd: 0.9, speed: 100, reach: 11, scale: 1.15, bleed: true, blocks: b4([[0, 24], [4, 24], [8, 24], [12, 24], [0, 27], [4, 27]]), blurb: 'Fast, and its bites open wounds that keep bleeding.' },
};
export const PET_KINDS = Object.keys(PETS);
const HEAL_COINS = 12; // what a heal costs when you have no HP Pack
const REST_TIME = 55; // seconds a knocked-out pet sleeps where it fell

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class PetSystem {
  constructor(game, saved) {
    this.g = game;
    this.owned = {}; // kind -> which colour
    for (const [k, v] of Object.entries(saved?.owned || {})) if (PETS[k]) this.owned[k] = clamp(Math.floor(Number(v)) || 0, 0, PETS[k].blocks.length - 1);
    this.active = PETS[saved?.active] && this.owned[saved.active] !== undefined ? saved.active : null;
    this.pet = null; // the one beside you: { kind, v, x, y, dir, moving, anim, hp, state, restT, cd, rid }
    this.fxs = []; // little bursts (a bite, venom, a wound, a slam), yours and other players'
    this.restSaved = saved?.rest || 0;
  }

  save() {
    return { owned: { ...this.owned }, active: this.active, rest: this.pet?.state === 'rest' ? Math.ceil(this.pet.restT) : 0 };
  }

  hud() {
    const P = this.pet;
    return { owned: { ...this.owned }, active: this.active, rest: P?.state === 'rest', ride: !!P?.rid, hp: P ? Math.max(0, P.hp) : 0, max: P ? PETS[P.kind].hp : 0, kind: P?.kind || null, packs: this.g.supplies?.hp || 0, healCost: HEAL_COINS };
  }

  // Heal your pet: an HP Pack does it (or a few coins, when you have none). A sleeping pet wakes up, half healed.
  heal() {
    const P = this.pet;
    const g = this.g;
    if (!P) return false;
    const def = PETS[P.kind];
    if (P.state !== 'rest' && P.hp >= def.hp - 0.05) {
      g.onToast?.(`Your ${def.name} is already in perfect health.`);
      return false;
    }
    if ((g.supplies?.hp || 0) > 0) g.supplies.hp--;
    else if (!g.spendCoins(HEAL_COINS)) {
      sfx.play('nope');
      g.onToast?.(`Healing your ${def.name} takes an HP Pack, or ${HEAL_COINS} coins. You have neither.`);
      return false;
    }
    const was = P.state === 'rest';
    P.hp = was ? def.hp * 0.5 : Math.min(def.hp, P.hp + def.hp * 0.6);
    if (was) {
      P.state = 'follow';
      P.restT = 0;
      g.onToast?.(`${def.icon} Your ${def.name} wakes up!`);
    }
    g.combat.floaters.push({ x: P.x, y: P.y - 24, text: `+${Math.round(def.hp * (was ? 0.5 : 0.6) * 10) / 10} ❤`, color: '#5fd16a', t: 0 });
    sfx.play('heal');
    this.addFx(P.x, P.y - 8, 'heal');
    g.mp?.net.send({ t: 'fx', kind: 'petfx', x: Math.round(P.x), y: Math.round(P.y - 8), k: 'heal' });
    g.save();
    return true;
  }

  // is your pet close enough (and hurt enough) to be offered a heal with F?
  healNear() {
    const P = this.pet;
    if (!P || P.rid || this.g.inside) return null;
    const def = PETS[P.kind];
    if (def.ride) return null; // (the sheep is healed from the pet card)
    if (P.state !== 'rest' && P.hp >= def.hp - 0.05) return null;
    return Math.hypot(P.x - this.g.player.x, P.y - this.g.player.y) < 26 ? P : null;
  }

  // ---------- owning ----------

  buy(kind, v = 0) {
    const def = PETS[kind];
    const g = this.g;
    if (!def || this.owned[kind] !== undefined) return false;
    if (!g.spendCoins(def.cost)) {
      sfx.play('nope');
      g.onToast?.(`${def.name} costs ${def.cost} coins. You have ${g.coinCount()}.`);
      return false;
    }
    this.owned[kind] = clamp(Math.floor(v) || 0, 0, def.blocks.length - 1);
    sfx.play('levelup');
    this.call(kind);
    g.onToast?.(`${def.icon} Your ${def.name} joins you!`);
    g.save();
    return true;
  }

  recolor(kind, v) {
    const def = PETS[kind];
    if (!def || this.owned[kind] === undefined) return;
    this.owned[kind] = clamp(Math.floor(v) || 0, 0, def.blocks.length - 1);
    if (this.pet?.kind === kind) this.pet.v = this.owned[kind];
    sfx.play('buy', 0.5);
    this.g.save();
  }

  // call a pet to your side (null: send it away)
  call(kind) {
    if (kind !== null && this.owned[kind] === undefined) return;
    if (this.pet?.rid) this.dismount();
    this.active = kind;
    this.pet = null;
    if (kind) this.spawn();
    this.g.save();
  }

  spawn() {
    const def = PETS[this.active];
    if (!def) return;
    const p = this.g.player;
    this.pet = { kind: this.active, v: this.owned[this.active], x: p.x - 14, y: p.y + 4, dir: 'right', moving: false, anim: 0, hp: def.hp, state: 'follow', restT: 0, cd: 0.5, rid: false, tgt: null };
    if (this.restSaved > 0) {
      this.pet.state = 'rest';
      this.pet.restT = this.restSaved;
      this.pet.hp = 0;
      this.restSaved = 0;
    }
  }

  // ---------- the pet's life ----------

  def() {
    return this.pet ? PETS[this.pet.kind] : null;
  }

  // who the pet should go for: whatever hit you a moment ago, otherwise the one you are hitting
  pickTarget() {
    const g = this.g;
    const c = g.combat;
    const by = c.lastHitBy;
    let found = null;
    if (by && g.t - by.at < 5 && by.id !== undefined) {
      if (by.kind === 'skeleton') {
        const s = c.skeletons.find((x) => x.id === by.id);
        if (s && s.state !== 'dead') found = { kind: 'skel', t: s };
      } else if (by.kind === 'monster') {
        const m = g.wave?.monsters.find((x) => x.id === by.id) || c.wilds.find((x) => x.id === by.id);
        if (m && m.state !== 'dead') found = { kind: 'mon', t: m };
      }
    }
    const tg = g.target;
    if (!found && tg && g.t - tg.at < 6 && tg.ref && tg.ref.state !== 'dead') found = { kind: tg.kind === 'skel' ? 'skel' : 'mon', t: tg.ref };
    if (found && Math.hypot(found.t.x - g.player.x, found.t.y - g.player.y) > 330) return null; // (too far from you)
    return found;
  }

  update(dt) {
    const g = this.g;
    for (let i = this.fxs.length - 1; i >= 0; i--) if ((this.fxs[i].t += dt) > 0.6) this.fxs.splice(i, 1);
    if (g.demo) return;
    if (this.active && !this.pet) this.spawn();
    const P = this.pet;
    if (!P) return;
    const def = PETS[P.kind];
    const pl = g.player;
    P.anim += dt;
    // knocked out: it sleeps right where it fell, and wakes up after a while
    if (P.state === 'rest') {
      P.moving = false;
      P.restT -= dt;
      if (P.restT <= 0) {
        P.state = 'follow';
        P.hp = def.hp;
        g.combat.floaters.push({ x: P.x, y: P.y - 20, text: `${def.name} woke up`, color: '#fff3b0', t: 0 });
        sfx.play('respawn', 0.4);
      }
      return;
    }
    // the seagull flies over the water with you
    if (def.glide && g.glideTile && !g.dead) {
      P.x = pl.x;
      P.y = pl.y;
      P.dir = pl.dir;
      P.moving = true;
      P.state = 'follow';
      return;
    }
    // riding a sheep: it carries you, wherever you go
    if (P.rid) {
      if (g.dead || g.inside || g.boat || g.seat || g.mount) this.dismount();
      else {
        P.x = pl.x;
        P.y = pl.y;
        P.dir = pl.dir;
        P.moving = !!pl.moving;
        P.state = 'follow';
        return;
      }
    }
    P.cd -= dt;
    // inside a house the pet waits at the door: it is not shown
    if (g.inside) {
      P.x = g.home?.x ?? pl.x;
      P.y = g.home?.y ?? pl.y;
      return;
    }
    let target = null;
    if (!g.dead && !g.combat.hidden) target = this.pickTarget();
    let gx;
    let gy;
    let speed = def.speed;
    if (target) {
      gx = target.t.x;
      gy = target.t.y;
      P.state = 'attack';
      speed *= 1.25;
    } else if (g.seat) {
      // while you sit on the seesaw the pet waits in front of it, not on top of you
      P.state = 'follow';
      gx = g.seat.o.x;
      gy = g.seat.o.by + 22;
    } else {
      P.state = 'follow';
      const back = { left: 1, right: -1, up: 0, down: 0 }[pl.dir] ?? 0;
      const backY = { up: 1, down: -1 }[pl.dir] ?? 0;
      gx = pl.x + back * 15;
      gy = pl.y + backY * 12 + 3;
    }
    const dx = gx - P.x;
    const dy = gy - P.y;
    const dist = Math.hypot(dx, dy);
    if (!target && dist > 340) {
      P.x = pl.x - 12;
      P.y = pl.y + 4; // too far behind: it catches up at once
    } else if (dist > (target ? def.reach * 0.7 : 14)) {
      const sp = speed * (!target && dist > 90 ? 1.7 : 1) * dt;
      const nx = P.x + (dx / dist) * sp;
      const ny = P.y + (dy / dist) * sp;
      const blocked = (x, y) => !def.fly && g.world.isBlocked(x - 4, y - 4, 8, 4);
      if (!blocked(nx, P.y)) P.x = nx;
      if (!blocked(P.x, ny)) P.y = ny;
      P.moving = true;
      if (Math.abs(dx) >= Math.abs(dy)) P.dir = dx > 0 ? 'right' : 'left';
      else P.dir = dy > 0 ? 'down' : 'up';
    } else P.moving = false;
    if (target && Math.hypot(target.t.x - P.x, target.t.y - P.y) <= def.reach + 4 && P.cd <= 0) this.attack(target, def);
  }

  attack(target, def) {
    const P = this.pet;
    const c = this.g.combat;
    const { t, kind } = target;
    P.cd = def.cd;
    const lung = Math.atan2(t.y - P.y, t.x - P.x);
    P.x += Math.cos(lung) * 3; // a little lunge
    P.y += Math.sin(lung) * 2;
    P.dir = Math.abs(t.x - P.x) >= Math.abs(t.y - P.y) ? (t.x > P.x ? 'right' : 'left') : t.y > P.y ? 'down' : 'up';
    c.applyHit(kind, t, def.dmg, P.x, P.y, def.kb || 90);
    sfx.play(def.kb ? 'boom' : 'hit', def.kb ? 0.25 : 0.5);
    let fx = def.kb ? 'slam' : 'bite';
    if (t.state !== 'dead') {
      if (def.poison && !c.dots.some((d) => d.t === t)) {
        c.dots.push({ kind, t, ticks: def.poison.ticks, wait: 0.5, dmg: def.poison.dmg });
        c.floaters.push({ x: t.x, y: t.y - 24, text: '☠', color: '#8fe05a', t: 0 });
        fx = 'poison';
      } else if (def.bleed && !c.dots.some((d) => d.t === t)) {
        c.dots.push({ kind, t, ticks: 6, wait: 0.5, dmg: 0.6, bleed: true });
        c.floaters.push({ x: t.x, y: t.y - 24, text: '🩸', color: '#e0384a', t: 0 });
        fx = 'bleed';
      }
    }
    this.addFx(t.x, t.y - 6, fx);
    this.g.mp?.net.send({ t: 'fx', kind: 'petfx', x: Math.round(t.x), y: Math.round(t.y - 6), k: fx });
  }

  addFx(x, y, k) {
    if (this.fxs.length > 24) this.fxs.shift();
    this.fxs.push({ x, y, k, t: 0 });
  }

  // a hit on you: the pet beside you takes part of it (a ridden sheep takes most of it). Returns what is left for you.
  guard(n) {
    const P = this.pet;
    if (!P || P.state === 'rest' || this.g.inside) return n;
    if (P.rid) {
      this.hurt(n * 0.6);
      return n * 0.4;
    }
    if (Math.hypot(P.x - this.g.player.x, P.y - this.g.player.y) < 40) this.hurt(n * 0.3);
    return n;
  }

  hurt(n) {
    const P = this.pet;
    if (!P || P.state === 'rest') return;
    const def = PETS[P.kind];
    P.hp -= n;
    this.g.combat.floaters.push({ x: P.x, y: P.y - 20, text: `-${Math.round(n * 10) / 10}`, color: '#ff9a8f', t: 0 });
    if (P.hp > 0) return;
    // knocked out: it falls asleep right here
    if (P.rid) this.dismount();
    P.state = 'rest';
    P.restT = REST_TIME;
    P.moving = false;
    P.hp = 0;
    this.g.onToast?.(`💤 Your ${def.name} is worn out and fell asleep. It will wake up in a while.`);
  }

  // ---------- the tricks ----------

  // the sheep: hop on (and off) when you stand next to it
  tryRide() {
    const P = this.pet;
    const def = this.def();
    if (!P || !def?.ride) return false;
    if (P.rid) {
      this.dismount();
      return true;
    }
    const g = this.g;
    if (!def.ride || P.state === 'rest' || g.mount || g.boat || g.seat || g.dead || g.inside) return false;
    if (Math.hypot(P.x - g.player.x, P.y - g.player.y) > 34) return false;
    P.rid = true;
    g.keys.clear();
    g.onToast?.(`🐑 You hop on your sheep. Press F to get off.`);
    return true;
  }

  dismount() {
    const P = this.pet;
    if (!P || !P.rid) return;
    P.rid = false;
    P.x = this.g.player.x - 14;
    P.y = this.g.player.y + 4;
  }

  rideSpeed() {
    return this.pet?.rid ? 1.3 : 1;
  }

  // the seagull carries you over the water
  gliding() {
    const P = this.pet;
    return !!(P && P.state !== 'rest' && PETS[P.kind].glide && !this.g.inside);
  }

  // does the pigeon see this hidden chest? (it must be awake and close to it)
  sees(o) {
    const P = this.pet;
    if (!P || P.state === 'rest' || !PETS[P.kind].sees) return false;
    return Math.hypot(P.x - o.x, P.y - o.y) < 150 || Math.hypot(this.g.player.x - o.x, this.g.player.y - o.y) < 130;
  }

  lift() {
    const P = this.pet;
    if (!P) return 0;
    return P.rid ? 6 : 0;
  }

  // what other players are told every moment
  netState() {
    const P = this.pet;
    if (!P || this.g.inside) return null;
    return { s: P.kind, v: P.v, x: Math.round(P.x), y: Math.round(P.y), d: { left: 0, right: 1, up: 2, down: 3 }[P.dir] ?? 1, st: P.state === 'rest' ? 2 : P.state === 'attack' ? 1 : 0, mv: P.moving ? 1 : 0, rd: P.rid ? 1 : 0, h: Math.max(0, Math.min(100, Math.round((P.hp / PETS[P.kind].hp) * 100))) };
  }

  // someone else's pet: follow where they say it is
  static remote(prev, n) {
    if (!n || !PETS[n.s]) return null;
    const dir = ['left', 'right', 'up', 'down'][n.d] || 'right';
    const out = prev && prev.kind === n.s ? prev : { x: n.x, y: n.y, anim: 0 };
    return Object.assign(out, { kind: n.s, v: n.v | 0, tx: n.x, ty: n.y, dir, state: n.st === 2 ? 'rest' : n.st === 1 ? 'attack' : 'follow', moving: !!n.mv, rid: !!n.rd, hpPct: Number.isFinite(n.h) ? n.h : 100 });
  }

  static lerpRemote(p, dt) {
    if (Math.hypot(p.tx - p.x, p.ty - p.y) > 200) {
      p.x = p.tx;
      p.y = p.ty;
    }
    const k = 1 - Math.exp(-dt * 12);
    p.x += (p.tx - p.x) * k;
    p.y += (p.ty - p.y) * k;
    p.anim += dt;
  }

  // ---------- drawing ----------

  collect(list) {
    const P = this.pet;
    if (P && !this.g.inside) list.push({ kind: 'pet', p: P, y: P.y + (P.rid ? -1 : 0) });
    for (const f of this.fxs) list.push({ kind: 'petfx', f, y: f.y + 10 });
  }

  // one pet: p = { kind, v, x, y, dir, moving, anim, state, rid }
  static draw(ctx, img, p, time) {
    const def = PETS[p.kind];
    const sheet = img['pets/sheet'];
    if (!def || !sheet) return;
    const rest = p.state === 'rest';
    const flying = def.fly && !rest && (p.moving || p.state === 'attack');
    const blocks = flying && def.air ? def.air : def.blocks;
    const blk = blocks[Math.min(blocks.length - 1, p.v | 0)] || blocks[0];
    const row = p.dir === 'up' ? 2 : p.dir === 'down' ? 1 : 0;
    const col = blk.c + (p.moving && !rest ? Math.floor(p.anim * 9) % 4 : 0);
    const sc = def.scale;
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    const hover = def.fly && !rest ? 9 + Math.sin(time * 5 + p.x) * 1.5 : 0;
    ctx.fillStyle = 'rgba(40,24,30,0.22)';
    ctx.beginPath();
    ctx.ellipse(x, y, 6 * sc, 2.2 * sc, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(x, y - hover);
    if (rest) ctx.globalAlpha = 0.85;
    if (p.dir === 'left') ctx.scale(-1, 1);
    const squash = rest ? 0.8 : 1;
    ctx.drawImage(sheet, col * 16, (blk.r + row) * 16, 16, 16, -8 * sc, -(15 * sc) * squash + 1, 16 * sc, 16 * sc * squash);
    ctx.restore();
    // its health: a small bar over its head
    const pct = Math.max(0, Math.min(100, p.hpPct ?? (p.hp / def.hp) * 100));
    const bw = Math.round(11 * Math.max(1, sc * 0.85));
    const by = y - hover - Math.round(16 * sc) - 2;
    ctx.fillStyle = 'rgba(40,24,30,0.75)';
    ctx.fillRect(x - Math.floor(bw / 2) - 1, by - 1, bw + 2, 4);
    ctx.fillStyle = pct > 55 ? '#5fd16a' : pct > 25 ? '#f2c14e' : '#ee5a6c';
    ctx.fillRect(x - Math.floor(bw / 2), by, Math.round(bw * pct / 100), 2);
    if (rest) {
      // Zzz drifting up from the sleeper
      ctx.save();
      ctx.font = '700 7px monospace';
      ctx.textAlign = 'left';
      for (let i = 0; i < 3; i++) {
        const ph = (time * 0.6 + i * 0.33) % 1;
        ctx.globalAlpha = Math.sin(ph * Math.PI);
        ctx.fillStyle = '#fffbe0';
        ctx.strokeStyle = 'rgba(40,30,60,0.8)';
        ctx.lineWidth = 2;
        const zx = x + 4 + ph * 8;
        const zy = y - 12 - ph * 14;
        ctx.strokeText('z', zx, zy);
        ctx.fillText('z', zx, zy);
      }
      ctx.restore();
    }
  }

  static drawFx(ctx, f) {
    const k = f.t / 0.6;
    ctx.save();
    ctx.globalAlpha = 1 - k;
    const x = Math.round(f.x);
    const y = Math.round(f.y);
    if (f.k === 'poison') {
      ctx.fillStyle = '#8fe05a';
      for (let i = 0; i < 5; i++) ctx.fillRect(x - 6 + i * 3, y - k * 14 - (i % 2) * 4, 2, 2);
      ctx.strokeStyle = 'rgba(140,224,90,0.8)';
      ctx.beginPath();
      ctx.ellipse(x, y + 4, 4 + k * 10, 2 + k * 5, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (f.k === 'bleed') {
      ctx.fillStyle = '#e0384a';
      for (let i = 0; i < 6; i++) ctx.fillRect(x - 7 + i * 3 + Math.round(Math.sin(i * 2) * 2), y - 4 + k * (6 + (i % 3) * 3), 2, 3);
    } else if (f.k === 'heal') {
      ctx.fillStyle = '#7ff08a';
      for (let i = 0; i < 6; i++) ctx.fillRect(x - 7 + i * 3, y - 2 - k * (10 + (i % 3) * 4), 2, 2);
      ctx.strokeStyle = 'rgba(127,240,138,0.9)';
      ctx.beginPath();
      ctx.ellipse(x, y + 4, 4 + k * 9, 2 + k * 4, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (f.k === 'slam') {
      ctx.strokeStyle = '#fff3d0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y + 4, 4 + k * 20, 2 + k * 9, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(210,190,150,0.7)';
      for (let i = 0; i < 6; i++) ctx.fillRect(x + Math.cos(i * 1.05) * (4 + k * 16), y + 3 + Math.sin(i * 1.05) * (2 + k * 7) - k * 4, 2, 2);
    } else {
      // a bite: two white slashes
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - 6, y - 5);
      ctx.lineTo(x + 2 + k * 4, y + 3);
      ctx.moveTo(x - 1, y - 6);
      ctx.lineTo(x + 7 + k * 4, y + 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}
