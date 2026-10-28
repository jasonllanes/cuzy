import { useEffect, useState } from 'react';
import { sfx } from '../game/sfx';

// Sound settings: a mute switch and a volume slider. Used by the pause menu and the main menu.
export default function AudioSettings() {
  const [, bump] = useState(0);
  useEffect(() => sfx.on(() => bump((n) => n + 1)), []);
  const pct = Math.round(sfx.volume * 100);

  return (
    <div className="settings">
      <label className="check settings-mute">
        <input type="checkbox" checked={!sfx.muted} onChange={(e) => sfx.setMuted(!e.target.checked)} />
        {sfx.muted ? '🔇 Sound effects off' : '🔊 Sound effects on'}
      </label>
      <label className="check settings-mute">
        <input type="checkbox" checked={sfx.voice} onChange={(e) => sfx.setVoice(e.target.checked)} />
        {sfx.voice ? '🎙️ Announcer voice on' : '🎙️ Announcer voice off'}
      </label>
      <label className={`settings-volume ${sfx.muted ? 'off' : ''}`}>
        <span>Volume</span>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={pct}
          aria-label="Sound effects volume"
          onChange={(e) => sfx.setVolume(Number(e.target.value) / 100)}
          // a little coin clink on release so you can hear the new level
          onPointerUp={() => sfx.play('coin')}
          onKeyUp={() => sfx.play('coin')}
        />
        <b>{pct}%</b>
      </label>
    </div>
  );
}
