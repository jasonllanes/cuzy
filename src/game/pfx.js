import { clearFrame, composite, createFrame, createFx } from '../pixelfx/core/index.js';

// pixelfx (https://github.com/patch-gg/pixelfx, MIT) in the game. Effects are small programs that draw pixels, so they are used two ways:
//   * bakedLoop(): a looping effect (a ghost, a spinning coin) is drawn once into a strip of frames, and then drawn like any sprite
//   * Pfx.spawn(): a one-shot (a damage number, a burst) runs live for its short life and is drawn into the world or onto the screen
// Effects are loaded the first time they are asked for (each is its own small file).

const loaders = import.meta.glob('../pixelfx/fx/*/*.js');
const mods = new Map();
const loading = new Map();

export function loadFx(id) {
  if (mods.has(id)) return Promise.resolve(mods.get(id));
  if (!loading.has(id)) {
    const load = loaders[`../pixelfx/fx/${id}.js`];
    loading.set(id, load ? load().then((m) => (mods.set(id, m), m)) : Promise.resolve(null));
  }
  return loading.get(id);
}

// the module if it is already loaded (and it starts loading it if not)
export function fxModule(id) {
  const m = mods.get(id);
  if (!m) loadFx(id);
  return m || null;
}

const baked = new Map();

/**
 * A looping effect baked into a strip of frames: { sheet, n, W, H, ox, oy, fps }, or null while it loads.
 * o: the effect's options (palette, seed...), `pad` extra room round the picture, `fps` frames a second.
 */
export function bakedLoop(id, o = {}, fps = 15) {
  const key = `${id}|${fps}|${JSON.stringify(o)}`;
  const b = baked.get(key);
  if (b) return b;
  const mod = fxModule(id);
  if (!mod) return null;
  const { pad = 0, ...opts } = o;
  const [w, h] = mod.meta.size;
  const [ox, oy] = mod.meta.origin || [w / 2, h / 2];
  const W = w + pad * 2;
  const H = h + pad * 2;
  const n = Math.max(1, Math.round((mod.meta.duration || 1) * fps));
  const sheet = document.createElement('canvas');
  sheet.width = W * n;
  sheet.height = H;
  const sctx = sheet.getContext('2d');
  const frame = createFrame(W, H);
  const img = new ImageData(W, H);
  const fx = createFx(mod, { x: ox + pad, y: oy + pad, ...opts });
  for (let i = 0; i < n; i++) {
    fx.update(1 / fps);
    clearFrame(frame);
    fx.draw(frame);
    composite(frame, img.data, null);
    sctx.putImageData(img, i * W, 0);
  }
  const out = { sheet, n, W, H, ox: ox + pad, oy: oy + pad, fps };
  baked.set(key, out);
  return out;
}

/** Draw a baked loop with its origin at (x, y); t is the time in seconds, flip mirrors it, k scales it (0.5 is crisp). */
export function drawBaked(ctx, b, x, y, t, flip = false, alpha = 1, k = 1) {
  if (!b) return;
  const f = Math.floor(t * b.fps) % b.n;
  if (alpha < 1) ctx.globalAlpha = alpha;
  if (flip) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(-1, 1);
    ctx.drawImage(b.sheet, f * b.W, 0, b.W, b.H, -b.ox * k, -b.oy * k, b.W * k, b.H * k);
    ctx.restore();
  } else ctx.drawImage(b.sheet, f * b.W, 0, b.W, b.H, Math.round(x - b.ox * k), Math.round(y - b.oy * k), b.W * k, b.H * k);
  if (alpha < 1) ctx.globalAlpha = 1;
}

/** The live one-shot effects of a game. */
export class Pfx {
  constructor() {
    this.list = [];
    this.ready = true;
  }

  /** Warm up effects that will be needed at once (so the first damage number is not late). */
  preload(ids) {
    for (const id of ids) loadFx(id);
  }

  /**
   * Run an effect at (x, y) in the world (or on the screen with `screen: true`).
   * o: the effect's options, plus `angle`, `flip`, `scale` (1 by default; 0.5 is crisp, a whole number or a half), `follow` (a function giving the { x, y } to stay on) and `key`
   * (starting another effect with the same key replaces the first).
   */
  spawn(id, x, y, o = {}) {
    const mod = fxModule(id);
    if (!mod) return null; // (still loading: this one is skipped, the next ones are fine)
    const { screen = false, scale = 1, follow = null, key = null, life = null, ...opts } = o;
    if (key) this.list = this.list.filter((e) => e.key !== key);
    if (this.list.length > 40) return null; // (a very busy fight: the extra flourishes wait)
    const [w, h] = mod.meta.size;
    const [ox, oy] = mod.meta.origin || [w / 2, h / 2];
    const pad = opts.angle ? Math.ceil(Math.hypot(w, h) / 2) : 0;
    const W = w + pad * 2;
    const H = h + pad * 2;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const e = {
      id, key, x, y, screen, scale, follow, life, W, H, ox: ox + pad, oy: oy + pad, canvas,
      ctx: canvas.getContext('2d'), img: new ImageData(W, H), frame: createFrame(W, H),
      fx: createFx(mod, { x: ox + pad, y: oy + pad, ...opts }),
    };
    this.list.push(e);
    return e;
  }

  update(dt) {
    if (!this.list.length) return;
    for (const e of this.list) {
      if (e.follow) {
        const p = e.follow();
        if (p) {
          e.x = p.x;
          e.y = p.y;
        }
      }
      if (e.life !== null && (e.life -= dt) <= 0 && !e.stopped) {
        e.stopped = true;
        e.fx.stop();
      }
      e.fx.update(dt);
    }
    this.list = this.list.filter((e) => !e.fx.done());
  }

  render(e) {
    clearFrame(e.frame);
    e.fx.draw(e.frame);
    composite(e.frame, e.img.data, null);
    e.ctx.putImageData(e.img, 0, 0);
  }

  /** The world pass (the context is already in world pixels): everything inside the view, `view` = { x0, y0, x1, y1 }. */
  drawWorld(ctx, view) {
    for (const e of this.list) {
      if (e.screen) continue;
      if (e.x + e.W < view.x0 || e.x - e.W > view.x1 || e.y + e.H < view.y0 || e.y - e.H > view.y1) continue;
      this.render(e);
      ctx.drawImage(e.canvas, Math.round(e.x - e.ox * e.scale), Math.round(e.y - e.oy * e.scale), e.W * e.scale, e.H * e.scale);
    }
  }

  /** The screen pass: (x, y) are canvas pixels, `scale` makes the pixels bigger (a whole number keeps them crisp). */
  drawScreen(ctx, scaleOf = 2) {
    for (const e of this.list) {
      if (!e.screen) continue;
      this.render(e);
      const k = Math.max(1, Math.round(scaleOf * e.scale));
      ctx.drawImage(e.canvas, Math.round(e.x - e.ox * k), Math.round(e.y - e.oy * k), e.W * k, e.H * k);
    }
  }
}
