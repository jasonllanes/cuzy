import { useEffect, useState } from 'react';
import { music } from '../game/music';
import { loadIndex } from './assets';
import { buildMap } from './custom';
import MapEditor from './MapEditor';
import './v2.css';

// The V2 Training Room (#/training-v2): the map editor on a fresh Downtown, with the pack's scan and the V2 plan in a tab.
// Nothing done here is kept; it is the place to try sprites, collision and scale.
export default function TrainingV2({ assets, onExit }) {
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    music.play('city');
    (async () => {
      try {
        const index = await loadIndex();
        const map = await buildMap('downtown', '', false);
        setState({ index, map });
      } catch (err) {
        setError(err.message);
      }
    })();
  }, []);
  if (error) return <div className="splash">Could not load the V2 art: {error}. Run python scripts/build-v2-assets.py</div>;
  if (!state) return <div className="splash"><span className="splash-dot" /> Opening the V2 pack…</div>;
  return <MapEditor assets={assets} index={state.index} map={state.map} hero="retro:1" training title="Training room" onDone={onExit} />;
}
