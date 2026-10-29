import { useEffect, useMemo, useRef, useState } from 'react';
import '../ending.css';

// The ending scene, for every way a round can finish: a defended base (victory), a base that fell (defeat) and the winner
// of a Free Roam round. A little narrator speaks over a painted sky, the numbers count up, and then a button takes you
// back (to the room, or to the menu when you are alone). Skip jumps straight to the numbers; Esc, Space and Enter do the same.

const CHAR_TIME = 0.032;
const HOLD = 1.3;

function script({ kind, survival, name, winner, mine }) {
  const bot = survival ? '🚗 Rusty-Bot' : '✈️ Captain Biscuit-Bot';
  if (kind === 'round') {
    return {
      bot,
      title: mine ? '🏆 You win the round!' : `🏆 ${winner} wins the round!`,
      lines: mine
        ? [`What a round, ${name}! The whole meadow is cheering for you.`, 'Take a bow. Everyone is heading back to the room.']
        : [`${winner} took it, fair and square. The meadow is cheering.`, 'Dust yourself off, you will get them next round.'],
    };
  }
  if (kind === 'victory') {
    return {
      bot,
      title: survival ? '🌅 Dawn. The RV held!' : '🌅 The base held!',
      lines: survival
        ? [`Sun is coming up, ${name}. Look at that: the RV is still standing.`, 'Ten waves of the dead, and the Colossus too. Nobody got through.', 'Rest up. The road ahead is quiet, for now.']
        : [`The monsters are gone, ${name}, and the house is still standing!`, 'All ten waves defeated, and the big one too. Well defended.', 'The meadow is quiet again. Time for a well-earned rest.'],
    };
  }
  return {
    bot,
    title: survival ? '🌑 The RV fell…' : '🌑 The base fell…',
    lines: survival
      ? [`It is over, ${name}. The RV could not take any more.`, 'They were too many this time. But you made it further than most.', 'Dust yourself off. Next time, build the walls higher.']
      : [`The house gave way, ${name}. The monsters were too many this time.`, 'But you held out longer than anyone would have guessed.', 'Rebuild, rethink and try again. The meadow is waiting.'],
  };
}

// a number that counts up from nothing
function Count({ to, delay, text = (n) => String(n) }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now() + delay * 1000;
    const tick = () => {
      const p = Math.min(1, Math.max(0, (performance.now() - t0) / 1100));
      setN(Math.round(to * (1 - (1 - p) * (1 - p))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, delay]);
  return <b>{text(n)}</b>;
}

export default function EndingScene({ kind, survival, name, winner = '', mine = false, stats = [], board = [], boardTitle = '', continueLabel = '', onContinue, auto = false }) {
  const { bot, title, lines } = useRef(script({ kind, survival, name, winner, mine })).current;
  const plan = useRef(null);
  if (!plan.current) {
    let at = 1.2; // the sky fades in first
    const starts = lines.map((l) => {
      const s = at;
      at += l.length * CHAR_TIME + HOLD;
      return s;
    });
    plan.current = { starts, total: at };
  }
  const { starts, total } = plan.current;
  const [t, setT] = useState(0);
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    const t0 = performance.now();
    const id = setInterval(() => setT((performance.now() - t0) / 1000), 40);
    const onKey = (e) => {
      if (e.code === 'Escape' || e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        setSkipped(true);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      clearInterval(id);
      window.removeEventListener('keydown', onKey, true);
    };
  }, []);

  const showStats = skipped || t >= total;
  let idx = 0;
  starts.forEach((s, i) => {
    if (t >= s) idx = i;
  });
  const typed = Math.min(lines[idx].length, Math.floor((t - starts[idx]) / CHAR_TIME));
  const happy = kind !== 'defeat';
  const bits = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        delay: `${((i * 53) % 40) / 10}s`,
        dur: `${3.2 + ((i * 17) % 30) / 10}s`,
        hue: (i * 47) % 360,
        size: 6 + ((i * 7) % 7),
      })),
    [],
  );

  return (
    <div className={`ending ${kind} ${survival ? 'surv' : 'cozy'}`} role="dialog" aria-label="The end of the round">
      <div className="ending-sky" />
      <div className={`ending-sun ${happy ? 'rise' : 'sink'}`} />
      <div className="ending-hills far" />
      <div className="ending-hills near" />
      {kind !== 'round' && (
        <div className={`ending-base ${happy ? '' : 'wrecked'}`}>
          {survival ? <img src={`${import.meta.env.BASE_URL}assets/apoc/bus.png`} alt="" /> : <span aria-hidden="true">🏡</span>}
          {!happy && <i className="ending-smoke" />}
        </div>
      )}
      {kind === 'round' && <div className="ending-trophy" aria-hidden="true">🏆</div>}
      <div className="ending-bits" aria-hidden="true">
        {bits.map((b, i) => (
          <i key={i} className={happy ? 'confetti' : 'ember'} style={{ left: b.left, animationDelay: b.delay, animationDuration: b.dur, width: b.size, height: b.size, background: happy ? `hsl(${b.hue} 85% 62%)` : undefined }} />
        ))}
      </div>

      <h2 className="ending-title" style={{ opacity: t > 0.5 ? 1 : 0 }}>{title}</h2>

      {!showStats && (
        <div className="ending-talk panel">
          <div className="ending-bot">{bot}</div>
          <p>{lines[idx].slice(0, typed)}<span className="intro-caret">▍</span></p>
        </div>
      )}

      {showStats && (
        <div className="ending-card panel">
          {stats.length > 0 && (
            <div className="ending-stats">
              {stats.map((s, i) => (
                <div className="ending-stat" key={s.label}>
                  <span>{s.icon} {s.label}</span>
                  <Count to={s.value} delay={0.2 + i * 0.25} text={s.text} />
                </div>
              ))}
            </div>
          )}
          {board.length > 0 && (
            <div className="ending-board">
              <h3>{boardTitle}</h3>
              {board.slice(0, 5).map((r, i) => (
                <div className={`ending-row ${r.me ? 'me' : ''}`} key={`${r.name}${i}`}>
                  <span>{i === 0 ? '👑 ' : `${i + 1}. `}{r.name}</span>
                  <b>{r.n}</b>
                </div>
              ))}
            </div>
          )}
          {auto ? (
            <p className="hint">Back to the room in a moment…</p>
          ) : (
            <button type="button" className="btn go ending-btn" onClick={onContinue} autoFocus>{continueLabel}</button>
          )}
        </div>
      )}

      {!showStats && <button type="button" className="intro-skip btn small-btn" onClick={() => setSkipped(true)}>Skip ⏭</button>}
    </div>
  );
}
