import { supplyTotal } from '../game/items';
import ItemIcon from './ItemIcon';

// Two quick slots, kept apart from the backpack hotbar: HP and Stamina (Q and E in Free Roam, Z and X in Survival). Tap one to see everything you can use there.
export default function SupplyBar({ supplies, consumables, onOpen, open, cds = {}, keys = ['Z', 'X'] }) {
  const slots = [
    { kind: 'hp', item: 'hppack', key: keys[0], tone: 'hp', label: 'HP' },
    { kind: 'stam', item: 'soupcan', key: keys[1], tone: 'stam', label: 'Stamina' },
  ];
  return (
    <div className="supply-bar" role="toolbar" aria-label="Quick supplies">
      {slots.map((s) => {
        const total = supplyTotal(s.kind, supplies, consumables);
        return (
          <button
            key={s.kind}
            type="button"
            className={`supply-slot ${s.tone} ${total > 0 ? '' : 'empty'} ${open === s.kind ? 'is-open' : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onOpen(s.kind)}
            title={`${s.label}: tap to see everything you can use (${s.key} uses the next one)`}
            aria-expanded={open === s.kind}
          >
            <span className="hot-key">{s.key}</span>
            <ItemIcon id={s.item} scale={2} />
            <span className="supply-label">{s.label}</span>
            <span className="qty">{total}</span>
            {cds[s.kind] > 0 && <i className="supply-cd" style={{ height: `${Math.min(100, (cds[s.kind] / (s.kind === 'hp' ? 6 : 5)) * 100)}%` }} />}
          </button>
        );
      })}
    </div>
  );
}
