import { useEffect, useRef } from 'react';
import { drawHero } from '../game/heroes';

// Little animated portrait of a hero, drawn at native size and upscaled with CSS.
// The villager is shorter than the other heroes. `sunnyScale` 1 shows it at its true size next to them;
// the hairstyle chips pass 2 so the hair detail is easy to see.
export default function SpritePreview({ img, hero, active, dir = 'down', className = '', sunnyScale = 1 }) {
  const ref = useRef(null);
  const sunny = hero.kind === 'sunny' || hero.kind === 'apoc' || hero.kind === 'retro';
  const scale = hero.kind === 'apoc' || hero.kind === 'retro' ? 2 : sunnyScale; // the survivor is small too, so it is drawn bigger

  useEffect(() => {
    const ctx = ref.current.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    let raf;
    const start = performance.now();
    const tick = (now) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, 24, 38);
      const t = (now - start) / 1000;
      const bounce = active ? Math.abs(Math.sin(t * 6)) * 2 : 0;
      const facing = active ? dir : 'down';
      const moving = active && dir !== 'down';
      if (sunny) {
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        drawHero(ctx, img, hero, hero.kind === 'apoc' || hero.kind === 'retro' ? facing : facing === 'down' ? 'right' : facing, moving, t, 12 / scale, (36 - Math.round(bounce)) / scale);
      } else {
        drawHero(ctx, img, hero, facing, moving, t, 12, 36 - Math.round(bounce));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // hero objects are rebuilt on every render, so key on its id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img, hero.id, active, dir, scale]);

  return <canvas ref={ref} width={24} height={38} className={`sprite-preview ${className}`} />;
}
