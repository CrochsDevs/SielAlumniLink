// Render frontend/API services are separate sites. Cross-site cookies require HTTPS.
export function sessionCookieOptions({ persistent = true } = {}) {
  const production = process.env.NODE_ENV === 'production';
  const sameSite = (process.env.COOKIE_SAME_SITE || (production ? 'none' : 'strict')).toLowerCase();
  if (!['strict', 'lax', 'none'].includes(sameSite)) throw new Error('COOKIE_SAME_SITE must be strict, lax, or none.');
  return {
    httpOnly: true,
    secure: production || sameSite === 'none',
    sameSite,
    path: '/',
    ...(persistent ? { maxAge: 7 * 24 * 60 * 60 * 1000 } : {}),
  };
}

// CORS alone does not stop form submissions. Validate origins when the cookie
// is allowed cross-site, including anonymous login requests (login CSRF).
export function protectSessionOrigin(allowedOrigins) {
  const allowed = new Set(allowedOrigins.map(value => new URL(value).origin));
  return (req, res, next) => {
    if (sessionCookieOptions().sameSite !== 'none' || ['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.headers.origin;
    let refererOrigin;
    try { if (req.headers.referer) refererOrigin = new URL(req.headers.referer).origin; } catch { /* Invalid references are untrusted. */ }
    const requestOrigin = origin || refererOrigin;
    if (requestOrigin ? allowed.has(requestOrigin) : !req.cookies?.token && !['cross-site', 'same-site'].includes(req.headers['sec-fetch-site'])) return next();
    return res.status(403).json({ success: false, message: 'Request origin is not allowed.' });
  };
}
