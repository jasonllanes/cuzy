import { iconOf } from '../game/items';

// Renders an item's pixel icon from its sprite sheet, scaled by whole numbers so it stays crisp.
export default function ItemIcon({ id, scale = 4 }) {
  const icon = iconOf(id);
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
