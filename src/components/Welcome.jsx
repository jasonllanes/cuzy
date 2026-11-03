import { useState } from 'react';
import { signInWithGoogle, takeAuthError } from '../game/auth';
import V2Sprite from './V2Sprite';
import { GoogleG } from './AccountBox';

// The first page: sign in with Google (your name, character and progress are kept in your account, on every device)
// or play as a guest (everything stays in this browser only). You can still sign in later from the menu.
export default function Welcome({ onGuest }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(takeAuthError);

  const google = async () => {
    setBusy(true);
    setMessage('');
    try {
      await signInWithGoogle();
    } catch (err) {
      setMessage(err?.message || 'Something went wrong.');
      setBusy(false);
    }
  };

  return (
    <div className="menu welcome">
      <div className="panel menu-card home-card welcome-card">
        <header className="logo">
          <span className="logo-spark"><V2Sprite theme="graveyard" name="Little_Pumpkin_1" scale={3} /></span>
          <h1>Cuzy</h1>
          <span className="logo-spark"><V2Sprite theme="graveyard" name="Little_Pumpkin_2" scale={3} /></span>
        </header>
        <p className="tagline">a tiny cozy world to explore</p>
        <h2 className="page-title">How do you want to play?</h2>
        {message && <div className="notice">{message}</div>}
        <nav className="home-menu" aria-label="Sign in">
          <button type="button" className="home-btn play" disabled={busy} onClick={google}>
            <b><span className="home-ico"><GoogleG size={26} /></span>{busy ? 'Opening Google…' : 'Sign in with Google'}</b>
            <small>Your name, character and progress are saved to your account and follow you to every device</small>
          </button>
          <button type="button" className="home-btn" disabled={busy} onClick={onGuest}>
            <b><span className="home-ico">🎮</span>Play as guest</b>
            <small>Jump straight in. Your name and progress stay in this browser only</small>
          </button>
        </nav>
        <p className="hint welcome-note">You can sign in later from the main menu, and your guest progress comes along.</p>
      </div>
    </div>
  );
}
