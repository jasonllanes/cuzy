import { useEffect, useRef, useState } from 'react';
import '../intro.css';
import Avatar from './Avatar';

// The opening story. It happens on the real map: your hero walks to the house (or the shelter) by itself while a voice on the
// radio talks. This is only the caption box; the walking is the game's (see Game.startCutscene). It plays on its own, with
// no buttons to press; Skip (or Esc) ends it early.

const CHAR_TIME = 0.03; // seconds per typed letter
const HOLD = 1.3; // how long a finished line stays up
const TAIL = 0.8; // quiet moment before the scene ends

function script(kind, name, fight) {
  if (kind === 'survival') {
    return {
      bot: '📻 The radio',
      lines: [
        `Wake up, ${name}. The radio went quiet an hour ago.`,
        'That container shelter up ahead is home base now. Get inside.',
        'The dead are coming, wave after wave, with something big among them.',
        'Scavenge walls, hire survivors and keep that shelter standing.',
      ],
    };
  }
  if (kind === 'waves') {
    return {
      bot: '📻 Biscuit-Bot (radio)',
      lines: [
        `Good morning, ${name}! You made it to the meadow. That little house is yours.`,
        'Go on in and make yourself at home.',
        'Monsters have been spotted around here. Raise barricades, hire helpers and hold ten waves.',
        `Good luck, ${name}!`,
      ],
    };
  }
  return {
    bot: '📻 Biscuit-Bot (radio)',
    lines: [
      `Good morning, ${name}! You made it to the meadow. That little house is yours.`,
      'Go on in and make yourself at home.',
      'Forage, make friends with the chickens and stay clear of the skeleton camps.',
      fight ? 'Other travellers can be a little competitive. Keep your sword handy.' : 'Take your time. There is no rush in the meadow.',
    ],
  };
}

export default function IntroScene({ kind, name, fight, hero, assets, onDone }) {
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

  return (
    <div className="intro cut" role="presentation">
      <div className="intro-bar top" />
      <div className="intro-bar bottom" />
      <div className="intro-talk panel">
        {hero && assets && <span className="intro-hero"><Avatar assets={assets} id={hero} size={56} /></span>}
        <div className="intro-say">
          <div className="intro-bot">{bot}</div>
          <p>{lines[idx].slice(0, typed)}<span className="intro-caret">▍</span></p>
        </div>
      </div>
      <button type="button" className="intro-skip btn small-btn" onClick={finish}>Skip ⏭</button>
    </div>
  );
}
