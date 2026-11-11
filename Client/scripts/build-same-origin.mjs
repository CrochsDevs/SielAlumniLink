// Explicit opt-in for serving React from the existing Node API service.
// Override split-host .env.production and Render build variables together.
process.env.VITE_API_URL = '/api';
process.env.VITE_SOCKET_URL = '/';
const { build } = await import('vite');
await build();
