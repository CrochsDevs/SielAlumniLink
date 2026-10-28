// Vite may use 5174 when its default development port is already occupied.
export const frontendOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  ...(process.env.NODE_ENV === 'production'
    ? []
    : ['http://localhost:5173', 'http://localhost:5174']),
];

// Browser WebSocket handshakes must include an exact configured Origin.
export const allowedSocketOrigin = origin => typeof origin === 'string' && frontendOrigins.includes(origin);
