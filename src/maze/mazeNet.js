// Maze Rush online: one Supabase realtime channel per room code (the same free broadcast the other game rooms use; nothing is stored).
// The host runs the whole game and sends 20 snapshots a second; everyone else sends the way they want to go and draws what they are sent.

import { cloudOn, rawClient } from '../game/store';

export const onlineAvailable = cloudOn;

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const makeCode = () => Array.from({ length: 4 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
export const makeId = () => Math.random().toString(36).slice(2, 9);

export class MazeNet {
  constructor() {
    this.id = makeId();
    this.handlers = new Set();
    this.ch = null;
    this.sb = null;
    this.code = '';
  }

  on(fn) {
    this.handlers.add(fn);
    return () => this.handlers.delete(fn);
  }

  async open(code) {
    const sb = await rawClient();
    if (!sb) throw new Error('Online play is not set up on this copy of the game.');
    this.sb = sb;
    this.code = code;
    const ch = sb.channel(`cuzy-maze-${code}`, { config: { broadcast: { self: false } } });
    this.ch = ch;
    ch.on('broadcast', { event: 'm' }, ({ payload }) => {
      for (const h of this.handlers) h(payload);
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Could not reach the server.')), 9000);
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timer);
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          clearTimeout(timer);
          reject(new Error('Could not reach the server.'));
        }
      });
    });
  }

  send(m) {
    this.ch?.send({ type: 'broadcast', event: 'm', payload: m });
  }

  close() {
    try {
      if (this.ch) this.sb.removeChannel(this.ch);
    } catch {
      /* already closed */
    }
    this.ch = null;
    this.handlers.clear();
  }
}
