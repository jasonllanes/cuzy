import { useEffect, useState } from 'react';
import { cloudOn, signInWithGoogle, signOut, takeAuthError, watchAccount } from '../game/auth';

export const GoogleG = ({ size = 18 }) => (
  <svg className="g-logo" viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
    <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
  </svg>
);

// Signed in with Google, or playing as a guest. A signed-in account keeps your name, character and progress in the cloud.
// `onName` hears the Google name once you are signed in, so it can be offered as your player name.
export default function AccountBox({ compact = false, onName }) {
  const [account, setAccount] = useState(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(() => (cloudOn ? takeAuthError() : ''));

  useEffect(
    () =>
      watchAccount((a) => {
        setAccount(a);
        setReady(true);
        if (a?.google && a.name) onName?.(a.name);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  if (!cloudOn) return null;
  const google = account?.google;

  const run = async (fn) => {
    setBusy(true);
    setMessage('');
    try {
      await fn();
    } catch (err) {
      setMessage(err?.message || 'Something went wrong.');
    }
    setBusy(false);
  };

  const leave = () => {
    if (!window.confirm('Sign out? This browser forgets your saved games and profile (they stay safe in your Google account) and you carry on as a guest.')) return;
    run(signOut);
  };

  return (
    <div className={`account-box ${compact ? 'compact' : ''}`}>
      {google ? (
        <div className="account-who">
          {account.avatar ? <img className="account-avatar" src={account.avatar} alt="" referrerPolicy="no-referrer" /> : <span className="account-avatar blank">🙂</span>}
          <div className="account-text">
            <b>{account.name || 'Signed in'}</b>
            <small>{compact ? 'Name, character and progress are saved to your account' : account.email}</small>
          </div>
          <button type="button" className="btn ghost small-btn" disabled={busy} onClick={leave}>Sign out</button>
        </div>
      ) : (
        <div className="account-who">
          <button type="button" className="btn google-btn" disabled={busy || !ready} onClick={() => run(signInWithGoogle)}>
            <GoogleG /> {busy ? 'Opening Google…' : 'Sign in with Google'}
          </button>
          <small>{compact ? 'Playing as a guest: progress stays in this browser' : 'You are playing as a guest, so your name, character and progress stay in this browser. Sign in to keep them in your account, on every device.'}</small>
        </div>
      )}
      {message && <div className="notice">{message}</div>}
    </div>
  );
}

