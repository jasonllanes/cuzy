import { useState } from 'react';
import MapPickerModal from './MapPickerModal';
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
// the game modes a host can switch between in the room: each one is a patch the room applies in one go (it sets the map, teams and rules for it)
const GAME_KINDS = [['free', '🌻 Free Roam'], ['survival', '🧟 Survival'], ['beach', '🏖️ Beach Ball'], ['rumble', '🌴 Beach Rumble'], ['escape', '🚁 Escape'], ['elements', '🌀 Elements'], ['duel', '🏛️ Duel']];
const OFF = { escape: false, duel: false, soccer: false, elem: false };
const MODE_PATCH = {
  free: { mode: 'free', ...OFF },
  survival: { mode: 'survival' },
  beach: { mode: 'free', ...OFF, soccer: true, rumble: false },
  rumble: { mode: 'free', ...OFF, soccer: true, rumble: true },
  escape: { mode: 'free', ...OFF, escape: true },
  elements: { mode: 'free', ...OFF, elem: true },
  duel: { mode: 'free', ...OFF, duel: true },
};

export default function RoomSettings({ room, count, editable, onChange, players = [], assets = null, net = null, name = '', hero = '' }) {
  const [mapOpen, setMapOpen] = useState(false); // the map page (with its preview), opened from here instead of a drop-down
  const free = room.mode === 'free';
  const locked = !editable || room.started; // the mode, the map, the Colosseum round and the startup money are fixed once the round starts
  const escape = !!room.escape; // the Escape zone: loot, zombies and a chopper
  const soccer = !!room.soccer; // a Beach Ball match (goals) on the beach pitch
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
  const kind = room.elem ? 'elements' : duel ? 'duel' : soccer ? (room.rumble ? 'rumble' : 'beach') : escape ? 'escape' : free ? 'free' : 'survival';
  const oneVsOne = duels === 'timed' || (duel && !room.teams);
  const fightNote = [room.teams ? `${room.teams} teams` : 'free for all', room.pvp || duel ? 'player damage' : 'no damage'].join(' · ');
  const duelNote = duels === 'round' ? `Colosseum round${bet ? ' · 🎲 bets' : ''}` : duels === 'timed' ? `every ${every} min${bet ? ' · 🎲 bets' : ''}` : 'off';

  return (
    <section className="settings-panel" aria-label="Room settings">
      <h3>⚙️ Room settings {!editable && <small>set by the host</small>}{editable && room.started && <small>the mode, map, Colosseum round and startup money are fixed during a round: everything else changes right away</small>}</h3>

      <Section icon="🌍" title="World" note={`${count} in the room · max ${room.max}`}>
        {room.mode !== 'waves' && (
          <div className="set-row">
            <div className="set-label"><b>Game mode</b><small>{room.started ? 'Fixed once the round has started' : 'Pick any mode: the rest of the settings (map, teams, targets, fighting) change to match it.'}</small></div>
            <select value={kind} disabled={locked} onChange={(e) => onChange(MODE_PATCH[e.target.value])}>
              {GAME_KINDS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </div>
        )}
        <div className="set-row">
          <div className="set-label"><b>Map</b><small>{room.started ? 'Fixed once the round has started' : 'Opens the map page, with a preview. Everyone in the room gets the new world.'}</small></div>
          {(() => {
            const fixed = duel || soccer || escape || !!room.elem;
            const cur = duel ? '🏛️ Colosseum' : soccer ? (room.rumble ? '🏖️ Beach Rumble Pitch (4 goals)' : '🏖️ Beach Pitch') : escape ? '🚁 Escape Zone' : room.elem ? '🌀 Elemental Lands' : (() => { const m = (free ? FREE_MAPS : SURVIVAL_MAPS).find((x) => x.id === mapIdOf(room.seed, room.mode)); return m ? `${m.icon} ${m.name}` : 'Custom world'; })();
            return (
              <div className="map-now">
                <b>{cur}</b>
                {!fixed && <button type="button" className="btn small-btn" disabled={locked || !assets} onClick={() => setMapOpen(true)}>🗺 Change map…</button>}
              </div>
            );
          })()}
        </div>
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
        {free && (
          <Switch label="Max stats" hint="Everyone starts with every shop upgrade (health, stamina, damage, armor, attack speed...) at its top level." on={room.maxStats !== false} disabled={!editable || room.started} onChange={(v) => onChange({ maxStats: v })} />
        )}
        <div className="set-row">
          <div className="set-label"><b>Startup wood</b><small>Wood everyone begins the round with (for crafting weapons)</small></div>
          <select value={room.startWood || 0} disabled={!editable || room.started} onChange={(e) => onChange({ startWood: Number(e.target.value) })}>
            {[0, 5, 10, 20, 50, 100, 250, 500].map((n) => <option key={n} value={n}>{n ? `🪵 ${n}` : 'None'}</option>)}
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
        <Switch label="Private room" hint="Hidden from the room list: only people with the room code or the invite link can join" on={!!room.private} disabled={!editable} onChange={(v) => onChange({ private: v })} />
        <Switch label="Allow late join" hint="Let people in after the round has started" on={room.allowLate !== false} disabled={!editable} onChange={(v) => onChange({ allowLate: v })} />
        <Switch label="Allow visit" hint="Teleport straight to another player (Room button, then Visit)" on={!!room.allowVisit} disabled={!editable} onChange={(v) => onChange({ allowVisit: v })} />
        <Switch label="Allow cheats?" hint="Chat commands like -gold 100 or -level 5 (press Enter for the list)" on={!!room.allowCheats} disabled={!editable} onChange={(v) => onChange({ allowCheats: v })} />
        <Switch label="Kill streaks on monsters" hint={room.streakMonsters ? 'Monster kills count towards streaks too' : 'Off: only killing a player starts a streak'} on={!!room.streakMonsters} disabled={!editable} onChange={(v) => onChange({ streakMonsters: v })} />
      </Section>

      {free && (
        <Section icon="🚁" title="Escape" note={escape ? `chopper in ${room.escapeMins || 10} min · waits ${room.extractMins || 5}` : 'off'}>
          <Switch label="Escape (open world survival)" hint={escape ? 'A co-op round in a big open world: loot the houses, shops, clinics, police stations and cars for guns, grenades, bullets and medicine (there is no shop), fight the zombies that keep coming, and find the compass. When the timer ends a chopper lands somewhere far away: reach it to escape!' : 'Loot buildings, survive zombie hordes, and escape on a chopper that lands far away. No shop: everything is found.'} on={escape} disabled={locked} onChange={(v) => onChange({ escape: v })} />
          {escape && (
            <>
              <div className="set-row">
                <div className="set-label"><b>Chopper arrives in</b><small>How long you have to loot and survive before it lands (somewhere far).</small></div>
                <select value={room.escapeMins || 10} disabled={locked} onChange={(e) => onChange({ escapeMins: Number(e.target.value) })}>
                  {[3, 5, 8, 10, 15, 20, 30].map((n) => <option key={n} value={n}>{n} min</option>)}
                </select>
              </div>
              <div className="set-row">
                <div className="set-label"><b>Chopper waits</b><small>How long it stays once it has landed. It takes off early when everyone is on board.</small></div>
                <select value={room.extractMins || 5} disabled={locked} onChange={(e) => onChange({ extractMins: Number(e.target.value) })}>
                  {[2, 3, 4, 5, 8, 10, 15].map((n) => <option key={n} value={n}>{n} min</option>)}
                </select>
              </div>
            </>
          )}
        </Section>
      )}

      {free && (
        <Section icon="🏖️" title="Beach Ball" note={soccer ? `first to ${room.target || 5}${room.matchMins ? ` · ${room.matchMins} min` : ''}` : 'off'}>
          <Switch label="Beach Ball match" hint={soccer ? 'Two teams, one beach ball and a goal at each end: kick it by walking into it (run or dash for a hard kick) and roll it into the other team’s goal. With only two players it is a 1v1.' : 'A cozy ball game on a beach pitch: two teams, one ball, a goal at each end. No fighting, no monsters.'} on={soccer} disabled={locked} onChange={(v) => onChange({ soccer: v })} />
          {soccer && (
            <>
              <Switch label="Rumble: free for all" hint="Four teams and a pitch with four goals (left, right, top and bottom). Defend your own goal and score in the others: a goal counts for the team of the player who touched the ball last (an own goal counts for nobody)." on={!!room.rumble} disabled={locked || room.started} onChange={(v) => onChange({ rumble: v })} />
              <div className="set-row">
                <div className="set-label"><b>Goals to win</b><small>The first team to score this many wins the match.</small></div>
                <select value={room.target || 5} disabled={locked} onChange={(e) => onChange({ target: Number(e.target.value) })}>
                  {[1, 3, 5, 7, 10, 15, 20].map((n) => <option key={n} value={n}>{n} goal{n > 1 ? 's' : ''}</option>)}
                </select>
              </div>
              <div className="set-row">
                <div className="set-label"><b>Match time</b><small>{room.matchMins ? (room.rumble ? 'When the whistle blows the team with the most goals wins. If it is level, the next goal by one of them wins.' : 'When the whistle blows the team with more goals wins. If it is level, the next goal wins.') : 'No clock: play to the goal target.'}</small></div>
                <select value={room.matchMins ?? 5} disabled={locked} onChange={(e) => onChange({ matchMins: Number(e.target.value) })}>
                  {[0, 2, 3, 5, 10, 15].map((n) => <option key={n} value={n}>{n ? `${n} min` : 'No clock'}</option>)}
                </select>
              </div>
              <div className="set-row">
                <div className="set-label"><b>Shuffle teams</b><small>Deals everyone out to the teams at random. Players can also pick a side in the waiting room.</small></div>
                <button type="button" className="btn go small-btn" disabled={locked} onClick={() => onChange({ shuffleTeams: true })}>🎲 Shuffle</button>
              </div>
            </>
          )}
        </Section>
      )}

      {free && !soccer && !escape && (
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

      {free && !soccer && !escape && (
        <Section icon="🏛️" title="Duels" note={duelNote}>
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
              <Switch label="Betting" hint={bet ? 'The players who are not in the duel see who is fighting and can bet on a fighter (even in advance), by typing how much or going all in. Backers of the winner get their stake back plus a share of 80% of what was bet on the loser; the winning duelist gets 10%, or 90% if nobody bet on them. A draw, or nobody on the other side, gives every stake back.' : 'Off: the duel is for pride only'} on={bet > 0} disabled={duelLocked} onChange={(v) => onChange({ bet: v ? 1 : 0 })} />
            </>
          )}
        </Section>
      )}
      {mapOpen && assets && <MapPickerModal assets={assets} net={net} room={room} name={name} hero={hero} onClose={() => setMapOpen(false)} onPick={(p) => { setMapOpen(false); onChange(p); }} />}
    </section>
  );
}
