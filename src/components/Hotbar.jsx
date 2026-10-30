import { ITEMS, rarityOf } from '../game/items';
import ItemIcon from './ItemIcon';

// The first nine backpack slots, selectable with the 1-9 keys.
// Drag a stack onto another slot to rearrange; let go anywhere else to drop it on the ground.
export default function Hotbar({ slots, selected, onSelect, onUse, onMove, onDropOut, children }) {
  const current = slots[selected];
  return (
    <div className="hotbar" role="toolbar" aria-label="Hotbar">
      <span className="hot-title">🎯 Items &amp; throwables · right-click to throw · drag out to drop</span>
      {slots.slice(0, 9).map((s, i) => (
        <button
          key={i}
          className={`hot-slot ${s ? `rar rar-${rarityOf(s.id)}` : ''} ${selected === i ? 'selected' : ''}`}
          onClick={() => (selected === i ? onUse(i) : onSelect(i))}
          onMouseDown={(e) => e.preventDefault()}
          draggable={!!s}
          onDragStart={(e) => {
            e.dataTransfer.setData('text/plain', String(i));
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(e) => {
            e.preventDefault();
            const from = Number(e.dataTransfer.getData('text/plain'));
            if (Number.isInteger(from) && from !== i) onMove(from, i);
          }}
          onDragEnd={(e) => {
            // nobody took it: it was let go away from the slots (a cancelled drag reports 0,0)
            if (e.dataTransfer.dropEffect === 'none' && (e.clientX || e.clientY)) onDropOut(i);
          }}
          title={s ? `${ITEMS[s.id].name} (click again to use, drag out to drop)` : 'Empty'}
        >
          <span className="hot-key">{i + 1}</span>
          {s && <ItemIcon id={s.id} scale={3} />}
          {s && s.qty > 1 && <span className="qty">{s.qty}</span>}
          {selected === i && current && <span className="hot-name">{ITEMS[current.id].name}</span>}
        </button>
      ))}
      {children}
    </div>
  );
}
