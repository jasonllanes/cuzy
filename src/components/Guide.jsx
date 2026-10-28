import { useState } from 'react';
import { FOUND_BY_FORAGING, ITEMS, WATER_STAMINA, chestOdds, isConsumable } from '../game/items';
import ItemIcon from './ItemIcon';
import { Effects } from './Inventory';

const TABS = [
  ['all', 'All items'],
  ['food', 'Food & drink'],
  ['other', 'Treasures & goods'],
];

const SKELETON_DROPS = ['coin', 'acorn', 'rock', 'gold', 'gem'];

const range =(min, max) => (min === max ? `×${min}` : `×${min}–${max}`);

function Where({ id }) {
  const odds = chestOdds(id);
  return (
    <ul className="guide-where">
      {FOUND_BY_FORAGING[id] && <li>🌿 {FOUND_BY_FORAGING[id]}</li>}
      {SKELETON_DROPS.includes(id) && <li>💀 Dropped by skeletons</li>}
      {(id === 'barricade' || id === 'rock' || id === 'gem' || id === 'gold') && <li>🌊 Wave Defense: dropped by monsters{id === 'barricade' ? ', and you start with 4' : ''}</li>}
      {odds && <li>🎁 Chests · {Math.round(odds.chance * 100)}% per roll · {range(odds.min, odds.max)}</li>}
    </ul>
  );
}

export default function Guide({ onClose }) {
  const [tab, setTab] = useState('all');
  const all = Object.entries(ITEMS);
  // most filling first within each group
  const worth = (def) => (def.heal || 0) + (def.energy || 0) * 2;
  const rows = all
    .filter(([, def]) => tab === 'all' || (tab === 'food') === isConsumable(def))
    .sort((a, b) => Number(isConsumable(b[1])) - Number(isConsumable(a[1])) || worth(b[1]) - worth(a[1]));

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panel guide">
        <header className="inv-head">
          <h2>📖 Field Guide</h2>
          <button className="btn small-btn" onClick={onClose} aria-label="Close guide">✕</button>
        </header>

        <div className="guide-tips">
          <div><b>💧 Free water</b> Face a lake or sea and press <kbd>Space</kbd> for +{Math.round(WATER_STAMINA * 100)}% Stamina.</div>
          <div><b>❤️ HP and ⚡ stamina</b> are what food is for: snacks heal your hearts and drinks refill stamina. Stamina also runs down while you sprint and dash.</div>
          <div><b>⚔️ Combat</b> <kbd>Left click</kbd> swings your sword (2 dmg). <b>Hold</b> left click and release for a dash attack: the bar shows the charge, a fuller charge goes farther and hits harder (2–4 dmg, costs some stamina). <kbd>F</kbd> raises a shield that blocks all damage for 3 seconds (10 second cooldown). <kbd>Right click</kbd> throws the selected item toward your cursor. Anything can be thrown for at least 1 damage, and each item has its own range: light things (acorns, coins, gems) sail about 9 tiles, heavy ones (rocks, gold, jars) only 5 to 6. Skeletons have 3 health and drop loot. Food and glass splat, other items can be picked back up.</div>
          <div><b>🌊 Wave Defense</b> Survive 10 waves around the house. <kbd>Q</kbd> sets a barricade box down at your cursor and <kbd>Space</kbd> picks one back up. <kbd>H</kbd> recalls you to the base (stand still 2.5s). Monsters drop <b>♥ hearts</b> that heal you and throwable items. Right click throws without limit, but each throw drains the throw meter.</div>
          <div><b>🪙 Coins and helpers</b> Monsters drop coins. Press <kbd>U</kbd> to spend them on upgrades: base health, endurance, melee damage, throw damage and a bigger lantern. Hire a <b>Thrower, Guard or Sharpshooter</b> from the same upgrades window to help defend; upgrading the base makes room for more. Your swings and throws reach over your own walls, so fight from the inside.</div>
          <div><b>☠️ Survival</b> The same 10-wave defense, in the zombie apocalypse: hold the wrecked bus with <b>wooden walls</b> (<kbd>Q</kbd> to place, <kbd>Space</kbd> to pick up), swing a baseball bat, and scavenge <b>bandages, canned food and first aid kits</b> from fridges and the ground. Everyone plays the Survivor.</div>
          <div><b>🍽 Eat / drink</b> Select an item with <kbd>1</kbd>–<kbd>9</kbd> or the mouse wheel, then press <kbd>E</kbd>. Hold <kbd>Alt</kbd> and scroll to zoom.</div>
        </div>

        <div className="guide-tabs" role="tablist">
          {TABS.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={`guide-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>

        <div className="guide-list">
          {rows.map(([id, def]) => (
            <div className="guide-row" key={id}>
              <div className="guide-icon"><ItemIcon id={id} scale={4} /></div>
              <div className="guide-info">
                <h3>{def.name}</h3>
                <p>{def.desc}</p>
                <Effects def={def} />
              </div>
              <Where id={id} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
