import { hash2 } from './rng';

// Weather follows the room's clock and the world seed, so everybody in a room sees the same sky.
// Every 3 hours the sky picks a new mood; precipitation eases in over the first part of the block.

export const WEATHER = {
  clear: { name: 'Clear', icon: '☀️', night: '🌙', cloud: 0.3 },
  cloudy: { name: 'Cloudy', icon: '☁️', night: '☁️', cloud: 0.9 },
  rain: { name: 'Rain', icon: '🌧️', night: '🌧️', cloud: 1 },
  snow: { name: 'Snow', icon: '❄️', night: '❄️', cloud: 0.85 },
};

const BLOCK = 3; // hours

// [kind, share] by kind of world
const ODDS = {
  meadow: [['clear', 0.42], ['cloudy', 0.2], ['rain', 0.24], ['snow', 0.14]],
  mild: [['clear', 0.36], ['cloudy', 0.3], ['rain', 0.34]], // Survival: no snow
  wet: [['clear', 0.15], ['cloudy', 0.3], ['rain', 0.55]], // the swamp
  dry: [['clear', 0.6], ['cloudy', 0.3], ['rain', 0.1]],
  frost: [['snow', 0.8], ['cloudy', 0.2]],
};

const pick = (table, r) => {
  let acc = 0;
  for (const [kind, share] of table) {
    acc += share;
    if (r < acc) return kind;
  }
  return table[0][0];
};

// `climate` is one of the keys of ODDS, or 'none' for indoor maps
export function weatherAt(seed, day, hour, climate = 'meadow') {
  if (climate === 'none') return { kind: 'clear', k: 1, cloud: 0.3, rain: 0, snow: 0, indoors: true };
  const total = (day - 1) * 24 + hour;
  const block = Math.floor(total / BLOCK);
  const frac = (total - block * BLOCK) / BLOCK;
  const table = ODDS[climate] || ODDS.meadow;
  const kind = pick(table, hash2(block, 17, seed));
  const prev = pick(table, hash2(block - 1, 17, seed));
  const k = prev === kind ? 1 : Math.min(1, frac / 0.22); // eases in from the previous mood
  const amount = (want) => (kind === want ? k : 0) + (prev === want && prev !== kind ? 1 - k : 0);
  return {
    kind: k >= 0.5 || prev === kind ? kind : prev,
    k,
    cloud: WEATHER[prev].cloud + (WEATHER[kind].cloud - WEATHER[prev].cloud) * k,
    rain: amount('rain'),
    snow: amount('snow'),
  };
}
