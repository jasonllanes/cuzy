import { useEffect, useRef, useState } from 'react';
import { BASE, ELEMENTS, ELEMENT_IDS, PASSIVES, PASS_ICONS, SKILL_ICONS, iconUrl, previewOf } from '../game/elements';

function SkillIcon({ name, size = 32 }) {
  return <img className="elem-sico" src={iconUrl(name)} alt="" width={size} height={size} draggable={false} />;
}
import { Pfx, bakedLoop, drawBaked, loadFx } from '../game/pfx';

const KEY = { shoot: 'Click', dash: 'Space', block: 'R', a: 'Q', b: 'E', ult: 'X' };
const HOW = {
  shoot: 'Hold to repeat',
  dash: 'Tap Space',
  block: 'Press R',
  a: 'Press Q',
  b: 'Press E',
  ult: 'Ultimate',
};
const ORDER = ['shoot', 'dash', 'block', 'a', 'b', 'ult'];

// A little canvas that plays a skill's pixelfx over and over (a looping picture, or one-shot effects replayed every couple of seconds)
function SkillPreview({ el, k, w = 150, h = 96, recharge = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const def = ELEMENTS[el];
    const spec = recharge
      ? { shots: [['arcane/spell-charge', 0.55, { palette: def.pal, life: 2 }]], mode: 'still' }
      : previewOf(def.skills[k], el);
    const lw = w / 2;
    const lh = h / 2;
    const gy = lh * 0.78; // the ground line
    const pfx = new Pfx();
    for (const s of spec.shots) loadFx(s[0]);
    let queue = [];
    let cycle = 99;
    let last = performance.now();
    let hitDone = false;
    let trailT = 0;
    let raf = 0;
    const PERIOD = spec.mode === 'proj' ? 1.9 : 2.5;
    const fire = () => {
      queue = [];
      hitDone = false;
      trailT = 0;
      if (spec.mode === 'proj' || spec.mode === 'dash') return;
      spec.shots.forEach(([id, sc, o]) => {
        const { dx = 0, dy = 0, delay = 0, ...rest } = o || {};
        queue.push({ at: delay, id, x: lw * 0.42 + dx, y: gy + dy, sc, rest });
      });
    };
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      cycle += dt;
      if (cycle >= PERIOD) {
        cycle = 0;
        fire();
      }
      for (const q of queue) if (!q.done && cycle >= q.at) {
        if (pfx.spawn(q.id, q.x, q.y, { scale: q.sc, seed: 3, ...q.rest })) q.done = true; // (still loading: it is tried again next frame)
      }
      if (spec.mode === 'dash') {
        // a hero (a small shadow) runs across with the trail effects dropping behind
        if (cycle < 0.7) {
          trailT -= dt;
          if (trailT <= 0) {
            trailT = 0.09;
            const px = 14 + (cycle / 0.7) * (lw - 40);
            const first = spec.shots[0];
            if (first) pfx.spawn(first[0], px, gy - 2, { scale: first[1], seed: 3, ...(first[2] || {}) });
          }
        }
      }
      pfx.update(dt);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.scale(2, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(lw * 0.42, gy + 1, 11, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      let px = lw * 0.42;
      if (spec.mode === 'dash') px = 14 + Math.min(1, cycle / 0.7) * (lw - 40);
      // the hero stand-in
      ctx.fillStyle = 'rgba(40,36,60,0.85)';
      ctx.fillRect(Math.round(px - 3), Math.round(gy - 14), 6, 13);
      ctx.fillStyle = '#f2c9a0';
      ctx.fillRect(Math.round(px - 3), Math.round(gy - 18), 6, 5);
      if (spec.mode === 'proj') {
        const b = bakedLoop(spec.loop.id, spec.loop.o || {}, 15);
        const t = cycle / 1.1;
        const bx = lw * 0.42 + 8 + Math.min(1, t) * (lw * 0.45);
        if (b && t < 1) drawBaked(ctx, b, bx + (spec.loop.mid ? (b.ox - b.W / 2) * (spec.loop.k || 0.3) : 0), gy - 8 + (spec.loop.mid ? (b.oy - b.H / 2) * (spec.loop.k || 0.3) : 0), cycle, false, 1, (spec.loop.k || 0.3) * 1.3);
        if (t >= 1 && !hitDone) {
          hitDone = true;
          const s = spec.shots[0];
          pfx.spawn(s[0], bx, gy - 8, { scale: s[1] * 1.2, seed: 3 });
        }
      }
      pfx.drawWorld(ctx, { x0: -9999, y0: -9999, x1: 9999, y1: 9999 });
      ctx.restore();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [el, k, w, h, recharge]);
  return <canvas ref={ref} className="elem-prev" width={w} height={h} />;
}

// the little spinning picture on an element tile: its bolt, looping
function TileFx({ el }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const proj = ELEMENTS[el].skills.shoot.proj;
    let raf = 0;
    const tick = (now) => {
      ctx.clearRect(0, 0, 64, 40);
      const b = bakedLoop(proj.id, proj.o || {}, 15);
      if (b) drawBaked(ctx, b, 32 + (proj.mid ? (b.ox - b.W / 2) * 0.4 : 0), 22 + Math.sin(now / 350) * 2 + (proj.mid ? (b.oy - b.H / 2) * 0.4 : 0), now / 1000, false, 1, 0.4);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [el]);
  return <canvas ref={ref} className="elem-tilefx" width="64" height="40" />;
}

// the how-to-play card that slides in beside the picker for the element you are looking at
function Tutorial({ el }) {
  const d = ELEMENTS[el];
  return (
    <div className="elem-tut panel" key={el} style={{ '--ec': d.color }}>
      <div className="elem-tut-head">
        <span className="elem-tut-ico">{d.icon}</span>
        <div>
          <h3>{d.name}: how to play</h3>
          <p>You have <b>❤ HP</b> and <b>🔷 Mana</b>. Skills cost mana, and you refill it by standing still.</p>
        </div>
      </div>
      <div className="elem-tut-grid">
        {ORDER.map((k) => (
          <div key={k} className={`elem-tcard ${k === 'ult' ? 'ult' : ''}`}>
            <SkillPreview el={el} k={k} />
            <div className="elem-tcard-top"><SkillIcon name={SKILL_ICONS[el][k]} size={24} /><kbd>{KEY[k]}</kbd><b>{d.skills[k].name}</b></div>
            <small>{d.skills[k].desc}</small>
            <span className="elem-chip">{HOW[k]} · 🔷 {BASE[k].mana}</span>
          </div>
        ))}
      </div>
      <div className="elem-tcharge">
        <SkillPreview el={el} k="shoot" recharge />
        <div>
          <div className="elem-tcard-top"><kbd>Hold C</kbd><b>Recharge mana</b></div>
          <small>Hold <b>C</b> (or hold <b>Space</b>) and you stay still inside a glowing aura while your mana slowly fills. Getting hit breaks it.</small>
          <span className="elem-chip">Blue potions drop from critters · press K to spend skill points</span>
        </div>
      </div>
    </div>
  );
}

// The picker: the elements on the left (their bolts are playing), and beside it a tutorial card for the one you have selected
export function ElementPicker({ onPick, current }) {
  const [sel, setSel] = useState(current || 'fire');
  const d = ELEMENTS[sel];
  return (
    <div className="elem-pick" role="dialog" aria-label="Choose your element">
      <div className="elem-pick-wrap">
        <div className="elem-pick-card panel">
          <h2>🌀 Choose your element</h2>
          <p className="muted">No swords here. You fight with an element, and every level gives you skill points to upgrade it.</p>
          <div className="elem-grid">
            {ELEMENT_IDS.map((id) => (
              <button key={id} type="button" className={`elem-tile ${sel === id ? 'on' : ''}`} style={{ '--ec': ELEMENTS[id].color }} onClick={() => setSel(id)}>
                <TileFx el={id} />
                <b>{ELEMENTS[id].icon} {ELEMENTS[id].name}</b>
              </button>
            ))}
          </div>
          <div className="elem-detail" style={{ '--ec': d.color }}>
            <h3>{d.icon} {d.name}</h3>
            <p>{d.blurb}</p>
            <div className="elem-showcase">
              <SkillPreview el={sel} k="ult" w={200} h={110} />
              <div><SkillIcon name={SKILL_ICONS[sel].ult} size={28} /> <kbd>X</kbd> <b>{d.skills.ult.name}</b><br /><small>{d.skills.ult.desc}</small></div>
            </div>
          </div>
          <button type="button" className="btn go" onClick={() => onPick(sel)}>{current ? `Switch to ${d.name} (skill points reset)` : `Become a ${d.name} bender`}</button>
          {current && <button type="button" className="btn ghost" onClick={() => onPick(null)}>Cancel</button>}
        </div>
        <Tutorial el={sel} />
      </div>
    </div>
  );
}

export default function ElementHud({ hud, game }) {
  const e = hud.elem;
  const [changing, setChanging] = useState(false);
  useEffect(() => {
    if (!e?.panel) setChanging(false);
  }, [e?.panel]);
  if (!e) return null;
  const el = game?.elem;
  if (e.pick) return <ElementPicker onPick={(id) => id && el?.choose(id)} />;
  if (changing) return <ElementPicker current={e.el} onPick={(id) => { setChanging(false); if (id) el?.choose(id); }} />;
  const pct = Math.max(0, Math.min(100, (e.mana / e.maxMana) * 100));
  const hpPct = Math.max(0, Math.min(100, (e.hp / e.maxHp) * 100));
  return (
    <>
      <div className={`elem-bar ${e.charging ? 'charging' : ''}`} style={{ '--ec': e.color }}>
        <div className="elem-bars">
          <div className="elem-hp" title="Health">
            <span className="elem-hp-fill" style={{ width: `${hpPct}%` }} />
            <b>❤ {e.hp} / {e.maxHp}</b>
          </div>
          <div className="elem-mana" title="Mana: hold C or Space to recharge it">
            <span className="elem-mana-fill" style={{ width: `${pct}%` }} />
            <b>🔷 {e.mana} / {e.maxMana}{e.charging ? ' · recharging…' : ''}{e.empower ? ' · ⭐ POWER' : ''}</b>
          </div>
          <button
            type="button"
            className={`elem-recharge ${e.charging ? 'on' : ''}`}
            title="Hold to recharge your mana: you stand still in an aura (hotkey C)"
            onPointerDown={(ev) => { ev.preventDefault(); el?.rechargeHold(true); }}
            onPointerUp={() => el?.rechargeHold(false)}
            onPointerLeave={() => el?.rechargeHold(false)}
            onPointerCancel={() => el?.rechargeHold(false)}
          >
            <kbd>C</kbd> 🔋 Recharge
          </button>
        </div>
        <div className="elem-skills">
          {e.skills.map((s) => {
            const ready = s.cd <= 0 && !s.locked && s.lv > 0;
            const cdp = s.cdMax > 0 ? Math.min(100, (s.cd / s.cdMax) * 100) : 0;
            return (
              <button key={s.k} type="button" className={`elem-skill ${ready ? 'ready' : ''} ${s.lv < 1 ? 'locked' : ''} ${e.mana < s.mana ? 'nomana' : ''}`} title={`${s.name}: ${s.desc} (${s.mana} mana)`} onMouseDown={(ev) => ev.preventDefault()} onClick={() => s.k !== 'shoot' && s.k !== 'dash' && el?.cast(s.k)}>
                <kbd>{s.key}</kbd>
                <SkillIcon name={s.ico} size={30} />
                <b>{s.name}</b>
                <small>{s.lv > 0 ? `Lv ${s.lv}` : s.locked ? `🔒 Lv ${s.needLv}` : 'learn (K)'}</small>
                {s.cd > 0 && <i style={{ height: `${cdp}%` }} />}
              </button>
            );
          })}
          <button type="button" className={`elem-skill pts ${e.points > 0 ? 'ready' : ''}`} onMouseDown={(ev) => ev.preventDefault()} onClick={() => el?.togglePanel()} title="Upgrade your skills (K)">
            <kbd>K</kbd>
            <span className="elem-star">⭐</span>
            <b>Skills</b>
            <small>{e.points > 0 ? `⭐ ${e.points} point${e.points > 1 ? 's' : ''}` : 'upgrade'}</small>
          </button>
        </div>
      </div>
      {e.panel && (
        <div className="elem-pick" role="dialog" aria-label="Upgrade your skills" onMouseDown={(ev) => ev.target === ev.currentTarget && el?.togglePanel()}>
          <div className="elem-pick-wrap">
            <div className="elem-pick-card panel" style={{ '--ec': e.color }}>
              <h2>{e.icon} {e.name} skills <small>⭐ {e.points} point{e.points === 1 ? '' : 's'} to spend · you get one every level</small></h2>
              <div className="elem-up">
                {e.skills.map((s) => (
                  <div key={s.k} className="elem-up-row">
                    <span className="elem-up-ico"><SkillIcon name={s.ico} size={36} /><kbd>{s.key}</kbd></span>
                    <div><b>{s.name}</b> <small>Lv {s.lv}/{s.max}</small><br /><small className="muted">{s.desc}</small></div>
                    <span className="elem-up-btn">
                      <button type="button" className="btn small-btn ghost" title="Take a level back and get the point again" disabled={s.lv <= (['shoot', 'dash', 'block'].includes(s.k) ? 1 : 0)} onClick={() => el?.downgrade(s.k)}>−</button>
                      <button type="button" className="btn small-btn" disabled={e.points < 1 || s.lv >= s.max || s.locked} onClick={() => el?.upgrade(s.k)}>{s.locked ? `🔒 Lv ${s.needLv}` : s.lv >= s.max ? 'Max' : s.lv < 1 ? 'Learn' : '+ Upgrade'}</button>
                    </span>
                  </div>
                ))}
                {Object.entries(PASSIVES).map(([k, p]) => (
                  <div key={k} className="elem-up-row">
                    <span className="elem-up-ico"><SkillIcon name={PASS_ICONS[k]} size={36} /><kbd>{p.icon}</kbd></span>
                    <div><b>{p.name}</b> <small>Lv {e.pass[k]}/{p.max}</small><br /><small className="muted">{p.desc}</small></div>
                    <span className="elem-up-btn">
                      <button type="button" className="btn small-btn ghost" title="Take a level back and get the point again" disabled={e.pass[k] < 1} onClick={() => el?.downgrade(k)}>−</button>
                      <button type="button" className="btn small-btn" disabled={e.points < 1 || e.pass[k] >= p.max} onClick={() => el?.upgrade(k)}>{e.pass[k] >= p.max ? 'Max' : '+ Upgrade'}</button>
                    </span>
                  </div>
                ))}
              </div>
              <div className="elem-up-btns">
                <button type="button" className="btn ghost" onClick={() => setChanging(true)}>🔁 Change element</button>
                <button type="button" className="btn go" onClick={() => el?.togglePanel()}>Close (K)</button>
              </div>
            </div>
            <Tutorial el={e.el} />
          </div>
        </div>
      )}
    </>
  );
}
