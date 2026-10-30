import ControlToggle from './components/ControlToggle';
import { useEffect, useRef, useState } from 'react';
import { loadAssets } from './game/assets';
import { retroId } from './game/heroes';
import { sfx } from './game/sfx';
import { music } from './game/music';
import { Net } from './game/net';
import { SupaNet } from './game/supaNet';
import { cloudOn, rawClient, store } from './game/store';
import MainMenu from './components/MainMenu';
import { FREE_MAPS } from './game/maps';
import GameView from './components/GameView';
import TrainingV2 from './v2/TrainingV2';
import AccessGate from './components/AccessGate';
import { isUnlocked } from './game/access';
import WaitingRoom from './components/WaitingRoom';
import InviteToasts from './components/InviteToasts';

const PROFILE_KEY = 'cuzi-profile';
const REJOIN_KEY = 'cuzy-rejoin';
const REJOIN_MAX_AGE = 6 * 60 * 60 * 1000; // a room you were in is only offered again for a few hours

// The room you are in is remembered by this tab, so reloading the page puts you back in it (another tab is not pulled in)
const rejoinGet = () => {
  try {
    const r = JSON.parse(window.sessionStorage.getItem(REJOIN_KEY));
    return r && r.code && Date.now() - r.at < REJOIN_MAX_AGE ? r : null;
  } catch {
    return null;
  }
};
const rejoinSet = (patch) => {
  try {
    const old = JSON.parse(window.sessionStorage.getItem(REJOIN_KEY)) || {};
    window.sessionStorage.setItem(REJOIN_KEY, JSON.stringify({ ...old, ...patch, at: Date.now() }));
  } catch {
    /* storage may be unavailable */
  }
};
const rejoinClear = () => {
  try {
    window.sessionStorage.removeItem(REJOIN_KEY);
  } catch {
    /* storage may be unavailable */
  }
};

// resolves true once the room connection is up (false if it takes too long)
const whenOnline = (net, ms) =>
  new Promise((resolve) => {
    if (net.status === 'online') return resolve(true);
    const timer = setTimeout(() => {
      off();
      resolve(false);
    }, ms);
    const off = net.on((m) => {
      if (m.t === 'status' && net.status === 'online') {
        clearTimeout(timer);
        off();
        resolve(true);
      }
    });
    return undefined;
  });

function initialProfile() {
  let saved = {};
  try {
    saved = JSON.parse(store.get(PROFILE_KEY)) || {};
  } catch {
    /* ignore */
  }
  const q = new URLSearchParams(window.location.search);
  return {
    name: q.get('name') || saved.name || '',
    hero: q.get('hero') || saved.hero || retroId(1),
    cozyHero: saved.cozyHero,
    survColor: saved.survColor,
    seed: q.get('seed') || saved.seed || 'sunny-meadow-101',
    mode: q.get('mode') || saved.mode || 'free',
    difficulty: q.get('difficulty') || saved.difficulty || 'medium',
    bots: Number(q.get('bots')) || saved.bots || 0,
    winBy: q.get('winBy') || saved.winBy || 'duel',
  };
}

export default function App() {
  useEffect(() => {
    // every button gives a soft click; this is also the first user gesture that lets audio start
    const onClick = (e) => {
      if (e.target.closest?.('button')) sfx.play('click');
    };
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, []);
  const [assets, setAssets] = useState(null);
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState(initialProfile);
  const [playing, setPlaying] = useState(() => new URLSearchParams(window.location.search).has('play'));
  const [session, setSession] = useState(null); // set while inside a multiplayer room
  const [lobby, setLobby] = useState(false); // true while the room is waiting for its host to press Start
  const [invites, setInvites] = useState([]); // pop-up invitations from other players
  const [training, setTraining] = useState(() => /[#?&/]training(?!-v2)\b/.test(`${window.location.hash}${window.location.search}`)); // the developer training ground (#/training)
  const [trainingV2, setTrainingV2] = useState(() => /[#?&/]training-v2\b/.test(`${window.location.hash}${window.location.search}`)); // the Free Roam V2 training room (#/training-v2)
  const [v2Mode, setV2Mode] = useState(false); // the main menu in Free Roam V2 mode: the same game, with the modern props in its worlds
  const [, setAccessTick] = useState(0); // re-render once the access code has been accepted
  const [trainingMap, setTrainingMap] = useState(FREE_MAPS[0].id); // the training ground's map and hero survive a map swap
  const [trainingHero, setTrainingHero] = useState('retro:1');
  const [pendingInvite, setPendingInvite] = useState(''); // an accepted invitation: the name and character page for that room
  const [notice, setNotice] = useState(''); // something to tell the player on the main menu
  // a room we were in before the page was reloaded: we try to go back to it once everything has loaded
  const [reconnect, setReconnect] = useState(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.has('play') || q.has('room') || /[#?&/]training(?!-v2)\b/.test(`${window.location.hash}${window.location.search}`)) return null;
    return rejoinGet();
  });
  const reconnectTried = useRef(false);
  const netRef = useRef(null);
  // with Supabase configured, rooms run on it (works on GitHub Pages); otherwise on the local room server (npm run dev)
  if (!netRef.current) netRef.current = cloudOn ? new SupaNet(rawClient) : new Net();
  const net = netRef.current;

  useEffect(() => {
    // the cloud copy of your profile and saves is pulled in while the art loads (it gives up after a few seconds)
    Promise.all([loadAssets(), store.sync()]).then(([a]) => {
      setProfile(initialProfile());
      setAssets(a);
    }, setError);
  }, []);

  // background music: a tune for the menus
  const playingNow = playing && !(session && lobby);
  // (while a game is on screen it picks its own: the opening scene, the map, the ending)
  const tune = training || trainingV2 || playingNow ? null : v2Mode ? 'city' : 'menu';
  useEffect(() => {
    if (tune) music.play(tune);
  }, [tune]);

  // who we are, for the "players online" list everyone can see
  useEffect(() => {
    net.setIdentity?.({ name: profile.name.trim() || 'Friend', hero: profile.cozyHero || profile.hero });
  }, [net, profile.name, profile.hero, profile.cozyHero]);

  // an invitation arrives, wherever we are; it fades after a while on its own
  useEffect(
    () =>
      net.on((m) => {
        if (m.t !== 'invite') return;
        setInvites((list) => [...list.filter((i) => !(i.from.id === m.from.id && i.code === m.code)), { ...m, key: Math.random() }].slice(-3));
      }),
    [net],
  );

  // a won round sends everyone back to the room's waiting area
  useEffect(
    () =>
      net.on((m) => {
        if (m.t !== 'lobby') return;
        setSession((s) => (s ? { ...s, room: m.room || s.room, teams: m.teams || {}, host: m.host, players: m.players.filter((p) => p.id !== s.you), scores: m.scores } : s));
        setLobby(true);
      }),
    [net],
  );

  // keep what we need to come back to this room after a reload (and its settings, in case the room is gone by then)
  useEffect(
    () =>
      net.on((m) => {
        if (!['settings', 'start', 'lobby'].includes(m.t) || !m.room) return;
        const patch = { code: m.room.code, room: m.room };
        if (m.t === 'start') patch.started = true;
        else if (m.t === 'lobby') patch.started = false;
        rejoinSet(patch);
      }),
    [net],
  );

  const remember = (p) => {
    const next = { ...p, name: p.name.trim() || 'Friend', seed: p.seed.trim() || 'sunny-meadow-101' };
    setProfile(next);
    try {
      store.set(PROFILE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    return next;
  };

  // typed once, kept for good
  const saveName = (n) => remember({ ...profile, name: n });

  // every new game starts clean: drop whatever was saved for this seed (backpack, shop upgrades, spot in the world)
  const wipeSave = (seed) => {
    try {
      store.remove(`cuzi-save:${seed}`);
    } catch {
      /* storage may be unavailable */
    }
  };

  const begin = (p) => {
    wipeSave(remember(p).seed);
    setSession(null);
    setPlaying(true);
  };

  // `joined` is the server's reply to create/join; the room decides the world seed
  // `back` is set when we are returning to a room after a reload: whatever was saved for the map is kept
  const enterRoom = (p, joined, back = null) => {
    const next = remember(p);
    if (!back) wipeSave(joined.room.seed);
    setProfile({ ...next, seed: joined.room.seed });
    setSession({ ...joined, clockAt: performance.now(), keepSave: !!back?.keepSave, autoStart: !!back?.autoStart });
    setLobby(!joined.started);
    setPlaying(true);
    setPendingInvite('');
    rejoinSet({ code: joined.room.code, room: joined.room, started: !!joined.started, name: next.name, hero: p.hero, host: joined.host === joined.you });
  };

  // After a reload: back into the room we were in. If the room closed in the meantime (we were alone in it), open it again
  // with the same rules, and carry straight on if the round had started.
  useEffect(() => {
    if (!assets || !reconnect || reconnectTried.current) return;
    reconnectTried.current = true;
    const rec = reconnect;
    (async () => {
      const me = { name: (rec.name || profile.name || '').trim() || 'Friend', hero: rec.hero || profile.hero };
      const asProfile = { ...profile, name: me.name, hero: me.hero, cozyHero: me.hero };
      if (!(await whenOnline(net, 8000))) {
        setReconnect(null);
        return;
      }
      try {
        const joined = await net.join(rec.code, me);
        enterRoom({ ...asProfile, mode: joined.room.mode, seed: joined.room.seed }, joined, { keepSave: true });
      } catch (err) {
        const r = rec.room;
        if (rec.host && r && /exist|gone|closed/i.test(err.message)) {
          try {
            const joined = await net.create({ ...r, name: r.name, player: me });
            enterRoom({ ...asProfile, mode: joined.room.mode, seed: joined.room.seed }, joined, { keepSave: true, autoStart: !!rec.started });
            setReconnect(null);
            return;
          } catch {
            /* falls through to the message below */
          }
        }
        rejoinClear();
        setNotice(`Couldn't get back into room ${rec.code}: ${err.message}`);
      }
      setReconnect(null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets, reconnect]);

  // the host pressed Start: everyone gets the fresh roster, scores and clock
  const startRound = (m) => {
    if (!session?.keepSave) wipeSave(m.room?.seed || session?.room?.seed || profile.seed); // every round starts from nothing again (except one we are carrying on)
    if (m.room?.seed) setProfile((p) => ({ ...p, seed: m.room.seed })); // (the host may have switched the map by changing the game mode)
    setSession((s) => ({ ...s, keepSave: false, autoStart: false, room: m.room || s.room, teams: m.teams || {}, host: m.host, players: m.players, slot: m.players?.find((p) => p.id === s.you)?.slot ?? s.slot, scores: m.scores, clock: m.clock, clockAt: performance.now() }));
    setLobby(false);
  };

  // a solo round was won: open a room for it so there is a waiting area for friends to join (back to the menu if offline)
  const roundWon = async () => {
    if (net.status !== 'online') return exit();
    try {
      const joined = await net.create({
        name: `${profile.name}'s meadow`,
        seed: profile.seed,
        max: 4,
        pvp: true,
        mode: 'free',
        difficulty: profile.difficulty,
        winBy: profile.winBy,
        allowLate: true,
        player: { name: profile.name, hero: profile.hero },
      });
      enterRoom(profile, joined);
    } catch {
      exit();
    }
  };

  const dismissInvite = (key) => setInvites((list) => list.filter((i) => i.key !== key));

  // "Join" on an invitation: leave whatever we are doing and go to that room
  // It leaves the current game and opens the same page an invite link does: type a name, pick a character, and you are in the room.
  const joinInvite = (invite) => {
    dismissInvite(invite.key);
    if (!invite.code) return;
    if (session) net.leave();
    setSession(null);
    setLobby(false);
    setPlaying(false);
    setPendingInvite(String(invite.code).toUpperCase().slice(0, 8));
  };

  const exit = () => {
    rejoinClear(); // leaving on purpose: no going back after a reload
    if (session) net.leave();
    setSession(null);
    setLobby(false);
    setPlaying(false);
    setPendingInvite('');
    // drop the ?room= invite so reloading doesn't re-prompt
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname);
  };

  if (error) return <div className="splash">Oh no, something went wrong loading the meadow. ({error.message})</div>;
  if (!assets) return <div className="splash"><span className="splash-dot" /> Gathering acorns…</div>;
  if (reconnect && !session) {
    return (
      <div className="splash reconnect">
        <span className="splash-dot" /> Going back into room {reconnect.code}…
        <button type="button" className="btn ghost small-btn" onClick={() => { rejoinClear(); setReconnect(null); }}>Cancel</button>
      </div>
    );
  }

  let screen;
  if ((training || trainingV2) && !isUnlocked()) {
    // the training rooms are locked: ask for the access code first
    return <AccessGate title={trainingV2 ? 'Training room V2' : 'Training ground'} onUnlocked={() => setAccessTick((n) => n + 1)} onCancel={() => { setTraining(false); setTrainingV2(false); window.history.replaceState(null, '', window.location.pathname); }} />;
  }
  if (trainingV2) {
    return <TrainingV2 assets={assets} onExit={() => { setTrainingV2(false); window.history.replaceState(null, '', window.location.pathname); }} />;
  }
  if (training) {
    // the training ground: Clover Vale, Free Roam, alone, with only the uploaded characters
    const trainingProfile = { name: 'Dev', hero: trainingHero, cozyHero: trainingHero, seed: (FREE_MAPS.find((m) => m.id === trainingMap) || FREE_MAPS[0]).seed, mode: 'free', difficulty: 'medium', bots: 0, winBy: 'duel' };
    const leaveTraining = () => {
      setTraining(false);
      window.history.replaceState(null, '', window.location.pathname);
    };
    return <GameView key={`training-${trainingMap}`} assets={assets} profile={trainingProfile} net={net} session={null} training trainingMap={trainingMap} onTrainingMap={setTrainingMap} onTrainingHero={setTrainingHero} onExit={leaveTraining} onRoundWon={leaveTraining} />;
  }
  if (playing && session && lobby) {
    screen = <WaitingRoom assets={assets} net={net} session={session} profile={profile} onStart={startRound} onLeave={exit} onJoinRoom={(code) => joinInvite({ key: Math.random(), code })} />;
  } else if (playing) {
    screen = <GameView assets={assets} profile={profile} net={net} session={session} onExit={exit} onRoundWon={roundWon} onJoinRoom={(code) => joinInvite({ key: Math.random(), code })} />;
  } else {
    screen = <MainMenu onTraining={() => setTraining(true)} onTrainingV2={() => setTrainingV2(true)} onV2={() => setV2Mode(true)} onExitV2={() => setV2Mode(false)} v2={v2Mode} onSaveName={saveName} notice={notice} key={pendingInvite || (v2Mode ? 'v2menu' : 'menu')} inviteCode={pendingInvite} assets={assets} initial={profile} net={net} onBegin={begin} onEnterRoom={enterRoom} />;
  }
  return (
    <>
      {screen}
      <InviteToasts invites={invites} assets={assets} onJoin={joinInvite} onDismiss={dismissInvite} />
      <ControlToggle playing={playing && !(session && lobby)} />
    </>
  );
}
