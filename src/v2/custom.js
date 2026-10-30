import { applyCustom, generateMap, groundToString, loadMapThemes } from './maps';

// Edits the player makes to a map are kept per map (and per "new layout" roll) on this device.

const key = (id, roll) => `cuzy-v2-custom:${id}${roll ? `@${roll}` : ''}`;
const clean = (props) => props.map((p) => Object.fromEntries(Object.entries(p).filter(([k]) => k[0] !== '_' && k !== 'uid')));

export function loadCustom(id, roll = '') {
  try {
    return JSON.parse(localStorage.getItem(key(id, roll)));
  } catch {
    return null;
  }
}

export function hasCustom(id, roll = '') {
  return !!loadCustom(id, roll)?.props;
}

export function saveCustom(map) {
  try {
    localStorage.setItem(key(map.id, map.roll), JSON.stringify({ props: clean(map.props), ground: groundToString(map.ground) }));
  } catch {
    /* storage may be unavailable */
  }
}

export function clearCustom(id, roll = '') {
  try {
    localStorage.removeItem(key(id, roll));
  } catch {
    /* ignore */
  }
}

// the map to play or edit: as generated, with the player's edits on top when there are any (`useCustom`)
export async function buildMap(id, roll = '', useCustom = true) {
  await loadMapThemes();
  const map = generateMap(id, roll);
  return useCustom ? applyCustom(map, loadCustom(id, roll)) : map;
}

export const cloneMap = (m) => ({ ...m, props: m.props.map((p) => ({ ...p })), ground: new Uint8Array(m.ground), zones: m.zones });
