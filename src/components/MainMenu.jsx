import { useEffect, useState } from 'react';
import { RETRO_COUNT, SURVIVOR_COLORS, heroById, isRetro, isSurvivor, retroId, survivorId } from '../game/heroes';
import { randomName } from '../game/rng';
import SpritePreview from './SpritePreview';
import WorldBackdrop from './WorldBackdrop';
import { DIFFICULTY, DIFFICULTY_IDS } from '../game/monsters';
import { MAX_BOTS } from '../game/bots';
import AudioSettings from './AudioSettings';
import MenuHome from './MenuHome';
import { FREE_MAPS, SURVIVAL_BASE, SURVIVAL_MAPS, joinSeed, mapNameOf, splitSeed } from '../game/maps';

const invitedCode = () => (new URLSearchParams(window.location.search).get('room') || '').toUpperCase().slice(0, 8);

// the menu is a short walk: who are you, what are you playing, alone or with friends, who do you play as, then how
const STEPS = [
  ['name', 'Name'],
  ['game', 'Game'],
  ['who', 'Players'],
  ['hero', 'Hero'],
  ['play', 'Play'],
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

export default function MainMenu({ assets, initial, net, onBegin, onEnterRoom, onTraining, inviteCode = '' }) {
  const invite = inviteCode || invitedCode(); // an invitation from inside the game, or from a link
  // someone tapped an invite link: skip the setup walk and ask only for a name and a hero (until they ask for the full menu)
  const [fullMenu, setFullMenu] = useState(false);
  const inviting = !!invite && !fullMenu;
  const [step, setStep] = useState('name');
  const [view, setView] = useState('home'); // the main menu, or 'wizard' (the setup pages), 'settings', 'about', 'exit'
  const [showSettings, setShowSettings] = useState(false);
  const stepIndex = STEPS.findIndex(([id]) => id === step);
  const [name, setName] = useState(initial.name);

  // two kinds of game: the cozy Free Roam world (which can also host a wave defense), and Survival
  const [gameType, setGameType] = useState(initial.mode === 'survival' ? 'survival' : 'free');
  const [freeMode, setFreeMode] = useState(initial.mode === 'waves' ? 'waves' : initial.bots ? 'ai' : 'free');
  const [mode, setMode] = useState(invite ? 'together' : 'solo');
  const [aiCount, setAiCount] = useState(initial.bots || 3);
  // 'ai' is a solo-only Free Roam flavour: an ordinary fight world with computer rivals
  const vsAi = gameType === 'free' && freeMode === 'ai' && mode === 'solo';
  const gameMode = gameType === 'survival' ? 'survival' : freeMode === 'waves' ? 'waves' : 'free';
  const survival = gameType === 'survival';

  // Free Roam heroes: the Super Retro World pack
  const [hero, setHero] = useState(() => {
    const id = isSurvivor(initial.hero) ? initial.cozyHero : initial.hero;
    return isRetro(id) ? heroById(id).id : retroId(1);
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
  const seed = gameMode === 'survival' ? joinSeed(SURVIVAL_BASE, survMap) : FREE_MAPS.find((m) => m.id === freeMap).seed;
  // a fresh roll of the dice every time the menu opens, so the same map is not the same world twice
  const [fresh, setFresh] = useState(true);
  const [roll] = useState(() => Math.random().toString(36).slice(2, 6));
  const rolledSeed = !fresh ? seed : gameMode === 'survival' ? joinSeed(`${SURVIVAL_BASE}@${roll}`, survMap) : `${seed}@${roll}`;
  const [hovered, setHovered] = useState(null);
  const [code, setCode] = useState(invite);
  const [roomName, setRoomName] = useState('');
  const [max, setMax] = useState(4);
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
      onEnterRoom(profile(), await net.create({ name: `${myName()}'s meadow`, seed: fullSeed(), max: 4, pvp: true, mode: 'free', difficulty, winBy, allowLate: true, player: { name: myName(), hero: activeHeroId } }));
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
        <WorldBackdrop assets={assets} seed={invited?.seed || seed} />
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
      setStep('name');
      setError('');
      setView('wizard');
    };
    return (
      <div className="menu">
        <WorldBackdrop assets={assets} seed={seed} />
        <div className="cloud c1" />
        <div className="cloud c2" />
        <div className="cloud c3" />
        <MenuHome view={view} setView={setView} onPlay={() => start('solo')} onMulti={() => start('together')} name={name} setName={setName} online={status === 'online'} onTraining={onTraining} />
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
      <WorldBackdrop assets={assets} seed={seed} />
      <div className="cloud c1" />
      <div className="cloud c2" />
      <div className="cloud c3" />

      <form className="panel menu-card" onSubmit={submit}>
        <header className="logo">
          <span className="logo-spark">✿</span>
          <h1>Cuzy</h1>
          <span className="logo-spark">✿</span>
        </header>
        <p className="tagline">a tiny cozy world to explore</p>
        <button type="button" className="menu-back" onClick={() => setView('home')}>← Main menu</button>

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
              <button
                type="button"
                role="radio"
                aria-checked={gameType === 'survival'}
                className={`type-card survival ${gameType === 'survival' ? 'on' : ''}`}
                onClick={() => setGameType('survival')}
              >
                <span className="type-emoji">☠️</span>
                <b>Survival</b>
                <small>The zombie apocalypse: hold a camper RV through 10 waves with scavenged walls and supplies.</small>
              </button>
            </div>
            {nav('name', 'who')}
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
            {nav('who', 'play')}
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

            {!survival && (
              <div className="mode-tabs" role="radiogroup" aria-label="Free Roam mode">
                <button type="button" role="radio" aria-checked={gameMode === 'free' && !vsAi} className={`mode-tab ${gameMode === 'free' && !vsAi ? 'active' : ''}`} onClick={() => setFreeMode('free')}>
                  🌳 Roam
                </button>
                <button type="button" role="radio" aria-checked={freeMode === 'waves'} className={`mode-tab ${freeMode === 'waves' ? 'active' : ''}`} onClick={() => setFreeMode('waves')}>
                  🌊 Wave defense
                </button>
                {mode === 'solo' && (
                  <button type="button" role="radio" aria-checked={freeMode === 'ai'} className={`mode-tab ${freeMode === 'ai' ? 'active' : ''}`} onClick={() => setFreeMode('ai')}>
                    🤖 vs AI
                  </button>
                )}
              </div>
            )}
            {gameMode === 'free' && (
              <>
                <div className="sub-label">How do you win?</div>
                <div className="diff-row" role="radiogroup" aria-label="Win condition">
                  <button type="button" role="radio" aria-checked={winBy === 'duel'} className={`diff-chip ${winBy === 'duel' ? 'on' : ''}`} onClick={() => setWinBy('duel')}>
                    <b>⚔️ Player kills</b>
                    <small>First to 10 wins</small>
                  </button>
                  <button type="button" role="radio" aria-checked={winBy === 'monsters'} className={`diff-chip ${winBy === 'monsters' ? 'on' : ''}`} onClick={() => setWinBy('monsters')}>
                    <b>👹 Monster kills</b>
                    <small>First to 15 wins</small>
                  </button>
                </div>
              </>
            )}
            {vsAi && (
              <div className="wave-setup">
                <p className="hint">⚔️ Fight computer rivals: swords and throws hurt. {winBy === 'monsters' ? <>The first to <b>15 monster kills</b> wins.</> : <>The first to <b>10 kills</b> wins.</>} Rivals fight each other too!</p>
                <div className="ai-count">
                  <span>How many rivals?</span>
                  <button type="button" className="btn small-btn" aria-label="Fewer rivals" disabled={aiCount <= 1} onClick={() => setAiCount((n) => Math.max(1, n - 1))}>−</button>
                  <b>{aiCount}</b>
                  <button type="button" className="btn small-btn" aria-label="More rivals" disabled={aiCount >= MAX_BOTS} onClick={() => setAiCount((n) => Math.min(MAX_BOTS, n + 1))}>+</button>
                </div>
                <div className="sub-label">AI skill</div>
                <div className="diff-row" role="radiogroup" aria-label="AI skill">
                  {DIFFICULTY_IDS.map((id) => (
                    <button key={id} type="button" role="radio" aria-checked={difficulty === id} className={`diff-chip ${difficulty === id ? 'on' : ''} ${id}`} onClick={() => setDifficulty(id)}>
                      <b>{DIFFICULTY[id].name}</b>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {gameMode !== 'free' && (
              <div className="wave-setup">
                <p className="hint">
                  {gameMode === 'survival' ? (
                    <>Survive <b>10 waves</b> of zombies around a camper RV, with a monster boss at the end.</>
                  ) : (
                    <>Hold the house at the centre of the world through <b>10 waves</b> of monsters, with a boss at the end.</>
                  )}
                  {mode === 'together' ? ' Everyone in the room defends the same base.' : ''}
                </p>
                {gameMode === 'survival' && <p className="hint">👹 <b>Colossus</b> bosses: {DIFFICULTY[difficulty].boss5} on wave 5 and {DIFFICULTY[difficulty].boss10} on wave 10.</p>}
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

            <span className="sub-label">Map</span>
            <div className="map-grid" role="radiogroup" aria-label="Map">
              {(gameMode === 'survival' ? SURVIVAL_MAPS : FREE_MAPS).map((m) => {
                const on = gameMode === 'survival' ? survMap === m.id : freeMap === m.id;
                return (
                  <button key={m.id} type="button" role="radio" aria-checked={on} className={`diff-chip map-card ${on ? 'on' : ''}`} onClick={() => (gameMode === 'survival' ? setSurvMap(m.id) : setFreeMap(m.id))}>
                    <b>{m.icon} {m.name}</b>
                    <small>{m.blurb}</small>
                  </button>
                );
              })}
            </div>
            <label className="check-row">
              <input type="checkbox" checked={fresh} onChange={(e) => setFresh(e.target.checked)} /> 🎲 New layout every game <small>(same map style, but different trees, houses, wrecks and spawn each time)</small>
            </label>
            <p className="hint">The world drifting by behind this card is the map style you picked.</p>

            {mode === 'together' && (
              <div className="together">
                {online && problem && <div className="notice error">{problem}</div>}
                {!online && (
                  <div className="notice">
                    {status === 'connecting' ? 'Connecting to the room server…' : net.offlineText}
                  </div>
                )}
                {error && <div className="notice error">{error}</div>}

                <div className="sub-label">Open rooms</div>
                <div className="room-list">
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
                </div>

                <div className="sub-label">Join with a code</div>
                <div className="row">
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
                </div>

                <div className="sub-label">Or host your own</div>
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
              {mode === 'solo' && <button type="submit" className="btn go" disabled={busy}>{soloRoom ? 'Open my room ➜' : 'Begin adventure ➜'}</button>}
            </div>
          </section>
        )}

        {showSettings && <AudioSettings />}
        <button type="button" className="settings-toggle" onClick={() => setShowSettings((v) => !v)}>⚙ Settings</button>
      </form>
    </div>
  );
}
