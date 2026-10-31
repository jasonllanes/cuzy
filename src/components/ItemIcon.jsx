import { iconOf } from '../game/items';

// Renders an item's pixel icon from its sprite sheet, scaled by whole numbers so it stays crisp.
export default function ItemIcon({ id, scale = 4 }) {
  const icon = iconOf(id);
  // a big picture (a gun) is shrunk to fit a box instead of being drawn at its own size
  if (icon.fit) scale = (icon.fit * (scale / 3)) / Math.max(icon.sw, icon.sh);
  return (
    <span
      className="item-icon"
      style={{
        width: icon.sw * scale,
        height: icon.sh * scale,
        backgroundImage: `url(${import.meta.env.BASE_URL}assets/${icon.file}.png)`,
        backgroundSize: `${icon.sheetW * scale}px ${icon.sheetH * scale}px`,
        backgroundPosition: `-${icon.sx * scale}px -${icon.sy * scale}px`,
      }}
    />
  );
}
