import { SURVIVOR } from './apoc';

export const HEROES = [
  { id: 'adam', kind: 'modern', label: 'Adam', title: 'Moss Wanderer', blurb: 'Loves long walks and mossy hats.' },
  { id: 'alex', kind: 'modern', label: 'Alex', title: 'Cozy Baker', blurb: 'Always smells like warm bread.' },
  { id: 'amelia', kind: 'modern', label: 'Amelia', title: 'Dream Gardener', blurb: 'Talks to flowers. They answer.' },
  { id: 'bob', kind: 'modern', label: 'Bob', title: 'Quiet Stargazer', blurb: 'Naps first, adventures later.' },
];

// ---------- Super Retro World character pack: 32 little heroes, 16x20 frames (3 walk frames x 4 directions) ----------

export const RETRO_COUNT = 32;
export const retroId = (n) => `retro:${n}`;
export const isRetro = (id) => typeof id === 'string' && id.startsWith('retro:');
export const RETRO_NAMES = [
  'Ember', 'Frost', 'Violet', 'Moss', 'Peach', 'Blaze', 'Clover', 'Dusk',
  'Pip', 'Ivy', 'Coral', 'Sage', 'Rusty', 'Misty', 'Nova', 'Basil',
  'Poppy', 'Ash', 'Willow', 'Ginger', 'Indigo', 'Fern', 'Maple', 'Storm',
  'Sunny', 'Olive', 'Berry', 'Cedar', 'Pearl', 'Jade', 'Ruby', 'Onyx',
];

// ---------- Modern Exteriors characters (Free Roam V2): 16x32 frames, a 6-frame idle and walk loop in 4 directions ----------

export const V2_CHARS = [
  ...Array.from({ length: 6 }, (_, i) => ({ id: `v2:scout${i + 1}`, sheet: `scout${i + 1}`, label: `Scout ${i + 1}` })),
  ...Array.from({ length: 3 }, (_, i) => ({ id: `v2:postman${i + 1}`, sheet: `postman${i + 1}`, label: `Postman ${i + 1}` })),
];
export const isV2Char = (id) => typeof id === 'string' && id.startsWith('v2:');
const V2_DIR = { right: 0, up: 1, left: 2, down: 3 };

// ---------- Training ground heroes: 8 characters on one sheet (public/assets/dev/chars.png), 10 poses each ----------

export const DEV_COUNT = 8;
export const devId = (n) => `dev:${n}`;
export const isDev = (id) => typeof id === 'string' && id.startsWith('dev:');
export const DEV_NAMES = ['Ember', 'Azure', 'Goldie', 'Mossy', 'Rusty', 'Violet', 'Shade', 'Blossom'];

// ---------- Sunnyside villager: a body plus a swappable, recolourable hair layer ----------

export const HAIRS = [
  ['shorthair', 'Neat'],
  ['bowlhair', 'Bowl cut'],
  ['spikeyhair', 'Spiky'],
  ['mophair', 'Mop'],
  ['longhair', 'Ponytail'],
  ['curlyhair', 'Curly'],
];

// h/s: target hue (deg) and saturation. l0/lk: new lightness = l0 + original lightness * lk
export const HAIR_COLORS = [
  { name: 'Natural', swatch: 'conic-gradient(#8a5a3a, #c9622a, #d9362f, #2d2430, #8a5a3a)' },
  { name: 'Honey', h: 42, s: 0.85, l0: 0.1, lk: 1, swatch: '#e8b23c' },
  { name: 'Bubblegum', h: 335, s: 0.8, l0: 0.12, lk: 1, swatch: '#f283ad' },
  { name: 'Sky', h: 205, s: 0.75, l0: 0.1, lk: 1, swatch: '#5aaee8' },
  { name: 'Mint', h: 145, s: 0.6, l0: 0.1, lk: 1, swatch: '#58c98a' },
  { name: 'Lilac', h: 270, s: 0.6, l0: 0.12, lk: 1, swatch: '#a98ae8' },
  { name: 'Snow', h: 0, s: 0, l0: 0.5, lk: 0.5, swatch: '#ececf2' },
];

// Survival's survivor has one look, so the menu offers it in a few jacket colours
export const SURVIVOR_COLORS = [
  { name: 'Forest', swatch: '#3f7a5a' },
  { name: 'Brick', h: 355, swatch: '#c8504a' },
  { name: 'Navy', h: 215, swatch: '#3f6fb0' },
  { name: 'Mustard', h: 44, swatch: '#d8a73c' },
  { name: 'Plum', h: 285, swatch: '#8a5cb0' },
  { name: 'Slate', h: 215, sat: 0.1, swatch: '#7b8794' },
];
export const survivorId = (color = 0) => `survivor:${color}`;
export const isSurvivor = (id) => typeof id === 'string' && id.startsWith('survivor');

export const sunnyId = (hair, color = 0) => `sunny:${hair}:${color}`;
export const isSunny = (id) => typeof id === 'string' && id.startsWith('sunny:');

export function heroById(id) {
  const classic = HEROES.find((h) => h.id === id);
  if (classic) return classic;
  const v2 = V2_CHARS.find((h) => h.id === id);
  if (v2) return { ...v2, kind: 'v2', title: 'Modern Exteriors', blurb: 'A character from the Modern Exteriors pack.' };
  const dm = /^dev:(\d+)$/.exec(id || '');
  if (dm && Number(dm[1]) >= 1 && Number(dm[1]) <= DEV_COUNT) {
    const n = Number(dm[1]);
    return { id, kind: 'dev', n, label: DEV_NAMES[n - 1], title: `Training hero ${n}`, blurb: 'A character from the training ground sheet.' };
  }
  const rm = /^retro:(\d+)$/.exec(id || '');
  if (rm && Number(rm[1]) >= 1 && Number(rm[1]) <= RETRO_COUNT) {
    const n = Number(rm[1]);
    return { id, kind: 'retro', n, label: RETRO_NAMES[n - 1], title: `Retro Hero ${n}`, blurb: 'A pixel adventurer from the Super Retro World pack.' };
  }
  const sv = /^survivor(?::(\d+))?$/.exec(id || '');
  if (sv && SURVIVOR_COLORS[Number(sv[1] || 0)]) return { ...SURVIVOR, id, color: Number(sv[1] || 0) };
  const m = /^sunny:(\w+):(\d+)$/.exec(id || '');
  if (m && HAIRS.some(([k]) => k === m[1]) && HAIR_COLORS[Number(m[2])]) {
    return {
      id,
      kind: 'sunny',
      hair: m[1],
      color: Number(m[2]),
      label: 'Villager',
      title: 'Sunny Villager',
      blurb: 'Make them yours: pick a hairstyle and a colour.',
    };
  }
  return HEROES[0];
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

function recolor(image, cfg) {
  const c = document.createElement('canvas');
  c.width = image.width;
  c.height = image.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    if (!px[i + 3]) continue;
    const [, , l] = rgbToHsl(px[i], px[i + 1], px[i + 2]);
    const [r, g, b] = hslToRgb(cfg.h, cfg.s, Math.min(1, Math.max(0, cfg.l0 + l * cfg.lk)));
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

const sunnyCache = new Map();

// The survivor's jacket is the only green on the sprite, so recolouring just shifts green pixels
const jacketCache = new Map();
function survivorSheet(img, key, color) {
  const base = img[`apoc/${key}`];
  const cfg = SURVIVOR_COLORS[color];
  if (!cfg || cfg.h === undefined) return base;
  const ck = `${key}:${color}`;
  let sheet = jacketCache.get(ck);
  if (sheet) return sheet;
  sheet = document.createElement('canvas');
  sheet.width = base.width;
  sheet.height = base.height;
  const ctx = sheet.getContext('2d');
  ctx.drawImage(base, 0, 0);
  const data = ctx.getImageData(0, 0, sheet.width, sheet.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    if (!px[i + 3]) continue;
    const [h, s, l] = rgbToHsl(px[i], px[i + 1], px[i + 2]);
    if (h < 70 || h > 200 || s < 0.12) continue;
    const [r, g, b] = hslToRgb(cfg.h, cfg.sat ?? s, l);
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
  }
  ctx.putImageData(data, 0, 0);
  jacketCache.set(ck, sheet);
  return sheet;
}

// idle + walk strips with body and (recoloured) hair already stacked
function sunnySheets(img, hair, color) {
  const key = `${hair}:${color}`;
  let sheets = sunnyCache.get(key);
  if (sheets) return sheets;
  const cfg = HAIR_COLORS[color];
  sheets = {};
  for (const anim of ['idle', 'walk']) {
    const base = img[`sunny/base_${anim}`];
    const hairImg = img[`sunny/${hair}_${anim}`];
    const c = document.createElement('canvas');
    c.width = base.width;
    c.height = base.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(base, 0, 0);
    ctx.drawImage(cfg.h === undefined ? hairImg : recolor(hairImg, cfg), 0, 0);
    sheets[anim] = c;
  }
  sunnyCache.set(key, sheets);
  return sheets;
}

const MODERN_DIR = { right: 0, up: 1, left: 2, down: 3 };
const RETRO_ROW = { down: 0, left: 1, right: 2, up: 3 };
const RETRO_WALK = [0, 1, 2, 1];

// The training sheet is not on a tidy grid, so find where every pose sits: runs of non-empty columns are the poses
// (10 across) and runs of non-empty rows are the characters (8 down).
let devLayoutCache = null;
export function devLayout(image) {
  if (devLayoutCache) return devLayoutCache;
  const c = document.createElement('canvas');
  c.width = image.width;
  c.height = image.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(image, 0, 0);
  const px = ctx.getImageData(0, 0, c.width, c.height).data;
  const runs = (len, any) => {
    const out = [];
    let start = null;
    for (let i = 0; i < len; i++) {
      const on = any(i);
      if (on && start === null) start = i;
      if (!on && start !== null) {
        out.push([start, i - 1]);
        start = null;
      }
    }
    if (start !== null) out.push([start, len - 1]);
    return out;
  };
  let cols = runs(c.width, (x) => { for (let y = 0; y < c.height; y++) if (px[(y * c.width + x) * 4 + 3]) return true; return false; });
  let rows = runs(c.height, (y) => { for (let x = 0; x < c.width; x++) if (px[(y * c.width + x) * 4 + 3]) return true; return false; });
  if (cols.length !== 10) cols = Array.from({ length: 10 }, (_, i) => [Math.round(i * (c.width / 10)), Math.round((i + 1) * (c.width / 10)) - 1]);
  if (rows.length !== 8) rows = Array.from({ length: 8 }, (_, i) => [i * (c.height / 8), (i + 1) * (c.height / 8) - 1]);
  devLayoutCache = { cols: cols.map(([x0, x1]) => ({ x0, x1 })), rows: rows.map(([y0, y1]) => ({ y0, y1 })) };
  return devLayoutCache;
}

// which pose is which: front, back and sideways, with a four-step walk through each (the sideways art is flipped for the other way)
const DEV_POSES = { down: { stand: 1, walk: [0, 1, 3, 1] }, up: { stand: 5, walk: [4, 5, 6, 5] }, side: { stand: 8, walk: [7, 8, 9, 8] } };
export const DEV_SIDE_FACES_RIGHT = true;

// Draws a hero with its feet at (fx, fy). Returns nothing.
export function drawHero(ctx, img, hero, dir, moving, t, fx, fy) {
  fx = Math.round(fx);
  fy = Math.round(fy);
  if (hero.kind === 'dev') {
    const L = devLayout(img['dev/chars']);
    const row = L.rows[hero.n - 1];
    const way = dir === 'up' ? 'up' : dir === 'down' ? 'down' : 'side';
    const poses = DEV_POSES[way];
    const col = L.cols[moving ? poses.walk[Math.floor(t * 9) % 4] : poses.stand];
    const w = col.x1 - col.x0 + 1;
    const h = row.y1 - row.y0 + 1;
    const flip = way === 'side' && (dir === 'left') === DEV_SIDE_FACES_RIGHT;
    ctx.save();
    ctx.translate(fx, fy);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(img['dev/chars'], col.x0, row.y0, w, h, -Math.round(w / 2), -h, w, h);
    ctx.restore();
    return;
  }
  if (hero.kind === 'v2') {
    const sheet = img[`v2/chars/${hero.sheet}`];
    if (!sheet) return;
    const f = moving ? Math.floor(t * 10) % 6 : Math.floor(t * 4) % 6;
    ctx.drawImage(sheet, ((V2_DIR[dir] ?? 3) * 6 + f) * 16, moving ? 64 : 32, 16, 32, fx - 8, fy - 30, 16, 32);
    return;
  }
  if (hero.kind === 'retro') {
    const frame = moving ? RETRO_WALK[Math.floor(t * 9) % 4] : 1;
    ctx.drawImage(img[`retro/c${hero.n}`], frame * 16, RETRO_ROW[dir] * 20, 16, 20, fx - 8, fy - 19, 16, 20);
    return;
  }
  if (hero.kind === 'sunny') {
    // 96x64 frames, feet on row 39; the art only faces sideways, so up/down reuse the right-facing frames
    const sheets = sunnySheets(img, hero.hair, hero.color);
    const frames = moving ? 8 : 9;
    const frame = Math.floor(t * (moving ? 10 : 6)) % frames;
    const sheet = moving ? sheets.walk : sheets.idle;
    ctx.save();
    ctx.translate(fx, fy - 39);
    if (dir === 'left') ctx.scale(-1, 1);
    ctx.drawImage(sheet, frame * 96, 0, 96, 64, -48, 0, 96, 64);
    ctx.restore();
    return;
  }
  if (hero.kind === 'apoc') {
    // Survival's survivor: separate sheets for each way they face, six frames each
    const way = dir === 'right' ? 'side' : dir;
    const sheet = survivorSheet(img, `char_${moving ? 'run' : 'idle'}_${way}`, hero.color || 0);
    const fw = sheet.width / 6;
    const frame = Math.floor(t * (moving ? 11 : 6)) % 6;
    ctx.drawImage(sheet, frame * fw, 0, fw, sheet.height, Math.round(fx - fw / 2), fy - sheet.height, fw, sheet.height);
    return;
  }
  const sheet = img[`${hero.id}_${moving ? 'run' : 'idle'}`];
  const frame = Math.floor(t * (moving ? 11 : 6)) % 6;
  ctx.drawImage(sheet, (MODERN_DIR[dir] * 6 + frame) * 16, 0, 16, 32, fx - 8, fy - 31, 16, 32);
}
