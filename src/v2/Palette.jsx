import { useEffect, useMemo, useState } from 'react';
import { atlasUrl, loadTheme } from './assets';

const PER_PAGE = 84;

// Every sprite of the pack, theme by theme. Click one to place it, or drag it straight into the world.
export default function Palette({ index, picked, onPick, initial = 'props' }) {
  const [theme, setTheme] = useState(initial);
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  useEffect(() => {
    let dead = false;
    loadTheme(theme).then((t) => {
      if (!dead) {
        setData(t);
        setPage(0);
      }
    });
    return () => {
      dead = true;
    };
  }, [theme]);

  const items = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    const list = q ? data.items.filter((i) => i.name.toLowerCase().includes(q)) : data.items.slice();
    return list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [data, search]);
  const pages = Math.max(1, Math.ceil(items.length / PER_PAGE));
  const shown = items.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  const thumb = (s) => {
    const k = Math.min(4, Math.max(0.25, 52 / Math.max(s.w, s.h)));
    const sc = k >= 1 ? Math.floor(k) : k;
    return (
      <span
        className="v2-thumb"
        style={{ width: s.w * sc, height: s.h * sc, backgroundImage: `url(${atlasUrl(s.theme)})`, backgroundSize: `${data.img.width * sc}px ${data.img.height * sc}px`, backgroundPosition: `-${s.x * sc}px -${s.y * sc}px` }}
      />
    );
  };

  return (
    <section className="v2-pane">
      <select value={theme} onChange={(e) => setTheme(e.target.value)} aria-label="Theme">
        {(index?.themes || []).map((t) => <option key={t.id} value={t.id}>{t.name} ({t.count})</option>)}
      </select>
      <input value={search} placeholder="Search by name…" onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
      <div className="v2-grid">
        {shown.map((s) => (
          <button
            key={s.name}
            type="button"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', JSON.stringify({ theme: s.theme, name: s.name }));
              e.dataTransfer.effectAllowed = 'copy';
              onPick(s);
            }}
            className={`v2-cell ${picked?.name === s.name && picked?.theme === s.theme ? 'on' : ''}`}
            title={`${s.name} (${s.w}×${s.h})`}
            onClick={() => onPick(picked?.name === s.name && picked?.theme === s.theme ? null : s)}
          >
            {data && thumb(s)}
          </button>
        ))}
        {!shown.length && <p className="hint">Nothing matches.</p>}
      </div>
      <div className="v2-row v2-pager">
        <button type="button" className="btn small-btn" disabled={page <= 0} onClick={() => setPage(page - 1)}>‹</button>
        <span>{items.length ? `${page * PER_PAGE + 1}–${Math.min(items.length, (page + 1) * PER_PAGE)} of ${items.length}` : '0'}</span>
        <button type="button" className="btn small-btn" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>›</button>
      </div>
      <p className="hint">Click a sprite and then the map, or drag it onto the map. It stands with its bottom centre where you drop it.</p>
    </section>
  );
}
