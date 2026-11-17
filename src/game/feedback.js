import { rawClient, cloudOn } from './store';

// Player feedback: a kind (feature / bug / suggestion), the details, and an optional screenshot that is shrunk to a small JPEG first
// so it stays light for Supabase. Players can only send; the developer reads the list (see supabase/schema.sql).

export const KINDS = [
  { id: 'bug', icon: '🐞', label: 'Bug', hint: 'Something is broken' },
  { id: 'feature', icon: '✨', label: 'Feature', hint: 'Something new to add' },
  { id: 'suggestion', icon: '💡', label: 'Suggestion', hint: 'Make something better' },
];

const MAX_SIDE = 960;
const MAX_CHARS = 160000; // about 120 KB of picture

// any image (a game canvas, or a picture the player picked) -> a data URL of a small JPEG
export async function shrinkImage(src) {
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('could not read that picture'));
    i.src = src;
  });
  const k = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.width * k));
  c.height = Math.max(1, Math.round(img.height * k));
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  for (const q of [0.6, 0.5, 0.4, 0.3, 0.22]) {
    const out = c.toDataURL('image/jpeg', q);
    if (out.length <= MAX_CHARS) return out;
  }
  return c.toDataURL('image/jpeg', 0.15);
}

export const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('could not read that file'));
    r.readAsDataURL(file);
  });

export async function sendFeedback({ kind, details, player, context, screenshot }) {
  if (!cloudOn) throw new Error('Feedback needs the online connection, which is not set up here.');
  const sb = await rawClient();
  if (!sb) throw new Error('Could not reach the server. Try again in a moment.');
  const { error } = await sb.from('feedback').insert({
    kind,
    details: String(details).trim().slice(0, 2000),
    player: player ? String(player).slice(0, 40) : null,
    context: context || null,
    screenshot: screenshot || null,
  });
  if (error) throw new Error(error.message || 'Could not send it.');
}
