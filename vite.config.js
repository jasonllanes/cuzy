import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { attachRoomServer } from './server/rooms.mjs';

// Local multiplayer rooms live on the same port as the game, under /mp
const rooms = () => ({
  name: 'cuzy-rooms',
  configureServer: (server) => server.httpServer && attachRoomServer(server.httpServer),
  configurePreviewServer: (server) => attachRoomServer(server.httpServer),
});

export default defineConfig({
  base: './',
  plugins: [react(), rooms()],
  // listen on the local network too so friends on the same Wi-Fi can join
  server: { host: true },
  preview: { host: true },
});
