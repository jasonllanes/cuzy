import { MONSTERS } from '../game/monsters';
import { ZOMBIE_FRAMES } from '../game/apoc';
import { TINY } from '../game/tiny';

// A monster of the game, drawn for the Training Room: the three kinds of art (the 16px cozy monsters, Survival's zombies and the
// Tiny RPG characters) with their feet at (x, y). `t` drives the loop, `moving` picks walking over standing, `face` is 1 or -1.
export function drawMob(ctx, assets, type, t, x, y, face = 1, moving = false) {
  const def = MONSTERS[type];
  if (!def) return;
  const sc = def.scale || 1;
  const flyer = def.kind === 'fly' || def.fly;
  const hover = flyer ? 7 + Math.sin(t * 4) * 1.5 : 0;
  x = Math.round(x);
  y = Math.round(y);
  ctx.fillStyle = 'rgba(30,20,30,0.25)';
  ctx.beginPath();
  ctx.ellipse(x, y - 1, 6 * sc, 2.2 * sc, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  if (def.tint) ctx.filter = def.tint;
  if (def.apoc) {
    const n = ZOMBIE_FRAMES[def.apoc].walk;
    const sheet = assets.img[`apoc/z_${def.apoc}_walk_${face < 0 ? 'left' : 'side'}`];
    const fw = sheet.width / n;
    const frame = moving ? Math.floor(t * 9) % n : 0;
    ctx.drawImage(sheet, frame * fw, 0, fw, sheet.height, x - Math.round((fw * sc) / 2), y - sheet.height * sc, fw * sc, sheet.height * sc);
  } else if (def.tiny) {
    const info = TINY.chars[def.tiny];
    const [row, n] = info[moving ? 'walk' : 'idle'];
    const f = Math.floor(t * (moving ? 10 : 6)) % n;
    ctx.translate(x, Math.round(y - hover));
    if (face < 0) ctx.scale(-1, 1);
    ctx.drawImage(assets.img[`tiny/${def.tiny}`], f * 100, row * 100, 100, 100, -info.cx * sc, -info.foot * sc, 100 * sc, 100 * sc);
  } else {
    const box = assets.mbox[def.sprite];
    const frame = Math.floor(t * 6) % 4;
    ctx.translate(x, Math.round(y - hover));
    if (face < 0) ctx.scale(-1, 1);
    ctx.drawImage(assets.img[`monsters/${def.sprite}`], frame * 16, 0, 16, 16, -8 * sc, -(box.bottom + 1) * sc, 16 * sc, 16 * sc);
  }
  ctx.restore();
}

// roughly how big a monster is on the map, to click it
export function mobSize(type) {
  const def = MONSTERS[type];
  if (def?.tiny) return { w: 20 * (def.scale || 1), h: 28 * (def.scale || 1) };
  const sc = def?.scale || 1;
  return { w: 14 * sc, h: 18 * sc };
}
