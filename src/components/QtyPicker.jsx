import { useEffect, useRef, useState } from 'react';
import { ITEMS } from '../game/items';
import ItemIcon from './ItemIcon';

// "How many?" for a stack you are about to drop or move.
export default function QtyPicker({ id, max, verb = 'Drop', onConfirm, onCancel }) {
  const [n, setN] = useState(max);
  const input = useRef(null);
  useEffect(() => input.current?.select(), []);
  const set = (v) => setN(Math.min(max, Math.max(1, Math.round(Number(v)) || 1)));
  return (
    <div className="overlay qty-overlay" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <form
        className="panel qty-card"
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(n);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onCancel();
          }
        }}
      >
        <div className="qty-head">
          <ItemIcon id={id} scale={4} />
          <div>
            <h3>{verb} how many?</h3>
            <small>{ITEMS[id].name} · you have {max}</small>
          </div>
        </div>
        <input type="range" min={1} max={max} value={n} onChange={(e) => set(e.target.value)} aria-label="Quantity" />
        <div className="qty-row">
          <input ref={input} type="number" min={1} max={max} value={n} onChange={(e) => set(e.target.value)} aria-label="Exact quantity" />
          <button type="button" className="btn small-btn" onClick={() => set(1)}>1</button>
          <button type="button" className="btn small-btn" onClick={() => set(Math.ceil(max / 2))}>Half</button>
          <button type="button" className="btn small-btn" onClick={() => set(max)}>All</button>
        </div>
        <div className="qty-actions">
          <button type="button" className="btn ghost small-btn" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn go small-btn">{verb} {n}</button>
        </div>
      </form>
    </div>
  );
}
