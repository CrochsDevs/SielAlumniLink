import { chromium } from '../node_modules/.search-validation/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const id = n => n.toString(16).padStart(24, '0');
const errors = [];
try {
  for (const role of ['student', 'alumni', 'admin']) {
    const context = await browser.newContext({ viewport: role !== 'alumni' ? { width: 390, height: 844 } : { width: 1440, height: 1000 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    const self = { _id: id(1), authId: id(2), name: 'Self Member', role, email: 'self@example.test', passwordSetupRequired: false };
    const other = { _id: id(3), authId: id(4), name: 'Other Member', role: 'alumni' };
    const post = { _id: id(10), postId: id(11), kind: 'post', postType: 'update', title: 'Career milestone', postBody: 'A shared update', audience: 'public', createdAt: '2026-11-04T01:00:00Z' };
    const comment = { ...post, _id: id(9), kind: 'comment', body: 'Congratulations on this milestone!' };
    const profile = { _id: id(8), kind: 'profile', sections: ['skills'], createdAt: '2026-11-03T01:00:00Z' };
    const security = { _id: id(7), kind: 'security', action: 'password_changed', createdAt: '2026-11-04T02:00:00Z' };
    let failNext = false;
    const requests = [];
    await context.routeWebSocket('**/socket.io/**', socket => socket.close());
    await context.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      const path = url.pathname.replace('/api', '');
      let data = [];
      if (['/auth/me', '/users/me'].includes(path)) data = self;
      else if (path === `/users/${other._id}`) data = other;
      else if (path.endsWith('/activity')) {
        requests.push(path + url.search);
        if (failNext) { failNext = false; return route.fulfill({ status: 500, json: { success: false, message: 'Activity temporarily unavailable' } }); }
        const filter = url.searchParams.get('type');
        const selected = filter === 'admin' ? { items: [{ _id: id(5), kind: 'admin', action: 'post_blocked', target: { label: 'Own admin target' }, details: 'Reviewed report', createdAt: security.createdAt }], nextCursor: null }
          : filter === 'access' ? { items: [{ _id: id(4), kind: 'admin', action: 'login', createdAt: security.createdAt }], nextCursor: null }
          : filter === 'security' ? { items: [security, { ...security, _id: id(6), action: 'password_reset' }], nextCursor: null }
          : filter === 'comments' ? { items: [comment], nextCursor: null }
          : filter === 'profile' ? { items: [profile], nextCursor: null }
          : filter === 'stories' ? { items: [], nextCursor: null }
          : { items: [post, comment, ...Array.from({ length: 11 }, (_, index) => ({ ...profile, _id: id(30 + index) }))] };
        const page = Number(url.searchParams.get('page') || 1), limit = Number(url.searchParams.get('limit') || 10);
        data = { items: selected.items.slice((page - 1) * limit, page * limit), page, limit, total: selected.items.length, totalPages: Math.max(1, Math.ceil(selected.items.length / limit)) };
      } else if (path === '/notifications/unread-count') data = { count: 0 };
      else if (path === '/tracer/access') data = { updateRequired: false, quarter: '2026-Q4', nextUpdateAt: '2027-01-01T00:00:00Z' };
      return route.fulfill({ json: { success: true, data } });
    });
    const settingsPath = `/${role}/${role === 'admin' ? 'settings' : 'accounts'}`;
    await page.goto(`http://127.0.0.1:5173${settingsPath}`);
    if (role !== 'alumni') await page.getByRole('button', { name: /^Settings section:/ }).click();
    await page.getByRole('button', { name: /Activity Logs/ }).click();
    const section = page.getByRole('region', { name: 'Your activity logs' });
    await section.getByText('You', { exact: true }).first().waitFor();
    assert.ok(page.url().endsWith(`${settingsPath}?tab=activity`));
    assert.equal(await page.getByRole('link', { name: 'Settings', exact: true }).getAttribute('aria-current'), 'page');
    await page.reload();
    await section.getByText('You', { exact: true }).first().waitFor();
    assert.equal(await section.getByRole('link', { name: /View post/ }).first().getAttribute('href'), `/feed?post=${post.postId}`);
    await section.getByRole('button', { name: 'Next page', exact: true }).click();
    await section.getByRole('button', { name: '2', exact: true }).waitFor();
    assert.equal(await section.getByRole('button', { name: '2', exact: true }).getAttribute('aria-current'), 'page');
    assert.equal(await section.locator('ol > li').count(), 3);
    assert.equal(await section.getByText('Career milestone', { exact: true }).count(), 0);
    assert.ok(requests.some(request => request.includes('page=2') && request.includes('limit=10')));
    assert.equal(await section.getByRole('button', { name: 'Next page', exact: true }).isDisabled(), true);
    await section.getByRole('button', { name: 'Previous page', exact: true }).click();
    await section.getByText('Career milestone', { exact: true }).first().waitFor();
    await section.getByRole('button', { name: '2', exact: true }).click();
    await section.getByRole('button', { name: '2', exact: true }).waitFor();
    await section.getByRole('combobox').click();
    await page.getByRole('option', { name: '5 / page', exact: true }).click();
    await section.getByText('Career milestone', { exact: true }).first().waitFor();
    assert.equal(await section.locator('ol > li').count(), 5);
    assert.equal(await section.getByRole('button', { name: '1', exact: true }).getAttribute('aria-current'), 'page');
    await section.getByRole('button', { name: 'Comments', exact: true }).click();
    await section.getByText(comment.body, { exact: true }).waitFor();
    assert.equal(await section.getByText('Updated skills.', { exact: true }).count(), 0);
    await section.getByRole('button', { name: 'Stories', exact: true }).click();
    await section.getByText('No stories to show yet').waitFor();
    failNext = true;
    await section.getByRole('button', { name: 'Refresh activity' }).click();
    await section.getByRole('alert').waitFor();
    await section.getByRole('button', { name: 'Try again' }).click();
    await section.getByText('No stories to show yet').waitFor();
    await section.getByRole('button', { name: 'Profile updates', exact: true }).click();
    await section.getByText('Updated skills.', { exact: true }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await section.getByRole('button', { name: 'Security', exact: true }).click();
    await section.getByText('Your password was changed successfully.', { exact: true }).waitFor();
    await section.getByText('Your password was reset successfully.', { exact: true }).waitFor();
    assert.equal(await section.getByRole('link', { name: /View post/ }).count(), 0);
    assert.equal(await section.locator('time').count(), 2);
    if (role === 'admin') {
      await section.getByRole('button', { name: 'Admin actions', exact: true }).click();
      await section.getByText('Own admin target', { exact: true }).waitFor();
      await section.getByText('You blocked a post', { exact: true }).waitFor();
      assert.equal(await section.getByRole('link', { name: /View post/ }).count(), 0);
      await section.getByRole('button', { name: 'Login/logout', exact: true }).click();
      await section.getByText('You logged in', { exact: true }).waitFor();
      await page.goto('http://127.0.0.1:5173/admin/settings?tab=security');
      await page.getByPlaceholder('Enter current password').fill('Old-fixture-password');
      await page.getByPlaceholder('At least 6 characters').fill('New-fixture-password');
      await page.getByPlaceholder('Repeat new password').fill('New-fixture-password');
      await page.getByRole('button', { name: 'Change password', exact: true }).click();
      await page.getByRole('button', { name: 'Sign in again', exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Stay logged in', exact: true }).count(), 0);
    } else {
    await page.goto(`http://127.0.0.1:5173/${role}/activity-logs`);
    await section.getByText('You', { exact: true }).first().waitFor();
    assert.ok(page.url().endsWith('/accounts?tab=activity'));
    const requestCount = requests.length;
    await page.goto(`http://127.0.0.1:5173/${role}/profile`);
    await page.getByRole('heading', { name: 'About', exact: true }).waitFor();
    assert.equal(await section.count(), 0);
    await page.goto(`http://127.0.0.1:5173/${role}/profile/${other._id}`);
    await page.getByRole('heading', { name: 'About', exact: true }).waitFor();
    assert.equal(await section.count(), 0);
    assert.equal(requests.length, requestCount);
    }
    assert.ok(requests.every(request => request.startsWith('/users/me/activity')));
    await context.close();
    console.log(`${role}: private Activity Logs page, sidebar navigation, filters, paging, links, retry, responsive layout, and absence from profiles passed`);
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
