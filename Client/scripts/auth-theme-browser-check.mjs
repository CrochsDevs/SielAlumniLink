import { chromium } from '../node_modules/.search-validation/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const role of ['student', 'alumni', 'admin']) {
    const context = await browser.newContext({ colorScheme: 'dark' });
    await context.addInitScript(() => localStorage.setItem('theme', 'dark'));
    await context.routeWebSocket('**/socket.io/**', socket => socket.close());
    let signedIn = true;
    await context.route('**/api/**', route => {
      const endpoint = new URL(route.request().url()).pathname.replace('/api', '');
      if (endpoint === '/auth/me' && !signedIn) return route.fulfill({ status: 401, json: { success: false } });
      const profile = { _id: '000000000000000000000001', authId: '000000000000000000000002', name: 'Theme Fixture', email: 'theme@example.test', role, passwordSetupRequired: false };
      const data = ['/auth/me', '/users/me'].includes(endpoint) ? profile
        : endpoint === '/notifications/unread-count' ? { count: 0 }
        : endpoint === '/tracer/access' ? { updateRequired: false, quarter: '2026-Q4', nextUpdateAt: '2027-01-01T00:00:00Z' } : [];
      return route.fulfill({ json: { success: true, data } });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const workspace = `/${role}/${role === 'admin' ? 'settings' : 'accounts'}`;
    await page.goto(`http://127.0.0.1:5173${workspace}`);
    await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
    // Navigate without a reload to verify the route scope changes immediately.
    await page.evaluate(() => { history.pushState(null, '', '/login'); dispatchEvent(new PopStateEvent('popstate')); });
    await page.locator('.login-page').waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), false);
    assert.equal(await page.evaluate(() => localStorage.getItem('theme')), 'dark');
    await page.evaluate(async () => { const { setTheme } = await import('/src/lib/theme.js'); setTheme('system'); });
    await page.emulateMedia({ colorScheme: 'light' });
    await page.emulateMedia({ colorScheme: 'dark' });
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), false);
    await page.evaluate(async () => { const { setTheme } = await import('/src/lib/theme.js'); setTheme('dark'); });
    await page.goBack();
    await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
    for (const path of ['/login', '/forgot-password']) {
      await page.goto(`http://127.0.0.1:5173${path}`);
      await page.locator(path === '/login' ? '.login-page' : '.password-recovery').waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), false);
    }
    signedIn = false;
    await page.goto('http://127.0.0.1:5173/login');
    await page.locator('.login-page').waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), false);
    assert.equal(await page.evaluate(() => localStorage.getItem('theme')), 'dark');
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`${role}: light authentication pages, saved theme preservation, OS changes, and workspace restoration passed`);
  }
} finally { await browser.close(); }
