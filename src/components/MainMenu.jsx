import { useEffect, useState } from 'react';
import { RETRO_COUNT, SURVIVOR_COLORS, V2_CHARS, heroById, isRetro, isSurvivor, isV2Char, retroId, survivorId } from '../game/heroes';
import { randomName } from '../game/rng';
import SpritePreview from './SpritePreview';
import WorldBackdrop from './WorldBackdrop';
import { DIFFICULTY, DIFFICULTY_IDS } from '../game/monsters';
import MenuHome from './MenuHome';
import MultiMenu from './MultiMenu';
import MusicButton from './MusicButton';
import MapPreview from './MapPreview';
import { FREE_MAPS, SURVIVAL_BASE, SURVIVAL_MAPS, joinSeed, mapNameOf, splitSeed } from '../game/maps';

const invitedCode = () => (new URLSearchParams(window.location.search).get('room') || '').toUpperCase().slice(0, 8);

// the menu is a short walk: who are you, what are you playing, alone or with friends, who do you play as, then how
const STEPS = [
  ['name', 'Name'],
  ['game', 'Game'],
  ['who', 'Players'],
  ['hero', 'Hero'],
  ['play', 'Map'],
];

function useLobby(net) {
  const [state, setState] = useState({ status: net.status, rooms: net.rooms, problem: net.problem });
  useEffect(() => {
    const off = net.on((m) => {
      if (m.t === 'rooms' || m.t === 'status') setState({ status: net.status, rooms: net.rooms, problem: net.problem });
    });
    net.watchLobby();
    setState({ status: net.status, rooms: net.rooms, problem: net.problem });
    return off;
  }, [net]);
  return state;
}

export default function MainMenu({ assets, initial, net, onBegin, onEnterRoom, onTraining, onTrainingV2, onV2, onExitV2, onSaveName, v2 = false, notice = '', inviteCode = '' }) {
  const invite = inviteCode || invitedCode(); // an invitation from inside the game, or from a link
  // someone tapped an invite link: skip the setup walk and ask only for a name and a hero (until they ask for the full menu)
  const [fullMenu, setFullMenu] = useState(false);
  const inviting = !!invite && !fullMenu;
  const [step, setStep] = useState('name');
  const [view, setView] = useState(v2 ? 'wizard' : 'home'); // the main menu, or 'wizard' (the setup pages), 'settings', 'about', 'exit'
  const stepIndex = STEPS.findIndex(([id]) => id === step);
  const [name, setName] = useState(initial.name);
  const [fromMulti, setFromMulti] = useState(false); // the setup walk was opened from Multiplay: the name is already saved, and it is about creating a room
  // a name you type is kept right away, so it never has to be typed again
  useEffect(() => {
    const n = name.trim();
    if (!n || n === (initial.name || '').trim()) return undefined;
    const t = setTimeout(() => onSaveName?.(n), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  // two kinds of game: the cozy Free Roam world (which can also host a wave defense), and Survival
  const [gameType, setGameType] = useState(!v2 && initial.mode === 'survival' ? 'survival' : 'free');
  const freeMode = 'free'; // Free Roam is just Roam here: Wave Defense and vs AI are not offered any more
  const [mode, setMode] = useState(invite ? 'together' : 'solo');
  const [aiCount, setAiCount] = useState(initial.bots || 3);
  // 'ai' is a solo-only Free Roam flavour: an ordinary fight world with computer rivals
  const vsAi = gameType === 'free' && freeMode === 'ai' && mode === 'solo';
  const gameMode = gameType === 'survival' ? 'survival' : freeMode === 'waves' ? 'waves' : 'free';
  const survival = gameType === 'survival';

  // Free Roam heroes: the Super Retro World pack
  const [hero, setHero] = useState(() => {
    const id = isSurvivor(initial.hero) ? initial.cozyHero : initial.hero;
    return isRetro(id) || (v2 && isV2Char(id)) ? heroById(id).id : retroId(1);
  });
  // Survival's survivor, in a jacket colour
  const [survColor, setSurvColor] = useState(() => {
    const fromHero = isSurvivor(initial.hero) ? heroById(initial.hero).color : initial.survColor;
    return Number.isInteger(fromHero) && SURVIVOR_COLORS[fromHero] ? fromHero : 0;
  });

  const randomHero = () => setHero(retroId(1 + Math.floor(Math.random() * RETRO_COUNT)));

  const activeHeroId = hero; // the same heroes in every game type, Survival included
  const activeHero = heroById(activeHeroId);
  const selected = heroById(hero);
  const [freeMap, setFreeMap] = useState(FREE_MAPS.find((m) => m.seed === splitSeed(initial.seed).base)?.id || FREE_MAPS[0].id);
  const [survMap, setSurvMap] = useState(splitSeed(initial.seed).map); // Survival's map, kept in the seed after a ~
  // the map you pick decides the world seed (maps are named, not typed in)
  // "Random map": a map picked at random (and a fresh layout of it) each time the menu is opened or the card is pressed
  const [dice, setDice] = useState(() => Math.random());
  const survPick = survMap === 'random' ? SURVIVAL_MAPS[Math.floor(dice * SURVIVAL_MAPS.length)].id : survMap;
  const freePick = freeMap === 'random' ? FREE_MAPS[Math.floor(dice * FREE_MAPS.length)] : FREE_MAPS.find((m) => m.id === freeMap) || FREE_MAPS[0];
  const seed = gameMode === 'survival' ? joinSeed(SURVIVAL_BASE, survPick) : freePick.seed;
  // a fresh roll of the dice every time the menu opens, so the same map is not the same world twice
  const [fresh, setFresh] = useState(false); // off: the map exactly as it is. On: the same map with the objects, trees and obstacles generated afresh
  const [roll, setRoll] = useState(() => Math.random().toString(36).slice(2, 6));
  const newRoll = () => Math.random().toString(36).slice(2, 6);
  const [pv, setPv] = useState(null); // the map preview: { roll } while it is open (roll null: the map exactly as it is)
  // Free Roam V2 is the same world with the Modern Exteriors props on top: its seed ends in ~v2
  const tag = v2 && gameMode === 'free' ? '~v2' : '';
  const rolledSeed = (!fresh ? seed : gameMode === 'survival' ? joinSeed(`${SURVIVAL_BASE}@${roll}`, survPick) : `${seed}@${roll}`) + tag;
  // the seed the preview shows: the map as it will be played, or (after "Generate another") a freshly rolled layout of it
  const previewSeed = (pv ? (pv.roll ? (gameMode === 'survival' ? joinSeed(`${SURVIVAL_BASE}@${pv.roll}`, survPick) : `${seed}@${pv.roll}`) : seed) : seed) + tag;
  const pickedName = gameMode === 'survival' ? SURVIVAL_MAPS.find((m) => m.id === survPick)?.name : freePick.name;
  const [hovered, setHovered] = useState(null);
  const [code, setCode] = useState(invite);
  const [roomName, setRoomName] = useState('');
  const [max, setMax] = useState(5);
  const [lateJoin, setLateJoin] = useState(true);
  // how a Free Roam round is won: first to 10 player kills, or first to 15 monster kills (handy for trying the winner screen)
  const [winBy, setWinBy] = useState(initial.winBy === 'monsters' ? 'monsters' : 'duel');
  const [difficulty, setDifficulty] = useState(DIFFICULTY[initial.difficulty] ? initial.difficulty : 'medium');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { status, rooms, problem } = useLobby(net);

  // `hero` is what the game uses; the other picks are remembered so switching game type does not lose them
  const fullSeed = () => rolledSeed;
  const profile = () => ({ name, hero: activeHeroId, cozyHero: hero, survColor, seed: fullSeed(), mode: gameMode, difficulty, bots: vsAi ? aiCount : 0, winBy: gameMode === 'free' ? winBy : 'duel' });
  const myName = () => name.trim() || 'Friend';

  const go = (next) => {
    setError('');
    setStep(next);
  };

  const submit = (e) => {
    e.preventDefault();
    if (step === 'name') go('game');
    else if (step === 'hero') go('play');
    else if (step === 'play' && mode === 'solo') {
      // a plain Free Roam game starts in its own room (so it has a waiting area and settings); the rest go straight in
      if (soloRoom) createSolo();
      else onBegin(profile());
    }
  };

  const run = async (promise) => {
    setBusy(true);
    setError('');
    try {
      onEnterRoom(profile(), await promise);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const create = () =>
    run(
      net
        .create({ name: roomName.trim(), seed: fullSeed(), max, pvp: gameMode === 'free', mode: gameMode, difficulty, winBy, allowLate: lateJoin, player: { name: myName(), hero: activeHeroId } })
        .then((joined) => {
          // a room server that was started before Wave Defense existed quietly makes an ordinary room
          if (gameMode !== 'free' && joined.room.mode !== gameMode) {
            net.leave();
            throw new Error('The room server is out of date, so it can’t host this game type. Stop `npm run dev`, start it again, and reload this page.');
          }
          return joined;
        }),
    );
  const [noRoomOk, setNoRoomOk] = useState(false); // the last room attempt failed: the next press plays without a room
  const soloRoom = gameMode === 'free' && !vsAi && status === 'online';
  const createSolo = async () => {
    setBusy(true);
    setError('');
    try {
      onEnterRoom(profile(), await net.create({ name: `${myName()}'s meadow`, seed: fullSeed(), max: 5, pvp: true, mode: 'free', difficulty, winBy, allowLate: true, player: { name: myName(), hero: activeHeroId } }));
    } catch (err) {
      // no room available (offline, or the rooms table is not set up): say so, and play without one if asked again
      if (noRoomOk) {
        onBegin(profile());
        return;
      }
      setNoRoomOk(true);
      setBusy(false);
      setError(`Couldn't open a room (${err?.message || 'no connection'}). Room settings only exist in a room. Press the button again to play without one.`);
    }
  };
  const join = (c) => run(net.join(c, { name: myName(), hero: activeHeroId }));

  const online = status === 'online';

  // ---------- an invite link: name + hero, then straight into the room ----------
  if (inviting) {
    const invited = rooms.find((r) => r.code === invite);
    const inviteHeroId = hero;
    const joinInvited = (e) => {
      e.preventDefault();
      if (busy || !online) return;
      setBusy(true);
      setError('');
      const me = { name: myName(), hero: inviteHeroId };
      net.join(invite, me).then(
        (joined) => onEnterRoom({ ...profile(), hero: inviteHeroId, cozyHero: inviteHeroId, mode: joined.room.mode, seed: joined.room.seed }, joined),
        (err) => {
          setError(err.message);
          setBusy(false);
        },
      );
    };
    const pickHero = (id) => setHero(id);
    return (
      <div className="menu">
        <MusicButton />
        <WorldBackdrop assets={assets} seed={invited?.seed || rolledSeed} />
        <div className="cloud c1" />
        <div className="cloud c2" />
        <form className="panel menu-card" onSubmit={joinInvited}>
          <header className="logo">
            <span className="logo-spark">✿</span>
            <h1>Cuzy</h1>
            <span className="logo-spark">✿</span>
          </header>
          <div className="invite-banner">
            🎉 You've been invited to {invited ? <><b>{invited.name}</b> (room {invite})</> : <>room <b>{invite}</b></>}! Type your name and pick a character.
          </div>
          <section className="page">
            <label className="step" htmlFor="invite-name">Your name</label>
            <div className="row">
              <input id="invite-name" value={name} maxLength={14} placeholder="Your name…" autoComplete="off" autoFocus onChange={(e) => setName(e.target.value)} />
              <button type="button" className="btn dice" title="Surprise me" onClick={() => setName(randomName())}>🎲</button>
            </div>
            <div className="step">Pick your character</div>
            {(
              <div className="heroes retro-grid" role="radiogroup" aria-label="Character">
                {Array.from({ length: RETRO_COUNT }, (_, i) => {
                  const h = heroById(retroId(i + 1));
                  const on = hero === h.id;
                  return (
                    <button type="button" key={h.id} role="radio" aria-checked={on} className={`hero-card ${on ? 'selected' : ''}`} onClick={() => pickHero(h.id)} onMouseEnter={() => setHovered(h.id)} onMouseLeave={() => setHovered(null)}>
                      <SpritePreview img={assets.img} hero={h} active={on || hovered === h.id} />
                      <span className="hero-name">{h.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {!online && <p className="hint">Connecting to the room server…</p>}
            {error && <div className="notice error">{error}</div>}
            <div className="nav-row">
              <button type="button" className="btn ghost" onClick={() => { window.history.replaceState(null, '', window.location.pathname); setFullMenu(true); setView('wizard'); }}>Open the full menu</button>
              <button type="submit" className="btn go" disabled={busy || !online}>{busy ? 'Joining…' : 'Join the room ➜'}</button>
            </div>
          </section>
        </form>
      </div>
    );
  }

  // ---------- the main menu: Play, Multiplay, Settings, About, Exit ----------
  if (view !== 'wizard') {
    const start = (m) => {
      setMode(m);
      setFromMulti(false);
      setStep('name');
      setError('');
      setView('wizard');
    };
    // Create a room: the name is saved, so it goes straight to picking the game
    const createFromMulti = () => {
      setMode('together');
      setFromMulti(true);
      setError('');
      setStep('game');
      setView('wizard');
    };
    return (
      <div className="menu">
        <MusicButton />
        <WorldBackdrop assets={assets} seed={rolledSeed} />
        <div className="cloud c1" />
        <div className="cloud c2" />
        <div className="cloud c3" />
        {view === 'multi' || view === 'rooms' ? (
          <MultiMenu
            assets={assets}
            view={view}
            setView={(v) => { setError(''); setView(v); }}
            name={name}
            setName={setName}
            hero={hero}
            setHero={setHero}
            status={status}
            online={online}
            rooms={rooms}
            problem={problem}
            error={error}
            busy={busy}
            code={code}
            setCode={setCode}
            join={join}
            onCreate={createFromMulti}
            onBack={() => setView('home')}
            offlineText={net.offlineText}
          />
        ) : (
          <MenuHome view={view} setView={setView} onPlay={() => start('solo')} onMulti={() => { setMode('together'); setError(''); setView('multi'); }} name={name} setName={setName} online={status === 'online'} onTraining={onTraining} onTrainingV2={onTrainingV2} onV2={onV2} notice={notice} />
        )}
      </div>
    );
  }

  const nav = (back, next, nextLabel = 'Next ➜') => (
    <div className="nav-row">
      {back ? <button type="button" className="btn ghost" onClick={() => go(back)}>← Back</button> : <span />}
      {next && <button type="button" className="btn go" onClick={() => go(next)}>{nextLabel}</button>}
    </div>
  );

  return (
    <div className="menu">
        <MusicButton />
      <WorldBackdrop assets={assets} seed={rolledSeed} />
      <div className="cloud c1" />
      <div className="cloud c2" />
      <div className="cloud c3" />

      <form className="panel menu-card" onSubmit={submit}>
        <header className="logo">
          <span className="logo-spark">✿</span>
          <h1>{v2 ? 'Cuzy V2' : 'Cuzy'}</h1>
          <span className="logo-spark">✿</span>
        </header>
        <p className="tagline">{v2 ? 'Free Roam V2: the same world, with a modern town built into it' : 'a tiny cozy world to explore'}</p>
        <button type="button" className="menu-back" onClick={() => (v2 ? onExitV2?.() : setView(fromMulti ? 'multi' : 'home'))}>{fromMulti ? '← Multiplay' : '← Main menu'}</button>

        {invite && (
          <div className="invite-banner">
            🎉 You've been invited to room <b>{invite}</b>! Pick a name, a game and a hero, then press <b>Join</b> on the last page.

          </div>
        )}

        <nav className="stepper" aria-label="Setup steps">
          {STEPS.map(([id, label], i) => (
            <button
              key={id}
              type="button"
              className={`stepper-dot ${step === id ? 'on' : ''} ${i < stepIndex ? 'done' : ''}`}
              disabled={i > stepIndex}
              onClick={() => go(id)}
              aria-current={step === id ? 'step' : undefined}
            >
              <b>{i < stepIndex ? '✓' : i + 1}</b>
              {label}
            </button>
          ))}
        </nav>

        {/* ---------- 1. name ---------- */}
        {step === 'name' && (
          <section className="page">
            <label className="step" htmlFor="name">What's your name?</label>
            <div className="row">
              <input
                id="name"
                value={name}
                maxLength={14}
                placeholder="Your name…"
                autoComplete="off"
                autoFocus
                onChange={(e) => setName(e.target.value)}
              />
              <button type="button" className="btn dice" title="Surprise me" onClick={() => setName(randomName())}>🎲</button>
            </div>
            <p className="hint">This is what other players will see above your head.</p>
            {nav(null, 'game')}
          </section>
        )}

        {/* ---------- 2. game ---------- */}
        {step === 'game' && (
          <section className="page">
            <div className="step">Hi {myName()}! What do you want to play?</div>
            <div className="type-cards big" role="radiogroup" aria-label="Game type">
              <button
                type="button"
                role="radio"
                aria-checked={gameType === 'free'}
                className={`type-card ${gameType === 'free' ? 'on' : ''}`}
                onClick={() => setGameType('free')}
              >
                <span className="type-emoji">🌳</span>
                <b>Free Roam</b>
                <small>The cozy open world: explore, forage, meet farm animals, hold a wave defense, or duel your friends.</small>
              </button>
              {!v2 && <button
                type="button"
                role="radio"
                aria-checked={gameType === 'survival'}
                className={`type-card survival ${gameType === 'survival' ? 'on' : ''}`}
                onClick={() => setGameType('survival')}
              >
                <span className="type-emoji">☠️</span>
                <b>Survival</b>
                <small>The zombie apocalypse: hold a camper RV through 10 waves with scavenged walls and supplies.</small>
              </button>}
            </div>
            {fromMulti ? (
              <div className="nav-row">
                <button type="button" className="btn ghost" onClick={() => setView('multi')}>← Back</button>
                <button type="button" className="btn go" onClick={() => go('hero')}>Next ➜</button>
              </div>
            ) : nav('name', 'who')}
          </section>
        )}

        {/* ---------- 3. alone or together ---------- */}
        {step === 'who' && (
          <section className="page">
            <div className="step">Playing alone, or with friends?</div>
            <div className="type-cards big" role="radiogroup" aria-label="Players">
              <button
                type="button"
                role="radio"
                aria-checked={mode === 'solo'}
                className={`type-card ${mode === 'solo' ? 'on' : ''}`}
                onClick={() => setMode('solo')}
              >
                <span className="type-emoji">🌱</span>
                <b>Solo</b>
                <small>{survival ? 'Just you against the horde.' : 'Just you, with the option of computer rivals to fight.'}</small>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={mode === 'together'}
                className={`type-card ${mode === 'together' ? 'on' : ''}`}
                onClick={() => setMode('together')}
              >
                <span className="type-emoji">🏡</span>
                <b>Together <span className={`dot ${status}`} title={online ? 'Room server online' : 'Room server offline'} /></b>
                <small>Host or join a room with up to 10 players on the same Wi-Fi.</small>
              </button>
            </div>
            {nav('game', 'hero')}
          </section>
        )}

        {/* ---------- 4. hero ---------- */}
        {step === 'hero' && (
          <section className="page">
            <div className="step">
              Pick your hero
              <button type="button" className="btn dice mini-dice" title="Surprise me" onClick={randomHero}>🎲</button>
            </div>

            {(
              <>
                {v2 && (
                  <>
                    <span className="sub-label">V2 characters <small>(taller, with a full walk animation)</small></span>
                    <div className="heroes retro-grid" role="radiogroup" aria-label="V2 characters">
                      {V2_CHARS.map((c) => {
                        const h = heroById(c.id);
                        const on = hero === h.id;
                        return (
                          <button type="button" key={h.id} role="radio" aria-checked={on} className={`hero-card ${on ? 'selected' : ''}`} onClick={() => setHero(h.id)} onMouseEnter={() => setHovered(h.id)} onMouseLeave={() => setHovered(null)}>
                            <SpritePreview img={assets.img} hero={h} active={on || hovered === h.id} />
                            <span className="hero-name">{h.label}</span>
                          </button>
                        );
                      })}
                    </div>
                    <span className="sub-label">V1 heroes</span>
                  </>
                )}
                <div className="heroes retro-grid" role="radiogroup" aria-label="Hero">
                  {Array.from({ length: RETRO_COUNT }, (_, i) => {
                    const h = heroById(retroId(i + 1));
                    const on = hero === h.id;
                    return (
                      <button
                        type="button"
                        key={h.id}
                        role="radio"
                        aria-checked={on}
                        className={`hero-card ${on ? 'selected' : ''}`}
                        onClick={() => setHero(h.id)}
                        onMouseEnter={() => setHovered(h.id)}
                        onMouseLeave={() => setHovered(null)}
                        onFocus={() => setHovered(h.id)}
                        onBlur={() => setHovered(null)}
                      >
                        <SpritePreview img={assets.img} hero={h} active={on || hovered === h.id} />
                        <span className="hero-name">{h.label}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="hero-blurb">Selected: <b>{selected.label}</b>. {survival ? 'Your hero faces the horde in Survival too. ' : ''}Super Retro World pixel heroes (credit: Gif, Noiracide &amp; Romi).</p>
              </>
            )}
            {nav(fromMulti ? 'game' : 'who', 'play')}
          </section>
        )}

        {/* ---------- 5. how to play ---------- */}
        {step === 'play' && (
          <section className="page">
            <div className="summary">
              <button type="button" className="summary-chip" onClick={() => go('name')} title="Change name">👤 {myName()}</button>
              <button type="button" className="summary-chip" onClick={() => go('game')} title="Change game">{survival ? '☠️ Survival' : '🌳 Free Roam'}</button>
              <button type="button" className="summary-chip" onClick={() => go('who')} title="Change players">{mode === 'solo' ? '🌱 Solo' : '🏡 Together'}</button>
              <button type="button" className="summary-chip" onClick={() => go('hero')} title="Change hero">🧍 {activeHero.label}</button>
            </div>

            {gameMode === 'survival' && (
              <div className="wave-setup">
                <p className="hint">
                  Survive <b>10 waves</b> of zombies around a camper RV, with a monster boss at the end.
                  {mode === 'together' ? ' Everyone in the room defends the same base.' : ''}
                  {' '}The host can change the difficulty at any time in the room settings.
                </p>
                <p className="hint">👹 <b>Colossus</b> bosses: {DIFFICULTY[difficulty].boss5} on wave 5 and {DIFFICULTY[difficulty].boss10} on wave 10.</p>
                <div className="diff-row" role="radiogroup" aria-label="Difficulty">
                  {DIFFICULTY_IDS.map((id) => (
                    <button key={id} type="button" role="radio" aria-checked={difficulty === id} className={`diff-chip ${difficulty === id ? 'on' : ''} ${id}`} onClick={() => setDifficulty(id)}>
                      <b>{DIFFICULTY[id].name}</b>
                      <small>{DIFFICULTY[id].blurb}</small>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <span className="sub-label">Choose a map</span>
            <div className="map-grid" role="radiogroup" aria-label="Map">
              {(gameMode === 'survival' ? SURVIVAL_MAPS : FREE_MAPS).map((m) => {
                const on = gameMode === 'survival' ? survMap === m.id : freeMap === m.id;
                return (
                  <button key={m.id} type="button" role="radio" aria-checked={on} className={`diff-chip map-card ${m.id === 'mixed' ? 'open-world' : ''} ${on ? 'on' : ''}`} onClick={() => (gameMode === 'survival' ? setSurvMap(m.id) : setFreeMap(m.id))}>
                    <b>{m.icon} {m.name}</b>
                    <small>{m.blurb}</small>
                  </button>
                );
              })}
              <button type="button" role="radio" aria-checked={(gameMode === 'survival' ? survMap : freeMap) === 'random'} className={`diff-chip map-card ${(gameMode === 'survival' ? survMap : freeMap) === 'random' ? 'on' : ''}`} onClick={() => { setDice(Math.random()); if (gameMode === 'survival') setSurvMap('random'); else setFreeMap('random'); }}>
                <b>🎲 Random map</b>
                <small>
                  {(gameMode === 'survival' ? survMap : freeMap) === 'random'
                    ? `Picked: ${gameMode === 'survival' ? SURVIVAL_MAPS.find((m) => m.id === survPick)?.name : freePick.name}. Press again for another.`
                    : 'Picks one of the maps above at random. Press it to roll.'}
                </small>
              </button>
            </div>
            <label className="check-row">
              <input type="checkbox" checked={fresh} onChange={(e) => setFresh(e.target.checked)} /> 🎲 Generate a new layout <small>(the same map, but its trees, obstacles, houses and objects are placed differently every game; leave it off to play the map as it is)</small>
            </label>
            <div className="preview-row">
              <button type="button" className="btn" onClick={() => setPv({ roll: fresh ? roll : null })}>👁 Preview the map</button>
              <small>See the whole map full screen and walk around it. You can generate another one there before you decide.</small>
            </div>

            {mode === 'together' && (
              <div className="together">
                {online && problem && <div className="notice error">{problem}</div>}
                {!online && (
                  <div className="notice">
                    {status === 'connecting' ? 'Connecting to the room server…' : net.offlineText}
                  </div>
                )}
                {error && <div className="notice error">{error}</div>}

                {!fromMulti && <div className="sub-label">Open rooms</div>}
                {!fromMulti && <div className="room-list">
                  {rooms.length === 0 && <div className="room-empty">No rooms yet. Be the first to create one!</div>}
                  {rooms.map((r) => (
                    <div className="room-row" key={r.code}>
                      <div className="room-info">
                        <b>{r.name}{r.pvp && <span className="pvp-badge">⚔️ Fight</span>}{r.mode === 'waves' && <span className="pvp-badge waves">🌊 {DIFFICULTY[r.difficulty]?.name || 'Waves'}</span>}{r.mode === 'survival' && <span className="pvp-badge survival">☠️ {DIFFICULTY[r.difficulty]?.name || 'Survival'}</span>}</b>
                        <span>Host {r.host} · 🗺️ {mapNameOf(r.seed)}{r.mode === 'waves' ? ' · wave defense' : r.mode === 'survival' ? ' · survival' : r.pvp ? ` · first to ${r.target} ${r.winBy === 'monsters' ? 'monster ' : ''}kills` : ' · friendly'}{r.allowLate ? '' : ' · no late join'}</span>
                      </div>
                      <span className="room-code">{r.code}</span>
                      <span className={`room-count ${r.count >= r.max ? 'full' : ''}`}>👥 {r.count}/{r.max}</span>
                      <button type="button" className="btn small-btn" disabled={busy || !online || r.count >= r.max || (r.started && !r.allowLate)} onClick={() => join(r.code)}>
                        {r.count >= r.max ? 'Full' : r.started && !r.allowLate ? 'Started' : 'Join'}
                      </button>
                    </div>
                  ))}
                </div>}

                {!fromMulti && <div className="sub-label">Join with a code</div>}
                {!fromMulti && <div className="row">
                  <input
                    className="code-input"
                    value={code}
                    maxLength={8}
                    placeholder="ABCD"
                    autoComplete="off"
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (code.trim() && online && !busy) join(code.trim());
                      }
                    }}
                  />
                  <button type="button" className={`btn ${invite ? 'go' : ''}`} disabled={busy || !online || !code.trim()} onClick={() => join(code.trim())}>
                    Join
                  </button>
                </div>}

                <div className="sub-label">{fromMulti ? 'Your room' : 'Or host your own'}</div>
                <div className="row">
                  <input value={roomName} maxLength={24} placeholder={`${myName()}'s meadow`} autoComplete="off" onChange={(e) => setRoomName(e.target.value)} />
                  <select value={max} onChange={(e) => setMax(Number(e.target.value))} aria-label="Max players">
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n} players</option>)}
                  </select>
                  <button type="button" className="btn go" disabled={busy || !online} onClick={create}>Create room</button>
                </div>
                <label className="check-row">
                  <input type="checkbox" checked={lateJoin} onChange={(e) => setLateJoin(e.target.checked)} /> Allow late join <small>(people can join after the round has started)</small>
                </label>
                {gameMode !== 'free' ? (
                  <p className="hint">{gameMode === 'survival' ? '☠️ Survival' : '🌊 Wave defense'} is co-op: everyone is on the same side, so there is no hero-vs-hero fighting.</p>
                ) : (
                  <p className="hint">⚔️ Free Roam rooms are fight mode: swords and throws hurt other players. {winBy === 'monsters' ? 'First to 15 monster kills wins.' : 'First to 10 kills wins.'}</p>
                )}
                <p className="hint">You'll get a room code and an invite link to share with friends on the same Wi-Fi.</p>
              </div>
            )}

            <div className="nav-row">
              <button type="button" className="btn ghost" onClick={() => go('hero')}>← Back</button>
              {mode === 'solo' && <button type="submit" className="btn go" disabled={busy}>{soloRoom ? 'Open the room ➜' : 'Begin adventure ➜'}</button>}
            </div>
          </section>
        )}

      </form>
      {pv && (
        <MapPreview
          assets={assets}
          net={net}
          seed={previewSeed}
          mode={gameMode}
          name={myName()}
          hero={activeHeroId}
          label={pickedName}
          onRegenerate={() => {
            if ((gameMode === 'survival' ? survMap : freeMap) === 'random') setDice(Math.random()); // the random card rolls a different map too
            setPv({ roll: newRoll() });
          }}
          onUse={() => {
            if (pv.roll) {
              setFresh(true);
              setRoll(pv.roll);
            }
            setPv(null);
          }}
          onClose={() => setPv(null)}
        />
      )}
    </div>
  );
}
