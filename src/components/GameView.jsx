import { useEffect, useRef, useState } from 'react';
import { Game } from '../game/engine';
import { World } from '../game/world';
import { heroById } from '../game/heroes';
import { emptyInventory } from '../game/inventory';
import MapPanel from './MapPanel';
import MonsterIcon from './MonsterIcon';
import { TEAMS } from '../game/teams';
import IntroScene from './IntroScene';
import OnlinePlayers from './OnlinePlayers';
import { sfx } from '../game/sfx';
import { INVIS_CD } from '../game/combat';
import AudioSettings from './AudioSettings';
import Hotbar from './Hotbar';
import SupplyBar from './SupplyBar';
import ShopPanel from './ShopPanel';
import Guide from './Guide';
import { RECALL_CD, SHIELD_CD } from '../game/combat';
import { setTheme } from '../game/items';
import RoomPanel from './RoomPanel';
import UpgradePanel from './UpgradePanel';

function formatClock(hour) {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour % 1) * 60 / 10) * 10;
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`;
}

function dayIcon(hour) {
  if (hour >= 5 && hour < 7.5) return '🌅';
  if (hour >= 7.5 && hour < 17.5) return '☀️';
  if (hour >= 17.5 && hour < 20) return '🌇';
  return '🌙';
}

// Top-of-screen status for Wave Defense: which wave, how many monsters, the base's health, the boss
function WaveHud({ w, difficulty, withRoom, survival }) {
  const prep = w.phase === 'prep';
  return (
    <div className={`hud wave-hud panel small ${withRoom ? 'with-room' : ''}`}>
      <div className="wave-title">
        {survival ? '☠️' : '🌊'} Wave <b>{Math.max(1, w.wave)}</b> / {w.total}
        <span className="wave-diff">{difficulty}</span>
      </div>
      <div className="wave-sub">
        {prep ? <>Next wave in <b>{Math.ceil(w.timer)}s</b> · build and prepare!</> : <><b>{w.left}</b> monsters left</>}
      </div>
      {prep && w.coming && (
        <div className="wave-forecast">
          <div className="wave-forecast-h">Wave {w.wave + 1} brings {w.coming.reduce((n, [, c]) => n + c, 0)}:</div>
          <div className="wave-chips">
            {w.coming.map(([type, n]) => (
              <span className="wave-chip" key={type}><MonsterIcon type={type} size={36} /><b>×{n}</b></span>
            ))}
          </div>
        </div>
      )}
      {!prep && w.waveTotal > 0 && (
        <div className="wave-forecast">
          <div className="wave-forecast-h">
            Still to spawn: <b>{w.queued}</b> of {w.waveTotal}
            <i className="spawn-track"><i style={{ width: `${((w.waveTotal - w.queued) / w.waveTotal) * 100}%` }} /></i>
          </div>
          {w.queued > 0 && w.queuedBy && (
            <div className="wave-chips">
              {w.queuedBy.map(([type, n]) => (
                <span className="wave-chip" key={type}><MonsterIcon type={type} size={36} /><b>×{n}</b></span>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="base-bar" title={`Base health ${Math.ceil(w.baseHp)} / ${w.baseMax}`}>
        <span>🏠</span>
        <div className="base-track"><div className={`base-fill ${w.baseHp / w.baseMax < 0.35 ? 'low' : ''}`} style={{ width: `${(w.baseHp / w.baseMax) * 100}%` }} /></div>
      </div>
      {w.boss && (
        <div className="boss-bar">
          <span>{w.boss.name}</span>
          <div className="boss-track"><div className="boss-fill" style={{ width: `${(w.boss.hp / w.boss.max) * 100}%` }} /></div>
        </div>
      )}
    </div>
  );
}

// Your current numbers; they turn green once an upgrade has raised them
function Stats({ s, upg }) {
  const u = upg || {};
  const cell = (icon, label, value, up) => (
    <span className={`stat ${up ? 'up' : ''}`} title={label}>{icon} <b>{value}</b></span>
  );
  return (
    <div className="hud-stats">
      {cell('🗡️', 'Melee damage per swing', s.melee.toFixed(1), u.melee > 0)}
      {cell(s.skill === 'spiral' ? '🌀' : '💨', s.skill === 'spiral' ? 'Spiral: radius in tiles, and its damage at full charge' : 'Dash: distance in tiles at full charge, and its damage', s.skillText, s.skill === 'spiral' ? u.spinrad > 0 || u.spindmg > 0 : u.dash > 0 || u.dashdmg > 0)}
      {cell('💥', 'Bonus damage on every throw', `+${s.throwBonus.toFixed(1)}`, u.throw > 0)}
      {cell('🎯', 'Seconds between throws', `${s.throwCd.toFixed(2)}s`, u.rapid > 0)}
    </div>
  );
}

function Meter({ icon, label, value, tone, text }) {
  return (
    <div className={`meter ${tone} ${value < 0.2 ? 'low' : ''}`} title={`${label}: ${text ?? `${Math.round(value * 100)}%`}`}>
      <span>{icon}</span>
      <div className="meter-track"><div className="meter-fill" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} /></div>
      {text && <span className="meter-text">{text}</span>}
    </div>
  );
}

export default function GameView({ assets, profile, net, session, onExit, onRoundWon }) {
  const canvasRef = useRef(null);
  const miniRef = useRef(null);
  const gameRef = useRef(null);
  const toastTimer = useRef(0);
  const mapRef = useRef(false);
  const selRef = useRef(0);
  const pausedRef = useRef(false);
  const mode = session ? session.room.mode : profile.mode;
  const difficulty = session ? session.room.difficulty : profile.difficulty;
  const survival = mode === 'survival';
  const waves = mode === 'waves' || survival;
  setTheme(survival ? 'apoc' : 'cozy'); // the icons in the hotbar and backpack follow the game type
  const [hud, setHud] = useState({ upg: null, coins: 0, wave: null, dead: null, tEnergy: 1, tLocked: false, recallCd: 0, recallT: 0, tx: 0, ty: 0, treasures: 0, foraged: 0, hp: 6, maxHp: 6, kills: 0, hidden: false, inWater: false, shieldT: 0, shieldCd: 0, dashCd: 0, stamina: 1, exhausted: false, sprinting: false, hour: 8, day: 1 });
  const [toast, setToast] = useState(null);
  const [paused, setPaused] = useState(false);
  // the opening scene: 'play' (watching), 'wait' (finished or skipped; in a room, waiting for the others), 'out' (fading away), 'done'
  const [intro, setIntro] = useState(() => (new URLSearchParams(window.location.search).has('nointro') ? 'done' : 'play'));
  const introRef = useRef(intro);
  const [mapOpen, setMapOpen] = useState(false);
  const [onlineOpen, setOnlineOpen] = useState(false); // the "players online" list
  const [onlineCount, setOnlineCount] = useState(() => net.online?.length || 0);
  const [muted, setMuted] = useState(sfx.muted);
  const [banners, setBanners] = useState([]);
  const banner = banners[0];
  // a new announcement replaces the old one straight away, so a fast chain of kills keeps up
  useEffect(() => {
    if (!banner) return undefined;
    const t = setTimeout(() => setBanners([]), 2600);
    return () => clearTimeout(t);
  }, [banner]);
  useEffect(() => sfx.on(() => setMuted(sfx.muted)), []);
  const [guideOpen, setGuideOpen] = useState(() => new URLSearchParams(window.location.search).has('guide'));
  const guideRef = useRef(false);
  const [upgOpen, setUpgOpen] = useState(false);
  const upgRef = useRef(false);
  const [inventory, setInventory] = useState(emptyInventory);
  const inventoryRef = useRef(inventory);
  const [selected, setSelected] = useState(0);
  const [peers, setPeers] = useState(() =>
    session ? [{ id: session.you, name: profile.name, hero: profile.hero }, ...session.players] : [],
  );
  const [chatOpen, setChatOpen] = useState(false);
  const [chatLog, setChatLog] = useState([]);
  const chatRef = useRef(false);
  const [scores, setScores] = useState(() => session?.scores || []);
  const pvp = !!session?.room.pvp;

  const pushToast = (text) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };

  // who is in the room, plus a little chat log
  useEffect(() => {
    if (!session) return undefined;
    const log = (name, text) => setChatLog((l) => [...l.slice(-4), { id: Math.random(), name, text }]);
    return net.on((m) => {
      if (m.t === 'peer_join') {
        setPeers((p) => [...p.filter((x) => x.id !== m.player.id), m.player]);
        pushToast(`${m.player.name} joined the room!`);
      } else if (m.t === 'peer_leave') {
        setPeers((p) => p.filter((x) => x.id !== m.id));
        pushToast(`${m.name} left the room.`);
        // the host runs the monsters, so the defence cannot go on without them
        if (session.room.mode === 'waves' && m.id === session.host) {
          pushToast('The host left, so the defence is over.');
          setTimeout(onExit, 2600);
        }
      } else if (m.t === 'chat') {
        log(m.name, m.text);
      } else if (m.t === 'scores') {
        setScores(m.scores);
      } else if (m.t === 'kill') {
        log('⚔️', `${m.killer} defeated ${m.victim}`);
      } else if (m.t === 'go') {
        // everyone has finished (or skipped) the opening scene
        setIntro((i) => (i === 'play' || i === 'wait' ? 'out' : i));
      } else if (m.t === 'disconnected') {
        setIntro((i) => (i === 'play' || i === 'wait' ? 'out' : i));
        pushToast('Lost connection to the room server.');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [net, session]);

  useEffect(() => {
    const game = new Game({
      canvas: canvasRef.current,
      minimap: miniRef.current,
      world: new World(profile.seed, { waves, theme: survival ? 'apoc' : 'cozy' }),
      mode,
      difficulty,
      bots: session ? 0 : Number(profile.bots) || 0,
      winBy: session ? session.room.winBy : profile.winBy,
      onRoundWon: session ? null : () => onRoundWon?.(),
      assets,
      hero: heroById(profile.hero),
      name: profile.name,
      net: session ? net : null,
      session,
      onHud: setHud,
      onAnnounce: (a) => setBanners([{ ...a, id: Math.random() }]),
      onInventory: setInventory,
      // the wheel hops over empty slots, as long as there is something to land on
      onHotbarScroll: (dir) =>
        setSelected((s) => {
          for (let step = 1; step <= 9; step++) {
            const i = (s + dir * step + 90) % 9;
            if (inventoryRef.current[i]) return i;
          }
          return (s + dir + 9) % 9;
        }),
      onToast: pushToast,
    });
    gameRef.current = game;
    game.frozen = introRef.current === 'play' || introRef.current === 'wait';
    game.start();
    return () => {
      clearTimeout(toastTimer.current);
      game.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets, profile, session]);

  useEffect(() => {
    mapRef.current = mapOpen;
    pausedRef.current = paused;
    guideRef.current = guideOpen;
    upgRef.current = upgOpen;
    chatRef.current = chatOpen;
  }, [mapOpen, paused, guideOpen, upgOpen, chatOpen]);

  // keep the latest backpack handy, and move on when the selected slot just ran out
  useEffect(() => {
    const before = inventoryRef.current;
    inventoryRef.current = inventory;
    if (!inventory[selected] && before[selected]) {
      for (let step = 1; step < 9; step++) {
        const i = (selected + step) % 9;
        if (inventory[i]) {
          setSelected(i);
          break;
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventory]);

  useEffect(() => {
    selRef.current = selected;
    if (gameRef.current) gameRef.current.selectedSlot = selected;
  }, [selected]);

  useEffect(() => {
    introRef.current = intro;
    const g = gameRef.current;
    if (g) {
      const wasFrozen = g.frozen;
      g.frozen = intro === 'play' || intro === 'wait';
      // the room's day clock starts when the scene ends, together for everyone
      if (wasFrozen && !g.frozen && g.mp) g.mp.clockAt = performance.now();
    }
    if (intro !== 'out') return undefined;
    const t = setTimeout(() => setIntro('done'), 700);
    return () => clearTimeout(t);
  }, [intro]);

  const finishIntro = () => {
    if (session) {
      net.send({ t: 'ready' });
      setIntro((i) => (i === 'play' ? 'wait' : i));
    } else {
      setIntro('out');
    }
  };

  useEffect(() => {
    if (gameRef.current) gameRef.current.paused = paused || mapOpen || guideOpen || upgOpen || onlineOpen;
  }, [paused, mapOpen, guideOpen, upgOpen, onlineOpen]);

  // how many others are online, for the button
  useEffect(() => {
    setOnlineCount(net.online?.length || 0);
    return net.on((m) => m.t === 'online' && setOnlineCount(m.players.length));
  }, [net]);

  useEffect(() => {
    const onKey = (e) => {
      if (introRef.current === 'play' || introRef.current === 'wait') return; // the opening scene has the keyboard
      // typing in the chat box: only Esc is ours
      if (e.target?.tagName === 'INPUT') {
        if (e.code === 'Escape') setChatOpen(false);
        return;
      }
      const modal = mapRef.current || pausedRef.current || guideRef.current || upgRef.current;
      if (e.code === 'Enter' && !modal && session) {
        e.preventDefault();
        setChatOpen(true);
        return;
      }
      const digit = /^Digit([1-9])$/.exec(e.code);
      if (digit && !modal) {
        setSelected(Number(digit[1]) - 1);
        return;
      }
      if (e.code === 'KeyE' && !e.repeat && !modal) {
        gameRef.current?.useItem(selRef.current);
        return;
      }
      if (e.code === 'KeyZ' && !e.repeat && !modal && !waves) {
        gameRef.current?.useSupply('hp');
      } else if (e.code === 'KeyX' && !e.repeat && !modal && !waves) {
        gameRef.current?.useSupply('stam');
      } else if (e.code === 'Tab' || e.code === 'KeyU') {
        // Tab opens the shop (Upgrades in Wave Defense and Survival)
        e.preventDefault();
        if (!e.repeat && !mapRef.current && !pausedRef.current && !guideRef.current) setUpgOpen((o) => !o);
      } else if (e.code === 'KeyM') {
        if (!e.repeat && !upgRef.current && !pausedRef.current && !guideRef.current) setMapOpen((o) => !o);
      } else if (e.code === 'KeyG' && !mapRef.current && !pausedRef.current && !upgRef.current) {
        setGuideOpen((o) => !o);
      } else if (e.code === 'Escape') {
        if (upgRef.current) setUpgOpen(false);
        else if (guideRef.current) setGuideOpen(false);
        else if (mapRef.current) setMapOpen(false);
        else setPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [session, waves]);

  const sendChat = (e) => {
    e.preventDefault();
    const text = new FormData(e.currentTarget).get('msg').toString().trim();
    setChatOpen(false);
    if (!text) return;
    gameRef.current?.sendChat(text);
    setChatLog((l) => [...l.slice(-4), { id: Math.random(), name: profile.name, text, mine: true }]);
  };

  return (
    <div className="game">
      <div className="game-canvas">
        <canvas ref={canvasRef} />
      </div>
      <div className="vignette" />

      {session && (
        <RoomPanel
          room={session.room}
          peers={peers}
          myId={session.you}
          lan={net.lan}
          onVisit={(id) => gameRef.current?.teleportToPeer(id)}
        />
      )}
      {session && (
        <div className="hud chat-log">
          {chatLog.map((m) => (
            <div key={m.id} className={`chat-line ${m.mine ? 'mine' : ''} ${m.name === '⚔️' ? 'system' : ''}`}><b>{m.name}</b> {m.text}</div>
          ))}
          {chatOpen && (
            <form onSubmit={sendChat}>
              <input name="msg" autoFocus maxLength={80} placeholder="Say something nice… (Enter to send, Esc to cancel)" autoComplete="off" />
            </form>
          )}
        </div>
      )}

      <div className="hud hud-left-col">
        <div className="hud-left panel small">
          <div className="hud-name">{profile.name}</div>
          <div className="hud-line">🌱 seed <b>{profile.seed}</b></div>
          <div className="hud-line">📍 {hud.tx}, {hud.ty}</div>
          <div className="hud-line">{dayIcon(hud.hour)} Day {hud.day} · {formatClock(hud.hour)}</div>
          <Meter icon="❤️" label="HP" value={hud.hp / hud.maxHp} tone="hp" text={`${Math.max(0, Math.round(hud.hp * 10) / 10)}/${hud.maxHp}`} />
          <Meter icon="⚡" label="Stamina" value={hud.stamina} tone="stam" text={`${Math.round(hud.stamina * (hud.stats?.staminaTotal || 100))}/${hud.stats?.staminaTotal || 100}`} />
          {hud.mount && (
            <Meter icon="💗" label={`${hud.mount.type === 'cow' ? 'Cow' : 'Chicken'} HP`} value={hud.mount.hp / hud.mount.maxHp} tone="hp" text={`${Math.max(0, Math.round(hud.mount.hp * 10) / 10)}/${hud.mount.maxHp}`} />
          )}
          {hud.mount && (
            <Meter
              icon={hud.mount.type === 'cow' ? '🐄' : '🐔'}
              label={`${hud.mount.type === 'cow' ? 'Cow' : 'Chicken'} stamina`}
              value={hud.mount.stamina}
              tone="stam"
              text={`${Math.round(hud.mount.stamina * hud.mount.total)}/${hud.mount.total}`}
            />
          )}
          {hud.stats && <Stats s={hud.stats} upg={hud.upg} />}
          <div className="hud-line">🎁 {hud.treasures} &nbsp; 🍓 {hud.foraged} &nbsp; 💀 {hud.kills}</div>
        </div>
        <button className="btn guide-btn" onClick={() => setGuideOpen(true)} title="Field guide: what every item gives">
          📖 Guide <kbd>G</kbd>
        </button>
        {!session && hud.mkills && (
          <div className="scoreboard panel small">
            <div className="score-title">👹 First to {hud.mkills.target} monster kills</div>
            <div className="score-row me"><span>{profile.name}</span><b>{hud.mkills.count}</b><i style={{ width: `${Math.min(100, (hud.mkills.count / hud.mkills.target) * 100)}%` }} /></div>
          </div>
        )}
        {!pvp && hud.fight && !hud.mkills && (
          <div className="scoreboard panel small">
            <div className="score-title">⚔️ First to {hud.fight.target} kills</div>
            {[...hud.fight.scores].sort((a, b) => b.kills - a.kills).map((s) => (
              <div key={s.id} className={`score-row ${s.me ? 'me' : ''}`}>
                <span>{s.name}</span>
                <b>{s.kills}</b>
                <i style={{ width: `${Math.min(100, (s.kills / hud.fight.target) * 100)}%` }} />
              </div>
            ))}
          </div>
        )}
        {pvp && (
          <div className="scoreboard panel small">
            <div className="score-title">{session.room.winBy === 'monsters' ? '👹' : '⚔️'} First to {session.room.target} {session.room.winBy === 'monsters' ? 'monster ' : ''}kills</div>
            {session.room.teams > 0 && TEAMS.slice(0, session.room.teams).map((t, i) => {
              const total = scores.filter((s) => s.team === i).reduce((n, s) => n + s.kills, 0);
              return (
                <div key={t.name} className="score-row team-row" style={{ '--team': t.color }}>
                  <span>{t.icon} {t.name} team</span>
                  <b>{total}</b>
                  <i style={{ width: `${Math.min(100, (total / session.room.target) * 100)}%` }} />
                </div>
              );
            })}
            {[...scores].sort((a, b) => b.kills - a.kills).map((s) => (
              <div key={s.id} className={`score-row ${s.id === session.you ? 'me' : ''}`} style={s.team !== null && s.team !== undefined && TEAMS[s.team] ? { borderLeft: `4px solid ${TEAMS[s.team].color}` } : undefined}>
                <span>{s.name}</span>
                <b>{s.kills}</b>
                <i style={{ width: `${Math.min(100, (s.kills / session.room.target) * 100)}%` }} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="hud hud-right">
        <canvas ref={miniRef} width={80} height={80} className="minimap" onClick={() => setMapOpen(true)} title="Click or press M for the big map" />
        <div className="zoom-box panel small">
          <button className="btn small-btn" aria-label="Zoom out" onClick={() => gameRef.current?.zoomBy(-1)}>−</button>
          <span>🔍</span>
          <button className="btn small-btn" aria-label="Zoom in" onClick={() => gameRef.current?.zoomBy(1)}>+</button>
        </div>
        <div className="coin-chip" title={waves ? 'Coins for upgrades and helpers' : 'Coins for the shop'}>🪙 {hud.coins}</div>
        <button className="btn small-btn" onClick={() => setUpgOpen(true)}>{waves ? '⬆ Upgrades' : '🛒 Shop'} <kbd>Tab</kbd></button>
        <button className="btn small-btn" onClick={() => sfx.setMuted(!sfx.muted)} title="Sound effects on/off">{muted ? '🔇 Sound off' : '🔊 Sound on'}</button>
        <button className="btn small-btn" onClick={() => setMapOpen(true)}>🗺️ Map <kbd>M</kbd></button>
        <button className="btn small-btn" onClick={() => setOnlineOpen(true)} title="See who is online and invite them">🌐 Online {onlineCount > 0 && <b>{onlineCount}</b>}</button>
        <button className="btn small-btn" onClick={() => setPaused(true)}>☰ Menu</button>
      </div>

      <div className={`hud stamina ${hud.exhausted ? 'tired' : ''} ${hud.stamina < 0.995 ? 'show' : ''}`}>
        <span className="stamina-label">{hud.exhausted ? 'Catching breath…' : 'Stamina'}</span>
        <div className="stamina-track"><div className="stamina-fill" style={{ width: `${hud.stamina * 100}%` }} /></div>
      </div>
      <div className="hud hud-help">WASD move · Shift sprint · Click sword · Hold click dash · F shield · Right-click throw · Space pick up · H recall{waves ? ' · Q barricade' : ''} · 1-9/wheel select · E eat · Tab shop · M map · G guide</div>
      {(hud.hidden || hud.inWater) && (
        <div className="hud status-pill panel small">
          {hud.hidden ? '🏠 Hiding · nobody can see you' : '🌊 Wading · slow going'}
        </div>
      )}
      <div className="hud skills">
        {(waves || hud.util === 'shield' || !hud.util) && (
        <button
          className={`skill ${hud.shieldT > 0 ? 'active' : ''} ${hud.shieldCd > 0 ? 'cooling' : 'ready'}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => gameRef.current?.combat?.activateShield()}
          title={!waves && !hud.util ? 'Utility skill: buy the Shield or Invisibility in the shop (Tab)' : 'Shield: blocks all damage for 3 seconds (10 second cooldown)'}
        >
          <span className="skill-icon">{!waves && !hud.util ? '🔒' : '🛡️'}</span>
          <kbd>F</kbd>
          <span className="skill-cd" style={{ height: `${Math.min(100, (hud.shieldCd / SHIELD_CD) * 100)}%` }} />
          {hud.shieldCd > 0 && <span className="skill-num">{Math.ceil(hud.shieldCd)}</span>}
        </button>
        )}
        {!waves && hud.util === 'invis' && (
          <button
            className={`skill ${hud.invisT > 0 ? 'active' : ''} ${hud.invisCd > 0 ? 'cooling' : 'ready'}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => gameRef.current?.combat?.activateInvis()}
            title="Invisibility: enemies cannot see you for 4 seconds (25 second cooldown)"
          >
            <span className="skill-icon">👻</span>
            <kbd>C</kbd>
            <span className="skill-cd" style={{ height: `${Math.min(100, (hud.invisCd / INVIS_CD) * 100)}%` }} />
            {hud.invisCd > 0 && <span className="skill-num">{Math.ceil(hud.invisCd)}</span>}
          </button>
        )}
        <button
          className={`skill ${hud.recallT > 0 ? 'active' : ''} ${hud.recallCd > 0 ? 'cooling' : 'ready'}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => gameRef.current?.combat?.startRecall()}
          title={waves ? 'Recall: stand still for 2.5 seconds to teleport back to the base' : 'Recall: stand still for 2.5 seconds to teleport back home'}
        >
          <span className="skill-icon">🏡</span>
          <kbd>H</kbd>
          <span className="skill-cd" style={{ height: `${Math.min(100, (hud.recallCd / RECALL_CD) * 100)}%` }} />
          {hud.recallCd > 0 && <span className="skill-num">{Math.ceil(hud.recallCd)}</span>}
        </button>
        {waves && (
          <button
            className="skill ready"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => gameRef.current?.placeBarricade()}
            title="Place a barricade box where your cursor points"
          >
            <span className="skill-icon">🌳</span>
            <kbd>Q</kbd>
            <span className="skill-num">{inventory.reduce((n, s) => n + (s && s.id === 'barricade' ? s.qty : 0), 0)}</span>
          </button>
        )}
        <div className={`skill dash-skill ${hud.dashCd > 0 ? 'cooling' : 'ready'}`} title={hud.activeSkill ? 'Hold left click, then release to use your sword skill' : 'Sword skill: buy the Dash or the Spiral Sword in the shop (Tab)'}>
          <span className="skill-icon">{hud.activeSkill === 'spiral' ? '🌀' : hud.activeSkill === 'dash' ? '💨' : '🔒'}</span>
          <small>{hud.activeSkill ? 'hold click' : 'locked'}</small>
          <span className="skill-cd" style={{ height: `${Math.min(100, (hud.dashCd / (hud.activeSkill === 'spiral' ? 1.4 : 1.2)) * 100)}%` }} />
        </div>
      </div>
      {waves && (
        <div className={`hud throw-meter ${hud.tLocked ? 'locked' : ''}`}>
          <span>{hud.tLocked ? 'Catching your arm…' : '🪨 Throw'}</span>
          <div className="throw-track"><div className="throw-fill" style={{ width: `${hud.tEnergy * 100}%` }} /></div>
        </div>
      )}
      {waves && hud.wave && <WaveHud w={hud.wave} difficulty={difficulty} withRoom={!!session} survival={survival} />}
      {waves && hud.wave && (hud.wave.phase === 'victory' || hud.wave.phase === 'defeat') && (
        <div className="overlay">
          <div className="panel result-card">
            <div className="trophy">{hud.wave.phase === 'victory' ? '🏆' : '💔'}</div>
            <h2>{hud.wave.phase === 'victory' ? 'The base held! You win!' : 'The base fell…'}</h2>
            <p>
              {hud.wave.phase === 'victory'
                ? 'All 10 waves defeated, and the Crushing Cyclops too. Well defended!'
                : `You made it to wave ${hud.wave.wave} of ${hud.wave.total}. Rebuild and try again!`}
            </p>
            <button className="btn go" onClick={onExit}>Back to the menu</button>
          </div>
        </div>
      )}
      {hud.dead && (
        <div className="death-overlay">
          <div className="death-card panel">
            <div className="death-skull">💀</div>
            <h2>{hud.dead.name ? <>You were killed by <b>{hud.dead.name}</b></> : 'You were knocked out'}</h2>
            <p>Respawning in <b>{Math.ceil(hud.dead.left)}</b>…</p>
            <div className="death-track"><div className="death-fill" style={{ width: `${(1 - hud.dead.left / hud.dead.total) * 100}%` }} /></div>
            {hud.dead.name && <small>The red marker shows where they are.</small>}
          </div>
        </div>
      )}
      {!waves && <SupplyBar supplies={hud.supplies || { hp: 0, stam: 0, shield: 0 }} onUse={(k) => gameRef.current?.useSupply(k)} />}
      {banner && !hud.celeb && (
        <div key={banner.id} className={`kill-banner tier-${banner.tier} ${banner.mine ? 'mine' : ''}`} role="status">
          <b>{banner.title}</b>
          <span>{banner.sub}</span>
        </div>
      )}
      <Hotbar slots={inventory} selected={selected} onSelect={setSelected} onUse={(i) => gameRef.current?.useItem(i)} />
      {hud.celeb && (
        <div className="winner-banner">
          <div className="winner-card panel">
            <div className="trophy">🏆</div>
            <h2>{hud.celeb.mine ? 'You win the round!' : `${hud.celeb.name} wins the round!`}</h2>
            <p>{hud.celeb.sub}</p>
          </div>
        </div>
      )}
      {upgOpen && (waves
        ? <UpgradePanel hud={hud} game={gameRef.current} survival={survival} onClose={() => setUpgOpen(false)} />
        : <ShopPanel hud={hud} game={gameRef.current} onClose={() => setUpgOpen(false)} />)}
      {guideOpen && <Guide onClose={() => setGuideOpen(false)} />}
      {onlineOpen && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setOnlineOpen(false)}>
          <div className="panel online-panel">
            <header className="inv-head">
              <h2>🌐 Players online</h2>
              <button className="btn small-btn" onClick={() => setOnlineOpen(false)} aria-label="Close">✕</button>
            </header>
            <OnlinePlayers net={net} assets={assets} />
          </div>
        </div>
      )}
      {mapOpen && <MapPanel game={gameRef.current} onClose={() => setMapOpen(false)} />}
      {toast && <div className="toast panel small">✨ {toast}</div>}
      {intro === 'play' && <IntroScene kind={survival ? 'survival' : mode === 'waves' ? 'waves' : 'free'} name={profile.name} fight={pvp || Number(profile.bots) > 0} onDone={finishIntro} />}
      {intro === 'wait' && (
        <div className="intro-wait" role="status">
          <div><span className="splash-dot" /> Gathering acorns…</div>
          <small>Waiting for the others to arrive</small>
        </div>
      )}
      {intro === 'out' && <div className="intro-fade" />}

      {paused && (
        <div className="overlay">
          <div className="panel pause-card">
            <h2>Taking a breather</h2>
            <p className="hint">Your progress is saved for this seed.</p>
            <h3 className="settings-h">⚙ Settings</h3>
            <AudioSettings />
            <button className="btn go" onClick={() => setPaused(false)}>Keep exploring</button>
            <button className="btn" onClick={onExit}>Back to hero select</button>
            <button
              className="btn ghost"
              onClick={() => {
                gameRef.current?.resetProgress();
                setPaused(false);
              }}
            >
              Reset this world's progress
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
