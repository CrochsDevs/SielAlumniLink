export function validateProductionSecurity(env = process.env) {
  if (env.NODE_ENV !== 'production') return;
  if (typeof env.JWT_SECRET !== 'string' || Buffer.byteLength(env.JWT_SECRET, 'utf8') < 32) {
    throw new Error('Production JWT_SECRET must contain at least 32 bytes. Generate a fresh cryptographically random secret.');
  }
  let frontend;
  try { frontend = new URL(env.FRONTEND_URL); } catch { /* Invalid production origin. */ }
  if (!frontend || frontend.protocol !== 'https:' || frontend.username || frontend.password ||
      frontend.pathname !== '/' || frontend.search || frontend.hash) {
    throw new Error('Production FRONTEND_URL must be an HTTPS origin without credentials, paths, query strings, or fragments.');
  }
}
