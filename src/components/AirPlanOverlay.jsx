import { useEffect, useRef, useState } from 'react';

// Planning a carpet bombing run on the game screen itself: the shop is closed, the shelter is in the middle of a ring, and you drag the
// start (A) and the end (B) of the run round it. The bomber flies the straight line between them. Esc cancels.
const TAU = Math.PI * 2;

export default function AirPlanOverlay({ view, cost, onConfirm, onCancel }) {
  const [a0, setA0] = useState(Math.PI / 2);
  const [a1, setA1] = useState(-Math.PI / 2);
  const [drag, setDrag] = useState(null); // 'a' | 'b'
  const box = useRef(null);
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    const key = (e) => e.code === 'Escape' && onCancel();
    window.addEventListener('resize', on);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('keydown', key);
    };
  }, [onCancel]);
  const cx = view.fx * size.w;
  const cy = view.fy * size.h;
  const R = view.fr * size.w;
  const pt = (a) => [cx + Math.cos(a) * R, cy + Math.sin(a) * R];
  const [ax, ay] = pt(a0);
  const [bx, by] = pt(a1);
  const move = (e) => {
    if (!drag) return;
    const a = Math.atan2(e.clientY - cy, e.clientX - cx);
    // (the handle snaps to the nearest 15 degrees, so a straight line across is easy to make)
    const snapped = Math.round(a / (TAU / 24)) * (TAU / 24);
    if (drag === 'a') setA0(snapped);
    else setA1(snapped);
  };
  const labels = [['N', -Math.PI / 2], ['E', 0], ['S', Math.PI / 2], ['W', Math.PI]];
  return (
    <div className="air-plan" ref={box} onPointerMove={move} onPointerUp={() => setDrag(null)} onPointerLeave={() => setDrag(null)} role="dialog" aria-label="Plan the bombing run">
      <svg width={size.w} height={size.h} className="air-plan-svg">
        <circle cx={cx} cy={cy} r={R} fill="rgba(20,30,20,0.18)" stroke="rgba(255,255,255,0.7)" strokeWidth="3" strokeDasharray="10 8" />
        <circle cx={cx} cy={cy} r="6" fill="#fff" />
        <line x1={ax} y1={ay} x2={bx} y2={by} stroke="#ff5a6a" strokeWidth="26" strokeOpacity="0.2" strokeLinecap="round" />
        <line x1={ax} y1={ay} x2={bx} y2={by} stroke="#ff5a6a" strokeWidth="4" strokeDasharray="14 9" />
        {labels.map(([t, a]) => <text key={t} x={cx + Math.cos(a) * (R + 22)} y={cy + Math.sin(a) * (R + 22) + 6} textAnchor="middle" fontSize="16" fontWeight="800" fill="#fff" stroke="#000" strokeWidth="0.6">{t}</text>)}
        <g style={{ cursor: 'grab' }} onPointerDown={(e) => { e.preventDefault(); setDrag('a'); }}>
          <circle cx={ax} cy={ay} r="20" fill="#3fae5c" stroke="#fff" strokeWidth="4" />
          <text x={ax} y={ay + 6} textAnchor="middle" fontSize="18" fontWeight="800" fill="#fff" pointerEvents="none">A</text>
        </g>
        <g style={{ cursor: 'grab' }} onPointerDown={(e) => { e.preventDefault(); setDrag('b'); }}>
          <circle cx={bx} cy={by} r="20" fill="#e8506a" stroke="#fff" strokeWidth="4" />
          <text x={bx} y={by + 6} textAnchor="middle" fontSize="18" fontWeight="800" fill="#fff" pointerEvents="none">B</text>
        </g>
      </svg>
      <div className="air-plan-bar panel small">
        <b>💣 Plan the bombing run</b>
        <small>Drag <b style={{ color: '#3fae5c' }}>A</b> (where the bomber comes in) and <b style={{ color: '#e8506a' }}>B</b> (where it leaves) round the shelter.</small>
        <div className="air-plan-btns">
          <button type="button" className="btn small-btn" onClick={() => { const a = Math.random() * TAU; setA0(a); setA1(a + Math.PI); }}>🎲 Random</button>
          <button type="button" className="btn small-btn" onClick={() => setA1(a0 + Math.PI)}>↔ Straight across</button>
          <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn go" onClick={() => onConfirm({ a0, a1 })}>Call it in · 🪙 {cost}</button>
        </div>
      </div>
    </div>
  );
}
