import { useEffect, useState } from 'react';
import { heroById } from '../game/heroes';
import SpritePreview from './SpritePreview';

const SHOWN_MS = 6000; // how long a row says "Invited"

// Everyone who has the game open right now, wherever they are. If you are in a room you can invite any of them:
// they get a pop-up in their game (menu, waiting room or mid-round) and can join with one click.
export default function OnlinePlayers({ net, assets }) {
  const [list, setList] = useState(() => net.online || []);
  const [sent, setSent] = useState({}); // player id -> true for a few seconds after inviting
  const inRoom = !!net.roomCode;

  useEffect(() => {
    setList(net.online || []);
    return net.on((m) => {
      if (m.t === 'online') setList(m.players);
    });
  }, [net]);

  const invite = (p) => {
    if (!net.invite(p.id)) return;
    setSent((s) => ({ ...s, [p.id]: true }));
    setTimeout(() => setSent((s) => ({ ...s, [p.id]: false })), SHOWN_MS);
  };

  if (!list.length) {
    return <p className="hint online-empty">Nobody else is online right now. Share your room code or invite link instead!</p>;
  }
  return (
    <div className="online-list">
      {!inRoom && <p className="hint">Open a room (Play → Together) to invite people.</p>}
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
    </div>
  );
}
