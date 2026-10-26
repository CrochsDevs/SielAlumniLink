import { chromium } from '../node_modules/.search-validation/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const role of ['student', 'alumni', 'admin']) {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const group = { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', isGroup: true, name: 'Batch 2026', memberCount: 3, unread: 0, createdBy: 'self', adminAuthIds: ['self'] };
    let failSave = false, writes = 0;
    await page.route('**/socket.io/**', route => route.abort());
    await page.route('**/api/**', async route => {
      const pathname = new URL(route.request().url()).pathname;
      let data = [];
      if (pathname === '/api/auth/me' || pathname === '/api/users/me') data = { _id: 'profile', authId: 'self', role, name: 'Group Tester', email: 'self@example.test' };
      if (pathname === '/api/conversations') data = [group];
      if (pathname === '/api/tracer/access') data = { updateRequired: false, quarter: '2026-Q4', nextUpdateAt: '2099-01-01T00:00:00Z' };
      if (pathname.endsWith('/name') && route.request().method() === 'PATCH') {
        writes++;
        if (failSave) return route.fulfill({ status: 503, json: { success: false, message: 'Please retry saving.' } });
        group.name = route.request().postDataJSON().name;
        data = { conversationId: group._id, name: group.name };
      }
      await route.fulfill({ json: { success: true, data } });
    });
    await page.goto(`http://localhost:5173/${role}/message`);
    await page.getByRole('button', { name: /Batch 2026/ }).click();
    await page.getByRole('button', { name: 'Edit group name', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit group name' });
    await dialog.getByLabel('Group name', { exact: true }).fill('   ');
    assert.equal(await dialog.getByRole('button', { name: 'Save changes' }).isDisabled(), true);
    await dialog.getByLabel('Group name', { exact: true }).fill('Cancelled name');
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(writes, 0);
    await page.getByRole('button', { name: 'Edit group name', exact: true }).click();
    assert.equal(await dialog.getByLabel('Group name', { exact: true }).inputValue(), 'Batch 2026');
    await dialog.getByLabel('Group name', { exact: true }).fill('  Alumni Circle  ');
    failSave = true;
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await dialog.getByRole('alert').waitFor();
    assert.equal(group.name, 'Batch 2026');
    failSave = false;
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await dialog.waitFor({ state: 'detached' });
    assert.equal(group.name, 'Alumni Circle');
    await page.getByRole('button', { name: /Alumni Circle/ }).waitFor();
    await page.reload();
    await page.getByRole('button', { name: /Alumni Circle/ }).waitFor();
    // Restore an open dock window, then verify remote changes reach both views.
    await page.addInitScript(group => localStorage.setItem('chatdock:self', JSON.stringify({ openChats: [{ id: group._id, convo: group, minimized: false }], threads: {} })), group);
    await page.reload();
    await page.getByRole('button', { name: 'Alumni Circle', exact: true }).waitFor();
    await page.evaluate(async id => {
      const { getSocket } = await import('/src/realtime/socket.js');
      getSocket().emitEvent(['conversation:renamed', { conversationId: id, name: 'Renamed by member' }]);
    }, group._id);
    await page.getByRole('button', { name: 'Renamed by member', exact: true }).waitFor();
    await page.locator('.fixed.bottom-0.right-4').getByRole('button', { name: 'Edit group name', exact: true }).click();
    await dialog.getByLabel('Group name', { exact: true }).fill('Dock rename');
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await dialog.waitFor({ state: 'detached' });
    assert.equal(group.name, 'Dock rename');
    const cached = await page.evaluate(() => JSON.parse(localStorage.getItem('chatdock:self')));
    assert.equal(cached.openChats[0].convo.name, 'Dock rename');
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('Passed: group rename for student/alumni/admin, validation, cancel, save failure/retry, reload, live updates, dock editing and cache sync. Mock APIs only.');
} finally { await browser.close(); }
