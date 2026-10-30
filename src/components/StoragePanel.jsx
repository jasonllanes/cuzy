import { FREE_UPGRADES, MAX_LEVEL } from '../game/upgrades';
import { ITEMS, rarityOf } from '../game/items';
import ItemIcon from './ItemIcon';

// Your backpack next to the chest at home.
//   click a stack: move all of it across      right-click: move just one
//   drag onto the other side: choose how many  drag onto the same side: rearrange
//   let go anywhere else: drop it on the floor (and choose how many)
export function StorageBody({ inventory, box, game, onAsk }) {
  const act = (kind, side, i, max) => (max > 1 ? onAsk({ kind, side, i, max, id: (side === 'inv' ? inventory : box)[i].id }) : kind === 'drop' ? game.dropItem(side, i, 1) : game.storeMove(side, i, true));
  const grid = (slots, side) => (
    <div className="inv-grid store-grid">
      {slots.map((s, i) => (
        <button
          key={i}
          className={`inv-slot ${s ? `filled rar rar-${rarityOf(s.id)}` : ''}`}
          draggable={!!s}
          onClick={() => game.storeMove(side, i, true)}
          onContextMenu={(e) => {
            e.preventDefault();
            game.storeMove(side, i, false);
          }}
          onDragStart={(e) => {
            e.dataTransfer.setData('text/plain', JSON.stringify({ side, i }));
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(e) => {
            e.preventDefault();
            let from;
            try {
              from = JSON.parse(e.dataTransfer.getData('text/plain'));
            } catch {
              return;
            }
            const src = (from.side === 'inv' ? inventory : box)[from.i];
            if (!src) return;
            if (from.side === side) {
              if (from.i !== i) game.shuffle(side, from.i, i);
            } else {
              act('move', from.side, from.i, src.qty);
            }
          }}
          onDragEnd={(e) => {
            if (e.dataTransfer.dropEffect === 'none' && (e.clientX || e.clientY) && s) act('drop', side, i, s.qty);
          }}
          title={s ? `${ITEMS[s.id].name}: click moves the stack, right-click moves one, drag to choose how many` : 'Empty'}
        >
          {s && <ItemIcon id={s.id} />}
          {s && s.qty > 1 && <span className="qty">{s.qty}</span>}
        </button>
      ))}
    </div>
  );
  return (
    <div className="store-cols">
      <section>
        <h3 className="shop-h">🎒 Backpack <small>{inventory.filter(Boolean).length}/{inventory.length}</small></h3>
        {grid(inventory, 'inv')}
      </section>
      <section>
        <h3 className="shop-h">📦 Chest <small>{box.filter(Boolean).length}/{box.length}</small></h3>
        {grid(box, 'box')}
      </section>
    </div>
  );
}

export default function StoragePanel({ inventory, box, game, hud, onAsk, onClose }) {
  const chest = FREE_UPGRADES.find((u) => u.id === 'chest');
  const level = hud?.upg?.chest || 0;
  const maxed = level >= MAX_LEVEL;
  const cost = maxed ? 0 : chest.cost[level];
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panel storage">
        <header className="inv-head">
          <h2>📦 Storage chest</h2>
          <button className="btn small-btn" onClick={onClose} aria-label="Close chest">✕</button>
        </header>
        <p className="hint">Keep things safe at home. <b>Click</b> moves a stack, <b>right-click</b> moves one, <b>drag</b> to choose how many, and drag it <b>off the slots</b> to drop it on the floor. </p>
        {hud && (
          <div className="chest-upgrade">
            <span>{chest.icon} <b>{chest.name}</b> <small>Lv {level}/{MAX_LEVEL}</small> · now <b>{chest.value(level)}</b>{!maxed && <> → <b>{chest.value(level + 1)}</b></>}</span>
            <button className="btn go small-btn" disabled={maxed || hud.coins < cost} onClick={() => game.buyShop('upgrade', 'chest')}>{maxed ? 'Maxed' : `⬆ Upgrade 🪙 ${cost}`}</button>
          </div>
        )}
        <StorageBody inventory={inventory} box={box} game={game} onAsk={onAsk} />
      </div>
    </div>
  );
}
