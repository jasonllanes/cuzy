import { ITEMS, isConsumable, throwDamage, throwRange, throwWeight } from '../game/items';
import ItemIcon from './ItemIcon';

// The first nine backpack slots, selectable with the 1-9 keys.
export default function Hotbar({ slots, selected, onSelect, onUse }) {
  const current = slots[selected];
  return (
    <div className="hotbar" role="toolbar" aria-label="Hotbar">
      <span className="hot-title">🎯 Items &amp; throwables · right-click to throw</span>
      {slots.slice(0, 9).map((s, i) => (
        <button
          key={i}
          className={`hot-slot ${selected === i ? 'selected' : ''}`}
          onClick={() => (selected === i ? onUse(i) : onSelect(i))}
          onMouseDown={(e) => e.preventDefault()}
          title={s ? `${ITEMS[s.id].name} (click again or press E to use)` : 'Empty'}
        >
          <span className="hot-key">{i + 1}</span>
          {s && <ItemIcon id={s.id} scale={3} />}
          {s && s.qty > 1 && <span className="qty">{s.qty}</span>}
          {s && !isConsumable(ITEMS[s.id]) && ITEMS[s.id].throw !== undefined && <span className="hot-dmg" title={`Thrown: ${throwWeight(s.id)}, flies ${(throwRange(s.id) / 16).toFixed(1)} tiles`}>💥{throwDamage(ITEMS[s.id])}</span>}
          {selected === i && current && <span className="hot-name">{ITEMS[current.id].name}</span>}
        </button>
      ))}
    </div>
  );
}
