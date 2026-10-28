// Deterministic hashing + noise so a seed string always yields the same world.

export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 16;
  return h >>> 0;
}

// Integer lattice hash -> [0, 1)
export function hash2(x, y, seed) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const smooth = (t) => t * t * (3 - 2 * t);

export function valueNoise(x, y, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smooth(x - x0);
  const fy = smooth(y - y0);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  return a + (b - a) * fx + (c - a + (a - b - c + d) * fx) * fy;
}

export function fbm(x, y, seed, octaves = 4) {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, y * freq, seed + i * 131);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

export const smoothstep = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const WORDS_A = ['sunny', 'mossy', 'tiny', 'honey', 'cloudy', 'sleepy', 'bubbly', 'cozy', 'rosy', 'minty', 'fuzzy', 'dewy'];
const WORDS_B = ['meadow', 'pond', 'acorn', 'burrow', 'orchard', 'teacup', 'willow', 'biscuit', 'clover', 'lantern', 'nook', 'hollow'];
const NAMES = ['Pip', 'Mochi', 'Clover', 'Willow', 'Bean', 'Maple', 'Nova', 'Poppy', 'Juniper', 'Tofu', 'Sprout', 'Biscuit'];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const randomSeed = () => `${pick(WORDS_A)}-${pick(WORDS_B)}-${Math.floor(Math.random() * 900 + 100)}`;
export const randomName = () => pick(NAMES);
