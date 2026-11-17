import { useEffect, useRef, useState } from 'react';
import { KINDS, fileToDataUrl, sendFeedback, shrinkImage } from '../game/feedback';
import { store } from '../game/store';

// The feedback window, opened by the little button at the bottom right of the menus, or by the pause menu in a game
// (which hands it a picture of the game: window event "cuzy-feedback" with { shot, context }).
export default function FeedbackHost({ playing }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState('bug');
  const [text, setText] = useState('');
  const [shot, setShot] = useState(null);
  const [context, setContext] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [sent, setSent] = useState(false);
  const file = useRef(null);

  useEffect(() => {
    const on = async (e) => {
      setSent(false);
      setMsg('');
      setContext(e.detail?.context || null);
      setShot(null);
      setOpen(true);
      if (e.detail?.shot) {
        try {
          setShot(await shrinkImage(e.detail.shot));
        } catch {
          /* no picture: fine */
        }
      }
    };
    window.addEventListener('cuzy-feedback', on);
    return () => window.removeEventListener('cuzy-feedback', on);
  }, []);

  const close = () => setOpen(false);
  const pick = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      setShot(await shrinkImage(await fileToDataUrl(f)));
      setMsg('');
    } catch (err) {
      setMsg(err.message);
    }
  };
  const send = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setMsg('');
    try {
      let player = '';
      try {
        player = JSON.parse(store.get('cuzi-profile'))?.name || '';
      } catch {
        /* no name yet */
      }
      await sendFeedback({
        kind,
        details: text,
        player,
        screenshot: shot,
        context: { ...context, page: window.location.pathname, screen: `${window.innerWidth}x${window.innerHeight}`, touch: 'ontouchstart' in window, ua: navigator.userAgent.slice(0, 120) },
      });
      setSent(true);
      setText('');
      setShot(null);
    } catch (err) {
      setMsg(err.message);
    }
    setBusy(false);
  };

  return (
    <>
      {!playing && !open && (
        <button type="button" className="btn small-btn fb-fab" onClick={() => window.dispatchEvent(new CustomEvent('cuzy-feedback'))} title="Report a bug, ask for a feature or make a suggestion">
          💬 Feedback
        </button>
      )}
      {open && (
        <div className="fb-back" onClick={close}>
          <div className="fb-card panel" role="dialog" aria-label="Feedback" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="btn small-btn fb-x" onClick={close} aria-label="Close" title="Close">✕</button>
            <h2>💬 Tell us</h2>
            {sent ? (
              <>
                <p className="hint">Thank you! It was sent.</p>
                <div className="fb-row">
                  <button type="button" className="btn" onClick={() => setSent(false)}>Send another</button>
                  <button type="button" className="btn go" onClick={close}>Close</button>
                </div>
              </>
            ) : (
              <>
                <div className="fb-kinds">
                  {KINDS.map((k) => (
                    <button key={k.id} type="button" className={`fb-kind ${kind === k.id ? 'on' : ''}`} onClick={() => setKind(k.id)}>
                      <b>{k.icon} {k.label}</b>
                      <small>{k.hint}</small>
                    </button>
                  ))}
                </div>
                <textarea value={text} maxLength={2000} rows={4} placeholder={kind === 'bug' ? 'What happened? What did you expect? Which mode or map?' : 'Describe it…'} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.stopPropagation()} onKeyUp={(e) => e.stopPropagation()} />
                <div className="fb-shot">
                  {shot ? (
                    <>
                      <img src={shot} alt="Your screenshot" />
                      <button type="button" className="btn ghost small-btn" onClick={() => setShot(null)}>Remove picture</button>
                    </>
                  ) : (
                    <small>No picture added</small>
                  )}
                  <button type="button" className="btn small-btn" onClick={() => file.current?.click()}>📎 {shot ? 'Change' : 'Add a'} picture</button>
                  <input ref={file} type="file" accept="image/*" hidden onChange={pick} />
                </div>
                {msg && <p className="notice">{msg}</p>}
                <div className="fb-row">
                  <button type="button" className="btn ghost" onClick={close}>Cancel</button>
                  <button type="button" className="btn go" disabled={!text.trim() || busy} onClick={send}>{busy ? 'Sending…' : 'Send'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
