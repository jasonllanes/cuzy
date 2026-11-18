import { useEffect, useMemo, useRef, useState } from 'react';
import { TASK_NAMES } from '../game/dod';

// The tasks of Do or Die: small games in a window (like the ones in Among Us). Finish one and it counts for everybody.
// Each game gets a seed so the same station always makes the same puzzle. Esc closes the window (the task stays undone).
function rngOf(seed) {
  let s = (seed % 2147483647) + 1;
  return () => {
    s = (s * 48271) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const COLORS = ['#e8506a', '#3f8cf0', '#f2c230', '#3fae5c', '#b46cf0', '#f08a3a'];

// 1. wires: join each colour on the left to the same colour on the right
function Wires({ seed, onDone }) {
  const rnd = useMemo(() => rngOf(seed), [seed]);
  const cols = useMemo(() => COLORS.slice(0, 4), []);
  const right = useMemo(() => {
    const a = [0, 1, 2, 3];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }, [rnd]);
  const [sel, setSel] = useState(null);
  const [made, setMade] = useState({}); // left index -> right slot
  const [bad, setBad] = useState(false);
  const pick = (side, i) => {
    if (side === 'l') {
      if (made[i] !== undefined) return;
      setSel(i);
    } else if (sel !== null) {
      if (Object.values(made).includes(i)) return;
      if (right[i] === sel) {
        const next = { ...made, [sel]: i };
        setMade(next);
        setSel(null);
        if (Object.keys(next).length === 4) setTimeout(onDone, 350);
      } else {
        setBad(true);
        setSel(null);
        setTimeout(() => setBad(false), 350);
      }
    }
  };
  const ly = (i) => 30 + i * 52;
  return (
    <div className="dt-wires">
      <p>Join the matching colours. Click a plug on the left, then its twin on the right.</p>
      <svg width="320" height="230" className={bad ? 'bad' : ''}>
        {Object.entries(made).map(([l, r]) => (
          <line key={l} x1="40" y1={ly(Number(l))} x2="280" y2={ly(r)} stroke={cols[l]} strokeWidth="7" strokeLinecap="round" />
        ))}
        {cols.map((c, i) => (
          <g key={`l${i}`} onClick={() => pick('l', i)} style={{ cursor: 'pointer' }}>
            <rect x="14" y={ly(i) - 14} width="26" height="28" rx="5" fill={c} stroke={sel === i ? '#fff' : '#222'} strokeWidth={sel === i ? 4 : 2} />
          </g>
        ))}
        {right.map((ci, i) => (
          <g key={`r${i}`} onClick={() => pick('r', i)} style={{ cursor: 'pointer' }}>
            <rect x="280" y={ly(i) - 14} width="26" height="28" rx="5" fill={cols[ci]} stroke="#222" strokeWidth="2" />
          </g>
        ))}
      </svg>
    </div>
  );
}

// 2. maths: three sums in a row
function MathLock({ seed, onDone }) {
  const rnd = useMemo(() => rngOf(seed), [seed]);
  const sums = useMemo(
    () =>
      Array.from({ length: 3 }, () => {
        const a = 2 + Math.floor(rnd() * 12);
        const b = 2 + Math.floor(rnd() * 9);
        const op = ['+', '-', '×'][Math.floor(rnd() * 3)];
        return { text: `${op === '-' ? Math.max(a, b) : a} ${op} ${op === '-' ? Math.min(a, b) : b}`, ans: op === '+' ? a + b : op === '-' ? Math.abs(a - b) : a * b };
      }),
    [rnd],
  );
  const [i, setI] = useState(0);
  const [val, setVal] = useState('');
  const [bad, setBad] = useState(false);
  const submit = () => {
    if (Number(val) === sums[i].ans && val !== '') {
      if (i === 2) onDone();
      else {
        setI(i + 1);
        setVal('');
      }
    } else {
      setBad(true);
      setVal('');
      setTimeout(() => setBad(false), 350);
    }
  };
  return (
    <div className="dt-math">
      <p>Three sums to open the lock ({i + 1}/3).</p>
      <div className={`dt-sum ${bad ? 'bad' : ''}`}>{sums[i].text} = <b>{val || '?'}</b></div>
      <div className="dt-pad">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => <button key={n} type="button" onClick={() => setVal((v) => (v + n).slice(0, 3))}>{n}</button>)}
        <button type="button" onClick={() => setVal('')}>⌫</button>
        <button type="button" className="go" onClick={submit}>OK</button>
      </div>
    </div>
  );
}

// 3. colours: watch the lights, then repeat them
function Colors({ seed, onDone }) {
  const rnd = useMemo(() => rngOf(seed), [seed]);
  const seq = useMemo(() => Array.from({ length: 5 }, () => Math.floor(rnd() * 4)), [rnd]);
  const [shown, setShown] = useState(0); // how many of the sequence are lit so far (while it plays)
  const [lit, setLit] = useState(-1);
  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [bad, setBad] = useState(false);
  const round = useRef(2); // the sequence grows: 2, 3, 4, 5
  const play = (n) => {
    setPlaying(true);
    setPos(0);
    let k = 0;
    const step = () => {
      if (k >= n) {
        setLit(-1);
        setPlaying(false);
        return;
      }
      setLit(seq[k]);
      setTimeout(() => {
        setLit(-1);
        k++;
        setTimeout(step, 220);
      }, 520);
    };
    setTimeout(step, 500);
    setShown(n);
  };
  useEffect(() => {
    play(round.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const tap = (c) => {
    if (playing) return;
    setLit(c);
    setTimeout(() => setLit(-1), 160);
    if (c !== seq[pos]) {
      setBad(true);
      setTimeout(() => setBad(false), 400);
      play(round.current);
      return;
    }
    if (pos + 1 === shown) {
      if (shown === 5) onDone();
      else {
        round.current = shown + 1;
        play(round.current);
      }
    } else setPos(pos + 1);
  };
  const pads = ['#e8506a', '#3f8cf0', '#f2c230', '#3fae5c'];
  return (
    <div className="dt-colors">
      <p>{playing ? 'Watch the lights…' : `Repeat them (${shown}/5)`}</p>
      <div className={`dt-simon ${bad ? 'bad' : ''}`}>
        {pads.map((c, i) => <button key={c} type="button" style={{ background: c, opacity: lit === i ? 1 : 0.45, transform: lit === i ? 'scale(1.06)' : 'none' }} onClick={() => tap(i)} />)}
      </div>
    </div>
  );
}

// 4. ricochet: aim a shot that bounces off the walls and hits the target (5 shots)
function Ricochet({ seed, onDone }) {
  const cv = useRef(null);
  const rnd = useMemo(() => rngOf(seed), [seed]);
  const W = 340;
  const H = 230;
  const world = useMemo(() => ({ tx: 50 + rnd() * (W - 100), ty: 25 + rnd() * 60, wall: { x: 70 + rnd() * 120, y: 105 + rnd() * 30, w: 90, h: 9 }, ball: null, shots: 5, aim: -Math.PI / 2, done: false }), [rnd]);
  const [shots, setShots] = useState(5);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    const c = cv.current;
    const g = c.getContext('2d');
    let raf = 0;
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.03, (now - last) / 1000);
      last = now;
      const w = world;
      g.fillStyle = '#1d2233';
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#4a556f';
      g.fillRect(w.wall.x, w.wall.y, w.wall.w, w.wall.h);
      g.strokeStyle = '#7f8ba8';
      g.strokeRect(1, 1, W - 2, H - 2);
      g.fillStyle = '#e8506a';
      g.beginPath();
      g.arc(w.tx, w.ty, 14, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(w.tx, w.ty, 7, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#e8c96a';
      g.beginPath();
      g.arc(W / 2, H - 12, 9, 0, Math.PI * 2);
      g.fill();
      if (!w.ball) {
        g.strokeStyle = 'rgba(255,255,255,0.6)';
        g.setLineDash([5, 5]);
        g.beginPath();
        g.moveTo(W / 2, H - 12);
        g.lineTo(W / 2 + Math.cos(w.aim) * 60, H - 12 + Math.sin(w.aim) * 60);
        g.stroke();
        g.setLineDash([]);
      } else {
        const b = w.ball;
        for (let s = 0; s < 3; s++) {
          b.x += b.vx * dt / 3;
          b.y += b.vy * dt / 3;
          if (b.x < 5 || b.x > W - 5) {
            b.vx *= -1;
            b.bounces++;
            b.x = Math.max(5, Math.min(W - 5, b.x));
          }
          if (b.y < 5) {
            b.vy *= -1;
            b.bounces++;
            b.y = 5;
          }
          if (b.x > w.wall.x - 4 && b.x < w.wall.x + w.wall.w + 4 && b.y > w.wall.y - 4 && b.y < w.wall.y + w.wall.h + 4) {
            b.vy *= -1;
            b.bounces++;
            b.y += b.vy * dt / 3 * 2;
          }
        }
        g.fillStyle = '#fff';
        g.beginPath();
        g.arc(b.x, b.y, 5, 0, Math.PI * 2);
        g.fill();
        if (Math.hypot(b.x - w.tx, b.y - w.ty) < 17 && !w.done) {
          w.done = true;
          setTimeout(onDone, 300);
        } else if (b.y > H || b.bounces > 6) w.ball = null;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [world, onDone]);
  const move = (e) => {
    const r = cv.current.getBoundingClientRect();
    world.aim = Math.min(-0.15, Math.max(Math.PI * -0.85, Math.atan2(e.clientY - r.top - (H - 12), e.clientX - r.left - W / 2)));
  };
  const fire = (e) => {
    move(e);
    if (world.ball || world.done) return;
    if (world.shots <= 0) return;
    world.shots--;
    setShots(world.shots);
    world.ball = { x: W / 2, y: H - 12, vx: Math.cos(world.aim) * 300, vy: Math.sin(world.aim) * 300, bounces: 0 };
    if (world.shots === 0) setMsg('Out of shots: close the window and try again.');
  };
  return (
    <div className="dt-ricochet">
      <p>Aim and click: bank the shot off the walls into the red target. Shots left: <b>{shots}</b></p>
      <canvas ref={cv} width={W} height={H} onMouseMove={move} onClick={fire} />
      {msg && <small>{msg}</small>}
    </div>
  );
}

// 5. switches: turn every light on (pressing one flips its neighbours too)
function Switches({ seed, onDone }) {
  const rnd = useMemo(() => rngOf(seed), [seed]);
  const start = useMemo(() => {
    const g = Array(9).fill(true);
    const flip = (a, i) => {
      const x = i % 3;
      const y = Math.floor(i / 3);
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < 3 && ny >= 0 && ny < 3) a[ny * 3 + nx] = !a[ny * 3 + nx];
      }
    };
    for (let k = 0; k < 5; k++) flip(g, Math.floor(rnd() * 9));
    if (g.every(Boolean)) flip(g, 4);
    return g;
  }, [rnd]);
  const [g, setG] = useState(start);
  const press = (i) => {
    const n = [...g];
    const x = i % 3;
    const y = Math.floor(i / 3);
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < 3 && ny >= 0 && ny < 3) n[ny * 3 + nx] = !n[ny * 3 + nx];
    }
    setG(n);
    if (n.every(Boolean)) setTimeout(onDone, 300);
  };
  return (
    <div className="dt-switches">
      <p>Switch them all on. Each switch flips its neighbours too.</p>
      <div className="dt-grid">
        {g.map((on, i) => <button key={i} type="button" className={on ? 'on' : ''} onClick={() => press(i)}>{on ? '💡' : '⚫'}</button>)}
      </div>
    </div>
  );
}

// 6. engine: press START when the marker is in the green (3 times)
function Engine({ seed, onDone }) {
  const rnd = useMemo(() => rngOf(seed), [seed]);
  const zone = useMemo(() => 0.2 + rnd() * 0.5, [rnd]);
  const [x, setX] = useState(0);
  const [ok, setOk] = useState(0);
  const [flash, setFlash] = useState('');
  const st = useRef({ x: 0, dir: 1, sp: 0.9 });
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      const s = st.current;
      s.x += s.dir * s.sp * dt;
      if (s.x > 1) {
        s.x = 1;
        s.dir = -1;
      } else if (s.x < 0) {
        s.x = 0;
        s.dir = 1;
      }
      setX(s.x);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const crank = () => {
    const hit = x >= zone && x <= zone + 0.16;
    setFlash(hit ? 'ok' : 'bad');
    setTimeout(() => setFlash(''), 300);
    if (hit) {
      const n = ok + 1;
      setOk(n);
      st.current.sp += 0.35;
      if (n >= 3) setTimeout(onDone, 350);
    } else setOk(0);
  };
  return (
    <div className="dt-engine">
      <p>Turn the key when the needle is in the green. Three in a row ({ok}/3).</p>
      <div className={`dt-gauge ${flash}`}>
        <i className="zone" style={{ left: `${zone * 100}%`, width: '16%' }} />
        <i className="needle" style={{ left: `${x * 100}%` }} />
      </div>
      <button type="button" className="btn go" onClick={crank}>🔑 START</button>
    </div>
  );
}

const GAMES = { wires: Wires, math: MathLock, colors: Colors, ricochet: Ricochet, switches: Switches, engine: Engine };

export default function DodTasks({ task, onDone, onClose }) {
  useEffect(() => {
    const key = (e) => {
      if (e.code === 'Escape') {
        e.stopImmediatePropagation();
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [onClose]);
  const Game = GAMES[task.type] || Switches;
  return (
    <div className="dt-overlay" onMouseDown={(e) => e.stopPropagation()}>
      <div className="dt-card panel">
        <header>
          <b>{TASK_NAMES[task.type]}</b>
          <button type="button" className="btn small-btn" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <Game key={task.i} seed={task.seed} onDone={() => onDone()} />
        <small className="dt-note">You stand still while you work. The Werebear can still find you.</small>
      </div>
    </div>
  );
}
