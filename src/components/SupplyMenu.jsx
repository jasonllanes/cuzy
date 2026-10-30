import { ITEMS } from '../game/items';
import { hp100 } from '../game/stats';
import ItemIcon from './ItemIcon';

const effect = (def) => [def.heal ? `+${Math.round(def.heal * 100)}% HP` : '', def.energy ? `+${Math.round(def.energy * 100)}% stamina` : ''].filter(Boolean).join(' · ');

// The list behind the HP and Stamina slots: every food, drink and medicine you carry that does that job
export default function SupplyMenu({ kind, hud, game, onClose }) {
  const hp = kind === 'hp';
  const pack = hp ? 'hppack' : 'soupcan';
  const rows = [];
  if (hud.supplies?.[kind] > 0) rows.push({ id: pack, qty: hud.supplies[kind] });
  for (const [id, qty] of Object.entries(hud.consumables || {})) {
    if (qty > 0 && ITEMS[id] && (hp ? ITEMS[id].heal : ITEMS[id].energy)) rows.push({ id, qty });
  }
  return (
    <>
      <div className="supply-backdrop" onMouseDown={onClose} onTouchStart={onClose} />
      <div className={`supply-menu ${kind}`} role="menu" aria-label={hp ? 'Health items' : 'Stamina items'}>
        <header>
          <b>{hp ? '❤️ Health' : '⚡ Stamina'}</b>
          <button type="button" className="btn small-btn" onClick={onClose} aria-label="Close">✕</button>
        </header>
        {rows.length === 0 && <p className="hint">Nothing to use. Food from the world and from chests, and packs from the shop, show up here.</p>}
        {rows.map(({ id, qty }) => (
          <button type="button" role="menuitem" className="supply-row" key={id} onClick={() => game?.eat(id)}>
            <ItemIcon id={id} scale={2} />
            <span><b>{ITEMS[id].name}</b><small>{effect(ITEMS[id])}</small></span>
            <i>×{qty}</i>
          </button>
        ))}
      </div>
    </>
  );
}
