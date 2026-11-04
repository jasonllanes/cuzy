import { TEAMS, TEAM_COUNTS } from '../game/teams';
import { DIFFICULTY, DIFFICULTY_IDS, WAVE_COUNTS } from '../game/monsters';

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
export default function RoomSettings({ room, count, editable, onChange }) {
  const free = room.mode === 'free';
  const locked = !editable || room.started; // teams, player damage and how the round is won are fixed once it starts
  const monsters = room.winBy === 'monsters';
  return (
    <section className="settings-panel" aria-label="Room settings">
      <h3>⚙️ Room settings {!editable && <small>set by the host</small>}{editable && room.started && <small>teams, player damage and win rule are fixed during a round</small>}</h3>
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
          <div className="set-label"><b>Max players</b><small>{count} in the room now</small></div>
          <select value={room.max} disabled={!editable} onChange={(e) => onChange({ max: Number(e.target.value) })}>
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
            <div className="set-row">
              <div className="set-label"><b>Teams</b><small>{room.teams ? 'Teammates cannot hurt each other and share one score and one camp (a house they all go into). Tap a free slot under a team to join it, or use Shuffle.' : 'Free for all: everyone for themselves'}</small></div>
              <select value={room.teams || 0} disabled={locked} onChange={(e) => onChange({ teams: Number(e.target.value) })}>
                {TEAM_COUNTS.map((n) => <option key={n} value={n}>{n ? `${n} teams` : 'Free for all'}</option>)}
              </select>
            </div>
            {room.teams > 0 && (
              <div className="set-row">
                <div className="set-label"><b>Shuffle teams</b><small>Deals everyone (computer players too) out to the teams at random, as evenly as it goes. Tap it again for another draw.</small></div>
                <button type="button" className="btn go small-btn" disabled={locked} onClick={() => onChange({ shuffleTeams: true })}>🎲 Shuffle</button>
              </div>
            )}
            <Switch label="Player damage" hint="Heroes can hurt each other" on={!!room.pvp} disabled={locked} onChange={(v) => onChange({ pvp: v })} />
            <Switch label="Allow melee" hint="Sword, axe, dash" on={room.allowMelee !== false} disabled={!editable} onChange={(v) => onChange({ allowMelee: v })} />
            <Switch label="Allow throwing" hint="Right-click throws" on={room.allowThrow !== false} disabled={!editable} onChange={(v) => onChange({ allowThrow: v })} />
            <div className="set-row">
              <div className="set-label"><b>Win by</b><small>{room.pvp ? 'What counts towards the win' : 'Player damage is off, so monsters it is'}</small></div>
              <div className="seg">
                <button type="button" className={!monsters ? 'on' : ''} disabled={locked || !room.pvp} onClick={() => onChange({ winBy: 'duel', target: 10 })}>⚔️ Players</button>
                <button type="button" className={monsters ? 'on' : ''} disabled={locked} onClick={() => onChange({ winBy: 'monsters', target: 15 })}>👹 Monsters</button>
              </div>
            </div>
            <div className="set-row wide">
              <div className="set-label"><b>Reach {room.target} {monsters ? 'monster ' : 'player '}kills to win</b><small>Drag to change</small></div>
              <input type="range" min={1} max={50} value={Math.min(50, room.target)} disabled={!editable} onChange={(e) => onChange({ target: Number(e.target.value) })} />
            </div>
          </>
        )}
      </div>
    </section>
  );
}

