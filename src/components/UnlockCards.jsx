import { useEffect, useRef, useState } from 'react';
import ItemIcon from './ItemIcon';

const SHOW_MS = 8000;
const FADE_MS = 600;

// A flash card for a skill that just unlocked: it pops up, fades after a few seconds, or goes when you close it.
function UnlockCard({ card, onGone }) {
  const [leaving, setLeaving] = useState(false);
  const gone = useRef(onGone); // (the parent re-renders all the time, so keep the timer out of its way)
  gone.current = onGone;
  useEffect(() => {
    const a = setTimeout(() => setLeaving(true), SHOW_MS);
    return () => clearTimeout(a);
  }, []);
  useEffect(() => {
    if (!leaving) return undefined;
    const b = setTimeout(() => gone.current(), FADE_MS);
    return () => clearTimeout(b);
  }, [leaving]);
  return (
    <div className={`unlock-card ${card.kind ? `get-card get-${card.kind}` : ''} ${leaving ? 'leaving' : ''}`} role="status" style={card.color ? { '--gc': card.color } : undefined}>
      <button type="button" className="unlock-close" aria-label="Close" onClick={() => setLeaving(true)}>✕</button>
      {card.kind === 'weapon' ? (
        <>
          <span className="unlock-ribbon">NEW WEAPON · {String(card.rarity).toUpperCase()}</span>
          <div className="unlock-icon"><span className="get-wicon" style={{ backgroundImage: `url(${import.meta.env.BASE_URL}assets/${card.file}.png)` }} /></div>
          <small>You found</small>
          <h3>{card.name}!</h3>
          <p>{card.desc}</p>
          <em>{card.equipped ? <>It is in your hand now. Swap in the shop (<kbd>B</kbd>).</> : <>Press <kbd>B</kbd> to equip it.</>}</em>
        </>
      ) : card.kind === 'loot' ? (
        <>
          <span className="unlock-ribbon">RARE LOOT · {String(card.rarity).toUpperCase()}</span>
          <div className="unlock-icon"><ItemIcon id={card.itemId} scale={4} /></div>
          <small>You found</small>
          <h3>{card.name}{card.qty > 1 ? ` ×${card.qty}` : ''}!</h3>
          <p>{card.desc}</p>
        </>
      ) : (
        <>
          <span className="unlock-ribbon">NEW SKILL · LEVEL {card.level}</span>
          <div className="unlock-icon">{card.icon}</div>
          <small>You've unlocked</small>
          <h3>{card.name}!</h3>
          <p>{card.desc}</p>
          <em>Press <kbd>B</kbd> to equip it{card.group === 'sword' ? ' and upgrade it' : ''}.</em>
        </>
      )}
      <i className="unlock-timer" style={{ animationDuration: `${SHOW_MS}ms` }} />
    </div>
  );
}

export default function UnlockCards({ cards, onGone }) {
  if (!cards.length) return null;
  return (
    <div className="unlock-cards">
      {cards.map((c) => <UnlockCard key={c.key} card={c} onGone={() => onGone(c.key)} />)}
    </div>
  );
}
