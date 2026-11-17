import { useEffect, useRef } from 'react';
import { clearFrame, composite, createFrame, createFx } from '../pixelfx/core/index.js';
import { registerHost, transitionSound } from '../game/fxTransition';

// Plays the pixelfx screen transitions (see game/fxTransition.js) on a 320x180 canvas laid over the whole screen.
const loaders = import.meta.glob('../pixelfx/fx/transitions/*.js');

export default function FxTransitionHost() {
  const canvasRef = useRef(null);
  const busy = useRef(false);

  useEffect(() => {
    registerHost(true);
    const on = async (e) => {
      const { name, onCover, onDone, color } = e.detail || {};
      const load = loaders[`../pixelfx/fx/transitions/${name}.js`];
      if (!load || busy.current) {
        onCover?.();
        onDone?.();
        return;
      }
      busy.current = true;
      let mod;
      try {
        mod = await load();
      } catch {
        busy.current = false;
        onCover?.();
        onDone?.();
        return;
      }
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = ctx.createImageData(320, 180);
      const frame = createFrame(320, 180);
      const fx = createFx(mod, { x: 0, y: 0, color: color || '#0b0a10', seed: 1 + Math.floor(Math.random() * 9000) });
      const D = mod.meta.duration;
      canvas.classList.add('on');
      transitionSound(name, 'start');
      let last = 0;
      let covered = false;
      const tick = (now) => {
        const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
        last = now;
        fx.update(dt);
        clearFrame(frame);
        fx.draw(frame);
        composite(frame, img.data, null);
        ctx.putImageData(img, 0, 0);
        if (!covered && fx.t >= D * 0.47) {
          covered = true;
          canvas.classList.add('covered'); // (the screen is hidden: clicks stop here)
          transitionSound(name, 'cover');
          onCover?.();
        }
        if (fx.t >= D || fx.done()) {
          canvas.classList.remove('on', 'covered');
          ctx.clearRect(0, 0, 320, 180);
          busy.current = false;
          if (!covered) onCover?.();
          transitionSound(name, 'done');
          onDone?.();
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    window.addEventListener('cuzy-transition', on);
    return () => {
      window.removeEventListener('cuzy-transition', on);
      registerHost(false);
    };
  }, []);

  return <canvas ref={canvasRef} className="fx-transition" width={320} height={180} aria-hidden="true" />;
}
