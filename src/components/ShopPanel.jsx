import { useState } from 'react';
import { FREE_UPGRADES, MAX_LEVEL, SKILL_SHOP, SUPPLY_SHOP, THROW_SHOP } from '../game/upgrades';
import { EFFECTS, WEAPONS, swingTime, weaponIconFile } from '../game/weapons';
import { ITEMS, throwDamage, throwRange, throwWeight } from '../game/items';
import ItemIcon from './ItemIcon';

// Free Roam shop: spend coins from chests and skeletons.
export default function ShopPanel({ hud, game, onClose }) {
  const [tab, setTab] = useState('goods');
  const coins = hud.coins;
  const owned = (id) => hud.supplies?.[id] || 0;
  const skills = hud.skills || {};

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
          <span className="lvl-chip" title="Character level: kill monsters and players for XP">⭐ Lv {hud.level || 1} <i><b style={{ width: `${Math.min(100, ((hud.xp || 0) / (hud.xpNeed || 40)) * 100)}%` }} /></i> {hud.xp || 0}/{hud.xpNeed || 40} XP</span>
          <span className="coin-chip big">🪙 {coins}</span>
          <button className="btn small-btn" onClick={onClose} aria-label="Close shop">✕</button>
        </header>
        <p className="hint">Coins turn up in chests and when you defeat skeletons.</p>
        <div className="shop-tabs" role="tablist">
          {[['goods', '🛒 Goods'], ['swords', '⚔️ Swords']].map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={`shop-tab ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        {tab === 'swords' && (
          <div className="sword-shop">
            <div className="upg-list">{upgradeRow(FREE_UPGRADES.find((u) => u.id === 'atkspd'))}</div>
            <div className="sword-grid">
              {WEAPONS.map((w) => {
                const have = !!hud.weapons?.owned?.[w.id];
                const on = hud.weapons?.equipped === w.id;
                const atk = hud.upg?.atkspd || 0;
                return (
                  <div className={`sword-card ${on ? 'is-equipped' : ''}`} key={w.id}>
                    <span className="wicon" style={{ backgroundImage: `url(${import.meta.env.BASE_URL}assets/${weaponIconFile(w)}.png)` }} />
                    <div className="sword-info">
                      <h3>{w.name} {on && <small>equipped</small>}</h3>
                      <p className="sword-blurb">{w.blurb}</p>
                      <p className="sword-fx"><i className="fx-dot" style={{ background: w.tint }} /> <b>{EFFECTS[w.effect].name}</b>: {EFFECTS[w.effect].desc}</p>
                      <p className="sword-stats">
                        <span className="dmg-tag">💥 {(2 + w.dmg + 0.4 * (hud.upg?.melee || 0)).toFixed(1)} dmg</span>
                        <span className="dmg-tag range">⏱ {swingTime(w, atk).toFixed(2)}s swing</span>
                        <span className="dmg-tag range">📏 {(w.reach / 16).toFixed(1)} tiles</span>
                      </p>
                    </div>
                    {have ? (
                      <button className="btn go small-btn" disabled={on} onClick={() => game.buyShop('wequip', w.id)}>{on ? 'Equipped' : 'Equip'}</button>
                    ) : (
                      <button className="btn go small-btn" disabled={coins < w.cost} onClick={() => game.buyShop('weapon', w.id)}>🪙 {w.cost}</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'goods' && <div className="shop-cols">
          <section className="shop-col">
            <h3 className="shop-h">⬆ Upgrades</h3>
            <div className="upg-list">
              {FREE_UPGRADES.filter((u) => !u.needs && u.id !== 'atkspd').map((u) => upgradeRow(u))}
            </div>
          </section>

          <section className="shop-col">
            <h3 className="shop-h">✨ Skills <small>(equip 1 sword skill and 1 utility skill)</small></h3>
            <div className="upg-list">
              {SKILL_SHOP.map((s) => {
                const have = !!skills[s.id];
                const equipped = s.sword ? hud.activeSkill === s.id : hud.util === s.id;
                const upgrades = s.sword ? FREE_UPGRADES.filter((u) => u.needs === s.id) : [];
                return (
                  <div className={`skill-card ${equipped ? 'is-equipped' : ''}`} key={s.id}>
                    <div className="skill-head">
                      <div className="upg-icon">{s.icon}</div>
                      <div className="upg-info">
                        <h3>{s.name} {have && <small>{equipped ? 'equipped' : 'owned'}</small>}</h3>
                        <p>{s.desc}</p>
                      </div>
                      {have ? (
                        <button className="btn go small-btn" disabled={equipped} onClick={() => game.buyShop('equip', s.id)}>
                          {equipped ? 'Equipped' : 'Equip'}
                        </button>
                      ) : (
                        <button className="btn go small-btn" disabled={coins < s.cost} onClick={() => game.buyShop('skill', s.id)}>
                          🪙 {s.cost}
                        </button>
                      )}
                    </div>
                    {/* once bought, a sword skill's own upgrades appear right here */}
                    {have && upgrades.map((u) => upgradeRow(u, true))}
                    {!have && s.sword && <p className="need-skill">Its upgrades unlock once you buy it.</p>}
                  </div>
                );
              })}
            </div>

            <h3 className="shop-h">🎒 Supplies</h3>
            <div className="upg-list">
              {SUPPLY_SHOP.map((s) => {
                const full = owned(s.id) >= s.cap;
                return (
                  <div className="upg-row" key={s.id}>
                    <div className="upg-icon">{s.item ? <ItemIcon id={s.item} scale={2} /> : s.icon}</div>
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
            </div>
          </section>

          <section className="shop-col">
            <h3 className="shop-h">🎯 Throwables <small>(right-click to throw)</small></h3>
            <div className="upg-list">
              {THROW_SHOP.map((t) => {
                const def = ITEMS[t.item];
                return (
                  <div className="upg-row" key={t.item}>
                    <div className="upg-icon"><ItemIcon id={t.item} scale={3} /></div>
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
