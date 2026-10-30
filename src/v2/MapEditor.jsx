import { useEffect, useRef, useState } from 'react';
import { RETRO_COUNT, drawHero, heroById, retroId } from '../game/heroes';
import { drawSprite, loadSheet, loadTheme, loadedThemes } from './assets';
import { V2_HEROES, drawChar, isV2Hero, v2HeroOf } from './chars';
import { cloneMap } from './custom';
import { Ground } from './ground';
import Palette from './Palette';
import { PACK_SCAN, V2_PLAN } from './plan';
import { CONTAINER, KIND, KIND_COLORS, KIND_NAMES, TILE, footprint, isFlat } from './world';
import './v2.css';

const strip = (props) => JSON.stringify({ v: 2, props }, (k, v) => (k[0] === '_' ? undefined : v));

// The V2 map editor: the map's props can be dragged around, deleted and added (drag them out of the palette), and the ground can
// be painted. It is also the Training Room: walk a hero around to feel the collision of whatever you put down.
export default function MapEditor({ assets, index, map, hero = 'retro:1', onDone, training = false, title = 'Map editor' }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const g = useRef(null);
  if (!g.current) {
    const work = cloneMap(map);
    g.current = {
      map: work, ground: new Ground(work, index), uid: Math.max(0, ...work.props.map((p) => p.uid || 0)) + 1, cam: { x: work.spawn.x - 200, y: work.spawn.y - 140 }, zoom: 2,
      keys: new Set(), mouse: { x: 0, y: 0, wx: 0, wy: 0, in: false }, placing: null, selected: null, hover: null, drag: null, painting: false, undo: [], t: 0,
      show: { solids: false, grid: false, snap: true, night: false }, tool: 'select', brush: { kind: KIND.plaza, size: 1 }, walk: { on: false, x: work.spawn.x, y: work.spawn.y, dir: 'down', moving: false }, hero, sheets: {},
    };
  }
  const G = g.current;
  const [tab, setTab] = useState('palette');
  const [placing, setPlacing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [tool, setTool] = useState('select');
  const [brush, setBrush] = useState(G.brush);
  const [show, setShow] = useState(G.show);
  const [walk, setWalk] = useState(false);
  const [heroId, setHeroId] = useState(hero);
  const [count, setCount] = useState(G.map.props.length);
  const [info, setInfo] = useState('');
  const [importText, setImportText] = useState('');
  const [dirty, setDirty] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      for (const [id, a] of Object.entries(index.anim)) G.sheets[id] = { img: await loadSheet(a.file), info: a };
      setReady(true);
    })();
  }, [G, index]);
  useEffect(() => {
    G.placing = placing;
  }, [placing, G]);
  useEffect(() => {
    G.show = show;
  }, [show, G]);
  useEffect(() => {
    G.tool = tool;
    G.brush = brush;
  }, [tool, brush, G]);
  useEffect(() => {
    G.hero = heroId;
    const h = v2HeroOf(heroId);
    if (h && !G.sheets[heroId]) loadSheet(h.file).then((img) => (G.sheets[heroId] = { img }));
  }, [heroId, G]);
  useEffect(() => {
    G.walk.on = walk;
    if (walk) {
      G.walk.x = Math.round(G.cam.x + (canvasRef.current?.width || 600) / G.zoom / 2);
      G.walk.y = Math.round(G.cam.y + (canvasRef.current?.height || 400) / G.zoom / 2);
    }
  }, [walk, G]);

  // ---------- editing ----------
  const snapshot = (withGround = false) => {
    G.undo.push({ props: JSON.stringify(G.map.props, (k, v) => (k[0] === '_' ? undefined : v)), ground: withGround ? new Uint8Array(G.map.ground) : null });
    if (G.undo.length > 40) G.undo.shift();
    setCanUndo(true);
  };
  const changed = () => {
    setCount(G.map.props.length);
    setDirty(true);
  };
  const undo = () => {
    const s = G.undo.pop();
    if (!s) return;
    G.map.props = JSON.parse(s.props);
    if (s.ground) {
      G.map.ground.set(s.ground);
      G.ground.reset();
    }
    G.selected = null;
    setSelected(null);
    setCanUndo(G.undo.length > 0);
    changed();
  };
  const spriteOf = (p) => (p._s ||= loadedThemes.get(p.theme)?.byName.get(p.name));
  const sizeOf = (p) => (p.anim ? { w: G.sheets[p.anim]?.info.fw || 16, h: G.sheets[p.anim]?.info.fh || 16 } : spriteOf(p));
  const rectOf = (p) => {
    if (p._r === undefined) p._r = p.anim ? null : footprint(p, spriteOf(p));
    return p._r;
  };
  const propAt = (wx, wy) => {
    let best = null;
    for (const p of G.map.props) {
      const s = sizeOf(p);
      if (!s) continue;
      if (wx >= p.x - s.w / 2 && wx <= p.x + s.w / 2 && wy >= p.y - s.h && wy <= p.y && (!best || p.y >= best.y)) {
        if (!p.anim) {
          const th = loadedThemes.get(p.theme);
          const c = (propAt.px ||= document.createElement('canvas'));
          c.width = c.height = 1;
          const cx = c.getContext('2d', { willReadFrequently: true });
          cx.clearRect(0, 0, 1, 1);
          cx.drawImage(th.img, s.x + Math.floor(wx - (p.x - s.w / 2)), s.y + Math.floor(wy - (p.y - s.h)), 1, 1, 0, 0, 1, 1);
          if (cx.getImageData(0, 0, 1, 1).data[3] < 20) continue;
        }
        best = p;
      }
    }
    return best;
  };
  const snapPt = (x, y) => {
    const step = G.show.snap ? 8 : 1;
    return { x: Math.round(x / step) * step, y: Math.round(y / step) * step };
  };
  const placeAt = (s, wx, wy) => {
    snapshot();
    const { x, y } = snapPt(wx, wy);
    const p = { uid: G.uid++, theme: s.theme, name: s.name, x, y };
    G.map.props.push(p);
    G.selected = p.uid;
    setSelected({ ...p });
    changed();
  };
  const remove = (uid) => {
    snapshot();
    G.map.props = G.map.props.filter((p) => p.uid !== uid);
    if (G.selected === uid) {
      G.selected = null;
      setSelected(null);
    }
    changed();
  };
  const paintAt = (wx, wy) => {
    const tx = Math.floor(wx / TILE);
    const ty = Math.floor(wy / TILE);
    const r = G.brush.size - 1;
    for (let dy = -Math.floor(r / 2); dy <= Math.ceil(r / 2); dy++) for (let dx = -Math.floor(r / 2); dx <= Math.ceil(r / 2); dx++) G.ground.set(tx + dx, ty + dy, G.brush.kind);
  };

  // ---------- the loop ----------
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let raf = 0;
    let last = performance.now();
    const resize = () => {
      const r = wrapRef.current.getBoundingClientRect();
      canvas.width = Math.max(100, Math.floor(r.width));
      canvas.height = Math.max(100, Math.floor(r.height));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrapRef.current);
    const m = G.map;
    const blocked = (x, y) => {
      if (x < 8 || y < 14 || x > m.cols * TILE - 8 || y > m.rows * TILE - 2) return true;
      if (G.ground.kind(Math.floor(x / TILE), Math.floor(y / TILE)) === KIND.water) return true;
      const bx = x - 4;
      const by = y - 3;
      for (const p of G.map.props) {
        const r = rectOf(p);
        if (r && bx < r.x + r.w && bx + 8 > r.x && by < r.y + r.h && by + 4 > r.y) return true;
      }
      return false;
    };
    const update = (dt) => {
      G.t += dt;
      const k = G.keys;
      let vx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
      let vy = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
      const vw = canvas.width / G.zoom;
      const vh = canvas.height / G.zoom;
      if (G.walk.on) {
        const w = G.walk;
        w.moving = !!(vx || vy);
        if (w.moving) {
          const len = Math.hypot(vx, vy);
          vx /= len;
          vy /= len;
          const sp = (k.has('ShiftLeft') || k.has('ShiftRight') ? 110 : 62) * dt;
          if (!blocked(w.x + vx * sp, w.y)) w.x += vx * sp;
          if (!blocked(w.x, w.y + vy * sp)) w.y += vy * sp;
          w.dir = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'right' : 'left') : vy > 0 ? 'down' : 'up';
        }
        const tx = Math.min(Math.max(w.x - vw / 2, 0), Math.max(0, m.cols * TILE - vw));
        const ty = Math.min(Math.max(w.y - 16 - vh / 2, 0), Math.max(0, m.rows * TILE - vh));
        G.cam.x += (tx - G.cam.x) * Math.min(1, dt * 8);
        G.cam.y += (ty - G.cam.y) * Math.min(1, dt * 8);
      } else if (vx || vy) {
        const sp = (k.has('ShiftLeft') || k.has('ShiftRight') ? 520 : 260) * dt / G.zoom * 2;
        G.cam.x = Math.min(Math.max(G.cam.x + vx * sp, -40), m.cols * TILE - vw + 40);
        G.cam.y = Math.min(Math.max(G.cam.y + vy * sp, -40), m.rows * TILE - vh + 40);
      }
      G.mouse.wx = G.cam.x + G.mouse.x / G.zoom;
      G.mouse.wy = G.cam.y + G.mouse.y / G.zoom;
      G.hover = G.mouse.in && !G.placing && G.tool === 'select' && !G.drag ? propAt(G.mouse.wx, G.mouse.wy) : null;
    };
    const drawProp = (p, glow = false) => {
      if (p.anim === 'streetlamp' && !glow) {
        const s = loadedThemes.get('props')?.byName.get('Street_Lamp_1');
        if (s) drawSprite(ctx, s, Math.round(p.x - s.w / 2), Math.round(p.y - s.h));
        return;
      }
      if (p.anim) {
        const a = G.sheets[p.anim];
        if (!a) return;
        const f = p.anim === 'campfire' ? Math.floor(G.t * 8) : Math.floor(G.t * 3);
        ctx.drawImage(a.img, (f % a.info.frames) * a.info.fw, 0, a.info.fw, a.info.fh, p.anim === 'streetlamp' ? Math.round(p.x - 32) : Math.round(p.x - a.info.fw / 2), p.anim === 'streetlamp' ? Math.round(p.y - 79) : Math.round(p.y - a.info.fh), a.info.fw, a.info.fh);
        return;
      }
      const s = spriteOf(p);
      if (s) drawSprite(ctx, s, Math.round(p.x - s.w / 2), Math.round(p.y - s.h));
    };
    const mark = (p, color) => {
      const s = sizeOf(p);
      if (!s) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2 / G.zoom;
      ctx.strokeRect(Math.round(p.x - s.w / 2) - 0.5, Math.round(p.y - s.h) - 0.5, s.w + 1, s.h + 1);
    };
    const draw = () => {
      const zoom = G.zoom;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#1f2a22';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      const camX = Math.round(G.cam.x * zoom) / zoom;
      const camY = Math.round(G.cam.y * zoom) / zoom;
      ctx.setTransform(zoom, 0, 0, zoom, -camX * zoom, -camY * zoom);
      const vw = canvas.width / zoom;
      const vh = canvas.height / zoom;
      G.ground.draw(ctx, camX, camY, vw, vh);
      const vis = [];
      for (const p of G.map.props) {
        const s = sizeOf(p);
        if (s && p.x + s.w / 2 > camX - 8 && p.x - s.w / 2 < camX + vw + 8 && p.y > camY - 8 && p.y - s.h < camY + vh + 8) vis.push(p);
      }
      const items = [];
      for (const p of vis) {
        const s = p.anim ? null : spriteOf(p);
        if (s && isFlat(p.name, s.w, s.h)) drawProp(p);
        else items.push({ y: p.y, p });
      }
      if (G.walk.on) items.push({ y: G.walk.y, hero: true });
      items.sort((a, b) => a.y - b.y);
      for (const it of items) {
        if (it.hero) {
          const w = G.walk;
          ctx.fillStyle = 'rgba(30,30,20,0.28)';
          ctx.beginPath();
          ctx.ellipse(Math.round(w.x), Math.round(w.y), 6, 2.4, 0, 0, Math.PI * 2);
          ctx.fill();
          const sheet = isV2Hero(G.hero) ? G.sheets[G.hero] : null;
          if (sheet) drawChar(ctx, sheet.img, w.dir, w.moving, G.t, w.x, w.y);
          else if (!isV2Hero(G.hero)) drawHero(ctx, assets.img, heroById(G.hero), w.dir, w.moving, G.t, w.x, w.y);
        } else drawProp(it.p);
      }
      if (G.show.night) {
        ctx.fillStyle = 'rgba(8,16,48,0.5)';
        ctx.fillRect(camX, camY, vw, vh);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.55;
        for (const p of vis) if (p.anim) drawProp(p, true);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
      if (G.show.grid) {
        ctx.strokeStyle = 'rgba(255,255,255,0.16)';
        ctx.lineWidth = 1 / zoom;
        ctx.beginPath();
        for (let x = Math.floor(camX / TILE) * TILE; x < camX + vw; x += TILE) (ctx.moveTo(x, camY), ctx.lineTo(x, camY + vh));
        for (let y = Math.floor(camY / TILE) * TILE; y < camY + vh; y += TILE) (ctx.moveTo(camX, y), ctx.lineTo(camX + vw, y));
        ctx.stroke();
      }
      if (G.show.solids) {
        ctx.fillStyle = 'rgba(255,60,60,0.35)';
        ctx.strokeStyle = 'rgba(255,60,60,0.9)';
        ctx.lineWidth = 1 / zoom;
        for (const p of vis) {
          const r = rectOf(p);
          if (r) (ctx.fillRect(r.x, r.y, r.w, r.h), ctx.strokeRect(r.x, r.y, r.w, r.h));
        }
        if (G.walk.on) {
          ctx.fillStyle = 'rgba(60,160,255,0.45)';
          ctx.fillRect(G.walk.x - 4, G.walk.y - 3, 8, 4);
        }
      }
      if (G.hover) mark(G.hover, 'rgba(255,255,255,0.9)');
      const sp = G.selected && G.map.props.find((q) => q.uid === G.selected);
      if (sp) mark(sp, '#ffd24a');
      if (G.placing && G.mouse.in) {
        const s = G.placing;
        const { x, y } = snapPt(G.mouse.wx, G.mouse.wy);
        ctx.globalAlpha = 0.7;
        drawSprite(ctx, s, Math.round(x - s.w / 2), Math.round(y - s.h));
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#7fe0a0';
        ctx.lineWidth = 1 / zoom;
        ctx.strokeRect(Math.round(x - s.w / 2) - 0.5, Math.round(y - s.h) - 0.5, s.w + 1, s.h + 1);
      }
      if (G.tool === 'paint' && G.mouse.in) {
        const tx = Math.floor(G.mouse.wx / TILE);
        const ty = Math.floor(G.mouse.wy / TILE);
        const r = G.brush.size;
        ctx.strokeStyle = '#fff';
        ctx.fillStyle = `${KIND_COLORS[G.brush.kind]}88`;
        ctx.lineWidth = 1 / zoom;
        const o = Math.floor((r - 1) / 2);
        ctx.fillRect((tx - o) * TILE, (ty - o) * TILE, r * TILE, r * TILE);
        ctx.strokeRect((tx - o) * TILE, (ty - o) * TILE, r * TILE, r * TILE);
      }
    };
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      update(dt);
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- keys ----------
  useEffect(() => {
    const typing = (e) => ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
    const down = (e) => {
      if (typing(e)) return;
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
        e.preventDefault();
        undo();
      } else if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(e.code)) {
        G.keys.add(e.code);
        e.preventDefault();
      } else if (e.code === 'Escape') {
        if (G.placing) setPlacing(null);
        else if (G.selected) {
          G.selected = null;
          setSelected(null);
        } else onDone(null);
      } else if ((e.code === 'Delete' || e.code === 'Backspace') && G.selected) remove(G.selected);
      else if (e.code === 'KeyC') setShow((s) => ({ ...s, solids: !s.solids }));
      else if (e.code === 'KeyG') setShow((s) => ({ ...s, grid: !s.grid }));
      else if (e.code === 'KeyB') setTool((t) => (t === 'paint' ? 'select' : 'paint'));
      else if (e.code === 'Equal' || e.code === 'NumpadAdd') G.zoom = Math.min(6, G.zoom + 1);
      else if (e.code === 'Minus' || e.code === 'NumpadSubtract') G.zoom = Math.max(1, G.zoom - 1);
    };
    const up = (e) => G.keys.delete(e.code);
    const blur = () => G.keys.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- the mouse ----------
  const pointer = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    G.mouse.x = e.clientX - r.left;
    G.mouse.y = e.clientY - r.top;
    G.mouse.in = true;
    G.mouse.wx = G.cam.x + G.mouse.x / G.zoom;
    G.mouse.wy = G.cam.y + G.mouse.y / G.zoom;
  };
  const onDown = (e) => {
    pointer(e);
    canvasRef.current.setPointerCapture?.(e.pointerId);
    if (e.button === 2) {
      if (G.placing) return setPlacing(null);
      const p = propAt(G.mouse.wx, G.mouse.wy);
      if (p) remove(p.uid);
      return undefined;
    }
    if (G.tool === 'paint') {
      snapshot(true);
      G.painting = true;
      paintAt(G.mouse.wx, G.mouse.wy);
      return undefined;
    }
    if (G.placing) {
      placeAt(G.placing, G.mouse.wx, G.mouse.wy);
      if (!e.shiftKey) setPlacing(null);
      return undefined;
    }
    const p = propAt(G.mouse.wx, G.mouse.wy);
    G.selected = p ? p.uid : null;
    setSelected(p ? { ...p } : null);
    if (p) G.drag = { uid: p.uid, dx: p.x - G.mouse.wx, dy: p.y - G.mouse.wy, moved: false, snap: JSON.stringify(G.map.props, (k, v) => (k[0] === '_' ? undefined : v)) };
    return undefined;
  };
  const onMove = (e) => {
    pointer(e);
    if (G.painting) paintAt(G.mouse.wx, G.mouse.wy);
    if (G.drag) {
      const p = G.map.props.find((q) => q.uid === G.drag.uid);
      if (!p) return;
      const { x, y } = snapPt(G.mouse.wx + G.drag.dx, G.mouse.wy + G.drag.dy);
      if (x !== p.x || y !== p.y) {
        if (!G.drag.moved) {
          // the undo step is the map as it was when the drag began
          G.drag.moved = true;
          G.undo.push({ props: G.drag.snap, ground: null });
          setCanUndo(true);
        }
        p.x = x;
        p.y = y;
        delete p._r;
        setSelected({ ...p });
        setDirty(true);
      }
    }
  };
  const onUp = () => {
    G.painting = false;
    if (G.drag?.moved) changed();
    G.drag = null;
  };
  const onDrop = (e) => {
    e.preventDefault();
    try {
      const d = JSON.parse(e.dataTransfer.getData('text/plain'));
      const s = loadedThemes.get(d.theme)?.byName.get(d.name);
      pointer(e);
      if (s) placeAt(s, G.mouse.wx, G.mouse.wy);
      setPlacing(null);
    } catch {
      /* not one of ours */
    }
  };

  const sel = selected && G.map.props.find((p) => p.uid === selected.uid);
  const selSprite = sel && !sel.anim ? spriteOf(sel) : null;
  const toggle = (key) => setShow((s) => ({ ...s, [key]: !s[key] }));
  const done = (save) => onDone(save ? { props: G.map.props, ground: G.map.ground } : null);
  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(strip(G.map.props));
      setInfo('Copied the props as JSON.');
    } catch {
      setInfo('Could not copy (the browser blocked the clipboard).');
    }
  };
  const importJson = async () => {
    try {
      const data = JSON.parse(importText);
      if (!Array.isArray(data.props)) throw new Error('no props list');
      await Promise.all([...new Set(data.props.map((p) => p.theme).filter((t) => t !== 'anim'))].map(loadTheme));
      snapshot();
      G.map.props = data.props.map((p, i) => ({ ...p, uid: i + 1 }));
      G.uid = G.map.props.length + 1;
      setImportText('');
      changed();
      setInfo(`Loaded ${G.map.props.length} props.`);
    } catch (err) {
      setInfo(`That did not work: ${err.message}`);
    }
  };
  const clearAll = () => {
    snapshot();
    G.map.props = [];
    changed();
  };

  return (
    <div className="v2-room">
      <div className="v2-stage" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          onPointerMove={onMove}
          onPointerDown={onDown}
          onPointerUp={onUp}
          onPointerLeave={() => (G.mouse.in = false)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          onContextMenu={(e) => e.preventDefault()}
          onWheel={(e) => (G.zoom = Math.min(6, Math.max(1, G.zoom + (e.deltaY < 0 ? 1 : -1))))}
        />
        <div className="v2-hud">
          {training ? (
            <button type="button" className="btn small-btn" onClick={() => done(false)}>← Menu <kbd>Esc</kbd></button>
          ) : (
            <>
              <button type="button" className="btn go small-btn" onClick={() => done(true)}>✔ Save and close</button>
              <button type="button" className="btn small-btn" onClick={() => done(false)}>✕ Discard <kbd>Esc</kbd></button>
            </>
          )}
          <button type="button" className="btn small-btn" disabled={!canUndo} onClick={undo}>↶ Undo <kbd>Ctrl Z</kbd></button>
          <span>{title}: {G.map.name}</span>
          <span>{count} props{dirty ? ' · unsaved' : ''}</span>
        </div>
        <div className="v2-hint">{walk ? 'WASD walk · Shift run' : 'WASD / arrows move the view'} · drag props to move them · right-click removes · B paint ground · C collision · G grid · +/− zoom</div>
        {placing && <div className="v2-placing">Placing <b>{placing.name}</b> ({placing.w}×{placing.h}) · click to put it down (Shift keeps going) · right-click or Esc cancels</div>}
        {info && <div className="v2-info" onAnimationEnd={() => setInfo('')}>{info}</div>}
        {!ready && <div className="v2-loading">Loading…</div>}
      </div>

      <aside className="v2-side">
        <div className="v2-tabs" role="tablist">
          {[['palette', '🧱 Palette'], ['tools', '🛠 Tools'], ...(training ? [['plan', '🗺 V2 plan']] : [])].map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={`shop-tab ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        {tab === 'palette' && <Palette index={index} picked={placing} onPick={(s) => { setPlacing(s); if (s) setTool('select'); }} />}

        {tab === 'tools' && (
          <section className="v2-pane">
            <h3>Tool</h3>
            <div className="v2-chips">
              <button type="button" className={`btn small-btn ${tool === 'select' ? 'go' : ''}`} onClick={() => setTool('select')}>☝ Move and select</button>
              <button type="button" className={`btn small-btn ${tool === 'paint' ? 'go' : ''}`} onClick={() => { setTool('paint'); setPlacing(null); }}>🖌 Paint ground <kbd>B</kbd></button>
            </div>
            {tool === 'paint' && (
              <div className="v2-brush">
                <div className="v2-chips">
                  {KIND_NAMES.map((n, k) => (
                    <button key={n} type="button" className={`v2-kind ${brush.kind === k ? 'on' : ''}`} style={{ '--c': KIND_COLORS[k] }} onClick={() => setBrush({ ...brush, kind: k })}>{n}</button>
                  ))}
                </div>
                <label className="v2-row">Brush {brush.size}×{brush.size}<input type="range" min="1" max="5" value={brush.size} onChange={(e) => setBrush({ ...brush, size: Number(e.target.value) })} /></label>
              </div>
            )}
            <h3>Selected</h3>
            {sel ? (
              <div className="v2-sel">
                <b>{sel.name.replace(/^24_Additional_Houses_/, '').replace(/_16x16$/, '')}</b>
                <small>{sel.theme}{selSprite ? ` · ${selSprite.w}×${selSprite.h}` : ''} · tile {Math.floor(sel.x / TILE)}, {Math.floor(sel.y / TILE)}</small>
                {selSprite && !isFlat(sel.name, selSprite.w, selSprite.h) && (
                  <label className="check-row"><input type="checkbox" checked={sel.solid !== false} onChange={(e) => { sel.solid = e.target.checked; delete sel._r; setSelected({ ...sel }); setDirty(true); }} /> Blocks the way</label>
                )}
                {CONTAINER.test(sel.name) && <small>📦 The hero can open this for loot.</small>}
                <div className="v2-row">
                  {selSprite && <button type="button" className="btn small-btn" onClick={() => { setPlacing(selSprite); setTab('palette'); }}>Place another</button>}
                  <button type="button" className="btn small-btn" onClick={() => remove(sel.uid)}>Remove <kbd>Del</kbd></button>
                </div>
              </div>
            ) : <p className="hint">Click something on the map, then drag it, or press Delete.</p>}
            <h3>Show</h3>
            <label className="check-row"><input type="checkbox" checked={show.solids} onChange={() => toggle('solids')} /> Collision boxes <kbd>C</kbd></label>
            <label className="check-row"><input type="checkbox" checked={show.grid} onChange={() => toggle('grid')} /> 16 px grid <kbd>G</kbd></label>
            <label className="check-row"><input type="checkbox" checked={show.night} onChange={() => toggle('night')} /> Night (the lamps glow)</label>
            <label className="check-row"><input type="checkbox" checked={show.snap} onChange={() => toggle('snap')} /> Snap to 8 px</label>
            <h3>Walk test</h3>
            <label className="check-row"><input type="checkbox" checked={walk} onChange={(e) => setWalk(e.target.checked)} /> Walk around with a hero</label>
            {walk && (
              <select value={heroId} onChange={(e) => setHeroId(e.target.value)} aria-label="Hero">
                <optgroup label="V2 characters">
                  {V2_HEROES.map((h) => <option key={h.id} value={h.id}>{h.label}</option>)}
                </optgroup>
                <optgroup label="V1 heroes">
                  {Array.from({ length: RETRO_COUNT }, (_, i) => <option key={i} value={retroId(i + 1)}>{heroById(retroId(i + 1)).label}</option>)}
                </optgroup>
              </select>
            )}
            <h3>The map</h3>
            <div className="v2-chips">
              <button type="button" className="btn small-btn" onClick={clearAll}>Remove every prop</button>
              <button type="button" className="btn small-btn" onClick={copyJson}>Copy props as JSON</button>
            </div>
            <textarea rows={3} value={importText} placeholder="Paste copied props here, then press Load" onChange={(e) => setImportText(e.target.value)} />
            <button type="button" className="btn small-btn" disabled={!importText.trim()} onClick={importJson}>Load pasted props</button>
            {!training && <p className="hint">Press “Save and close” to keep your changes. They are kept for this map on this device.</p>}
          </section>
        )}

        {tab === 'plan' && (
          <section className="v2-pane v2-plan">
            <h3>{PACK_SCAN.name}</h3>
            <p>{PACK_SCAN.sizes}</p>
            <ul>{PACK_SCAN.parts.map(([a, b]) => <li key={a}><b>{a}</b> {b}</li>)}</ul>
            <p><b>License:</b> {PACK_SCAN.license}</p>
            <h4>What it does not have</h4>
            <ul>{PACK_SCAN.gaps.map((x) => <li key={x}>{x}</li>)}</ul>
            <h3>{V2_PLAN.title}</h3>
            <p>{V2_PLAN.pitch}</p>
            <p>{V2_PLAN.rules}</p>
            <h4>V1 to V2</h4>
            <table><tbody>{V2_PLAN.mapping.map(([a, b]) => <tr key={a}><th>{a}</th><td>{b}</td></tr>)}</tbody></table>
            <h4>Themes in the pack</h4>
            <table><tbody>{(index?.themes || []).map((t) => <tr key={t.id}><th>{t.name}</th><td>{t.count} sprites</td></tr>)}</tbody></table>
            <p className="hint">{index?.credit}</p>
          </section>
        )}
      </aside>
    </div>
  );
}
