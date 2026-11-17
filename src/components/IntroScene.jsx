import { useEffect, useRef, useState } from 'react';
import '../intro.css';
import Avatar from './Avatar';
import { sfx } from '../game/sfx';

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
      tones: ['radio', 'safe', 'alarm', 'gold'],
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
      tones: ['gold', 'safe', 'alarm', 'gold'],
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
    tones: ['gold', 'safe', 'radio', 'gold'],
    lines: [
      `Good morning, ${name}! You made it to the meadow. That little house is yours.`,
      'Go on in and make yourself at home.',
      'Forage, make friends with the chickens and stay clear of the skeleton camps.',
      fight ? 'Other travellers can be a little competitive. Keep your sword handy.' : 'Take your time. There is no rush in the meadow.',
    ],
  };
}

export default function IntroScene({ kind, name, fight, hero, assets, onDone }) {
  const { bot, lines, tones = [] } = useRef(script(kind, name, fight)).current;
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
  const tone = tones[idx] || 'radio';
  const talking = typed < lines[idx].length;

  // a little typewriter blip for every other letter, a radio crackle when a line begins and an alarm on the scary ones
  const lastTyped = useRef(0);
  const lastIdx = useRef(-1);
  useEffect(() => {
    if (idx !== lastIdx.current) {
      lastIdx.current = idx;
      lastTyped.current = 0;
      sfx.play(tone === 'alarm' ? 'alarm' : 'radio', 0.6);
    }
    if (typed > lastTyped.current && typed % 2 === 0 && lines[idx][typed - 1] !== ' ') sfx.play('blip', 0.7);
    lastTyped.current = typed;
  }, [typed, idx]); // eslint-disable-line react-hooks/exhaustive-deps

  // the important words glow in the box colour
  const EM = /(dead|Colossus|shelter|Get inside|wave after wave|something big|walls|survivors|Monsters|barricades|helpers|Forage|skeleton camps|competitive|Wake up|quiet)/gi;
  const shown = lines[idx].slice(0, typed);
  const parts = shown.split(EM);

  return (
    <div className="intro cut" role="presentation">
      <div className="intro-bar top" />
      <div className="intro-bar bottom" />
      {tone === 'alarm' && <div key={`al${idx}`} className="intro-alarm" />}
      <div key={idx} className={`intro-talk panel tone-${tone} ${talking ? 'talking' : ''}`}>
        <span className="intro-scan" aria-hidden="true" />
        {hero && assets && <span className="intro-hero"><Avatar assets={assets} id={hero} size={56} /></span>}
        <div className="intro-say">
          <div className="intro-bot">
            <span className="intro-tag">{bot}</span>
            <span className="intro-wave" aria-hidden="true"><i /><i /><i /><i /><i /></span>
            <span className="intro-dots" aria-hidden="true">{lines.map((_, i) => <b key={i} className={i === idx ? 'on' : i < idx ? 'past' : ''} />)}</span>
          </div>
          <p>{parts.map((part, i) => (i % 2 ? <em key={i} className="intro-em">{part}</em> : part))}<span className="intro-caret">▍</span></p>
        </div>
      </div>
      <button type="button" className="intro-skip btn small-btn" onClick={finish}>Skip ⏭</button>
    </div>
  );
}
