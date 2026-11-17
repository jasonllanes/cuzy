// Item icons are drawn with CSS background images. On a static host a single failed request (a busy moment, a 503) would leave a backpack or hotbar
// slot empty for good, so once the game art is loaded the icons are served from it: the same pictures, but already in the browser.
const BASE = import.meta.env.BASE_URL;
let imgs = null;
const cache = new Map();

export const setIconImages = (map) => {
  imgs = map;
  cache.clear();
};

export function iconUrl(file) {
  const fallback = `${BASE}assets/${file}.png`;
  const img = imgs?.[file];
  if (!img || !img.width) return fallback;
  if (cache.has(file)) return cache.get(file);
  try {
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    const url = c.toDataURL('image/png');
    cache.set(file, url);
    return url;
  } catch {
    return fallback;
  }
}
