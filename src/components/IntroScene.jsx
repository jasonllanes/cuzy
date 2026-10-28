import { useEffect, useRef, useState } from 'react';
import '../intro.css';

// The opening scene: you arrive by plane (Free Roam, Wave Defense) or by car (Survival) while a little bot
// narrates. It plays on its own, with no buttons to press; Skip (or Esc) ends it early.

const CHAR_TIME = 0.03; // seconds per typed letter
const HOLD = 1.5; // how long a finished line stays up
const TAIL = 0.8; // quiet moment before the scene ends

function script(kind, name, fight) {
  if (kind === 'survival') {
    return {
      bot: '🚗 Driver Rusty-Bot',
      lines: [
        `Wake up, ${name}. Driver Rusty-Bot here. The radio went quiet an hour ago.`,
        'See that wrecked bus up ahead? That is home base now.',
        'Ten waves of the dead are coming, with something big at the very end.',
        'Scavenge walls, hire survivors and keep that bus standing.',
        'Hold on tight, we are pulling in!',
      ],
    };
  }
  if (kind === 'waves') {
    return {
      bot: '✈️ Captain Biscuit-Bot',
      lines: [
        `Good morning, ${name}! Captain Biscuit-Bot here, flying you in.`,
        'Monsters have been spotted around the old house in the meadow.',
        'Raise barricades, hire helpers and hold it through ten waves.',
        `Buckle up, ${name}. Touching down now!`,
      ],
    };
  }
  return {
    bot: '✈️ Captain Biscuit-Bot',
    lines: [
      `Good morning, ${name}! Captain Biscuit-Bot here, flying you in.`,
      'Below us is a cozy meadow, grown from a single little seed.',
      'Forage, make friends with the chickens and stay clear of the skeleton camps.',
      fight ? 'Other travellers down there can be a little competitive. Keep your sword handy.' : 'Take your time. There is no rush in the meadow.',
      `Buckle up, ${name}. Touching down now!`,
    ],
  };
}

function Plane() {
  return (
    <svg className="intro-plane" viewBox="0 0 120 50" shapeRendering="crispEdges" aria-hidden="true">
      <rect x="14" y="22" width="84" height="12" rx="5" fill="#f6f2ea" />
      <rect x="96" y="25" width="14" height="6" rx="3" fill="#f6f2ea" />
      <rect x="14" y="30" width="84" height="4" fill="#d9d2c4" />
      <rect x="4" y="10" width="12" height="16" fill="#e8647c" />
      <rect x="6" y="22" width="14" height="6" fill="#f6f2ea" />
      <rect x="42" y="30" width="38" height="8" fill="#c9c1b2" />
      <rect x="46" y="34" width="30" height="6" fill="#e8647c" />
      {[28, 38, 48, 58, 68, 78].map((x) => <rect key={x} x={x} y="25" width="5" height="4" fill="#79c4ec" />)}
      <rect x="88" y="24" width="9" height="5" fill="#79c4ec" />
    </svg>
  );
}

function Car() {
  return (
    <svg className="intro-car" viewBox="0 0 120 56" shapeRendering="crispEdges" aria-hidden="true">
      <rect x="6" y="22" width="108" height="20" rx="3" fill="#5b6b5a" />
      <rect x="26" y="8" width="62" height="18" rx="3" fill="#4a584a" />
      <rect x="31" y="12" width="24" height="12" fill="#a9d4e0" />
      <rect x="59" y="12" width="24" height="12" fill="#a9d4e0" />
      <rect x="6" y="30" width="108" height="4" fill="#3d493d" />
      <rect x="108" y="26" width="8" height="6" fill="#ffe9a0" />
      <rect x="4" y="26" width="5" height="6" fill="#e0384a" />
      <rect x="14" y="4" width="70" height="3" fill="#2f372f" />
      <circle className="intro-wheel" cx="30" cy="44" r="9" fill="#262b26" />
      <circle className="intro-wheel" cx="92" cy="44" r="9" fill="#262b26" />
      <circle cx="30" cy="44" r="4" fill="#9aa39a" />
      <circle cx="92" cy="44" r="4" fill="#9aa39a" />
    </svg>
  );
}

export default function IntroScene({ kind, name, fight, onDone }) {
  const { bot, lines } = useRef(script(kind, name, fight)).current;
  // when each line starts, and the whole thing's length
  const plan = useRef(null);
  if (!plan.current) {
    let at = 0;
    const starts = lines.map((l) => {
      const s = at;
      at += l.length * CHAR_TIME + HOLD;
      return s;
    });
    plan.current = { starts, total: at + TAIL };
  }
  const { starts, total } = plan.current;
  const [t, setT] = useState(0);
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };

  useEffect(() => {
    const t0 = performance.now();
    const id = setInterval(() => {
      const now = (performance.now() - t0) / 1000;
      setT(now);
      if (now >= total) finish();
    }, 40);
    const onKey = (e) => {
      if (e.code === 'Escape' || e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        finish();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearInterval(id);
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  let idx = 0;
  starts.forEach((s, i) => {
    if (t >= s) idx = i;
  });
  const typed = Math.min(lines[idx].length, Math.floor((t - starts[idx]) / CHAR_TIME));
  const arriving = t > total - 3.2; // the ground rises / the bus appears for the last few seconds

  return (
    <div className={`intro ${kind === 'survival' ? 'night' : 'sky'} ${arriving ? 'arriving' : ''}`} role="presentation">
      <div className="intro-bg" />
      {kind === 'survival' ? (
        <>
          <div className="intro-moon" />
          <div className="intro-trees far" />
          <div className="intro-trees near" />
          <div className="intro-road"><i /></div>
          <div className="intro-bus" />
          <div className="intro-vehicle"><Car /><span className="intro-beam" /></div>
        </>
      ) : (
        <>
          <div className="intro-cloud a" />
          <div className="intro-cloud b" />
          <div className="intro-cloud c" />
          <div className="intro-cloud d" />
          <div className="intro-vehicle"><Plane /></div>
          <div className="intro-ground" />
        </>
      )}

      <div className="intro-talk panel">
        <div className="intro-bot">{bot}</div>
        <p>{lines[idx].slice(0, typed)}<span className="intro-caret">▍</span></p>
      </div>
      <button type="button" className="intro-skip btn small-btn" onClick={finish}>Skip ⏭</button>
    </div>
  );
}
