import { useEffect, useState } from 'react';
import { music } from '../game/music';

// A little music note at the top right of the menus: tap it to turn the background music off or on (the sound effects have their own switch in Settings).
export default function MusicButton() {
  const [, bump] = useState(0);
  useEffect(() => music.listen(() => bump((n) => n + 1)), []);
  const muted = !music.on;
  return (
    <button
      type="button"
      className={`music-btn ${muted ? 'off' : ''}`}
      aria-label={muted ? 'Turn the music on' : 'Turn the music off'}
      aria-pressed={!muted}
      title={muted ? 'Music is off: tap to turn it on' : 'Music is on: tap to turn it off'}
      onClick={() => music.setOn(!music.on)}
    >
      <span aria-hidden="true">{muted ? '🔇' : '🎵'}</span>
    </button>
  );
}
