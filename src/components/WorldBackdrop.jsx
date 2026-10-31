import { useEffect, useRef } from 'react';
import { Game } from '../game/engine';
import { World } from '../game/world';
import { HEROES } from '../game/heroes';
import { HALLOWEEN_THEMES, SURVIVAL_THEMES, isHalloweenSeed, loadV2Images } from '../game/v2world';
import { SURVIVAL_BASE } from '../game/maps';

// the menu's town: only the atlases the backdrop actually draws are fetched
const MENU_THEMES = ['props', 'houses', 'villas', 'shops', 'vehicles', 'camping', 'garden'];

// The first stretch of dry land (grass all round) near the usual start, so a map that begins at sea still shows some of its land
function landNear(world) {
  const ok = (x, y) => [[0, 0], [-9, 0], [9, 0], [0, -6], [0, 6], [-9, -6], [9, 6], [-9, 6], [9, -6]].every(([dx, dy]) => world.type(x + dx, y + dy) === 2);
  for (let r = 0; r <= 120; r += 3) {
    for (let a = 0; a < 16; a++) {
      const x = 8 + Math.round(Math.cos((a * Math.PI) / 8) * r);
      const y = 12 + Math.round(Math.sin((a * Math.PI) / 8) * r);
      if (ok(x, y)) return { x, y };
    }
  }
  return null;
}

// A slowly drifting fly-over of the chosen seed (dressed with the Modern Exteriors town), used behind the menu.
export default function WorldBackdrop({ assets, seed }) {
  const ref = useRef(null);

  useEffect(() => {
    // debounce so typing a seed doesn't rebuild the world on every keystroke
    let game;
    let gone = false;
    const timer = setTimeout(async () => {
      const survival = String(seed || '').startsWith(SURVIVAL_BASE);
      try {
        await loadV2Images(assets.img, survival ? SURVIVAL_THEMES : isHalloweenSeed(seed) ? [...MENU_THEMES, ...HALLOWEEN_THEMES] : MENU_THEMES);
      } catch {
        // without the town art the backdrop is just the land
      }
      if (gone || !ref.current) return;
      // the backdrop is the map you picked: a Survival map is built like Survival (its own ground and trees), a Free Roam map gets the V2 town
      const world = survival ? new World(seed, { theme: 'apoc' }) : new World(assets.img['v2/props'] ? `${String(seed || 'x').replace(/~v2$/, '')}~v2` : seed || 'x');
      game = new Game({ canvas: ref.current, world, assets, hero: HEROES[0], demo: true });
      const spot = landNear(world);
      if (spot) {
        game.cam.x = game.player.x = spot.x * 16;
        game.cam.y = game.player.y = spot.y * 16;
      }
      game.start();
    }, 250);
    return () => {
      gone = true;
      clearTimeout(timer);
      game?.stop();
    };
  }, [assets, seed]);

  return (
    <div className="backdrop">
      <canvas ref={ref} />
    </div>
  );
}
