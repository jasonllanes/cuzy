// A casual lock on the developer tools (the two training rooms and Free Roam V2). The code is kept as a hash and the unlock lasts
// for this browser tab. This keeps curious players out; it is not real security, since everything runs in the browser.
const KEY = 'cuzy-access';
const HASH = '310e7477badb9db8eefa9c3ff6fad1dbe3c96ef4b770daf47934f2cba93ba3d6';

export const isUnlocked = () => {
  try {
    return window.sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};

export const lockAgain = () => {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // nothing to forget
  }
};

// resolves true (and unlocks) when the code is right
export async function tryUnlock(code) {
  if (!window.crypto?.subtle) return false;
  const bytes = new TextEncoder().encode(`cuzy-access:${String(code).trim()}`);
  const digest = await window.crypto.subtle.digest('SHA-256', bytes);
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  if (hex !== HASH) return false;
  try {
    window.sessionStorage.setItem(KEY, '1');
  } catch {
    return false;
  }
  return true;
}
