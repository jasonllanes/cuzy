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
import ControlsLayout from './ControlsLayout';
import ScreenSettings from './ScreenSettings';
import Hotbar from './Hotbar';
import SupplyBar from './SupplyBar';
import ShopPanel from './ShopPanel';
import StoragePanel from './StoragePanel';
import QtyPicker from './QtyPicker';
import RoomSettings, { Switch } from './RoomSettings';
import TouchControls from './TouchControls';
import { getControls, useControls } from '../game/controls';
import { COMMANDS } from '../game/commands';
import { hp100 } from '../game/stats';
import { mapNameOf } from '../game/maps';
import { weaponById, weaponIconFile } from '../game/weapons';
import Guide from './Guide';
import TrainingPanel from './TrainingPanel';
import AboutContent from './AboutContent';
import Avatar from './Avatar';
import EndingScene from './EndingScene';
import { GUNS, RECALL_CD, SHIELD_CD } from '../game/combat';
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
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem('cuzy-wavehud') !== 'closed';
    } catch {
      return true;
    }
  });
  const toggle = () => {
    setOpen((o) => {
      try {
        localStorage.setItem('cuzy-wavehud', o ? 'closed' : 'open');
      } catch {
        /* private window */
      }
      return !o;
    });
  };
  return (
    <div className={`hud wave-hud panel small ${withRoom ? 'with-room' : ''} ${open ? '' : 'folded'}`}>
      <div className="wave-title">
        {survival ? '☠️' : '🌊'} Wave <b>{Math.max(1, w.wave)}</b> / {w.total}
        <span className="wave-diff">{difficulty}</span>
        <button type="button" className="wave-fold" onClick={toggle} aria-label={open ? 'Fold the wave panel' : 'Open the wave panel'} title={open ? 'Fold' : 'Open'}>{open ? '▴' : '▾'}</button>
      </div>
      <div className="wave-sub">
        {prep ? <>Next wave in <b>{Math.ceil(w.timer)}s</b> · build and prepare!</> : <><b>{w.left}</b> monsters left</>}
      </div>
      {open && prep && w.coming && (
        <div className="wave-forecast">
          <div className="wave-forecast-h">Wave {w.wave + 1} brings {w.coming.reduce((n, [, c]) => n + c, 0)}:</div>
          <div className="wave-chips">
            {w.coming.map(([type, n]) => (
              <span className="wave-chip" key={type}><MonsterIcon type={type} size={36} /><b>×{n}</b></span>
            ))}
          </div>
        </div>
      )}
      {open && !prep && w.waveTotal > 0 && (
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
        <span>{survival ? '🚐' : '🏠'}</span>
        <b className="base-lv">Lv {(w.baseLevel || 0) + 1}</b>
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

export default function GameView({ assets, profile, net, session, onExit, onRoundWon, onJoinRoom, training = false, preview = false, trainingMap, onTrainingMap, onTrainingHero }) {
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
  const [intro, setIntro] = useState(() => (training || new URLSearchParams(window.location.search).has('nointro') ? 'done' : 'play'));
  const introRef = useRef(intro);
  const [mapOpen, setMapOpen] = useState(false);
  const [roomPause, setRoomPause] = useState(null); // set while the host has the room paused: { by }
  const [hostId, setHostId] = useState(session?.host ?? null);
  const [live, setLive] = useState(session?.room || null); // the room's settings as they are now (the host can change some during a round)
  const controls = useControls();
  const mobile = controls === 'mobile';
  const [roomSetOpen, setRoomSetOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false); // phones: the stats panel slides in from the left
  const [hudMenuOpen, setHudMenuOpen] = useState(false); // phones: the buttons down the right edge fold away
  const roomSetRef = useRef(false);
  const [confirm, setConfirm] = useState(null); // 'quit' or 'reset': asked before it happens
  const [aboutOpen, setAboutOpen] = useState(false); // About and credits, from the in-game menu
  const aboutRef = useRef(false);
  aboutRef.current = aboutOpen;
  const confirmRef = useRef(null);
  confirmRef.current = confirm;
  useEffect(() => {
    if (!gameRef.current) return;
    gameRef.current.touchMode = mobile;
    if (!mobile) gameRef.current.setTouchMove(0, 0);
  }, [mobile]);
  const [solo, setSolo] = useState(() => ({ allowMelee: true, allowThrow: true, target: 10 })); // the rules of a game against computer rivals
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
  const [storeOpen, setStoreOpen] = useState(false); // the chest at home
  const storeRef = useRef(false);
  const [box, setBox] = useState(() => Array(27).fill(null));
  const [qty, setQty] = useState(null); // asking how many to drop or move: { kind, side, i, max, id }
  const [chatText, setChatText] = useState('');
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
      } else if (m.t === 'settings' && m.room) {
        setLive((prev) => {
          // tell everybody what the host just changed
          const said = [];
          if (prev) {
            if (prev.allowMelee !== m.room.allowMelee) said.push(`melee is ${m.room.allowMelee ? 'on' : 'off'}`);
            if (prev.allowThrow !== m.room.allowThrow) said.push(`throwing is ${m.room.allowThrow ? 'on' : 'off'}`);
            if (prev.allowCheats !== m.room.allowCheats && (prev.allowCheats !== undefined || m.room.allowCheats)) said.push(`cheats are ${m.room.allowCheats ? 'allowed' : 'off'}`);
            if (prev.allowLate !== m.room.allowLate) said.push(`late join is ${m.room.allowLate ? 'on' : 'off'}`);
            if (prev.target !== m.room.target) said.push(`the target is now ${m.room.target}`);
            if (prev.max !== m.room.max) said.push(`max players is ${m.room.max}`);
            if (prev.streakMonsters !== m.room.streakMonsters && prev.streakMonsters !== undefined) said.push(`monster streaks are ${m.room.streakMonsters ? 'on' : 'off'}`);
          }
          if (said.length) pushToast(`⚙️ The host changed the room: ${said.join(', ')}.`);
          return m.room;
        });
      } else if (m.t === 'paused') {
        setRoomPause(m.on ? { by: m.by } : null);
      } else if (m.t === 'peer_leave') {
        if (m.host != null) setHostId(m.host);
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
      training,
      name: profile.name,
      net: session ? net : null,
      session,
      onHud: setHud,
      onAnnounce: (a) => setBanners([{ ...a, id: Math.random() }]),
      onInventory: setInventory,
      onStorage: setBox,
      onOpenStorage: () => setStoreOpen(true),
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
    game.touchMode = getControls() === 'mobile';
    if (preview) {
      game.combat.god = true; // the map preview: walk about as you like
      if (game.wave) game.wave.timer = 1e9; // (and no zombies come)
    }
    if (training) {
      game.cheats = true; // (God mode starts off, so lava, monsters and grenades can actually hurt you; switch it on in the training panel)
    }
    game.frozen = introRef.current === 'play' || introRef.current === 'wait';
    game.start();
    return () => {
      clearTimeout(toastTimer.current);
      game.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets, profile, session]);

  // a button picked from the folded-away menu closes it
  useEffect(() => {
    if (upgOpen || mapOpen || onlineOpen || paused || roomSetOpen || guideOpen) setHudMenuOpen(false);
  }, [upgOpen, mapOpen, onlineOpen, paused, roomSetOpen, guideOpen]);

  useEffect(() => {
    mapRef.current = mapOpen;
    pausedRef.current = paused;
    guideRef.current = guideOpen;
    upgRef.current = upgOpen || storeOpen || !!qty || roomSetOpen;
    roomSetRef.current = roomSetOpen;
    storeRef.current = storeOpen;
    chatRef.current = chatOpen;
  }, [mapOpen, paused, guideOpen, upgOpen, storeOpen, qty, roomSetOpen, chatOpen]);

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

  // finished or skipped the scene, but still waiting for the go: ask again now and then, so one lost message can't strand us
  useEffect(() => {
    if (intro !== 'wait' || !session) return undefined;
    const t = setInterval(() => net.send({ t: 'ready' }), 2500);
    return () => clearInterval(t);
  }, [intro]);

  // keep the game in step with the room's pause
  useEffect(() => {
    gameRef.current?.setRoomPaused(!!roomPause);
  }, [roomPause]);

  // P / the Pause button: alone it opens the pause menu; in a room the host pauses everybody, and the others are told why not
  const isHost = !!session && hostId === session.you;
  const togglePause = () => {
    if (introRef.current === 'play' || introRef.current === 'wait') return;
    if (!session) {
      setPaused((p) => !p);
    } else if (isHost) {
      net.send({ t: 'pause', on: !roomPause });
    } else {
      pushToast(roomPause ? `${roomPause.by} paused the game; they will resume it.` : 'Only the host can pause the room. Esc opens your menu, but the game keeps going for everyone.');
    }
  };
  const pauseRef = useRef(togglePause);
  pauseRef.current = togglePause;

  const finishIntro = () => {
    if (session) {
      net.send({ t: 'ready' });
      setIntro((i) => (i === 'play' ? 'wait' : i));
    } else {
      setIntro('out');
    }
  };

  useEffect(() => {
    if (gameRef.current) gameRef.current.paused = paused || mapOpen || guideOpen || upgOpen || storeOpen || !!qty || onlineOpen || aboutOpen;
    gameRef.current?.setStorageOpen(storeOpen);
  }, [paused, mapOpen, guideOpen, upgOpen, storeOpen, qty, onlineOpen, aboutOpen]);

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
      if (e.code === 'Enter' && !modal) {
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
      if (e.code === 'KeyZ' && !e.repeat && !modal && (!waves || survival)) {
        gameRef.current?.useSupply('hp');
      } else if (e.code === 'KeyX' && !e.repeat && !modal && (!waves || survival)) {
        gameRef.current?.useSupply('stam');
      } else if (e.code === 'Tab') {
        // Tab switches weapon: the next gun in Survival, the next sword in the Free Roam
        e.preventDefault();
        if (!e.repeat && !modal) gameRef.current?.switchWeapon();
      } else if (e.code === 'KeyB' || e.code === 'KeyU') {
        // B opens the shop (Upgrades in Wave Defense and Survival)
        e.preventDefault();
        if (!e.repeat && !mapRef.current && !pausedRef.current && !guideRef.current && !storeRef.current) setUpgOpen((o) => !o);
      } else if (e.code === 'KeyM') {
        if (!e.repeat && !upgRef.current && !pausedRef.current && !guideRef.current) setMapOpen((o) => !o);
      } else if (e.code === 'KeyG' && !mapRef.current && !pausedRef.current && !upgRef.current) {
        setGuideOpen((o) => !o);
      } else if (e.code === 'KeyP' && !e.repeat && (!modal || (pausedRef.current && !session))) {
        pauseRef.current();
      } else if (e.code === 'Escape') {
        if (confirmRef.current) setConfirm(null);
        else if (aboutRef.current) setAboutOpen(false);
        else if (roomSetRef.current) setRoomSetOpen(false);
        else if (storeRef.current) setStoreOpen(false);
        else if (upgRef.current) setUpgOpen(false);
        else if (guideRef.current) setGuideOpen(false);
        else if (mapRef.current) setMapOpen(false);
        else setPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [session, waves, survival]);

  // chat from players in other rooms (or the menu), so everyone online can talk
  useEffect(
    () =>
      net.on((m) => {
        if (m.t === 'gchat') setChatLog((l) => [...l.slice(-5), { id: Math.random(), name: `🌐 ${m.name}`, text: m.text }]);
      }),
    [net],
  );

  // whose avatar to show in the scoreboards
  const heroOf = (id) => (String(id) === String(session?.you ?? 'me') ? profile.hero : peers.find((p) => String(p.id) === String(id))?.hero);
  const addLog = (name, text, extra = {}) => setChatLog((l) => [...l.slice(-5), { id: Math.random(), name, text, ...extra }]);
  const sendChat = (e) => {
    e.preventDefault();
    const text = new FormData(e.currentTarget).get('msg').toString().trim();
    setChatOpen(false);
    setChatText('');
    if (!text) return;
    if (text.startsWith('-')) {
      // a command: it only ever runs on your own game
      if (/^-clear\b/i.test(text)) setChatLog([]);
      else addLog('⚙️', gameRef.current?.command(text) || '', { system: true });
      return;
    }
    gameRef.current?.sendChat(text);
    net.sendGlobal?.(text);
    addLog(profile.name, text, { mine: true });
  };
  const cheatsOn = !!gameRef.current?.cheats;
  const typed = chatText.trim().split(/\s+/)[0].toLowerCase();
  const hints = chatOpen && cheatsOn && (chatText === '' || chatText.startsWith('-')) ? COMMANDS.filter((c) => `-${c.name}`.startsWith(typed) || chatText === '') : [];

  return (
    <div className={`game ${mobile ? 'mobile' : ''}`}>
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
      <div className={`hud chat-log ${chatOpen ? 'open' : ''}`}>
        {chatLog.map((m) => (
          <div key={m.id} className={`chat-line ${m.mine ? 'mine' : ''} ${m.name === '⚔️' || m.system ? 'system' : ''}`}><b>{m.name}</b> {m.text}</div>
        ))}
        {chatOpen && (
          <div className="chat-box">
            {hints.length > 0 && (
              <div className="chat-hints" aria-label="Commands">
                <b>Commands</b>
                {hints.map((c) => (
                  <button key={c.name} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setChatText(`${c.usage.split(' ')[0]} `)}>
                    <code>{c.usage}</code> <span>{c.desc}</span>
                  </button>
                ))}
              </div>
            )}
            {!cheatsOn && <small className="chat-note">Cheats are off{session ? ' in this room' : ''}. Type a message and press Enter.</small>}
            <form onSubmit={sendChat}>
              <input
                name="msg"
                autoFocus
                maxLength={80}
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                placeholder={cheatsOn ? 'Say something, or type a command like -gold 100 (Enter to send, Esc to cancel)' : 'Say something nice… (Enter to send, Esc to cancel)'}
                autoComplete="off"
              />
            </form>
          </div>
        )}
      </div>

      {mobile && (
        <button type="button" className="hud stats-tab" onClick={() => setStatsOpen((o) => !o)} aria-label={statsOpen ? 'Hide stats' : 'Show stats'}>
          ❤ {hp100(hud.hp)} · ⭐ {hud.level || 1} <b>{statsOpen ? '◂' : '▸'}</b>
        </button>
      )}
      <div className={`hud hud-left-col ${mobile ? `mobile-slide ${statsOpen ? 'open' : ''}` : ''}`}>
        <div className="hud-left panel small">
          <div className="hud-name">{profile.name}</div>
          <div className="hud-line">🗺️ <b>{mapNameOf(profile.seed)}</b></div>
          <div className="hud-line">📍 {hud.tx}, {hud.ty}</div>
          <div className="hud-line">{dayIcon(hud.hour)} Day {hud.day} · {formatClock(hud.hour)}</div>
          <Meter icon="❤️" label="HP" value={hud.hp / hud.maxHp} tone="hp" text={`${Math.max(0, hp100(hud.hp))}/${hp100(hud.maxHp)}`} />
          <Meter icon="⭐" label={`Level ${hud.level || 1}`} value={(hud.xp || 0) / (hud.xpNeed || 40)} tone="xp" text={`Lv ${hud.level || 1}`} />
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
        <button className="btn guide-btn" onClick={() => setChatOpen(true)} title="Chat with everyone online">
          💬 Chat <kbd>Enter</kbd>
        </button>
        {waves && hud.wave?.kills && Object.keys(hud.wave.kills).length > 0 && (
          <div className="scoreboard panel small kill-board">
            <div className="score-title">💀 Most monsters killed</div>
            {Object.entries(hud.wave.kills)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([id, n], i) => {
                const mine = id === String(session?.you ?? 'me');
                const name = id === 'ally' ? '🤝 Helpers' : mine ? profile.name : peers.find((p) => String(p.id) === id)?.name || 'Survivor';
                return (
                  <div key={id} className={`score-row ${mine ? 'me' : ''}`}>
                    <span className="score-who">{id !== 'ally' && <Avatar assets={assets} id={heroOf(id)} />}{i === 0 ? '👑 ' : ''}{name}</span>
                    <b>{n}</b>
                  </div>
                );
              })}
          </div>
        )}
        {!session && hud.mkills && (
          <div className="scoreboard panel small">
            <div className="score-title">👹 First to {hud.mkills.target} monster kills</div>
            <div className="score-row me"><span className="score-who"><Avatar assets={assets} id={profile.hero} />{profile.name}</span><b>{hud.mkills.count}</b><i style={{ width: `${Math.min(100, (hud.mkills.count / hud.mkills.target) * 100)}%` }} /></div>
          </div>
        )}
        {!pvp && hud.fight && !hud.mkills && (
          <div className="scoreboard panel small">
            <div className="score-title">⚔️ First to {hud.fight.target} kills</div>
            {[...hud.fight.scores].sort((a, b) => b.kills - a.kills).map((s) => (
              <div key={s.id} className={`score-row ${s.me ? 'me' : ''}`}>
                <span className="score-who"><Avatar assets={assets} id={s.me ? profile.hero : s.hero} />{s.name}</span>
                <b>{s.kills}</b>
                <i style={{ width: `${Math.min(100, (s.kills / hud.fight.target) * 100)}%` }} />
              </div>
            ))}
          </div>
        )}
        {pvp && (
          <div className="scoreboard panel small">
            <div className="score-title">{session.room.winBy === 'monsters' ? '👹' : '⚔️'} First to {(live || session.room).target} {session.room.winBy === 'monsters' ? 'monster ' : ''}kills</div>
            {session.room.teams > 0 && TEAMS.slice(0, session.room.teams).map((t, i) => {
              const total = scores.filter((s) => s.team === i).reduce((n, s) => n + s.kills, 0);
              return (
                <div key={t.name} className="score-row team-row" style={{ '--team': t.color }}>
                  <span>{t.icon} {t.name} team</span>
                  <b>{total}</b>
                  <i style={{ width: `${Math.min(100, (total / (live || session.room).target) * 100)}%` }} />
                </div>
              );
            })}
            {[...scores].sort((a, b) => b.kills - a.kills).map((s) => (
              <div key={s.id} className={`score-row ${s.id === session.you ? 'me' : ''}`} style={s.team !== null && s.team !== undefined && TEAMS[s.team] ? { borderLeft: `4px solid ${TEAMS[s.team].color}` } : undefined}>
                <span className="score-who"><Avatar assets={assets} id={heroOf(s.id)} />{s.name}</span>
                <b>{s.kills}</b>
                <i style={{ width: `${Math.min(100, (s.kills / (live || session.room).target) * 100)}%` }} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="hud hud-right">
        <canvas ref={miniRef} width={80} height={80} className="minimap" onClick={() => setMapOpen(true)} title="Click the map to see all of it (or press M)" />
        <div className="zoom-box panel small">
          <button className="btn small-btn" aria-label="Zoom out" onClick={() => gameRef.current?.zoomBy(-1)}>−</button>
          <span>🔍</span>
          <button className="btn small-btn" aria-label="Zoom in" onClick={() => gameRef.current?.zoomBy(1)}>+</button>
        </div>
        <button type="button" className="coin-chip coin-drop" onClick={() => hud.coins > 0 && setQty({ kind: 'coins', max: hud.coins, id: 'coin' })} title={`${waves ? 'Coins for upgrades and helpers' : 'Coins for the shop'}. Click to drop some on the ground.`}>🪙 {hud.coins}</button>
        {mobile && <button className="btn small-btn" onClick={() => setHudMenuOpen((o) => !o)}>{hudMenuOpen ? '✕ Close' : '☰ More'}</button>}
        {(!mobile || hudMenuOpen) && (
          <>
        {!mobile && <button className="btn small-btn" onClick={() => setUpgOpen(true)}>🛒 Buy <kbd>B</kbd></button>}
        {mobile && <button className="btn small-btn" onClick={() => { setChatOpen(true); setHudMenuOpen(false); }}>💬 Chat</button>}
        {((session && isHost) || (!session && mode === 'free')) && <button className="btn small-btn" onClick={() => setRoomSetOpen(true)} title={session ? "Change the room's settings" : 'Change the rules of this game'}>⚙️ {session ? 'Room' : 'Rules'}</button>}
        <button className="btn small-btn" onClick={() => setPaused(true)}>☰ Menu <kbd>Esc</kbd></button>
          </>
        )}
      </div>

      <div className={`hud stamina ${hud.exhausted ? 'tired' : ''} ${hud.stamina < 0.995 ? 'show' : ''}`}>
        <span className="stamina-label">{hud.exhausted ? 'Catching breath…' : 'Stamina'}</span>
        <div className="stamina-track"><div className="stamina-fill" style={{ width: `${hud.stamina * 100}%` }} /></div>
      </div>
      {mobile && <TouchControls game={gameRef.current} hud={hud} survival={survival} waves={waves} onChat={() => setChatOpen(true)} onShop={() => setUpgOpen(true)} />}
      {!mobile && <div className="hud hud-help">WASD move · Shift sprint · Click sword · Hold click dash · F shield · Right-click {survival ? 'shoot' : 'throw'} · Space pick up · H recall{waves ? ' · Q/E turn wall' : ''} · 1-9/wheel select · Tab switch weapon· E eat · B buy · M map</div>}
      {(hud.hidden || hud.inWater) && (
        <div className="hud status-pill panel small">
          {hud.hidden ? '🏠 Hiding · nobody can see you' : '🌊 Wading · slow going'}
        </div>
      )}
      <button
        type="button"
        className={`hud recall-top ${hud.recallT > 0 ? 'active' : ''} ${hud.recallCd > 0 ? 'cooling' : ''}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => gameRef.current?.combat?.startRecall()}
        title={waves ? 'Stand still for 2.5 seconds to teleport back to the base' : 'Stand still for 2.5 seconds to teleport back home'}
      >
        <span>🏡 Teleport Home</span>
        <kbd>H</kbd>
        {hud.recallCd > 0 && <b>{Math.ceil(hud.recallCd)}s</b>}
        <i className="recall-cd" style={{ width: `${Math.min(100, (hud.recallCd / RECALL_CD) * 100)}%` }} />
      </button>
      <div className={`hud skills left ${survival ? 'with-gun' : ''}`}>
        {(waves || hud.util === 'shield' || !hud.util) && (
        <button
          className={`skill ${hud.shieldT > 0 ? 'active' : ''} ${hud.shieldCd > 0 ? 'cooling' : 'ready'}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => gameRef.current?.combat?.activateShield()}
          title={!waves && !hud.util ? 'Utility skill: buy the Shield or Invisibility in the shop (B)' : 'Shield: blocks all damage for 3 seconds (10 second cooldown)'}
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
        {waves && (
          <button
            className="skill ready"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => gameRef.current?.rotateWall()}
            title="Turn the wall you are about to place (Q or E). The number is how many boxes you have."
          >
            <span className="skill-icon">🔄</span>
            <kbd>Q</kbd>
            <span className="skill-num">{inventory.reduce((n, s) => n + (s && s.id === 'barricade' ? s.qty : 0), 0)}</span>
          </button>
        )}
        {!waves && hud.weapons && (
          <button className="skill weapon-skill" onMouseDown={(e) => e.preventDefault()} onClick={() => gameRef.current?.switchWeapon()} title={`${weaponById(hud.weapons.equipped).name}: press to switch swords (Tab)`}>
            <span className="wicon sm" style={{ backgroundImage: `url(${import.meta.env.BASE_URL}assets/${weaponIconFile(weaponById(hud.weapons.equipped))}.png)` }} />
            <kbd>Tab</kbd>
          </button>
        )}
      </div>
      <div className="hud skills right">
        <div className={`skill dash-skill ${hud.dashCd > 0 ? 'cooling' : 'ready'}`} title={hud.activeSkill ? 'Hold left click, then release to use your sword skill' : 'Sword skill: buy the Dash or the Spiral Sword in the shop (B)'}>
          <span className="skill-icon">{hud.activeSkill === 'spiral' ? '🌀' : hud.activeSkill === 'dash' ? '💨' : '🔒'}</span>
          <small>{hud.activeSkill ? 'hold click' : 'locked'}</small>
          <span className="skill-cd" style={{ height: `${Math.min(100, (hud.dashCd / (hud.activeSkill === 'spiral' ? 1.4 : 1.2)) * 100)}%` }} />
        </div>
      </div>
      {waves && (
        <div className={`hud throw-meter ${survival ? (hud.reloading ? 'locked' : '') : hud.tLocked ? 'locked' : ''}`}>
          <span>{survival ? (hud.reloading ? '🔄 Reloading…' : `${GUNS[hud.gun]?.icon || '🔫'} ${hud.ammo ?? 0} / ${GUNS[hud.gun]?.mag || 12}`) : hud.tLocked ? 'Catching your arm…' : '🪨 Throw'}</span>
          <div className="throw-track">
            <div className="throw-fill" style={{ width: `${survival ? (hud.reloading ? hud.reload : (hud.ammo ?? 0) / (GUNS[hud.gun]?.mag || 12)) * 100 : hud.tEnergy * 100}%` }} />
          </div>
        </div>
      )}
      {waves && hud.slowT > 0 && <div className="slowmo-tint" aria-hidden="true" />}
      {waves && hud.blastT > 0 && <div className="blast-flash" aria-hidden="true" style={{ opacity: Math.min(1, hud.blastT * 2) }} />}
      <div className="hud weather-chip" title="Sky and time">
        {hud.dungeon ? <span>🕳️ {hud.dungeon}</span> : hud.weather && !hud.weather.indoors ? <span>{hud.weather.icon} {hud.weather.name}</span> : <span>🏠 Indoors</span>}
        <span className="wc-sep">·</span>
        <b>{formatClock(hud.hour)}</b>
        <small>Day {hud.day}</small>
      </div>
      {waves && hud.wave && <WaveHud w={hud.wave} difficulty={live?.difficulty || difficulty} withRoom={!!session} survival={survival} />}
      {waves && hud.wave && (hud.wave.phase === 'victory' || hud.wave.phase === 'defeat') && (
        <EndingScene
          kind={hud.wave.phase}
          survival={survival}
          name={profile.name}
          stats={[
            { icon: '🌊', label: 'Wave reached', value: hud.wave.wave, text: (n) => `${n} / ${hud.wave.total}` },
            { icon: '💀', label: 'Monsters defeated', value: hud.kills || 0 },
            { icon: '⭐', label: 'Your level', value: hud.level || 1 },
            { icon: '🪙', label: 'Coins left', value: hud.coins || 0 },
            { icon: '☀️', label: 'Days survived', value: hud.day || 1 },
          ]}
          board={Object.entries(hud.wave.kills || {})
            .sort((a, b) => b[1] - a[1])
            .map(([id, n]) => {
              const me = id === String(session?.you ?? 'me');
              return { name: id === 'ally' ? '🤝 Helpers' : me ? profile.name : peers.find((p) => String(p.id) === id)?.name || 'Survivor', n, me };
            })}
          boardTitle="💀 Most monsters defeated"
          continueLabel={session ? 'Back to the room' : 'Back to the menu'}
          onContinue={() => (session ? net.send({ t: 'tolobby' }) : onExit())}
        />
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
      {(!waves || survival) && <SupplyBar cds={hud.cds} supplies={hud.supplies || { hp: 0, stam: 0, shield: 0 }} onUse={(k) => gameRef.current?.useSupply(k)} />}
      {banner && !hud.celeb && (
        <div key={banner.id} className={`kill-banner tier-${banner.tier} ${banner.mine ? 'mine' : ''}`} role="status">
          <b>{banner.title}</b>
          <span>{banner.sub}</span>
        </div>
      )}
      <Hotbar
        slots={inventory}
        selected={selected}
        onSelect={setSelected}
        onUse={(i) => gameRef.current?.useItem(i)}
        onMove={(a, b) => gameRef.current?.moveItem(a, b)}
        onDropOut={(i) => {
          const s = inventory[i];
          if (!s) return;
          if (s.qty > 1) setQty({ kind: 'drop', side: 'inv', i, max: s.qty, id: s.id });
          else gameRef.current?.dropItem('inv', i, 1);
        }}
      >
        {survival && hud.gun && (
          <button type="button" className="gun-slot" onClick={() => gameRef.current?.switchWeapon()} title={`${GUNS[hud.gun].name}: click or press Tab to switch`}>
            <span>{GUNS[hud.gun].icon}</span>
            <small>{GUNS[hud.gun].name}</small>
            <kbd>Tab</kbd>
          </button>
        )}
      </Hotbar>
      {hud.celeb && (
        <EndingScene
          key="round-end"
          kind="round"
          name={profile.name}
          winner={hud.celeb.name}
          mine={!!hud.celeb.mine}
          board={[...scores].sort((a, b) => (b.kills || 0) - (a.kills || 0)).map((s) => ({ name: s.name, n: s.kills || 0, me: String(s.id) === String(session?.you) }))}
          boardTitle="⚔️ Final scores"
          auto
        />
      )}
      {upgOpen && (waves
        ? <UpgradePanel hud={hud} game={gameRef.current} survival={survival} onClose={() => setUpgOpen(false)} />
        : <ShopPanel hud={hud} game={gameRef.current} onClose={() => setUpgOpen(false)} />)}
      {storeOpen && <StoragePanel inventory={inventory} box={box} game={gameRef.current} onAsk={setQty} onClose={() => setStoreOpen(false)} />}
      {roomSetOpen && !session && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setRoomSetOpen(false)}>
          <div className="panel room-settings-card">
            <header className="inv-head">
              <h2>⚙️ Game rules</h2>
              <button className="btn small-btn" onClick={() => setRoomSetOpen(false)} aria-label="Close">✕</button>
            </header>
            <section className="settings-panel">
              <div className="set-grid">
                <Switch label="Allow melee" hint="Sword, dash and spiral" on={solo.allowMelee} onChange={(v) => { setSolo((s) => ({ ...s, allowMelee: v })); if (gameRef.current) gameRef.current.rules = { ...gameRef.current.rules, melee: v }; }} />
                <Switch label="Allow throwing" hint="Right-click throws" on={solo.allowThrow} onChange={(v) => { setSolo((s) => ({ ...s, allowThrow: v })); if (gameRef.current) gameRef.current.rules = { ...gameRef.current.rules, throw: v }; }} />
                {!!profile.bots && (
                  <div className="set-row wide">
                    <div className="set-label"><b>Reach {solo.target} kills to win</b><small>Drag to change</small></div>
                    <input type="range" min={1} max={50} value={solo.target} onChange={(e) => { const n = Number(e.target.value); setSolo((s) => ({ ...s, target: n })); if (gameRef.current?.bots) gameRef.current.bots.target = n; }} />
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      )}
      {roomSetOpen && session && live && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setRoomSetOpen(false)}>
          <div className="panel room-settings-card">
            <header className="inv-head">
              <h2>⚙️ Room settings</h2>
              <button className="btn small-btn" onClick={() => setRoomSetOpen(false)} aria-label="Close">✕</button>
            </header>
            <RoomSettings room={live} count={peers.length} editable={isHost} onChange={(patch) => net.send({ t: 'settings', ...patch })} />
          </div>
        </div>
      )}
      {qty && (
        <QtyPicker
          id={qty.id}
          max={qty.max}
          verb={qty.kind === 'drop' || qty.kind === 'coins' ? 'Drop' : 'Move'}
          onCancel={() => setQty(null)}
          onConfirm={(n) => {
            if (qty.kind === 'coins') gameRef.current?.dropCoins(n);
            else if (qty.kind === 'drop') gameRef.current?.dropItem(qty.side, qty.i, n);
            else gameRef.current?.storeMove(qty.side, qty.i, n);
            setQty(null);
          }}
        />
      )}
      {training && !preview && <TrainingPanel game={gameRef} assets={assets} initial={profile.hero} map={trainingMap} onMap={onTrainingMap} onHero={onTrainingHero} onExit={onExit} />}
      {guideOpen && <Guide mode={survival ? 'survival' : waves ? 'waves' : 'free'} onClose={() => setGuideOpen(false)} />}
      {onlineOpen && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setOnlineOpen(false)}>
          <div className="panel online-panel">
            <header className="inv-head">
              <h2>🌐 Players online</h2>
              <button className="btn small-btn" onClick={() => setOnlineOpen(false)} aria-label="Close">✕</button>
            </header>
            <OnlinePlayers net={net} assets={assets} onJoinRoom={(code) => { setOnlineOpen(false); onJoinRoom?.(code); }} />
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

      {roomPause && (
        <div className="overlay room-pause" role="alertdialog" aria-label="Game paused">
          <div className="panel pause-card">
            <div className="trophy">⏸</div>
            <h2>Game paused</h2>
            <p className="hint">{isHost ? 'Everyone is waiting for you.' : `${roomPause.by} paused the game for everyone. It carries on when they resume.`}</p>
            {isHost && <button className="btn go" onClick={() => net.send({ t: 'pause', on: false })}>▶ Resume for everyone</button>}
          </div>
        </div>
      )}

      {confirm && (
        <div className="overlay confirm-overlay" onPointerDown={(e) => e.target === e.currentTarget && setConfirm(null)}>
          <div className="panel confirm-card" role="alertdialog" aria-label={confirm === 'quit' ? 'Quit?' : 'Reset the world?'}>
            <div className="confirm-icon">{confirm === 'quit' ? '🚪' : '⚠️'}</div>
            <h2>{confirm === 'quit' ? 'Are you going to quit?' : 'Are you sure you want to reset the world?'}</h2>
            <p>
              {confirm === 'quit'
                ? session
                  ? isHost
                    ? 'You will leave the room, and the host role passes to another player.'
                    : 'You will leave the room.'
                  : 'Your progress on this map is saved.'
                : 'This will remove all your skills, items and upgrades, and take you back to the basic character you started with.'}
            </p>
            <div className="confirm-actions">
              <button className="btn" onClick={() => setConfirm(null)}>{confirm === 'quit' ? 'No, stay' : 'No, keep playing'}</button>
              <button
                className="btn go danger"
                onClick={() => {
                  if (confirm === 'quit') onExit();
                  else {
                    gameRef.current?.resetProgress();
                    pushToast('The world was reset: back to the basic character.');
                  }
                  setConfirm(null);
                  setPaused(false);
                }}
              >
                {confirm === 'quit' ? 'Yes, quit' : 'Yes, reset it'}
              </button>
            </div>
          </div>
        </div>
      )}
      {aboutOpen && (
        <div className="overlay" onPointerDown={(e) => e.target === e.currentTarget && setAboutOpen(false)}>
          <div className="panel menu-card about-card">
            <section className="page about-page">
              <AboutContent />
              <div className="nav-row"><button type="button" className="btn go" onClick={() => setAboutOpen(false)}>Back to the game</button><span /></div>
            </section>
          </div>
        </div>
      )}
      {paused && (
        <div className="overlay" onPointerDown={(e) => e.target === e.currentTarget && setPaused(false)}>
          <div className="panel pause-card">
            <h2>Menu</h2>
            <p className="hint">{session ? 'The room keeps going while you are in this menu.' : 'The game is paused. Your progress is saved for this map.'}</p>
            <div className="pm-grid">
              <button className="btn" onClick={() => sfx.setMuted(!sfx.muted)} title="Sound effects on/off">{muted ? '🔇 Sound off' : '🔊 Sound on'}</button>
              <button className="btn" onClick={() => { setPaused(false); setOnlineOpen(true); }} title="See who is online and invite them">🌐 Online {onlineCount > 0 && <b>{onlineCount}</b>}</button>
              <button className="btn" onClick={() => { setPaused(false); setGuideOpen(true); }}>📖 Guide <kbd>G</kbd></button>
              <button className="btn" onClick={() => { setPaused(false); setAboutOpen(true); }}>ℹ️ About &amp; credits</button>
              {((session && isHost) || (!session && mode === 'free')) && <button className="btn" onClick={() => { setPaused(false); setRoomSetOpen(true); }}>⚙️ {session ? 'Room settings' : 'Game rules'}</button>}
              {session && <button className="btn" onClick={() => { setPaused(false); pauseRef.current(); }} title="The host pauses the game for everyone">⏸ Pause <kbd>P</kbd></button>}
              {isHost && !roomPause && <button className="btn" onClick={() => { net.send({ t: 'pause', on: true }); setPaused(false); }}>⏸ Pause for everyone</button>}
            </div>
            <div className="pause-b">
              <h3 className="settings-h">⚙ Settings</h3>
              <AudioSettings />
              <ScreenSettings />
              {mobile && <ControlsLayout />}
            </div>
            <div className="pm-foot">
              <button className="btn go" onClick={() => setPaused(false)}>Continue</button>
              <button className="btn" onClick={() => setConfirm('quit')}>🚪 Quit</button>
              <button className="btn ghost" onClick={() => setConfirm('reset')}>↺ Reset this world</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
