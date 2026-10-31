import { useEffect, useState } from 'react';
import { atlasUrl, loadTheme } from '../v2/assets';

// One sprite of the Modern Exteriors pack (an atlas by theme, and the sprite's name), drawn with crisp pixels.
export default function V2Sprite({ theme, name, scale = 2, flip = false, className = '', style }) {
  const [it, setIt] = useState(null);
  useEffect(() => {
    let on = true;
    loadTheme(theme).then((t) => {
      const s = t.byName.get(name);
      if (on && s) setIt({ ...s, aw: t.img.width, ah: t.img.height });
    }).catch(() => {});
    return () => {
      on = false;
    };
  }, [theme, name]);
  if (!it) return <span className={`v2s ${className}`} style={{ display: 'inline-block', width: 0, height: 0 }} />;
  return (
    <span
      className={`v2s ${className}`}
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: it.w * scale,
        height: it.h * scale,
        backgroundImage: `url(${atlasUrl(theme)})`,
        backgroundPosition: `-${it.x * scale}px -${it.y * scale}px`,
        backgroundSize: `${it.aw * scale}px ${it.ah * scale}px`,
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
        transform: flip ? 'scaleX(-1)' : undefined,
        ...style,
      }}
    />
  );
}
