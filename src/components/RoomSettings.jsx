import { TEAMS, TEAM_COUNTS } from '../game/teams';
import { DIFFICULTY, DIFFICULTY_IDS, WAVE_COUNTS } from '../game/monsters';
import { FREE_MAPS, SURVIVAL_MAPS, mapIdOf } from '../game/maps';

// What starts the next wave in Survival (also used by the solo rules panel)
export const WAVE_START = [
  ['timer', '⏱️ Countdown', 'A countdown between waves.'],
  ['vote', '🗳️ Vote', 'Everyone presses V: when more than half agree, the wave starts. No countdown.'],
  ['manual', '🎮 Host starts', 'The host presses V (or Start) when the team is ready. No countdown.'],
  ['instant', '⚡ Non-stop', 'No breaks: the next wave comes as soon as the last zombie falls.'],
];

// One on/off setting, drawn as a switch
export function Switch({ label, hint, on, disabled, onChange }) {
  return (
    <div className="set-row">
      <div className="set-label"><b>{label}</b><small>{hint}</small></div>
      <button type="button" role="switch" aria-checked={on} className={`switch ${on ? 'on' : ''}`} disabled={disabled} onClick={() => onChange(!on)}>
        <i />
      </button>
    </div>
  );
}

// The host's room rules. Everyone can see them; only the host can change them, and most are locked once a round is running.
export default function RoomSettings({ room, count, editable, onChange, players = [] }) {
  const free = room.mode === 'free';
  const locked = !editable || room.started; // the mode, the map, the duel and the startup money are fixed once the round starts (the rest applies at once)
  const duel = !!room.duel;
  const monsters = room.winBy === 'monsters';
  const bet = Number(room.bet) || 0;
  const humans = players.filter((p) => !p.ai);
  const fighters = (room.fighters || []).filter((id) => humans.some((p) => p.id === id)); // a one-against-one duel: who fights (the others watch)
  const pair = fighters.length === 2 ? fighters : humans.slice(0, 2).map((p) => p.id);
  return (
    <section className="settings-panel" aria-label="Room settings">
      <h3>⚙️ Room settings {!editable && <small>set by the host</small>}{editable && room.started && <small>the mode, map, duel and startup money are fixed during a round: everything else changes right away</small>}</h3>
      <div className="set-grid">
        {room.mode !== 'waves' && (
          <div className="set-row">
            <div className="set-label"><b>Game mode</b><small>{room.started ? 'Fixed once the round has started' : free ? 'Free Roam: a cozy world to explore, fight or win in' : 'Survival: co-op against zombies, with the shelter to defend. The map changes to match.'}</small></div>
            <div className="seg">
              <button type="button" className={free ? 'on' : ''} disabled={locked} onClick={() => onChange({ mode: 'free' })}>🌻 Free Roam</button>
              <button type="button" className={room.mode === 'survival' ? 'on' : ''} disabled={locked} onClick={() => onChange({ mode: 'survival' })}>🧟 Survival</button>
            </div>
          </div>
        )}
        <div className="set-row">
          <div className="set-label"><b>Map</b><small>{room.started ? 'Fixed once the round has started' : 'Change the map before the round starts: everyone in the room gets the new world.'}</small></div>
          <select value={duel ? 'colosseum' : mapIdOf(room.seed, room.mode)} disabled={locked || duel} onChange={(e) => onChange({ map: e.target.value })}>
            {duel && <option value="colosseum">🏛️ Colosseum</option>}
            {(free ? FREE_MAPS : SURVIVAL_MAPS).map((m) => <option key={m.id} value={m.id}>{m.icon} {m.name}</option>)}
          </select>
        </div>
        <div className="set-row">
          <div className="set-label"><b>Max players</b><small>{count} in the room now</small></div>
          <select value={room.max} disabled={!editable || duel} onChange={(e) => onChange({ max: Number(e.target.value) })}>
            {[2, 3, 4, 5, 6, 7, 8, 9, 10].filter((n) => n >= count).map((n) => <option key={n} value={n}>{n} players</option>)}
          </select>
        </div>
        <div className="set-row">
          <div className="set-label"><b>Startup money</b><small>Coins everyone begins the round with</small></div>
          <select value={room.startMoney || 0} disabled={!editable || room.started} onChange={(e) => onChange({ startMoney: Number(e.target.value) })}>
            {[0, 25, 50, 100, 250, 500, 1000, 5000].map((n) => <option key={n} value={n}>{n ? `🪙 ${n}` : 'None'}</option>)}
          </select>
        </div>
        {!free && (
          <div className="set-row">
            <div className="set-label"><b>Difficulty</b><small>{DIFFICULTY[room.difficulty]?.blurb || 'How tough the waves are'} The host can change it at any time, even in a round.</small></div>
            <div className="seg">
              {DIFFICULTY_IDS.map((d) => (
                <button key={d} type="button" className={room.difficulty === d ? 'on' : ''} disabled={!editable} onClick={() => onChange({ difficulty: d })}>{DIFFICULTY[d].name}</button>
              ))}
            </div>
          </div>
        )}
        {!free && (
          <div className="set-row">
            <div className="set-label"><b>Number of waves</b><small>{room.waves === 0 ? 'Endless: no end, the zombies and bosses keep getting stronger.' : `${room.waves ?? 10} waves, with the bosses halfway and at the end. Monsters, and the bosses too, get stronger and higher level as the run goes on. The host can change it at any time.`}</small></div>
            <select value={room.waves ?? 10} disabled={!editable} onChange={(e) => onChange({ waves: Number(e.target.value) })}>
              {WAVE_COUNTS.map((n) => <option key={n} value={n}>{n === 0 ? '♾️ Endless' : `${n} waves`}</option>)}
            </select>
          </div>
        )}
        {!free && (
          <div className="set-row">
            <div className="set-label"><b>Next wave</b><small>{WAVE_START.find(([id]) => id === (room.waveStart || 'timer'))?.[2]} The host can change it at any time.</small></div>
            <select value={room.waveStart || 'timer'} disabled={!editable} onChange={(e) => onChange({ waveStart: e.target.value })}>
              {WAVE_START.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </div>
        )}
        <Switch label="Kill streaks on monsters" hint={room.streakMonsters ? 'Monster kills count towards streaks too, and everyone sees them' : 'Off: only killing a player starts a streak'} on={!!room.streakMonsters} disabled={!editable} onChange={(v) => onChange({ streakMonsters: v })} />
        <Switch label="Allow late join" hint="Let people in after the round has started" on={room.allowLate !== false} disabled={!editable} onChange={(v) => onChange({ allowLate: v })} />
        <Switch label="Allow visit" hint="Players can teleport straight to another player in the room (the Room button, then Visit next to their name)" on={!!room.allowVisit} disabled={!editable} onChange={(v) => onChange({ allowVisit: v })} />
        <Switch label="Allow cheats?" hint="Players can type commands like -gold 100 or -level 5 in the chat (press Enter for the list)" on={!!room.allowCheats} disabled={!editable} onChange={(v) => onChange({ allowCheats: v })} />
        {free && (
          <>
            <Switch label="Duel" hint={duel ? (room.teams ? 'A team duel in the Colosseum, against the clock: a fighter who goes down is out, and the last team standing wins. When time is up the team with the lowest total health loses (the same total is a draw).' : 'A 1v1 in the Colosseum, against the clock: the first one down loses, and when time is up the lowest health loses (the same health is a draw). Everybody else in the room watches.') : 'A fight in a small walled Colosseum with crates and pillars to hide behind, against the clock: 1v1 (the others watch), or teams against teams if you pick teams.'} on={duel} disabled={locked} onChange={(v) => onChange({ duel: v })} />
            {duel && !room.teams && humans.length > 0 && (
              <div className="set-row">
                <div className="set-label"><b>Fighters</b><small>{humans.length > 2 ? 'These two duel and everybody else watches.' : 'The two of you duel.'}</small></div>
                <div className="seg">
                  {[0, 1].map((i) => (
                    <select key={i} value={pair[i] || ''} disabled={locked} onChange={(e) => { const next = [...pair]; next[i] = e.target.value; if (next[0] !== next[1]) onChange({ fighters: next }); }}>
                      {humans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  ))}
                </div>
              </div>
            )}
            {duel && (
              <>
                <div className="set-row">
                  <div className="set-label"><b>Time limit</b><small>When the bell rings, whoever has the lowest health loses.</small></div>
                  <select value={room.duelMins || 3} disabled={locked} onChange={(e) => onChange({ duelMins: Number(e.target.value) })}>
                    {[1, 2, 3, 5, 10].map((n) => <option key={n} value={n}>{n} min</option>)}
                  </select>
                </div>
                <Switch label="Bet" hint={bet ? `Each fighter puts ${bet} 🪙 on the table: the winner (or the winning team, sharing it) takes the losers' stakes, a draw gives them back. A player who cannot cover it stakes what they have, and the pot is only as big as the smaller stake.` : 'Off: the duel is for pride only'} on={bet > 0} disabled={locked} onChange={(v) => onChange(v ? { bet: 100, startMoney: Math.max(room.startMoney || 0, 100) } : { bet: 0 })} />
                {bet > 0 && (
                  <div className="set-row">
                    <div className="set-label"><b>Stake</b><small>Taken from each player's coins when the duel starts (the startup money is raised to cover it)</small></div>
                    <select value={bet} disabled={locked} onChange={(e) => onChange({ bet: Number(e.target.value), startMoney: Math.max(room.startMoney || 0, Number(e.target.value)) })}>
                      {[25, 50, 100, 250, 500, 1000, 5000].map((n) => <option key={n} value={n}>🪙 {n}</option>)}
                    </select>
                  </div>
                )}
              </>
            )}
            <div className="set-row">
              <div className="set-label"><b>Teams</b><small>{room.teams ? 'Teammates cannot hurt each other and share one score and one camp (a house they all go into). Tap a free slot under a team to join it, or use Shuffle.' : 'Free for all: everyone for themselves'}</small></div>
              <select value={room.teams || 0} disabled={!editable || (duel && room.started)} onChange={(e) => onChange({ teams: Number(e.target.value) })}>
                {TEAM_COUNTS.map((n) => <option key={n} value={n}>{n ? `${n} teams` : 'Free for all'}</option>)}
              </select>
            </div>
            {room.teams > 0 && (
              <div className="set-row">
                <div className="set-label"><b>Shuffle teams</b><small>Deals everyone (computer players too) out to the teams at random, as evenly as it goes. Tap it again for another draw.</small></div>
                <button type="button" className="btn go small-btn" disabled={!editable || (duel && room.started)} onClick={() => onChange({ shuffleTeams: true })}>🎲 Shuffle</button>
              </div>
            )}
            {!duel && <Switch label="Player damage" hint="Heroes can hurt each other" on={!!room.pvp} disabled={!editable} onChange={(v) => onChange({ pvp: v })} />}
            <Switch label="Allow melee" hint="Sword, axe, dash" on={room.allowMelee !== false} disabled={!editable} onChange={(v) => onChange({ allowMelee: v })} />
            <Switch label="Allow throwing" hint="Right-click throws" on={room.allowThrow !== false} disabled={!editable} onChange={(v) => onChange({ allowThrow: v })} />
            {!duel && (
              <>
            <div className="set-row">
              <div className="set-label"><b>Win by</b><small>{room.pvp ? 'What counts towards the win' : 'Player damage is off, so monsters it is'}</small></div>
              <div className="seg">
                <button type="button" className={!monsters ? 'on' : ''} disabled={!editable || !room.pvp} onClick={() => onChange({ winBy: 'duel', target: 10 })}>⚔️ Players</button>
                <button type="button" className={monsters ? 'on' : ''} disabled={!editable} onClick={() => onChange({ winBy: 'monsters', target: 15 })}>👹 Monsters</button>
              </div>
            </div>
            <div className="set-row wide">
              <div className="set-label"><b>Reach {room.target} {monsters ? 'monster ' : 'player '}kills to win</b><small>Drag to change</small></div>
              <input type="range" min={1} max={50} value={Math.min(50, room.target)} disabled={!editable} onChange={(e) => onChange({ target: Number(e.target.value) })} />
            </div>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}

