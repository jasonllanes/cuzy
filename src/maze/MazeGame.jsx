import { useCallback, useEffect, useRef, useState } from 'react';
import './maze.css';
import Avatar from '../components/Avatar';
import { retroId } from '../game/heroes';
import { sfx } from '../game/sfx';
import { music } from '../game/music';
import { MazeSim, newFoes, FOES } from './mazeLogic';
import { MazeView, SLOT_COLORS, loadDecor, sceneSize } from './mazeRender';
import { MazeNet, makeCode, makeId, onlineAvailable } from './mazeNet';
import { FRUIT_NAMES, placeOf } from './themes';
import { fruitUrl, powerUrl } from './mazeArt';

const BEST_KEY = 'cuzy-maze-best';
const readBest = () => {
  try {
    return JSON.parse(window.localStorage.getItem(BEST_KEY)) || { level: 0, score: 0 };
  } catch {
    return { level: 0, score: 0 };
  }
};
const writeBest = (level, score) => {
  const b = readBest();
  const next = { level: Math.max(b.level, level), score: Math.max(b.score, score) };
  try {
    window.localStorage.setItem(BEST_KEY, JSON.stringify(next));
  } catch {
    /* storage may be unavailable */
  }
  return next;
};

// one key, one way to go (and, in a two player game on one keyboard, whose it is)
const KEYS = {
  KeyW: ['up', 0], KeyA: ['left', 0], KeyS: ['down', 0], KeyD: ['right', 0],
  ArrowUp: ['up', 1], ArrowLeft: ['left', 1], ArrowDown: ['down', 1], ArrowRight: ['right', 1],
};

const sound = (e) => {
  if (e.k === 'fruit') sfx.play('pickup');
  else if (e.k === 'power') sfx.play(e.type === 'freeze' ? 'shield' : 'dash');
  else if (e.k === 'portal') sfx.play('levelup');
  else if (e.k === 'clear') sfx.play('win');
  else if (e.k === 'kill') {
    sfx.play('hit');
    sfx.play('splat');
    setTimeout(() => sfx.play('death'), 260);
  } else if (e.k === 'go') sfx.play('respawn');
  else if (e.k === 'spawn') sfx.play('click');
};

// ---------- the game itself ----------
function MazeRun({ assets, sim, mode, me, net, onExit, onAgain, paused, setPaused }) {
  const wrap = useRef(null);
  const canvas = useRef(null);
  const view = useRef(null);
  const [hud, setHud] = useState(null);
  const [best, setBest] = useState(readBest);
  const saved = useRef(false);

  useEffect(() => {
    view.current = new MazeView(assets);
    window.__maze = { sim, view: view.current }; // (handy for testing)
  }, [assets, sim]);

  // the picture is sized to the space there is, in whole pixels where it can
  const fit = useCallback(() => {
    const cv = canvas.current;
    const box = wrap.current;
    if (!cv || !box || !sim.lvl) return;
    const { w, h } = sceneSize(sim.lvl);
    const css = Math.min(box.clientWidth / w, box.clientHeight / h);
    const k = Math.max(1, Math.floor(css * (window.devicePixelRatio || 1)));
    if (cv.width !== w * k || cv.height !== h * k) {
      cv.width = w * k;
      cv.height = h * k;
    }
    cv.style.width = `${Math.floor(w * css)}px`;
    cv.style.height = `${Math.floor(h * css)}px`;
    cv.dataset.k = String(k);
  }, [sim]);

  useEffect(() => {
    // refit whenever the space changes (the window, the heading growing a second line, a phone turning round)
    const box = wrap.current;
    const ro = typeof ResizeObserver !== 'undefined' && box ? new ResizeObserver(() => fit()) : null;
    ro?.observe(box);
    window.addEventListener('resize', fit);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, [fit]);

  // the loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let netEvents = [];
    let lastLevel = 0;
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const v = view.current;
      const cv = canvas.current;
      if (!v || !cv || !sim.lvl) return;
      if (!paused) sim.update(dt);
      const evs = sim.drainEvents();
      for (const e of evs) {
        sound(e);
        v.onEvent(e, sim);
      }
      if (mode === 'host') {
        netEvents.push(...evs);
        acc += dt;
        if (acc >= 0.05) {
          acc = 0;
          const snap = sim.snapshot();
          snap.ev = netEvents;
          netEvents = [];
          net.send({ t: 's', ...snap });
        }
      }
      if (sim.level !== lastLevel) {
        lastLevel = sim.level;
        fit();
        music.play(placeOf(sim.level).tune);
      }
      if (!paused) v.step(sim, dt);
      const k = Number(cv.dataset.k) || 1;
      const ctx = cv.getContext('2d');
      ctx.setTransform(k, 0, 0, k, 0, 0);
      ctx.imageSmoothingEnabled = false;
      v.draw(ctx, sim);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [sim, mode, net, paused, fit]);

  // the page's numbers (a few times a second is plenty)
  useEffect(() => {
    const read = () => {
      if (!sim.lvl) return;
      setHud({
        level: sim.level,
        phase: sim.phase,
        score: sim.score,
        goals: sim.goals.map((g) => ({ ...g })),
        portal: sim.portalOpen,
        freeze: sim.freezeT,
        players: sim.players.map((p) => ({ name: p.name, slot: p.slot, alive: p.alive, boost: p.boostT, got: p.got, hero: p.hero })),
        fresh: newFoes(sim.level),
      });
    };
    read();
    const id = setInterval(read, 110);
    return () => clearInterval(id);
  }, [sim]);

  useEffect(() => {
    if (hud?.phase === 'over' && !saved.current) {
      saved.current = true;
      setBest(writeBest(hud.level, hud.score));
      music.play('gameover');
    }
  }, [hud]);

  // the keys
  useEffect(() => {
    const down = (e) => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (mode === 'solo' || mode === 'local') setPaused((p) => !p);
        return;
      }
      const m = KEYS[e.code];
      if (!m) return;
      e.preventDefault();
      if (e.repeat) return;
      const who = mode === 'local' ? m[1] : me;
      if (mode === 'client') net.send({ t: 'in', id: net.id, d: m[0] });
      else sim.setWant(who, m[0]);
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [sim, mode, me, net, setPaused]);

  // a phone: swipe anywhere on the maze, or use the arrows
  const steer = useCallback((dir) => {
    if (mode === 'client') net.send({ t: 'in', id: net.id, d: dir });
    else sim.setWant(mode === 'local' ? 0 : me, dir);
  }, [sim, mode, me, net]);
  const touch = useRef(null);
  const onTouchStart = (e) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchMove = (e) => {
    const s = touch.current;
    if (!s) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.hypot(dx, dy) < 22) return;
    steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
    touch.current = { x: t.clientX, y: t.clientY };
  };

  const place = placeOf(hud?.level || 1);
  const alivePlayers = hud?.players.filter((p) => p.alive).length ?? 0;
  const canAgain = mode !== 'client';

  return (
    <div className="mz-run" style={{ '--mz-bg': place.bg }}>
      {hud && (
        <header className="mz-hud">
          <div className="mz-lvl">
            <b>Level {hud.level}</b>
            <span>{place.icon} {place.name}</span>
          </div>
          <div className="mz-goals" aria-label="Collect these">
            {hud.goals.map((g) => (
              <span key={g.kind} className={`mz-goal ${g.have >= g.need ? 'done' : ''}`} title={FRUIT_NAMES[g.kind]}>
                <img src={fruitUrl(g.kind)} alt={FRUIT_NAMES[g.kind]} />
                <i>{g.have}/{g.need}</i>
              </span>
            ))}
            <span className={`mz-portal ${hud.portal ? 'open' : ''}`}>🌀 {hud.portal ? 'Portal open! Run to it' : 'Portal locked'}</span>
          </div>
          <div className="mz-side">
            {hud.freeze > 0 && <span className="mz-chip ice"><img src={powerUrl('freeze')} alt="" /> {Math.ceil(hud.freeze)}s</span>}
            {hud.players.map((p) => (
              <span key={p.slot} className={`mz-chip ${p.alive ? '' : 'out'}`} style={{ borderColor: SLOT_COLORS[p.slot % SLOT_COLORS.length] }}>
                <Avatar assets={assets} id={p.hero} size={22} />
                {hud.players.length > 1 && <em>{p.name}</em>}
                {p.boost > 0 && <img src={powerUrl('boost')} alt="boost" />}
                {!p.alive && <b>☠</b>}
              </span>
            ))}
            <span className="mz-score">⭐ {hud.score}</span>
            {mode !== 'client' && <button type="button" className="mz-icon" aria-label={paused ? 'Resume' : 'Pause'} onClick={() => setPaused((p) => !p)}>{paused ? '▶' : '⏸'}</button>}
            <button type="button" className="mz-icon" aria-label="Leave the game" onClick={onExit}>✕</button>
          </div>
        </header>
      )}

      <div className="mz-stage" ref={wrap} onTouchStart={onTouchStart} onTouchMove={onTouchMove}>
        <canvas ref={canvas} className="mz-canvas" />

        {hud?.phase === 'intro' && (
          <div className="mz-banner">
            <small>Level {hud.level}</small>
            <b>{place.icon} {place.name}</b>
            <div className="mz-need">
              Collect {hud.goals.map((g) => <span key={g.kind}><img src={fruitUrl(g.kind)} alt="" /> ×{g.need}</span>)}
              <span>then reach the 🌀 portal</span>
            </div>
            {hud.fresh.length > 0 && <div className="mz-new">New enemy: {hud.fresh.map((k) => FOES[k].name).join(', ')}!</div>}
          </div>
        )}
        {hud?.phase === 'clear' && <div className="mz-banner clear"><b>Level clear!</b><small>Into the portal…</small></div>}
        {paused && (
          <div className="mz-over">
            <h2>Paused</h2>
            <div className="mz-row">
              <button type="button" className="btn go" onClick={() => setPaused(false)}>Keep playing</button>
              <button type="button" className="btn ghost" onClick={onExit}>Quit</button>
            </div>
          </div>
        )}
        {hud?.phase === 'over' && (
          <div className="mz-over">
            <h2>Game over</h2>
            <p>You got to <b>level {hud.level}</b> with <b>{hud.score}</b> points.</p>
            <p className="mz-best">Best: level {best.level} · {best.score} points</p>
            <div className="mz-row">
              {canAgain ? <button type="button" className="btn go" onClick={onAgain}>🍓 Play again</button> : <span className="mz-wait">Waiting for the host to start again…</span>}
              <button type="button" className="btn ghost" onClick={onExit}>Menu</button>
            </div>
          </div>
        )}
      </div>

      <footer className="mz-foot">
        {mode === 'local' ? (
          <span><b style={{ color: SLOT_COLORS[0] }}>P1</b> W A S D &nbsp;·&nbsp; <b style={{ color: SLOT_COLORS[1] }}>P2</b> ← ↑ ↓ →</span>
        ) : (
          <span>W A S D or the arrow keys · swipe on a phone</span>
        )}
        <span>{alivePlayers > 1 ? 'Everybody has to be caught for the game to end' : ''}</span>
      </footer>

      <div className="mz-pad" aria-hidden="true">
        {['up', 'left', 'down', 'right'].map((d) => (
          <button key={d} type="button" className={`mz-pad-${d}`} onPointerDown={(e) => { e.preventDefault(); steer(d); }}>{{ up: '▲', down: '▼', left: '◀', right: '▶' }[d]}</button>
        ))}
      </div>
    </div>
  );
}

// ---------- the menus around it ----------
export default function MazeGame({ assets, profile, onExit }) {
  const [stage, setStage] = useState('menu'); // menu | local | join | lobby | game
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paused, setPaused] = useState(false);
  const [run, setRun] = useState(null); // { sim, mode, me }
  const [lobby, setLobby] = useState(null); // { code, host, players: [{ id, name, hero }] }
  const [codeInput, setCodeInput] = useState('');
  const netRef = useRef(null);
  const lobbyRef = useRef(null);
  const runRef = useRef(null);
  const cleanups = useRef([]);
  const myHero = profile.cozyHero || profile.hero || retroId(1);
  const myName = (profile.name || 'Player').slice(0, 10);
  const [p2Hero, setP2Hero] = useState(() => retroId(myHero === retroId(6) ? 9 : 6));
  const best = readBest();

  useEffect(() => {
    music.play('menu');
    loadDecor().then(() => setLoading(false), () => setLoading(false));
  }, []);

  lobbyRef.current = lobby;
  runRef.current = run;

  const closeNet = useCallback(() => {
    for (const fn of cleanups.current) fn();
    cleanups.current = [];
    if (netRef.current) {
      netRef.current.send({ t: 'bye', id: netRef.current.id, host: !!netRef.current.isHost });
      netRef.current.close();
      netRef.current = null;
    }
  }, []);
  useEffect(() => closeNet, [closeNet]);

  const newSeed = () => `${makeId()}${makeId()}`;
  const startOffline = (players, mode) => {
    setPaused(false);
    setRun({ sim: new MazeSim({ runSeed: newSeed(), players }), mode, me: 0, players });
    setStage('game');
  };
  const solo = () => startOffline([{ id: 'p0', name: myName, hero: myHero }], 'solo');
  const local = () => startOffline([{ id: 'p0', name: 'P1', hero: myHero }, { id: 'p1', name: 'P2', hero: p2Hero }], 'local');

  // ---- online: the host ----
  const host = async () => {
    setError('');
    closeNet();
    const net = new MazeNet();
    netRef.current = net;
    net.isHost = true;
    const code = makeCode();
    try {
      await net.open(code);
    } catch (e) {
      setError(e.message);
      closeNet();
      return;
    }
    const seen = new Map(); // when each guest was last heard from
    const players = [{ id: net.id, name: myName, hero: myHero }];
    setLobby({ code, host: true, players: [...players] });
    const tell = () => {
      const l = lobbyRef.current;
      net.send({ t: 'lobby', code, players: l.players });
    };
    cleanups.current.push(net.on((m) => {
      const l = lobbyRef.current;
      if (!l) return;
      if (m.t === 'hello') {
        const started = runRef.current?.sim;
        if (started || l.players.length >= 4) {
          net.send({ t: 'busy', to: m.id, why: started ? 'That game has already started.' : 'That room is full (4 players).' });
          return;
        }
        if (!l.players.some((p) => p.id === m.id)) {
          const next = { ...l, players: [...l.players, { id: m.id, name: String(m.name || 'Friend').slice(0, 10), hero: m.hero }] };
          lobbyRef.current = next;
          setLobby(next);
        }
        seen.set(m.id, Date.now());
        tell();
      } else if (m.t === 'in' || m.t === 'hb') {
        seen.set(m.id, Date.now());
        const r = runRef.current;
        if (m.t === 'in' && r?.sim) {
          const slot = l.players.findIndex((p) => p.id === m.id);
          if (slot >= 0) r.sim.setWant(slot, m.d);
        }
      } else if (m.t === 'bye') {
        const r = runRef.current;
        const slot = l.players.findIndex((p) => p.id === m.id);
        if (slot > 0 && !r?.sim) {
          const next = { ...l, players: l.players.filter((p) => p.id !== m.id) };
          lobbyRef.current = next;
          setLobby(next);
          tell();
        } else if (slot > 0 && r?.sim?.players[slot]?.alive) {
          r.sim.players[slot].alive = false; // they left in the middle of a game: the rest play on
          r.sim.players[slot].moving = false;
        }
      }
    }));
    // guests that go quiet are dropped from the lobby
    const timer = setInterval(() => {
      const l = lobbyRef.current;
      if (!l || runRef.current?.sim) return;
      const gone = l.players.filter((p, i) => i > 0 && Date.now() - (seen.get(p.id) || 0) > 9000);
      if (gone.length) {
        const next = { ...l, players: l.players.filter((p) => !gone.includes(p)) };
        lobbyRef.current = next;
        setLobby(next);
        tell();
      }
    }, 3000);
    cleanups.current.push(() => clearInterval(timer));
    setStage('lobby');
  };

  const startOnline = () => {
    const l = lobbyRef.current;
    const net = netRef.current;
    if (!l || !net) return;
    const rs = newSeed();
    const sim = new MazeSim({ runSeed: rs, players: l.players });
    setPaused(false);
    setRun({ sim, mode: 'host', me: 0, players: l.players });
    net.send({ t: 'start', rs, players: l.players });
    setStage('game');
  };

  // ---- online: a guest ----
  const join = async () => {
    const code = codeInput.trim().toUpperCase();
    if (code.length < 4) {
      setError('Type the 4 letter code of the room.');
      return;
    }
    setError('');
    closeNet();
    const net = new MazeNet();
    netRef.current = net;
    try {
      await net.open(code);
    } catch (e) {
      setError(e.message);
      closeNet();
      return;
    }
    let heard = false;
    let lastSnap = Date.now();
    let myGame = null;
    cleanups.current.push(net.on((m) => {
      if (m.t === 'lobby') {
        heard = true;
        if (!m.players.some((p) => p.id === net.id)) return;
        setLobby({ code, host: false, players: m.players });
        setStage((s) => (s === 'game' ? s : 'lobby'));
      } else if (m.t === 'busy' && m.to === net.id) {
        setError(m.why);
        closeNet();
        setStage('join');
      } else if (m.t === 'start') {
        const me = m.players.findIndex((p) => p.id === net.id);
        if (me < 0) return;
        myGame = new MazeSim({ runSeed: m.rs, players: m.players, remote: true });
        lastSnap = Date.now();
        setPaused(false);
        setRun({ sim: myGame, mode: 'client', me, players: m.players, net });
        setStage('game');
      } else if (m.t === 's') {
        lastSnap = Date.now();
        if (myGame && m.rs === myGame.runSeed) myGame.applySnapshot(m);
      } else if (m.t === 'bye' && m.host) {
        setError('The host left the room.');
        closeNet();
        setRun(null);
        setLobby(null);
        setStage('join');
      }
    }));
    const hello = () => net.send({ t: 'hello', id: net.id, name: myName, hero: myHero });
    hello();
    const timer = setInterval(() => {
      if (!heard && !myGame) {
        hello();
      } else {
        net.send({ t: 'hb', id: net.id });
      }
      if (myGame && Date.now() - lastSnap > 8000) {
        setError('Lost the connection to the host.');
        closeNet();
        setRun(null);
        setLobby(null);
        setStage('join');
      }
    }, 2000);
    cleanups.current.push(() => clearInterval(timer));
    setTimeout(() => {
      if (!heard && netRef.current === net) {
        setError(`Nobody is hosting room ${code}.`);
        closeNet();
        setStage('join');
      }
    }, 6000);
    setStage('lobby');
    setLobby({ code, host: false, players: [{ id: net.id, name: myName, hero: myHero }], connecting: true });
  };

  const leave = () => {
    closeNet();
    setRun(null);
    setLobby(null);
    setStage('menu');
    music.play('menu');
  };

  // the host plays again: a new run for everybody in the room
  const again = () => {
    if (run?.mode === 'host') startOnline();
    else if (run?.mode === 'local') local();
    else solo();
  };

  if (stage === 'game' && run) {
    return <MazeRun key={run.sim.runSeed} assets={assets} sim={run.sim} mode={run.mode} me={run.me} net={run.net || netRef.current} paused={paused} setPaused={setPaused} onExit={leave} onAgain={again} />;
  }

  return (
    <div className="mz-menu">
      <div className="mz-card panel">
        <header className="mz-head">
          <span className="mz-logo"><img src={fruitUrl('strawberry')} alt="" /><img src={fruitUrl('cherry')} alt="" /><img src={fruitUrl('lemon')} alt="" /></span>
          <h1>Maze Rush</h1>
          <p>Collect every fruit on the list, dodge the monsters, then dive into the portal. It never ends: each level has a new place, more enemies and a faster chase.</p>
          {best.level > 0 && <small className="mz-best">Best so far: level {best.level} · {best.score} points</small>}
        </header>

        {stage === 'menu' && (
          <div className="mz-modes">
            <button type="button" className="mz-mode" onClick={solo} disabled={loading}>
              <b>🧍 Solo</b><small>W A S D or the arrow keys</small>
            </button>
            <button type="button" className="mz-mode" onClick={() => setStage('local')} disabled={loading}>
              <b>👥 Two players</b><small>One keyboard: P1 uses W A S D, P2 the arrows</small>
            </button>
            <button type="button" className="mz-mode" onClick={host} disabled={loading || !onlineAvailable}>
              <b>🌐 Host online</b><small>{onlineAvailable ? 'Get a room code for up to 4 friends' : 'Needs the online setup'}</small>
            </button>
            <button type="button" className="mz-mode" onClick={() => { setError(''); setStage('join'); }} disabled={loading || !onlineAvailable}>
              <b>🔑 Join online</b><small>{onlineAvailable ? 'Type a friend\'s room code' : 'Needs the online setup'}</small>
            </button>
            {loading && <small className="mz-load">Loading the places…</small>}
            {error && <div className="notice">{error}</div>}
          </div>
        )}

        {stage === 'local' && (
          <div className="mz-local">
            <h2>Two players, one keyboard</h2>
            <div className="mz-pick">
              <div><b style={{ color: SLOT_COLORS[0] }}>P1 · W A S D</b><Avatar assets={assets} id={myHero} size={56} /></div>
              <div><b style={{ color: SLOT_COLORS[1] }}>P2 · arrow keys</b><Avatar assets={assets} id={p2Hero} size={56} /></div>
            </div>
            <small>Pick P2's character</small>
            <div className="mz-heroes">
              {Array.from({ length: 32 }, (_, i) => retroId(i + 1)).filter((id) => id !== myHero).map((id) => (
                <button key={id} type="button" className={id === p2Hero ? 'on' : ''} onClick={() => setP2Hero(id)} aria-label={id}><Avatar assets={assets} id={id} size={34} /></button>
              ))}
            </div>
            <div className="mz-row">
              <button type="button" className="btn ghost" onClick={() => setStage('menu')}>← Back</button>
              <button type="button" className="btn go" onClick={local}>Start ➜</button>
            </div>
          </div>
        )}

        {stage === 'join' && (
          <div className="mz-local">
            <h2>Join a room</h2>
            <input className="mz-code-in" value={codeInput} maxLength={4} placeholder="CODE" autoComplete="off" onChange={(e) => setCodeInput(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && join()} />
            {error && <div className="notice">{error}</div>}
            <div className="mz-row">
              <button type="button" className="btn ghost" onClick={() => { setError(''); setStage('menu'); }}>← Back</button>
              <button type="button" className="btn go" onClick={join}>Join ➜</button>
            </div>
          </div>
        )}

        {stage === 'lobby' && lobby && (
          <div className="mz-local">
            <h2>{lobby.host ? 'Your room' : lobby.connecting ? 'Connecting…' : 'In the room'}</h2>
            <div className="mz-code">{lobby.code}</div>
            <small>{lobby.host ? 'Tell your friends this code (Multiplayer → Maze Rush → Join online).' : 'Waiting for the host to start the game.'}</small>
            <div className="mz-roster">
              {lobby.players.map((p, i) => (
                <span key={p.id} className="mz-chip" style={{ borderColor: SLOT_COLORS[i % SLOT_COLORS.length] }}>
                  <Avatar assets={assets} id={p.hero} size={30} /> <em>{p.name}{i === 0 ? ' 👑' : ''}</em>
                </span>
              ))}
            </div>
            {error && <div className="notice">{error}</div>}
            <div className="mz-row">
              <button type="button" className="btn ghost" onClick={leave}>← Leave</button>
              {lobby.host && <button type="button" className="btn go" onClick={startOnline}>Start ➜ ({lobby.players.length} player{lobby.players.length > 1 ? 's' : ''})</button>}
            </div>
          </div>
        )}

        {(stage === 'menu') && (
          <div className="mz-row">
            <button type="button" className="btn ghost" onClick={onExit}>← Main menu</button>
          </div>
        )}
        {stage === 'menu' && (
          <details className="mz-how">
            <summary>How it works</summary>
            <ul>
              <li>You keep running; press a direction and you turn at the next crossing. Press the opposite way to turn straight back.</li>
              <li>If an enemy touches you, you are caught. In a game with friends the run goes on until everybody is caught; whoever is caught comes back on the next level.</li>
              <li>❄ freezes every enemy for {5} seconds, ⚡ makes whoever takes it much faster for {7} seconds. More of them show up now and then.</li>
              <li>Enemies: slimes wander, skeletons chase, orcs lie in wait, bats flit about, and the wolves and bears hunt you down.</li>
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
