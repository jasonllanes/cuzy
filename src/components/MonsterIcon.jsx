import { MONSTERS } from '../game/monsters';
import { apocSize } from '../game/apoc';
import { ZOMBIE_FRAMES } from '../game/apoc';
import { TINY } from '../game/tiny';

// A still picture of a monster for the HUD: the first frame of its sprite sheet, enlarged with crisp pixels.
export default function MonsterIcon({ type, size = 32 }) {
  const def = MONSTERS[type];
  if (!def) return null;
  const base = import.meta.env.BASE_URL;
  if (def.tiny) {
    // the first idle frame, cropped around the character
    const info = TINY.chars[def.tiny];
    const k = size / 30; // a 30px window around the character
    const cols = Math.max(...Object.values(info).filter(Array.isArray).map((a) => a[1]));
    return (
      <span
        className="monster-icon"
        title={def.name}
        style={{
          width: size,
          height: size,
          backgroundImage: `url(${base}assets/tiny/${def.tiny}.png)`,
          backgroundSize: `${cols * 100 * k}px ${800 * k}px`,
          backgroundPosition: `${-(info.cx - 15) * k}px ${-(info.foot - 27) * k}px`,
        }}
      />
    );
  }
  let file;
  let fw;
  let fh;
  let sheetW;
  if (def.apoc) {
    // a zombie's walk-down strip: frames side by side
    file = `apoc/z_${def.apoc}_walk_down`;
    const { w, h } = apocSize(`z_${def.apoc}_walk_down`);
    fw = w / ZOMBIE_FRAMES[def.apoc].walk;
    fh = h;
    sheetW = w;
  } else {
    file = `monsters/${def.sprite}`;
    fw = 16;
    fh = 16;
    sheetW = 64;
  }
  const scale = Math.max(1, Math.round(size / Math.max(fw, fh)));
  return (
    <span
      className="monster-icon"
      title={def.name}
      style={{
        width: fw * scale,
        height: fh * scale,
        backgroundImage: `url(${base}assets/${file}.png)`,
        backgroundSize: `${sheetW * scale}px ${fh * scale}px`,
        backgroundPosition: '0 0',
        filter: def.tint || undefined,
      }}
    />
  );
}
