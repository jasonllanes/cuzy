// Sound effects, synthesised with the Web Audio API so there are no audio files to ship.
// The audio context is created on the first sound (which always follows a click or key press).

const MUTE_KEY = 'cuzi-muted';
const VOLUME_KEY = 'cuzi-volume';
const VOICE_KEY = 'cuzi-voice';
const MASTER = 0.45;

let ctx = null;
let master = null;
let noiseBuf = null;
let out = null; // the volume bus of the sound being played right now
let muted = false;
let volume = 0.8; // the player's slider, 0..1
let voiceOn = true; // the announcer
try {
  muted = localStorage.getItem(MUTE_KEY) === '1';
  const v = parseFloat(localStorage.getItem(VOLUME_KEY));
  if (Number.isFinite(v)) volume = Math.min(1, Math.max(0, v));
  voiceOn = localStorage.getItem(VOICE_KEY) !== '0';
} catch {
  /* storage may be unavailable */
}
const listeners = new Set();
const changed = () => listeners.forEach((fn) => fn());

function ready() {
  if (muted) return false;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = MASTER * volume;
    master.connect(ctx.destination);
    // one second of white noise, reused by every whoosh and crunch
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return true;
}

// a pitched blip: frequency glides f0 -> f1 over `dur` seconds
function tone({ type = 'sine', f0, f1 = f0, dur = 0.1, vol = 0.3, at = 0, attack = 0.005 }) {
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}

// filtered noise: whooshes, hits, rattles
function noise({ dur = 0.1, vol = 0.3, at = 0, f0 = 1000, f1 = f0, q = 1, kind = 'bandpass' }) {
  const t = ctx.currentTime + at;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = kind;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(out);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.02);
}

const SOUNDS = {
  click: () => tone({ type: 'sine', f0: 820, f1: 620, dur: 0.05, vol: 0.12 }),
  swing: () => noise({ dur: 0.14, vol: 0.22, f0: 1500, f1: 450, q: 1.2 }),
  hit: () => {
    noise({ dur: 0.08, vol: 0.3, f0: 2200, f1: 700, q: 0.8 });
    tone({ type: 'triangle', f0: 190, f1: 70, dur: 0.1, vol: 0.35 });
  },
  hurt: () => {
    tone({ type: 'sawtooth', f0: 330, f1: 110, dur: 0.2, vol: 0.22 });
    noise({ dur: 0.1, vol: 0.2, f0: 900, f1: 300 });
  },
  block: () => {
    tone({ type: 'square', f0: 1200, f1: 900, dur: 0.08, vol: 0.14 });
    noise({ dur: 0.06, vol: 0.2, f0: 4000, kind: 'highpass' });
  },
  throw: () => noise({ dur: 0.11, vol: 0.18, f0: 1200, f1: 3500, q: 1.4 }),
  gun: () => {
    noise({ dur: 0.1, vol: 0.34, f0: 3400, f1: 260, q: 0.7 });
    tone({ type: 'square', f0: 220, f1: 60, dur: 0.09, vol: 0.2 });
  },
  boom: () => {
    noise({ dur: 0.45, vol: 0.45, f0: 1100, f1: 70, q: 0.6 });
    tone({ type: 'sawtooth', f0: 130, f1: 38, dur: 0.4, vol: 0.32 });
  },
  plasma: () => {
    tone({ type: 'sawtooth', f0: 900, f1: 220, dur: 0.16, vol: 0.2 });
    tone({ type: 'sine', f0: 1500, f1: 500, dur: 0.12, vol: 0.14, at: 0.01 });
  },
  thud: () => tone({ type: 'triangle', f0: 150, f1: 55, dur: 0.1, vol: 0.28 }),
  splat: () => {
    noise({ dur: 0.12, vol: 0.28, f0: 600, f1: 200, q: 0.7 });
    tone({ type: 'sine', f0: 260, f1: 90, dur: 0.1, vol: 0.2 });
  },
  dash: () => noise({ dur: 0.24, vol: 0.28, f0: 300, f1: 2200, q: 0.9 }),
  shield: () => {
    tone({ type: 'sine', f0: 440, f1: 880, dur: 0.28, vol: 0.2 });
    tone({ type: 'sine', f0: 660, f1: 1320, dur: 0.28, vol: 0.12, at: 0.04 });
  },
  coin: () => {
    tone({ type: 'square', f0: 988, dur: 0.06, vol: 0.1 });
    tone({ type: 'square', f0: 1319, dur: 0.16, vol: 0.1, at: 0.06 });
  },
  pickup: () => tone({ type: 'sine', f0: 560, f1: 940, dur: 0.1, vol: 0.18 }),
  heal: () => [523, 659, 784].forEach((f, i) => tone({ type: 'sine', f0: f, dur: 0.14, vol: 0.18, at: i * 0.07 })),
  eat: () => [0, 0.09, 0.18].forEach((at) => noise({ dur: 0.05, vol: 0.2, at, f0: 900, f1: 500, q: 2 })),
  drink: () => [0, 0.1, 0.2].forEach((at) => tone({ type: 'sine', f0: 300, f1: 520, dur: 0.08, vol: 0.14, at })),
  chest: () => {
    tone({ type: 'triangle', f0: 220, f1: 440, dur: 0.18, vol: 0.25 });
    [1047, 1319, 1568].forEach((f, i) => tone({ type: 'sine', f0: f, dur: 0.18, vol: 0.14, at: 0.12 + i * 0.07 }));
  },
  forage: () => noise({ dur: 0.1, vol: 0.16, f0: 2500, f1: 1200, q: 1.5 }),
  buy: () => {
    tone({ type: 'square', f0: 988, dur: 0.07, vol: 0.1 });
    tone({ type: 'square', f0: 1319, dur: 0.07, vol: 0.1, at: 0.07 });
    tone({ type: 'square', f0: 1760, dur: 0.2, vol: 0.1, at: 0.14 });
  },
  levelup: () => [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.16, vol: 0.2, at: i * 0.08 })),
  nope: () => [0, 0.11].forEach((at) => tone({ type: 'square', f0: 170, dur: 0.09, vol: 0.12, at })),
  skeletonDie: () => {
    tone({ type: 'sawtooth', f0: 240, f1: 60, dur: 0.4, vol: 0.2 });
    [0, 0.07, 0.14, 0.21].forEach((at) => noise({ dur: 0.04, vol: 0.22, at, f0: 3000, q: 3 }));
  },
  monsterDie: () => {
    tone({ type: 'square', f0: 420, f1: 90, dur: 0.28, vol: 0.14 });
    noise({ dur: 0.12, vol: 0.2, f0: 800, f1: 200 });
  },
  kill: () => {
    tone({ type: 'triangle', f0: 392, dur: 0.1, vol: 0.2 });
    tone({ type: 'triangle', f0: 587, dur: 0.18, vol: 0.2, at: 0.09 });
  },
  death: () => {
    tone({ type: 'sine', f0: 440, f1: 90, dur: 0.9, vol: 0.28 });
    tone({ type: 'sawtooth', f0: 220, f1: 50, dur: 0.9, vol: 0.1 });
  },
  respawn: () => [392, 523, 659].forEach((f, i) => tone({ type: 'sine', f0: f, dur: 0.16, vol: 0.18, at: i * 0.08 })),
  wave: () => {
    tone({ type: 'sawtooth', f0: 110, f1: 98, dur: 0.7, vol: 0.18 });
    tone({ type: 'sawtooth', f0: 165, f1: 147, dur: 0.7, vol: 0.1 });
  },
  win: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.2, vol: 0.22, at: i * 0.1 })),
  recall: () => tone({ type: 'sine', f0: 300, f1: 1200, dur: 0.5, vol: 0.18 }),
  place: () => {
    tone({ type: 'triangle', f0: 200, f1: 110, dur: 0.12, vol: 0.3 });
    noise({ dur: 0.08, vol: 0.2, f0: 700, f1: 300 });
  },
  // announcer stingers, bigger for bigger streaks
  streak1: () => [392, 523].forEach((f, i) => tone({ type: 'sawtooth', f0: f, dur: 0.22, vol: 0.13, at: i * 0.09 })),
  streak2: () => [392, 523, 659].forEach((f, i) => tone({ type: 'sawtooth', f0: f, dur: 0.24, vol: 0.15, at: i * 0.09 })),
  streak3: () => {
    [392, 523, 659, 784, 1047].forEach((f, i) => tone({ type: 'sawtooth', f0: f, dur: 0.26, vol: 0.16, at: i * 0.08 }));
    tone({ type: 'triangle', f0: 98, f1: 70, dur: 0.7, vol: 0.3 });
  },
  bat: () => tone({ type: 'sawtooth', f0: 1800, f1: 2400, dur: 0.06, vol: 0.05 }),
};

const lastAt = {};

export const sfx = {
  // `vol` (0..1) quietens far-away events; the same sound never fires twice within 45ms
  play(name, vol = 1) {
    const fn = SOUNDS[name];
    if (!fn || vol <= 0.02 || !ready()) return;
    const now = performance.now();
    if (now - (lastAt[name] || 0) < 45) return;
    lastAt[name] = now;
    try {
      out = ctx.createGain();
      out.gain.value = Math.min(1, vol);
      out.connect(master);
      fn();
    } catch {
      /* audio is a nicety; never let it break the game */
    }
  },
  get voice() {
    return voiceOn;
  },
  setVoice(v) {
    voiceOn = v;
    if (!v) window.speechSynthesis?.cancel();
    try {
      localStorage.setItem(VOICE_KEY, v ? '1' : '0');
    } catch {
      /* ignore */
    }
    changed();
  },
  // The announcer: the browser's own text-to-speech, pushed to sound like a shout: capitals and
  // exclamation marks, brisk and loud, and the bigger the streak (tier 1-3) the more it yells.
  speak(text, tier = 1) {
    const synth = window.speechSynthesis;
    if (!synth || muted || !voiceOn || volume <= 0) return;
    try {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(`${text.toUpperCase()}${'!'.repeat(Math.min(3, tier + 1))}`);
      const voices = synth.getVoices().filter((v) => /^en/i.test(v.lang));
      u.voice = voices.find((v) => /male|david|mark|daniel|george|james|guy/i.test(v.name) && !/female/i.test(v.name)) || voices[0] || null;
      u.pitch = 0.8 + tier * 0.15;
      u.rate = 1 + tier * 0.1;
      u.volume = Math.min(1, volume + 0.3); // announcers are always a little louder than the effects
      synth.speak(u);
    } catch {
      /* the voice is a bonus; never break the game over it */
    }
  },
  get muted() {
    return muted;
  },
  get volume() {
    return volume;
  },
  setVolume(v) {
    volume = Math.min(1, Math.max(0, v));
    if (master) master.gain.setTargetAtTime(MASTER * volume, ctx.currentTime, 0.02);
    try {
      localStorage.setItem(VOLUME_KEY, String(volume));
    } catch {
      /* ignore */
    }
    changed();
  },
  // call `fn` whenever the mute or volume setting changes; returns a function that stops listening
  on(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  setMuted(m) {
    muted = m;
    changed();
    try {
      localStorage.setItem(MUTE_KEY, m ? '1' : '0');
    } catch {
      /* ignore */
    }
  },
};
