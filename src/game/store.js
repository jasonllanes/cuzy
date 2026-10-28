// Where Cuzy keeps your profile and saved games.
//
// localStorage is always the working copy (it is instant and works offline). When Supabase is configured
// (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY) every write is also uploaded to the `kv` table, and the
// latest copies are pulled down when the game starts. Without those variables, or if Supabase can't be
// reached, the game just carries on with localStorage.

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const cloudOn = !!(URL && KEY);

const SYNCED = (key) => key === 'cuzi-profile' || key.startsWith('cuzi-save:'); // audio settings stay per device
const PUSH_DELAY = 3000; // ms: a burst of autosaves becomes one upload

let basePromise = null;
let clientPromise = null;
const pending = new Map(); // key -> string | null (null = delete)
let timer = 0;

// The one shared Supabase client (rooms use it as it is; saves also need a signed-in user)
export function rawClient() {
  if (!cloudOn) return Promise.resolve(null);
  basePromise ||= import('@supabase/supabase-js')
    .then(({ createClient }) => createClient(URL, KEY, { realtime: { params: { eventsPerSecond: 20 } } }))
    .catch((err) => {
      console.warn('[cuzy] could not load Supabase:', err.message || err);
      return null;
    });
  return basePromise;
}

// One anonymous Supabase user per browser: no sign-up screen, and saved rows are private to that user
function client() {
  if (!cloudOn) return Promise.resolve(null);
  clientPromise ||= rawClient()
    .then(async (sb) => {
      if (!sb) return null;
      const { data } = await sb.auth.getSession();
      if (!data.session) {
        const { error } = await sb.auth.signInAnonymously();
        if (error) throw error;
      }
      return sb;
    })
    .catch((err) => {
      console.warn('[cuzy] cloud saves are off (enable Anonymous sign-ins in Supabase), using local storage only:', err.message || err);
      return null;
    });
  return clientPromise;
}

const local = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* storage may be unavailable */
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

const stampKey = (key) => `${key}#at`;

async function flush() {
  clearTimeout(timer);
  timer = 0;
  if (!pending.size) return;
  const batch = [...pending];
  pending.clear();
  const sb = await client();
  if (!sb) return;
  const { data } = await sb.auth.getUser();
  const uid = data?.user?.id;
  if (!uid) return;
  const puts = [];
  for (const [key, value] of batch) {
    if (value === null) {
      const { error } = await sb.from('kv').delete().eq('user_id', uid).eq('key', key);
      if (error) console.warn('[cuzy] cloud delete failed:', error.message);
    } else {
      let parsed;
      try {
        parsed = JSON.parse(value);
      } catch {
        parsed = value;
      }
      puts.push({ user_id: uid, key, value: parsed, updated_at: new Date().toISOString() });
    }
  }
  if (puts.length) {
    const { error } = await sb.from('kv').upsert(puts);
    if (error) console.warn('[cuzy] cloud save failed:', error.message);
  }
}

function queue(key, value) {
  if (!cloudOn || !SYNCED(key)) return;
  pending.set(key, value);
  if (!timer) timer = setTimeout(flush, PUSH_DELAY);
}

if (cloudOn && typeof window !== 'undefined') {
  // don't lose the last autosave when the tab is closed or hidden
  window.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
  window.addEventListener('pagehide', flush);
}

export const store = {
  get: local.get,
  set(key, value) {
    local.set(key, value);
    local.set(stampKey(key), new Date().toISOString());
    queue(key, value);
  },
  remove(key) {
    local.remove(key);
    local.remove(stampKey(key));
    queue(key, null);
  },

  // Pull the cloud copies into local storage (newer one wins). Gives up after `ms` so a slow network never blocks the game.
  async sync(ms = 4000) {
    if (!cloudOn) return false;
    const work = (async () => {
      const sb = await client();
      if (!sb) return false;
      const { data, error } = await sb.from('kv').select('key,value,updated_at');
      if (error) throw error;
      for (const row of data || []) {
        if (!SYNCED(row.key)) continue;
        const mine = local.get(stampKey(row.key));
        if (local.get(row.key) !== null && mine && mine >= row.updated_at) continue; // this device is newer
        local.set(row.key, typeof row.value === 'string' ? row.value : JSON.stringify(row.value));
        local.set(stampKey(row.key), row.updated_at);
      }
      return true;
    })();
    try {
      return await Promise.race([work, new Promise((resolve) => setTimeout(() => resolve(false), ms))]);
    } catch (err) {
      console.warn('[cuzy] could not load your cloud save:', err.message || err);
      return false;
    }
  },
};
