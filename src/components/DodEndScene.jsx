import { useEffect, useRef, useState } from 'react';
import { drawHero, heroById } from '../game/heroes';
import { hash2 } from '../game/rng';
import { TINY } from '../game/tiny';

// The end of a Do or Die round.
//  survivors win: a chopper hangs over the scene, three firefighters (Modern Exteriors) flame the Werebear in the middle until it burns
//    down and its ghost rises.
//  the Werebear wins: the Game Over screen of Survival, with the Werebear standing in front and the survivors lying behind him.
const W = 320;
const H = 180;
const FLAMES = { 1: [16, 16], 2: [16, 16], 3: [32, 16], 4: [32, 16], 5: [32, 32], 6: [48, 32] };

export default function DodEndScene({ assets, mode, heroes = [], role = 'survivor', onContinue }) {
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);
  const win = mode === 'survivors';

  useEffect(() => {
    const t = setTimeout(() => setReady(true), win ? 6500 : 3600);
    const onKey = (e) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        setReady(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [win]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = assets.img;
    const base = import.meta.env.BASE_URL;
    const fighters = [1, 2, 3].map((n) => {
      const im = new Image();
      im.src = `${base}assets/ending/firefighter${n}.png`;
      return im;
    });
    const font = (getComputedStyle(document.documentElement).getPropertyValue('--pixel') || '').trim() || 'monospace';
    const info = TINY.chars.werebear;
    const bear = img['tiny/werebear'];
    const list = heroes.length ? heroes : ['amelia'];
    const splats = Array.from({ length: 26 }, (_, i) => ({ x: 14 + hash2(i, 1, 9) * 290, y: 10 + hash2(i, 2, 9) * 150, r: 3 + hash2(i, 3, 9) * 12, at: 0.1 + hash2(i, 4, 9) * 2 }));
    let raf = 0;
    let start = 0;
    let scale = 2;
    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      scale = Math.max(1, Math.min(canvas.width / W, canvas.height / H));
    };
    fit();
    window.addEventListener('resize', fit);

    // the Werebear: row/frame of its sheet, drawn with its feet at (x, y)
    const drawBear = (x, y, sc, row, f, flip = false, tint = null) => {
      if (!bear || !info) return;
      const [r, n] = info[row];
      const fr = Math.min(n - 1, Math.floor(f));
      ctx.save();
      ctx.translate(x, y);
      if (flip) ctx.scale(-1, 1);
      ctx.drawImage(bear, fr * 100, r * 100, 100, 100, -info.cx * sc, -info.foot * sc, 100 * sc, 100 * sc);
      if (tint) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = tint;
        ctx.fillRect(-info.cx * sc, -info.foot * sc, 100 * sc, 100 * sc);
      }
      ctx.restore();
    };
    const flame = (n, x, y, k, t, seed) => {
      const f = img[`fx/flame${n}`];
      if (!f) return;
      const [fw, fh] = FLAMES[n];
      ctx.drawImage(f, (Math.floor(t * 10 + seed) % 5) * fw, 0, fw, fh, Math.round(x - (fw * k) / 2), Math.round(y - fh * k), fw * k, fh * k);
    };
    const ghost = (x, y0, t, t0) => {
      const g = img['fx/ghost'];
      if (!g || t < t0) return;
      const u = ((t - t0) % 4.8 + 4.8) % 4.8;
      if (u > 4.4) return;
      const k = u / 4.4;
      ctx.save();
      ctx.globalAlpha = Math.sin(Math.PI * Math.min(1, k * 1.05)) * 0.85;
      ctx.drawImage(g, (Math.floor(t * 6) % 4) * 32, 0, 32, 32, Math.round(x - 24 + Math.sin(u * 2.2) * 8), Math.round(y0 - k * 100 - 40), 48, 48);
      ctx.restore();
    };

    const tick = (now) => {
      if (!start) start = now;
      const t = (now - start) / 1000;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#05060c';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, Math.round((canvas.width - W * scale) / 2), Math.round((canvas.height - H * scale) / 2));
      ctx.imageSmoothingEnabled = false;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.clip();

      if (win) {
        // a dusk sky over a dark clearing
        const sky = ctx.createLinearGradient(0, 0, 0, H);
        sky.addColorStop(0, '#1a1633');
        sky.addColorStop(0.55, '#6b3a4a');
        sky.addColorStop(0.7, '#c9784a');
        sky.addColorStop(0.7001, '#1d2418');
        sky.addColorStop(1, '#0d120b');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, H);
        // the chopper, hanging over them (its light falls on the scene)
        const heli = img['fx/heli'];
        const hx = 92;
        const hy = 38 + Math.sin(t * 2) * 2;
        ctx.fillStyle = 'rgba(255,236,160,0.12)';
        ctx.beginPath();
        ctx.moveTo(hx + 8, hy + 12);
        ctx.lineTo(hx - 40, 150);
        ctx.lineTo(hx + 60, 150);
        ctx.closePath();
        ctx.fill();
        if (heli) {
          const f = 22 + (Math.floor(t * 16) % 4);
          ctx.drawImage(heli, f * 152, 0, 152, 144, Math.round(hx - 76 * 0.7), Math.round(hy - 80 * 0.7), 152 * 0.7, 144 * 0.7);
        }
        // the three firefighters, backs to us, each with a stream of fire to the Werebear
        const spots = [[72, 168], [160, 176], [248, 168]];
        const bx = 160;
        const by = 132;
        const burning = t > 1.4;
        spots.forEach(([fx, fy], i) => {
          const im = fighters[i];
          if (im.complete && im.naturalWidth) ctx.drawImage(im, (Math.floor(t * 6) % 6) * 32, 0, 32, 32, Math.round(fx - 32), Math.round(fy - 64), 64, 64);
          if (t > 0.7 && t < 5.2) {
            const sx = fx + 6;
            const sy = fy - 40;
            for (let p = 0; p < 12; p++) {
              const u = ((t * 2.4 + p / 12) % 1);
              const px = sx + (bx - sx) * u + Math.sin(u * 9 + p) * 3;
              const py = sy + (by - 26 - sy) * u + Math.cos(u * 7 + p) * 2;
              ctx.globalAlpha = 0.9 * (1 - u * 0.3);
              flame(2, px, py + 6, 0.5 + u * 0.7, t, p * 3 + i);
            }
            ctx.globalAlpha = 1;
          }
        });
        // the Werebear in the middle: it roars, burns, and goes down
        const dead = t > 4.6;
        const flick = burning && !dead ? 0.35 + 0.25 * Math.sin(t * 25) : 0;
        if (!dead) drawBear(bx, by, 2.2, burning && t > 3.4 ? 'hurt' : 'idle', burning && t > 3.4 ? (t * 8) % 4 : (t * 6) % 6, false, flick ? `rgba(255,120,20,${flick})` : null);
        else drawBear(bx, by, 2.2, 'death', Math.min(3, (t - 4.6) * 4), false, `rgba(30,10,0,${Math.min(0.6, (t - 4.6) * 0.5)})`);
        if (burning) {
          const grow = Math.min(1, (t - 1.4) / 1.2);
          const out = dead ? Math.max(0, 1 - (t - 4.6) / 1.4) : 1;
          if (out > 0) {
            ctx.globalAlpha = out;
            for (const [n, dx, dy, k] of [[6, -14, 0, 1.3], [5, 12, -8, 1.2], [6, 0, -34, 1.5], [5, -22, -26, 1.1], [3, 20, -30, 1.2], [6, 4, -8, 1.4]]) flame(n, bx + dx, by + dy + 6, k * grow, t, dx);
            ctx.globalAlpha = 1;
          }
        }
        if (dead) ghost(bx, by - 10, t, 5);
        // the title
        const k = Math.min(1, Math.max(0, (t - 0.3) / 0.4));
        ctx.save();
        ctx.globalAlpha = k;
        ctx.translate(W / 2, 20);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `bold 20px ${font}`;
        ctx.lineJoin = 'round';
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#000';
        const txt = role === 'killer' ? 'BURNED DOWN' : 'THE WEREBEAR BURNS';
        ctx.strokeText(txt, 0, 0);
        ctx.fillStyle = '#ffb347';
        ctx.fillText(txt, 0, 0);
        ctx.restore();
      } else {
        // the Game Over screen
        const bg = ctx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, 210);
        bg.addColorStop(0, '#4a0a12');
        bg.addColorStop(1, '#0c0204');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, 118, W, H - 118);
        for (const s of splats) {
          const k = (t - s.at) / 0.25;
          if (k <= 0) continue;
          ctx.fillStyle = 'rgba(150,10,24,0.8)';
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r * Math.min(1, k) ** 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
        // the survivors, lying behind
        const n = Math.min(list.length, 4);
        list.slice(0, n).forEach((h, i) => {
          const x = 70 + i * 54;
          const y = 128 + (i % 2) * 6;
          ctx.fillStyle = 'rgba(110,6,16,0.9)';
          ctx.beginPath();
          ctx.ellipse(x, y + 2, 20 * Math.min(1, t / 1.2), 6 * Math.min(1, t / 1.2), 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.save();
          ctx.translate(x + 7, y - 2);
          ctx.rotate(i % 2 ? Math.PI / 2 : -Math.PI / 2);
          drawHero(ctx, img, heroById(h), 'down', false, 0, 0, 0);
          ctx.restore();
          ghost(x, y - 12, t, 1.3 + i * 0.9);
        });
        // the Werebear, standing in front of them
        const idle = Math.floor(t * 6);
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.ellipse(205, 172, 26, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.save();
        ctx.shadowColor = 'rgba(255,40,40,0.85)';
        ctx.shadowBlur = 10;
        drawBear(205, 172, 2.6, 'idle', idle % 6);
        ctx.restore();
        // GAME OVER (it slams in)
        const k = Math.min(1, Math.max(0, (t - 0.4) / 0.35));
        if (k > 0) {
          const slam = 2.6 - 1.6 * k;
          ctx.save();
          ctx.translate(W / 2, 40);
          ctx.scale(slam * (1 + 0.03 * Math.sin(t * 3)), slam * (1 + 0.03 * Math.sin(t * 3)));
          ctx.globalAlpha = k;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = `bold 34px ${font}`;
          ctx.lineJoin = 'round';
          ctx.lineWidth = 6;
          ctx.strokeStyle = '#000';
          ctx.strokeText('GAME OVER', 0, 0);
          ctx.fillStyle = '#e0192f';
          ctx.fillText('GAME OVER', 0, 0);
          ctx.restore();
        }
      }
      ctx.restore();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', fit);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lines = win
    ? role === 'killer'
      ? ['The survivors made it onto the chopper,', 'and the firefighters burned you down.']
      : ['You made it. The chopper lifts off,', 'and the firefighters finish the Werebear.']
    : role === 'killer'
      ? ['Nobody got away.', 'You got them all.']
      : ['The Werebear got everyone.', 'Nobody was left to bring you back.'];
  return (
    <div className="opening-scene gameover" role="dialog" aria-label="Do or Die is over">
      <canvas ref={canvasRef} className="opening-canvas" />
      {ready && (
        <div className="go-panel">
          <p className="go-sub">{lines[0]}<br />{lines[1]}</p>
          <button type="button" className="btn go" onClick={onContinue}>Back to the room</button>
        </div>
      )}
    </div>
  );
}
