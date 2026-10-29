import { useState } from 'react';
import { resetLayout, setLayout, useLayout } from '../game/controls';
import LayoutEditor from './LayoutEditor';

const Seg = ({ label, value, options, onPick }) => (
  <div className="layout-row">
    <span>{label}</span>
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => onPick(v)}>{text}</button>
      ))}
    </div>
  </div>
);

// Where the mobile buttons go and how big everything is. These are saved on this device.
export default function ControlsLayout() {
  const l = useLayout();
  const [editing, setEditing] = useState(false);
  return (
    <div className="controls-layout">
      <button type="button" className="btn go small-btn" onClick={() => setEditing(true)}>🛠 Edit button layout</button>
      {editing && <LayoutEditor onClose={() => setEditing(false)} />}
      <p className="hint">Move and resize every button yourself on a sample screen{Object.keys(l.custom || {}).length ? ` (${Object.keys(l.custom).length} placed by hand)` : ''}.</p>
      <Seg label="Hand" value={l.hand} options={[['right', '🤚 Right-handed'], ['left', '✋ Left-handed']]} onPick={(hand) => setLayout({ hand })} />
      <Seg label="Button size" value={l.buttons} options={[['s', 'Small'], ['m', 'Medium'], ['l', 'Large']]} onPick={(buttons) => setLayout({ buttons })} />
      <Seg label="Screen items" value={l.screen} options={[['s', 'Small'], ['m', 'Medium'], ['l', 'Large']]} onPick={(screen) => setLayout({ screen })} />
      <button type="button" className="btn ghost small-btn" onClick={resetLayout}>Reset to the default layout</button>
      <p className="hint">Right-handed puts the joystick on the left and the action buttons on the right. Left-handed swaps them. Used in Mobile mode.</p>
    </div>
  );
}
