// Tiny room server for local multiplayer. It piggybacks on the Vite dev/preview HTTP server
// (path /mp), so `npm run dev` is all anyone has to run, and friends on the same Wi-Fi can join.
import os from 'node:os';
import { WebSocketServer } from 'ws';
import { TEAMS, TEAM_COUNTS } from '../src/game/teams.js';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to keep codes easy to read out loud
const HOURS_PER_SECOND = 24 / 360; // keep in step with the client's day length
const START_HOUR = 8;
const KILL_TARGET = 10; // first to this many player kills wins the round
const MONSTER_TARGET = 15; // ...or this many monster kills, when the room plays "monster kills"
const MAX_PLAYERS = 10; // the most heroes one room can hold
const INTRO_MAX_MS = 45000; // the longest everyone waits for slow players to finish the opening scene
const CELEBRATE_MS = 7000; // how long a round's winner is cheered before everyone is sent back to the waiting room

const targetOf = (r) => r.target;
const defaultTarget = (winBy) => (winBy === 'monsters' ? MONSTER_TARGET : KILL_TARGET);
const clampTarget = (v, fallback) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.min(99, Math.max(1, Math.round(Number(v)))) : fallback);
const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);
const num = (v) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : 0);

function lanUrls(port) {
  const out = [];
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal) out.push(`http://${a.address}:${port}`);
    }
  }
  return out;
}

export function attachRoomServer(httpServer) {
  const wss = new WebSocketServer({ noServer: true });
  const rooms = new Map();
  const clients = new Set();
  let nextId = 1;

  const send = (ws, msg) => {
    if (ws.readyState === 1) ws.send(JSON.stringify(msg));
  };
  const sendRoom = (room, msg, except) => {
    for (const p of room.players.values()) if (p !== except) send(p, msg);
  };

  const summary = (r) => ({
    code: r.code,
    name: r.name,
    seed: r.seed,
    max: r.max,
    pvp: r.pvp,
    mode: r.mode,
    difficulty: r.difficulty,
    target: targetOf(r),
    winBy: r.winBy,
    allowLate: r.allowLate,
    allowThrow: r.allowThrow,
    allowMelee: r.allowMelee,
    streakMonsters: r.streakMonsters,
    teams: r.teams,
    count: r.players.size,
    started: r.started,
    host: r.players.get(r.hostId)?.player.name || '?',
  });
  const publicPlayer = (ws) => ({ id: ws.id, slot: ws.slot, team: ws.team ?? null, ...ws.player, ...ws.pos });
  const scoreList = (room) => [...room.players.values()].map((p) => ({ id: p.id, name: p.player.name, kills: p.kills, team: p.team ?? null }));

  // ---- teams: a room is free for all (teams = 0) or split into 2-4 teams ----
  const teamMap = (room) => Object.fromEntries([...room.players.values()].filter((p) => p.team !== null && p.team !== undefined).map((p) => [p.id, p.team]));
  const sendTeams = (room) => sendRoom(room, { t: 'teams', teams: teamMap(room) });
  // a newcomer joins the smallest team
  const assignTeam = (room, ws) => {
    if (!room.teams) {
      ws.team = null;
      return;
    }
    const counts = Array(room.teams).fill(0);
    for (const p of room.players.values()) if (p !== ws && p.team !== null && p.team !== undefined && p.team < room.teams) counts[p.team]++;
    ws.team = counts.indexOf(Math.min(...counts));
  };
  const reassignAll = (room) => {
    let i = 0;
    for (const p of room.players.values()) p.team = room.teams ? i++ % room.teams : null;
  };
  // what a win is counted on: your own kills, or your whole team's
  const scoreOf = (room, p) =>
    room.teams && p.team !== null && p.team !== undefined
      ? [...room.players.values()].filter((q) => q.team === p.team).reduce((n, q) => n + q.kills, 0)
      : p.kills;
  const sendScores = (room) => sendRoom(room, { t: 'scores', scores: scoreList(room), target: targetOf(room) });

  // Everyone watches the opening scene when a round starts; the world only begins once all of them are done (or skipped it).
  const openIntro = (room) => {
    room.introOpen = true;
    room.introReady = new Set();
    clearTimeout(room.introTimer);
    room.introTimer = setTimeout(() => closeIntro(room), INTRO_MAX_MS);
  };
  const closeIntro = (room) => {
    if (!room.introOpen) return;
    room.introOpen = false;
    clearTimeout(room.introTimer);
    sendRoom(room, { t: 'go' });
  };
  const checkIntro = (room) => {
    if (room.introOpen && [...room.players.keys()].every((id) => room.introReady.has(id))) closeIntro(room);
  };

  // a player reached the target: cheer them, then send everyone back to the waiting room
  const finishRound = (room, winner) => {
    room.winning = true;
    const team = room.teams ? winner.team : null;
    sendRoom(room, { t: 'win', id: winner.id, name: team !== null && team !== undefined ? `${TEAMS[team].name} team` : winner.player.name, team, target: targetOf(room) });
    clearTimeout(room.backTimer);
    room.backTimer = setTimeout(() => {
      if (!rooms.has(room.code)) return;
      room.started = false;
      room.winning = false;
      room.introOpen = false;
      for (const p of room.players.values()) p.kills = 0;
      sendRoom(room, { t: 'lobby', room: summary(room), teams: teamMap(room), host: room.hostId, players: [...room.players.values()].map(publicPlayer), scores: scoreList(room) });
      pushLobby();
    }, CELEBRATE_MS);
  };

  // everyone with the game open, so players can see each other and invite one another anywhere
  const pushOnline = () => {
    const list = [...clients].filter((c) => c.identified).map((c) => ({ id: c.id, name: c.player.name, hero: c.player.hero, room: c.room?.code || null, roomName: c.room?.name || '' }));
    for (const c of clients) if (c.identified) send(c, { t: 'online', players: list.filter((p) => p.id !== c.id) });
  };

  const pushLobby = () => {
    const list = [...rooms.values()].map(summary);
    for (const c of clients) if (c.lobby && !c.room) send(c, { t: 'rooms', rooms: list });
  };

  const newCode = () => {
    for (;;) {
      let code = '';
      for (let i = 0; i < 4; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
      if (!rooms.has(code)) return code;
    }
  };

  const leaveRoom = (ws) => {
    const room = ws.room;
    if (!room) return;
    ws.room = null;
    room.players.delete(ws.id);
    if (room.players.size === 0) {
      clearTimeout(room.backTimer);
      clearTimeout(room.introTimer);
      rooms.delete(room.code);
    } else {
      if (room.hostId === ws.id) room.hostId = room.players.keys().next().value;
      sendRoom(room, { t: 'peer_leave', id: ws.id, name: ws.player.name, host: room.hostId });
      checkIntro(room); // the one who left might have been the last we were waiting for
      sendScores(room);
    }
    pushLobby();
    pushOnline();
  };

  const enter = (ws, room) => {
    ws.room = room;
    ws.lobby = false;
    ws.kills = 0;
    // lowest free slot number; clients use it to pick a different home house each
    const taken = new Set([...room.players.values()].map((p) => p.slot));
    ws.slot = 0;
    while (taken.has(ws.slot)) ws.slot++;
    room.players.set(ws.id, ws);
    assignTeam(room, ws);
    const elapsed = (Date.now() - room.t0) / 1000;
    const hours = room.startHour + elapsed * HOURS_PER_SECOND;
    send(ws, {
      t: 'joined',
      started: room.started,
      you: ws.id,
      slot: ws.slot,
      host: room.hostId,
      room: summary(room),
      teams: teamMap(room),
      players: [...room.players.values()].filter((p) => p !== ws).map(publicPlayer),
      scores: scoreList(room),
      clock: { hour: hours % 24, day: 1 + Math.floor(hours / 24) },
    });
    sendRoom(room, { t: 'peer_join', player: publicPlayer(ws) }, ws);
    sendTeams(room);
    sendScores(room);
    pushLobby();
    pushOnline();
  };

  const handlers = {
    // who this client is (shown in everyone's online list)
    identify(ws, m) {
      ws.player = { name: clean(m.name, 14) || 'Friend', hero: clean(m.hero, 32) || 'adam' };
      ws.identified = true;
      pushOnline();
    },
    // ask another player to join the room we are in
    invite(ws, m) {
      if (!ws.room) return;
      const target = [...clients].find((c) => c.id === Number(m.to));
      if (!target || target === ws) return;
      send(target, { t: 'invite', from: { id: ws.id, name: ws.player.name, hero: ws.player.hero }, code: ws.room.code, roomName: ws.room.name });
    },
    lobby(ws) {
      ws.lobby = true;
      send(ws, { t: 'rooms', rooms: [...rooms.values()].map(summary) });
    },
    create(ws, m) {
      leaveRoom(ws);
      ws.player = { name: clean(m.player?.name, 14) || 'Friend', hero: clean(m.player?.hero, 32) || 'adam' };
      const room = {
        code: newCode(),
        name: clean(m.name, 24) || `${ws.player.name}'s meadow`,
        seed: clean(m.seed, 40) || 'sunny-meadow-101',
        max: Math.min(MAX_PLAYERS, Math.max(2, Number(m.max) || 4)),
        // Wave Defense and Survival are co-op: the room's host runs the monsters, so there is no hero-vs-hero fighting
        mode: ['waves', 'survival'].includes(m.mode) ? m.mode : 'free',
        difficulty: ['easy', 'medium', 'hard'].includes(m.difficulty) ? m.difficulty : 'medium',
        pvp: !['waves', 'survival'].includes(m.mode) && m.pvp !== false,
        startHour: m.mode === 'survival' ? 17.3 : START_HOUR, // Survival begins at dusk
        hostId: ws.id,
        winBy: m.mode !== 'waves' && m.mode !== 'survival' && m.winBy === 'monsters' ? 'monsters' : 'duel',
        target: 0, // filled in just below
        allowThrow: m.allowThrow !== false,
        allowMelee: m.allowMelee !== false,
        teams: !['waves', 'survival'].includes(m.mode) && [2, 3, 4].includes(Number(m.teams)) ? Number(m.teams) : 0, // 0 = free for all
        streakMonsters: m.streakMonsters === true, // do monster kills count towards kill streaks (and get announced to everyone)?
        allowLate: m.allowLate !== false, // may people join once the round is under way?
        started: false, // a new room waits for its host to press Start
        winning: false,
        t0: Date.now(),
        players: new Map(),
      };
      room.target = clampTarget(m.target, defaultTarget(room.winBy));
      rooms.set(room.code, room);
      enter(ws, room);
    },
    join(ws, m) {
      const room = rooms.get(clean(m.code, 8).toUpperCase());
      if (!room) return send(ws, { t: 'error', msg: "That room code doesn't exist (anymore)." });
      if (room.players.size >= room.max) return send(ws, { t: 'error', msg: 'That room is full.' });
      if (room.started && !room.allowLate) return send(ws, { t: 'error', msg: 'That round has already started, and the host has turned late joining off.' });
      leaveRoom(ws);
      ws.player = { name: clean(m.player?.name, 14) || 'Friend', hero: clean(m.player?.hero, 32) || 'adam' };
      enter(ws, room);
    },
    leave(ws) {
      leaveRoom(ws);
    },
    // the host starts the round from the waiting room: everyone gets a fresh clock, fresh scores and the full roster
    start(ws) {
      const room = ws.room;
      if (!room || room.started || room.hostId !== ws.id) return;
      room.started = true;
      room.winning = false;
      for (const p of room.players.values()) if (room.teams && (p.team === null || p.team === undefined)) assignTeam(room, p);
      openIntro(room);
      room.t0 = Date.now();
      for (const p of room.players.values()) p.kills = 0;
      const hours = room.startHour;
      for (const p of room.players.values()) {
        send(p, {
          t: 'start',
          room: summary(room),
          teams: teamMap(room),
          host: room.hostId,
          players: [...room.players.values()].filter((q) => q !== p).map(publicPlayer),
          scores: scoreList(room),
          clock: { hour: hours % 24, day: 1 + Math.floor(hours / 24) },
        });
      }
      pushLobby();
    },
    state(ws, m) {
      if (!ws.room) return;
      ws.pos = {
        x: num(m.x),
        y: num(m.y),
        dir: ['up', 'down', 'left', 'right'].includes(m.dir) ? m.dir : 'down',
        moving: !!m.moving,
        hidden: !!m.hidden,
        hp: Math.max(0, Math.min(12, Math.round(Number(m.hp) || 0))),
        lv: Math.max(1, Math.min(9, Math.round(Number(m.lv)) || 1)), // sword level, shown next to the health bar
        mt: m.mt === 'chicken' || m.mt === 'cow' ? m.mt : '', // what they are riding
      };
      sendRoom(ws.room, { t: 'state', id: ws.id, ...ws.pos }, ws);
    },
    // an attacker's client says it landed a hit; only the victim hears about it
    hit(ws, m) {
      const room = ws.room;
      const target = room?.players.get(Number(m.target));
      if (!room?.pvp || !target || target === ws) return;
      if (room.teams && target.team !== null && target.team === ws.team) return; // no friendly fire
      const dmg = Math.max(1, Math.min(4, Math.round(Number(m.dmg) || 1)));
      send(target, { t: 'hit', from: ws.id, dmg, fx: ws.pos.x, fy: ws.pos.y });
    },
    // the victim reports its own defeat so the right player gets the point
    died(ws, m) {
      const room = ws.room;
      if (!room?.pvp || !room.started || room.winning) return;
      const killer = room.players.get(Number(m.killer));
      if (!killer || killer === ws) return;
      // a player took down a player: everyone hears about it (kill streaks are global); it only scores in a "player kills" room
      sendRoom(room, { t: 'kill', killer: killer.player.name, victim: ws.player.name, killerId: killer.id, victimId: ws.id });
      if (room.winBy === 'monsters') return;
      killer.kills++;
      if (scoreOf(room, killer) >= targetOf(room)) finishRound(room, killer);
      sendScores(room);
    },
    // a player went down to something other than a player: their kill streak is over, for everyone
    fell(ws) {
      const room = ws.room;
      if (room?.started) sendRoom(room, { t: 'fell', id: ws.id }, ws);
    },
    // a player took down a monster: only counts towards streaks when the host allowed it in the room settings
    skill(ws, m) {
      const room = ws.room;
      if (!room?.streakMonsters || !room.started || room.winning) return;
      sendRoom(room, { t: 'kill', killer: ws.player.name, victim: clean(m.victim, 24) || 'a monster', killerId: ws.id, victimId: 'npc' });
    },
    // this player's opening scene is over (watched or skipped)
    ready(ws) {
      const room = ws.room;
      if (!room || !room.started) return;
      if (!room.introOpen) return send(ws, { t: 'go' }); // a late joiner: the round is already running
      room.introReady.add(ws.id);
      checkIntro(room);
    },
    // host-only room settings, changeable from the waiting room
    settings(ws, m) {
      const room = ws.room;
      if (!room || room.hostId !== ws.id) return;
      const free = room.mode === 'free';
      if (typeof m.allowLate === 'boolean') room.allowLate = m.allowLate;
      // everything else is decided before the round, not during it
      if (!room.started) {
        if (typeof m.allowThrow === 'boolean') room.allowThrow = m.allowThrow;
        if (typeof m.allowMelee === 'boolean') room.allowMelee = m.allowMelee;
        if (typeof m.streakMonsters === 'boolean') room.streakMonsters = m.streakMonsters;
        if (Number.isFinite(Number(m.max))) room.max = Math.min(MAX_PLAYERS, Math.max(2, room.players.size, Math.round(Number(m.max))));
        if (free) {
          if (TEAM_COUNTS.includes(Number(m.teams)) && m.teams !== undefined && Number(m.teams) !== room.teams) {
            room.teams = Number(m.teams);
            reassignAll(room);
          }
          if (typeof m.pvp === 'boolean') room.pvp = m.pvp;
          if (m.winBy === 'duel' || m.winBy === 'monsters') room.winBy = m.winBy;
          if (m.target !== undefined) room.target = clampTarget(m.target, room.target);
          if (!room.pvp) room.winBy = 'monsters'; // with no player damage, the only way to win is monsters
        }
      }
      sendRoom(room, { t: 'settings', room: summary(room) });
      sendTeams(room);
      pushLobby();
    },
    // a player picks their own team in the waiting room
    team(ws, m) {
      const room = ws.room;
      const n = Number(m.team);
      if (!room || room.started || !room.teams || !Number.isInteger(n) || n < 0 || n >= room.teams) return;
      ws.team = n;
      sendTeams(room);
    },
    // in a "monster kills" room each client reports the monsters it takes down
    mkill(ws) {
      const room = ws.room;
      if (!room || room.winBy !== 'monsters' || !room.started || room.winning) return;
      ws.kills++;
      sendScores(room);
      if (scoreOf(room, ws) >= targetOf(room)) finishRound(room, ws);
    },
    // Wave Defense traffic: snapshots and events from the host, requests and hits from guests
    w(ws, m) {
      const room = ws.room;
      if (!room || typeof m.k !== 'string') return;
      const msg = { t: 'w', from: ws.id, k: m.k.slice(0, 12), d: m.d };
      if (m.to === 'host') {
        const host = room.players.get(room.hostId);
        if (host && host !== ws) send(host, msg);
      } else if (typeof m.to === 'number') {
        const target = room.players.get(m.to);
        if (target) send(target, msg);
      } else {
        sendRoom(room, msg, ws);
      }
    },
    chat(ws, m) {
      const text = clean(m.text, 80);
      if (ws.room && text) sendRoom(ws.room, { t: 'chat', id: ws.id, name: ws.player.name, text }, ws);
    },
    fx(ws, m) {
      if (!ws.room) return;
      if (m.kind === 'swing') sendRoom(ws.room, { t: 'fx', id: ws.id, kind: 'swing', a: num(m.a) }, ws);
      if (m.kind === 'shield') sendRoom(ws.room, { t: 'fx', id: ws.id, kind: 'shield' }, ws);
      if (m.kind === 'spin') sendRoom(ws.room, { t: 'fx', id: ws.id, kind: 'spin', a: num(m.a), r: num(m.r), d: num(m.d) }, ws);
      // thrown items are only drawn for others; the thrower's client decides if it hit
      if (m.kind === 'throw') {
        sendRoom(ws.room, { t: 'fx', id: ws.id, kind: 'throw', item: clean(m.item, 16), x: num(m.x), y: num(m.y), vx: num(m.vx), vy: num(m.vy) }, ws);
      }
    },
  };

  httpServer.on('upgrade', (req, socket, head) => {
    if (!req.url?.startsWith('/mp')) return; // leave Vite's own HMR socket alone
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  wss.on('connection', (ws, req) => {
    ws.id = nextId++;
    ws.alive = true;
    ws.player = { name: 'Friend', hero: 'adam' };
    ws.pos = { x: 0, y: 0, dir: 'down', moving: false, hp: 6 };
    ws.kills = 0;
    ws.room = null;
    ws.lobby = false;
    clients.add(ws);
    send(ws, { t: 'hello', id: ws.id, lan: lanUrls(req.socket.localPort) });
    ws.on('pong', () => { ws.alive = true; });
    ws.on('message', (data) => {
      let m;
      try {
        m = JSON.parse(data.toString());
      } catch {
        return;
      }
      handlers[m?.t]?.(ws, m);
    });
    ws.on('close', () => {
      leaveRoom(ws);
      clients.delete(ws);
      pushOnline();
    });
  });

  // drop connections that went silent (closed laptop, lost Wi-Fi)
  const beat = setInterval(() => {
    for (const ws of clients) {
      if (!ws.alive) ws.terminate();
      else {
        ws.alive = false;
        ws.ping();
      }
    }
  }, 25000);
  httpServer.on('close', () => clearInterval(beat));
}
