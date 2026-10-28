import { useEffect, useState } from 'react';
import { heroById } from '../game/heroes';
import SpritePreview from './SpritePreview';

const SHOWN_MS = 6000; // how long a row says "Invited"

// Everyone who has the game open right now, wherever they are. If you are in a room you can invite any of them:
// they get a pop-up in their game (menu, waiting room or mid-round) and can join with one click.
export default function OnlinePlayers({ net, assets, onJoinRoom }) {
  const [list, setList] = useState(() => net.online || []);
  const [rooms, setRooms] = useState(() => net.rooms || []);
  const [sent, setSent] = useState({}); // player id -> true for a few seconds after inviting
  const inRoom = !!net.roomCode;

  useEffect(() => {
    setList(net.online || []);
    setRooms(net.rooms || []);
    const off = net.on((m) => {
      if (m.t === 'online') setList(m.players);
      if (m.t === 'rooms') setRooms(m.rooms);
    });
    net.watchLobby?.(); // keep the list of open rooms fresh while this is on screen
    return () => {
      off();
      net.stopLobby?.();
    };
  }, [net]);

  const invite = (p) => {
    if (!net.invite(p.id)) return;
    setSent((s) => ({ ...s, [p.id]: true }));
    setTimeout(() => setSent((s) => ({ ...s, [p.id]: false })), SHOWN_MS);
  };

  // rooms with someone in them, other than ours
  const open = rooms.filter((r) => r.code !== net.roomCode && r.count > 0);

  return (
    <div className="online-list">
      {!inRoom && list.length > 0 && <p className="hint">Open a room (Play → Together) to invite people.</p>}
      {list.map((p) => {
        const here = p.room && p.room === net.roomCode;
        return (
          <div className="online-row" key={p.id}>
            <span className="online-face"><SpritePreview img={assets.img} hero={heroById(p.hero)} /></span>
            <span className="online-info">
              <b>{p.name}</b>
              <small>{here ? 'In your room' : p.room ? `In room ${p.room}${p.roomName ? ` · ${p.roomName}` : ''}` : 'Online'}</small>
            </span>
            <button type="button" className="btn small-btn" disabled={!inRoom || here || sent[p.id]} onClick={() => invite(p)}>
              {sent[p.id] ? 'Invited ✓' : here ? 'Here' : 'Invite'}
            </button>
          </div>
        );
      })}
      {open.length > 0 && <div className="online-sub">🏡 Rooms with players in them</div>}
      {open.map((r) => {
        const closed = r.count >= r.max || (r.started && !r.allowLate);
        return (
          <div className="online-row room" key={r.code}>
            <span className="online-info">
              <b>{r.name}</b>
              <small>Host {r.host} · 👥 {r.count}/{r.max}{r.started ? ' · playing' : ' · in the lobby'} · {r.code}</small>
            </span>
            <button type="button" className="btn go small-btn" disabled={closed || !onJoinRoom} onClick={() => onJoinRoom(r.code)}>
              {r.count >= r.max ? 'Full' : closed ? 'Started' : 'Join'}
            </button>
          </div>
        );
      })}
      {!list.length && !open.length && <p className="hint online-empty">Nobody else is online right now. Share your room code or invite link instead!</p>}
      <p className="hint online-note">Players only appear here once they have reloaded the page to the latest version.</p>
    </div>
  );
}
