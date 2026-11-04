import { useMemo, useState } from 'react';
import { MONSTERS } from '../game/monsters';
import { BIOME_FOES } from '../game/combat';
import MonsterIcon from './MonsterIcon';

// Every creature in the game, with its picture, what it does and where it turns up, so you can tell what is attacking you.
// (The bottom of the list is the things that are NOT creatures but hurt: arrows, spells and spit.)

const BIOME_NAMES = {
  clover: 'Clover Vale (meadow)', tidal: 'Tidal Isles', emerald: 'Emerald Isles', crystal: 'Crystal Lakes', marsh: 'Mossy Marsh', lava: 'Magma Fields',
  beach: 'Sunny Shores', asphalt: 'Cracked Roads', mountain: 'Mountain Paths', wood: 'Wooden Halls',
};

// where a type lives in Free Roam, from the biome tables
function whereOf(type) {
  const out = [];
  for (const [biome, t] of Object.entries(BIOME_FOES)) {
    const slots = ['day', 'night', 'boss', 'mini'].filter((k) => t[k]?.includes(type));
    if (slots.length) out.push(`${BIOME_NAMES[biome] || biome}${slots.includes('boss') ? ' (boss)' : slots.includes('mini') ? ' (mini boss)' : slots.every((s) => s === 'night') ? ' (night)' : ''}`);
  }
  return out;
}

const SKILLS = { charge: 'Charges at you in a straight line (a red lane warns you first)', block: 'Raises its guard now and then (it takes much less damage)', summon: 'Calls skeletons to fight for it', heal: 'Heals the monsters around it' };

function describe(def) {
  const bits = [];
  if (def.apoc) bits.push('A zombie of the Survival waves.');
  if (def.kind === 'fly' || def.fly) bits.push('Flies, so walls and water do not stop it.');
  if (def.kind === 'shoot') bits.push(def.cast ? 'Casts a spell: a red circle appears where you stand, and it lands a moment later. Step out of it.' : def.arrow ? 'Shoots arrows (a thin brown line with a bright tip). Stay out of its line, or get close.' : 'Spits or shoots from a distance.');
  if (def.skill && SKILLS[def.skill]) bits.push(SKILLS[def.skill] + '.');
  if (def.boss) bits.push('A boss: very tough, with red warnings before its big moves.');
  if (!bits.length) bits.push('Walks up to you and hits in melee.');
  return bits.join(' ');
}

const GROUPS = [
  ['Free Roam: meadow and island monsters', (id, d) => !d.tiny && !d.apoc],
  ['Free Roam: fighters, archers and casters (the Tiny RPG folk)', (id, d) => !!d.tiny],
  ['Survival: the zombies', (id, d) => !!d.apoc],
];

const NOT_CREATURES = [
  ['➖', 'Arrow', 'A thin brown line with a pale streak and a bright tip, flying fast. Fired by Soldiers, Hunters and Skeleton Archers. If you see arrows but no shooter, it is standing in the dark: at night every monster now glows faintly red with bright eyes.'],
  ['🔴', 'Red circle on the ground', 'A spell or a boss skill about to land. It fills up, then hurts everyone standing inside. Walk out of it.'],
  ['🟥', 'Red lane or fan', 'A boss or a heavy monster winding up a charge or a swing. It only hurts inside the red.'],
  ['🟢', 'Green orb', 'Spit from a Watcher, Shrieker or another spitter.'],
  ['💣', 'Grenade with a circle', 'Red circle: it explodes. Blue: it stuns. Grey: it makes smoke. Anyone can throw them, and you see other players\' grenades too.'],
];

export default function Bestiary({ onClose, survival }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const groups = useMemo(() => {
    const all = Object.entries(MONSTERS);
    return GROUPS.map(([title, test]) => [title, all.filter(([id, d]) => test(id, d) && (!q || `${d.name} ${id}`.toLowerCase().includes(q.toLowerCase())))]).filter(([, list]) => list.length);
  }, [q]);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panel bestiary">
        <header className="inv-head">
          <h2>👹 Creatures</h2>
          <input className="bestiary-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name…" aria-label="Search the creatures" />
          <button className="btn small-btn" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <p className="hint">Tap a creature for details. {survival ? 'In Survival you mostly meet the zombies, and the Colossus bosses.' : 'Which ones you meet depends on the map and the time of day.'}</p>
        <div className="bestiary-body">
          {groups.map(([title, list]) => (
            <section key={title}>
              <h3>{title}</h3>
              <div className="bestiary-grid">
                {list.map(([id, d]) => (
                  <button key={id} type="button" className={`bestiary-card ${open === id ? 'on' : ''}`} onClick={() => setOpen(open === id ? null : id)}>
                    <MonsterIcon type={id} size={44} />
                    <b>{d.name}</b>
                    <small>❤️ {d.hp} · ⚔️ {d.dmg} · 💨 {d.speed}</small>
                    {open === id && (
                      <span className="bestiary-more">
                        {describe(d)}
                        {whereOf(id).length > 0 && <><br /><i>Found in:</i> {whereOf(id).join(', ')}</>}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </section>
          ))}
          {!q && (
            <section>
              <h3>Not creatures, but they hurt</h3>
              <ul className="bestiary-list">
                {NOT_CREATURES.map(([icon, name, text]) => (
                  <li key={name}><b>{icon} {name}</b> {text}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
