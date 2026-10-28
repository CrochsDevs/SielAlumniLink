import { chromium } from '../node_modules/.search-validation/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Mock conversations only. No real conversations are read or changed.
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  let role = 'student';
  let conversations = Array.from({ length: 30 }, (_, i) => ({ _id: `conversation${i}`, authId: `member${i}`, name: `Member ${i}`, email: `member${i}@example.test`, initial: 'M', isGroup: false, unread: 1, preview: 'University community conversation', time: new Date(Date.now() - i * 60000).toISOString() }));
  conversations.push({ _id: 'group1', name: 'Batch Group', initial: 'G', isGroup: true, unread: 0, preview: 'Group discussion', time: new Date().toISOString() });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/socket.io/**', route => route.abort());
  await page.route('**/api/**', route => {
    const endpoint = new URL(route.request().url()).pathname.replace('/api', '');
    const profile = { _id: 'profile', authId: 'self', role, name: 'Test Member', email: 'self@example.test', passwordSetupRequired: false };
    let data = ['/auth/me', '/users/me'].includes(endpoint) ? profile : [];
    if (endpoint === '/conversations') data = conversations;
    if (endpoint.endsWith('/messages')) data = [{ _id: 'message1', from: 'them', text: `Thread ${endpoint.split('/')[2]}`, at: new Date().toISOString() }];
    if (endpoint === '/notifications/unread-count') data = { count: 0 };
    if (endpoint === '/tracer/access') data = { updateRequired: false, quarter: '2026-Q4', nextUpdateAt: '2027-01-01T00:00:00Z' };
    return route.fulfill({ json: { success: true, data } });
  });
  const icon = page.getByRole('button', { name: 'Chats', exact: true });
  const panel = page.getByRole('dialog', { name: 'Messages', exact: true });
  for (role of ['student', 'alumni', 'admin']) {
    await page.goto(`http://localhost:5173/${role}/${role === 'admin' ? 'settings' : 'accounts'}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.setItem('messages:last-conversation:self', 'conversation0'));
    await icon.click();
    await panel.waitFor();
    assert.deepEqual(await panel.boundingBox(), { x: 0, y: 0, width: 375, height: 812 });
    assert.ok(await panel.locator('ul').evaluate(element => element.scrollHeight > element.clientHeight));
    await panel.getByRole('searchbox', { name: 'Search messages' }).fill('Member 19');
    assert.equal(await panel.locator('li').count(), 1);
    await panel.getByRole('button', { name: /Member 19/ }).click();
    await page.waitForURL(`**/${role}/message?conversation=conversation19`);
    await page.locator('.inbox-message-list').getByText('Thread conversation19', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Close chat', exact: true }).count(), 0);
    assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden');
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('.inbox-message-list').getByText('Thread conversation19', { exact: true }).waitFor();
    await icon.click();
    await panel.getByRole('searchbox').fill('Member 7');
    await panel.getByRole('button', { name: /Member 7/ }).click();
    await page.locator('.inbox-message-list').getByText('Thread conversation7', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Back to conversations', exact: true }).click();
    await page.locator('.messages-sidebar-slot').waitFor({ state: 'visible' });
    assert.equal(new URL(page.url()).searchParams.has('conversation'), false);
    await icon.click();
    await panel.getByRole('searchbox').fill('Batch Group');
    await panel.getByRole('button', { name: /Batch Group/ }).click();
    await page.getByPlaceholder('Message group...').waitFor();
    await page.locator('.inbox-message-list').getByText('Thread group1', { exact: true }).waitFor();
  }
  await icon.click();
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.screenshot({ path: path.join(tmpdir(), 'alumnilink-mobile-messages.png') });
  await page.getByRole('button', { name: 'Close messages', exact: true }).click();
  assert.ok(await icon.evaluate(element => document.activeElement === element));
  await page.setViewportSize({ width: 1440, height: 900 });
  const before = page.url();
  await icon.click();
  const dropdown = page.getByRole('region', { name: 'Messages', exact: true });
  await dropdown.waitFor();
  await dropdown.getByRole('button', { name: /Member 3 University/ }).click();
  await page.getByRole('button', { name: 'Close chat', exact: true }).waitFor();
  assert.equal(page.url(), before, 'Desktop selection should keep its floating chat behavior');
  conversations = [];
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('http://localhost:5173/admin/settings', { waitUntil: 'networkidle' });
  await icon.click();
  await panel.getByText('No conversations yet.', { exact: true }).waitFor();
  await page.keyboard.press('Escape');
  assert.deepEqual(errors, []);
  console.log('PASS: full-screen mobile inbox for all roles, search, explicit thread selection, same-page switching, reload, back to list, groups, empty state, close/focus and desktop floating chats.');
} finally { await browser.close(); }
