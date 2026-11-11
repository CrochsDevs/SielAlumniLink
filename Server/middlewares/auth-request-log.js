import { randomUUID } from 'node:crypto';

const operations = new Map([
  ['/api/auth/login', 'password_login'],
  ['/api/auth/logout', 'logout'],
  ['/api/auth/magic-link/send', 'magic_link_send'],
  ['/api/auth/magic-link/verify', 'magic_link_verify'],
  ['/api/auth/forgot-password', 'password_recovery'],
]);

// Deliberately omit URL queries, user identifiers, IPs, bodies, and headers.
export function logAuthRequests(logger = console) {
  return (req, res, next) => {
    const operation = operations.get(req.path.replace(/\/+$/, ''));
    if (!operation || req.method === 'OPTIONS') return next();
    const requestId = randomUUID();
    const started = Date.now();
    const write = fields => {
      try { logger.log(JSON.stringify({ event: 'auth.request', requestId, operation, ...fields })); }
      catch { /* Diagnostics must never prevent authentication. */ }
    };
    res.setHeader('X-Request-Id', requestId);
    write({ phase: 'received', method: req.method,
      forwardedAddressPresent: !!req.headers['x-forwarded-for'],
      proxyConfigured: !!req.app.get('trust proxy') });
    let complete = false;
    const finish = phase => {
      if (complete) return;
      complete = true;
      write({ phase, status: res.statusCode, durationMs: Date.now() - started });
    };
    res.once('finish', () => finish('finished'));
    res.once('close', () => finish('closed'));
    next();
  };
}
