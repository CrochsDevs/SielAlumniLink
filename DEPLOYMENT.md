# Render deployment with Safari sessions

Security rollout: see SECURITY_REVIEW.md before deploying the 11 November 2026
authentication hardening. Production startup now requires a cryptographically
random JWT_SECRET of at least 32 UTF-8 bytes and an explicit HTTPS FRONTEND_URL
origin. Rotate exposed credentials first. Changing JWT_SECRET logs out existing
sessions; old magic links/OTPs must be requested again after the storage upgrade.
New passwords require at least 15 characters and at most 72 UTF-8 bytes.
Use `npm run test:security --prefix Server` for isolated security regressions.

When service URL overrides are unset, production React requests `/api` and
`/socket.io` on the current page's origin.
Serve the built client from the Node server so Safari does not need third-party
cookies. `SameSite=None; Secure` alone cannot bypass Safari's cookie blocking.

Use a **Node Web Service**, with the repository root as the service root:

- Build command: `npm ci --prefix Server && npm ci --prefix Client --include=dev && npm run build --prefix Client`
- Start command: `npm start --prefix Server`
- Environment: `NODE_ENV=production`, `SERVE_CLIENT=true`, `COOKIE_SAME_SITE=lax`
- Set `FRONTEND_URL` to the exact public origin of this Web Service (no trailing slash).
- Keep the existing server database, JWT, email, Cloudinary and integration secrets on this service.

For this combined deployment, set build-time `VITE_API_URL=/api` and
`VITE_SOCKET_URL=/` so HTTP and WebSocket sessions use the page's origin.
These environment values override the split-hosting URLs in
`Client/.env.production`.

## Existing separate frontend and API services

Keep the current deployment working before migrating:

- `Client/.env.production` supplies the current public service URLs. If Render
  defines the same variables, make sure they match because Render overrides the file:
  `VITE_API_URL=https://siel-alumni-link-api.onrender.com/api` and
  `VITE_SOCKET_URL=https://siel-alumni-link-api.onrender.com`.
- Keep backend `FRONTEND_URL` equal to the frontend origin and
  `COOKIE_SAME_SITE=none` on HTTPS while services are cross-site.
- Rebuild/redeploy the frontend after changing `VITE_*` values; they are compiled
  into the bundle and cannot be changed by restarting the backend.

These explicit URLs take precedence in development and production. Without an
API URL, a Static Site's SPA rewrite may return HTML for `/api/auth/me`, which
prevents login. Confirm this endpoint returns JSON from the API service.

Restoring split-service URLs does not resolve Safari third-party cookie blocking.
Use combined hosting above (or an actual same-origin reverse proxy for both API
and WebSocket requests) to resolve that issue without changing browser settings.

If `sielalumnilink.onrender.com` currently belongs to a Static Site, that service
cannot run the Node server. Move the public hostname to the combined Web Service
using Render's service/domain settings, or use the new Web Service URL and set
`FRONTEND_URL` accordingly. A client-only redeploy to the old Static Site will
not apply this fix: `/api` must reach the Node server, not the SPA rewrite.
Do not delete an existing service until the replacement is working and its
required secrets and integrations have been checked.

Verify on Safari with its normal tracking prevention enabled:

1. Open `/login`; it should show the form without a dashboard skeleton.
2. Sign in. `/api/auth/login` and the subsequent `/api/auth/me` must use the
   exact same origin as the page. The session cookie stays HttpOnly and Secure.
3. Open the dashboard, refresh, and open another tab; the session should persist.
4. Confirm chat connects at the same origin, then log out and refresh a protected
   URL to check it returns to login.

Local development stays unchanged: start the Vite client and API separately.
The API-only mode also remains available when `SERVE_CLIENT` is unset.

## Single-use login links

The same `VITE_API_URL` serves password login, `/auth/magic-link/send`, and
`/auth/magic-link/verify`. A frontend HTML response from these API requests means
the bundle is pointing at the Static Site instead of the API. Deploy the updated
production configuration before requesting a new link.

On the backend, set `FRONTEND_URL=https://sielalumnilink.onrender.com` so emailed
links open the public frontend verification page. The generated token expires
after 15 minutes; requesting a new link invalidates previous links. A successful
verification consumes the link even if the browser later blocks the session
cookie. Request a fresh link after correcting deployment or cookie issues.

If emails do not arrive, check backend email delivery logs and provider settings.
Use the Brevo HTTPS API on Render Free. SMTP ports 25, 465, and 587 are blocked
on free web services (https://render.com/docs/free). A generic HTTP 200 send
response intentionally does not disclose account existence or delivery status.

### Brevo setup for Render Free

1. Create a free account at https://www.brevo.com/ and complete the account
   information/transactional sending activation requested by Brevo.
2. In account settings, open **Senders, Domains & Dedicated IPs > Senders**
   (menu wording may vary). Add the name `SielAlumni` and the sender email you
   control. Complete email verification. Account sending approval and sender
   verification are separate; both must be ready before production sending.
3. Prefer your own authenticated sending domain with DKIM/DMARC when available.
   For a public Gmail sender, Brevo cannot authenticate gmail.com and may replace
   the From address with a Brevo sending domain. This is a provider workaround,
   not a promise of permanent support or inbox delivery. Follow any sender/domain
   requirements Brevo presents. See
   https://help.brevo.com/hc/en-us/articles/16045394674066-Troubleshooting-Domain-authentication.
4. Open **SMTP & API > API Keys** and create a dedicated backend API key. Grant
   only the transactional sending permissions needed where supported. Use an
   **API key**, not an SMTP password. Keep account 2FA and API IP protections
   enabled; authorize the actual Render outbound addresses if Brevo blocks them.
5. On the backend Render service `siel-alumni-link-api`, add:

```text
EMAIL_PROVIDER=brevo
EMAIL_USER=<the exact verified sender email>
BREVO_API_KEY=<your private Brevo API key>
FRONTEND_URL=https://sielalumnilink.onrender.com
```

Do not put these credentials in the frontend, VITE variables, Git, screenshots,
or chat. No Google OAuth client, refresh token, or Gmail App Password is required
for Brevo. Revoke credentials exposed during earlier setup. Old Google variables
and EMAIL_PASS can be removed from the production backend after switching.

6. Deploy the backend code together with these environment settings. Changing
   variables on an older SMTP-only deployment will not enable Brevo.
7. Request one fresh link for a registered account. Backend logs should show
   `Authentication email accepted for delivery (brevo)`. Confirm the message is
   delivered in **Brevo > Transactional > Logs**, then check Inbox/Spam and finish
   sign-in. An API acceptance is not proof of inbox delivery. Retry/reuse of an
   already consumed token must fail. Also verify the password-reset OTP flow.

The free plan includes 300 emails/day, shared by login and password-reset sends.
After this allowance, Brevo may queue transactional mail, which can outlive a
15-minute login link or 10-minute OTP. Monitor credits and delivery events; do
not assume queued emails will still be usable. See
https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan.

The transport uses the fixed HTTPS endpoint https://api.brevo.com/v3/smtp/email,
rejects redirects, aborts after 12 seconds, and never automatically retries or
falls back to SMTP. Logs contain fixed failure categories only: EAUTH for API
permission/key/IP rejection, ERATELIMIT for HTTP 429, EREQUEST for other client
rejections (check verified sender/credits/activation in Brevo), EPROVIDER for
5xx, ETIMEDOUT for deadline expiry, and EDELIVERY for unconfirmed acceptance or
network errors. It never logs provider response bodies, recipients, OTPs, links,
or API keys. Errors keep the existing account-enumeration-safe auth responses.

Brevo receives recipient addresses and email bodies as the delivery processor.
Restrict access to transactional logs, which may contain sensitive email content.
The request asks Brevo to remove the recipient tracking pixel. Click rewriting
can still depend on Brevo account settings; do not assume this API call disables
it. Check actual delivered messages and the available account tracking controls.
The server transmits the original login URL and does not add analytics parameters.
For Brevo HTML emails, the seal loads from the public frontend
`/clsu_favicon.png`; SMTP keeps its local CID attachment. No public homepage or
Google Branding setup is needed for this Brevo integration, though Brevo can
require account/business verification.

Gmail SMTP remains an explicit local option: `EMAIL_PROVIDER=smtp`, `EMAIL_USER`,
and `EMAIL_PASS` (Gmail App Password). With no provider selected the transport
keeps its existing SMTP default. On Render Free, explicitly select `brevo`.

### HTTP 429 and CORS diagnostics

The app limits link sends to one per email per minute and ten per IP per minute.
Login shows a resend countdown and reads `Retry-After` on app-generated 429s.
When a cross-origin response has no CORS headers, the browser cannot reveal its
status to JavaScript; the app therefore shows a temporary email-request failure
and waits one minute before another send instead of claiming the backend is down.

Filter backend Render Logs by `auth.request`. Each relevant request logs
`received` and `finished` (or `closed`) with an opaque request ID, operation,
status, and duration. It never logs bodies, query strings, email addresses, IPs,
cookies, passwords, codes, or tokens. Email acceptance/failure is a separate event;
an HTTP 200 from a generic send response is not proof of delivery.

Successful password and magic-link logins also emit `auth.account`; password
recovery emits `auth.recovery`. These outcome events include `maskedEmail`
(for example `le***@gmail.com`), the account `authId` when resolved, and the
request ID. General request logs still exclude bodies, credentials, full emails
and IPs. Use the admin Audit Logs for full successful-login identity records.

App-generated 429s retain CORS and expose `Retry-After` and `X-Request-Id`. If the
failed request has no corresponding `received` event, investigate Render's edge,
proxy, or browser/network blocking. Application CORS changes cannot modify a
response produced before the request reaches Express.

If `forwardedAddressPresent=true` and `proxyConfigured=false`, verify the actual
Render proxy chain and configure `TRUST_PROXY` with its trusted IP/CIDR ranges.
Without it, requests may share a proxy IP bucket. Never blindly trust all
`X-Forwarded-For` headers or disable rate limits to bypass a 429.
