import { authEmail } from './auth.validation.js';

export function maskedAuthEmail(value) {
  const email = authEmail(value);
  if (!email) return undefined;
  const [local, domain] = email.split('@');
  return `${local.slice(0, Math.min(2, local.length - 1))}***@${domain}`;
}

// Explicitly allow only operational identity fields. Never serialize a request,
// account document, provider response, password, OTP, or bearer credential.
export function logAccountAuth(res, { operation, outcome, user, email }, logger = console) {
  if (!['password_login', 'magic_link_verify', 'password_recovery'].includes(operation) ||
      !['signed_in', 'not_eligible', 'delivery_failed', 'accepted_for_delivery'].includes(outcome)) return;
  try {
    const authId = user?._id == null ? undefined : String(user._id);
    logger.log(JSON.stringify({ event: operation === 'password_recovery' ? 'auth.recovery' : 'auth.account',
      operation, requestId: res.getHeader?.('X-Request-Id'), outcome,
      maskedEmail: maskedAuthEmail(email || user?.email),
      ...(authId && /^[a-zA-Z0-9_-]{1,128}$/.test(authId) ? { authId } : {}),
    }));
  } catch { /* Diagnostics must never change authentication behavior. */ }
}
