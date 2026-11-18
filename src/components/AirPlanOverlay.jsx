import { useEffect, useRef, useState } from 'react';

// Planning a carpet bombing run on the game screen itself: the shop is closed and you DRAW the run: press where it should start, drag
// to where it should go and let go. The bomber flies that line in that direction (left to right if you drag left to right), right across
// the ring round the shelter. You have 3 seconds: when the time is up it drops by itself (on your line if you were drawing, else at random).
// The Random button picks a run at once. Esc cancels.
const PLAN_TIME = 3;
const MIN_DRAG = 40;

// the straight line through s and e, cut by the ring: where the bomber comes in (a) and leaves (b), as angles round the centre
function chord(s, e, cx, cy, R) {
  const len = Math.hypot(e[0] - s[0], e[1] - s[1]);
  if (len < MIN_DRAG) return null;
  const d = [(e[0] - s[0]) / len, (e[1] - s[1]) / len];
  const n = [-d[1], d[0]];
  const h = (s[0] - cx) * n[0] + (s[1] - cy) * n[1];
  const hc = Math.max(-0.88 * R, Math.min(0.88 * R, h)); // (a line far off to the side is pulled in until it crosses the ring)
  const p = [s[0] + (hc - h) * n[0], s[1] + (hc - h) * n[1]];
  const along = (p[0] - cx) * d[0] + (p[1] - cy) * d[1];
  const half = Math.sqrt(Math.max(0, R * R - hc * hc));
  const A = [p[0] + (-along - half) * d[0], p[1] + (-along - half) * d[1]];
  const B = [p[0] + (-along + half) * d[0], p[1] + (-along + half) * d[1]];
  return { A, B, a0: Math.atan2(A[1] - cy, A[0] - cx), a1: Math.atan2(B[1] - cy, B[0] - cx) };
}

export default function AirPlanOverlay({ view, cost, onConfirm, onCancel }) {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [left, setLeft] = useState(PLAN_TIME);
  const done = useRef(false);
  const st = useRef({});
  const cx = view.fx * size.w;
  const cy = view.fy * size.h;
  const R = view.fr * size.w;
  const line = from && to ? chord(from, to, cx, cy, R) : null;
  st.current = { line, onConfirm, onCancel };

  const finish = (route) => {
    if (done.current) return;
    done.current = true;
    st.current.onConfirm(route);
  };

  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    const key = (e) => {
      if (e.code === 'Escape') {
        e.stopImmediatePropagation();
        st.current.onCancel();
      }
    };
    window.addEventListener('resize', on);
    window.addEventListener('keydown', key, true);
    const t0 = performance.now();
    const timer = setInterval(() => {
      const rest = PLAN_TIME - (performance.now() - t0) / 1000;
      setLeft(Math.max(0, rest));
      if (rest <= 0) {
        clearInterval(timer);
        const l = st.current.line;
        finish(l ? { a0: l.a0, a1: l.a1 } : null); // (out of time: your line if you had drawn one, else anywhere)
      }
    }, 50);
    return () => {
      clearInterval(timer);
      window.removeEventListener('resize', on);
      window.removeEventListener('keydown', key, true);
    };
  }, []); // (once: the countdown must not restart when the screen redraws)

  const down = (e) => {
    e.preventDefault();
    setFrom([e.clientX, e.clientY]);
    setTo([e.clientX, e.clientY]);
  };
  const move = (e) => {
    if (from) setTo([e.clientX, e.clientY]);
  };
  const up = () => {
    if (!from) return;
    if (line) finish({ a0: line.a0, a1: line.a1 });
    else {
      setFrom(null);
      setTo(null);
    }
  };

  // the arrow head at the far end of the drawn run
  let head = null;
  if (line) {
    const ang = Math.atan2(line.B[1] - line.A[1], line.B[0] - line.A[0]);
    const [x, y] = line.B;
    head = `${x},${y} ${x - Math.cos(ang - 0.45) * 30},${y - Math.sin(ang - 0.45) * 30} ${x - Math.cos(ang + 0.45) * 30},${y - Math.sin(ang + 0.45) * 30}`;
  }
  return (
    <div className="air-plan" onPointerDown={down} onPointerMove={move} onPointerUp={up} role="dialog" aria-label="Draw the bombing run">
      <svg width={size.w} height={size.h} className="air-plan-svg">
        <circle cx={cx} cy={cy} r={R} fill="rgba(20,30,20,0.18)" stroke="rgba(255,255,255,0.7)" strokeWidth="3" strokeDasharray="10 8" />
        <circle cx={cx} cy={cy} r="6" fill="#fff" />
        {from && to && !line && <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke="rgba(255,255,255,0.7)" strokeWidth="3" strokeDasharray="6 6" />}
        {line && (
          <>
            <line x1={line.A[0]} y1={line.A[1]} x2={line.B[0]} y2={line.B[1]} stroke="#ff5a6a" strokeWidth="26" strokeOpacity="0.22" strokeLinecap="round" />
            <line x1={line.A[0]} y1={line.A[1]} x2={line.B[0]} y2={line.B[1]} stroke="#ff5a6a" strokeWidth="4" strokeDasharray="14 9" />
            <circle cx={line.A[0]} cy={line.A[1]} r="9" fill="#3fae5c" stroke="#fff" strokeWidth="3" />
            <polygon points={head} fill="#ff5a6a" stroke="#fff" strokeWidth="2" />
          </>
        )}
      </svg>
      <div className="air-plan-bar panel small" onPointerDown={(e) => e.stopPropagation()}>
        <b>💣 Draw the bombing run</b>
        <small>Press where it starts, drag the way it should fly and let go: it flies that way across the map.</small>
        <div className="air-plan-time"><i style={{ width: `${(left / PLAN_TIME) * 100}%` }} /></div>
        <small>{left.toFixed(1)}s, then it drops {line ? 'on your line' : 'by itself'}</small>
        <div className="air-plan-btns">
          <button type="button" className="btn go small-btn" onClick={() => finish(null)}>🎲 Random · 🪙 {cost}</button>
          <button type="button" className="btn ghost small-btn" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
