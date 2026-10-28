import { useEffect, useRef } from 'react';
import { Game } from '../game/engine';
import { World } from '../game/world';
import { HEROES } from '../game/heroes';

// A slowly drifting fly-over of the chosen seed, used behind the menu.
export default function WorldBackdrop({ assets, seed }) {
  const ref = useRef(null);

  useEffect(() => {
    // debounce so typing a seed doesn't rebuild the world on every keystroke
    let game;
    const timer = setTimeout(() => {
      game = new Game({ canvas: ref.current, world: new World(seed || 'x'), assets, hero: HEROES[0], demo: true });
      game.start();
    }, 250);
    return () => {
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
