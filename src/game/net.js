// Thin WebSocket client for the room server (see server/rooms.mjs).
export class Net {
  constructor() {
    this.ws = null;
    this.status = 'connecting'; // connecting | online | offline
    this.rooms = [];
    this.lan = [];
    this.listeners = new Set();
    this.wantLobby = false;
    this.closed = false;
    this.problem = '';
    this.online = []; // everyone else who has the game open
    this.identity = null;
    this.roomCode = null;
    this.connect();
  }

  get offlineText() {
    return 'Room server not reachable. Start the game with `npm run dev` and open it from there.';
  }

  get url() {
    const override = new URLSearchParams(window.location.search).get('server');
    if (override) return override;
    return `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/mp`;
  }

  connect() {
    if (this.closed) return;
    this.setStatus('connecting');
    let ws;
    try {
      ws = new WebSocket(this.url);
    } catch {
      this.setStatus('offline');
      this.retry();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.setStatus('online');
      if (this.wantLobby) this.send({ t: 'lobby' });
      if (this.identity) this.send({ t: 'identify', ...this.identity });
    };
    ws.onmessage = (e) => {
      let m;
      try {
        m = JSON.parse(e.data);
      } catch {
        return;
      }
      if (m.t === 'rooms') this.rooms = m.rooms;
      if (m.t === 'online') this.online = m.players;
      if (m.t === 'joined') this.roomCode = m.room.code;
      if (m.t === 'hello') this.lan = m.lan || [];
      this.emit(m);
    };
    ws.onclose = () => {
      this.setStatus('offline');
      this.emit({ t: 'disconnected' });
      this.retry();
    };
    ws.onerror = () => ws.close();
  }

  retry() {
    if (!this.closed) setTimeout(() => this.connect(), 2000);
  }

  setStatus(status) {
    this.status = status;
    this.emit({ t: 'status', status });
  }

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(m) {
    for (const fn of [...this.listeners]) fn(m);
  }

  send(m) {
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(m));
  }

  // Ask for the live room list (pushed again whenever it changes)
  watchLobby() {
    this.wantLobby = true;
    this.send({ t: 'lobby' });
  }

  request(msg) {
    return new Promise((resolve, reject) => {
      if (this.status !== 'online') {
        reject(new Error('Not connected to the room server. Is `npm run dev` running?'));
        return;
      }
      const timer = setTimeout(() => {
        off();
        reject(new Error('The room server took too long to answer.'));
      }, 5000);
      const off = this.on((m) => {
        if (m.t === 'joined') {
          clearTimeout(timer);
          off();
          resolve(m);
        } else if (m.t === 'error') {
          clearTimeout(timer);
          off();
          reject(new Error(m.msg));
        }
      });
      this.send(msg);
    });
  }

  create({ name, seed, max, pvp, mode, difficulty, winBy, allowLate, allowCheats, player }) {
    this.wantLobby = false;
    return this.request({ t: 'create', name, seed, max, pvp, mode, difficulty, winBy, allowLate, allowCheats, player });
  }

  join(code, player) {
    this.wantLobby = false;
    return this.request({ t: 'join', code, player });
  }

  setIdentity(p) {
    this.identity = { name: p?.name || 'Friend', hero: p?.hero || 'adam' };
    this.send({ t: 'identify', ...this.identity });
  }

  // chat for everyone online, whichever room they are in
  sendGlobal(text) {
    this.send({ t: 'gchat', text });
    return true;
  }

  // ask a player to join the room we are in
  invite(toId) {
    if (!this.roomCode) return false;
    this.send({ t: 'invite', to: toId });
    return true;
  }

  // take another seat in the waiting room
  moveSlot(n) {
    this.send({ t: 'slot', slot: n });
    return true;
  }

  leave() {
    this.roomCode = null;
    this.send({ t: 'leave' });
  }

  close() {
    this.closed = true;
    this.ws?.close();
  }
}

// Link that friends can open. On localhost it swaps in the machine's LAN address.
export function inviteLink(code, lan = []) {
  const here = window.location;
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(here.hostname);
  const origin = local && lan[0] ? lan[0] : here.origin;
  return `${origin}${here.pathname}?room=${code}`;
}
