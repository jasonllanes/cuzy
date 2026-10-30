import { useState } from 'react';
import { inviteLink } from '../game/net';
import { heroById } from '../game/heroes';

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // clipboard API needs https or localhost; fall back to a temporary textarea
    const t = document.createElement('textarea');
    t.value = text;
    document.body.appendChild(t);
    t.select();
    const ok = document.execCommand('copy');
    t.remove();
    return ok;
  }
}

export default function RoomPanel({ room, peers, myId, lan }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState('');
  const link = inviteLink(room.code, lan);

  const doCopy = async (what, text) => {
    await copy(text);
    setCopied(what);
    setTimeout(() => setCopied(''), 1500);
  };

  return (
    <div className="hud room-panel">
      <button className="room-pill panel small" onClick={() => setOpen((o) => !o)}>
        🏡 Room <b>{room.code}</b> · 👥 {peers.length}/{room.max} {open ? '▴' : '▾'}
      </button>
      {open && (
        <div className="room-card panel small">
          <div className="room-title">{room.name}</div>
          <div className="room-code-row">
            <span className="room-code big">{room.code}</span>
            <button className="btn small-btn" onClick={() => doCopy('code', room.code)}>{copied === 'code' ? 'Copied!' : 'Copy code'}</button>
          </div>
          <button className="btn small-btn wide" onClick={() => doCopy('link', link)}>
            {copied === 'link' ? 'Link copied!' : '✉️ Copy invite link'}
          </button>
          <p className="hint tiny">Friends on the same Wi-Fi can open the link, or type the code in the menu.</p>
          <div className="peer-list">
            {peers.map((p) => (
              <div className="peer-row" key={p.id}>
                <span className="peer-name">{p.name}{p.id === myId ? ' (you)' : ''}<small>{heroById(p.hero).label}</small></span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
