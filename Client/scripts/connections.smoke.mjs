import { chromium } from '../node_modules/.search-validation/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';

const alumni = { _id: 'alumni', name: 'Alumni Owner', email: 'alumni@example.test', role: 'alumni', profileId: 'alumni-profile', connectionsCount: 25 };
const students = Array.from({ length: 25 }, (_, index) => ({ _id: `student${index}`, name: `Student ${index}`, email: `student${index}@example.test`, role: 'student', profileId: `student-profile${index}`, connectionsCount: 1 }));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const hookWarnings = [];
  page.on('console', message => {
    if (/final argument passed to useEffect|changed size between renders|Failed to reload.*adminConnections/i.test(message.text())) hookWarnings.push(message.text());
  });
  await page.route('**/socket.io/**', route => route.abort());
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url());
    let data = [];
    if (url.pathname === '/api/auth/me') data = { _id: 'admin', role: 'admin', name: 'Admin' };
    if (url.pathname.startsWith('/api/connections/members')) {
      let members;
      if (url.pathname.endsWith('/alumni')) members = students;
      else if (url.pathname.includes('/members/student')) members = [alumni];
      else members = url.searchParams.get('role') === 'students' ? students : url.searchParams.get('role') === 'alumni' ? [alumni] : [alumni, ...students];
      const q = (url.searchParams.get('q') || '').toLowerCase();
      members = members.filter(member => `${member.name} ${member.email}`.toLowerCase().includes(q));
      const current = Number(url.searchParams.get('page') || 1);
      const limit = Number(url.searchParams.get('limit') || 10);
      data = { items: members.slice((current - 1) * limit, current * limit), total: members.length, page: current, pages: Math.max(1, Math.ceil(members.length / limit)) };
    }
    return route.fulfill({ json: { success: true, data } });
  });
  await page.goto('http://localhost:5173/admin/connections');
  assert.equal(await page.getByRole('button', { name: 'Refresh', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'alumni', exact: true }).click();
  await page.getByRole('button', { name: 'View connections of alumni@example.test', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByText('Student 0', { exact: true }).waitFor();
  assert.equal(await dialog.locator('li').count(), 10);
  assert.equal(await dialog.getByRole('link', { name: 'View', exact: true }).first().getAttribute('href'), '/student/profile/student-profile0');
  assert.equal(await dialog.locator('li').first().innerText(), 'S\nStudent 0\nView');
  // Inject the Socket.IO client event while keeping the dialog open (HTTP stays isolated).
  students[0].name = 'Updated Student';
  alumni.connectionsCount = 26;
  await page.evaluate(async () => {
    const { getSocket } = await import('/src/realtime/socket.js');
    getSocket().emitEvent(['connections:changed', { authIds: ['alumni', 'student0'] }]);
  });
  await dialog.getByText('Updated Student', { exact: true }).waitFor();
  await page.locator('tbody tr').filter({ hasText: 'alumni@example.test' }).getByText('26', { exact: true }).waitFor();
  students[0].name = 'Reconnected Student';
  await page.evaluate(async () => {
    const { getSocket } = await import('/src/realtime/socket.js');
    getSocket().emitEvent(['connect']);
  });
  await dialog.getByText('Reconnected Student', { exact: true }).waitFor();
  await dialog.getByRole('button', { name: 'Next page', exact: true }).click();
  await dialog.getByText('Student 10', { exact: true }).waitFor();
  assert.equal(await dialog.getByText('Student 0', { exact: true }).count(), 0);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'students', exact: true }).click();
  await page.getByRole('button', { name: 'View connections of student0@example.test', exact: true }).click();
  await dialog.getByText('Alumni Owner', { exact: true }).waitFor();
  assert.equal(await dialog.locator('li').count(), 1);
  assert.equal(await dialog.getByRole('link', { name: 'View', exact: true }).getAttribute('href'), '/alumni/profile/alumni-profile');
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const box = await dialog.boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= width + 1);
  }
  await dialog.getByRole('button', { name: 'Close connection details' }).click();
  await page.getByRole('textbox', { name: 'Search connections' }).fill('student24@example.test');
  await page.getByText('student24@example.test', { exact: true }).waitFor();
  assert.equal(await page.locator('tbody tr').count(), 1);
  assert.deepEqual(errors, []);
  assert.deepEqual(hookWarnings, []);
  console.log('Passed: real-time list and open-dialog updates, reconnect recovery, no Refresh button, filters, pagination, profile links and responsive dialog.');
} finally { await browser.close(); }
