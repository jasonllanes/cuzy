import { useEffect, useState } from 'react';
import { heroById } from '../game/heroes';
import { inviteLink } from '../game/net';
import SpritePreview from './SpritePreview';
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

// One on/off setting, drawn as a switch
function Switch({ label, hint, on, disabled, onChange }) {
  return (
    <div className="set-row">
      <div className="set-label"><b>{label}</b><small>{hint}</small></div>
      <button type="button" role="switch" aria-checked={on} className={`switch ${on ? 'on' : ''}`} disabled={disabled} onClick={() => onChange(!on)}>
        <i />
      </button>
    </div>
  );
}

// The host's room rules. Everyone can see them; only the host can change them, and most are locked once a round is running.
function RoomSettings({ room, count, editable, onChange }) {
  const free = room.mode === 'free';
  const locked = !editable || room.started;
  const monsters = room.winBy === 'monsters';
  return (
    <section className="settings-panel" aria-label="Room settings">
      <h3>⚙️ Room settings {!editable && <small>set by the host</small>}</h3>
      <div className="set-grid">
        <div className="set-row">
          <div className="set-label"><b>Max players</b><small>{count} in the room now</small></div>
          <select value={room.max} disabled={locked} onChange={(e) => onChange({ max: Number(e.target.value) })}>
            {[2, 3, 4, 5, 6, 7, 8, 9, 10].filter((n) => n >= count).map((n) => <option key={n} value={n}>{n} players</option>)}
          </select>
        </div>
        <Switch label="Kill streaks on monsters" hint={room.streakMonsters ? 'Monster kills count towards streaks too, and everyone sees them' : 'Off: only killing a player starts a streak'} on={!!room.streakMonsters} disabled={locked} onChange={(v) => onChange({ streakMonsters: v })} />
        <Switch label="Allow late join" hint="Let people in after the round has started" on={room.allowLate !== false} disabled={!editable} onChange={(v) => onChange({ allowLate: v })} />
        {free && (
          <>
            <Switch label="Player damage" hint="Heroes can hurt each other" on={!!room.pvp} disabled={locked} onChange={(v) => onChange({ pvp: v })} />
            <Switch label="Allow melee" hint="Sword, dash and spiral" on={room.allowMelee !== false} disabled={locked} onChange={(v) => onChange({ allowMelee: v })} />
            <Switch label="Allow throwing" hint="Right-click throws" on={room.allowThrow !== false} disabled={locked} onChange={(v) => onChange({ allowThrow: v })} />
            <div className="set-row">
              <div className="set-label"><b>Win by</b><small>{room.pvp ? 'What counts towards the win' : 'Player damage is off, so monsters it is'}</small></div>
              <div className="seg">
                <button type="button" className={!monsters ? 'on' : ''} disabled={locked || !room.pvp} onClick={() => onChange({ winBy: 'duel', target: 10 })}>⚔️ Players</button>
                <button type="button" className={monsters ? 'on' : ''} disabled={locked} onClick={() => onChange({ winBy: 'monsters', target: 15 })}>👹 Monsters</button>
              </div>
            </div>
            <div className="set-row wide">
              <div className="set-label"><b>Reach {room.target} {monsters ? 'monster ' : 'player '}kills to win</b><small>Drag to change</small></div>
              <input type="range" min={1} max={50} value={Math.min(50, room.target)} disabled={locked} onChange={(e) => onChange({ target: Number(e.target.value) })} />
            </div>
          </>
        )}
      </div>
    </section>
  );
}

// The room before the round: everyone who has joined, the invite code, and a Start button for the host.
// A round that has been won sends everyone back here.
export default function WaitingRoom({ assets, net, session, profile, onStart, onLeave }) {
  const { you } = session;
  const [room, setRoom] = useState(session.room); // the host's settings, kept up to date
  const [peers, setPeers] = useState(() => [{ id: you, name: profile.name, hero: profile.hero, slot: session.slot }, ...session.players]);
  const [host, setHost] = useState(session.host);
  const [copied, setCopied] = useState('');
  const [lan] = useState(() => net.lan);

  useEffect(
    () =>
      net.on((m) => {
        if (m.t === 'peer_join') {
          setPeers((p) => [...p.filter((x) => x.id !== m.player.id), m.player]);
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

        <div className="wait-grid" aria-label="Players in the room">
          {ordered.map((p) => {
            const hero = heroById(p.hero);
            return (
              <div className={`wait-slot ${p.id === you ? 'me' : ''}`} key={p.id}>
                {p.id === host && <span className="wait-badge">👑 Host</span>}
                <SpritePreview img={assets.img} hero={hero} active />
                <b className="wait-name">{p.name}{p.id === you ? ' (you)' : ''}</b>
                <small>{hero.label}</small>
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
