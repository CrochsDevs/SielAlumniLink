const loopback = url => ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
const parseOrigin = value => {
  try {
    const url = new URL(value);
    if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
      && url.pathname === '/' && !url.search && !url.hash) return url;
  } catch { /* Invalid configuration or request origin. */ }
  return null;
};

// Email links come from server configuration. Never trust Host, forwarded-host,
// or arbitrary request Origins when placing a sign-in token in an email.
export function frontendOrigin(env = process.env, requestOrigin) {
  if (env.NODE_ENV === 'production' || env.RENDER === 'true') {
    const production = parseOrigin(env.FRONTEND_URL);
    if (!production || production.protocol !== 'https:' || loopback(production)) {
      throw new Error('Production FRONTEND_URL must be a public HTTPS origin.');
    }
    return production.origin;
  }

  const configured = parseOrigin(env.LOCAL_FRONTEND_URL || env.FRONTEND_URL);
  const local = configured && loopback(configured) ? configured.origin : 'http://localhost:5173';
  // Vite can move to 5174 if 5173 is busy. Only allow known local UI origins.
  const allowed = new Set([local, 'http://localhost:5173', 'http://localhost:5174']);
  return typeof requestOrigin === 'string' && allowed.has(requestOrigin) ? requestOrigin : local;
}
