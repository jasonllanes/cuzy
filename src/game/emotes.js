// Emotes: press Tab, pick one, and a bubble with it floats over your head for a few seconds (everyone in the room sees it, with a pixelfx effect).
// fx: the pixelfx effect that goes off at the head, k: how big
export const EMOTES = [
  { e: '😀', name: 'Hello', fx: 'pickups/collect-burst', k: 0.5 },
  { e: '😂', name: 'Haha', fx: 'holy/feather-burst', k: 0.4 },
  { e: '😭', name: 'Sob', fx: 'water/rain-splash', k: 0.5 },
  { e: '😡', name: 'Angry', fx: 'status/rage', k: 0.5 },
  { e: '😱', name: 'Shock', fx: 'impacts/crit-hit', k: 0.45 },
  { e: '👍', name: 'Nice', fx: 'pickups/power-star', k: 0.4 },
  { e: '❤️', name: 'Love', fx: 'pickups/heart-pickup', k: 0.9 },
  { e: '🤔', name: 'Hmm', fx: 'status/confused', k: 0.5 },
  { e: '🎉', name: 'Party', fx: 'holy/sunburst', k: 0.5 },
  { e: '💀', name: 'Dead', fx: 'shadow/soul-drain', k: 0.5 },
  { e: '🔥', name: 'Hot', fx: 'status/burning', k: 0.5 },
  { e: '💤', name: 'Sleepy', fx: 'status/sleep', k: 0.5 },
];
export const EMOTE_TIME = 3.2;
