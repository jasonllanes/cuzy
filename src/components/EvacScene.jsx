import { useEffect, useMemo, useRef, useState } from 'react';
import { drawHero, heroById, retroId, RETRO_COUNT } from '../game/heroes';
import { hash2 } from '../game/rng';

// The film after a won Survival run: at dawn a helicopter lands by the shelter and every survivor climbs aboard, it flies out over the
// ocean (cut), and lands in the morning among a crowd of cheering people. Skip (or Esc) jumps to the summary. `heroes` are the hero ids of
// everyone who was in the run, you first.

const W = 320;
const H = 180;
const LEN = 17.2;
const CAPS = [
  [0, '🌅 Dawn. The shelter held. A helicopter is coming down!'],
  [3.4, 'Everybody on board. Quickly!'],
  [6, '🚁 Out over the ocean… the sun is coming up.'],
  [9.6, ''],
  [10.2, 'A new morning. A safe place.'],
  [13.4, 'People are cheering. You made it. 🎉'],
];
const lerp = (a, b, k) => a + (b - a) * Math.max(0, Math.min(1, k));
const ease = (k) => 1 - (1 - Math.max(0, Math.min(1, k))) ** 2;

export default function EvacScene({ assets, heroes, onDone }) {
  const canvasRef = useRef(null);
  const [caption, setCaption] = useState(CAPS[0][1]);
  const doneRef = useRef(false);
  const list = useMemo(() => (heroes.length ? heroes : ['retro:1']).slice(0, 8), [heroes]);
  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Escape') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = assets.img;
    const survivors = list.map((id, i) => ({ hero: heroById(id), x0: 70 + i * 13 + (hash2(i, 1, 31) - 0.5) * 6, y: 142 + (i % 2) * 6, ph: i * 0.7 }));
    const crowd = Array.from({ length: 38 }, (_, i) => ({
      hero: heroById(retroId(1 + Math.floor(hash2(i, 2, 61) * RETRO_COUNT))),
      x: 14 + hash2(i, 3, 61) * 292,
      y: 128 + hash2(i, 4, 61) * 46,
      ph: hash2(i, 5, 61) * 6,
    })).filter((c) => Math.abs(c.x - 176) > 34 || c.y > 150);
    crowd.sort((a, b) => a.y - b.y);
    let raf = 0;
    let start = 0;
    let lastCap = 0;
    let scale = 2;
    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      scale = Math.max(1, Math.min(canvas.width / W, canvas.height / H));
    };
    fit();
    window.addEventListener('resize', fit);

    const heli = (x, y, right, t, spin = null, k = 0.8) => {
      const sheet = img['fx/heli'];
      if (!sheet) return;
      const f = spin === null || spin >= 1 ? 22 + (Math.floor(t * 16) % 4) : Math.min(21, Math.floor(spin * 22));
      ctx.drawImage(sheet, f * 152, right ? 0 : 144, 152, 144, Math.round(x - 76 * k), Math.round(y - 80 * k), 152 * k, 144 * k);
    };

    // ---- 1: dawn at the shelter ----
    const dawn = (t) => {
      const sky = ctx.createLinearGradient(0, 0, 0, 110);
      sky.addColorStop(0, '#3a4a8a');
      sky.addColorStop(0.6, '#ee9a6a');
      sky.addColorStop(1, '#ffd58a');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, 110);
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.arc(250, 104 - t * 1.5, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4a5a3a';
      ctx.fillRect(0, 100, W, H - 100);
      ctx.fillStyle = '#3c4a30';
      for (let i = 0; i < 40; i++) ctx.fillRect(hash2(i, 1, 9) * W, 104 + hash2(i, 2, 9) * 70, 3, 2);
      // the shelter (the container house), and a few barricades
      const bus = img['apoc/bus'];
      if (bus) ctx.drawImage(bus, 14, 150 - bus.height * 0.9, bus.width * 0.9, bus.height * 0.9);
      ctx.fillStyle = '#5b5148';
      for (let i = 0; i < 6; i++) ctx.fillRect(10 + i * 12, 152, 9, 3);
      // the helicopter comes down on the clearing to the right
      const land = ease((t - 0.3) / 3);
      const hy = lerp(-30, 132, land) - 31 * 0.8 + 6;
      const hx = 214;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(hx, 142, 34 * (0.6 + 0.4 * land), 5, 0, 0, Math.PI * 2);
      ctx.fill();
      heli(hx, hy + 1, false, t);
      if (land > 0.6) {
        // dust in the rotor wash
        ctx.fillStyle = 'rgba(230,215,180,0.3)';
        for (let i = 0; i < 8; i++) {
          const a = i * 0.8 + t * 6;
          ctx.fillRect(hx + Math.cos(a) * (30 + (i % 3) * 8), 140 + Math.sin(a) * 4, 4, 2);
        }
      }
      // the survivors walk to the helicopter and climb aboard one by one
      for (const [i, s] of survivors.entries()) {
        const go = 3.2 + i * 0.45;
        const k = (t - go) / 1.8;
        if (k >= 1) continue;
        const x = k <= 0 ? s.x0 : lerp(s.x0, hx - 4, k);
        drawHero(ctx, img, s.hero, 'right', k > 0, t + s.ph, x, s.y);
      }
    };

    // ---- 2: out over the ocean ----
    const ocean = (t) => {
      const u = t - 6;
      const sky = ctx.createLinearGradient(0, 0, 0, 100);
      sky.addColorStop(0, '#6ab4f0');
      sky.addColorStop(1, '#ffe2a8');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, 100);
      ctx.fillStyle = '#fff5c8';
      ctx.beginPath();
      ctx.arc(262, 96 - u * 4, 14, 0, Math.PI * 2);
      ctx.fill();
      // clouds slide past
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 5; i++) {
        const cx = ((hash2(i, 1, 13) * 420 - u * (14 + i * 4)) % 400 + 400) % 400 - 40;
        ctx.fillRect(cx, 20 + i * 12, 40 + (i % 3) * 14, 6);
        ctx.fillRect(cx + 8, 16 + i * 12, 24, 5);
      }
      ctx.fillStyle = '#2f86c4';
      ctx.fillRect(0, 100, W, H - 100);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let i = 0; i < 40; i++) {
        const wx = ((hash2(i, 1, 17) * 340 - u * (50 + (i % 3) * 20)) % 340 + 340) % 340 - 10;
        ctx.fillRect(wx, 104 + hash2(i, 2, 17) * 72, 10 + (i % 3) * 5, 1);
      }
      // the helicopter, flying right, with its shadow on the water
      const hy = 62 + Math.sin(u * 2) * 3;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(160, 150, 30, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      heli(160, hy, true, t, null, 0.9);
      // gulls
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const gx = ((260 - u * 30 + i * 70) % 380 + 380) % 380 - 30;
        const gy = 30 + i * 14 + Math.sin(u * 4 + i) * 3;
        ctx.beginPath();
        ctx.moveTo(gx - 5, gy);
        ctx.lineTo(gx, gy + 2);
        ctx.lineTo(gx + 5, gy);
        ctx.stroke();
      }
    };

    // ---- 3: morning, among a crowd ----
    const morning = (t) => {
      const u = t - 10;
      const sky = ctx.createLinearGradient(0, 0, 0, 90);
      sky.addColorStop(0, '#7cc4f4');
      sky.addColorStop(1, '#d8f0ff');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, 90);
      // a small town behind
      for (let i = 0; i < 9; i++) {
        const bx = i * 38 - 6;
        const bh = 34 + hash2(i, 1, 41) * 30;
        ctx.fillStyle = ['#c9b79a', '#b8a88c', '#d6c6aa'][i % 3];
        ctx.fillRect(bx, 98 - bh, 34, bh);
        ctx.fillStyle = '#6f95b5';
        for (let wy = 98 - bh + 6; wy < 92; wy += 10) for (let wx = bx + 5; wx < bx + 30; wx += 11) ctx.fillRect(wx, wy, 5, 5);
      }
      ctx.fillStyle = '#9aa0a8';
      ctx.fillRect(0, 98, W, H - 98);
      // the helipad
      ctx.fillStyle = '#7d848c';
      ctx.beginPath();
      ctx.ellipse(176, 150, 52, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffd34a';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#ffd34a';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('H', 171, 155);
      // the helicopter settles on it, and the rotor slows down
      const down = ease(u / 2.4);
      const slow = u < 3.4 ? null : Math.max(0, 1 - (u - 3.4) / 2.4);
      const hy = lerp(40, 150, down) - 31 * 0.8;
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.ellipse(176, 152, 30, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      // (the crowd behind the helicopter first, the ones in front of it after)
      for (const c of crowd) if (c.y < 150) personAt(c, t);
      heli(176, hy, true, t, slow, 0.8);
      for (const c of crowd) if (c.y >= 150) personAt(c, t);
      // the survivors step out and walk into the crowd
      for (const [i, s] of survivors.entries()) {
        const k = (u - 3.6 - i * 0.4) / 1.6;
        if (k <= 0) continue;
        drawHero(ctx, img, s.hero, 'down', true, t + s.ph, lerp(190, 120 + i * 18, k), lerp(144, 168, ease(k)));
      }
      // confetti
      for (let i = 0; i < 70; i++) {
        const cx = hash2(i, 1, 23) * W + Math.sin(t * 2 + i) * 6;
        const cy = ((hash2(i, 2, 23) * H + (t - 11) * (30 + (i % 5) * 8)) % H + H) % H;
        if (t < 12) break;
        ctx.fillStyle = ['#ff5f7a', '#ffd34a', '#5fd0ff', '#7dff9a', '#c77dff'][i % 5];
        ctx.fillRect(cx, cy, 2, 3);
      }
    };
    const personAt = (c, t) => {
      const hop = t > 11.5 ? Math.abs(Math.sin(t * 6 + c.ph)) * 2.5 : 0;
      drawHero(ctx, img, c.hero, c.x < 176 ? 'right' : 'left', false, t + c.ph, c.x, c.y - hop);
    };

    const tick = (now) => {
      if (!start) start = now;
      const t = (now - start) / 1000;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, Math.round((canvas.width - W * scale) / 2), Math.round((canvas.height - H * scale) / 2));
      ctx.imageSmoothingEnabled = false;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.clip();
      if (t < 6) dawn(t);
      else if (t < 9.6) ocean(t);
      else if (t >= 10) morning(t);
      // the cut: a flash of white, then the morning
      if (t >= 9.5 && t < 10.2) {
        ctx.fillStyle = `rgba(255,255,255,${t < 9.8 ? (t - 9.5) / 0.3 : 1 - (t - 9.8) / 0.4})`;
        ctx.fillRect(0, 0, W, H);
        if (t >= 9.6 && t < 10) {
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, W, H);
        }
      }
      if (t > LEN - 1.2) {
        ctx.fillStyle = `rgba(0,0,0,${Math.min(1, (t - (LEN - 1.2)) / 1.2)})`;
        ctx.fillRect(0, 0, W, H);
      }
      ctx.restore();
      let ci = 0;
      for (let i = 0; i < CAPS.length; i++) if (t >= CAPS[i][0]) ci = i;
      if (ci !== lastCap) {
        lastCap = ci;
        setCaption(CAPS[ci][1]);
      }
      if (t >= LEN) {
        finish();
        return;
      }
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
    <div className="opening-scene" role="presentation">
      <canvas ref={canvasRef} className="opening-canvas" />
      {caption && <div className="opening-cap">{caption}</div>}
      <button type="button" className="btn ghost small-btn opening-skip" onClick={finish}>Skip ⏭</button>
    </div>
  );
}
