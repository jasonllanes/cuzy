import { useState } from 'react';
import { ALLIES, ALLY_KINDS, MAX_ALLIES, teamCap } from '../game/allies';
import { GUNS, GUN_ORDER } from '../game/combat';
import { MAX_LEVEL, UPGRADES, upgradeCost } from '../game/upgrades';
import { ITEMS, RARITIES, rarityByCost, rarityOf, sellPrice } from '../game/items';
import { BARRICADE_COST, REPAIR_COST } from '../game/waves';
import { EFFECTS, WEAPONS, swingTime, weaponIconFile, weaponRarity } from '../game/weapons';
import { GRENADE_COSTS } from '../game/engine';
import ItemIcon from './ItemIcon';
import SellPanel from './SellPanel';

// Spend coins from monster drops on permanent upgrades. Helpers are hired here too.
export default function UpgradePanel({ hud, game, onClose, inventory = [], survival = false }) {
  const team = hud.wave?.allies || 0;
  const cap = hud.wave?.teamCap ?? teamCap(hud.wave?.baseLevel || 0);
  const [tab, setTab] = useState('shelter');
  const tabs = survival
    ? [['shelter', '🏚️ Shelter & Stats'], ['defense', '🧱 Barricades & Grenades'], ['melee', '⚔️ Weapons'], ['guns', '🔫 Guns'], ['people', '🧑‍🤝‍🧑 Backup'], ['sell', '💰 Sell']]
    : [['shelter', '📊 Upgrades'], ['defense', '🧱 Barricades & Grenades'], ['people', '🪙 Helpers'], ['sell', '💰 Sell']];
  const levelOf = (id) => (id === 'house' ? hud.wave?.baseLevel || 0 : hud.upg?.[id] || 0);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panel upgrades shop surv">
        <header className="inv-head">
          <h2>🛒 Buy</h2>
          <span className="lvl-chip" title="Character level: kill monsters and players for XP">⭐ Lv {hud.level || 1} <i><b style={{ width: `${Math.min(100, ((hud.xp || 0) / (hud.xpNeed || 40)) * 100)}%` }} /></i> {hud.maxLevel ? 'MAX' : `${hud.xp || 0}/${hud.xpNeed || 40} XP · ${hud.xpLeft ?? '?'} to level up`}</span>
          <span className="coin-chip big">🪙 {hud.coins}</span>
          <button className="btn small-btn" onClick={onClose} aria-label="Close upgrades">✕</button>
        </header>

        <div className="shop-tabs" role="tablist">
          {tabs.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={`shop-tab ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        {tab === 'shelter' && <div className="upg-list">
          {UPGRADES.map((u) => {
            const level = levelOf(u.id);
            const maxed = level >= MAX_LEVEL;
            const cost = maxed ? 0 : upgradeCost(u.id, level);
            const bus = u.id === 'house' && survival;
            return (
              <div className="upg-row" key={u.id}>
                <div className="upg-icon">{bus ? '🏚️' : survival && u.survIcon ? u.survIcon : u.icon}</div>
                <div className="upg-info">
                  <h3>{bus ? 'Upgrade the shelter' : survival && u.survName ? u.survName : u.name}</h3>
                  <p>{bus ? '+30% shelter health per level (arriving already repaired) and room for more backup to defend it. Shared by everyone.' : survival && u.survDesc ? u.survDesc : u.desc}</p>
                  {u.id === 'house' && <p className="upg-now">Team room: <b>{teamCap(level)}</b>{!maxed && <> → <b>{teamCap(level + 1)}</b></>} {survival ? 'backup' : 'helpers'}</p>}
                  <div className="pips" aria-label={`Level ${level} of ${MAX_LEVEL}`}>
                    {Array.from({ length: MAX_LEVEL }, (_, i) => <i key={i} className={i < level ? 'on' : ''} />)}
                  </div>
                </div>
                <button className="btn go small-btn" disabled={maxed || hud.coins < cost} onClick={() => game.buyUpgrade(u.id)}>
                  {maxed ? 'Maxed' : `🪙 ${cost}`}
                </button>
              </div>
            );
          })}
        </div>}

        {tab === 'defense' && <div className="recruit-note">
          <b>🧱 Barricades</b> (a barricade you set down stays put until zombies destroy it)
          <div className="recruit-list">
            <div className="recruit-chip hire rar rar-uncommon">
              <span><b><ItemIcon id="barricade" scale={2} /> Barricade Box</b><small>One more fence section. Left click places it, hold and drag to lay a row, R turns it. Sections that touch join up.</small></span>
              <button className="btn go small-btn" disabled={hud.coins < BARRICADE_COST} onClick={() => game.buyBarricade()}>🪙 {BARRICADE_COST}</button>
            </div>
            {[['truffle', 'Throw it: it sticks to an enemy and explodes after a few seconds (a red circle shows the blast).'],
              ['stungrenade', 'Throw it: after a moment it flashes and stuns every monster nearby for a few seconds (a blue circle shows how far).'],
              ['smokegrenade', 'Throw it: a thick cloud for several seconds. Stand in it and the zombies cannot see you.']].map(([item, blurb]) => (
              <div className={`recruit-chip hire rar rar-${rarityOf(item)}`} key={item}>
                <span><b><ItemIcon id={item} scale={2} /> {ITEMS[item].name}</b><small>{blurb}</small></span>
                <button className="btn go small-btn" disabled={hud.coins < GRENADE_COSTS[item]} onClick={() => game.buyGrenade(item)}>🪙 {GRENADE_COSTS[item]}</button>
              </div>
            ))}
            <div className="recruit-chip hire">
              <span><b>🔧 Repair all barricades</b><small>{hud.wave?.wrecks ? `${hud.wave.wrecks} destroyed: plants them back where they stood (shown as red ghosts). Walls you picked up yourself are left alone.` : 'Nothing destroyed. Walls that break are remembered here.'}</small></span>
              <button className="btn go small-btn" disabled={!hud.wave?.wrecks || hud.coins < hud.wave.wrecks * REPAIR_COST} onClick={() => game.repairAllBarricades()}>
                {hud.wave?.wrecks ? `🪙 ${hud.wave.wrecks * REPAIR_COST}` : 'None'}
              </button>
            </div>
          </div>
        </div>}

        {tab === 'melee' && survival && hud.weapons && (
          <div className="recruit-note">
            <b>⚔️ Weapons</b> (swords have their own tricks; you start with the baseball bat)
            <div className="recruit-list">
              <div className="recruit-chip hire">
                <span><b>⚾ Baseball bat</b><small>Your trusty starter.</small></span>
                <button className="btn go small-btn" disabled={hud.weapons.equipped === 'trusty'} onClick={() => game.buyMelee('bat')}>
                  {hud.weapons.equipped === 'trusty' ? 'Equipped' : 'Equip'}
                </button>
              </div>
              {WEAPONS.filter((w) => w.id !== 'trusty').map((w) => {
                const have = !!hud.weapons.owned?.[w.id];
                const on = hud.weapons.equipped === w.id;
                return (
                  <div key={w.id} className={`recruit-chip hire rar rar-${weaponRarity(w)}`}>
                    <span>
                      <b><i className="wicon small" style={{ backgroundImage: `url(${import.meta.env.BASE_URL}assets/${weaponIconFile(w)}.png)` }} /> {w.name}</b>
                      <small>{EFFECTS[w.effect].name}: {EFFECTS[w.effect].desc} · 💥 {(2 + w.dmg + (hud.upg?.melee || 0)).toFixed(1)} · ⏱ {swingTime(w, 0).toFixed(2)}s</small>
                    </span>
                    <span className="row-btns">
                      <button className="btn go small-btn" disabled={on || (!have && hud.coins < w.cost)} onClick={() => game.buyMelee(w.id)}>
                        {on ? 'Equipped' : have ? 'Equip' : `Buy 🪙 ${w.cost}`}
                      </button>
                      {have && <button className="btn small-btn" onClick={() => game.sell('weapon', w.id)}>Sell 🪙 {sellPrice(w.cost)}</button>}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'guns' && survival && hud.gunsOwned && (
          <div className="recruit-note">
            <b>🔫 Guns</b> (the pistol is free; switch with R or the slot beside the hotbar)
            <div className="recruit-list">
              {GUN_ORDER.map((id) => {
                const g = GUNS[id];
                const have = !!hud.gunsOwned[id];
                const on = hud.gun === id;
                return (
                  <div key={id} className={`recruit-chip hire rar rar-${rarityByCost(g.price)}`}>
                    <span><b><img className="gun-img small" src={`${import.meta.env.BASE_URL}assets/guns/${id}.png`} alt="" /> {g.name}</b><small>{g.blurb}</small></span>
                    <span className="row-btns">
                      <button className="btn go small-btn" disabled={on || (!have && hud.coins < g.price)} onClick={() => game.buyGun(id)}>
                        {on ? 'Equipped' : have ? 'Equip' : `Buy 🪙 ${g.price}`}
                      </button>
                      {have && id !== 'pistol' && <button className="btn small-btn" onClick={() => game.sell('gun', id)}>Sell 🪙 {sellPrice(g.price)}</button>}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'people' && <div className="recruit-note">
          <b>🪙 {survival ? 'Backup' : 'Helpers'}</b> ({team}/{cap}, up to {MAX_ALLIES}). Upgrade the {survival ? 'shelter' : 'base'} to make room for more.
          <div className="recruit-list">
            {ALLY_KINDS.map((k) => (
              <div key={k} className="recruit-chip hire" style={{ borderColor: ALLIES[k].color }}>
                <span><b>{ALLIES[k].gun && <img className="ally-gun" src={`${import.meta.env.BASE_URL}assets/guns/${ALLIES[k].gun}.png`} alt="" />}{ALLIES[k].name}</b><small>{ALLIES[k].blurb}</small></span>
                <button className="btn go small-btn" disabled={team >= cap || hud.coins < ALLIES[k].cost} onClick={() => game.tryRecruit(k)}>
                  {team >= cap ? 'Full' : `🪙 ${ALLIES[k].cost}`}
                </button>
              </div>
            ))}
          </div>
        </div>}

        {tab === 'sell' && <SellPanel hud={hud} game={game} inventory={inventory} />}
      </div>
    </div>
  );
}
