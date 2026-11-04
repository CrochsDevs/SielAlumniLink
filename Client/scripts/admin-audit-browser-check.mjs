import { chromium } from '../node_modules/.search-validation/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const admin = { _id: '000000000000000000000001', authId: '000000000000000000000001', role: 'admin', name: 'Admin Tester', email: 'admin@example.test', passwordSetupRequired: false };
const logs = [...Array.from({ length: 14 }, (_, index) => ({
  _id: `log-${index}`, authId: `member-${index}`, email: `member${index}@example.test`,
  role: index % 2 ? 'alumni' : 'student', action: index % 2 ? 'logout' : 'login',
  createdAt: new Date(Date.UTC(2026, 10, 4, 1, 0, 14 - index)).toISOString(),
})),
  { _id: 'admin-login', authId: admin.authId, email: admin.email, role: 'admin', action: 'login', createdAt: new Date().toISOString() },
  { _id: 'admin-action', email: admin.email, actor: { role: 'admin' }, action: 'post_blocked', createdAt: new Date().toISOString() },
];
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 } });
    await context.routeWebSocket('**/socket.io/**', socket => socket.close());
    let failure = false;
    const writes = [], limits = [], requests = [];
    await context.route('**/api/**', route => {
      const req = route.request(), url = new URL(req.url()), endpoint = url.pathname.replace('/api', '');
      requests.push(endpoint);
      if (!['GET', 'OPTIONS'].includes(req.method())) writes.push(endpoint);
      let data = [];
      if (['/auth/me', '/users/me'].includes(endpoint)) data = admin;
      else if (endpoint === '/users') data = [admin]; // Admin identity exists but is excluded from user audit records.
      else if (endpoint === '/activity') {
        limits.push(url.searchParams.get('limit'));
        if (failure) return route.fulfill({ status: 500, json: { success: false, message: 'Audit refresh unavailable' } });
        data = logs;
      } else if (endpoint === '/notifications/unread-count') data = { count: 0 };
      return route.fulfill({ json: { success: true, data } });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5173/admin/users');
    await page.getByPlaceholder('Search name or email...').waitFor();
    assert.equal(await page.getByRole('button', { name: /^Audit Logs/ }).count(), 0);
    assert.equal(await page.getByRole('table', { name: 'Audit logs', exact: true }).count(), 0);
    const userRequests = requests.filter(endpoint => endpoint === '/users').length;
    if (mobile) await page.getByRole('button', { name: 'Open sidebar', exact: true }).click();
    await page.getByRole('link', { name: 'Audit Logs', exact: true }).click();
    assert.ok(page.url().endsWith('/admin/audit-logs'));
    await page.locator('a[href="/admin/audit-logs"][aria-current="page"]').waitFor({ state: 'attached' });
    assert.equal(await page.getByRole('link', { name: 'Audit Logs', exact: true }).getAttribute('aria-current'), 'page');
    const table = page.getByRole('table', { name: 'Audit logs', exact: true });
    await table.locator('tbody tr').nth(9).waitFor();
    assert.equal(requests.filter(endpoint => endpoint === '/users').length, userRequests);
    assert.equal(await page.getByText('Total Users', { exact: true }).count(), 0);
    assert.equal(await table.getByRole('columnheader').count(), 4);
    assert.equal(await page.getByRole('heading', { name: 'Audit Logs', exact: true }).count(), 1);
    assert.equal(await table.getByRole('columnheader', { name: 'Details', exact: true }).count(), 0);
    await table.locator('tbody tr').nth(0).locator('td').nth(2).getByText('member0@example.test', { exact: true }).waitFor();
    await table.locator('tbody tr').nth(1).locator('td').nth(2).getByText('member1@example.test', { exact: true }).waitFor();
    assert.equal(await table.getByText('Own account', { exact: true }).count(), 0);
    assert.equal(await table.getByText(admin.email, { exact: true }).count(), 0);
    await page.getByLabel('Event type', { exact: true }).selectOption('login');
    assert.equal(await table.locator('tbody tr').count(), 7);
    await page.getByLabel('Event type', { exact: true }).selectOption('logout');
    assert.equal(await table.locator('tbody tr').count(), 7);
    await page.getByLabel('Event type', { exact: true }).selectOption('all');
    const search = page.getByLabel('Search audit logs', { exact: true });
    await search.fill('member13@example.test');
    await table.getByText('member13@example.test', { exact: true }).first().waitFor();
    assert.equal(await table.locator('tbody tr').count(), 1);
    await search.fill('no match');
    await table.getByText('No matching audit logs.', { exact: true }).waitFor();
    await search.fill('');
    await page.getByRole('button', { name: 'Next page', exact: true }).click();
    await table.getByText('member13@example.test', { exact: true }).first().waitFor();
    assert.equal(await table.getByRole('button').count(), 0);
    assert.equal(await page.getByRole('button', { name: /^(Edit|Delete)( |$)/ }).count(), 0);
    failure = true;
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.getByText('Audit refresh unavailable', { exact: true }).waitFor();
    failure = false;
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await table.waitFor();
    assert.ok(limits.every(limit => limit === '200'));
    await page.reload();
    await table.locator('tbody tr').nth(9).waitFor();
    assert.deepEqual(writes, []);
    assert.deepEqual(errors, []);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await context.close();
    console.log(`${mobile ? 'Mobile' : 'Desktop'}: read-only audit, admin exclusion, distinct user accounts, search, filters, pagination, retry, and no writes passed`);
  }
} finally { await browser.close(); }
