import { useEffect, useRef, useState } from 'react';
import { drawHero, heroById } from '../game/heroes';
import { hash2 } from '../game/rng';

// Game over (a Survival shelter that fell): a big GAME OVER in the middle of a dark red screen, blood splattering across it, your hero
// lying on the ground and a ghost, the soul, rising out of the body. After a moment the numbers and the way back appear underneath.

const FLAMES = { 1: [16, 16], 2: [16, 16], 3: [32, 16], 4: [32, 16], 5: [32, 32], 6: [48, 32] }; // the flame animations (5 frames each): their size
const W = 320;
const H = 180;

export default function GameOverScene({ assets, hero, name, stats = [], board = [], boardTitle = '', continueLabel = 'Continue', onContinue }) {
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 3200);
    const onKey = (e) => {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') {
        e.preventDefault();
        setReady(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = assets.img;
    const me = heroById(hero);
    const font = (getComputedStyle(document.documentElement).getPropertyValue('--pixel') || '').trim() || 'monospace';
    // the splatters: where, how big, when they land
    const splats = Array.from({ length: 34 }, (_, i) => ({
      x: 20 + hash2(i, 1, 5) * 280,
      y: 12 + hash2(i, 2, 5) * 150,
      r: 4 + hash2(i, 3, 5) * 15,
      at: 0.1 + hash2(i, 4, 5) * 2.4,
      drip: hash2(i, 5, 5) < 0.4 ? 8 + hash2(i, 6, 5) * 26 : 0,
      dots: Array.from({ length: 7 }, (_, k) => [hash2(i, 10 + k, 5) * Math.PI * 2, 1.2 + hash2(i, 20 + k, 5) * 1.6, 1 + hash2(i, 30 + k, 5) * 2.4]),
    }));
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

    const tick = (now) => {
      if (!start) start = now;
      const t = (now - start) / 1000;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#0a0204';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, Math.round((canvas.width - W * scale) / 2), Math.round((canvas.height - H * scale) / 2));
      ctx.imageSmoothingEnabled = false;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.clip();
      // a dark red room, and a vignette
      const bg = ctx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, 210);
      bg.addColorStop(0, '#4a0a12');
      bg.addColorStop(1, '#0c0204');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 118, W, H - 118);
      // the blood, splatting on one after another
      for (const s of splats) {
        const k = (t - s.at) / 0.25;
        if (k <= 0) continue;
        const r = s.r * Math.min(1, k) ** 0.6;
        ctx.fillStyle = 'rgba(150,10,24,0.82)';
        ctx.beginPath();
        ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(100,4,14,0.9)';
        for (const [a, d, rr] of s.dots) {
          ctx.beginPath();
          ctx.arc(s.x + Math.cos(a) * r * d, s.y + Math.sin(a) * r * d, rr * Math.min(1, k), 0, Math.PI * 2);
          ctx.fill();
        }
        if (s.drip) {
          const len = Math.min(s.drip, Math.max(0, (t - s.at - 0.2) * 14));
          ctx.fillStyle = 'rgba(130,8,20,0.9)';
          ctx.fillRect(Math.round(s.x - 1), Math.round(s.y), 2, Math.round(len));
          ctx.beginPath();
          ctx.arc(s.x, s.y + len, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // fires burning along the floor
      for (const [n, x, k] of [[6, 36, 1.5], [5, 92, 1.2], [3, 232, 1.4], [6, 286, 1.5], [4, 20, 1.2], [5, 262, 1.1]]) {
        const f = img[`fx/flame${n}`];
        if (!f) continue;
        const [fw, fh] = FLAMES[n];
        const grow = Math.min(1, Math.max(0, (t - 0.2) / 1.2));
        ctx.drawImage(f, (Math.floor(t * 10 + x) % 5) * fw, 0, fw, fh, Math.round(x - (fw * k) / 2), Math.round(140 - fh * k * grow + 8), fw * k, fh * k * grow);
      }
      // your hero, lying on the ground in a pool
      const bx = 150;
      const by = 140;
      ctx.fillStyle = 'rgba(110,6,16,0.9)';
      ctx.beginPath();
      ctx.ellipse(bx, by + 2, 26 * Math.min(1, t / 1.5), 7 * Math.min(1, t / 1.5), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(bx + 8, by - 2);
      ctx.rotate(-Math.PI / 2); // (on its side: the head to the left)
      drawHero(ctx, img, me, 'down', false, 0, 0, 0);
      ctx.restore();
      // the soul: the friendly ghost slips out of the body and drifts up, over and over
      const g = img['fx/ghost'];
      if (g) {
        for (let n = 0; n < 2; n++) {
          const u = ((t - 1.2 - n * 2.4) % 4.8 + 4.8) % 4.8; // (a new soul every few seconds)
          if (t < 1.2 + n * 2.4 || u > 4.4) continue;
          const k = u / 4.4;
          const gx = bx - 4 + Math.sin(u * 2.2) * 10;
          const gy = by - 12 - k * 105;
          ctx.save();
          ctx.globalAlpha = Math.sin(Math.PI * Math.min(1, k * 1.05)) * 0.85;
          ctx.drawImage(g, (Math.floor(t * 6) % 4) * 32, 0, 32, 32, Math.round(gx - 24), Math.round(gy - 40), 48, 48);
          ctx.restore();
        }
      }
      // GAME OVER, big, in the middle (it slams in, then breathes and shakes a little)
      const k = Math.min(1, Math.max(0, (t - 0.4) / 0.35));
      if (k > 0) {
        const pulse = 1 + 0.03 * Math.sin(t * 3);
        const slam = 2.6 - 1.6 * k;
        const sx = t < 0.9 ? (Math.random() - 0.5) * 3 : 0;
        ctx.save();
        ctx.translate(W / 2 + sx, 78);
        ctx.scale(slam * pulse, slam * pulse);
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
        ctx.fillStyle = 'rgba(255,200,200,0.35)';
        ctx.fillText('GAME OVER', -1, -1);
        ctx.restore();
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

  return (
    <div className="opening-scene gameover" role="dialog" aria-label="Game over">
      <canvas ref={canvasRef} className="opening-canvas" />
      {ready && (
        <div className="go-panel">
          <p className="go-sub">{name ? `${name}, the shelter has fallen.` : 'The shelter has fallen.'}</p>
          <div className="go-stats">
            {stats.map((s) => (
              <span key={s.label} className="go-stat">{s.icon} {s.label}: <b>{s.text ? s.text(s.value) : s.value}</b></span>
            ))}
          </div>
          {board.length > 0 && (
            <div className="go-board">
              <small>{boardTitle}</small>
              {board.slice(0, 4).map((r) => <span key={r.name} className={r.me ? 'me' : ''}>{r.name}: <b>{r.n}</b></span>)}
            </div>
          )}
          <button type="button" className="btn go" onClick={onContinue}>{continueLabel}</button>
        </div>
      )}
    </div>
  );
}
