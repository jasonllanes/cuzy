import { ITEMS } from './items';

export const SLOTS = 9; // the hotbar is the whole bag for now

export const emptyInventory = () => Array(SLOTS).fill(null);

// Restores a saved array, dropping anything unknown (e.g. items removed in an update).
export function sanitize(saved) {
  const inv = emptyInventory();
  if (!Array.isArray(saved)) return inv;
  saved.slice(0, SLOTS).forEach((s, i) => {
    if (s && ITEMS[s.id] && s.qty > 0) inv[i] = { id: s.id, qty: Math.min(s.qty, ITEMS[s.id].stack) };
  });
  return inv;
}

// Fills partial stacks first, then empty slots. Returns how many did not fit.
export function addItem(inv, id, qty = 1) {
  const max = ITEMS[id].stack;
  for (const slot of inv) {
    if (qty > 0 && slot && slot.id === id && slot.qty < max) {
      const add = Math.min(max - slot.qty, qty);
      slot.qty += add;
      qty -= add;
    }
  }
  for (let i = 0; i < inv.length && qty > 0; i++) {
    if (!inv[i]) {
      const add = Math.min(max, qty);
      inv[i] = { id, qty: add };
      qty -= add;
    }
  }
  return qty;
}

export function removeFromSlot(inv, i, qty) {
  const slot = inv[i];
  if (!slot) return;
  slot.qty -= qty;
  if (slot.qty <= 0) inv[i] = null;
}

// Drag a slot onto another: merge same items, otherwise swap.
export function moveSlot(inv, from, to) {
  if (from === to || !inv[from]) return;
  const a = inv[from];
  const b = inv[to];
  if (b && b.id === a.id) {
    const room = ITEMS[a.id].stack - b.qty;
    const moved = Math.min(room, a.qty);
    b.qty += moved;
    removeFromSlot(inv, from, moved);
    return;
  }
  inv[from] = b;
  inv[to] = a;
}
