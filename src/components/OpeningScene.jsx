import { useEffect, useMemo, useRef, useState } from 'react';
import { drawHero, heroById, retroId, RETRO_COUNT } from '../game/heroes';
import { hash2 } from '../game/rng';
import { sfx } from '../game/sfx';

// The opening of a new Survival game, before the story at the shelter: a short film drawn on a canvas from the animated Modern Exteriors
// sheets. Two versions (picked at random): the beach concert where a zombie bites someone in the crowd and a storm breaks, and the
// hospital where you wake up on a stretcher in an empty ward. Skip (or Esc) ends it at once; when it ends, onDone is called.

const W = 320;
const H = 180;
const CONCERT_LEN = 15.6;
const HOSPITAL_LEN = 11.5;

const CONCERT_CAPTIONS = [
  [0, '🎶 Beach Fest: the last night of summer!'],
  [5.2, '…Who is that?'],
  [8.6, 'Hey! Get away from—!'],
  [9.8, '⚡ RUN!'],
  [12.2, '…'],
  [14, 'Then everything went dark.'],
];
const HOSPITAL_CAPTIONS = [
  [0, 'Beep… beep… beep…'],
  [2.6, 'You wake up on a stretcher in an empty ward.'],
  [5.4, 'The lights flicker. Nobody is here.'],
  [8, 'The doors are open. Get out.'],
];

const FLAMES = { 1: [16, 16], 2: [16, 16], 3: [32, 16], 4: [32, 16], 5: [32, 32], 6: [48, 32] }; // the flame animations (5 frames each): their size
const lerp = (a, b, k) => a + (b - a) * Math.max(0, Math.min(1, k));

export default function OpeningScene({ assets, hero, onDone }) {
  const kind = useMemo(() => (Math.random() < 0.65 ? 'concert' : 'hospital'), []);
  const caps = kind === 'concert' ? CONCERT_CAPTIONS : HOSPITAL_CAPTIONS;
  const total = kind === 'concert' ? CONCERT_LEN : HOSPITAL_LEN;
  const canvasRef = useRef(null);
  const [caption, setCaption] = useState(caps[0][1]);
  const doneRef = useRef(false);
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
    const me = heroById(hero);
    // who stands in the crowd: random retro heroes, the same every time
    const crowd = Array.from({ length: 26 }, (_, i) => {
      const row = Math.floor(i / 7);
      const col = i % 7;
      return {
        hero: heroById(retroId(1 + Math.floor(hash2(i, 3, 77) * RETRO_COUNT))),
        x: 58 + col * 34 + (row % 2) * 15 + (hash2(i, 4, 77) - 0.5) * 10,
        y: 118 + row * 12,
        ph: hash2(i, 5, 77) * 6,
        vx: 0,
        vy: 0,
      };
    });
    const victim = crowd[7]; // (the one at the left end of the second row)
    crowd.forEach((c, i) => {
      // when the panic starts everyone runs: away from the left, mostly to the right and up the beach
      const a = -0.6 + hash2(i, 9, 77) * 1.4;
      const sp = 38 + hash2(i, 10, 77) * 34;
      c.vx = Math.cos(a) * sp;
      c.vy = Math.sin(a) * sp * 0.5 + (hash2(i, 11, 77) - 0.5) * 18;
    });
    let flashes = [];
    let lastBoom = -1;
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

    const frame = (sheet, fw, fh, f, x, y, dw = fw, dh = fh) => {
      if (sheet) ctx.drawImage(sheet, f * fw, 0, fw, fh, Math.round(x), Math.round(y), dw, dh);
    };
    const flame = (n, x, y, t, k = 1) => {
      const sheet = img[`fx/flame${n}`];
      if (!sheet) return;
      const [fw, fh] = FLAMES[n];
      ctx.drawImage(sheet, (Math.floor(t * 10 + x) % 5) * fw, 0, fw, fh, Math.round(x - (fw * k) / 2), Math.round(y - fh * k), fw * k, fh * k);
    };
    const zombie = (x, y, t, flip = false, tint = true) => {
      const sheet = img['apoc/z_small_walk_side'];
      if (!sheet) return;
      const n = 6;
      const fw = sheet.width / n;
      const fh = sheet.height;
      const k = 24 / fh;
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y));
      if (flip) ctx.scale(-1, 1);
      if (!tint) ctx.filter = 'none';
      ctx.drawImage(sheet, (Math.floor(t * 9) % n) * fw, 0, fw, fh, -(fw * k) / 2, -fh * k, fw * k, fh * k);
      ctx.restore();
    };

    // ---------------- the beach concert ----------------
    const concert = (t) => {
      const panic = 9.8;
      // sky, sea, sand
      const sky = ctx.createLinearGradient(0, 0, 0, 78);
      const dusk = t > 9.2 ? Math.min(1, (t - 9.2) / 1.5) : 0; // (the storm darkens everything)
      sky.addColorStop(0, `rgb(${Math.round(lerp(40, 14, dusk))},${Math.round(lerp(34, 16, dusk))},${Math.round(lerp(88, 30, dusk))})`);
      sky.addColorStop(1, `rgb(${Math.round(lerp(230, 70, dusk))},${Math.round(lerp(130, 60, dusk))},${Math.round(lerp(110, 80, dusk))})`);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, 78);
      ctx.fillStyle = dusk ? '#1d3b57' : '#2f6f9e';
      ctx.fillRect(0, 70, W, 24);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      for (let i = 0; i < 14; i++) ctx.fillRect(((i * 47 + t * 6) % (W + 20)) - 10, 74 + (i % 4) * 5, 14, 1);
      ctx.fillStyle = dusk ? '#9a8660' : '#e8c98a';
      ctx.fillRect(0, 94, W, H - 94);
      // the stage: a platform, trusses and the lights
      ctx.fillStyle = '#3a3347';
      ctx.fillRect(70, 82, 180, 16);
      ctx.fillStyle = '#554a68';
      ctx.fillRect(70, 82, 180, 3);
      ctx.fillStyle = '#2a2536';
      ctx.fillRect(74, 30, 3, 54);
      ctx.fillRect(243, 30, 3, 54);
      ctx.fillRect(74, 30, 172, 3);
      // beams from the lasers and spotlights (added on top of the sky)
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const colors = ['255,60,90', '60,255,150', '90,150,255', '255,220,70'];
      for (const [bx, dir] of [[96, 1], [224, -1]]) {
        for (let k = 0; k < 4; k++) {
          const a = -Math.PI / 2 + Math.sin(t * 1.7 + k * 1.3 + dir) * 0.9 + (k - 1.5) * 0.18;
          ctx.strokeStyle = `rgba(${colors[(k + Math.floor(t * 2)) % 4]},0.5)`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(bx, 36);
          ctx.lineTo(bx + Math.cos(a) * 140, 36 + Math.sin(a) * 140);
          ctx.stroke();
        }
      }
      // two spotlight cones that lean towards the DJ
      for (const [sx, dir] of [[104, 1], [216, -1]]) {
        const sway = Math.sin(t * 2 + dir) * 12;
        ctx.fillStyle = 'rgba(255,240,200,0.12)';
        ctx.beginPath();
        ctx.moveTo(sx, 70);
        ctx.lineTo(160 + sway - 24, 110);
        ctx.lineTo(160 + sway + 24, 110);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      // the machines, the spotlights and the DJ
      frame(img['fx/laser'], 128, 144, Math.floor(t * 12) % 20, 70, 6, 52, 58);
      frame(img['fx/laser'], 128, 144, Math.floor(t * 12 + 7) % 20, 198, 6, 52, 58);
      frame(img['fx/spot'], 32, 48, Math.floor(t * 3) % 12, 76, 44);
      frame(img['fx/spot'], 32, 48, (Math.floor(t * 3) + 5) % 12, 212, 44);
      frame(img['fx/dj'], 48, 48, Math.floor(t * 8) % 12, 136, 42);
      // the three singers: two beside the DJ, and the lead at the front of the stage
      frame(img['fx/singer2'], 16, 32, Math.floor(t * 8) % 6, 114, 60);
      frame(img['fx/singer3'], 16, 32, (Math.floor(t * 8) + 2) % 6, 194, 60);
      frame(img['fx/singer1'], 16, 32, (Math.floor(t * 9) + 4) % 6, 152, 64);
      // the crowd (and the one who gets bitten), sorted so the ones in front hide the ones behind
      const list = crowd.map((c, i) => ({ c, i })).sort((a, b) => a.c.y - b.c.y);
      let zx = -30;
      const zWalk = Math.max(0, t - 5.4);
      const arrive = 3.5;
      if (t >= 5.4) zx = lerp(-30, victim.x - 14, zWalk / arrive);
      const bitten = t >= 9;
      for (const { c, i } of list) {
        let x = c.x;
        let y = c.y;
        let moving = false;
        let dir = 'up';
        if (t >= panic) {
          const r = t - panic;
          x += c.vx * r;
          y += c.vy * r;
          moving = true;
          dir = c.vx >= 0 ? 'right' : 'left';
        }
        const hop = t < panic ? Math.abs(Math.sin(t * (t < 5.4 ? 7 : 3) + c.ph)) * (t < 5.4 ? 3 : 0.8) : 0;
        if (c === victim && bitten) {
          // the bitten one rises as a zombie and shuffles after the others
          const r = Math.max(0, t - 9.4);
          ctx.save();
          zombie(victim.x + r * 22, victim.y, t, false);
          ctx.restore();
        } else {
          drawHero(ctx, img, c.hero, dir, moving, t + c.ph, x, y - hop);
          if (t >= panic && t < panic + 1.6 && i % 3 === 0) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 9px sans-serif';
            ctx.fillText('!', Math.round(x - 2), Math.round(y - 26));
          }
        }
      }
      // the zombie from the left edge, walking in and lunging
      if (t >= 5.4 && t < 9.4) zombie(zx, victim.y, t, false);
      if (t >= 9.4) zombie(Math.min(zx + 22 * (t - 9.4), 300), victim.y - 8, t, false);
      // things catch fire when the panic starts
      if (t >= 10.4) {
        flame(6, 40, 168, t, 1.1);
        flame(5, 268, 164, t, 1);
        flame(3, 96, 108, t, 1);
        flame(4, 232, 108, t, 1);
      }
      // the rain, and the lightning
      if (t >= 9.6) {
        ctx.strokeStyle = 'rgba(190,210,255,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < 90; i++) {
          const rx = (hash2(i, 1, 55) * (W + 40) + t * 90) % (W + 40);
          const ry = (hash2(i, 2, 55) * H + t * 320) % H;
          ctx.moveTo(rx - 10, ry);
          ctx.lineTo(rx - 14, ry + 9);
        }
        ctx.stroke();
      }
      for (const f of [10.2, 10.6, 11.6]) {
        if (t >= f && t < f + 0.5) {
          const a = (1 - (t - f) / 0.5) * (Math.sin((t - f) * 40) > -0.3 ? 1 : 0.4);
          ctx.fillStyle = `rgba(255,255,255,${0.85 * a})`;
          ctx.fillRect(0, 0, W, H);
          if (lastBoom < f) {
            lastBoom = f;
            sfx.play('boom', 0.5);
          }
        }
      }
      // you, running past in the foreground
      if (t >= 11.6) {
        const x = lerp(-24, 350, (t - 11.6) / 3.2);
        drawHero(ctx, img, me, 'right', true, t * 1.5, x, 170);
      }
      // the cut to black
      if (t > 14.4) {
        ctx.fillStyle = `rgba(0,0,0,${Math.min(1, (t - 14.4) / 1)})`;
        ctx.fillRect(0, 0, W, H);
      }
    };

    // ---------------- the hospital ----------------
    const hospital = (t) => {
      ctx.fillStyle = '#26363d';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#34505a';
      ctx.fillRect(0, 0, W, 96);
      ctx.fillStyle = '#4b6f78';
      for (let x = 0; x < W; x += 40) ctx.fillRect(x, 0, 2, 96);
      ctx.fillStyle = '#2b3f46';
      ctx.fillRect(0, 96, W, H - 96);
      ctx.fillStyle = '#3a545d';
      for (let x = 0; x < W; x += 32) for (let y = 96; y < H; y += 24) ctx.fillRect(x, y, 31, 23);
      // the way out: a door on the right with daylight behind it
      ctx.fillStyle = '#d9ecf2';
      ctx.fillRect(268, 40, 40, 64);
      ctx.fillStyle = '#9db8c0';
      ctx.fillRect(266, 38, 44, 3);
      // the flickering ceiling lights, and a red alarm that blinks
      const flick = Math.sin(t * 17) > -0.55 || t < 1 ? 1 : 0.3;
      for (const x of [50, 150, 240]) {
        ctx.fillStyle = `rgba(230,250,255,${0.85 * flick})`;
        ctx.fillRect(x - 14, 6, 28, 4);
        ctx.fillStyle = `rgba(200,240,255,${0.1 * flick})`;
        ctx.beginPath();
        ctx.moveTo(x - 14, 10);
        ctx.lineTo(x + 14, 10);
        ctx.lineTo(x + 40, 110);
        ctx.lineTo(x - 40, 110);
        ctx.closePath();
        ctx.fill();
      }
      if (t > 5 && Math.floor(t * 3) % 2 === 0) {
        ctx.fillStyle = 'rgba(255,40,40,0.1)';
        ctx.fillRect(0, 0, W, H);
      }
      // the stretcher (you wake up beside it), and the heart monitor
      frame(img['fx/stretcher'], 48, 32, Math.floor(t * 2) % 6, 110, 96, 96, 64);
      ctx.fillStyle = '#10181c';
      ctx.fillRect(76, 82, 22, 18);
      ctx.strokeStyle = t < 5.4 ? '#4cff7a' : '#ff4c4c';
      ctx.beginPath();
      for (let i = 0; i < 20; i++) {
        const yy = 91 + (i % 7 === 3 ? -6 : i % 7 === 4 ? 5 : 0) * (t < 5.4 ? 1 : 0.2);
        if (i) ctx.lineTo(77 + i, yy);
        else ctx.moveTo(77, yy);
      }
      ctx.stroke();
      // you, standing up beside the bed and walking to the door
      if (t >= 2.6) {
        const k = Math.max(0, t - 4.2) / 6;
        const x = lerp(104, 296, k);
        drawHero(ctx, img, me, t < 4.2 ? 'down' : 'right', t >= 4.2, t * 0.8, x, 150 - (t < 3.2 ? (3.2 - t) * 6 : 0));
      }
      if (t > 8.8) {
        ctx.fillStyle = `rgba(255,255,255,${Math.min(1, (t - 8.8) / 1.6)})`;
        ctx.fillRect(0, 0, W, H);
      }
      if (t > 10.4) {
        ctx.fillStyle = `rgba(0,0,0,${Math.min(1, (t - 10.4) / 1)})`;
        ctx.fillRect(0, 0, W, H);
      }
    };

    const tick = (now) => {
      if (!start) start = now;
      const t = (now - start) / 1000;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const ox = Math.round((canvas.width - W * scale) / 2);
      const oy = Math.round((canvas.height - H * scale) / 2);
      ctx.setTransform(scale, 0, 0, scale, ox, oy);
      ctx.imageSmoothingEnabled = false;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.clip();
      if (kind === 'concert') concert(t);
      else hospital(t);
      ctx.restore();
      // the caption that belongs to this moment
      let ci = 0;
      for (let i = 0; i < caps.length; i++) if (t >= caps[i][0]) ci = i;
      if (ci !== lastCap) {
        lastCap = ci;
        setCaption(caps[ci][1]);
      }
      if (flashes.length) flashes = [];
      if (t >= total) {
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
      <div className="opening-cap">{caption}</div>
      <button type="button" className="btn ghost small-btn opening-skip" onClick={finish}>Skip ⏭</button>
    </div>
  );
}
