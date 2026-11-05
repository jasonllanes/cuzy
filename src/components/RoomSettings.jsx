import { TEAM_COUNTS } from '../game/teams';
import { DIFFICULTY, DIFFICULTY_IDS, WAVE_COUNTS } from '../game/monsters';
import { FREE_MAPS, SURVIVAL_MAPS, mapIdOf } from '../game/maps';

// What starts the next wave in Survival (also used by the solo rules panel)
export const WAVE_START = [
  ['timer', '⏱️ Countdown', 'A countdown between waves.'],
  ['vote', '🗳️ Vote', 'Everyone presses V: when more than half agree, the wave starts. No countdown.'],
  ['manual', '🎮 Host starts', 'The host presses V (or Start) when the team is ready. No countdown.'],
  ['instant', '⚡ Non-stop', 'No breaks: the next wave comes as soon as the last zombie falls.'],
];

const PICK_HINT = {
  pick: 'The host picks who duels.',
  random: 'Two players are drawn at random for every duel.',
  streak: 'The winner stays on and the one who lost sits out: whoever has waited longest steps in.',
  robin: 'Everybody duels everybody in turn.',
};

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

// A group of settings that can be folded away (what it holds, in short, shows while it is folded)
function Section({ icon, title, note, open = true, children }) {
  return (
    <details className="set-section" open={open}>
      <summary><span className="set-sec-title">{icon} {title}</span>{note && <small>{note}</small>}</summary>
      <div className="set-grid">{children}</div>
    </details>
  );
}

// The host's room rules. Everyone can see them; only the host can change them. Most apply at once, even in the middle of a round.
export default function RoomSettings({ room, count, editable, onChange, players = [] }) {
  const free = room.mode === 'free';
  const locked = !editable || room.started; // the mode, the map, the Colosseum round and the startup money are fixed once the round starts
  const duel = !!room.duel; // a whole round in the Colosseum
  const every = Number(room.duelEvery) || 0; // a duel every so many minutes of a running round
  const duels = duel ? 'round' : every > 0 ? 'timed' : 'off';
  const monsters = room.winBy === 'monsters';
  const bet = Number(room.bet) || 0;
  const humans = players.filter((p) => !p.ai);
  const fighters = (room.fighters || []).filter((id) => humans.some((p) => p.id === id)); // a one-against-one duel: who fights (the others watch)
  const pair = fighters.length === 2 ? fighters : humans.slice(0, 2).map((p) => p.id);
  const pick = room.duelPick || 'pick';
  const duelLocked = !editable || (duel ? room.started : !!room.duelLive); // (a duel round is set up before it starts; the timed duels can be changed between duels)
  const oneVsOne = duels === 'timed' || (duel && !room.teams);
  const fightNote = [room.teams ? `${room.teams} teams` : 'free for all', room.pvp || duel ? 'player damage' : 'no damage'].join(' · ');
  const duelNote = duels === 'round' ? `Colosseum round${bet ? ' · 🎲 bets' : ''}` : duels === 'timed' ? `every ${every} min${bet ? ' · 🎲 bets' : ''}` : 'off';

  return (
    <section className="settings-panel" aria-label="Room settings">
      <h3>⚙️ Room settings {!editable && <small>set by the host</small>}{editable && room.started && <small>the mode, map, Colosseum round and startup money are fixed during a round: everything else changes right away</small>}</h3>

      <Section icon="🌍" title="World" note={`${count} in the room · max ${room.max}`}>
        {room.mode !== 'waves' && (
          <div className="set-row">
            <div className="set-label"><b>Game mode</b><small>{room.started ? 'Fixed once the round has started' : free ? 'Free Roam: a cozy world to explore, fight or win in' : 'Survival: co-op against zombies. The map changes to match.'}</small></div>
            <div className="seg">
              <button type="button" className={free ? 'on' : ''} disabled={locked} onClick={() => onChange({ mode: 'free' })}>🌻 Free Roam</button>
              <button type="button" className={room.mode === 'survival' ? 'on' : ''} disabled={locked} onClick={() => onChange({ mode: 'survival' })}>🧟 Survival</button>
            </div>
          </div>
        )}
        <div className="set-row">
          <div className="set-label"><b>Map</b><small>{room.started ? 'Fixed once the round has started' : 'Everyone in the room gets the new world.'}</small></div>
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
      </Section>

      {!free && (
        <Section icon="🧟" title="Survival" note={`${DIFFICULTY[room.difficulty]?.name || 'Medium'} · ${room.waves === 0 ? 'endless' : `${room.waves ?? 10} waves`}`}>
          <div className="set-row">
            <div className="set-label"><b>Difficulty</b><small>{DIFFICULTY[room.difficulty]?.blurb || 'How tough the waves are'} Changes at once, even in a round.</small></div>
            <div className="seg">
              {DIFFICULTY_IDS.map((d) => (
                <button key={d} type="button" className={room.difficulty === d ? 'on' : ''} disabled={!editable} onClick={() => onChange({ difficulty: d })}>{DIFFICULTY[d].name}</button>
              ))}
            </div>
          </div>
          <div className="set-row">
            <div className="set-label"><b>Number of waves</b><small>{room.waves === 0 ? 'Endless: the zombies and bosses keep getting stronger.' : `${room.waves ?? 10} waves, bosses halfway and at the end; everything gets stronger as the run goes on.`}</small></div>
            <select value={room.waves ?? 10} disabled={!editable} onChange={(e) => onChange({ waves: Number(e.target.value) })}>
              {WAVE_COUNTS.map((n) => <option key={n} value={n}>{n === 0 ? '♾️ Endless' : `${n} waves`}</option>)}
            </select>
          </div>
          <div className="set-row">
            <div className="set-label"><b>Next wave</b><small>{WAVE_START.find(([id]) => id === (room.waveStart || 'timer'))?.[2]}</small></div>
            <select value={room.waveStart || 'timer'} disabled={!editable} onChange={(e) => onChange({ waveStart: e.target.value })}>
              {WAVE_START.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </div>
        </Section>
      )}

      <Section icon="👥" title="Players" note={[room.allowLate !== false ? 'late join' : 'no late join', room.allowVisit ? 'visit' : null, room.allowCheats ? 'cheats' : null].filter(Boolean).join(' · ')}>
        <Switch label="Allow late join" hint="Let people in after the round has started" on={room.allowLate !== false} disabled={!editable} onChange={(v) => onChange({ allowLate: v })} />
        <Switch label="Allow visit" hint="Teleport straight to another player (Room button, then Visit)" on={!!room.allowVisit} disabled={!editable} onChange={(v) => onChange({ allowVisit: v })} />
        <Switch label="Allow cheats?" hint="Chat commands like -gold 100 or -level 5 (press Enter for the list)" on={!!room.allowCheats} disabled={!editable} onChange={(v) => onChange({ allowCheats: v })} />
        <Switch label="Kill streaks on monsters" hint={room.streakMonsters ? 'Monster kills count towards streaks too' : 'Off: only killing a player starts a streak'} on={!!room.streakMonsters} disabled={!editable} onChange={(v) => onChange({ streakMonsters: v })} />
      </Section>

      {free && (
        <Section icon="⚔️" title="Fighting" note={fightNote}>
          <div className="set-row">
            <div className="set-label"><b>Teams</b><small>{room.teams ? 'Teammates cannot hurt each other and share one score and one camp. Tap a free slot under a team to join it, or use Shuffle.' : 'Free for all: everyone for themselves'}</small></div>
            <select value={room.teams || 0} disabled={!editable || (duel && room.started)} onChange={(e) => onChange({ teams: Number(e.target.value) })}>
              {TEAM_COUNTS.map((n) => <option key={n} value={n}>{n ? `${n} teams` : 'Free for all'}</option>)}
            </select>
          </div>
          {room.teams > 0 && (
            <div className="set-row">
              <div className="set-label"><b>Shuffle teams</b><small>Deals everyone out to the teams at random, as evenly as it goes.</small></div>
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
        </Section>
      )}

      {free && (
        <Section icon="🏛️" title="Duels" note={duelNote} open={duels !== 'off'}>
          <div className="set-row wide">
            <div className="set-label">
              <b>Colosseum duels</b>
              <small>{duels === 'off' ? 'No duels.' : duels === 'timed' ? 'Every few minutes the game calls two players (never two from the same team) to the Colosseum while everyone else watches. They come back afterwards.' : 'The whole round is fought in the Colosseum against the clock: 1v1 with the others watching, or teams against teams.'}</small>
            </div>
            <div className="seg">
              <button type="button" className={duels === 'off' ? 'on' : ''} disabled={duelLocked || (duel && room.started)} onClick={() => onChange({ duel: false, duelEvery: 0 })}>Off</button>
              <button type="button" className={duels === 'timed' ? 'on' : ''} disabled={duelLocked || (duel && room.started)} onClick={() => onChange({ duel: false, duelEvery: every || 5 })}>⏱ Timed</button>
              <button type="button" className={duels === 'round' ? 'on' : ''} disabled={!editable || room.started} onClick={() => onChange({ duel: true })}>🏛️ Round</button>
            </div>
          </div>
          {duels === 'timed' && (
            <div className="set-row">
              <div className="set-label"><b>A duel every</b><small>Counted from the start of the round, and again after each duel.</small></div>
              <select value={every} disabled={duelLocked} onChange={(e) => onChange({ duelEvery: Number(e.target.value) })}>
                {[...new Set([2, 3, 5, 10, 15, 20, every])].filter(Boolean).sort((a, b) => a - b).map((n) => <option key={n} value={n}>{n} min</option>)}
              </select>
            </div>
          )}
          {duels !== 'off' && oneVsOne && (
            <div className="set-row">
              <div className="set-label"><b>Who duels</b><small>{PICK_HINT[pick]} {duels === 'timed' && room.teams ? 'Never two from the same team. ' : ''}The others watch.</small></div>
              <select value={pick} disabled={duelLocked} onChange={(e) => onChange({ duelPick: e.target.value })}>
                <option value="pick">🖐 Host picks</option>
                <option value="random">🎲 Random</option>
                <option value="streak">🏆 Winner stays</option>
                <option value="robin">🔁 Round robin</option>
              </select>
            </div>
          )}
          {duels !== 'off' && oneVsOne && humans.length > 0 && (pick === 'pick' || duel) && (
            <div className="set-row">
              <div className="set-label"><b>{pick === 'pick' ? 'Fighters' : 'Next duel'}</b><small>{pick === 'pick' ? (humans.length > 2 ? 'These two duel and everybody else watches.' : 'The two of you duel.') : 'Worked out from the rule above after every duel.'}</small></div>
              <div className="seg">
                {pick === 'random' && duel && <button type="button" className="btn go small-btn" disabled={duelLocked} onClick={() => onChange({ reroll: true })}>🎲 Redraw</button>}
                {[0, 1].map((i) => (
                  <select key={i} value={pair[i] || ''} disabled={duelLocked || pick !== 'pick'} onChange={(e) => { const next = [...pair]; next[i] = e.target.value; if (next[0] !== next[1]) onChange({ fighters: next }); }}>
                    {humans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                ))}
              </div>
            </div>
          )}
          {duels !== 'off' && (
            <>
              <div className="set-row">
                <div className="set-label"><b>Time limit</b><small>When the bell rings, whoever has the lowest health loses (the same health is a draw).</small></div>
                <select value={room.duelMins || 3} disabled={duelLocked} onChange={(e) => onChange({ duelMins: Number(e.target.value) })}>
                  {[1, 2, 3, 5, 10].map((n) => <option key={n} value={n}>{n} min</option>)}
                </select>
              </div>
              <Switch label="Betting" hint={bet ? 'The players who are not in the duel see who is fighting and have a few seconds to back a fighter: they type how much (or go all in). The winners share what the losers put in. A draw, or nobody on the other side, gives everyone their coins back.' : 'Off: the duel is for pride only'} on={bet > 0} disabled={duelLocked} onChange={(v) => onChange({ bet: v ? 1 : 0 })} />
            </>
          )}
        </Section>
      )}
    </section>
  );
}
