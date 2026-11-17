import { Suspense, lazy, useMemo, useState } from 'react';
import { FREE_MAPS, SURVIVAL_BASE, SURVIVAL_MAPS, joinSeed, mapIdOf } from '../game/maps';

const MapPreview = lazy(() => import('./MapPreview'));

const newRoll = () => Math.random().toString(36).slice(2, 6);

// Choosing a map from inside a room: the same pick-a-map page as the setup walk, on its own screen, with a full-screen preview.
// onPick({ map, roll }) gives the map id and the layout roll; onClose goes back to the room settings.
export default function MapPickerModal({ assets, net, room, name, hero, onPick, onClose }) {
  const survival = room.mode === 'survival';
  const maps = survival ? SURVIVAL_MAPS : FREE_MAPS;
  const current = mapIdOf(room.seed, room.mode);
  const [pick, setPick] = useState(maps.some((m) => m.id === current) ? current : maps[0].id);
  const [dice, setDice] = useState(Math.random());
  const [roll, setRoll] = useState(newRoll);
  const [pv, setPv] = useState(false);
  const real = pick === 'random' ? maps[Math.floor(dice * maps.length)].id : pick;
  const info = maps.find((m) => m.id === real);
  const seed = useMemo(() => (survival ? joinSeed(`${SURVIVAL_BASE}@${roll}`, real) : `${maps.find((m) => m.id === real)?.seed}@${roll}`), [survival, real, roll, maps]);

  return (
    <div className="overlay map-picker" role="dialog" aria-label="Choose a map" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panel menu-card wide mp-card">
        <header className="mp-head">
          <h2>🗺 Choose a map</h2>
          <button type="button" className="btn small-btn" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="play-cols">
          <div className="play-side">
            <p className="hint">Now: <b>{maps.find((m) => m.id === current)?.name || 'a custom world'}</b>. Pick another one, look at it, and use it: everyone in the room gets the new world.</p>
            <div className="layout-box">
              <div className="layout-row">
                <button type="button" className="btn" onClick={() => setRoll(newRoll())}>🎲 Generate a new layout</button>
                <span className="layout-tag">New layout #{roll}</span>
              </div>
            </div>
            <div className="preview-row">
              <button type="button" className="btn" onClick={() => setPv(true)}>👁 Preview the map</button>
              <small>See the whole map full screen and walk around it first.</small>
            </div>
            <div className="nav-row">
              <button type="button" className="btn ghost" onClick={onClose}>← Back to the room</button>
              <button type="button" className="btn go" onClick={() => onPick({ map: real, roll })}>Use {info?.name || 'this map'} ✓</button>
            </div>
          </div>
          <div className="play-maps">
            <span className="sub-label">Choose a map</span>
            <div className="map-grid" role="radiogroup" aria-label="Map">
              {maps.map((m) => (
                <button key={m.id} type="button" role="radio" aria-checked={pick === m.id} className={`diff-chip map-card ${m.id === 'mixed' ? 'open-world' : ''} ${pick === m.id ? 'on' : ''}`} onClick={() => setPick(m.id)}>
                  <b>{m.icon} {m.name}</b>
                  <small>{m.blurb}</small>
                </button>
              ))}
              <button type="button" role="radio" aria-checked={pick === 'random'} className={`diff-chip map-card ${pick === 'random' ? 'on' : ''}`} onClick={() => { setDice(Math.random()); setPick('random'); }}>
                <b>🎲 Random map</b>
                <small>{pick === 'random' ? `Picked: ${info?.name}. Press again for another.` : 'Picks one of the maps at random. Press it to roll.'}</small>
              </button>
            </div>
          </div>
        </div>
      </div>
      {pv && (
        <Suspense fallback={null}>
          <MapPreview
            assets={assets}
            net={net}
            seed={seed}
            mode={survival ? 'survival' : 'free'}
            name={name}
            hero={hero}
            label={info?.name}
            onRegenerate={() => {
              if (pick === 'random') setDice(Math.random());
              setRoll(newRoll());
            }}
            onUse={() => setPv(false)}
            onClose={() => setPv(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
