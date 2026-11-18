import DodTasks from './DodTasks';

// Do or Die on the screen: the task bar and the list of who is who (everybody sees these, the Werebear too), the inventory with the
// compass (it only shows while it is in your hand), the skills of the Werebear, and a line of news.
const ST = { alive: '🟢', dead: '💀', out: '🚁' };
const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

// the detailed compass: a ring with ticks, the four points, the needle to the chopper, its bearing and how far it is
function CompassPanel({ c }) {
  const deg = c.spin ? null : Math.round(((c.ang * 180) / Math.PI + 360) % 360);
  const ticks = Array.from({ length: 24 }, (_, i) => i * 15);
  return (
    <div className="dod-cpanel panel small">
      <svg width="170" height="170" viewBox="-85 -85 170 170">
        <circle r="80" fill="rgba(12,16,32,0.92)" stroke="#d9c9a0" strokeWidth="4" />
        <circle r="66" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
        <circle r="38" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        {ticks.map((a) => (
          <line key={a} x1="0" y1={a % 90 === 0 ? -66 : -72} x2="0" y2="-77" stroke={a % 90 === 0 ? '#ffd36b' : '#9aa3bd'} strokeWidth={a % 90 === 0 ? 3 : 1.5} transform={`rotate(${a})`} />
        ))}
        {[['N', 0], ['E', 90], ['S', 180], ['W', 270]].map(([t, a]) => (
          <text key={t} x={Math.sin((a * Math.PI) / 180) * 54} y={-Math.cos((a * Math.PI) / 180) * 54 + 5} textAnchor="middle" fontSize="15" fontWeight="800" fill={t === 'N' ? '#ff5a6a' : '#e8ecff'}>{t}</text>
        ))}
        <g className={c.spin ? 'dod-spin' : ''} style={c.spin ? undefined : { transform: `rotate(${deg}deg)` }}>
          <polygon points="0,-46 7,0 -7,0" fill="#ff5a6a" stroke="#fff" strokeWidth="1.5" />
          <polygon points="0,36 7,0 -7,0" fill="#aab2cc" />
        </g>
        <circle r="6" fill="#ffd36b" stroke="#222" strokeWidth="2" />
      </svg>
      <div className="dod-cinfo">
        {c.spin ? (
          <><b>Signal lost…</b><small>The needle spins until the chopper comes</small></>
        ) : (
          <><b>🚁 {DIRS[Math.round(deg / 45) % 8]} · {deg}°</b><small>{c.dist} tiles away</small></>
        )}
      </div>
    </div>
  );
}

function Slot({ n, icon, label, count, sel, dim, hot, onPick }) {
  return (
    <button type="button" className={`dod-slot ${sel ? 'sel' : ''} ${dim ? 'dim' : ''}`} onPointerDown={() => onPick(n)} title={label}>
      <i>{n}</i>
      <span>{icon}</span>
      {count !== undefined && <em>{count}</em>}
      {hot && <kbd>{hot}</kbd>}
    </button>
  );
}

export default function DodHud({ hud, game }) {
  const d = hud.dod;
  if (!d) return null;
  const dod = game?.dod;
  const press = (code) => dod?.key({ code, repeat: false });
  const killer = d.role === 'killer';
  const pct = d.tot ? Math.min(100, (d.done / d.tot) * 100) : 0;
  const roleText = { wait: 'Waiting for the round…', killer: '🐻 You are the WEREBEAR', survivor: '🔦 You are a survivor', ghost: '👻 You were caught', out: '🚁 You are on the chopper' }[d.role];
  const pick = (n) => dod?.select(n);
  return (
    <>
      <div className="dod-top panel small">
        <div className="dod-role">{roleText}</div>
        <div className="dod-bar" title="Everybody's tasks together">
          <i style={{ width: `${pct}%` }} />
          <b>{d.ph === 'extract' ? '🚁 Tasks done: reach the chopper!' : `🔧 Tasks ${d.done} / ${d.tot}`}</b>
        </div>
        {d.alert && <div className="dod-alert">{d.alert}</div>}
      </div>

      <div className="dod-log panel small">
        <b>Progress log</b>
        <ul>
          {d.killer && <li className="k">🐻 {d.killer} <small>Werebear</small></li>}
          {d.players.map((p) => (
            <li key={p.id} className={`${p.st} ${p.me ? 'me' : ''}`}>
              {ST[p.st]} {p.name}
              {p.st === 'dead' && <small>{p.rv < d.lives ? 'can be revived' : 'lost'}</small>}
              {p.me && <small>you</small>}
            </li>
          ))}
        </ul>
        {!killer && d.role !== 'wait' && <small className="dod-lives">Revives left for you: {d.myLeft}</small>}
      </div>

      {d.sel === 1 && <CompassPanel c={d.compass} />}

      {(d.reviving > 0 || d.looting > 0) && (
        <div className="dod-hold panel small">
          <b>{d.reviving > 0 ? 'Reviving…' : 'Searching…'}</b>
          <div><i style={{ width: `${(d.reviving || d.looting) * 100}%` }} /></div>
        </div>
      )}

      {/* the inventory: the compass is always in it, but only shows while you hold it */}
      <div className="dod-inv">
        <div className="dod-slots">
          <Slot n={1} icon="🧭" label="Compass: hold it to see where the chopper is" sel={d.sel === 1} onPick={pick} />
          {!killer && (
            <>
              <Slot n={2} icon="🔦" label={`Flashlight upgrade level ${d.light}/3`} count={`Lv ${d.light}`} sel={d.sel === 2} onPick={pick} />
              <Slot n={3} icon="💥" label="Flashbang: blinds the Werebear (Q)" count={`×${d.items.flash}`} sel={d.sel === 3} dim={d.items.flash <= 0 || d.itemCd > 0} hot="Q" onPick={(n) => { pick(n); press('KeyQ'); }} />
              <Slot n={4} icon="💨" label="Smoke grenade: you vanish for a moment (E)" count={`×${d.items.smoke}`} sel={d.sel === 4} dim={d.items.smoke <= 0 || d.itemCd > 0} hot="E" onPick={(n) => { pick(n); press('KeyE'); }} />
            </>
          )}
        </div>
        {killer ? (
          <div className="dod-skills">
            <button type="button" className="dod-skill" onPointerDown={() => dod?.click()}><kbd>Click</kbd>🐾<b>Strike</b></button>
            <button type="button" className={`dod-skill ${d.hookCd > 0 ? 'cd' : ''}`} onPointerDown={() => press('KeyQ')}><kbd>Q</kbd>🪝<b>Hook</b>{d.hookCd > 0 && <em>{d.hookCd}s</em>}</button>
            <button type="button" className="dod-skill" onPointerDown={() => press('KeyE')}><kbd>E</kbd>🪤<b>Trap {d.traps}/{d.maxTraps}</b></button>
            <button type="button" className={`dod-skill ${d.eyeCd > 0 ? 'cd' : ''} ${d.eyeT ? 'on' : ''}`} onPointerDown={() => press('KeyR')}><kbd>R</kbd>👁<b>Killer Eye</b>{d.eyeCd > 0 && <em>{d.eyeCd}s</em>}</button>
          </div>
        ) : (
          d.role === 'survivor' && (
            <div className="dod-skills">
              <button type="button" className="dod-skill" onPointerDown={() => press('KeyF')} onPointerUp={() => dod?.keyUp({ code: 'KeyF' })} onPointerLeave={() => dod?.keyUp({ code: 'KeyF' })}><kbd>F</kbd>✋<b>Tasks · revive · search crates</b></button>
            </div>
          )
        )}
      </div>

      {d.stun && <div className="dod-stun">💫 Stunned!</div>}
      {d.role === 'ghost' && <div className="dod-ghost">{d.myLeft > 0 ? 'Wait here: a survivor can bring you back. You can see everything.' : 'You are out for good. You can still watch everything.'}</div>}
      {d.reveal && (
        <div className={`dod-reveal ${d.reveal}`} role="status">
          <div>
            <small>{d.reveal === 'killer' ? 'Tonight you are' : d.practice ? 'Practice round' : 'Tonight you are a'}</small>
            <h1>{d.reveal === 'killer' ? '🐻 THE WEREBEAR' : '🔦 A SURVIVOR'}</h1>
            <p>{d.reveal === 'killer' ? 'Find them in the fog. Click to strike, Q hook, E trap, R Killer Eye. Wait at the chopper if you must.' : d.practice ? 'Nobody is hunting you: finish the tasks and reach the chopper.' : 'Finish the tasks together, then run for the chopper. The Werebear is out there.'}</p>
          </div>
        </div>
      )}
      {dod?.task && <DodTasks task={dod.task} onDone={() => dod.finishTask(true)} onClose={() => dod.finishTask(false)} />}
    </>
  );
}
