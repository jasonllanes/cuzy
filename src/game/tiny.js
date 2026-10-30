// The Tiny RPG character pack (public/assets/tiny, packed by scripts/build-tiny-assets.py): one sheet per character,
// a row per animation of 100x100 frames, and the spell effects the casters throw. The manifest says what is in each row.
import MANIFEST from './tiny-manifest.json';

export const TINY = MANIFEST;
export const TINY_IMAGES = [
  ...Object.keys(MANIFEST.chars).map((k) => `tiny/${k}`),
  ...Object.keys(MANIFEST.fx).map((k) => `tiny/fx_${k}`),
  'tiny/arrow1', 'tiny/arrow2', 'tiny/arrow3',
];
