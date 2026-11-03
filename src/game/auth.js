// Two ways to play: as a guest, or signed in with Google.
//
//  - A guest has no account: the name, character and progress live in this browser only (localStorage).
//  - Signed in with Google, the profile (name, character...) and every saved game are also kept in the `kv` table, under
//    your account, and come back on any device (see store.js).
// A browser that had an anonymous Supabase user from an older version keeps its saves when it signs in: the Google account
// is *linked* to that user (this needs "Allow manual linking" in Supabase: Authentication -> Sign In / Providers).
// If that Google account already has a Cuzy profile from another device, linking is refused, and the next press
// signs in to that existing profile instead; its saves are pulled in at the next start.

import { cloudOn, forgetLocalSaves, rawClient } from './store';

const SWITCH_KEY = 'cuzy-google-switch';
const GUEST_KEY = 'cuzy-guest';

// "Play as guest" was chosen on this browser (so the welcome page is not shown again)
export function isGuest() {
  try {
    return window.localStorage.getItem(GUEST_KEY) === '1';
  } catch {
    return false;
  }
}

export function chooseGuest(on = true) {
  try {
    if (on) window.localStorage.setItem(GUEST_KEY, '1');
    else window.localStorage.removeItem(GUEST_KEY);
  } catch {
    /* ignore */
  }
}

// come back to the page the game is on (the site is served from ./, so BASE_URL would not make an address): https://jasonllanes.github.io/cuzy/ or http://localhost:5173/
const redirectTo = () => `${window.location.origin}${window.location.pathname}`;

// what the game needs to know about whoever is signed in
export function accountOf(user) {
  if (!user) return null;
  const meta = user.user_metadata || {};
  const google = (user.identities || []).some((i) => i.provider === 'google');
  return {
    id: user.id,
    google,
    name: google ? String(meta.full_name || meta.name || user.email?.split('@')[0] || '').trim() : '',
    avatar: google ? meta.avatar_url || meta.picture || '' : '',
    email: google ? user.email || '' : '',
  };
}

// calls back now and whenever the account changes (signing in, signing out, coming back from Google); returns an unsubscribe
export function watchAccount(cb) {
  let off = () => {};
  let dead = false;
  rawClient().then(async (sb) => {
    if (dead) return;
    if (!sb) {
      cb(null); // the cloud could not be reached: nobody is signed in
      return;
    }
    const { data } = await sb.auth.getSession();
    if (!dead) cb(accountOf(data.session?.user));
    const sub = sb.auth.onAuthStateChange((_event, session) => !dead && cb(accountOf(session?.user)));
    off = () => sub.data.subscription.unsubscribe();
  });
  return () => {
    dead = true;
    off();
  };
}

// Google sends you back to the game with an error in the address when something went wrong: show it once and tidy the address
export function takeAuthError() {
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.replace(/^#\/?/, ''));
  const get = (k) => url.searchParams.get(k) || hash.get(k);
  const description = get('error_description');
  if (!get('error') && !description) return '';
  const already = /already.*(linked|exists)/i.test(`${get('error_code')} ${description}`);
  for (const k of ['error', 'error_code', 'error_description']) url.searchParams.delete(k);
  window.history.replaceState(null, '', `${url.pathname}${url.search}`);
  if (already) {
    try {
      window.localStorage.setItem(SWITCH_KEY, '1');
    } catch {
      /* ignore */
    }
    return 'That Google account already has a Cuzy profile. Press “Sign in with Google” again to switch to it.';
  }
  return description ? description.replace(/\+/g, ' ') : 'Google sign-in did not work.';
}

export async function signInWithGoogle() {
  const sb = await rawClient();
  if (!sb) throw new Error('Cloud saves are not set up.');
  const credentials = { provider: 'google', options: { redirectTo: redirectTo(), queryParams: { prompt: 'select_account' } } };
  let switching = false;
  try {
    switching = window.localStorage.getItem(SWITCH_KEY) === '1';
    window.localStorage.removeItem(SWITCH_KEY);
  } catch {
    /* ignore */
  }
  const { data } = await sb.auth.getSession();
  if (data.session?.user?.is_anonymous && !switching) {
    // keep this browser's saves: the Google account joins the user it already has
    const { error } = await sb.auth.linkIdentity(credentials);
    if (!error) return; // the browser is on its way to Google
    console.warn('[cuzy] could not link Google, signing in instead:', error.message);
  }
  const { error } = await sb.auth.signInWithOAuth(credentials);
  if (error) throw error;
}

// Back to being a guest. This browser forgets the account's profile and saves (they stay in the cloud), so the next
// person to sign in here never gets mixed up with them; the page reloads to start clean.
export async function signOut() {
  const sb = await rawClient();
  if (sb) await sb.auth.signOut();
  forgetLocalSaves();
  chooseGuest(true);
  window.location.reload();
}

export { cloudOn };
