import { useState } from 'react';
import { RARITIES } from '../game/items';

// A shop list split into tabs by rarity (Common, Uncommon, Rare, Epic, Legendary, and All), so it is not one endless list.
// `items`: the things to show; `rarity(item)`: which rarity each one is; `children(list)`: how to draw a list of them.
// `owned(item)` (optional): when the shop opens on this list it starts on the highest rarity you already own, so upgrading is one click away.
// `types` ([[id, label], ...]) with `typeOf(item)` (optional): a second row of chips to filter by kind (sword, staff, axe...).
export default function RarityTabs({ items, rarity, owned, types = null, typeOf = null, children }) {
  const kinds = Object.keys(RARITIES).filter((k) => items.some((it) => rarity(it) === k));
  const [pick, setPick] = useState(null);
  const top = owned ? [...kinds].reverse().find((k) => items.some((it) => rarity(it) === k && owned(it))) : null; // (kinds run from common up to legendary)
  const now = pick && (pick === 'all' || kinds.includes(pick)) ? pick : top || kinds[0] || 'all';
  const [kindPick, setKindPick] = useState('all');
  const byRarity = now === 'all' ? items : items.filter((it) => rarity(it) === now);
  const kindsHere = types ? types.filter(([id]) => items.some((it) => typeOf(it) === id)) : [];
  const list = types && kindPick !== 'all' ? byRarity.filter((it) => typeOf(it) === kindPick) : byRarity;
  return (
    <div className="rar-tabs-wrap">
      <div className="rar-tabs" role="tablist">
        {kinds.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={now === k} className={`rar-tab ${now === k ? 'on' : ''}`} style={{ '--rc': RARITIES[k].color }} onClick={() => setPick(k)}>
            {RARITIES[k].name} <small>{items.filter((it) => rarity(it) === k).length}</small>
          </button>
        ))}
        <button type="button" role="tab" aria-selected={now === 'all'} className={`rar-tab ${now === 'all' ? 'on' : ''}`} style={{ '--rc': '#7a6f8a' }} onClick={() => setPick('all')}>
          All <small>{items.length}</small>
        </button>
      </div>
      {types && kindsHere.length > 1 && (
        <div className="rar-tabs kind-tabs" role="tablist" aria-label="Type">
          <button type="button" role="tab" aria-selected={kindPick === 'all'} className={`rar-tab kind ${kindPick === 'all' ? 'on' : ''}`} style={{ '--rc': '#5d6b8a' }} onClick={() => setKindPick('all')}>All types</button>
          {kindsHere.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={kindPick === id} className={`rar-tab kind ${kindPick === id ? 'on' : ''}`} style={{ '--rc': '#5d6b8a' }} onClick={() => setKindPick(id)}>
              {label} <small>{byRarity.filter((it) => typeOf(it) === id).length}</small>
            </button>
          ))}
        </div>
      )}
      {list.length === 0 && <p className="hint">Nothing of that type in this rarity: try another tab.</p>}
      {children(list)}
    </div>
  );
}
