import { chromium } from '../node_modules/.search-validation/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import path from 'node:path';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const role of ['student', 'alumni', 'admin']) {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const group = { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', isGroup: true, name: 'Batch 2026', memberCount: 3, unread: 0 };
    const people = [
      { authId: 'self', name: 'Group Tester', email: 'self@example.test' },
      { authId: 'member1', name: 'Alex Santos', email: 'alex@example.test' },
      { authId: 'member2', name: 'Bea Santos', email: 'bea@example.test' },
      { authId: 'new1', name: 'Dana Reyes', email: 'dana@example.test' },
      { authId: 'new2', name: 'Eli Cruz', email: 'eli@example.test' },
    ];
    let members = people.slice(0, 3), failSave = false, failLoad = false, writes = 0, joined = false;
    const result = () => ({ conversationId: group._id, name: group.name, memberCount: members.length, maxMembers: 20, members });
    await page.route('**/socket.io/**', route => route.abort());
    await page.route('**/api/**', async route => {
      const pathname = new URL(route.request().url()).pathname;
      let data = [];
      if (pathname === '/api/auth/me' || pathname === '/api/users/me') data = { _id: 'profile', authId: 'self', role, name: 'Group Tester', email: 'self@example.test' };
      if (pathname === '/api/tracer/access') data = { updateRequired: false, quarter: '2026-Q4', nextUpdateAt: '2099-01-01T00:00:00Z' };
      if (pathname === '/api/conversations') data = [group, { _id: 'direct', name: 'Direct Friend', unread: 0 }, ...(joined ? [{ _id: 'newgroup', isGroup: true, name: 'Invited Group', memberCount: 3, unread: 0 }] : [])];
      if (pathname.endsWith('/members')) {
        if (route.request().method() === 'POST') {
          writes++;
          if (failSave) return route.fulfill({ status: 503, json: { success: false, message: 'Please retry adding members.' } });
          const ids = route.request().postDataJSON().authIds;
          members = [...members, ...people.filter(person => ids.includes(person.authId) && !members.some(member => member.authId === person.authId))];
          group.memberCount = members.length;
        } else if (failLoad) return route.fulfill({ status: 503, json: { success: false, message: 'Unable to load members.' } });
        data = result();
      }
      if (pathname.endsWith('/candidates')) data = people.filter(person => !members.some(member => member.authId === person.authId));
      await route.fulfill({ json: { success: true, data } });
    });
    const emit = async payload => page.evaluate(async payload => {
      const { getSocket } = await import('/src/realtime/socket.js');
      getSocket().emitEvent(['conversation:members', payload]);
    }, payload);
    await page.goto(`http://localhost:5173/${role}/message`);
    await page.getByRole('button', { name: /Direct Friend/ }).waitFor();
    await page.getByRole('button', { name: 'Groups', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: /Direct Friend/ }).count(), 0);
    await page.getByRole('button', { name: /Batch 2026/ }).click();
    failLoad = true;
    await page.getByRole('button', { name: 'View group members' }).click();
    const dialog = page.getByRole('dialog', { name: 'Group members', exact: true });
    await dialog.getByRole('alert').waitFor();
    failLoad = false;
    await dialog.getByRole('button', { name: 'Retry', exact: true }).click();
    await dialog.getByText('Group Tester (You)', { exact: true }).waitFor();
    assert.equal(await dialog.getByRole('list', { name: 'Group member list' }).locator('li').count(), 3);
    await dialog.getByRole('button', { name: 'Add members', exact: true }).click();
    assert.equal(await dialog.getByRole('checkbox').count(), 2);
    await dialog.getByLabel('Search connections').fill('Dana');
    assert.equal(await dialog.getByRole('checkbox').count(), 1);
    await dialog.getByRole('checkbox', { name: 'Add Dana Reyes', exact: true }).check();
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    assert.equal(writes, 0);
    await page.getByRole('button', { name: 'View group members' }).click();
    await dialog.getByRole('button', { name: 'Add members', exact: true }).click();
    await dialog.getByRole('checkbox', { name: 'Add Dana Reyes', exact: true }).check();
    failSave = true;
    await dialog.getByRole('button', { name: 'Add selected', exact: true }).click();
    await dialog.getByRole('alert').waitFor();
    assert.equal(members.length, 3);
    failSave = false;
    await dialog.getByRole('button', { name: 'Add selected', exact: true }).click();
    await dialog.getByRole('button', { name: 'Members (4)', exact: true }).waitFor();
    await dialog.getByText('Dana Reyes', { exact: true }).waitFor();
    // A member added from another device appears while the list is open.
    members.push(people[4]); group.memberCount = members.length;
    await emit(result());
    await dialog.getByRole('button', { name: 'Members (5)', exact: true }).waitFor();
    await dialog.getByText('Eli Cruz', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(tmpdir(), `group-members-${role}.png`) });
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    joined = true;
    await emit({ conversationId: 'newgroup', memberCount: 3 });
    await page.getByRole('button', { name: /Invited Group/ }).waitFor();
    await page.reload();
    await page.getByRole('button', { name: /Batch 2026/ }).click();
    await page.setViewportSize({ width: 390, height: 700 });
    await page.getByRole('button', { name: 'View group members' }).click();
    await dialog.getByRole('button', { name: 'Members (5)', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(tmpdir(), `group-members-${role}-mobile.png`) });
    await dialog.getByRole('button', { name: 'Add members', exact: true }).click();
    await dialog.getByText('No connections available to add.', { exact: true }).waitFor();
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.evaluate(group => localStorage.setItem('chatdock:self', JSON.stringify({ openChats: [{ id: group._id, convo: group, minimized: false }], threads: {} })), group);
    await page.reload();
    await page.getByRole('button', { name: 'View group members' }).click();
    await dialog.getByRole('button', { name: 'Members (5)', exact: true }).waitFor();
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('Passed: joined Groups filter, member list/search, add/cancel/retry, live membership/count updates, newly joined groups, reload, mobile and floating chat for all roles. Mock APIs only.');
} finally { await browser.close(); }
