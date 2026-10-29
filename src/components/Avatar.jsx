import { useEffect, useRef } from 'react';
import { drawHero, heroById } from '../game/heroes';

// A tiny picture of a hero, for the scoreboards
export default function Avatar({ assets, id, size = 22 }) {
  const ref = useRef(null);
  const hero = id ? heroById(id) : null;
  const wide = hero?.kind === 'sunny'; // the villagers are drawn on a much bigger frame
  useEffect(() => {
    const cv = ref.current;
    if (!cv || !hero) return;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cv.width, cv.height);
    const w = wide ? 96 : 40;
    const h = wide ? 64 : 44;
    ctx.save();
    ctx.scale(cv.width / w, cv.height / h);
    drawHero(ctx, assets.img, hero, 'down', false, 0, w / 2, h - 3);
    ctx.restore();
  }, [assets, hero, wide]);
  if (!hero) return <span className="avatar blank" style={{ width: size, height: size }} aria-hidden="true">👤</span>;
  return <canvas ref={ref} className="avatar" width={size * 2} height={size * 2} style={{ width: size, height: size }} aria-hidden="true" />;
}
