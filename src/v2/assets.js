// V2 art: the Modern Exteriors pack, packed into one atlas per theme by scripts/build-v2-assets.py (public/assets/v2).
// Atlases are loaded when they are first needed, so opening the room does not download the whole pack.

const BASE = `${import.meta.env.BASE_URL}assets/v2/`;

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });

let indexPromise = null;
export const loadIndex = () => (indexPromise ||= fetch(`${BASE}index.json`).then((r) => r.json()));

const themePromises = new Map();
export const loadedThemes = new Map(); // id -> { id, img, items, byName }

export function loadTheme(id) {
  if (!themePromises.has(id)) {
    themePromises.set(
      id,
      Promise.all([loadImage(`${BASE}atlas/${id}.png`), fetch(`${BASE}atlas/${id}.json`).then((r) => r.json())]).then(([img, data]) => {
        const items = data.map(([name, x, y, w, h]) => ({ theme: id, name, x, y, w, h }));
        const theme = { id, img, items, byName: new Map(items.map((i) => [i.name, i])) };
        loadedThemes.set(id, theme);
        return theme;
      }),
    );
  }
  return themePromises.get(id);
}

export const atlasUrl = (id) => `${BASE}atlas/${id}.png`;

const sheetPromises = new Map();
export const loadSheet = (path) => {
  if (!sheetPromises.has(path)) sheetPromises.set(path, loadImage(`${BASE}${path}`));
  return sheetPromises.get(path);
};

// a sprite of a loaded theme by exact name, or the first whose name matches the pattern
export function sprite(themeId, match) {
  const t = loadedThemes.get(themeId);
  if (!t) return null;
  if (typeof match === 'string') return t.byName.get(match) || null;
  return t.items.find((i) => match.test(i.name)) || null;
}

export function drawSprite(ctx, s, x, y) {
  const t = loadedThemes.get(s.theme);
  if (t) ctx.drawImage(t.img, s.x, s.y, s.w, s.h, x, y, s.w, s.h);
}
