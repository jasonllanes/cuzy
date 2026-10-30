// V2 heroes: the ready-made characters of the pack. Every sheet is made of 16x32 frames. Row 2 (y 32) is the idle loop and row 3
// (y 64) the walk loop, each 6 frames for every direction: right, up, left, down.

export const V2_HEROES = [
  ...Array.from({ length: 6 }, (_, i) => ({ id: `v2:scout${i + 1}`, label: `Scout ${i + 1}`, file: `chars/scout${i + 1}.png` })),
  ...Array.from({ length: 3 }, (_, i) => ({ id: `v2:postman${i + 1}`, label: `Postman ${i + 1}`, file: `chars/postman${i + 1}.png` })),
];
export const isV2Hero = (id) => typeof id === 'string' && id.startsWith('v2:');
export const v2HeroOf = (id) => V2_HEROES.find((h) => h.id === id) || null;
export const SHEET_W = 927; // (every character sheet is the same size)
export const SHEET_H = 656;

const DIR = { right: 0, up: 1, left: 2, down: 3 };
export const FRAME_W = 16;
export const FRAME_H = 32;

// feet at (x, y)
export function drawChar(ctx, img, dir, moving, t, x, y) {
  const d = DIR[dir] ?? 3;
  const frame = moving ? Math.floor(t * 10) % 6 : Math.floor(t * 4) % 6;
  const row = moving ? 64 : 32;
  ctx.drawImage(img, (d * 6 + frame) * FRAME_W, row, FRAME_W, FRAME_H, Math.round(x - 8), Math.round(y - 30), FRAME_W, FRAME_H);
}
