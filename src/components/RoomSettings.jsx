import { TEAMS, TEAM_COUNTS } from '../game/teams';

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
        <div className="set-row">
          <div className="set-label"><b>Max players</b><small>{count} in the room now</small></div>
          <select value={room.max} disabled={!editable} onChange={(e) => onChange({ max: Number(e.target.value) })}>
            {[2, 3, 4, 5, 6, 7, 8, 9, 10].filter((n) => n >= count).map((n) => <option key={n} value={n}>{n} players</option>)}
          </select>
        </div>
        <Switch label="Kill streaks on monsters" hint={room.streakMonsters ? 'Monster kills count towards streaks too, and everyone sees them' : 'Off: only killing a player starts a streak'} on={!!room.streakMonsters} disabled={!editable} onChange={(v) => onChange({ streakMonsters: v })} />
        <Switch label="Allow late join" hint="Let people in after the round has started" on={room.allowLate !== false} disabled={!editable} onChange={(v) => onChange({ allowLate: v })} />
        <Switch label="Allow cheats?" hint="Players can type commands like -gold 100 or -level 5 in the chat (press Enter for the list)" on={!!room.allowCheats} disabled={!editable} onChange={(v) => onChange({ allowCheats: v })} />
        {free && (
          <>
            <div className="set-row">
              <div className="set-label"><b>Teams</b><small>{room.teams ? 'Teammates cannot hurt each other and share one score. Tap a free slot under a team to join it.' : 'Free for all: everyone for themselves'}</small></div>
              <select value={room.teams || 0} disabled={locked} onChange={(e) => onChange({ teams: Number(e.target.value) })}>
                {TEAM_COUNTS.map((n) => <option key={n} value={n}>{n ? `${n} teams` : 'Free for all'}</option>)}
              </select>
            </div>
            <Switch label="Player damage" hint="Heroes can hurt each other" on={!!room.pvp} disabled={locked} onChange={(v) => onChange({ pvp: v })} />
            <Switch label="Allow melee" hint="Sword, dash and spiral" on={room.allowMelee !== false} disabled={!editable} onChange={(v) => onChange({ allowMelee: v })} />
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

