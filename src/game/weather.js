import { hash2 } from './rng';

// Weather follows the room's clock and the world seed, so everybody in a room sees the same sky.
// Every 3 hours the sky picks a new mood; precipitation eases in over the first part of the block.

export const WEATHER = {
  clear: { name: 'Clear', icon: '☀️', night: '🌙', cloud: 0.3 },
  cloudy: { name: 'Cloudy', icon: '☁️', night: '☁️', cloud: 0.9 },
  rain: { name: 'Rain', icon: '🌧️', night: '🌧️', cloud: 1 },
  storm: { name: 'Thunderstorm', icon: '⛈️', night: '⛈️', cloud: 1 }, // rain with lightning and thunder
  snow: { name: 'Snow', icon: '❄️', night: '❄️', cloud: 0.85 },
};

const BLOCK = 3; // hours

// [kind, share] by kind of world
const ODDS = {
  meadow: [['clear', 0.56], ['cloudy', 0.24], ['rain', 0.1], ['storm', 0.03], ['snow', 0.07]], // (rain and thunder are not the usual sky)
  mild: [['clear', 0.46], ['cloudy', 0.32], ['rain', 0.17], ['storm', 0.05]], // Survival: no snow, and a storm is a rare treat
  wet: [['clear', 0.22], ['cloudy', 0.34], ['rain', 0.36], ['storm', 0.08]], // the swamp
  dry: [['clear', 0.66], ['cloudy', 0.3], ['rain', 0.03], ['storm', 0.01]],
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
  if (climate === 'none') return { kind: 'clear', k: 1, cloud: 0.3, rain: 0, storm: 0, snow: 0, indoors: true };
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
    rain: amount('rain') + amount('storm'), // a thunderstorm is rain too
    storm: amount('storm'),
    snow: amount('snow'),
  };
}
