import { useState } from 'react';
import AudioSettings from './AudioSettings';
import { CREDITS, TOOLS } from '../game/credits';
import { store } from '../game/store';
import ControlsLayout from './ControlsLayout';
import ScreenSettings from './ScreenSettings';

const CHECKED = {
  page: '✔ author confirmed from their page',
  file: '✔ author named in the license file that came with the pack',
  guess: '⚠ author not fully confirmed',
};

// The main menu: Play, Multiplay, Settings, About and Exit, and the pages behind them.
export default function MenuHome({ view, setView, onPlay, onMulti, name, setName, online }) {
  const [gone, setGone] = useState(false);
  const [msg, setMsg] = useState('');

  const clearSaves = () => {
    if (!window.confirm('Delete every saved game on this device? Your name and settings stay.')) return;
    let n = 0;
    for (const k of Object.keys(window.localStorage)) {
      if (k.startsWith('cuzi-save:')) {
        store.remove(k);
        n++;
      }
    }
    setMsg(n ? `Deleted ${n} saved game${n > 1 ? 's' : ''}.` : 'There were no saved games.');
  };

  const closeWindow = () => {
    window.close();
    setTimeout(() => setGone(true), 300); // a browser only lets a page close itself if it opened it
  };

  const back = <button type="button" className="btn ghost" onClick={() => setView('home')}>← Main menu</button>;

  return (
    <div className="panel menu-card home-card">
      <header className="logo">
        <span className="logo-spark">✿</span>
        <h1>Cuzy</h1>
        <span className="logo-spark">✿</span>
      </header>
      <p className="tagline">a tiny cozy world to explore</p>

      {view === 'home' && (
        <nav className="home-menu" aria-label="Main menu">
          <button type="button" className="home-btn play" onClick={onPlay}>
            <b>▶ Play</b>
            <small>Explore on your own, against computer rivals, or survive the horde</small>
          </button>
          <button type="button" className="home-btn" onClick={onMulti}>
            <b>👥 Multiplay</b>
            <small>{online ? '🟢 Host a room or join friends with a code' : '🟠 Host a room or join friends (connecting…)'}</small>
          </button>
          <button type="button" className="home-btn" onClick={() => setView('settings')}>
            <b>⚙️ Settings</b>
            <small>Sound, your name and saved games</small>
          </button>
          <button type="button" className="home-btn" onClick={() => setView('about')}>
            <b>📖 About</b>
            <small>How to play and who made the art</small>
          </button>
          <button type="button" className="home-btn exit" onClick={() => { setGone(false); setView('exit'); }}>
            <b>🚪 Exit</b>
          </button>
        </nav>
      )}

      {view === 'settings' && (
        <section className="page">
          <h2 className="page-title">⚙️ Settings</h2>
          <div className="settings-cols">
          <div>
          <h3 className="shop-h">🔊 Sound</h3>
          <AudioSettings />
          <h3 className="shop-h">🎮 Controls &amp; screen</h3>
          <ScreenSettings />
          </div>
          <div>
          <h3 className="shop-h">📐 Mobile layout</h3>
          <ControlsLayout />
          <h3 className="shop-h">🧑 Player</h3>
          <label className="sub-label" htmlFor="set-name">Your name</label>
          <input id="set-name" value={name} maxLength={14} autoComplete="off" onChange={(e) => setName(e.target.value)} />
          <h3 className="shop-h">💾 Saved games</h3>
          <p className="hint">Every map keeps its own progress on this device (and in the cloud, if it is set up).</p>
          <button type="button" className="btn ghost small-btn" onClick={clearSaves}>Delete all saved games</button>
          {msg && <p className="hint">{msg}</p>}
          </div>
          </div>
          <div className="nav-row">{back}<span /></div>
        </section>
      )}

      {view === 'about' && (
        <section className="page about-page">
          <h2 className="page-title">📖 About Cuzy</h2>
          <p>
            Cuzy is a cozy pixel-art game you can play alone or with friends: wander a map, forage and open chests, ride a chicken, explore crypts,
            caves and ruined houses, fight rivals or monsters, defend a house through wave after wave, or survive the zombie apocalypse.
          </p>
          <h3 className="shop-h">🎮 Controls</h3>
          <p className="hint">
            <b>WASD</b> move · <b>Shift</b> sprint · <b>Left click</b> sword (hold to dash) · <b>Right click</b> throw / shoot · <b>Space</b> use, open, enter ·
            <b> 1-9</b> select · <b>E</b> eat · <b>B</b> shop · <b>Tab</b> switch weapon · <b>M</b> map · <b>Enter</b> chat · <b>P</b> pause · <b>G</b> guide
          </p>

          <h3 className="shop-h">🎨 Credits</h3>
          <p className="hint">Cuzy would not look like this without the artists below. Please visit their pages and support their work.</p>
          <ul className="credits">
            {CREDITS.map((c) => (
              <li key={c.pack} className="credit">
                <b>{c.pack}</b>
                <span className="credit-by">by {c.authors}</span>
                <span>{c.used}</span>
                <a href={c.link} target="_blank" rel="noopener noreferrer">{c.link.replace('https://', '')}</a>
                <small className="credit-lic">{c.license}</small>
                <small className={`credit-check ${c.checked}`}>{CHECKED[c.checked]}</small>
                {c.note && <small className="credit-note">{c.note}</small>}
              </li>
            ))}
          </ul>
          <h3 className="shop-h">🛠 Made with</h3>
          <ul className="credits tools">
            {TOOLS.map((t) => (
              <li key={t.name}><a href={t.link} target="_blank" rel="noopener noreferrer">{t.name}</a> by {t.by}: {t.what}</li>
            ))}
            <li>All sound effects are made in the browser as the game runs, so there are no audio files to credit.</li>
          </ul>
          <p className="hint">The art belongs to its creators and is used under their free licenses. Cuzy is a free, non-commercial project.</p>
          <div className="nav-row">{back}<span /></div>
        </section>
      )}

      {view === 'exit' && (
        <section className="page exit-page">
          <h2 className="page-title">👋 See you soon!</h2>
          <p>Thanks for playing Cuzy. Your progress is saved.</p>
          {gone && <div className="notice">Your browser doesn't let a page close itself. You can just close this tab.</div>}
          <div className="nav-row">
            <button type="button" className="btn go" onClick={() => setView('home')}>← Back to the menu</button>
            <button type="button" className="btn ghost" onClick={closeWindow}>Close the window</button>
          </div>
        </section>
      )}
    </div>
  );
}
