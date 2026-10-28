import { useEffect, useRef, useState } from 'react';
import { loadAssets } from './game/assets';
import { retroId } from './game/heroes';
import { sfx } from './game/sfx';
import { Net } from './game/net';
import { SupaNet } from './game/supaNet';
import { cloudOn, rawClient, store } from './game/store';
import MainMenu from './components/MainMenu';
import GameView from './components/GameView';
import WaitingRoom from './components/WaitingRoom';

const PROFILE_KEY = 'cuzi-profile';

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
  const enterRoom = (p, joined) => {
    const next = remember(p);
    wipeSave(joined.room.seed);
    setProfile({ ...next, seed: joined.room.seed });
    setSession({ ...joined, clockAt: performance.now() });
    setLobby(!joined.started);
    setPlaying(true);
  };

  // the host pressed Start: everyone gets the fresh roster, scores and clock
  const startRound = (m) => {
    setSession((s) => ({ ...s, room: m.room || s.room, teams: m.teams || {}, host: m.host, players: m.players, scores: m.scores, clock: m.clock, clockAt: performance.now() }));
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

  const exit = () => {
    if (session) net.leave();
    setSession(null);
    setLobby(false);
    setPlaying(false);
    // drop the ?room= invite so reloading doesn't re-prompt
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname);
  };

  if (error) return <div className="splash">Oh no, something went wrong loading the meadow. ({error.message})</div>;
  if (!assets) return <div className="splash"><span className="splash-dot" /> Gathering acorns…</div>;

  if (playing && session && lobby) {
    return <WaitingRoom assets={assets} net={net} session={session} profile={profile} onStart={startRound} onLeave={exit} />;
  }

  return playing ? (
    <GameView assets={assets} profile={profile} net={net} session={session} onExit={exit} onRoundWon={roundWon} />
  ) : (
    <MainMenu assets={assets} initial={profile} net={net} onBegin={begin} onEnterRoom={enterRoom} />
  );
}
