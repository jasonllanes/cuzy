import { useEffect, useState } from 'react';

// Before a duel the ones who are not in it can back a side: pick a fighter, type how much (or go all in), and the coins are on the table.
// The winners share what the losers put in, by how much each of them bet.
export default function BetPanel({ duel, game, advance = false }) {
  const { units, pool = {}, myBet, coins = 0, canBet, call } = duel;
  const [side, setSide] = useState(null);
  const [amt, setAmt] = useState('');
  const room = coins + (myBet?.amt || 0); // what you could put on the table right now
  useEffect(() => {
    if (!side && units.length) setSide(myBet?.on || units[0].key);
  }, [units, side, myBet]);
  useEffect(() => {
    if (myBet) setAmt(String(myBet.amt)); // (your bet shows in the box, so you can change it)
  }, [myBet?.amt]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = Object.values(pool).reduce((n, v) => n + v, 0);
  const n = Math.max(0, Math.min(room, Math.floor(Number(amt)) || 0));
  const place = (on, a) => game?.placeBet(on, a);
  const odds = (key) => {
    const mine = pool[key] || 0;
    const rest = total - mine;
    if (!n || !rest) return null;
    return Math.floor((n * 0.8 * rest) / (mine + (myBet && myBet.on === key ? 0 : n) || 1));
  };
  if (!canBet && !myBet && !total) return null;
  return (
    <div className="bet-panel panel small">
      <div className="bet-head">
        <b>🎲 Bets</b>
        <small>{canBet ? (advance ? 'bets open · bet now' : `${call}s to bet`) : 'closed'}{total > 0 ? ` · 🪙 ${total} on the table` : ''}</small>
      </div>
      {canBet && units.length > 0 && <small className="bet-ask">Who will win? Pick a fighter, then how much:</small>}
      <div className="bet-sides">
        {units.map((u) => (
          <button key={u.key} type="button" className={`bet-side ${side === u.key ? 'on' : ''} ${myBet?.on === u.key ? 'mine' : ''}`} disabled={!canBet} onClick={() => setSide(u.key)} style={u.color ? { '--team': u.color } : undefined}>
            <b>{u.name}</b>
            <small>🪙 {pool[u.key] || 0}</small>
          </button>
        ))}
      </div>
      {canBet && (
        <div className="bet-amount">
          <input type="range" min={0} max={Math.max(1, room)} value={n} onChange={(e) => setAmt(e.target.value)} aria-label="How much to bet" />
          <input type="number" min={0} max={room} value={amt} placeholder="0" onChange={(e) => setAmt(e.target.value)} aria-label="Coins to bet" />
          <button type="button" className="btn small-btn" onClick={() => setAmt(String(room))}>All in</button>
          <button type="button" className="btn go small-btn" disabled={!side || !n} onClick={() => place(side, n)}>{myBet ? 'Change' : 'Bet'} 🪙 {n}{side ? ` on ${units.find((u) => u.key === side)?.name || ''}` : ''}</button>
          {myBet && <button type="button" className="btn small-btn" onClick={() => place(myBet.on, 0)}>Take back</button>}
        </div>
      )}
      {side && canBet && odds(side) !== null && <small className="bet-odds">If {units.find((u) => u.key === side)?.name} wins you would win about 🪙 {odds(side)} more.</small>}
      {myBet && <small className="bet-mine">Your bet: 🪙 {myBet.amt} on {units.find((u) => u.key === myBet.on)?.name || 'a fighter'}</small>}
    </div>
  );
}
