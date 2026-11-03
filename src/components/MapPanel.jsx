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
          <span><i className="lg-arrow" /> You (the arrow points where you face)</span>
          <span><i className="lg-dot" style={{ background: '#2f8cf0' }} /> Other player</span>
          <span><i className="lg-dot" style={{ background: '#f2a33c' }} /> AI rival</span>
          <span><i className="lg-zone" style={{ borderColor: '#e0192b', background: 'rgba(224,25,43,0.25)' }} /> Boss zone (the boss stays inside)</span>
          <span><i className="lg-zone" style={{ borderColor: '#ff7a2e', background: 'rgba(255,122,46,0.25)' }} /> Mini boss zone</span>
          <span><i className="lg-zone" style={{ borderColor: '#8d8d9a', background: 'rgba(141,141,154,0.25)' }} /> Beaten: back in a while</span>
          <span><i style={{ background: '#f4f0e6' }} /> Skeleton</span>
          <span><i style={{ background: '#b45cd8' }} /> Wild monster</span>
          <span><i style={{ background: '#e0384a' }} /> Wave monster</span>
          <span><i style={{ background: 'linear-gradient(135deg, #ff5a1f, #6fc4ff, #9b5cff)', transform: 'rotate(45deg)' }} /> Portal to another realm</span>
        </div>
        <p className="hint">The map shows about 300 tiles around you. Press M or Esc to close.</p>
      </div>
    </div>
  );
}
