import { useMemo, useState } from 'react';
import { RETRO_COUNT, heroById, retroId } from '../game/heroes';
import { DIFFICULTY } from '../game/monsters';
import { mapNameOf } from '../game/maps';
import { randomName } from '../game/rng';
import SpritePreview from './SpritePreview';
import V2Sprite from './V2Sprite';

const PAGE = 5;
const KINDS = [['all', 'All games'], ['free', '🌻 Free Roam'], ['survival', '🧟 Survival'], ['waves', '🌊 Waves'], ['beach', '🏖️ Beach Ball'], ['rumble', '🌴 Beach Rumble'], ['escape', '🚁 Escape'], ['duel', '🏛️ Duel']];
const SORTS = [['recent', 'Recent'], ['players', 'Most players'], ['name', 'Name']];

// which game a room is playing, from its settings
const kindOf = (r) => (/~arena$/.test(r.seed) ? 'duel' : /~rumble$/.test(r.seed) ? 'rumble' : /~pitch$/.test(r.seed) ? 'beach' : /~esc$/.test(r.seed) ? 'escape' : r.mode === 'survival' ? 'survival' : r.mode === 'waves' ? 'waves' : 'free');

// The rooms, as a list you can search (room code, name or host), filter by game, sort (newest first by default) and page through.
// `vacantOnly` hides the rooms nobody can join right now (full, or already started with late joining off).
function RoomBrowser({ rooms, vacantOnly, join, busy, online, named, compact = false }) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(0);
  const open = (r) => r.count < r.max && !(r.started && !r.allowLate);
  const q = query.trim().toLowerCase();
  const list = useMemo(() => {
    let l = rooms.map((r, i) => ({ r, i })).filter(({ r }) => (!vacantOnly || open(r)) && (kind === 'all' || kindOf(r) === kind) && (!q || r.code.toLowerCase().includes(q) || String(r.name).toLowerCase().includes(q) || String(r.host).toLowerCase().includes(q)));
    if (sort === 'recent') l = l.sort((a, b) => (b.r.t0 || 0) - (a.r.t0 || 0) || a.i - b.i);
    else if (sort === 'players') l = l.sort((a, b) => b.r.count - a.r.count || a.i - b.i);
    else l = l.sort((a, b) => String(a.r.name).localeCompare(String(b.r.name)));
    return l.map((x) => x.r);
  }, [rooms, vacantOnly, kind, q, sort]); // eslint-disable-line react-hooks/exhaustive-deps
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const at = Math.min(page, pages - 1);
  const shown = list.slice(at * PAGE, at * PAGE + PAGE);
  return (
    <div className={`room-browser ${compact ? 'compact' : ''}`}>
      <div className="rb-tools">
        <input className="rb-search" value={query} placeholder="🔎 Search by code, name or host…" aria-label="Search rooms" onChange={(e) => { setQuery(e.target.value); setPage(0); }} />
        <select value={kind} aria-label="Game" onChange={(e) => { setKind(e.target.value); setPage(0); }}>
          {KINDS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <select value={sort} aria-label="Sort" onChange={(e) => { setSort(e.target.value); setPage(0); }}>
          {SORTS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </div>
      <div className="room-list">
        {shown.length === 0 && <div className="room-empty">{rooms.length === 0 ? 'No rooms yet. Create one, or join a friend through a code.' : vacantOnly ? 'No open rooms match. Try another game, or show all rooms.' : 'No rooms match your search.'}</div>}
        {shown.map((r) => (
          <div className="room-row" key={r.code}>
            <div className="room-info">
              <b>{r.name}{r.pvp && <span className="pvp-badge">⚔️ Fight</span>}{r.mode === 'waves' && <span className="pvp-badge waves">🌊 {DIFFICULTY[r.difficulty]?.name || 'Waves'}</span>}{r.mode === 'survival' && <span className="pvp-badge survival">☠️ {DIFFICULTY[r.difficulty]?.name || 'Survival'}</span>}</b>
              <span>Host {r.host} · 🗺️ {mapNameOf(r.seed)}{r.mode === 'waves' ? ' · wave defense' : r.mode === 'survival' ? (/~endless$/.test(r.seed) ? ' · endless survival' : ' · survival') : r.pvp ? ` · first to ${r.target} ${r.winBy === 'monsters' ? 'monster ' : ''}kills` : ' · friendly'}{r.allowLate ? '' : ' · no late join'}</span>
            </div>
            <span className="room-code">{r.code}</span>
            <span className={`room-count ${r.count >= r.max ? 'full' : ''}`}>👥 {r.count}/{r.max}</span>
            <button type="button" className="btn small-btn" disabled={busy || !online || !named || r.count >= r.max || (r.started && !r.allowLate)} onClick={() => join(r.code)}>
              {r.count >= r.max ? 'Full' : r.started && !r.allowLate ? 'Started' : 'Join'}
            </button>
          </div>
        ))}
      </div>
      <div className="rb-pages">
        <button type="button" className="btn small-btn" disabled={at <= 0} onClick={() => setPage(at - 1)} aria-label="Previous page">◀</button>
        <small>{list.length ? `Page ${at + 1} of ${pages} · ${list.length} room${list.length === 1 ? '' : 's'}` : 'No rooms'}</small>
        <button type="button" className="btn small-btn" disabled={at >= pages - 1} onClick={() => setPage(at + 1)} aria-label="Next page">▶</button>
      </div>
    </div>
  );
}

// Multiplay, straight from the main menu: your name and hero are already saved, so it is only "Show all rooms", "Join through a code" or "Create a room".
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
    <div className="panel menu-card home-card multi-card">
      <header className="logo">
        <span className="logo-spark"><V2Sprite theme="graveyard" name="Little_Pumpkin_1" scale={3} /></span>
        <h1>Cuzy</h1>
        <span className="logo-spark"><V2Sprite theme="graveyard" name="Little_Pumpkin_2" scale={3} /></span>
      </header>
      <p className="tagline">{view === 'rooms' ? 'open rooms' : view === 'code' ? 'join with a code' : 'play together'}</p>

      {view === 'multi' && (
        <section className="page">
          <h2 className="page-title">👥 Multiplay</h2>
          <div className="multi-cols">
            <div className="multi-side">
              {profile}
              {editor}
              {notices}
              <nav className="home-menu one" aria-label="Multiplay">
                <button type="button" className="home-btn play" disabled={!named || editing} onClick={() => setView('rooms')}>
                  <b>🔎 Show all rooms</b>
                  <small>{!online ? '🟠 Connecting…' : rooms.length ? `🟢 ${rooms.length} room${rooms.length > 1 ? 's' : ''} right now, with search and filters` : '🟢 Nobody is hosting yet'}</small>
                </button>
                <button type="button" className="home-btn" disabled={!named || editing} onClick={() => setView('code')}>
                  <b>🔑 Join through a code</b>
                  <small>A friend gave you a room code or an invite? Type it in</small>
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
            </div>
            <div className="multi-rooms">
              <div className="sub-label">🟢 Open rooms you can join</div>
              <RoomBrowser rooms={rooms} vacantOnly join={join} busy={busy} online={online} named={named && !editing} compact />
            </div>
          </div>
        </section>
      )}

      {view === 'code' && (
        <section className="page">
          <h2 className="page-title">🔑 Join through a code</h2>
          {profile}
          {editor}
          {notices}
          <label className="sub-label" htmlFor="room-code">Room code</label>
          <div className="row">
            <input
              id="room-code"
              className="code-input"
              value={code}
              maxLength={8}
              placeholder="ABCD"
              autoComplete="off"
              autoFocus
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (code.trim() && online && named && !busy) join(code.trim());
                }
              }}
            />
            <button type="button" className="btn go" disabled={busy || !online || !named || !code.trim()} onClick={() => join(code.trim())}>
              {busy ? 'Joining…' : 'Join'}
            </button>
          </div>
          <p className="hint">The host shares a short code (like ABCD) from the room screen, or an invite link that opens the game with the code filled in.</p>
          <div className="nav-row">
            <button type="button" className="btn ghost" onClick={() => setView('multi')}>← Back</button>
            <button type="button" className="btn" onClick={() => setView('rooms')}>🔎 Show all rooms</button>
          </div>
        </section>
      )}

      {view === 'rooms' && (
        <section className="page">
          <h2 className="page-title">🔎 All rooms</h2>
          {profile}
          {editor}
          {notices}
          <RoomBrowser rooms={rooms} join={join} busy={busy} online={online} named={named && !editing} />

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
