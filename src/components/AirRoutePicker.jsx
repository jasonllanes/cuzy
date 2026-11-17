import { useState } from 'react';

// Plan a carpet bombing run: the shelter is the middle of the circle. Press a spot on the ring for where the bomber comes in,
// then another for where it flies out; it drops bombs all along the line between them.
const SPOTS = 24;
const SIZE = 300;
const C = SIZE / 2;
const RING = 118;
const pt = (a) => [C + Math.cos(a) * RING, C + Math.sin(a) * RING];
const COMPASS = [['N', -Math.PI / 2], ['E', 0], ['S', Math.PI / 2], ['W', Math.PI]];

export default function AirRoutePicker({ cost, onConfirm, onCancel }) {
  const [a0, setA0] = useState(null);
  const [a1, setA1] = useState(null);
  const click = (a) => {
    if (a0 === null || a1 !== null) {
      setA0(a);
      setA1(null);
    } else setA1(a);
  };
  const [x0, y0] = a0 === null ? [0, 0] : pt(a0);
  const [x1, y1] = a1 === null ? [0, 0] : pt(a1);
  return (
    <div className="overlay air-route" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="panel small air-route-card">
        <header className="inv-head">
          <h2>💣 Plan the bombing run</h2>
          <button className="btn small-btn" onClick={onCancel} aria-label="Close">✕</button>
        </header>
        <p className="hint">{a0 === null ? 'Press the ring where the bomber should start.' : a1 === null ? 'Now press where it should end.' : 'Press the ring again to pick a new start.'} The shelter 🏠 is in the middle, north is up.</p>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} className="air-route-map" role="img" aria-label="Bombing run map">
          <circle cx={C} cy={C} r={RING + 14} fill="rgba(120,160,90,0.18)" stroke="#8a7a5a" strokeDasharray="4 4" />
          <circle cx={C} cy={C} r={RING} fill="none" stroke="#6b5a3a" strokeWidth="2" />
          {COMPASS.map(([t, a]) => (
            <text key={t} x={C + Math.cos(a) * (RING + 28)} y={C + Math.sin(a) * (RING + 28) + 5} textAnchor="middle" fontSize="13" fontWeight="800" fill="#5a4a2a">{t}</text>
          ))}
          {a0 !== null && a1 !== null && (
            <>
              <line x1={x0} y1={y0} x2={x1} y2={y1} stroke="#e8506a" strokeWidth="14" strokeOpacity="0.22" strokeLinecap="round" />
              <line x1={x0} y1={y0} x2={x1} y2={y1} stroke="#e8506a" strokeWidth="3" strokeDasharray="8 5" />
              <circle cx={x1} cy={y1} r="9" fill="#e8506a" />
            </>
          )}
          <text x={C} y={C + 8} textAnchor="middle" fontSize="22">🏠</text>
          {Array.from({ length: SPOTS }, (_, i) => {
            const a = (i / SPOTS) * Math.PI * 2;
            const [x, y] = pt(a);
            const on = a0 === a ? 'start' : a1 === a ? 'end' : '';
            return (
              <circle key={i} cx={x} cy={y} r={on ? 9 : 7} className={`air-spot ${on}`} fill={on === 'start' ? '#3fae5c' : on === 'end' ? '#e8506a' : '#fff'} stroke="#6b5a3a" strokeWidth="2" onClick={() => click(a)} style={{ cursor: 'pointer' }} />
            );
          })}
          {a0 !== null && <text x={x0} y={y0 + 4} textAnchor="middle" fontSize="10" fontWeight="800" fill="#fff" pointerEvents="none">A</text>}
          {a1 !== null && <text x={x1} y={y1 + 4} textAnchor="middle" fontSize="10" fontWeight="800" fill="#fff" pointerEvents="none">B</text>}
        </svg>
        <div className="air-route-btns">
          <button className="btn small-btn" onClick={() => { const a = Math.floor(Math.random() * SPOTS); setA0((a / SPOTS) * Math.PI * 2); setA1((((a + SPOTS / 2) % SPOTS) / SPOTS) * Math.PI * 2); }}>🎲 Random run</button>
          <button className="btn small-btn" disabled={a0 === null} onClick={() => setA1(a0 + Math.PI)}>↔ Straight across</button>
          <button className="btn ghost small-btn" onClick={onCancel}>Cancel</button>
          <button className="btn go" disabled={a0 === null || a1 === null} onClick={() => onConfirm({ a0, a1 })}>Call it in · 🪙 {cost}</button>
        </div>
      </div>
    </div>
  );
}
