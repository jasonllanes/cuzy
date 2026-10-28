// Teams for room games: a room is either free for all (teams = 0) or split into 2-4 teams.
// Shared by the game, the room UI and both room back-ends (server/rooms.mjs and supaNet.js).
export const TEAMS = [
  { name: 'Red', color: '#e8506a', icon: '🔴' },
  { name: 'Blue', color: '#4a9be8', icon: '🔵' },
  { name: 'Green', color: '#4fbf6a', icon: '🟢' },
  { name: 'Yellow', color: '#e8c040', icon: '🟡' },
];
export const TEAM_COUNTS = [0, 2, 3, 4]; // the choices for the "Teams" room setting
