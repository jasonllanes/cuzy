import { useState } from 'react';
import { ITEMS, breaksOnImpact, consumeVerb, isConsumable, throwDamage } from '../game/items';
import ItemIcon from './ItemIcon';

export function Effects({ def }) {
  return (
    <div className="effects">
      {def.heal > 0 && <span className="effect heal">❤️ +{def.heal} HP</span>}
      {def.energy > 0 && <span className="effect energy">⚡ +{Math.round(def.energy * 100)}% Stamina</span>}
      <span className="effect throw">🎯 Throw · {throwDamage(def)} dmg{breaksOnImpact(def) ? ' · splats' : ''}</span>
    </div>
  );
}

export default function Inventory({ slots, game, onClose }) {
  const [selected, setSelected] = useState(null);
  const [dragFrom, setDragFrom] = useState(null);
  const slot = selected !== null ? slots[selected] : null;
  const def = slot ? ITEMS[slot.id] : null;
  const used = slots.filter(Boolean).length;

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panel inventory">
        <header className="inv-head">
          <h2>🎒 Backpack</h2>
          <span className="inv-count">{used} / {slots.length}</span>
          <button className="btn small-btn" onClick={onClose} aria-label="Close backpack">✕</button>
        </header>

        <div className="inv-body">
          <div className="inv-grid">
            {slots.map((s, i) => (
              <button
                key={i}
                className={`inv-slot ${selected === i ? 'selected' : ''} ${s ? 'filled' : ''}`}
                draggable={!!s}
                onClick={() => setSelected(i)}
                onDragStart={() => setDragFrom(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragFrom !== null) game.moveItem(dragFrom, i);
                  setSelected(i);
                  setDragFrom(null);
                }}
                title={s ? ITEMS[s.id].name : 'Empty'}
              >
                {s && <ItemIcon id={s.id} />}
                {s && s.qty > 1 && <span className="qty">{s.qty}</span>}
              </button>
            ))}
          </div>

          <aside className="inv-detail">
            {def ? (
              <>
                <div className="inv-detail-icon"><ItemIcon id={slot.id} scale={6} /></div>
                <h3>{def.name}</h3>
                <p>{def.desc}</p>
                <Effects def={def} />
                <p className="hint">Owned: {slot.qty}</p>
                <div className="inv-actions">
                  {isConsumable(def) && (
                    <button className="btn go small-btn" onClick={() => game.useItem(selected)}>
                      {consumeVerb(def)}
                    </button>
                  )}
                  <button className="btn small-btn" onClick={() => game.tossItem(selected)}>Toss one</button>
                  {slot.qty > 1 && <button className="btn ghost small-btn" onClick={() => game.tossItem(selected, true)}>Toss all</button>}
                </div>
              </>
            ) : (
              <p className="hint">Pick an item to see what it is. Drag items to rearrange them. The first nine slots are your hotbar.</p>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
