// Screen transitions from pixelfx (https://github.com/patch-gg/pixelfx, MIT): a pixel-art cover wipes over the screen, the change happens
// underneath while it is covered (onCover), and it uncovers again (onDone). If no screen is there to play it, the change just happens.

export const FAST = ['slash-wipe', 'glitch-wipe', 'blinds', 'diamond-wipe']; // (about 2 seconds: for moving between menus and rooms)
export const START = ['iris', 'star-iris', 'pixel-dissolve', 'shatter-wipe']; // (the start of a game)
export const LEAVE = ['crt-off', 'burn-away']; // (back to the menu)
export const pick = (list) => list[Math.floor(Math.random() * list.length)];

import { sfx } from './sfx';

// what each transition sounds like when it starts (a sweep, a crackle...) and when it has covered the screen (the thump)
const START_SOUND = { 'slash-wipe': 'swing', 'glitch-wipe': 'glitch', blinds: 'dash', 'diamond-wipe': 'whoosh', iris: 'whoosh', 'star-iris': 'sparkle', 'pixel-dissolve': 'glitch', 'shatter-wipe': 'shatter', 'crt-off': 'crtoff', 'burn-away': 'burn' };
const COVER_SOUND = { 'slash-wipe': 'hit', 'glitch-wipe': 'impact', 'crt-off': 'thud', 'burn-away': 'impact', 'shatter-wipe': 'impact' };
export const transitionSound = (name, phase) => sfx.play(phase === 'start' ? START_SOUND[name] || 'whoosh' : phase === 'cover' ? COVER_SOUND[name] || 'impact' : 'pickup', phase === 'done' ? 0.5 : 1);

let hosts = 0;
export const registerHost = (on) => {
  hosts += on ? 1 : -1;
};

/** Play a transition by name ('iris', 'slash-wipe'...). opts: { onCover, onDone, color } */
export function playTransition(name, opts = {}) {
  if (typeof window === 'undefined' || hosts <= 0) {
    opts.onCover?.();
    opts.onDone?.();
    return;
  }
  window.dispatchEvent(new CustomEvent('cuzy-transition', { detail: { name, ...opts } }));
}
