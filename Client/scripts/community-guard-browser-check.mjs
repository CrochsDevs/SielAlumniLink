import assert from 'node:assert/strict';
import path from 'node:path';
import express from '../../Server/node_modules/express/index.js';
import { serveClient } from '../../Server/config/client-app.js';
import { chromium } from '../node_modules/.search-validation/node_modules/playwright/index.mjs';

// Exercise initial anonymous rendering and failed/null community responses in
// the actual built app, without using real accounts or changing the database.
const app = express();
serveClient(app, path.resolve('dist'));
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const user = { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', authId: 'bbbbbbbbbbbbbbbbbbbbbbbb', role: 'admin', name: 'Guard Tester' };
const reportId = 'cccccccccccccccccccccccc';
let browser;
try {
  browser = await chromium.launch({ headless: true, channel: 'msedge' });
  for (const scenario of ['anonymous', 'missing endpoint', 'null response', 'legacy report link']) {
    const context = await browser.newContext();
    const errors = [];
    await context.routeWebSocket('**/socket.io/**', socket => socket.close());
    await context.route('**/api/**', async route => {
      const pathname = new URL(route.request().url()).pathname;
      let status = 200, data = [];
      if (pathname === '/api/auth/me' || pathname === '/api/users/me') {
        await new Promise(resolve => setTimeout(resolve, 100));
        status = scenario === 'anonymous' ? 401 : 200;
        data = status === 200 ? user : null;
      } else if (pathname === '/api/community/me') {
        if (scenario === 'missing endpoint') status = 404;
        if (scenario === 'null response') return route.fulfill({ status: 200, json: null });
        data = { restrictions: [], cases: [] };
      } else if (pathname === '/api/community/admin/stats') data = { provider: { configured: false } };
      else if (pathname === '/api/community/admin/cases') data = { cases: [], nextCursor: null };
      else if (pathname === '/api/notifications/unread-count') data = { count: 0 };
      await route.fulfill({ status, json: { success: status === 200, data } });
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(origin + (scenario === 'anonymous' ? '/login' : scenario === 'legacy report link' ? `/admin/feed?report=${reportId}` : '/admin/post-reports'));
      if (scenario === 'anonymous') await page.locator('input[type="email"]').first().waitFor();
      else {
        await page.getByRole('heading', { name: 'Community Moderation Center', exact: true }).waitFor();
        assert.equal(new URL(page.url()).pathname, '/admin/community');
        assert.equal(await page.getByRole('link', { name: 'Post Reports', exact: true }).count(), 0);
      }
      if (scenario === 'legacy report link') {
        assert.equal(new URL(page.url()).pathname, '/admin/community');
        assert.equal(new URL(page.url()).searchParams.get('report'), reportId);
      }
      assert.deepEqual(errors, []);
      console.log(`Passed: ${scenario}`);
    } finally {
      await context.unrouteAll({ behavior: 'ignoreErrors' });
      await context.close();
    }
  }
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
