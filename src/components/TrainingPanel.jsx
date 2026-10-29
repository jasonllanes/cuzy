import { useEffect, useRef, useState } from 'react';
import { HAIRS, HAIR_COLORS, HEROES, RETRO_COUNT, RETRO_NAMES, SURVIVOR_COLORS, drawHero, heroById, retroId, sunnyId, survivorId } from '../game/heroes';
import { FREE_MAPS } from '../game/maps';

// Developer training ground: pick any of the game's characters, swap the map, and try things out in Free Roam.
// Nothing here is saved. God mode starts off, so lava and monsters can hurt you: switch it on for a free run.

const DIRS = [['down', 'Front'], ['up', 'Back'], ['left', 'Left'], ['right', 'Right']];
const TABS = [['retro', 'Retro heroes'], ['classic', 'Classic'], ['villager', 'Villagers'], ['survivor', 'Survivors']];

function Portrait({ assets, id, dir = 'down', moving = false, scale = 1 }) {
  const ref = useRef(null);
  const hero = heroById(id);
  const wide = hero.kind === 'sunny'; // the villagers are drawn on a much bigger frame
  const w = wide ? 96 : 40;
  const h = wide ? 64 : 44;
  const s = wide ? scale * 0.5 : scale;
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return undefined;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    let raf = 0;
    const paint = (t) => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.save();
      ctx.scale(s, s);
      drawHero(ctx, assets.img, hero, dir, moving, t / 1000, w / 2, h - 4);
      ctx.restore();
      if (moving) raf = requestAnimationFrame(paint);
    };
    paint(0);
    return () => cancelAnimationFrame(raf);
  }, [assets, hero, dir, moving, s, w, h]);
  return <canvas ref={ref} width={Math.round(w * s)} height={Math.round(h * s)} className="tp-portrait" />;
}

export default function TrainingPanel({ game, assets, initial = 'retro:1', map, onMap, onHero, onExit }) {
  const start = heroById(initial);
  const [hero, setHero] = useState(initial);
  const [tab, setTab] = useState(start.kind === 'retro' ? 'retro' : start.kind === 'sunny' ? 'villager' : start.kind === 'apoc' ? 'survivor' : 'classic');
  const [hair, setHair] = useState('shorthair');
  const [hairColor, setHairColor] = useState(0);
  const [open, setOpen] = useState(false); // the full tools; the slim picker is always there, so the hero stays in view
  const [god, setGod] = useState(false);
  const g = () => game.current;

  const pick = (id) => {
    setHero(id);
    g()?.setHero(id);
    onHero?.(id);
  };
  const cmd = (text) => g()?.command(text);

  const chip = (id, label) => (
    <button key={id} type="button" role="radio" aria-checked={hero === id} className={`tp-hero ${hero === id ? 'on' : ''}`} onClick={() => pick(id)} title={label}>
      <Portrait assets={assets} id={id} scale={1.2} />
      <small>{label}</small>
    </button>
  );

  return (
    <div className={`hud training-panel panel small ${open ? '' : 'folded'}`}>
      <div className="tp-head">
        <b>🛠 Training ground</b>
        <label className="tp-map">
          🗺
          <select value={map} onChange={(e) => onMap?.(e.target.value)} aria-label="Map">
            {FREE_MAPS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>
        <button type="button" className="btn small-btn" onClick={() => { const i = FREE_MAPS.findIndex((m) => m.id === map); onMap?.(FREE_MAPS[(i + 1) % FREE_MAPS.length].id); }} title="Swap to the next map">🔄 Swap map</button>
        <button type="button" className="wave-fold" onClick={() => setOpen((o) => !o)} aria-label={open ? 'Hide the tools' : 'Show the tools'} title={open ? 'Hide the tools' : 'Show the tools'}>{open ? '▴' : '▾'}</button>
      </div>

      <div className="tp-tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`tp-tab ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === 'retro' && <div className="tp-grid" role="radiogroup" aria-label="Retro heroes">{Array.from({ length: RETRO_COUNT }, (_, i) => chip(retroId(i + 1), RETRO_NAMES[i]))}</div>}
      {tab === 'classic' && <div className="tp-grid" role="radiogroup" aria-label="Classic heroes">{HEROES.map((h) => chip(h.id, h.label))}</div>}
      {tab === 'survivor' && <div className="tp-grid" role="radiogroup" aria-label="Survivors">{SURVIVOR_COLORS.map((c, i) => chip(survivorId(i), c.name))}</div>}
      {tab === 'villager' && (
        <>
          <div className="tp-grid" role="radiogroup" aria-label="Villager hairstyles">{HAIRS.map(([k, label]) => (
            <button key={k} type="button" role="radio" aria-checked={hair === k} className={`tp-hero ${hair === k ? 'on' : ''}`} onClick={() => { setHair(k); pick(sunnyId(k, hairColor)); }} title={label}>
              <Portrait assets={assets} id={sunnyId(k, hairColor)} scale={1.2} />
              <small>{label}</small>
            </button>
          ))}</div>
          <div className="tp-swatches" aria-label="Hair colour">{HAIR_COLORS.map((c, i) => (
            <button key={c.name} type="button" className={`tp-swatch ${hairColor === i ? 'on' : ''}`} style={{ background: c.swatch }} title={c.name} aria-label={c.name} onClick={() => { setHairColor(i); pick(sunnyId(hair, i)); }} />
          ))}</div>
        </>
      )}

      {open && (
        <>
          <div className="tp-dirs" aria-label="Walk cycles">
            {DIRS.map(([dir, label]) => (
              <div key={dir} className="tp-dir">
                <Portrait assets={assets} id={hero} dir={dir} moving scale={2} />
                <small>{label}</small>
              </div>
            ))}
          </div>
          <div className="tp-tools">
            <button type="button" className={`btn small-btn ${god ? 'go' : ''}`} onClick={() => { cmd('-god'); setGod((v) => !v); }}>🛡 God mode {god ? 'on' : 'off'}</button>
            <button type="button" className="btn small-btn" onClick={() => cmd('-heal')}>❤ Heal</button>
            <button type="button" className="btn small-btn" onClick={() => cmd('-gold 9999')}>🪙 +9999</button>
            <button type="button" className="btn small-btn" onClick={() => cmd('-level 9')}>⭐ Level 9</button>
            <button type="button" className="btn small-btn" onClick={() => cmd('-time 12')}>☀️ Noon</button>
            <button type="button" className="btn small-btn" onClick={() => cmd('-time 23')}>🌙 Night</button>
            <button type="button" className="btn small-btn" onClick={() => g()?.combat?.spawnPack('bat', 5)}>🦇 5 bats</button>
            <button type="button" className="btn small-btn" onClick={() => g()?.combat?.spawnNightBoss()}>☠ Boss</button>
            <button type="button" className="btn small-btn" onClick={() => { const c = g()?.combat; if (c) { c.wilds.length = 0; c.skeletons.length = 0; } }}>🧹 Clear</button>
            <button type="button" className="btn small-btn" onClick={() => g()?.goHome(false)}>🏠 Home</button>
            <button type="button" className="btn small-btn" onClick={onExit}>✕ Leave</button>
          </div>
          <p className="hint tp-hint">WASD to walk, click to swing, Enter then <b>-help</b> for every cheat command.</p>
        </>
      )}
    </div>
  );
}
