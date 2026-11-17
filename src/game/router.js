// A tiny hash router. Every screen has an address, so the back button works, a reload comes back to the same place, and a link to a room
// goes to that room:
//   #/                      the main menu          #/play/name|game|hero|map   the setup walk (each step is its own page)
//   #/multi  #/rooms  #/code   multiplayer         #/settings  #/leaderboards  #/about  #/exit
//   #/room/ABCD             inside room ABCD (the waiting area, then the game)     #/game   a game without a room     #/maze   Maze Rush
// (#/training and #/training-v2 are the developer rooms and keep working as before.)

export const hashSegs = () => window.location.hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean);

export function setHash(path, replace = false) {
  const want = path ? `#/${String(path).replace(/^\//, '')}` : '#/';
  if (window.location.hash === want || (!path && !window.location.hash)) return;
  if (replace) window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${want}`);
  else window.location.hash = want;
}

export const onHash = (fn) => {
  window.addEventListener('hashchange', fn);
  return () => window.removeEventListener('hashchange', fn);
};

// the room code in the address (#/room/ABCD), cleaned up
export const roomFromHash = () => {
  const [a, b] = hashSegs();
  return a === 'room' && b ? b.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) : '';
};

export const WIZARD_STEPS = ['name', 'game', 'hero', 'map'];
const MENU_VIEWS = ['multi', 'rooms', 'code', 'settings', 'about', 'exit'];

// where the main menu should be for the address: { view, step } (step ids as the menu names them: 'play' is the map page)
export function menuRoute() {
  const [a, b] = hashSegs();
  if (a === 'play') {
    const s = WIZARD_STEPS.includes(b) ? b : 'name';
    return { view: 'wizard', step: s === 'map' ? 'play' : s };
  }
  if (a === 'leaderboards') return { view: 'board', step: 'name' };
  if (MENU_VIEWS.includes(a)) return { view: a, step: 'name' };
  return { view: 'home', step: 'name' };
}

export const menuPath = (view, step) => (view === 'wizard' ? `play/${step === 'play' ? 'map' : step}` : view === 'home' ? '' : view === 'board' ? 'leaderboards' : view);
