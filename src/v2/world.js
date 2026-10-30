// Shared bits of the V2 world: the tile size, the ground kinds, and what a prop blocks.

export const TILE = 16;

export const KIND = { grass: 0, road: 1, walk: 2, sand: 3, water: 4, dirt: 5, plaza: 6 };
export const KIND_NAMES = ['Grass', 'Road', 'Pavement', 'Sand', 'Water', 'Dirt', 'Plaza'];
export const KIND_COLORS = ['#4a9757', '#555153', '#9a9ca8', '#e6cf96', '#2d78a8', '#c78c59', '#b8b0a4'];

// things that lie on the ground: drawn under everybody, never in the way
const FLAT = /(Road|Crosswalk|Manhole|Rug|Puddle|Arrow|Marking|Stripe|Zebra|Carpet|Shadow|Sidewalk|Tile|Pattern|Towel|Ditch|Props_Grass|Props_Dirt)/i;
export const isFlat = (name, w, h) => (FLAT.test(name) && h <= 64) || (h <= 16 && w >= 16 && !/(Bench|Pole|Sign|Cone|Lamp|Fence)/i.test(name));

// the part of a sprite that blocks you: a strip along its foot (trees only block with their trunk)
export function footprint(p, s) {
  if (!s || p.solid === false || isFlat(p.name, s.w, s.h)) return null;
  let bw = Math.max(4, s.w - 4);
  let bh = Math.min(Math.max(6, Math.round(s.h * 0.25)), 28);
  if (/(Tree|Bush|Hedge)/i.test(p.name)) {
    bw = Math.min(10, s.w);
    bh = 8;
  } else if (s.h >= 128) bh = 26;
  return { x: p.x - bw / 2, y: p.y - bh, w: bw, h: bh };
}

// props the hero can open with Space for loot
export const CONTAINER = /(Dumpster|Trash_Can|Trashbin|Crate|Barrel|ATM|Vending|Mailbox|Chest|Coffin|Locker|Suitcase|Wooden_Box|Cardboard)/i;
