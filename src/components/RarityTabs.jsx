import { useState } from 'react';
import { RARITIES } from '../game/items';

// A shop list split into tabs by rarity (Common, Uncommon, Rare, Epic, Legendary, and All), so it is not one endless list.
// `items`: the things to show; `rarity(item)`: which rarity each one is; `children(list)`: how to draw a list of them.
export default function RarityTabs({ items, rarity, children }) {
  const kinds = Object.keys(RARITIES).filter((k) => items.some((it) => rarity(it) === k));
  const [pick, setPick] = useState(null);
  const now = pick && (pick === 'all' || kinds.includes(pick)) ? pick : kinds[0] || 'all';
  const list = now === 'all' ? items : items.filter((it) => rarity(it) === now);
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
      {children(list)}
    </div>
  );
}
