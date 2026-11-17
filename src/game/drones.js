// The drone art (Modern Exteriors animated sheets, cleaned: only the picture frames, without the take off / loop / land label bars).
// Each strip is one row of frames: take off first, a short loop while it flies, and landing at the end.
// k: how big it is drawn; take / loop / land: the frame ranges.
export const DRONES = {
  drone1: { n: 24, w: 16, h: 18, k: 1.8, take: [0, 10], loop: [11, 13], land: [14, 23] },
  drone2: { n: 40, w: 16, h: 19, k: 1.8, take: [0, 19], loop: [20, 22], land: [23, 39] },
  drone3: { n: 40, w: 32, h: 21, k: 1.0, take: [0, 19], loop: [20, 22], land: [23, 39] },
  drone4: { n: 42, w: 48, h: 18, k: 0.75, take: [0, 19], loop: [20, 22], land: [23, 41] },
  helix: { n: 40, w: 16, h: 12, k: 2.4, take: [0, 19], loop: [20, 22], land: [23, 39] },
};
export const SCOUT_SKINS = ['drone1', 'drone2', 'drone3', 'drone4']; // (a scout drone is one of the four, picked when it is called)
export const AIR_PHASE = 0.9; // seconds it takes to take off, and to land

// which frame of a drone to show: `t` seconds since it was called, `left` seconds until it is gone
export function droneFrame(d, t, left) {
  const span = (r) => r[1] - r[0] + 1;
  if (t < AIR_PHASE) return d.take[0] + Math.min(span(d.take) - 1, Math.floor((t / AIR_PHASE) * span(d.take)));
  if (left < AIR_PHASE) return d.land[0] + Math.min(span(d.land) - 1, Math.floor((1 - left / AIR_PHASE) * span(d.land)));
  return d.loop[0] + (Math.floor(t * 14) % span(d.loop));
}
