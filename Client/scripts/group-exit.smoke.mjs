import { chromium } from '../node_modules/.search-validation/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const admin of [true, false]) {
    const page = await browser.newPage({ viewport: { width: admin ? 1366 : 390, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const group = { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Exit test', isGroup: true, createdBy: 'creator', adminAuthIds: ['creator'], memberCount: 3 };
    const self = admin ? 'creator' : 'member';
    let joined = true, fail = true, removals = 0, leaves = 0;
    let members = ['creator', 'member', 'third'].map(authId => ({ authId, name: authId, email: `${authId}@example.test`, isAdmin: authId === 'creator' }));
    await page.route('**/socket.io/**', route => route.abort());
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      let data = [];
      if (path === '/api/auth/me' || path === '/api/users/me') data = { _id: self, authId: self, role: 'student', name: self };
      if (path === '/api/tracer/access') data = { updateRequired: false, quarter: '2026-Q4', nextUpdateAt: '2099-01-01T00:00:00Z' };
      if (path === '/api/conversations') data = joined ? [group] : [];
      if (path.endsWith('/members')) data = { conversationId: group._id, ...group, members, maxMembers: 20 };
      if (route.request().method() === 'DELETE') {
        removals++;
        if (fail) return route.fulfill({ status: 503, json: { success: false, message: 'Retry removal.' } });
        members = members.filter(person => person.authId !== 'third');
        group.memberCount = members.length;
        data = { conversationId: group._id, ...group };
      }
      if (path.endsWith('/leave')) {
        leaves++;
        if (fail) return route.fulfill({ status: 503, json: { success: false, message: 'Retry leave.' } });
        joined = false;
      }
      await route.fulfill({ json: { success: true, data } });
    });
    await page.goto('http://localhost:5173/student/message');
    await page.getByRole('button', { name: /Exit test/ }).click();
    await page.getByRole('button', { name: 'View group members' }).click();
    const dialog = page.getByRole('dialog', { name: 'Group members' });
    await dialog.getByText('Creator · Admin', { exact: true }).waitFor();
    if (admin) {
      await dialog.getByRole('button', { name: 'Remove third from group' }).click();
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      assert.equal(removals, 0);
      await dialog.getByRole('button', { name: 'Remove third from group' }).click();
      await dialog.getByRole('button', { name: 'Confirm remove' }).click();
      await dialog.getByRole('alert').waitFor();
      fail = false;
      await dialog.getByRole('button', { name: 'Confirm remove' }).click();
      await dialog.getByText('third was removed from the group.').waitFor();
      await dialog.getByRole('button', { name: 'Remove third from group' }).waitFor({ state: 'detached' });
    } else assert.equal(await dialog.getByRole('button', { name: /^Remove / }).count(), 0);
    await dialog.getByRole('button', { name: 'Leave group', exact: true }).click();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(leaves, 0);
    fail = true;
    await dialog.getByRole('button', { name: 'Leave group', exact: true }).click();
    await dialog.getByRole('button', { name: 'Confirm leave' }).click();
    await dialog.getByRole('alert').waitFor();
    fail = false;
    await dialog.getByRole('button', { name: 'Confirm leave' }).click();
    await dialog.waitFor({ state: 'detached' });
    assert.equal(await page.getByRole('button', { name: /Exit test/ }).count(), 0);
    await page.reload();
    await page.getByRole('group', { name: 'Conversation filters' }).waitFor();
    assert.equal(await page.getByRole('button', { name: /Exit test/ }).count(), 0);
    // Restore a group as if re-invited, then receive a kick on an open dock.
    joined = true;
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.evaluate(({ group, self }) => localStorage.setItem(`chatdock:${self}`, JSON.stringify({ openChats: [{ id: group._id, convo: group, minimized: false }], threads: { [group._id]: [{ text: 'Cached message' }] } })), { group, self });
    await page.reload();
    await page.getByRole('button', { name: 'View group members' }).waitFor();
    joined = false;
    await page.evaluate(async id => {
      const { getSocket } = await import('/src/realtime/socket.js');
      getSocket().emitEvent(['conversation:removed', { conversationId: id }]);
    }, group._id);
    await page.getByRole('button', { name: 'View group members' }).waitFor({ state: 'detached' });
    const cached = await page.evaluate(self => JSON.parse(localStorage.getItem(`chatdock:${self}`)), self);
    assert.equal(cached.openChats.length, 0);
    assert.equal(cached.threads[group._id], undefined);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('Passed: admin kick, member restrictions, confirmation/cancel, removal and leave failures/retries, mobile leave, reload, live kick and cache cleanup. Mock APIs only.');
} finally { await browser.close(); }
