import { useState } from 'react';
import { sfx } from '../game/sfx';

// A little music note at the top right of the menus: tap it to mute or unmute every sound.
export default function MusicButton() {
  const [muted, setMuted] = useState(!!sfx.muted);
  return (
    <button
      type="button"
      className={`music-btn ${muted ? 'off' : ''}`}
      aria-label={muted ? 'Unmute the sound' : 'Mute the sound'}
      aria-pressed={!muted}
      title={muted ? 'Sound is off: tap to turn it on' : 'Sound is on: tap to mute'}
      onClick={() => {
        sfx.setMuted(!sfx.muted);
        setMuted(!!sfx.muted);
      }}
    >
      <span aria-hidden="true">{muted ? '🔇' : '🎵'}</span>
    </button>
  );
}
