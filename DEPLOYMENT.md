# Render deployment with Safari sessions

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
The current Gmail SMTP transport requires outbound SMTP access; Render Free
web services block ports 25, 465, and 587. See https://render.com/docs/free.
The generic send response intentionally does not disclose whether an account
exists or whether email delivery succeeded.
