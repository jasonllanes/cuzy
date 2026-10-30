import { useEffect, useRef } from 'react';

// The big map (M): the same world as the corner map, enlarged, with the creatures nearby marked.
export default function MapPanel({ game, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    game?.setBigMap(ref.current);
    return () => game?.setBigMap(null);
  }, [game]);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panel map-panel">
        <header className="inv-head">
          <h2>🗺️ Map</h2>
          <button className="btn small-btn" onClick={onClose} aria-label="Close map">✕</button>
        </header>
        <canvas ref={ref} width={300} height={300} className="big-map" />
        <div className="map-legend">
          <span><i style={{ background: '#ff6f91' }} /> You (your face)</span>
          <span><i style={{ background: '#f4f0e6' }} /> Skeleton</span>
          <span><i style={{ background: '#b45cd8' }} /> Wild monster</span>
          <span><i style={{ background: '#e0384a' }} /> Wave monster</span>
          <span><i style={{ background: '#f2a33c' }} /> AI rival (its face)</span>
          <span><i style={{ background: '#5aaee8' }} /> Other player (their face)</span>
        </div>
        <p className="hint">The map shows about 300 tiles around you. Press M or Esc to close.</p>
      </div>
    </div>
  );
}
