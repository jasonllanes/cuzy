import { useState } from 'react';
import AudioSettings from './AudioSettings';
import { store } from '../game/store';
import ControlsLayout from './ControlsLayout';
import ScreenSettings from './ScreenSettings';
import AboutContent from './AboutContent';
import AccessForm from './AccessForm';
import { isUnlocked, lockAgain } from '../game/access';


// The main menu: Play, Multiplay, Settings, About and Exit, and the pages behind them.
export default function MenuHome({ view, setView, onPlay, onMulti, onTraining, onTrainingV2, onV2, name, setName, online, notice = '' }) {
  const [gone, setGone] = useState(false);
  const [msg, setMsg] = useState('');
  const [access, setAccess] = useState(isUnlocked); // the developer tools are locked until the code is typed in Settings

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

      {view === 'home' && notice && <div className="notice">{notice}</div>}
      {view === 'home' && (
        <nav className="home-menu" aria-label="Main menu">
          <button type="button" className="home-btn play" onClick={onPlay}>
            <b>▶ Play Solo</b>
            <small>Explore on your own, against computer rivals, or survive the horde</small>
          </button>
          <button type="button" className="home-btn" onClick={onMulti}>
            <b>👥 Multiplayer</b>
            <small>{online ? '🟢 See the open rooms, or create your own' : '🟠 See the open rooms, or create your own (connecting…)'}</small>
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
          <h3 className="shop-h">🔒 Developer access</h3>
          {!access ? (
            <>
              <p className="hint">The training rooms and Free Roam V2 are locked. Type the access code to open them.</p>
              <AccessForm onUnlocked={() => setAccess(true)} />
            </>
          ) : (
            <div className="dev-tools">
              {onTraining && <button type="button" className="btn small-btn" onClick={onTraining}>🛠 Training ground</button>}
              {onTrainingV2 && <button type="button" className="btn small-btn" onClick={onTrainingV2}>🏙 Training room V2</button>}
              {onV2 && <button type="button" className="btn small-btn" onClick={onV2}>🏙 Free Roam V2</button>}
              <button type="button" className="btn ghost small-btn" onClick={() => { lockAgain(); setAccess(false); }}>Lock again</button>
            </div>
          )}
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
          <AboutContent />
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
