import { useState } from 'react';
import { FREE_UPGRADES, MAX_LEVEL, SKILL_SHOP, SUPPLY_SHOP, THROW_SHOP, WOOD_SHOP } from '../game/upgrades';
import { EFFECTS, WEAPONS, swingTime, weaponIconFile, weaponRarity } from '../game/weapons';
import { ITEMS, RARITIES, rarityOf, sellPrice, throwDamage, throwRange, throwWeight } from '../game/items';
import ItemIcon from './ItemIcon';
import SellPanel from './SellPanel';

// Free Roam shop: spend coins from chests and skeletons.
export default function ShopPanel({ hud, game, onClose, inventory = [] }) {
  const [tab, setTab] = useState('stats');
  const coins = hud.coins;
  const owned = (id) => hud.supplies?.[id] || 0;
  const skills = hud.skills || {};
  const wood = hud.wood || 0;

  // one levelled upgrade, as a row with pips and a buy button
  const upgradeRow = (u, compact = false) => {
    const level = hud.upg?.[u.id] || 0;
    const maxed = level >= MAX_LEVEL;
    const cost = maxed ? 0 : u.cost[level];
    return (
      <div className={compact ? 'skill-upg' : 'upg-row'} key={u.id}>
        {!compact && <div className="upg-icon">{u.icon}</div>}
        <div className="upg-info">
          <h3>{compact && `${u.icon} `}{u.name} <small>Lv {level}/{MAX_LEVEL}</small></h3>
          {!compact && <p>{u.desc}</p>}
          <p className="upg-now">Now: <b>{u.value(level)}</b>{!maxed && <> → <b>{u.value(level + 1)}</b></>}</p>
          <div className="pips" aria-label={`Level ${level} of ${MAX_LEVEL}`}>
            {Array.from({ length: MAX_LEVEL }, (_, i) => <i key={i} className={i < level ? 'on' : ''} />)}
          </div>
        </div>
        <button className="btn go small-btn" disabled={maxed || coins < cost} onClick={() => game.buyShop('upgrade', u.id)}>
          {maxed ? 'Maxed' : `🪙 ${cost}`}
        </button>
      </div>
    );
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panel upgrades shop">
        <header className="inv-head">
          <h2>🛒 Buy</h2>
          <span className="lvl-chip" title="Character level: kill monsters and players for XP">⭐ Lv {hud.level || 1} <i><b style={{ width: `${Math.min(100, ((hud.xp || 0) / (hud.xpNeed || 40)) * 100)}%` }} /></i> {hud.maxLevel ? 'MAX' : `${hud.xp || 0}/${hud.xpNeed || 40} XP · ${hud.xpLeft ?? '?'} to level up`}</span>
          <span className="head-chips">
            <span className="coin-chip big">🪙 {coins}</span>
            <span className="coin-chip big" title="Chop trees to get wood. Weapons are crafted from it.">🪵 {wood}</span>
          </span>
          <button className="btn small-btn" onClick={onClose} aria-label="Close shop">✕</button>
        </header>
        <p className="hint">Coins turn up in chests and when you defeat skeletons.</p>
        <div className="shop-tabs" role="tablist">
          {[['stats', '📊 Stats'], ['skills', '✨ Skill Upgrade'], ['supplies', '🎒 Supplies & Throwables'], ['swords', '⚔️ Weapons'], ['sell', '💰 Sell']].map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={`shop-tab ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        {tab === 'swords' && (
          <div className="sword-shop">
            <div className="sword-grid">
              {WEAPONS.map((w) => {
                const have = !!hud.weapons?.owned?.[w.id];
                const on = hud.weapons?.equipped === w.id;
                const atk = hud.upg?.atkspd || 0;
                return (
                  <div className={`sword-card rar-${weaponRarity(w)} ${on ? 'is-equipped' : ''}`} key={w.id}>
                    <span className="wicon" style={{ backgroundImage: `url(${import.meta.env.BASE_URL}assets/${weaponIconFile(w)}.png)` }} />
                    <div className="sword-info">
                      <h3>{w.name} {on && <small>equipped</small>} <i className="rar-tag">{RARITIES[weaponRarity(w)].name}</i></h3>
                      <p className="sword-blurb">{w.blurb}</p>
                      <p className="sword-fx"><i className="fx-dot" style={{ background: w.tint }} /> <b>{EFFECTS[w.effect].name}</b>: {EFFECTS[w.effect].desc}</p>
                      <p className="sword-stats">
                        <span className="dmg-tag">💥 {(2 + w.dmg + 0.4 * (hud.upg?.melee || 0)).toFixed(1)} dmg</span>
                        <span className="dmg-tag range">⏱ {swingTime(w, atk).toFixed(2)}s swing</span>
                        <span className="dmg-tag range">📏 {(w.reach / 16).toFixed(1)} tiles</span>
                        {w.wood > 0 && <span className="dmg-tag range">🪵 {w.wood} wood to craft</span>}
                      </p>
                    </div>
                    <span className="row-btns">
                      {have ? (
                        <>
                          <button className="btn go small-btn" disabled={on} onClick={() => game.buyShop('wequip', w.id)}>{on ? 'Equipped' : 'Equip'}</button>
                          {w.id !== 'trusty' && <button className="btn small-btn" onClick={() => game.sell('weapon', w.id)}>Sell 🪙 {sellPrice(w.cost)}</button>}
                        </>
                      ) : (
                        <button className="btn go small-btn" disabled={coins < w.cost || wood < w.wood} onClick={() => game.buyShop('weapon', w.id)}>Buy 🪙 {w.cost} + 🪵 {w.wood}</button>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'sell' && <SellPanel hud={hud} game={game} inventory={inventory} />}

        {tab === 'stats' && (
          <div>
            <p className="hint">Permanent boosts for your hero. Each one goes up to level {MAX_LEVEL}.</p>
            <div className="upg-list stat-grid">
              {FREE_UPGRADES.filter((u) => !u.needs && !u.home).map((u) => upgradeRow(u))}
            </div>
          </div>
        )}

        {tab === 'skills' && (
          <div>
            <p className="hint">Skills unlock with your level (Dash 6, Spiral 8, Shield 10, Invisibility 15). Equip one sword skill (Space) and one utility skill (R), and upgrade them here.</p>
            <div className="upg-list skill-grid">
              {SKILL_SHOP.map((s) => {
                const have = !!skills[s.id];
                const equipped = s.sword ? hud.activeSkill === s.id : hud.util === s.id;
                const upgrades = s.sword ? FREE_UPGRADES.filter((u) => u.needs === s.id) : [];
                return (
                  <div className={`skill-card ${equipped ? 'is-equipped' : ''} ${have ? '' : 'is-locked'}`} key={s.id}>
                    <div className="skill-head">
                      <div className="upg-icon">{have ? s.icon : '🔒'}</div>
                      <div className="upg-info">
                        <h3>{s.name} {have ? <small>{equipped ? 'equipped' : 'unlocked'}</small> : <small>level {s.level}</small>}</h3>
                        <p>{s.desc}</p>
                      </div>
                      <span className="row-btns">
                        {have ? (
                          <button className="btn go small-btn" disabled={equipped} onClick={() => game.buyShop('equip', s.id)}>
                            {equipped ? 'Equipped' : 'Equip'}
                          </button>
                        ) : (
                          <button className="btn small-btn" disabled>🔒 Level {s.level}</button>
                        )}
                      </span>
                    </div>
                    {/* once unlocked, a sword skill's own upgrades appear right here */}
                    {have && upgrades.map((u) => upgradeRow(u, true))}
                    {!have && s.sword && <p className="need-skill">You are level {hud.level || 1}. Its upgrades appear here once it unlocks.</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'supplies' && <div className="shop-cols two">
          <section className="shop-col">
            <h3 className="shop-h">🎒 Supplies</h3>
            <div className="upg-list">
              {SUPPLY_SHOP.map((s) => {
                const full = owned(s.id) >= s.cap;
                return (
                  <div className="upg-row" key={s.id}>
                    <div className={`upg-icon rar rar-${s.item ? rarityOf(s.item) : 'common'}`}>{s.item ? <ItemIcon id={s.item} scale={2} /> : s.icon}</div>
                    <div className="upg-info">
                      <h3>{s.name} <small>carrying {owned(s.id)}/{s.cap}</small></h3>
                      <p>{s.desc}</p>
                    </div>
                    <button className="btn go small-btn" disabled={full || coins < s.cost} onClick={() => game.buyShop('supply', s.id)}>
                      {full ? 'Full' : `🪙 ${s.cost}`}
                    </button>
                  </div>
                );
              })}
              {WOOD_SHOP.map((w) => (
                <div className="upg-row" key={`wood${w.qty}`}>
                  <div className="upg-icon rar rar-common"><ItemIcon id="wood" scale={2} /></div>
                  <div className="upg-info">
                    <h3>Wood ×{w.qty} <small>you have {wood}</small></h3>
                    <p>For crafting weapons. Chopping trees is free.</p>
                  </div>
                  <button className="btn go small-btn" disabled={coins < w.cost} onClick={() => game.buyShop('wood', w.qty)}>🪙 {w.cost}</button>
                </div>
              ))}
            </div>
          </section>

          <section className="shop-col">
            <h3 className="shop-h">🎯 Throwables <small>(right-click to throw)</small></h3>
            <div className="upg-list">
              {THROW_SHOP.map((t) => {
                const def = ITEMS[t.item];
                return (
                  <div className="upg-row" key={t.item}>
                    <div className={`upg-icon rar rar-${rarityOf(t.item)}`}><ItemIcon id={t.item} scale={3} /></div>
                    <div className="upg-info">
                      <h3>{def.name} ×{t.qty} <span className="dmg-tag">💥 {throwDamage(def)} damage each</span> <span className="dmg-tag range">📏 {throwWeight(t.item)} · {(throwRange(t.item) / 16).toFixed(1)} tiles</span></h3>
                      <p>{def.desc}</p>
                    </div>
                    <button className="btn go small-btn" disabled={coins < t.cost} onClick={() => game.buyShop('throw', t.item)}>
                      🪙 {t.cost}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>}
      </div>
    </div>
  );
}
