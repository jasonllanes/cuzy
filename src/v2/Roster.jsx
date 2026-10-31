import { useEffect, useMemo, useRef, useState } from 'react';
import { HEROES, RETRO_COUNT, RETRO_NAMES, SURVIVOR_COLORS, drawHero, heroById, retroId, survivorId } from '../game/heroes';
import { MONSTERS, MONSTER_IDS } from '../game/monsters';
import MonsterIcon from '../components/MonsterIcon';
import { loadSheet } from './assets';
import { V2_HEROES, drawChar } from './chars';

// The Training Room's two lists: every character you can walk around as, and every monster you can put down to see how it moves.

function CharPicture({ assets, id, file }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return undefined;
    let dead = false;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const paint = (draw) => {
      if (dead) return;
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.save();
      ctx.scale(1.4, 1.4);
      draw();
      ctx.restore();
    };
    if (file) loadSheet(file).then((img) => paint(() => drawChar(ctx, img, 'down', false, 0, 20, 40)));
    else paint(() => drawHero(ctx, assets.img, heroById(id), 'down', false, 0, 20, 40));
    return () => {
      dead = true;
    };
  }, [assets, id, file]);
  return <canvas ref={ref} width={56} height={60} className="tp-portrait" />;
}

export function CharactersPane({ assets, current, onPick }) {
  const card = (id, label, file) => (
    <button key={id} type="button" className={`v2-char ${current === id ? 'on' : ''}`} onClick={() => onPick(id)} title={label}>
      <CharPicture assets={assets} id={id} file={file} />
      <small>{label}</small>
    </button>
  );
  return (
    <section className="v2-pane">
      <p className="hint">Pick a character to walk around as (this turns <b>Walk around with a hero</b> on).</p>
      <h3>V2 characters</h3>
      <div className="v2-roster">{V2_HEROES.map((h) => card(h.id, h.label, h.file))}</div>
      <h3>Retro heroes</h3>
      <div className="v2-roster">{Array.from({ length: RETRO_COUNT }, (_, i) => card(retroId(i + 1), RETRO_NAMES[i]))}</div>
      <h3>Classic heroes</h3>
      <div className="v2-roster">{HEROES.map((h) => card(h.id, h.label))}</div>
      <h3>Survivors</h3>
      <div className="v2-roster">{SURVIVOR_COLORS.map((c, i) => card(survivorId(i), c.name))}</div>
    </section>
  );
}

const groupOf = (def) => (def.apoc ? 'zombie' : def.tiny ? 'tiny' : def.boss ? 'boss' : def.kind === 'fly' || def.fly ? 'fly' : def.kind === 'shoot' ? 'shoot' : 'walk');
const GROUPS = [['all', 'All'], ['walk', 'Walkers'], ['fly', 'Flyers'], ['shoot', 'Shooters'], ['zombie', 'Zombies'], ['tiny', 'Fighters'], ['boss', 'Bosses']];

export function MobsPane({ count, chase, onChase, onSpawn, onClear }) {
  const [group, setGroup] = useState('all');
  const [search, setSearch] = useState('');
  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return MONSTER_IDS.filter((id) => {
      const def = MONSTERS[id];
      return (group === 'all' || groupOf(def) === group || (group === 'boss' && (def.boss || def.miniBoss))) && (!q || def.name.toLowerCase().includes(q));
    });
  }, [group, search]);
  return (
    <section className="v2-pane">
      <p className="hint">Press a monster to put one down in front of you. Right-click one on the map to remove it.</p>
      <div className="v2-chips">
        {GROUPS.map(([id, label]) => (
          <button key={id} type="button" className={`btn small-btn ${group === id ? 'go' : ''}`} onClick={() => setGroup(id)}>{label}</button>
        ))}
      </div>
      <input value={search} placeholder="Search by name…" onChange={(e) => setSearch(e.target.value)} />
      <label className="check-row"><input type="checkbox" checked={chase} onChange={(e) => onChase(e.target.checked)} /> They walk towards the hero <small>(turn on “Walk around with a hero” in Tools)</small></label>
      <div className="v2-chips">
        <span>{count} on the map</span>
        <button type="button" className="btn small-btn" disabled={!count} onClick={onClear}>🧹 Clear them</button>
      </div>
      <div className="v2-mobs">
        {list.map((id) => {
          const def = MONSTERS[id];
          return (
            <button key={id} type="button" className="v2-mob" onClick={() => onSpawn(id)} title={`Put a ${def.name} down`}>
              <span className="v2-mob-ico"><MonsterIcon type={id} size={40} /></span>
              <b>{def.name}</b>
              <small>❤ {def.hp} · 👣 {def.speed} · ⚔ {def.dmg}{def.boss ? ' · boss' : def.kind === 'fly' || def.fly ? ' · flies' : def.kind === 'shoot' ? ' · shoots' : ''}</small>
            </button>
          );
        })}
        {!list.length && <p className="hint">Nothing matches.</p>}
      </div>
    </section>
  );
}
