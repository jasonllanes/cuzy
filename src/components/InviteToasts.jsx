import { useEffect } from 'react';
import { heroById } from '../game/heroes';
import SpritePreview from './SpritePreview';

const SHOWN_MS = 15000; // an invite stays on screen this long, then quietly goes away

function Toast({ invite, assets, onJoin, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(invite.key), invite.error ? 4500 : SHOWN_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (invite.error) {
    return (
      <div className="invite-toast error panel small" role="alert">
        <span>{invite.error}</span>
        <button type="button" className="btn small-btn" onClick={() => onDismiss(invite.key)} aria-label="Dismiss">✕</button>
      </div>
    );
  }
  return (
    <div className="invite-toast panel small" role="alert">
      <span className="invite-face"><SpritePreview img={assets.img} hero={heroById(invite.from.hero)} /></span>
      <div className="invite-text">
        <b>{invite.from.name}</b> invited you to <b>{invite.roomName || `room ${invite.code}`}</b>
        <small>Room {invite.code}</small>
      </div>
      <div className="invite-actions">
        <button type="button" className="btn go small-btn" onClick={() => onJoin(invite)}>Join</button>
        <button type="button" className="btn small-btn" onClick={() => onDismiss(invite.key)} aria-label="No thanks">✕</button>
      </div>
      <i className="invite-timer" style={{ animationDuration: `${SHOWN_MS}ms` }} />
    </div>
  );
}

// Invitations from other players. They pop up over everything (menu, waiting room, mid-game) for a little while.
export default function InviteToasts({ invites, assets, onJoin, onDismiss }) {
  if (!invites.length) return null;
  return (
    <div className="invite-stack" aria-live="polite">
      {invites.map((i) => <Toast key={i.key} invite={i} assets={assets} onJoin={onJoin} onDismiss={onDismiss} />)}
    </div>
  );
}
