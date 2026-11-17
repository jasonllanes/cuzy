import { useEffect, useMemo, useRef } from 'react';
import { drawHero, heroById, retroId } from '../game/heroes';
import { hash2 } from '../game/rng';

// The Traveling Map cutscene, shown while the team is on the road: they climb aboard (a boat, a helicopter, the RV or a car), the scenery
// rushes by, and the next place comes into view. It is driven by the game's own trip timer (`left` seconds of `dur`), so it ends exactly
// when the next place begins.

const W = 320;
const H = 180;
const lerp = (a, b, k) => a + (b - a) * Math.max(0, Math.min(1, k));
const ease = (k) => 1 - (1 - Math.max(0, Math.min(1, k))) ** 2;

// the colour of the ground in each place, for the view that appears at the end of the trip
const GROUND = {
  ruins: '#4b5a3c', frost: '#d4e4f0', autumn: '#a8692f', dust: '#cdb872', swamp: '#2f4a33', tidal: '#7a5a3a', emerald: '#4aa05a', crystal: '#9a7a5a',
  marsh: '#4a6a3a', lava: '#6a3a30', beach: '#e6cd8c', asphalt: '#4a4d55', mountain: '#6a8a4a', mixed: '#5a8a5a', haunted: '#3a2f4a',
};
const VEHICLES = { boat: '⛵ The team sails', helicopter: '🚁 The team flies', rv: '🚐 The team drives the RV', car: '🚙 The team drives' };

export default function TravelScene({ assets, heroes, vehicle, dest, destName, wave, left, dur }) {
  const canvasRef = useRef(null);
  const timeRef = useRef({ left, dur });
  timeRef.current = { left, dur };
  const crew = useMemo(() => (heroes.length ? heroes : ['retro:1']).slice(0, 8).map((id) => heroById(id) || heroById(retroId(1))), [heroes]);
  const ground = GROUND[dest] || '#4b5a3c';

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = assets.img;
    let raf = 0;
    let scale = 2;
    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      scale = Math.max(1, Math.min(canvas.width / W, canvas.height / H));
    };
    fit();
    window.addEventListener('resize', fit);

    const car = (x, y, k = 1) => {
      // a little pixel car (side view)
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(k, k);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(-22, 0, 44, 3);
      ctx.fillStyle = '#c93a46';
      ctx.fillRect(-22, -12, 44, 10);
      ctx.fillRect(-12, -20, 24, 9);
      ctx.fillStyle = '#9ad8f0';
      ctx.fillRect(-10, -18, 9, 6);
      ctx.fillRect(1, -18, 9, 6);
      ctx.fillStyle = '#1a1a24';
      ctx.fillRect(-17, -4, 8, 7);
      ctx.fillRect(9, -4, 8, 7);
      ctx.fillStyle = '#ffe08a';
      ctx.fillRect(20, -10, 3, 3);
      ctx.restore();
    };

    const tick = (now) => {
      const { left: l, dur: d } = timeRef.current;
      const t = Math.max(0, d - l);
      const BOARD = 1.5;
      const ARRIVE = d - 1.6;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#05060a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, Math.round((canvas.width - W * scale) / 2), Math.round((canvas.height - H * scale) / 2));
      ctx.imageSmoothingEnabled = false;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.clip();
      const sec = now / 1000;
      // how fast the scenery rushes by: still while boarding, flat out on the way, slowing as the place comes into view
      const speed = t < BOARD ? 0 : t < ARRIVE ? 70 : lerp(70, 8, (t - ARRIVE) / (d - ARRIVE));
      const run = t < BOARD ? 0 : (Math.min(t, ARRIVE) - BOARD) * 70 + (t > ARRIVE ? ((t - ARRIVE) * (70 + speed)) / 2 : 0);

      // the sky (night), with a moon
      const sky = ctx.createLinearGradient(0, 0, 0, 100);
      sky.addColorStop(0, '#0e1226');
      sky.addColorStop(1, vehicle === 'boat' ? '#3a4a78' : '#3a3556');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, 110);
      ctx.fillStyle = '#f3efd2';
      ctx.beginPath();
      ctx.arc(256, 30, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(243,239,210,0.18)';
      ctx.beginPath();
      ctx.arc(256, 30, 17, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 30; i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.4 + 0.4 * Math.sin(sec * 2 + i)})`;
        ctx.fillRect(hash2(i, 1, 3) * W, hash2(i, 2, 3) * 70, 1, 1);
      }
      // far hills slide past slowly
      ctx.fillStyle = '#151a30';
      for (let i = 0; i < 6; i++) {
        const hx = ((hash2(i, 5, 3) * 400 - run * 0.15) % 400 + 400) % 400 - 40;
        ctx.beginPath();
        ctx.ellipse(hx, 110, 50 + hash2(i, 6, 3) * 40, 22 + hash2(i, 7, 3) * 16, 0, Math.PI, 0);
        ctx.fill();
      }

      // the ground: water for a boat, fields from above for a helicopter, a road for the RV and the car
      const sea = vehicle === 'boat';
      const air = vehicle === 'helicopter';
      if (sea) {
        ctx.fillStyle = '#1f4f7a';
        ctx.fillRect(0, 110, W, 70);
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        for (let i = 0; i < 40; i++) {
          const wx = ((hash2(i, 1, 9) * 360 - run * (0.6 + (i % 3) * 0.25)) % 360 + 360) % 360 - 20;
          ctx.fillRect(wx, 114 + hash2(i, 2, 9) * 62, 8 + (i % 3) * 4, 1);
        }
      } else if (air) {
        ctx.fillStyle = '#243a2c';
        ctx.fillRect(0, 110, W, 70);
        for (let i = 0; i < 26; i++) {
          const gx = ((hash2(i, 1, 11) * 360 - run * (0.8 + (i % 4) * 0.3)) % 360 + 360) % 360 - 20;
          ctx.fillStyle = i % 3 ? '#2d4a35' : '#1c2e22';
          ctx.fillRect(gx, 114 + hash2(i, 2, 11) * 60, 14 + (i % 4) * 6, 5);
        }
      } else {
        ctx.fillStyle = '#26332a';
        ctx.fillRect(0, 110, W, 70);
        ctx.fillStyle = '#2b2d36';
        ctx.fillRect(0, 128, W, 30);
        ctx.fillStyle = '#e8e0a0';
        for (let i = 0; i < 9; i++) ctx.fillRect(((i * 50 - run) % 450 + 450) % 450 - 30, 142, 26, 2);
        // trees by the road
        for (let i = 0; i < 12; i++) {
          const tx = ((i * 52 - run * 1.1) % 624 + 624) % 624 - 40;
          const ty = i % 2 ? 122 : 170;
          ctx.fillStyle = '#10201a';
          ctx.fillRect(tx - 2, ty - 6, 4, 6);
          ctx.fillStyle = '#1a3a28';
          ctx.fillRect(tx - 8, ty - 22, 16, 18);
          ctx.fillRect(tx - 5, ty - 28, 10, 8);
        }
      }

      // the place we are heading for rises on the right as the trip ends
      if (t > ARRIVE - 0.8) {
        const k = ease((t - (ARRIVE - 0.8)) / (d - ARRIVE + 0.8));
        ctx.fillStyle = ground;
        ctx.fillRect(lerp(W + 20, 190, k), 108, W, 72);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(lerp(W + 20, 190, k), 108, W, 2);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        const bw = Math.max(64, destName.length * 6 + 16);
        ctx.fillRect(lerp(W + 30, 200, k), 78, bw, 14);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 8px sans-serif';
        ctx.fillText(destName, lerp(W + 38, 208, k), 88);
      }

      // the vehicle, and the crew boarding it
      const boarding = t < BOARD;
      const vx = vehicle === 'boat' ? 150 : 170;
      const bob = Math.sin(sec * 3) * (boarding ? 0.4 : 1.2);
      const vy = vehicle === 'helicopter' ? 96 + bob * 2 : vehicle === 'boat' ? 140 + bob : 156 + (vehicle === 'rv' ? 0 : 0) + bob * 0.3;
      // the shelter, left behind
      const bus = img['apoc/bus'];
      const shelterX = 40 - (t < BOARD ? 0 : (t - BOARD) * 90);
      if (bus && shelterX > -90) ctx.drawImage(bus, shelterX - 20, 158 - bus.height, bus.width, bus.height);
      if (vehicle === 'helicopter') {
        const sheet = img['fx/heli'];
        const f = Math.min(21, Math.floor(Math.min(1, t / 1.2) * 22));
        const spin = t > 1.2 ? 22 + (Math.floor(sec * 16) % 4) : f;
        if (sheet) ctx.drawImage(sheet, spin * 152, 0, 152, 144, Math.round(vx - 68), Math.round((boarding ? 130 : vy) - 72), 136, 130);
      } else if (vehicle === 'boat') {
        const sheet = img['critters/boat_right'];
        if (sheet) ctx.drawImage(sheet, (Math.floor(sec * 6) % 8) * 64, 0, 64, 32, Math.round(vx - 48), Math.round(vy - 40), 128, 64);
      } else if (vehicle === 'rv') {
        if (bus) ctx.drawImage(bus, vx - 50, vy - 100 + bob, 100, 100);
      } else car(vx, vy, 1.5);
      // the crew
      crew.forEach((h, i) => {
        const go = 0.1 + i * 0.12;
        const k = (t - go) / 1.1;
        if (k >= 1) return;
        const x = lerp(shelterX + 10 + i * 6, vx - 6, k);
        drawHero(ctx, img, h, 'right', k > 0 && k < 1, sec + i, x, 158 + (i % 2) * 3);
      });
      // the dust or the spray behind it
      if (!boarding && speed > 20 && vehicle !== 'helicopter') {
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = sea ? 'rgba(255,255,255,0.35)' : 'rgba(180,170,150,0.3)';
          const px = vx - 54 - ((sec * 60 + i * 14) % 56);
          ctx.fillRect(px, vy - 2 - (i % 3) * 3, 3 + (i % 3), 2);
        }
      }
      // the fade in and out
      if (t < 0.4) {
        ctx.fillStyle = `rgba(0,0,0,${1 - t / 0.4})`;
        ctx.fillRect(0, 0, W, H);
      }
      if (l < 0.5) {
        ctx.fillStyle = `rgba(0,0,0,${1 - l / 0.5})`;
        ctx.fillRect(0, 0, W, H);
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
  }, [vehicle, dest, destName, crew]);

  return (
    <div className="opening-scene travel-film" role="status">
      <canvas ref={canvasRef} className="opening-canvas" />
      <div className="opening-cap">🧭 Wave {wave} cleared! {VEHICLES[vehicle] || 'The team travels'} to <b>{destName}</b>…</div>
    </div>
  );
}
