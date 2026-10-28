import { MONSTER_SPRITES } from './monsters';
import { APOC_KEYS } from './apoc';

const SUNNY_PARTS = ['base', 'shorthair', 'bowlhair', 'spikeyhair', 'mophair', 'longhair', 'curlyhair'];

const NAMES = [
  ...SUNNY_PARTS.flatMap((p) => [`sunny/${p}_idle`, `sunny/${p}_walk`]),
  'grass', 'trees', 'house', 'chest', 'crops', 'stones',
  'chicken_red', 'chicken_green', 'cow_f', 'cow_m',
  'items/mushroom_red', 'items/mushroom_blue',
  'items/acron', 'items/jar_01', 'items/jar_02', 'items/milk', 'items/egg', 'items/coin', 'items/ore_gold',
  'items/ore_bluestone', 'items/mug_01', 'items/wool', 'items/truffle', 'items/seeds_generic', 'items/rock',
  'skeleton_idle', 'skeleton_walk', 'skeleton_attack', 'skeleton_hurt', 'skeleton_death', 'sword',
  ...Array.from({ length: 32 }, (_, i) => `retro/c${i + 1}`),
  'adam_idle', 'adam_run', 'alex_idle', 'alex_run',
  'amelia_idle', 'amelia_run', 'bob_idle', 'bob_run',
  'items/crate_top',
  ...MONSTER_SPRITES.map((n) => `monsters/${n}`),
  ...APOC_KEYS.map((k) => `apoc/${k}`),
];

const load = (name) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve([name, img]);
    img.onerror = () => reject(new Error(`Could not load ${name}`));
    img.src = `${import.meta.env.BASE_URL}assets/${name}.png`;
  });

// The pack only ships a grass tileset, so we tint it into a warm sand twin
// for beaches. Same autotile layout, different mood.
function recolorToSand(img) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    const lum = (px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11) / 255;
    // brightest -> pale sand, darkest -> toasted edge
    const t = Math.min(1, Math.max(0, (lum - 0.25) / 0.4));
    px[i] = 196 + 50 * t;
    px[i + 1] = 160 + 62 * t;
    px[i + 2] = 106 + 66 * t;
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

// Each monster sheet has a bit of empty space round the art. Measure where the art actually sits
// (across all 4 frames) so monsters can be planted by their feet.
function measure(image) {
  const c = document.createElement('canvas');
  c.width = image.width;
  c.height = image.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(image, 0, 0);
  const px = ctx.getImageData(0, 0, c.width, c.height).data;
  const box = { left: 16, right: 0, top: 16, bottom: 0 };
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (!px[(y * c.width + x) * 4 + 3]) continue;
      const fx = x % 16;
      box.left = Math.min(box.left, fx);
      box.right = Math.max(box.right, fx);
      box.top = Math.min(box.top, y);
      box.bottom = Math.max(box.bottom, y);
    }
  }
  return box;
}

export async function loadAssets() {
  const entries = await Promise.all(NAMES.map(load));
  const img = Object.fromEntries(entries);
  img.sand = recolorToSand(img.grass);
  const mbox = Object.fromEntries(MONSTER_SPRITES.map((n) => [n, measure(img[`monsters/${n}`])]));
  return { img, mbox };
}
