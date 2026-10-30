import { sfx } from './sfx';
import { SURVIVAL_BASE, SURVIVAL_MAPS, splitSeed } from './maps';

// Background music, made up as it plays with the Web Audio API (there are no music files to ship). Every kind of map has
// its own tune style: a key and scale, a speed, a chord loop, and which instruments play. A melody wanders over the scale on
// top, so the music never repeats exactly. It sits underneath the sound effects and has its own switch and volume.

const ON_KEY = 'cuzi-music-on';
const VOL_KEY = 'cuzi-music-vol';
const LEVEL = 0.34; // the music's loudest, next to the sound effects
const AHEAD = 0.4; // seconds of notes scheduled in advance

let on = true;
let vol = 0.6;
try {
  on = localStorage.getItem(ON_KEY) !== '0';
  const v = parseFloat(localStorage.getItem(VOL_KEY));
  if (Number.isFinite(v)) vol = Math.min(1, Math.max(0, v));
} catch {
  /* storage may be unavailable */
}

const MAJ_PENT = [0, 2, 4, 7, 9];
const MIN_PENT = [0, 3, 5, 7, 10];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const HIRAJOSHI = [0, 2, 3, 7, 8];
const MINOR = [0, 2, 3, 5, 7, 8, 10];

const MAJ = [0, 4, 7];
const MIN = [0, 3, 7];
const SUS = [0, 2, 7];
const MAJ7 = [0, 4, 7, 11];
const MIN7 = [0, 3, 7, 10];

// bpm: speed.  root: the key (a MIDI note).  prog: the chord loop, one chord per bar as [root offset, chord].
// lead / arp / bass / pad: instrument waveform and loudness (density = how often the lead plays).  drum: soft beat, 0..1.
const THEMES = {
  menu: { bpm: 96, root: 60, scale: MAJ_PENT, prog: [[0, MAJ], [9, MIN], [5, MAJ], [7, MAJ]], lead: { type: 'triangle', vol: 0.5, density: 0.5 }, arp: { type: 'sine', vol: 0.3 }, bass: { type: 'sine', vol: 0.5, drive: false }, pad: { type: 'triangle', vol: 0.18 }, drum: 0.3, echo: 0.3 },
  meadow: { bpm: 88, root: 62, scale: MAJ_PENT, prog: [[0, MAJ], [11, MIN], [7, MAJ], [9, MAJ]], lead: { type: 'triangle', vol: 0.5, density: 0.55 }, arp: { type: 'sine', vol: 0.26 }, bass: { type: 'sine', vol: 0.45, drive: false }, pad: { type: 'triangle', vol: 0.16 }, drum: 0.2, echo: 0.3 },
  island: { bpm: 78, root: 65, scale: LYDIAN, prog: [[0, MAJ7], [2, MAJ], [9, MIN7], [7, MAJ]], lead: { type: 'sine', vol: 0.5, density: 0.4 }, arp: { type: 'triangle', vol: 0.22 }, bass: { type: 'sine', vol: 0.45, drive: false }, pad: { type: 'sine', vol: 0.22 }, drum: 0, echo: 0.45 },
  shore: { bpm: 108, root: 67, scale: MAJ_PENT, prog: [[0, MAJ], [5, MAJ], [7, MAJ], [5, MAJ]], lead: { type: 'triangle', vol: 0.5, density: 0.6 }, arp: { type: 'sine', vol: 0.3 }, bass: { type: 'sine', vol: 0.5, drive: false }, pad: { type: 'triangle', vol: 0.12 }, drum: 0.5, echo: 0.25 },
  crystal: { bpm: 70, root: 69, scale: LYDIAN, prog: [[0, MAJ7], [7, SUS], [5, MAJ7], [4, MIN]], lead: { type: 'sine', vol: 0.45, density: 0.35, oct: 12 }, arp: { type: 'sine', vol: 0.32 }, bass: { type: 'sine', vol: 0.35, drive: false }, pad: { type: 'sine', vol: 0.24 }, drum: 0, echo: 0.55 },
  marsh: { bpm: 62, root: 57, scale: MIN_PENT, prog: [[0, MIN], [8, MAJ], [5, MIN], [7, MIN]], lead: { type: 'triangle', vol: 0.42, density: 0.3 }, arp: null, bass: { type: 'sine', vol: 0.55, drive: false }, pad: { type: 'sawtooth', vol: 0.07 }, drum: 0, echo: 0.4 },
  lava: { bpm: 112, root: 52, scale: PHRYGIAN, prog: [[0, MIN], [1, MAJ], [0, MIN], [10, MAJ]], lead: { type: 'sawtooth', vol: 0.22, density: 0.4 }, arp: { type: 'square', vol: 0.1 }, bass: { type: 'sawtooth', vol: 0.3, drive: true }, pad: { type: 'sawtooth', vol: 0.06 }, drum: 0.9, echo: 0.2 },
  wasteland: { bpm: 84, root: 50, scale: MINOR, prog: [[0, MIN], [8, MAJ], [3, MAJ], [7, MIN]], lead: { type: 'triangle', vol: 0.4, density: 0.25 }, arp: { type: 'triangle', vol: 0.14 }, bass: { type: 'sawtooth', vol: 0.26, drive: true }, pad: { type: 'sawtooth', vol: 0.06 }, drum: 0.6, echo: 0.35 },
  mountain: { bpm: 92, root: 60, scale: MAJ_PENT, prog: [[0, MAJ], [7, MAJ], [9, MIN], [5, MAJ]], lead: { type: 'triangle', vol: 0.5, density: 0.45 }, arp: { type: 'sine', vol: 0.2 }, bass: { type: 'sine', vol: 0.5, drive: false }, pad: { type: 'triangle', vol: 0.18 }, drum: 0.35, echo: 0.4 },
  halls: { bpm: 68, root: 62, scale: HIRAJOSHI, prog: [[0, SUS], [3, MIN], [-2, SUS], [0, MIN]], lead: { type: 'triangle', vol: 0.6, density: 0.4, pluck: true }, arp: null, bass: { type: 'sine', vol: 0.4, drive: false }, pad: { type: 'sine', vol: 0.14 }, drum: 0, echo: 0.35 },
  ruins: { bpm: 76, root: 45, scale: MINOR, prog: [[0, MIN], [5, MAJ], [3, MAJ], [7, MIN]], lead: { type: 'triangle', vol: 0.34, density: 0.22 }, arp: { type: 'sine', vol: 0.12 }, bass: { type: 'sawtooth', vol: 0.22, drive: false }, pad: { type: 'sawtooth', vol: 0.06 }, drum: 0.4, echo: 0.45 },
  frost: { bpm: 64, root: 60, scale: MIN_PENT, prog: [[0, MIN7], [8, MAJ7], [3, MAJ], [10, MAJ]], lead: { type: 'sine', vol: 0.45, density: 0.3, oct: 12 }, arp: { type: 'sine', vol: 0.22 }, bass: { type: 'sine', vol: 0.4, drive: false }, pad: { type: 'sine', vol: 0.2 }, drum: 0, echo: 0.55 },
  dust: { bpm: 90, root: 55, scale: DORIAN, prog: [[0, MIN], [5, MAJ], [0, MIN], [10, MAJ]], lead: { type: 'triangle', vol: 0.45, density: 0.35 }, arp: { type: 'triangle', vol: 0.12 }, bass: { type: 'sine', vol: 0.45, drive: true }, pad: { type: 'sawtooth', vol: 0.06 }, drum: 0.5, echo: 0.3 },
  // Free Roam V2 (the modern town)
  city: { bpm: 98, root: 55, scale: DORIAN, prog: [[0, MIN7], [5, MAJ7], [3, MAJ7], [10, MAJ]], lead: { type: 'triangle', vol: 0.45, density: 0.4 }, arp: { type: 'sine', vol: 0.2 }, bass: { type: 'sine', vol: 0.5, drive: true }, pad: { type: 'triangle', vol: 0.13 }, drum: 0.5, echo: 0.3 },
  // the opening scene, the end of a round, and the game over screen
  intro: { bpm: 72, root: 60, scale: MAJ_PENT, prog: [[0, MAJ7], [9, MIN7], [5, MAJ7], [7, SUS]], lead: { type: 'sine', vol: 0.5, density: 0.35, oct: 12 }, arp: { type: 'triangle', vol: 0.18 }, bass: { type: 'sine', vol: 0.4, drive: false }, pad: { type: 'sine', vol: 0.24 }, drum: 0, echo: 0.5 },
  ending: { bpm: 108, root: 60, scale: MAJ_PENT, prog: [[0, MAJ], [7, MAJ], [9, MIN], [5, MAJ]], lead: { type: 'triangle', vol: 0.55, density: 0.7, oct: 12 }, arp: { type: 'sine', vol: 0.3 }, bass: { type: 'sine', vol: 0.5, drive: false }, pad: { type: 'triangle', vol: 0.18 }, drum: 0.45, echo: 0.35 },
  gameover: { bpm: 54, root: 52, scale: MINOR, prog: [[0, MIN], [5, MIN], [8, MAJ], [7, MIN]], lead: { type: 'triangle', vol: 0.4, density: 0.22 }, arp: null, bass: { type: 'sine', vol: 0.5, drive: false }, pad: { type: 'sine', vol: 0.26 }, drum: 0, echo: 0.55 },
  depot: { bpm: 100, root: 48, scale: MINOR, prog: [[0, MIN], [0, MIN], [8, MAJ], [7, MIN]], lead: { type: 'square', vol: 0.12, density: 0.2 }, arp: { type: 'square', vol: 0.08 }, bass: { type: 'sawtooth', vol: 0.3, drive: true }, pad: { type: 'sawtooth', vol: 0.05 }, drum: 0.8, echo: 0.2 },
};

const FREE_THEME = { clover: 'meadow', tidal: 'island', emerald: 'island', crystal: 'crystal', marsh: 'marsh', lava: 'lava', beach: 'shore', asphalt: 'wasteland', mountain: 'mountain', mixed: 'meadow', wood: 'halls' };
const SURVIVAL_THEME = { ruins: 'ruins', frost: 'frost', autumn: 'dust', dust: 'dust', swamp: 'marsh', depot: 'depot', tidal: 'island', emerald: 'island', crystal: 'crystal', marsh: 'marsh', lava: 'lava', beach: 'shore', asphalt: 'wasteland', mountain: 'mountain', wood: 'halls', mixed: 'ruins' };

// which tune a world's seed gets
export function themeForSeed(seed) {
  const { base, map } = splitSeed(seed || '');
  if (base === SURVIVAL_BASE) return SURVIVAL_THEME[SURVIVAL_MAPS.find((m) => m.id === map)?.id] || 'ruins';
  return FREE_THEME[String(base).split('-')[0]] || 'meadow';
}

const listeners = new Set();
let dead = false; // set when a newer copy of this file has taken over
let want = 'menu'; // the tune the game asked for
let cur = null; // the tune that is playing
let theme = THEMES.menu;
let running = false;
let timer = 0;
let nodes = null; // the music's own mixer: { ctx, out, dry, delay }
let step = 0;
let nextT = 0;
let lead = 0; // where the melody is on the scale
let fading = 0;

const midi = (m) => 440 * 2 ** ((m - 69) / 12);
const level = () => (on ? vol * LEVEL : 0);

function build(a) {
  if (nodes && nodes.ctx === a.ctx) return nodes;
  const { ctx } = a;
  const out = ctx.createGain();
  out.gain.value = 0;
  out.connect(ctx.destination); // straight to the speakers: the sound effects' volume and mute do not touch the music
  const dry = ctx.createGain();
  dry.connect(out);
  const delay = ctx.createDelay(2);
  const fb = ctx.createGain();
  fb.gain.value = 0.38;
  const wet = ctx.createGain();
  wet.gain.value = 0.3;
  dry.connect(delay);
  delay.connect(fb);
  fb.connect(delay);
  delay.connect(wet);
  wet.connect(out);
  nodes = { ctx, out, dry, delay, wet };
  return nodes;
}

function voice(type, m, t, dur, v, attack = 0.01, pluck = false) {
  const { ctx, dry } = nodes;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = midi(m);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(v, t + attack);
  if (pluck) g.gain.exponentialRampToValueAtTime(v * 0.25, t + Math.min(dur, 0.18));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dry);
  o.start(t);
  o.stop(t + dur + 0.05);
}

let noiseBuf = null;
function tick(t, v, hat) {
  const { ctx, dry } = nodes;
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate / 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (hat) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(v * 0.25, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    s.connect(f).connect(g).connect(dry);
    s.start(t);
    s.stop(t + 0.06);
  } else {
    // a soft thump
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    g.gain.setValueAtTime(v * 0.9, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(dry);
    o.start(t);
    o.stop(t + 0.2);
  }
}

// one eighth note of the tune
function playStep(i, t, e) {
  const th = theme; // (`e` is the length of one eighth note, in seconds)
  const bar = Math.floor(i / 8) % th.prog.length;
  const s = i % 8;
  const [off, chord] = th.prog[bar];
  const base = th.root + off;
  if (s === 0) {
    // the pad holds the chord for the whole bar
    for (const n of chord) voice(th.pad.type, base + n - 12, t, e * 8 * 0.98, th.pad.vol, e * 3);
  }
  // bass: on the beat, or driving on every eighth
  if (th.bass.drive) voice(th.bass.type, base - 24, t, e * 0.9, th.bass.vol * (s % 2 ? 0.6 : 1), 0.01);
  else if (s === 0 || s === 4) voice(th.bass.type, base - 24, t, e * 3.8, th.bass.vol, 0.02);
  // arpeggio: the chord notes, a little different each time
  if (th.arp && Math.random() > 0.15) {
    const order = [0, 1, 2, 1, 2, 1, 0, 2];
    const n = chord[order[s] % chord.length];
    voice(th.arp.type, base + 12 + n, t, e * 1.6, th.arp.vol, 0.005, true);
  }
  // the melody wanders over the scale
  if (s % 2 === 0 || Math.random() < 0.15) {
    if (Math.random() < th.lead.density) {
      const sc = th.scale;
      lead += [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)];
      if (lead < 0) lead += 2;
      if (lead > sc.length * 2 - 1) lead -= 2;
      const note = th.root + 12 + (th.lead.oct || 0) + sc[lead % sc.length] + 12 * Math.floor(lead / sc.length);
      const len = [1, 1, 2, 3][Math.floor(Math.random() * 4)];
      voice(th.lead.type, note, t, e * len * 1.1, th.lead.vol, th.lead.pluck ? 0.004 : 0.02, !!th.lead.pluck);
    }
  }
  if (th.drum > 0) {
    if (s === 0 || s === 4) tick(t, th.drum * 0.5, false);
    else if (s % 2 === 1 && th.drum > 0.45) tick(t, th.drum * 0.5, true);
  }
}

function pump() {
  if (!running) return;
  const a = sfx.audio(); // null while muted
  if (!a || document.hidden || !nodes || !on) {
    nextT = 0;
    return;
  }
  const now = a.ctx.currentTime;
  const e = 60 / theme.bpm / 2; // one eighth note
  if (nextT < now) nextT = now + 0.05;
  while (nextT < now + AHEAD) {
    playStep(step++, nextT, e);
    nextT += e;
  }
}

function begin() {
  const a = sfx.audio();
  if (!a || !want) return false;
  build(a);
  cur = want;
  theme = THEMES[cur] || THEMES.meadow;
  nodes.delay.delayTime.value = Math.min(1.4, (60 / theme.bpm) * 0.75);
  nodes.wet.gain.value = theme.echo;
  step = 0;
  lead = 2;
  nextT = 0;
  nodes.out.gain.setTargetAtTime(level(), a.ctx.currentTime, 0.6);
  if (!running) {
    running = true;
    timer = setInterval(pump, 120);
  }
  return true;
}

// the music can only start after the player has pressed something (browsers insist on it), so it waits for the first click or key
function kick() {
  if (dead || !want || running) return;
  begin();
}
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', kick, { capture: true });
  window.addEventListener('keydown', kick, { capture: true });
}

export const music = {
  // ask for a tune; if another one is playing it fades out first
  play(name) {
    if (dead) return;
    want = THEMES[name] ? name : 'meadow';
    if (!running) {
      kick();
      return;
    }
    if (cur === want) return;
    const a = sfx.audio();
    if (!a || !nodes) return;
    nodes.out.gain.setTargetAtTime(0, a.ctx.currentTime, 0.2);
    clearTimeout(fading);
    fading = setTimeout(() => {
      if (running && cur !== want) begin();
    }, 900);
  },
  stop() {
    clearInterval(timer);
    running = false;
    cur = null;
    if (nodes) nodes.out.gain.setTargetAtTime(0, nodes.ctx.currentTime, 0.1);
  },
  // for checking: the current output level, and what is playing
  debug() {
    return { gain: nodes ? nodes.out.gain.value : null, running, cur, on, vol };
  },
  get on() {
    return on;
  },
  get volume() {
    return vol;
  },
  setOn(v) {
    on = !!v;
    try {
      localStorage.setItem(ON_KEY, on ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (nodes) nodes.out.gain.setTargetAtTime(level(), nodes.ctx.currentTime, 0.2);
    if (on) kick();
    this.changed();
  },
  setVolume(v) {
    vol = Math.min(1, Math.max(0, v));
    try {
      localStorage.setItem(VOL_KEY, String(vol));
    } catch {
      /* ignore */
    }
    if (nodes) nodes.out.gain.setTargetAtTime(level(), nodes.ctx.currentTime, 0.05);
    this.changed();
  },
  // call `fn` whenever the music setting changes; returns a function that stops listening
  listen(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  changed() {
    listeners.forEach((fn) => fn());
  },
};

// If this file is loaded again while the page stays open (the dev server reloading it), the old copy must not keep playing
// on its own where the new settings cannot reach it
if (typeof window !== 'undefined') {
  window.__cuzyMusicStop?.();
  window.__cuzyMusicStop = () => {
    dead = true;
    music.stop();
  };
}
