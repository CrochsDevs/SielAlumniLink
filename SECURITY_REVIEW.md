# Security review — 11 November 2026

## Assessment

The reviewed system is **not yet cleared for production security**. The source
has working authentication and role boundaries, and the fixes below pass local
regression checks. Production still needs credential rotation, configuration
verification, database-backed integration checks, and real Safari validation.
Deployment and runtime verification are separate from committing/pushing these
audit fixes. Confirm the actual Render deployment and required settings below.

## Scope and method

- Reviewed Express route guards and representative controller/service ownership
  checks across users, auth/recovery, messages/attachments, connections, feed,
  events/meetings/certificates, jobs/applications/referrals, surveys, tracer,
  mentorship/development, notifications, reports, and activity.
- Reviewed JWT purpose/issuer/audience/algorithm checks, cookie configuration,
  origin/CSRF checks, revocation, disabled-account behavior, OTP and magic-link
  storage, expiry, atomic consumption, rate limits, Brevo transport, uploads,
  HTML sanitization, and frontend credential handling.
- Scanned 574 currently tracked files for selected credential patterns without
  emitting any values. No matches were found. This does not scan the complete
  Git history, every possible secret format, ignored backups, or malware.
- Read local configuration only as redacted boolean checks. Render, Brevo and
  Atlas account settings are not accessible from this workspace.
- Made four unauthenticated GET requests to the production API; no credentials,
  login attempts, real email requests, or production database writes were used.

## Findings and fixes

| Priority | Finding | Status |
| --- | --- | --- |
| High | SMTP passwords, an OAuth client secret and Brevo keys were exposed in conversation/screenshots. | External action required: revoke exposed credentials, create replacements and update both local/backend Render settings. Rotation cannot be confirmed here. |
| High | The local JWT signing secret is shorter than 32 bytes. Its actual value was never printed. Render's secret strength is unknown. | Added production startup validation requiring at least 32 UTF-8 bytes and an explicit HTTPS frontend origin. Generate a cryptographically random replacement before deployment. Length alone does not prove entropy. |
| High, conditional on database read access | Magic-link bearer credentials were stored in plaintext. A database-only disclosure could reveal a usable login link. | Fixed: store only SHA-256 hashes of random 256-bit tokens. Token claim checks expiry and single use in the same atomic update. Added hash lookup/uniqueness and expiry TTL indexes for startup. Legacy plaintext-token records are not accepted. |
| High, conditional on database read access | Six-digit reset OTPs were stored in plaintext. | Fixed: store an account-bound HMAC-SHA-256 digest using the server signing secret, rather than a brute-forceable unkeyed hash. Retained five-guess lockout, expiry, atomic exchange, and conditional failed-delivery cleanup. Legacy raw OTPs are not accepted. |
| Medium | New-password endpoints accepted weak/unbounded inputs; bcrypt silently truncates inputs after 72 UTF-8 bytes. Some malformed values reached hashing/error paths. | Fixed: require strings, at least 15 Unicode code points, and at most 72 UTF-8 bytes before hashing. Updated setup, recovery, and student/alumni/admin password forms. Existing passwords still work; this does not retroactively strengthen them. |
| Medium | Authenticated password changes lacked the shared account/IP attempt limiter. | Fixed: setup/change routes share a change limiter. Account identity comes from the authenticated user, not a caller-supplied email. |
| Medium | Origin validation was skipped for lax/strict cookie configurations. | Fixed: reject foreign unsafe request origins in every cookie mode. CORS is not treated as the CSRF boundary. |
| Medium | Legacy error handlers could return database/provider exception messages; parser errors could render default Express error output. | Fixed: generic auth failures, a global parser/unhandled-error response, and API middleware stripping message/data from 5xx JSON responses. Expected 4xx validation responses remain available. |
| Medium | API responses lacked consistent cache, referrer and framing hardening. | Fixed: private/no-store API responses, nosniff, anti-framing headers, no-referrer, production HSTS and a limited CSP for framing/object/base restrictions. This is not a full script-source CSP. Separate Render Static Site headers still require dashboard configuration. |
| Medium | A magic-link token remained in browser URLs after failed verification and could be sent in referrers. | Fixed: an early no-referrer HTML meta tag also covers separate static hosting; capture the token in memory and remove it from browser history before verification. The initial email URL/API GET still contains the token, so provider/platform access to URL logs must remain restricted. |
| Moderate dependency advisory | nodemon 3.1.14 pulled affected minimatch 10.x (GHSA-g3hv-75wg-m249). This was development-only. | Fixed: pin the compatible nodemon 3.1.11 release recommended by npm audit. Lockfile updated, no install scripts executed. Development runner version check passes. |

## Verified controls

- Passwords are bcrypt hashes; session cookies are HttpOnly and production Secure.
- JWT verification restricts algorithm, issuer, audience, expiry and session
  purpose. Password-reset credentials and legacy/general JWTs cannot authenticate.
- Session-version changes revoke HTTP/WebSocket access after logout, credential
  changes, deletion, and relevant account changes. Disabled identities stay disabled.
- Public signup is closed. Imported users cannot choose an admin role.
- Account/email/IP attempt counters are shared in MongoDB and fail closed on
  storage failure. Recovery responses do not disclose delivery/account eligibility.
- Message, application, feed-image and certificate paths check membership,
  ownership or role. Rich HTML rendering uses DOMPurify with a tag/URI allowlist.
- Brevo credentials remain server-side; the transport uses a fixed HTTPS
  endpoint, rejects redirects, has a hard deadline and never automatically retries
  sensitive mail or prints provider bodies/tokens/keys.

These are properties of the reviewed paths and tests, not proof that no other
vulnerability exists anywhere in the product or its providers.

## Validation

- **320 passing regression tests across 45 files**: 291 in the final isolated
  43-file run plus 29 feed/presence checks run separately. The initial broad run
  reached four tests backed by MongoDB and failed to connect to the deliberately
  unavailable local fixture server; those failures are environment limitations,
  not passing coverage. Ten database-backed test files remain unvalidated against
  a real isolated database. No tests connected to Atlas production data.
- `npm run test:security` in Server: **79 passed, zero failed**. These overlap
  with the broad regression count and must not be added to it.
- **10 Edge browser scenarios passed** against a local production-build fixture:
  root/direct login, password/session refresh, missing cookie, magic-link send,
  existing-user/setup/expired/missing-cookie verification, and resend cooldowns.
  Assertions also cover token removal and frontend no-referrer behavior. No real
  email or live accounts were used. WebKit runtime is unavailable, so this is not
  a real Safari test.
- Frontend production build passed. The dedicated setup/reset/verification and
  password-policy files pass ESLint. The broader changed-file lint run reports
  two existing issues: admin Settings setState-in-effect and an alumni Accounts
  unused Icon binding. They are outside the security edits and remain unresolved.
- Current npm audits: **Client 0, Server 0 reported vulnerabilities**. Audit
  metadata covers 428 frontend and 158 backend dependency entries; zero known
  advisories is not a malware or future-vulnerability guarantee.
- Selected-pattern scan found no credentials in current tracked source. Only
  public Client/.env.production and placeholder Server/.env.example are tracked;
  local .env files are ignored.
- Read-only production checks: `/api/auth/me` returned 200 with null session;
  `/api/users`, `/api/reports/dashboard`, and `/api/activity` returned 401 without
  credentials. The live deployment did not yet have the new response hardening
  headers, as expected because these changes are not deployed.
- Detailed local outputs: `artifacts/security-review-2026-11-11/`. Those files are
  ignored by Git; no secrets are included in the generated audit summaries.

## Required before deployment

1. Revoke exposed Brevo/SMTP/OAuth credentials. Store a new transactional-send
   API key in Render and local .env; confirm the verified sender and actual Render
   outbound addresses in Brevo. Do not disable API IP protection globally.
2. Generate a fresh signing secret locally, then enter it directly in the backend
   Render environment and local Server/.env. Do not paste it into chat:

   ```powershell
   node -e "process.stdout.write(require('node:crypto').randomBytes(48).toString('hex'))"
   ```

   This generates 48 random bytes encoded as 96 hexadecimal characters. Changing
   JWT_SECRET invalidates all old sessions and outstanding HMAC OTPs. Use
   `NODE_ENV=production` and `FRONTEND_URL=https://sielalumnilink.onrender.com` on
   the existing separate backend. Production startup intentionally refuses a
   missing/short JWT secret or invalid frontend origin.
3. Deploy backend and frontend together. Old emailed login links and reset codes
   must be requested again after this storage change. New passwords require 15
   characters; existing password login remains compatible. Do not restore legacy
   raw-token authentication for migration convenience.
4. Test actual Brevo delivery and token consumption once using an authorized
   account, and complete password reset/sign-in. Generic HTTP 200 is not proof
   of email delivery. Brevo may rewrite Gmail sender addresses or click links;
   inspect actual delivered messages and restrict access to sensitive email logs.
5. Validate Atlas network access rules, database user privileges, backups and
   audit settings in its dashboard. Run the DB-backed suites against a dedicated
   disposable test database, never the production database.
6. Verify the Render proxy chain before setting TRUST_PROXY. Current production
   logs say proxyConfigured=false: IP rate limits may group legitimate users
   behind the same proxy. Do not trust arbitrary forwarded headers to bypass this.
7. Existing separate onrender.com frontend/API hosting still has Safari
   third-party-cookie limitations. Use the same-origin deployment described in
   DEPLOYMENT.md and validate on real Safari with normal tracking prevention.
8. If the frontend stays a Static Site, configure its response headers in Render
   (at least anti-framing and no-referrer); backend headers cannot protect HTML
   served by another service. The HTML referrer meta tag is included in this fix.

## Further work and limits

- Admin MFA/passkeys are not implemented; email-only magic links remain a single
  factor. Existing weak passwords are not automatically upgraded. A breached
  sender/user mailbox can still compromise email-based recovery.
- General-purpose API/upload/WebSocket resource-abuse controls and quota monitoring
  need separate load/security validation. The auth limiter is not a global WAF.
- The verification API is a state-changing GET. Token entropy, single use and
  expiry are enforced, but link-scanner consumption and login-CSRF/account
  confusion merit a deliberate confirmation or bound-login flow in a follow-up.
- Verify JWT key entropy, provider revocation, production TLS/cookies, signed
  attachment behavior and CDN/backup access policies in their actual dashboards.
- This is a source/dependency/isolated-regression review, not an independent
  penetration test, formal certification, complete secret-history scan, or proof
  that every production configuration is secure.

## References

- https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
- https://github.com/dcodeIO/bcrypt.js
- https://github.com/advisories/GHSA-g3hv-75wg-m249
- https://render.com/docs/free
- https://render.com/docs/outbound-ip-addresses
- https://developers.brevo.com/docs/ip-security
