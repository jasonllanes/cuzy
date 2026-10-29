import { ITEMS } from '../game/items';
import ItemIcon from './ItemIcon';

// Two quick slots, kept apart from the backpack hotbar: an HP Pack (Z) and a Soup Can for stamina (X).
export default function SupplyBar({ supplies, onUse, cds = {} }) {
  const slots = [
    { kind: 'hp', item: 'hppack', key: 'Z', tone: 'hp', label: 'HP' },
    { kind: 'stam', item: 'soupcan', key: 'X', tone: 'stam', label: 'Stamina' },
  ];
  return (
    <div className="supply-bar" role="toolbar" aria-label="Quick supplies">
      {slots.map((s) => (
        <button
          key={s.kind}
          type="button"
          className={`supply-slot ${s.tone} ${supplies[s.kind] > 0 ? '' : 'empty'}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onUse(s.kind)}
          title={`${ITEMS[s.item].name}: ${ITEMS[s.item].desc}`}
        >
          <span className="hot-key">{s.key}</span>
          <ItemIcon id={s.item} scale={2} />
          <span className="supply-label">{s.label}</span>
          <span className="qty">{supplies[s.kind]}</span>
          {cds[s.kind] > 0 && <i className="supply-cd" style={{ height: `${Math.min(100, (cds[s.kind] / (s.kind === 'hp' ? 6 : 5)) * 100)}%` }} />}
        </button>
      ))}
    </div>
  );
}
