import { useRef, useState } from 'react';
import { useLayout } from '../game/controls';
import { TOUCH, lockDistOf, lockStyles, placeOf, placeStyle, useViewCtx } from '../game/touchLayout';

const RADIUS = 52; // how far the knob must go for full speed
const BASE_R = 66; // the circle of the joystick (132 wide)
const SPRINT_AT = 64; // the knob has left the circle: sprint

// The on-screen joystick that walks the hero. Keep the knob inside the circle to walk. Push it out of the circle to
// sprint. Push it as far as the lock at the end of the line (the line is only a guide: it is the distance that counts)
// and let go there, and the hero keeps running on its own the way it is facing. Touch the joystick again to stop.
function Joystick({ game, lockDist }) {
  const LOCK_DIST = lockDist; // pushed this far from the middle, in any direction, and let go: the hero keeps running by itself
  const MAX_PULL = lockDist + 16; // how far the knob can follow a finger
  const ls = lockStyles(lockDist);
  const base = useRef(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [run, setRun] = useState('off'); // off | on | locked
  const active = useRef(null);
  const runRef = useRef('off');
  const dirRef = useRef({ x: 0, y: -1 }); // the way the stick was pushed last

  const setRunning = (state) => {
    if (runRef.current === state) return;
    const was = runRef.current !== 'off';
    runRef.current = state;
    setRun(state);
    const now = state !== 'off';
    if (now && !was) game?.touchPress('sprint');
    if (!now && was) game?.touchRelease('sprint');
  };

  const move = (e) => {
    const r = base.current.getBoundingClientRect();
    const k = r.width / 132; // the joystick may be scaled
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = (e.clientX - cx) / k;
    let dy = (e.clientY - cy) / k;
    const raw = Math.hypot(dx, dy);
    // walking: direction from the knob, full speed from RADIUS out
    const walk = Math.min(raw, RADIUS) / (raw || 1);
    game?.setTouchMove(dx * walk / RADIUS, dy * walk / RADIUS);
    // the knob itself follows the finger, up to a limit
    if (raw > MAX_PULL) {
      dx = (dx / raw) * MAX_PULL;
      dy = (dy / raw) * MAX_PULL;
    }
    setKnob({ x: dx, y: dy });
    if (raw > 8) dirRef.current = { x: (e.clientX - cx) / k / raw, y: (e.clientY - cy) / k / raw };
    // 'arming': the knob is in the lock zone, and letting go here locks running on
    setRunning(raw >= LOCK_DIST ? 'arming' : raw >= SPRINT_AT ? 'on' : 'off');
  };
  const end = () => {
    active.current = null;
    setKnob({ x: 0, y: 0 });
    if (runRef.current === 'arming') {
      // let go inside the lock zone: keep running, hands free, the way the hero is facing
      setRunning('locked');
      game?.setTouchMove(dirRef.current.x, dirRef.current.y);
      return;
    }
    game?.setTouchMove(0, 0);
    setRunning('off');
  };

  return (
    <div
      ref={base}
      className={`joystick ${run !== 'off' ? 'running' : ''}`}
      onPointerDown={(e) => {
        if (runRef.current === 'locked') {
          // touching the stick again takes over: running by itself stops
          setRunning('off');
          game?.setTouchMove(0, 0);
        }
        active.current = e.pointerId;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* the finger is already gone */
        }
        move(e);
      }}
      onPointerMove={(e) => active.current === e.pointerId && move(e)}
      onPointerUp={end}
      onPointerCancel={end}
      onContextMenu={(e) => e.preventDefault()}
    >
      <i className={`run-line ${run}`} style={ls.line} />
      <i
        className={`run-lock ${run}`}
        style={ls.dot}
        onPointerDown={(e) => {
          if (run === 'locked') {
            e.stopPropagation();
            setRunning('off');
            game?.setTouchMove(0, 0);
          }
        }}
        title={run === 'locked' ? 'Running by itself. Touch the joystick to stop.' : 'Push the knob out this far and let go to keep running by itself'}
      >
        {run === 'locked' ? '🔒' : '🏃'}
      </i>
      <div className="joystick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}

// A round button. `hold` buttons also report how far you drag from them, which becomes the aim.
function TouchButton({ c, game, cooldown = 0, text, disabled = false, onTap }) {
  const ref = useRef(null);
  const down = useRef(false);
  const [on, setOn] = useState(false);

  const angle = (e) => {
    const r = ref.current.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    return Math.hypot(dx, dy) > 18 ? Math.atan2(dy, dx) : null; // a tap (or a small drag) uses auto-aim
  };

  const press = (e) => {
    if (disabled) return;
    e.preventDefault();
    down.current = true;
    setOn(true);
    try {
      ref.current.setPointerCapture(e.pointerId);
    } catch {
      /* the finger is already gone */
    }
    if (onTap) onTap();
    else game?.touchPress(c.kind, c.hold ? angle(e) : null);
  };
  const drag = (e) => {
    if (down.current && c.hold) game?.setTouchAim(angle(e));
  };
  const release = (e) => {
    if (!down.current) return;
    down.current = false;
    setOn(false);
    if (!onTap) game?.touchRelease(c.kind, c.hold ? angle(e) : null);
  };

  return (
    <button
      ref={ref}
      type="button"
      className={`tbtn ${c.cls || ''} ${on ? 'down' : ''} ${cooldown > 0 ? 'cooling' : ''} ${disabled ? 'off' : ''}`}
      onPointerDown={press}
      onPointerMove={drag}
      onPointerUp={release}
      onPointerCancel={release}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={c.label}
      title={c.label}
    >
      <span className="tbtn-icon">{c.icon}</span>
      <small>{text ?? c.text}</small>
      {cooldown > 0 && <i className="tbtn-cd" style={{ height: `${Math.min(100, cooldown * 100)}%` }} />}
    </button>
  );
}

// Everything you need without a keyboard. Each one sits where the player put it (Settings > Edit button layout);
// out of the box the quick items sit above the hotbar, Home and Shop beside it, and the shield above the attack button.
export default function TouchControls({ game, hud, survival, waves, onChat, onShop }) {
  const layout = useLayout();
  const ctx = useViewCtx(layout);
  const util = hud.util;
  const sword = !waves;
  const shown = {
    shield: util === 'shield',
    invis: util === 'invis',
    hp: sword || survival,
    stam: sword || survival,
    wall: waves,
    gun: survival,
  };
  const cooldownOf = {
    home: hud.recallCd ? hud.recallCd / 20 : 0,
    shield: hud.shieldCd ? hud.shieldCd / 10 : 0,
    invis: hud.invisCd ? hud.invisCd / 25 : 0,
    hp: hud.cds?.hp ? hud.cds.hp / 6 : 0,
    stam: hud.cds?.stam ? hud.cds.stam / 5 : 0,
    attack: hud.dashCd ? Math.min(1, hud.dashCd / 1.2) : 0,
  };
  const taps = { chat: onChat, shop: onShop };
  return (
    <div className="touch-controls" onContextMenu={(e) => e.preventDefault()}>
      {TOUCH.map((c) => {
        if (c.id in shown && !shown[c.id]) return null;
        const p = placeOf(layout, c, ctx);
        let text;
        let disabled = false;
        if (c.id === 'hp') {
          text = String(hud.supplies?.hp ?? 0);
          disabled = !hud.supplies?.hp;
        }
        if (c.id === 'stam') {
          text = String(hud.supplies?.stam ?? 0);
          disabled = !hud.supplies?.stam;
        }
        const item = c.id === 'throw' && survival ? { ...c, label: '🔫 Shoot', icon: '🔫', text: 'Shoot' } : c;
        return (
          <div className="tpos" key={c.id} style={placeStyle(p)}>
            {c.joystick ? <Joystick game={game} lockDist={lockDistOf(layout)} /> : <TouchButton c={item} game={game} cooldown={cooldownOf[c.id] || 0} text={text} disabled={disabled} onTap={taps[c.id]} />}
          </div>
        );
      })}
    </div>
  );
}
