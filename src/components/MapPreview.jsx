import { useEffect, useMemo, useState } from 'react';
import GameView from './GameView';

// A whole-screen look at the map you picked. You can walk all over it (nothing is saved, nothing can hurt you), generate
// another one, and when you like what you see, use it. Every new map loads for a moment before it is shown.
export default function MapPreview({ assets, net, seed, mode, name, hero, label, onRegenerate, onUse, onClose }) {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 1300);
    return () => clearTimeout(t);
  }, [seed]);
  const profile = useMemo(() => ({ name: name || 'Friend', hero, cozyHero: hero, seed, mode, difficulty: 'medium', bots: 0, winBy: 'duel' }), [name, hero, seed, mode]);

  return (
    <div className="map-preview" role="dialog" aria-label="Map preview">
      <GameView key={seed} assets={assets} profile={profile} net={net} session={null} training preview onExit={onClose} onRoundWon={onClose} />
      <div className="mp-bar panel">
        <b>👁 Previewing {label}</b>
        <button type="button" className="btn small-btn" onClick={onRegenerate} disabled={loading}>🎲 Generate another</button>
        <button type="button" className="btn go small-btn" onClick={onUse} disabled={loading}>✓ Use this map</button>
        <button type="button" className="btn small-btn" onClick={onClose}>✕ Close</button>
      </div>
      {loading && (
        <div className="mp-loading">
          <div className="mp-spinner" aria-hidden="true" />
          <b>Generating the map…</b>
        </div>
      )}
    </div>
  );
}
