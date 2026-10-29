import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { setLayout, useLayout } from '../game/controls';
import { LOCK_MAX, LOCK_MIN, TOUCH, lockDistOf, lockStyles, placeOf, placeStyle, useViewCtx } from '../game/touchLayout';

// "Edit button layout": a sample screen where every on-screen control can be dragged to where you want it,
// then made bigger or smaller and more or less see-through. Save keeps it; Reset all goes back to the preset.
export default function LayoutEditor({ onClose }) {
  const layout = useLayout();
  const ctx = useViewCtx(layout);
  const root = useRef(null);
  const drag = useRef(null);
  const [draft, setDraft] = useState(() => ({ ...(layout.custom || {}) }));
  const [sel, setSel] = useState(null);
  const [lock, setLock] = useState(() => lockDistOf(layout)); // how far the running lock sits from the joystick

  // what a control looks like right now, with the draft applied
  const place = (c) => placeOf({ ...layout, custom: draft }, c, ctx);
  const edit = (id, patch) => {
    const c = TOUCH.find((t) => t.id === id);
    setDraft((d) => {
      const p = placeOf({ ...layout, custom: d }, c, ctx);
      return { ...d, [id]: { x: p.x, y: p.y, s: p.s, o: p.o, ...patch } };
    });
  };

  const start = (e, c) => {
    e.preventDefault();
    e.stopPropagation();
    const r = root.current.getBoundingClientRect();
    const p = place(c);
    drag.current = { id: c.id, ox: e.clientX - (r.left + (p.x / 100) * r.width), oy: e.clientY - (r.top + (p.y / 100) * r.height) };
    setSel(c.id);
    try {
      root.current.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };
  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    const r = root.current.getBoundingClientRect();
    const x = Math.min(97, Math.max(3, ((e.clientX - d.ox - r.left) / r.width) * 100));
    const y = Math.min(97, Math.max(5, ((e.clientY - d.oy - r.top) / r.height) * 100));
    edit(d.id, { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
  };
  const stop = () => {
    drag.current = null;
  };

  const chosen = sel ? TOUCH.find((c) => c.id === sel) : null;
  const cp = chosen ? place(chosen) : null;

  return createPortal(
    <div className="layout-editor" ref={root} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onPointerDown={() => setSel(null)}>
      <div className="le-scene" aria-hidden="true">
        <span className="le-tree" style={{ left: '30%', top: '30%' }}>🌳</span>
        <span className="le-tree" style={{ left: '56%', top: '22%' }}>🏡</span>
        <span className="le-tree" style={{ left: '44%', top: '48%' }}>🧑</span>
        <span className="le-tree" style={{ left: '36%', top: '62%' }}>🌲</span>
        <div className="le-chip" style={{ left: 6, top: 6 }}>❤ 100 · ⭐ 1 ▸</div>
        <div className="le-chip" style={{ left: '50%', top: 6, transform: 'translateX(-50%)' }}>☀️ Clear · 12:00 PM</div>
        <div className="le-chip" style={{ right: 6, top: 6 }}>🪙 0 · ☰ More</div>
        <div className="le-hotbar">{Array.from({ length: 9 }, (_, i) => <i key={i}>{i + 1}</i>)}</div>
      </div>

      <div className="le-top" onPointerDown={(e) => e.stopPropagation()}>
        <b>🛠 Edit button layout</b>
        <span>Drag buttons · tap one to resize</span>
        <button type="button" className="le-btn" onClick={() => { setDraft({}); setSel(null); setLock(150); }}>Reset all</button>
        <button type="button" className="le-btn" onClick={onClose}>Cancel</button>
        <button type="button" className="le-btn go" onClick={() => { setLayout({ custom: draft, lockDist: lock }); onClose(); }}>Save</button>
      </div>

      {TOUCH.map((c) => {
        const p = place(c);
        return (
          <div key={c.id} className={`tpos le-item ${sel === c.id ? 'sel' : ''}`} style={placeStyle(p)} onPointerDown={(e) => start(e, c)}>
            {c.joystick ? (
              <div className="joystick"><i className="run-line off" style={lockStyles(lock).line} /><i className="run-lock off" style={lockStyles(lock).dot}>🏃</i><div className="joystick-knob" /></div>
            ) : (
              <div className={`tbtn ${c.cls || ''}`}>
                <span className="tbtn-icon">{c.icon}</span>
                <small>{c.text}</small>
              </div>
            )}
          </div>
        );
      })}

      {chosen && (
        <div className="le-panel" onPointerDown={(e) => e.stopPropagation()}>
          <b>{chosen.label}</b>
          <label>Size <input type="range" min="50" max="200" value={Math.round(cp.s * 100)} onChange={(e) => edit(chosen.id, { s: Number(e.target.value) / 100 })} /> <em>{Math.round(cp.s * 100)}%</em></label>
          <label>Opacity <input type="range" min="30" max="100" value={Math.round(cp.o * 100)} onChange={(e) => edit(chosen.id, { o: Number(e.target.value) / 100 })} /> <em>{Math.round(cp.o * 100)}%</em></label>
          {chosen.joystick && <label>Lock distance <input type="range" min={LOCK_MIN} max={LOCK_MAX} value={lock} onChange={(e) => setLock(Number(e.target.value))} /> <em>{lock}</em></label>}
          <button type="button" className="le-btn" onClick={() => { setDraft((d) => { const n = { ...d }; delete n[chosen.id]; return n; }); if (chosen.joystick) setLock(150); }}>Put back</button>
        </div>
      )}
    </div>,
    document.body,
  );
}
