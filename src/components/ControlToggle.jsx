import { useEffect, useState } from 'react';
import { enterMobileScreen, layoutScale, useControls, useLayout } from '../game/controls';

const usePortrait = () => {
  const q = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(orientation: portrait)') : null;
  const [p, setP] = useState(!!q?.matches);
  useEffect(() => {
    if (!q) return undefined;
    const on = () => setP(q.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, [q]);
  return p;
};

// Keeps the page in step with the controls chosen in Settings (the Mobile screen scale, the hand, the sizes), and asks a
// phone held upright to turn sideways. (The Desktop/Mobile switch itself lives in Settings.)
export default function ControlToggle({ playing = false }) {
  const mode = useControls();
  const mobile = mode === 'mobile';
  const portrait = usePortrait();
    const [dismissed, setDismissed] = useState(false);
  const layout = useLayout();

  // the hand and the sizes picked in Settings
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('touch-left', layout.hand === 'left');
    root.style.setProperty('--ts', String(layoutScale(layout.buttons)));
    root.style.setProperty('--hs', String(layoutScale(layout.screen)));
  }, [layout]);

  // Mobile mode makes every screen smaller (--mz is the scale), sized to the window
  useEffect(() => {
    const root = document.documentElement;
    const fit = () => root.style.setProperty('--mz', String(Math.max(0.5, Math.min(0.8, window.innerWidth / 1290, window.innerHeight / 540)).toFixed(3)));
    root.classList.toggle('mobile-ui', mobile);
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [mobile]);
  return (
    <>
      {mobile && playing && portrait && !dismissed && (
        <div className="rotate-hint" role="dialog" aria-label="Turn your phone">
          <div className="rotate-icon">📱↻</div>
          <h2>Turn your phone sideways</h2>
          <p>Cuzy plays best in landscape, with the whole screen.</p>
          <button type="button" className="btn go" onClick={enterMobileScreen}>Landscape &amp; fullscreen</button>
          <button type="button" className="btn ghost small-btn" onClick={() => setDismissed(true)}>Play like this anyway</button>
        </div>
      )}
    </>
  );
}
