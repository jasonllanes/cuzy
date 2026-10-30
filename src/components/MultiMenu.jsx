import { useState } from 'react';
import { RETRO_COUNT, heroById, retroId } from '../game/heroes';
import { DIFFICULTY } from '../game/monsters';
import { mapNameOf } from '../game/maps';
import { randomName } from '../game/rng';
import SpritePreview from './SpritePreview';

// Multiplay, straight from the main menu: your name and hero are already saved, so it is only "Show all rooms" or "Create a room".
// (The name and hero can still be changed from the strip at the top.)
export default function MultiMenu({ assets, view, setView, name, setName, hero, setHero, status, online, rooms, problem, error, busy, code, setCode, join, onCreate, onBack, offlineText }) {
  const named = !!name.trim();
  const [editing, setEditing] = useState(!named); // a first visit has no name yet: ask for it
  const me = heroById(hero);

  const profile = (
    <section className="who-strip" aria-label="Who you play as">
      <SpritePreview img={assets.img} hero={me} active />
      <div className="who-text">
        <small>Playing as</small>
        <b>{named ? name.trim() : 'Friend'}</b>
        <small>{me.label}</small>
      </div>
      <button type="button" className="btn small-btn" onClick={() => setEditing((e) => !e)} aria-expanded={editing}>{editing ? 'Done' : '✎ Change'}</button>
    </section>
  );

  const editor = editing && (
    <section className="who-edit">
      <label className="sub-label" htmlFor="multi-name">Your name</label>
      <div className="row">
        <input id="multi-name" value={name} maxLength={14} placeholder="Your name…" autoComplete="off" autoFocus={!named} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && named && setEditing(false)} />
        <button type="button" className="btn dice" title="Surprise me" onClick={() => setName(randomName())}>🎲</button>
      </div>
      <div className="sub-label">Your character</div>
      <div className="heroes retro-grid mini" role="radiogroup" aria-label="Character">
        {Array.from({ length: RETRO_COUNT }, (_, i) => {
          const h = heroById(retroId(i + 1));
          const on = hero === h.id;
          return (
            <button type="button" key={h.id} role="radio" aria-checked={on} className={`hero-card ${on ? 'selected' : ''}`} onClick={() => setHero(h.id)}>
              <SpritePreview img={assets.img} hero={h} active={on} />
              <span className="hero-name">{h.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );

  const notices = (
    <>
      {online && problem && <div className="notice error">{problem}</div>}
      {!online && <div className="notice">{status === 'connecting' ? 'Connecting to the room server…' : offlineText}</div>}
      {error && <div className="notice error">{error}</div>}
    </>
  );

  return (
    <div className="panel menu-card home-card">
      <header className="logo">
        <span className="logo-spark">✿</span>
        <h1>Cuzy</h1>
        <span className="logo-spark">✿</span>
      </header>
      <p className="tagline">{view === 'rooms' ? 'open rooms' : 'play together'}</p>

      {view === 'multi' && (
        <section className="page">
          <h2 className="page-title">👥 Multiplay</h2>
          {profile}
          {editor}
          {notices}
          <nav className="home-menu" aria-label="Multiplay">
            <button type="button" className="home-btn play" disabled={!named || editing} onClick={() => setView('rooms')}>
              <b>🔎 Show all rooms</b>
              <small>{!online ? '🟠 Connecting…' : rooms.length ? `🟢 ${rooms.length} open room${rooms.length > 1 ? 's' : ''} right now` : '🟢 Nobody is hosting yet, or join with a code'}</small>
            </button>
            <button type="button" className="home-btn" disabled={!named || editing} onClick={onCreate}>
              <b>➕ Create a room</b>
              <small>Pick the game and the map, then invite your friends</small>
            </button>
          </nav>
          <div className="nav-row">
            <button type="button" className="btn ghost" onClick={onBack}>← Main menu</button>
            <span />
          </div>
        </section>
      )}

      {view === 'rooms' && (
        <section className="page">
          <h2 className="page-title">🔎 All rooms</h2>
          {profile}
          {editor}
          {notices}
          <div className="room-list">
            {rooms.length === 0 && <div className="room-empty">No rooms yet. Create one, or join a friend with their code below.</div>}
            {rooms.map((r) => (
              <div className="room-row" key={r.code}>
                <div className="room-info">
                  <b>{r.name}{r.pvp && <span className="pvp-badge">⚔️ Fight</span>}{r.mode === 'waves' && <span className="pvp-badge waves">🌊 {DIFFICULTY[r.difficulty]?.name || 'Waves'}</span>}{r.mode === 'survival' && <span className="pvp-badge survival">☠️ {DIFFICULTY[r.difficulty]?.name || 'Survival'}</span>}</b>
                  <span>Host {r.host} · 🗺️ {mapNameOf(r.seed)}{r.mode === 'waves' ? ' · wave defense' : r.mode === 'survival' ? ' · survival' : r.pvp ? ` · first to ${r.target} ${r.winBy === 'monsters' ? 'monster ' : ''}kills` : ' · friendly'}{r.allowLate ? '' : ' · no late join'}</span>
                </div>
                <span className="room-code">{r.code}</span>
                <span className={`room-count ${r.count >= r.max ? 'full' : ''}`}>👥 {r.count}/{r.max}</span>
                <button type="button" className="btn small-btn" disabled={busy || !online || !named || r.count >= r.max || (r.started && !r.allowLate)} onClick={() => join(r.code)}>
                  {r.count >= r.max ? 'Full' : r.started && !r.allowLate ? 'Started' : 'Join'}
                </button>
              </div>
            ))}
          </div>

          <div className="sub-label">Join with a code</div>
          <div className="row">
            <input
              className="code-input"
              value={code}
              maxLength={8}
              placeholder="ABCD"
              autoComplete="off"
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (code.trim() && online && named && !busy) join(code.trim());
                }
              }}
            />
            <button type="button" className="btn go" disabled={busy || !online || !named || !code.trim()} onClick={() => join(code.trim())}>
              Join
            </button>
          </div>
          <div className="nav-row">
            <button type="button" className="btn ghost" onClick={() => setView('multi')}>← Back</button>
            <button type="button" className="btn" disabled={!named} onClick={onCreate}>➕ Create a room</button>
          </div>
        </section>
      )}
    </div>
  );
}
