import { useEffect, useState } from 'react';

// Desktop (keyboard and mouse) or Mobile (joystick and buttons). A touch screen starts in Mobile; anyone can switch at any time.
const KEY = 'cuzy-controls';
const listeners = new Set();

const detect = () => {
  try {
    return window.matchMedia?.('(pointer: coarse)').matches ? 'mobile' : 'desktop';
  } catch {
    return 'desktop';
  }
};

let current = (() => {
  try {
    const v = window.localStorage.getItem(KEY);
    if (v === 'mobile' || v === 'desktop') return v;
  } catch {
    /* storage may be unavailable */
  }
  return detect();
})();

export const getControls = () => current;

// Mobile play wants the whole screen, held sideways. Browsers only allow this from a tap, which is where the
// switch is pressed. (iPhones do not allow either, so the game also asks you to turn the phone.)
export function enterMobileScreen() {
  try {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) {
      el.requestFullscreen({ navigationUI: 'hide' })
        .catch(() => {})
        .then(() => window.screen.orientation?.lock?.('landscape'))
        .catch(() => {});
    } else {
      window.screen.orientation?.lock?.('landscape')?.catch(() => {});
    }
  } catch {
    /* not supported here */
  }
}

export function leaveMobileScreen() {
  try {
    window.screen.orientation?.unlock?.();
  } catch {
    /* ignore */
  }
  try {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  } catch {
    /* ignore */
  }
}

export function setControls(mode) {
  if (mode !== 'mobile' && mode !== 'desktop') return;
  if (mode === 'mobile') enterMobileScreen();
  else leaveMobileScreen();
  current = mode;
  try {
    window.localStorage.setItem(KEY, mode);
  } catch {
    /* ignore */
  }
  for (const l of listeners) l(mode);
}

export function useControls() {
  const [mode, setMode] = useState(current);
  useEffect(() => {
    listeners.add(setMode);
    setMode(current);
    return () => listeners.delete(setMode);
  }, []);
  return mode;
}

// ---------- the layout of the mobile controls: which hand, and how big things are ----------
const LKEY = 'cuzy-layout';
export const DEFAULT_LAYOUT = { hand: 'right', buttons: 'm', screen: 'm', custom: {}, lockDist: 150 }; // custom: buttons placed by hand
const lListeners = new Set();

let layout = (() => {
  try {
    const v = JSON.parse(window.localStorage.getItem(LKEY));
    if (v && typeof v === 'object') return { ...DEFAULT_LAYOUT, ...v };
  } catch {
    /* storage may be unavailable */
  }
  return { ...DEFAULT_LAYOUT };
})();

export const getLayout = () => layout;

export function setLayout(patch) {
  layout = { ...layout, ...patch };
  try {
    window.localStorage.setItem(LKEY, JSON.stringify(layout));
  } catch {
    /* ignore */
  }
  for (const l of lListeners) l(layout);
}

export const resetLayout = () => setLayout({ ...DEFAULT_LAYOUT });

export function useLayout() {
  const [l, setL] = useState(layout);
  useEffect(() => {
    lListeners.add(setL);
    setL(layout);
    return () => lListeners.delete(setL);
  }, []);
  return l;
}

const SCALE = { s: 0.8, m: 1, l: 1.25 };
export const layoutScale = (k) => SCALE[k] || 1;
