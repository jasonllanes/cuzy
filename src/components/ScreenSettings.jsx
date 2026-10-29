import { useEffect, useState } from 'react';
import { enterMobileScreen, setControls, useControls } from '../game/controls';

// Desktop or Mobile controls, and fullscreen. (These used to be a button in the corner of the screen.)
export default function ScreenSettings() {
  const controls = useControls();
  const [full, setFull] = useState(!!document.fullscreenElement);
  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else if (controls === 'mobile') enterMobileScreen();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };
  return (
    <div className="screen-settings">
      <div className="seg" role="radiogroup" aria-label="Controls">
        <button type="button" role="radio" aria-checked={controls === 'desktop'} className={controls === 'desktop' ? 'on' : ''} onClick={() => setControls('desktop')}>🖥️ Desktop</button>
        <button type="button" role="radio" aria-checked={controls === 'mobile'} className={controls === 'mobile' ? 'on' : ''} onClick={() => setControls('mobile')}>📱 Mobile</button>
      </div>
      <button type="button" className="btn small-btn" onClick={toggleFull}>{full ? '🗗 Leave fullscreen' : '⛶ Fullscreen'}</button>
      <p className="hint">Mobile shows a joystick and buttons (and goes fullscreen, landscape). Desktop uses the keyboard and mouse.</p>
    </div>
  );
}
