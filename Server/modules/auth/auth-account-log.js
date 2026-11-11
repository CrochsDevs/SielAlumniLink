import { authEmail } from './auth.validation.js';

export function maskedAuthEmail(value) {
  const email = authEmail(value);
  if (!email) return undefined;
  const [local, domain] = email.split('@');
  return `${local.slice(0, Math.min(2, local.length - 1))}***@${domain}`;
}

// Explicitly allow only operational identity fields. Never serialize a request,
// account document, provider response, password, OTP, or bearer credential.
export function logAccountAuth(res, { operation, outcome, user, email }) {
  if (!['password_login', 'logout', 'magic_link_send', 'magic_link_verify', 'password_recovery', 'otp_verify', 'password_reset'].includes(operation) ||
      !['processing', 'signed_in', 'signed_out', 'not_eligible', 'delivery_failed', 'accepted_for_delivery', 'session_verified', 'otp_verified', 'password_reset'].includes(outcome)) return;
  try {
    const authId = user?._id == null ? undefined : String(user._id);
    res.locals ||= {};
    res.locals.authAccount = { outcome,
      identityType: ['password_login', 'logout', 'magic_link_verify'].includes(operation) ? 'authenticated' : 'target_account',
      maskedEmail: maskedAuthEmail(email || user?.email),
      ...(authId && /^[a-zA-Z0-9_-]{1,128}$/.test(authId) ? { authId } : {}),
    };
  } catch { /* Diagnostics must never change authentication behavior. */ }
}

// Merge transport diagnostics into the single final request event. The callback
// receives only fixed provider/status/error categories, never email content.
export const authDeliveryContext = res => ({ onDelivery: delivery => {
  res.locals ||= {};
  res.locals.authDelivery = delivery;
} });
