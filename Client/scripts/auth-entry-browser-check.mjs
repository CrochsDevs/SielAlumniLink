import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import express from '../../Server/node_modules/express/index.js';
import { serveClient } from '../../Server/config/client-app.js';
import { chromium, webkit } from '../node_modules/.search-validation/node_modules/playwright/index.mjs';

// Test the actual production build and first-party cookie jar, without live accounts.
const user = { _id: 'fixture-profile', authId: 'fixture-auth', role: 'student', name: 'Safari Fixture', email: 'fixture@example.test', passwordSetupRequired: false };
const app = express();
app.use(express.json());
let saveCookie = true, discoveryGate = Promise.resolve();
app.post('/api/auth/login', (_req, res) => {
  if (saveCookie) res.cookie('fixture-session', 'signed-in', { httpOnly: true, sameSite: 'lax' });
  res.json({ success: true, data: { user } });
});
app.use('/api', async (req, res) => {
  if (req.path === '/auth/me') await discoveryGate;
  const signedIn = req.headers.cookie?.includes('fixture-session=signed-in');
  let data = [];
  if (['/auth/me', '/users/me'].includes(req.path)) data = signedIn ? user : null;
  else if (!signedIn) return res.status(401).json({ success: false });
  else if (req.path === '/development/me') data = { portfolio: {}, internships: [] };
  else if (['/feed', '/feed/stories'].includes(req.path)) data = { posts: [], nextCursor: null };
  else if (req.path === '/feed/status') data = { restricted: false };
  else if (req.path === '/notifications/unread-count') data = { count: 0 };
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, data });
});
serveClient(app);
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const engines = [['Edge', chromium, { channel: 'msedge' }]];
if (existsSync(webkit.executablePath())) engines.push(['WebKit', webkit, {}]);
else console.log('WebKit runtime unavailable; real Safari verification remains a deployment check.');

try {
  for (const [name, engine, options] of engines) {
    const browser = await engine.launch({ headless: true, ...options });
    const errors = [];
    try {
      for (const initialPath of ['/', '/login']) {
        let release;
        discoveryGate = new Promise(resolve => { release = resolve; });
        const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
        await context.routeWebSocket('**/socket.io/**', socket => socket.close());
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        try {
          await page.goto(origin + initialPath);
          if (initialPath === '/') await page.locator('.graduation-cap-loader').waitFor();
          else await page.locator('input[name="email"]').waitFor();
          assert.equal(await page.locator('.siel-page-skeleton').count(), 0);
          release();
          await page.waitForURL('**/login');
          await page.locator('input[name="email"]').waitFor();
          assert.equal(await page.locator('.siel-page-skeleton').count(), 0);
          console.log(`PASS ${name}: ${initialPath} -> login without dashboard skeleton`);
        } finally { release(); await context.close(); }
      }
      discoveryGate = Promise.resolve();
      for (const retainsCookie of [true, false]) {
        saveCookie = retainsCookie;
        const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
        await context.routeWebSocket('**/socket.io/**', socket => socket.close());
        const page = await context.newPage();
        const requests = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('request', request => { if (request.url().includes('/api/')) requests.push(request.url()); });
        try {
          await page.goto(origin + '/login');
          await page.getByRole('button', { name: 'Use password instead', exact: true }).click();
          await page.locator('input[name="email"]').fill(user.email);
          await page.locator('input[name="password"]').fill('Fixture-password');
          await page.getByRole('button', { name: 'Log in with email', exact: true }).click();
          if (retainsCookie) {
            await page.waitForURL('**/student');
            await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor();
            assert.equal((await context.cookies()).find(cookie => cookie.name === 'fixture-session')?.httpOnly, true);
            await page.reload();
            await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor();
            assert.equal(new URL(page.url()).pathname, '/student');
            console.log(`PASS ${name}: same-origin login reaches dashboard and survives refresh`);
          } else {
            await page.getByText('Your sign-in session could not be saved. Please reload the page and try again.', { exact: true }).waitFor();
            assert.equal(new URL(page.url()).pathname, '/login');
            assert.equal(await page.locator('.member-workspace').count(), 0);
            console.log(`PASS ${name}: missing cookie shows an error without dashboard/login loop`);
          }
          assert.ok(requests.length > 0);
          assert.ok(requests.every(url => new URL(url).origin === origin));
        } finally { await context.close(); }
      }
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }
} finally { await new Promise(resolve => server.close(resolve)); }
