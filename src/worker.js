// Christmas Hunt Game - Cloudflare Worker with Durable Objects

export { GameRoom } from './gameroom.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Serve static assets
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return env.ASSETS.fetch(request);
    }

    // WebSocket connection to game room
    if (url.pathname === '/ws') {
      const roomId = url.searchParams.get('room') || 'main';
      const id = env.GAME_ROOM.idFromName(roomId);
      const room = env.GAME_ROOM.get(id);
      return room.fetch(request);
    }

    // API endpoints
    if (url.pathname === '/api/rooms') {
      // Return active rooms (simplified for now)
      return new Response(JSON.stringify({ rooms: ['main'] }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fallback to static assets
    return env.ASSETS.fetch(request);
  }
};
