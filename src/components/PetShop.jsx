import { useState } from 'react';
import { PETS, PET_KINDS } from '../game/pets';
import { RARITIES, petRarity } from '../game/items';
import RarityTabs from './RarityTabs';

// One colour of a pet, cut from the pet sheet (the side view, first frame)
function Thumb({ kind, v, size = 2 }) {
  const blk = PETS[kind].blocks[v] || PETS[kind].blocks[0];
  const px = 16 * size;
  return (
    <span
      className="pet-thumb"
      style={{ width: px, height: px, backgroundImage: `url(${import.meta.env.BASE_URL}assets/pets/sheet.png)`, backgroundSize: `${256 * size}px ${480 * size}px`, backgroundPosition: `-${blk.c * px}px -${blk.r * px}px` }}
    />
  );
}

// The pets: buy one, pick its colour, and call it to your side (one at a time). It fights what hurts you, or what you hit.
export default function PetShop({ hud, game }) {
  const pets = hud.pets || { owned: {}, active: null, rest: false };
  const [pick, setPick] = useState({});
  return (
    <div>
      <p className="hint">A pet follows you and attacks whatever is hurting you, or whatever you are hitting. If it is worn out it falls asleep (💤) where it was and wakes up again later.</p>
      <RarityTabs items={PET_KINDS} rarity={(k) => petRarity(PETS[k].cost)}>{(list) => (
      <div className="upg-list pet-list">
        {list.map((kind) => {
          const def = PETS[kind];
          const has = pets.owned[kind] !== undefined;
          const v = has ? pets.owned[kind] : pick[kind] ?? 0;
          const active = pets.active === kind;
          return (
            <div className={`upg-row pet-row ${active ? 'is-active' : ''}`} key={kind}>
              <div className="upg-icon"><Thumb kind={kind} v={v} size={3} /></div>
              <div className="upg-info">
                <h3>{def.icon} {def.name} <i className="rar-tag">{RARITIES[petRarity(def.cost)].name}</i> {active && <small>{pets.rest ? '💤 asleep' : 'with you'}</small>}</h3>
                <p>{def.blurb}</p>
                <div className="pet-swatches">
                  {def.blocks.map((b, i) => (
                    <button key={i} type="button" className={`pet-sw ${i === v ? 'on' : ''}`} title="Colour" onClick={() => (has ? game.recolorPet(kind, i) : setPick((p) => ({ ...p, [kind]: i })))}>
                      <Thumb kind={kind} v={i} size={1.5} />
                    </button>
                  ))}
                </div>
              </div>
              {!has ? (
                <button className="btn go small-btn" disabled={hud.coins < def.cost} onClick={() => game.buyPet(kind, v)}>🪙 {def.cost}</button>
              ) : active ? (
                <button className="btn small-btn" onClick={() => game.callPet(null)}>Send away</button>
              ) : (
                <button className="btn go small-btn" onClick={() => game.callPet(kind)}>Call</button>
              )}
            </div>
          );
        })}
      </div>
      )}</RarityTabs>
    </div>
  );
}
