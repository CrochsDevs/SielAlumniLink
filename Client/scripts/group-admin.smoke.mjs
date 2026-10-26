import { chromium } from '../node_modules/.search-validation/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let current = 'creator', fail = true;
  const group = { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', isGroup: true, name: 'Admin test', memberCount: 3, unread: 0, createdBy: 'creator', adminAuthIds: ['creator'] };
  const details = () => ({ conversationId: group._id, ...group, maxMembers: 20, members: ['creator', 'member', 'third'].map(authId => ({ authId, name: authId, email: `${authId}@example.test`, isAdmin: group.adminAuthIds.includes(authId) })) });
  await page.route('**/socket.io/**', route => route.abort());
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let data = [];
    if (path === '/api/auth/me' || path === '/api/users/me') data = { _id: current, authId: current, role: 'admin', name: current, email: `${current}@example.test` };
    if (path === '/api/conversations') data = [group];
    if (path === '/api/tracer/access') data = { updateRequired: false, quarter: '2026-Q4', nextUpdateAt: '2099-01-01T00:00:00Z' };
    if (path.endsWith('/members')) data = details();
    if (path.endsWith('/admins')) {
      if (fail) return route.fulfill({ status: 503, json: { success: false, message: 'Retry promotion.' } });
      group.adminAuthIds.push(route.request().postDataJSON().authId);
      data = details();
    }
    await route.fulfill({ json: { success: true, data } });
  });
  await page.goto('http://localhost:5173/admin/message');
  await page.getByRole('button', { name: /Admin test/ }).click();
  await page.getByRole('button', { name: 'Edit group name', exact: true }).waitFor();
  await page.getByRole('button', { name: 'View group members' }).click();
  const dialog = page.getByRole('dialog', { name: 'Group members' });
  await dialog.getByText('Creator · Admin', { exact: true }).waitFor();
  await dialog.getByRole('button', { name: 'Make third admin', exact: true }).click();
  await dialog.getByRole('alert').waitFor();
  assert.deepEqual(group.adminAuthIds, ['creator']);
  fail = false;
  await dialog.getByRole('button', { name: 'Make third admin', exact: true }).click();
  await dialog.getByText('third is now a group admin.').waitFor();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  current = 'member';
  await page.reload();
  await page.getByRole('button', { name: /Admin test/ }).click();
  assert.equal(await page.getByRole('button', { name: 'Edit group name', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'View group members' }).click();
  await dialog.getByText('Creator · Admin', { exact: true }).waitFor();
  await dialog.getByText('Admin', { exact: true }).waitFor();
  assert.equal(await dialog.getByRole('button', { name: /Make .* admin/ }).count(), 0);
  group.adminAuthIds.push('member');
  await page.evaluate(async data => {
    const { getSocket } = await import('/src/realtime/socket.js');
    getSocket().emitEvent(['conversation:members', data]);
  }, details());
  await page.getByRole('button', { name: 'Edit group name', exact: true }).waitFor();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await page.evaluate(group => localStorage.setItem('chatdock:member', JSON.stringify({ openChats: [{ id: group._id, convo: group, minimized: false }], threads: {} })), group);
  await page.reload();
  await page.getByRole('button', { name: 'Edit group name', exact: true }).waitFor();
  await page.getByRole('button', { name: 'View group members' }).click();
  await dialog.getByText('Creator · Admin', { exact: true }).waitFor();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /Admin test/ }).click();
  await page.getByRole('button', { name: 'View group members' }).click();
  await dialog.getByText('Creator · Admin', { exact: true }).waitFor();
  assert.equal(await dialog.evaluate(el => el.getBoundingClientRect().width <= innerWidth), true);
  assert.deepEqual(errors, []);
  console.log('Passed: creator controls, promotion failure/retry, persisted badges, ordinary member restrictions even with site admin role, live promotion and dock permissions, mobile dialog. Mock APIs only.');
} finally { await browser.close(); }
