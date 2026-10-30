import { useEffect, useRef, useState } from 'react';
import MusicButton from './MusicButton';
import { RETRO_COUNT, heroById, retroId } from '../game/heroes';
import { BOT_NAMES } from '../game/bots';
import { TEAMS } from '../game/teams';
import RoomSettings from './RoomSettings';
import { inviteLink } from '../game/net';
import SpritePreview from './SpritePreview';
import OnlinePlayers from './OnlinePlayers';
import WorldBackdrop from './WorldBackdrop';

const MODE_LABEL = { free: '🌻 Free Roam', waves: '🛡️ Wave Defense', survival: '🧟 Survival' };

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // the clipboard API needs https or localhost; fall back to a temporary textarea
    const t = document.createElement('textarea');
    t.value = text;
    document.body.appendChild(t);
    t.select();
    document.execCommand('copy');
    t.remove();
  }
}

// The room before the round: everyone who has joined, the invite code, and a Start button for the host.
// A round that has been won sends everyone back here.
export default function WaitingRoom({ assets, net, session, profile, onStart, onLeave, onJoinRoom }) {
  const { you } = session;
  const [room, setRoom] = useState(session.room); // the host's settings, kept up to date
  const [peers, setPeers] = useState(() => [{ id: you, name: profile.name, hero: profile.hero, slot: session.slot }, ...session.players]);
  const [host, setHost] = useState(session.host);
  const [teams, setTeams] = useState(() => ({ ...(session.teams || {}), ...Object.fromEntries(session.players.filter((p) => p.team !== null && p.team !== undefined).map((p) => [p.id, p.team])) }));
  const [copied, setCopied] = useState('');
  const [seatMenu, setSeatMenu] = useState(null); // an empty seat that was tapped: move there, or (for the host) add an AI
  const [lan] = useState(() => net.lan);

  useEffect(
    () =>
      net.on((m) => {
        if (m.t === 'peer_join') {
          setPeers((p) => [...p.filter((x) => x.id !== m.player.id), m.player]);
          if (m.player.team !== null && m.player.team !== undefined) setTeams((t) => ({ ...t, [m.player.id]: m.player.team }));
        } else if (m.t === 'teams') {
          setTeams(m.teams || {});
        } else if (m.t === 'peer_leave') {
          setPeers((p) => p.filter((x) => x.id !== m.id));
          if (m.host != null) setHost(m.host);
        } else if (m.t === 'ais') {
          setPeers((p) => [...p.filter((x) => !x.ai), ...(m.list || [])]);
        } else if (m.t === 'slot') {
          setPeers((p) => p.map((x) => (x.id === m.id ? { ...x, slot: m.slot } : x)));
        } else if (m.t === 'settings') {
          setRoom(m.room);
        } else if (m.t === 'start') {
          onStart(m);
        } else if (m.t === 'disconnected') {
          onLeave();
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [net],
  );

  const doCopy = async (what, text) => {
    await copy(text);
    setCopied(what);
    setTimeout(() => setCopied(''), 1500);
  };

  const imHost = host === you;
  // back in a room whose round had started before the page was reloaded: the host carries on where it was
  const autoStarted = useRef(false);
  useEffect(() => {
    if (session.autoStart && imHost && !autoStarted.current) {
      autoStarted.current = true;
      net.send({ t: 'start' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imHost]);
  const ordered = [...peers].sort((a, b) => (a.id === host ? -1 : b.id === host ? 1 : (a.slot ?? 0) - (b.slot ?? 0)));
  // every seat of the room, by number: who sits in it (anyone with no seat of their own takes the first free one)
  const seats = Array.from({ length: room.max }, () => null);
  const homeless = [];
  for (const p of ordered) {
    if (Number.isInteger(p.slot) && p.slot >= 0 && p.slot < room.max && !seats[p.slot]) seats[p.slot] = p;
    else homeless.push(p);
  }
  for (const p of homeless) {
    const free = seats.findIndex((x) => !x);
    if (free >= 0) seats[free] = p;
  }
  const hostName = ordered.find((p) => p.id === host)?.name || 'the host';

  // a computer player takes a seat: a hero nobody else is using, and a name from the list
  const addAi = (slot) => {
    const heroes = Array.from({ length: RETRO_COUNT }, (_, i) => retroId(i + 1));
    const freeHeroes = heroes.filter((h) => !peers.some((p) => p.hero === h));
    const pool = freeHeroes.length ? freeHeroes : heroes;
    const names = BOT_NAMES.filter((n) => !peers.some((p) => p.name === n));
    net.send({ t: 'addai', slot, name: (names.length ? names : BOT_NAMES)[Math.floor(Math.random() * (names.length || BOT_NAMES.length))], hero: pool[Math.floor(Math.random() * pool.length)] });
    setSeatMenu(null);
  };
  const removeAi = (id) => net.send({ t: 'removeai', id });

  return (
    <div className="menu">
      <MusicButton />
      <WorldBackdrop assets={assets} seed={room.seed} />
      <div className="cloud c1" />
      <div className="cloud c2" />
      <div className="panel menu-card waiting-card">
        <header className="logo">
          <span className="logo-spark">✿</span>
          <h1>{room.name}</h1>
          <span className="logo-spark">✿</span>
        </header>
        <p className="tagline">
          {MODE_LABEL[room.mode] || MODE_LABEL.free}
          {room.pvp ? ` · first to ${room.target} ${room.winBy === 'monsters' ? 'monster ' : ''}kills wins` : ''} · 👥 {ordered.length}/{room.max}
        </p>

        <div className="room-code-row">
          <span className="room-code big">{room.code}</span>
          <button type="button" className="btn small-btn" onClick={() => doCopy('code', room.code)}>{copied === 'code' ? 'Copied!' : 'Copy code'}</button>
          <button type="button" className="btn small-btn" onClick={() => doCopy('link', inviteLink(room.code, lan))}>{copied === 'link' ? 'Link copied!' : '✉️ Invite link'}</button>
        </div>

        <div className="wait-layout">
          <div className="wait-main">
        {room.teams > 0 && room.mode === 'free' ? (
          <div className="team-cols" style={{ gridTemplateColumns: `repeat(${room.teams}, minmax(0, 1fr))` }} aria-label="Teams">
            {TEAMS.slice(0, room.teams).map((t, ti) => {
              const members = ordered.filter((p) => teams[p.id] === ti);
              const cap = Math.ceil(room.max / room.teams);
              return (
                <div className="team-col" key={t.name} style={{ '--team': t.color }}>
                  <h4>{t.icon} {t.name} <small>{members.length}/{cap}</small></h4>
                  {Array.from({ length: cap }, (_, k) => {
                    const p = members[k];
                    if (p) {
                      const hero = heroById(p.hero);
                      return (
                        <div className={`team-slot filled ${p.id === you ? 'me' : ''}`} key={p.id}>
                          <SpritePreview img={assets.img} hero={hero} active />
                          <b>{p.id === host ? '👑 ' : ''}{p.ai ? '🤖 ' : ''}{p.name}{p.id === you ? ' (you)' : ''}</b>
                          {p.ai && imHost && <button type="button" className="seat-x" title="Remove this computer player" onClick={() => removeAi(p.id)}>✕</button>}
                        </div>
                      );
                    }
                    return (
                      <button key={`e${k}`} type="button" className="team-slot" title={`Join the ${t.name} team`} onClick={() => net.send({ t: 'team', team: ti })}>
                        <span>＋<small>Tap to join {t.name}</small></span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ) : (
        <div className="wait-grid" aria-label="Players in the room">
          {seats.map((p, i) => {
            if (p) {
              const hero = heroById(p.hero);
              return (
                <div className={`wait-slot ${p.id === you ? 'me' : ''}`} key={p.id} style={room.teams > 0 && TEAMS[teams[p.id]] ? { borderColor: TEAMS[teams[p.id]].color } : undefined}>
                  {p.id === host && <span className="wait-badge">👑 Host</span>}
                  {p.ai && <span className="wait-badge ai">🤖 Computer</span>}
                  {p.ai && imHost && <button type="button" className="seat-x" title="Remove this computer player" onClick={() => removeAi(p.id)}>✕</button>}
                  <SpritePreview img={assets.img} hero={hero} active />
                  <b className="wait-name">{p.name}{p.id === you ? ' (you)' : ''}</b>
                  <small>{hero.label}</small>
                  {room.teams > 0 && (
                    <div className="team-chips" role="group" aria-label={`${p.name}'s team`}>
                      {TEAMS.slice(0, room.teams).map((t, ti) => (
                        <button key={t.name} type="button" className={`team-chip ${teams[p.id] === ti ? 'on' : ''}`} style={{ '--team': t.color }} disabled={p.id !== you} title={p.id === you ? `Join the ${t.name} team` : `${p.name}'s team`} onClick={() => net.send({ t: 'team', team: ti })}>
                          {t.icon}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <div className="wait-slot empty seat" key={`e${i}`}>
                <button type="button" className="seat-btn" onClick={() => setSeatMenu(seatMenu === i ? null : i)} aria-expanded={seatMenu === i}>
                  <span className="wait-q">＋</span>
                  <small>Empty seat {i + 1}</small>
                </button>
                {seatMenu === i && (
                  <div className="seat-menu" role="menu">
                    <button type="button" role="menuitem" className="btn small-btn" onClick={() => { net.moveSlot?.(i); setSeatMenu(null); }}>↪ Move here</button>
                    {imHost && (
                      <button type="button" role="menuitem" className="btn small-btn" disabled={room.mode !== 'free'} title={room.mode === 'free' ? 'A computer player takes this seat and fights for itself' : 'Computer players only join Free Roam fights'} onClick={() => addAi(i)}>
                        🤖 Add AI
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        )}

        {imHost && room.teams > 0 && room.mode === 'free' && ordered.length < room.max && (
          <button type="button" className="btn small-btn add-ai" onClick={() => addAi()}>🤖 Add a computer player</button>
        )}

        <RoomSettings room={room} count={ordered.length} editable={imHost} onChange={(patch) => net.send({ t: 'settings', ...patch })} />

          </div>
          <aside className="wait-side">
        <section className="settings-panel online-section side-box" aria-label="Players online">
          <h3>🌐 Online now <small>invite anyone who has the game open</small></h3>
          <OnlinePlayers net={net} assets={assets} onJoinRoom={onJoinRoom} />
        </section>
          </aside>
        </div>

        <div className="nav-row">
          <button type="button" className="btn ghost" onClick={onLeave}>← Leave room</button>
          {imHost ? (
            <button type="button" className="btn go" onClick={() => net.send({ t: 'start' })}>
              {ordered.length > 1 ? `Start with ${ordered.length} players ➜` : 'Start alone ➜'}
            </button>
          ) : (
            <span className="wait-note">⏳ Waiting for {hostName} to start…</span>
          )}
        </div>
      </div>
    </div>
  );
}
