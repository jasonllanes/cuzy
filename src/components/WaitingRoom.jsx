import { useEffect, useState } from 'react';
import { heroById } from '../game/heroes';
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
  const ordered = [...peers].sort((a, b) => (a.id === host ? -1 : b.id === host ? 1 : (a.slot ?? 0) - (b.slot ?? 0)));
  const empty = Math.max(0, room.max - ordered.length);
  const hostName = ordered.find((p) => p.id === host)?.name || 'the host';

  return (
    <div className="menu">
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
                          <b>{p.id === host ? '👑 ' : ''}{p.name}{p.id === you ? ' (you)' : ''}</b>
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
          {ordered.map((p) => {
            const hero = heroById(p.hero);
            return (
              <div className={`wait-slot ${p.id === you ? 'me' : ''}`} key={p.id} style={room.teams > 0 && TEAMS[teams[p.id]] ? { borderColor: TEAMS[teams[p.id]].color } : undefined}>
                {p.id === host && <span className="wait-badge">👑 Host</span>}
                <SpritePreview img={assets.img} hero={hero} active />
                <b className="wait-name">{p.name}{p.id === you ? ' (you)' : ''}</b>
                <small>{hero.label}</small>
                {room.teams > 0 && (
                  <div className="team-chips" role="group" aria-label={`${p.name}'s team`}>
                    {TEAMS.slice(0, room.teams).map((t, i) => (
                      <button
                        key={t.name}
                        type="button"
                        className={`team-chip ${teams[p.id] === i ? 'on' : ''}`}
                        style={{ '--team': t.color }}
                        disabled={p.id !== you}
                        title={p.id === you ? `Join the ${t.name} team` : `${p.name}'s team`}
                        onClick={() => net.send({ t: 'team', team: i })}
                      >
                        {t.icon}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {Array.from({ length: empty }, (_, i) => (
            <div className="wait-slot empty" key={`e${i}`}>
              <span className="wait-q">?</span>
              <small>Waiting for a friend…</small>
            </div>
          ))}
        </div>
        )}

        <section className="settings-panel online-section" aria-label="Players online">
          <h3>🌐 Online now <small>invite anyone who has the game open</small></h3>
          <OnlinePlayers net={net} assets={assets} onJoinRoom={onJoinRoom} />
        </section>

        <RoomSettings room={room} count={ordered.length} editable={imHost} onChange={(patch) => net.send({ t: 'settings', ...patch })} />

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
