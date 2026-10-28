import { ALLIES, ALLY_KINDS, MAX_ALLIES, teamCap } from '../game/allies';
import { MAX_LEVEL, UPGRADES, upgradeCost } from '../game/upgrades';

// Spend coins from monster drops on permanent upgrades. Helpers are hired here too.
export default function UpgradePanel({ hud, game, onClose, survival = false }) {
  const team = hud.wave?.allies || 0;
  const cap = hud.wave?.teamCap ?? teamCap(hud.wave?.baseLevel || 0);
  const levelOf = (id) => (id === 'house' ? hud.wave?.baseLevel || 0 : hud.upg?.[id] || 0);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panel upgrades">
        <header className="inv-head">
          <h2>⬆ Upgrades</h2>
          <span className="lvl-chip" title="Character level: kill monsters and players for XP">⭐ Lv {hud.level || 1} <i><b style={{ width: `${Math.min(100, ((hud.xp || 0) / (hud.xpNeed || 40)) * 100)}%` }} /></i> {hud.xp || 0}/{hud.xpNeed || 40} XP</span>
          <span className="coin-chip big">🪙 {hud.coins}</span>
          <button className="btn small-btn" onClick={onClose} aria-label="Close upgrades">✕</button>
        </header>

        <div className="upg-list">
          {UPGRADES.map((u) => {
            const level = levelOf(u.id);
            const maxed = level >= MAX_LEVEL;
            const cost = maxed ? 0 : upgradeCost(u.id, level);
            const bus = u.id === 'house' && survival;
            return (
              <div className="upg-row" key={u.id}>
                <div className="upg-icon">{bus ? '🚌' : survival && u.survIcon ? u.survIcon : u.icon}</div>
                <div className="upg-info">
                  <h3>{bus ? 'Upgrade the bus' : survival && u.survName ? u.survName : u.name}</h3>
                  <p>{bus ? '+30% bus health per level (arriving already repaired) and room for more survivors to defend it. Shared by everyone.' : survival && u.survDesc ? u.survDesc : u.desc}</p>
                  {u.id === 'house' && <p className="upg-now">Team room: <b>{teamCap(level)}</b>{!maxed && <> → <b>{teamCap(level + 1)}</b></>} {survival ? 'survivors' : 'helpers'}</p>}
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
        </div>

        <div className="recruit-note">
          <b>🪙 {survival ? 'Survivors' : 'Helpers'}</b> ({team}/{cap}, up to {MAX_ALLIES}). Upgrade the {survival ? 'bus' : 'base'} to make room for more.
          <div className="recruit-list">
            {ALLY_KINDS.map((k) => (
              <div key={k} className="recruit-chip hire" style={{ borderColor: ALLIES[k].color }}>
                <span><b>{ALLIES[k].name}</b><small>{ALLIES[k].blurb}</small></span>
                <button className="btn go small-btn" disabled={team >= cap || hud.coins < ALLIES[k].cost} onClick={() => game.tryRecruit(k)}>
                  {team >= cap ? 'Full' : `🪙 ${ALLIES[k].cost}`}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
