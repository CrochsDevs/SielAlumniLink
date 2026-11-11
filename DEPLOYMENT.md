# Render deployment with Safari sessions

Production React requests `/api` and `/socket.io` on the current page's origin.
Serve the built client from the Node server so Safari does not need third-party
cookies. `SameSite=None; Secure` alone cannot bypass Safari's cookie blocking.

Use a **Node Web Service**, with the repository root as the service root:

- Build command: `npm ci --prefix Server && npm ci --prefix Client --include=dev && npm run build --prefix Client`
- Start command: `npm start --prefix Server`
- Environment: `NODE_ENV=production`, `SERVE_CLIENT=true`, `COOKIE_SAME_SITE=lax`
- Set `FRONTEND_URL` to the exact public origin of this Web Service (no trailing slash).
- Keep the existing server database, JWT, email, Cloudinary and integration secrets on this service.

`VITE_API_URL` and `VITE_SOCKET_URL` are used only during local development.
Production always uses the page's origin for both HTTP and WebSocket sessions.

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
