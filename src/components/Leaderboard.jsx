import { useEffect, useState } from 'react';
import { DIFFS, WAVE_CHOICES, categoryName, endlessKey, fetchTop, fmtTime, lowerWins, survKey } from '../game/leaderboard';

// One board: the top ten of a category. `mineId` highlights the row that was just added.
export function BoardTable({ category, rows, mineId = null, error = '' }) {
  if (error) return <p className="notice">{error}</p>;
  if (!rows) return <p className="hint">Loading…</p>;
  if (!rows.length) return <p className="hint">Nobody is on this board yet. Be the first!</p>;
  return (
    <ol className="lb-list">
      {rows.map((r, i) => (
        <li key={r.id} className={`lb-row ${r.id === mineId ? 'mine' : ''} ${i < 3 ? `top${i + 1}` : ''}`}>
          <span className="lb-rank">{['🥇', '🥈', '🥉'][i] || `#${i + 1}`}</span>
          <b className="lb-name">{r.name}</b>
          <span className="lb-score">{lowerWins(category) ? fmtTime(r.score) : fmtTime(r.score)}</span>
        </li>
      ))}
    </ol>
  );
}

// After a run: the board with your new spot lit up, for a few seconds, then on to the room
export function RunBoard({ category, rows, mineId, seconds = 8, onDone }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    const t = setInterval(() => setLeft((n) => n - 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (left <= 0) onDone();
  }, [left]); // eslint-disable-line react-hooks/exhaustive-deps
  const rank = rows.findIndex((r) => r.id === mineId) + 1;
  return (
    <div className="lb-overlay" role="dialog" aria-label="Leaderboard">
      <div className="lb-card panel">
        <h2>🏆 You made the top 10!</h2>
        <p className="hint">{categoryName(category)}{rank ? ` · you are #${rank}` : ''}</p>
        <BoardTable category={category} rows={rows} mineId={mineId} />
        <div className="lb-foot">
          <small>Back in {Math.max(0, left)}s…</small>
          <button type="button" className="btn go small-btn" onClick={onDone}>Continue</button>
        </div>
      </div>
    </div>
  );
}

// The leaderboards page: pick Survival or Endless, the number of waves and the difficulty
export default function Leaderboard() {
  const [kind, setKind] = useState('surv');
  const [waves, setWaves] = useState(10);
  const [diff, setDiff] = useState('medium');
  const category = kind === 'endless' ? endlessKey(diff) : survKey(waves, diff);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    setRows(null);
    setError('');
    fetchTop(category).then((r) => live && setRows(r), (e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [category]);
  return (
    <div className="lb-page">
      <div className="seg">
        <button type="button" className={kind === 'surv' ? 'on' : ''} onClick={() => setKind('surv')}>🧟 Survival (fastest clear)</button>
        <button type="button" className={kind === 'endless' ? 'on' : ''} onClick={() => setKind('endless')}>♾️ Endless (longest)</button>
      </div>
      <div className="lb-pick">
        {kind === 'surv' && (
          <select value={waves} onChange={(e) => setWaves(Number(e.target.value))} aria-label="Number of waves">
            {WAVE_CHOICES.map((n) => <option key={n} value={n}>{n} waves</option>)}
          </select>
        )}
        <div className="seg">
          {DIFFS.map(([id, name]) => <button key={id} type="button" className={diff === id ? 'on' : ''} onClick={() => setDiff(id)}>{name}</button>)}
        </div>
      </div>
      <h3 className="lb-title">🏆 {categoryName(category)}</h3>
      <BoardTable category={category} rows={rows} error={error} />
    </div>
  );
}
