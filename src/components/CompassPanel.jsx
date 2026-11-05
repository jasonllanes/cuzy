// The compass, opened with a right-click while it is selected. North is up. Until the chopper has landed the needle only spins;
// then it points to it, with how far it is. (It updates all the time as you move.)
export default function CompassPanel({ compass }) {
  if (!compass?.open) return null;
  const deg = compass.spin ? 0 : (compass.ang * 180) / Math.PI;
  const mark = [['N', 0], ['E', 90], ['S', 180], ['W', 270]];
  return (
    <div className="compass-panel" role="img" aria-label="Compass">
      <div className="compass-dial">
        {Array.from({ length: 24 }, (_, i) => <i key={i} className={`c-tick ${i % 6 === 0 ? 'big' : ''}`} style={{ transform: `rotate(${i * 15}deg)` }} />)}
        {mark.map(([l, a]) => <b key={l} className={`c-mark ${l === 'N' ? 'north' : ''}`} style={{ transform: `rotate(${a}deg) translateY(-62px) rotate(${-a}deg)` }}>{l}</b>)}
        <div className={`c-needle ${compass.spin ? 'spin' : ''}`} style={compass.spin ? undefined : { transform: `rotate(${deg}deg)` }}>
          <span className="c-head" />
          <span className="c-tail" />
        </div>
        <span className="c-pin" />
      </div>
      <small>{compass.spin ? 'The needle spins: the chopper has not landed yet' : `🚁 ${compass.dist} tiles away`}</small>
    </div>
  );
}
