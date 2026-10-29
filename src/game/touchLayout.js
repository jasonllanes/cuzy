import { useEffect, useState } from 'react';

// The mobile controls: what exists, where each one sits by default, and how a saved layout changes that.
// Positions are percentages of the screen (the middle of the control), so they work on any phone.
//   mirror: flipped left to right for left-handed players.   custom: what the player placed by hand (see LayoutEditor).
//   dock:   sits next to something else by default (the hotbar, or the attack button), wherever that ends up.

export const TOUCH = [
  { id: 'joystick', label: 'Joystick', x: 10, y: 80, joystick: true },
  { id: 'attack', kind: 'attack', label: '⚔️ Attack', icon: '⚔️', text: 'Attack', cls: 'round main', x: 93, y: 80, hold: true },
  { id: 'throw', kind: 'throw', label: '🎯 Throw', icon: '🎯', text: 'Throw', cls: 'round', x: 80, y: 83 },
  { id: 'use', kind: 'interact', label: '✋ Use', icon: '✋', text: 'Use', cls: 'round', x: 80, y: 63 },
  { id: 'shield', kind: 'shield', label: '🛡️ Shield', icon: '🛡️', text: 'Shield', dock: 'attack' },
  { id: 'invis', kind: 'invis', label: '👻 Invisible', icon: '👻', text: 'Hide', dock: 'attack' },
  { id: 'hp', kind: 'hp', label: '❤️ HP pack', icon: '❤️', text: 'HP', dock: 'slot0' },
  { id: 'stam', kind: 'stam', label: '⚡ Soup', icon: '🥫', text: 'Soup', dock: 'slot1' },
  { id: 'home', kind: 'recall', label: '🏠 Recall', icon: '🏠', text: 'Home', dock: 'right0' },
  { id: 'shop', kind: 'shop', label: '🛒 Shop', icon: '🛒', text: 'Shop', dock: 'right1' },
  { id: 'eat', kind: 'eat', label: '🍴 Eat', icon: '🍴', text: 'Eat', x: 95, y: 36 },
  { id: 'chat', kind: 'chat', label: '💬 Chat', icon: '💬', text: 'Chat', x: 95, y: 48 },
  { id: 'wall', kind: 'barricade', label: '🧱 Wall', icon: '🧱', text: 'Wall', x: 80, y: 46 },
];

export const LOCK_MIN = 100;
export const LOCK_MAX = 240;
// how far from the middle of the joystick the running lock is (joystick units: the circle itself is 66)
export const lockDistOf = (layout) => Math.min(LOCK_MAX, Math.max(LOCK_MIN, Number(layout?.lockDist) || 150));

// where the line and the lock sit for a given distance
export const lockStyles = (d) => ({
  line: { height: `${Math.max(6, d - 91)}px` },
  dot: { bottom: `calc(50% + ${d - 25}px)`, marginBottom: 0 },
});

// the screen, and the scales every control is drawn with
export function viewCtx(layout) {
  const css = getComputedStyle(document.documentElement);
  const num = (n, d) => Number(css.getPropertyValue(n)) || d;
  return { vw: window.innerWidth, vh: window.innerHeight, mz: num('--mz', 0.7), ts: num('--ts', 1), hs: num('--hs', 1), narrow: window.innerWidth <= 640, layout };
}

export function useViewCtx(layout) {
  const [, bump] = useState(0);
  useEffect(() => {
    const on = () => bump((n) => n + 1);
    window.addEventListener('resize', on);
    const t = setTimeout(on, 50);
    return () => {
      window.removeEventListener('resize', on);
      clearTimeout(t);
    };
  }, []);
  return viewCtx(layout);
}

// the hotbar is always in the same place, so the controls that dock to it can be worked out from the screen size
function hotbarGeom(ctx) {
  const slot = ctx.narrow ? 33 : 44;
  const s = ctx.mz * ctx.hs;
  const w = (9 * slot + 8 * 6 + 22) * s;
  const h = (slot + 20) * s;
  const left = (ctx.vw - w) / 2;
  const top = ctx.vh - 4 - h;
  return { s, w, h, left, top, slot: slot * s, pad: 11 * s, gap: 6 * s };
}

const BASE = { round: 68, main: 92, small: 44 };
const sizeOf = (c, mz, ts, sc) => (c.cls?.includes('main') ? BASE.main : c.cls?.includes('round') ? BASE.round : BASE.small) * mz * ts * sc;

// where a control is, how big (1 = normal) and how solid (1 = fully)
export function placeOf(layout, c, ctx) {
  const mine = layout.custom?.[c.id];
  if (mine) return { x: mine.x, y: mine.y, s: mine.s ?? 1, o: mine.o ?? 1, custom: true };
  if (c.dock && ctx) {
    const bsz = sizeOf(c, ctx.mz, ctx.ts, 1);
    const pct = (px, py) => ({ x: (px / ctx.vw) * 100, y: (py / ctx.vh) * 100, s: 1, o: 1, custom: false });
    if (c.dock === 'attack') {
      const a = TOUCH.find((t) => t.id === 'attack');
      const ap = placeOf(layout, a, ctx);
      const asz = sizeOf(a, ctx.mz, ctx.ts, ap.s);
      return pct((ap.x / 100) * ctx.vw, (ap.y / 100) * ctx.vh - asz / 2 - bsz / 2 - 6);
    }
    const g = hotbarGeom(ctx);
    if (c.dock === 'slot0' || c.dock === 'slot1') {
      const i = c.dock === 'slot0' ? 0 : 1;
      return pct(g.left + g.pad + i * (g.slot + g.gap) + g.slot / 2, g.top - bsz / 2 - 4);
    }
    const i = c.dock === 'right0' ? 0 : 1;
    return pct(g.left + g.w + bsz / 2 + 8 + i * (bsz + 6), g.top + g.h / 2);
  }
  return { x: layout.hand === 'left' ? 100 - (c.x ?? 50) : c.x ?? 50, y: c.y ?? 50, s: 1, o: 1, custom: false };
}

export const placeStyle = (p) => ({
  left: `${p.x}%`,
  top: `${p.y}%`,
  opacity: p.o,
  transform: `translate(-50%, -50%) scale(calc(var(--mz, 0.7) * var(--ts, 1) * ${p.s}))`,
});
