import { randomUUID } from 'node:crypto';
import { maskedAuthEmail } from '../modules/auth/auth-account-log.js';

const operations = new Map([
  ['/api/auth/login', 'password_login'],
  ['/api/auth/logout', 'logout'],
  ['/api/auth/magic-link/send', 'magic_link_send'],
  ['/api/auth/magic-link/verify', 'magic_link_verify'],
  ['/api/auth/forgot-password', 'password_recovery'],
  ['/api/auth/verify-otp', 'otp_verify'],
  ['/api/auth/reset-password', 'password_reset'],
  ['/api/auth/password/setup', 'password_setup'],
  ['/api/auth/password/change', 'password_change'],
  ['/api/auth/signup', 'signup'],
]);

// Emit exactly once at completion/close. Never trust a submitted email as proof
// of authentication, and never include raw bodies, queries, cookies, or IPs.
export function logAuthRequests(logger = console) {
  return (req, res, next) => {
    const operation = operations.get(req.path.replace(/\/+$/, ''));
    if (!operation || req.method === 'OPTIONS') return next();
    const requestId = randomUUID();
    const started = Date.now();
    const json = res.json;
    res.json = function (body) {
      if (body?.success === false) this.locals.authRejected = true;
      return json.call(this, body);
    };
    const write = fields => {
      try { logger.log(JSON.stringify({ event: 'auth.request', requestId, operation, ...fields })); }
      catch { /* Diagnostics must never prevent authentication. */ }
    };
    res.setHeader('X-Request-Id', requestId);
    let complete = false;
    const finish = phase => {
      if (complete) return;
      complete = true;
      const submitted = maskedAuthEmail(req.body?.email);
      const identity = res.locals?.authAccount || (req.user ? {
        maskedEmail: maskedAuthEmail(req.user.email), authId: String(req.user._id), identityType: 'authenticated',
      } : { maskedEmail: submitted, identityType: submitted ? 'submitted' : 'unknown' });
      const outcome = phase === 'closed' ? 'connection_closed'
        : res.statusCode === 429 ? 'rate_limited' : res.statusCode >= 500 ? 'server_error'
          : res.statusCode >= 400 || res.locals?.authRejected ? 'rejected' : identity.outcome || 'completed';
      write({ ...identity, outcome, ...res.locals?.authDelivery, phase, method: req.method,
        status: res.statusCode, durationMs: Date.now() - started });
    };
    res.once('finish', () => finish('finished'));
    res.once('close', () => finish('closed'));
    next();
  };
}
