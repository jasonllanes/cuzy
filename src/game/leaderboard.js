import { rawClient, cloudOn } from './store';

// Leaderboards (Survival). A run is ranked in its own category:
//   surv:<waves>:<difficulty>   a finished run of that many waves: the time it took, lowest first
//   endless:<difficulty>        Endless Survival: how long you lasted, highest first
// Rows live in the `leaderboard` table (see supabase/schema.sql). Everyone can read the boards and add a score.

export const BOARD_SIZE = 10;
export const WAVE_CHOICES = [5, 10, 15, 20, 30, 50];
export const DIFFS = [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']];

export const survKey = (waves, diff) => `surv:${waves}:${diff}`;
export const endlessKey = (diff) => `endless:${diff}`;
export const lowerWins = (category) => category.startsWith('surv:');

export const fmtTime = (s) => {
  const n = Math.max(0, Math.round(s));
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const sec = n % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
};

export const categoryName = (category) => {
  const [kind, a, b] = category.split(':');
  const diff = DIFFS.find(([id]) => id === (kind === 'endless' ? a : b))?.[1] || '';
  return kind === 'endless' ? `♾️ Endless · ${diff}` : `🧟 Survival · ${a} waves · ${diff}`;
};

// the best row of each name, best first, the top ten
const topTen = (rows, category) => {
  const best = new Map();
  for (const r of rows) {
    const old = best.get(r.name);
    if (!old || (lowerWins(category) ? r.score < old.score : r.score > old.score)) best.set(r.name, r);
  }
  return [...best.values()].sort((a, b) => (lowerWins(category) ? a.score - b.score : b.score - a.score) || a.id - b.id).slice(0, BOARD_SIZE);
};

export async function fetchTop(category) {
  if (!cloudOn) throw new Error('The leaderboards need the online connection.');
  const sb = await rawClient();
  if (!sb) throw new Error('Could not reach the server.');
  const { data, error } = await sb.from('leaderboard').select('id,name,score,created_at').eq('category', category).order('score', { ascending: lowerWins(category) }).limit(200);
  if (error) throw new Error(error.message);
  return topTen(data || [], category);
}

// add a finished run; the answer says where it landed: { rows, myId (the row if it is in the top ten, else null) }
export async function submitScore({ category, name, score, detail }) {
  if (!cloudOn) throw new Error('The leaderboards need the online connection.');
  const sb = await rawClient();
  if (!sb) throw new Error('Could not reach the server.');
  const clean = String(name || 'Survivor').trim().slice(0, 24) || 'Survivor';
  const { data: row, error } = await sb.from('leaderboard').insert({ category, name: clean, score: Math.max(0, Math.round(score)), detail: detail || null }).select('id').single();
  if (error) throw new Error(error.message);
  const rows = await fetchTop(category);
  return { rows, myId: rows.find((r) => r.id === row?.id)?.id ?? null, name: clean };
}
