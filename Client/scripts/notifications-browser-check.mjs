import { chromium } from '../node_modules/.search-validation/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Isolated fixtures: notification reads and navigation never reach the real API.
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  let role = 'student';
  let notifications = Array.from({ length: 30 }, (_, i) => ({
    _id: `notice${i}`, kind: i % 2 ? 'jobs' : 'announcements', title: `University update ${i + 1}`,
    body: 'Career opportunities and university community announcements.', read: false,
    createdAt: new Date().toISOString(), link: '/alumni/career',
  }));
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/socket.io/**', route => route.abort());
  await page.route('**/api/**', route => {
    const endpoint = new URL(route.request().url()).pathname.replace('/api', '');
    const profile = { _id: 'profile', authId: 'auth', role, name: 'Test Member', passwordSetupRequired: false };
    const data = ['/auth/me', '/users/me'].includes(endpoint) ? profile
      : endpoint === '/notifications' ? notifications
      : endpoint === '/notifications/unread-count' ? { count: notifications.length }
      : endpoint === '/tracer/access' ? { updateRequired: false, quarter: '2026-Q4', nextUpdateAt: '2027-01-01T00:00:00Z' } : [];
    return route.fulfill({ json: { success: true, data } });
  });
  const bell = page.getByRole('button', { name: 'Notifications', exact: true });
  const modal = page.getByRole('dialog', { name: 'Notifications', exact: true });
  for (role of ['student', 'alumni', 'admin']) {
    await page.goto(`http://localhost:5173/${role}/${role === 'admin' ? 'settings' : 'accounts'}`, { waitUntil: 'networkidle' });
    await bell.click();
    await modal.waitFor();
    assert.ok(await page.getByRole('button', { name: 'Close notifications' }).evaluate(element => document.activeElement === element));
    assert.deepEqual(await modal.boundingBox(), { x: 0, y: 0, width: 375, height: 812 });
    assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
    assert.ok(await page.locator('.notifications-list').evaluate(element => element.scrollHeight > element.clientHeight));
    await page.getByRole('button', { name: 'Jobs', exact: true }).click();
    assert.equal(await modal.locator('ul li').count(), 15);
    await page.getByRole('button', { name: 'Close notifications' }).click();
    assert.equal(await modal.count(), 0);
    assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden');
    assert.ok(await bell.evaluate(element => document.activeElement === element));
  }
  await page.goto('http://localhost:5173/student', { waitUntil: 'networkidle' });
  for (const width of [320, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 812 });
    await bell.click();
    if (width < 640) await modal.waitFor();
    else await page.getByRole('region', { name: 'Notifications', exact: true }).waitFor();
    assert.equal(await modal.count(), width < 640 ? 1 : 0);
    await page.keyboard.press('Escape');
    await page.locator('.notifications-panel').waitFor({ state: 'detached' });
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await bell.click();
  await modal.waitFor();
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.screenshot({ path: path.join(tmpdir(), 'alumnilink-mobile-notifications.png') });
  await page.setViewportSize({ width: 768, height: 812 });
  await page.getByRole('region', { name: 'Notifications', exact: true }).waitFor();
  assert.equal(await modal.count(), 0);
  assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden');
  await page.keyboard.press('Escape');
  notifications = [];
  await page.setViewportSize({ width: 375, height: 812 });
  await page.reload({ waitUntil: 'networkidle' });
  await bell.click();
  await modal.getByText('No notifications yet', { exact: true }).waitFor();
  await page.keyboard.press('Escape');
  assert.deepEqual(errors, []);
  console.log('PASS: all roles, full mobile viewport, filters, scrolling, close/focus, Escape, dark mode, desktop dropdown, resize cleanup and empty state.');
} finally { await browser.close(); }
