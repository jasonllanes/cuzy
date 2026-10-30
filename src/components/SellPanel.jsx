import { GUNS, GUN_ORDER } from '../game/combat';
import { ITEMS, rarityOf, sellPrice, sellValue } from '../game/items';
import { SUPPLY_SHOP } from '../game/upgrades';
import { WEAPONS, weaponIconFile, weaponRarity } from '../game/weapons';
import ItemIcon from './ItemIcon';

// Sell things back to the shop: swords and guns you own, what is in your backpack, and spare supplies.
export default function SellPanel({ hud, game, inventory = [] }) {
  const swords = WEAPONS.filter((w) => w.id !== 'trusty' && hud.weapons?.owned?.[w.id]);
  const wood = hud.wood || 0;
  const guns = hud.gunsOwned ? GUN_ORDER.filter((id) => id !== 'pistol' && hud.gunsOwned[id]) : [];
  const bag = inventory.map((slot, i) => ({ slot, i })).filter(({ slot }) => slot && sellValue(slot.id) > 0);
  const food = Object.entries(hud.consumables || {}).filter(([id, q]) => q > 0 && sellValue(id) > 0);
  const supplies = SUPPLY_SHOP.filter((s) => (hud.supplies?.[s.id] || 0) > 0);
  const nothing = !swords.length && !wood && !guns.length && !bag.length && !food.length && !supplies.length;

  return (
    <div className="recruit-note sell-note">
      <b>💰 Sell</b> (the shop pays half for swords, guns and supplies; the pistol and your starter weapon are not for sale)
      {nothing && <p className="sell-empty">Nothing to sell right now. Swords, guns and the things in your backpack show up here.</p>}
      <div className="recruit-list">
        {swords.map((w) => (
          <div key={w.id} className={`recruit-chip hire rar rar-${weaponRarity(w)}`}>
            <span>
              <b><i className="wicon small" style={{ backgroundImage: `url(${import.meta.env.BASE_URL}assets/${weaponIconFile(w)}.png)` }} /> {w.name}</b>
              <small>{hud.weapons.equipped === w.id ? 'Equipped: you go back to your starter weapon.' : w.blurb}</small>
            </span>
            <button className="btn go small-btn" onClick={() => game.sell('weapon', w.id)}>Sell 🪙 {sellPrice(w.cost)}</button>
          </div>
        ))}
        {wood > 0 && (
          <div className="recruit-chip hire rar rar-common">
            <span>
              <b><ItemIcon id="wood" scale={2} /> Wood ×{wood}</b>
              <small>🪙 1 each</small>
            </span>
            <span className="row-btns">
              <button className="btn go small-btn" onClick={() => game.sell('wood')}>Sell 1</button>
              {wood > 1 && <button className="btn small-btn" onClick={() => game.sell('wood', null, true)}>All 🪙 {wood}</button>}
            </span>
          </div>
        )}
        {guns.map((id) => (
          <div key={id} className="recruit-chip hire">
            <span>
              <b><img className="gun-img small" src={`${import.meta.env.BASE_URL}assets/guns/${id}.png`} alt="" /> {GUNS[id].name}</b>
              <small>{hud.gun === id ? 'Equipped: you go back to the pistol.' : GUNS[id].blurb}</small>
            </span>
            <button className="btn go small-btn" onClick={() => game.sell('gun', id)}>Sell 🪙 {sellPrice(GUNS[id].price)}</button>
          </div>
        ))}
        {bag.map(({ slot, i }) => {
          const each = sellValue(slot.id);
          return (
            <div key={i} className="recruit-chip hire">
              <span>
                <b><ItemIcon id={slot.id} scale={2} /> {ITEMS[slot.id].name} ×{slot.qty}</b>
                <small>🪙 {each} each</small>
              </span>
              <span className="row-btns">
                <button className="btn go small-btn" onClick={() => game.sell('item', i)}>Sell 1</button>
                {slot.qty > 1 && <button className="btn small-btn" onClick={() => game.sell('item', i, true)}>All 🪙 {each * slot.qty}</button>}
              </span>
            </div>
          );
        })}
        {food.map(([id, qty]) => (
          <div key={id} className="recruit-chip hire">
            <span>
              <b><ItemIcon id={id} scale={2} /> {ITEMS[id].name} ×{qty}</b>
              <small>🪙 {sellValue(id)} each</small>
            </span>
            <span className="row-btns">
              <button className="btn go small-btn" onClick={() => game.sell('consumable', id)}>Sell 1</button>
              {qty > 1 && <button className="btn small-btn" onClick={() => game.sell('consumable', id, true)}>All 🪙 {sellValue(id) * qty}</button>}
            </span>
          </div>
        ))}
        {supplies.map((s) => {
          const n = hud.supplies[s.id];
          return (
            <div key={s.id} className="recruit-chip hire">
              <span>
                <b><ItemIcon id={s.item} scale={2} /> {s.name} ×{n}</b>
                <small>🪙 {sellPrice(s.cost)} each</small>
              </span>
              <span className="row-btns">
                <button className="btn go small-btn" onClick={() => game.sell('supply', s.id)}>Sell 1</button>
                {n > 1 && <button className="btn small-btn" onClick={() => game.sell('supply', s.id, true)}>All 🪙 {sellPrice(s.cost) * n}</button>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
