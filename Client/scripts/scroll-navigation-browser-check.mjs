import { chromium } from '../node_modules/.search-validation/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';

// Fixture-only navigation. Never sends real announcements, applications or messages.
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 375, height: 600 } });
  let role = 'admin';
  let writes = 0;
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const members = Array.from({ length: 45 }, (_, i) => ({ _id: `member${i}`, profileId: `profile${i}`, name: `Member ${i + 1}`, email: `member${i + 1}@example.test`, role: 'alumni', program: 'Information Technology', connectionsCount: 45, connectionStatus: 'none' }));
  const announcements = members.map((member, i) => ({ ...member, _id: `announcement${i}`, title: `Announcement ${i + 1}`, body: 'University community update and upcoming career development opportunities.', audience: 'all', isActive: true, createdAt: '2026-10-28T00:00:00Z' }));
  const job = { _id: 'job1', title: 'University Software Engineer', company: 'Campus Partner', type: 'Full-time', isActive: true, descriptionFormat: 'html', description: '<h3>About the role</h3>' + '<p>Build accessible university websites and collaborate with the alumni community.</p>'.repeat(35) };
  await page.route('**/socket.io/**', route => route.abort());
  await page.route('**/api/**', async route => {
    const request = route.request();
    if (!['GET', 'OPTIONS'].includes(request.method())) { writes++; return route.fulfill({ status: 409, json: { success: false } }); }
    const url = new URL(request.url());
    const endpoint = url.pathname.replace('/api', '');
    const profile = { _id: 'profile', authId: 'self', role, name: 'Navigation Tester', email: 'self@example.test', passwordSetupRequired: false };
    let data = ['/auth/me', '/users/me'].includes(endpoint) ? profile : [];
    if (endpoint === '/notifications/unread-count') data = { count: 0 };
    if (endpoint === '/announcements' || endpoint === '/surveys') data = announcements.map(item => ({ ...item, questions: [] }));
    if (endpoint.startsWith('/connections/members')) {
      const current = Number(url.searchParams.get('page') || 1), limit = Number(url.searchParams.get('limit') || 10);
      await new Promise(resolve => setTimeout(resolve, 120));
      data = { items: members.slice((current - 1) * limit, current * limit), page: current, pages: Math.ceil(members.length / limit), total: members.length };
    }
    if (endpoint === '/search/all') data = { people: { items: members.slice(0, 10), pages: 3, total: 30 }, posts: { items: [], pages: 0, total: 0 } };
    if (endpoint === '/jobs/job1') data = job;
    return route.fulfill({ json: { success: true, data } });
  });
  const top = async label => {
    await page.waitForTimeout(220);
    assert.equal(await page.evaluate(() => Math.round(window.scrollY)), 0, label);
  };
  const down = async () => {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    assert.ok(await page.evaluate(() => window.scrollY > 0), 'Fixture page must be scrollable');
  };
  for (const width of [375, 1440]) {
    console.log('Checking scroll behavior at', width);
    await page.setViewportSize({ width, height: 600 });
    await page.goto('http://localhost:5173/admin/announcements', { waitUntil: 'networkidle' });
    let pagination = page.locator('.data-pagination');
    for (const label of ['Next page', 'Previous page']) {
      await down();
      await pagination.getByRole('button', { name: label, exact: true }).click();
      await top(`${label} should scroll to the page top at ${width}`);
    }
    await down();
    await pagination.getByRole('button', { name: '5', exact: true }).click();
    await top('Numbered pagination should scroll to top');
    await down();
    await pagination.getByRole('combobox').click();
    await page.getByRole('option', { name: '20 / page', exact: true }).click();
    await top('Rows-per-page change should stay at top after popup focus restoration');
    await page.locator('main table').evaluate(table => { const wrapper = table.parentElement; wrapper.style.maxHeight = '180px'; wrapper.style.overflowY = 'auto'; wrapper.scrollTop = 200; });
    assert.ok(await page.locator('main table').evaluate(table => table.parentElement.scrollTop > 0));
    await pagination.getByRole('button', { name: 'Next page', exact: true }).click();
    assert.equal(await page.locator('main table').evaluate(table => table.parentElement.scrollTop), 0, 'Nested tables must also return to top');

    await page.goto('http://localhost:5173/admin/connections', { waitUntil: 'networkidle' });
    pagination = page.locator('main .data-pagination');
    await down();
    await pagination.getByRole('button', { name: 'Next page', exact: true }).click();
    await page.getByRole('button', { name: 'View connections of member11@example.test', exact: true }).waitFor();
    await top('Async pagination should stay at top after rows load');
    await page.locator('main .overflow-x-auto').evaluate(element => element.scrollLeft = element.scrollWidth);
    await page.evaluate(() => window.scrollTo(0, 150));
    await page.getByRole('button', { name: 'View connections of member11@example.test', exact: true }).click();
    const dialog = page.locator('dialog[open]');
    await dialog.locator('.data-pagination').waitFor();
    const backgroundY = await page.evaluate(() => window.scrollY);
    await dialog.evaluate(element => element.scrollTop = element.scrollHeight);
    await dialog.getByRole('button', { name: 'Next page', exact: true }).click();
    await dialog.locator('ul').getByText('Member 11', { exact: true }).waitFor();
    await page.waitForTimeout(200);
    assert.equal(await dialog.evaluate(element => element.scrollTop), 0, 'Modal pagination should reset its own scroll');
    assert.equal(await page.evaluate(() => window.scrollY), backgroundY, 'Modal pagination must preserve background position');
    await page.getByRole('button', { name: 'Close connection details' }).click();

    await page.goto('http://localhost:5173/search?q=member', { waitUntil: 'networkidle' });
    await down();
    await page.getByRole('navigation', { name: 'Search result pages' }).getByRole('button', { name: 'Next', exact: true }).click();
    await page.waitForURL('**/search?*page=2*');
    await top('Query-string navigation should reset scroll');
    await down();
    await page.goBack();
    await top('History Back should return to top');
    await down();
    await page.goForward();
    await top('History Forward should return to top');
    await down();
    await page.locator('a[href="/admin/surveys"]').first().evaluate(element => element.click());
    await page.waitForURL('**/admin/surveys');
    await top('Sidebar route navigation should return to top');
    await down();
    await page.locator('a[href="/admin/surveys"]').first().evaluate(element => element.click());
    await top('Navigating to the same route should also return to top');
  }
  role = 'student';
  await page.setViewportSize({ width: 375, height: 600 });
  await page.goto('http://localhost:5173/student/career/job1', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Apply now', exact: true }).click();
  const wizard = page.locator('dialog[open]');
  await wizard.waitFor();
  const background = await page.evaluate(() => window.scrollY);
  await wizard.evaluate(element => element.scrollTop = element.scrollHeight);
  await wizard.getByRole('button', { name: 'Apply now', exact: true }).click();
  await wizard.getByRole('button', { name: 'Back to details', exact: true }).waitFor();
  assert.equal(await wizard.evaluate(element => element.scrollTop), 0, 'Next form step should start at top');
  await wizard.evaluate(element => element.scrollTop = element.scrollHeight);
  await wizard.getByRole('button', { name: 'Back to details', exact: true }).click();
  assert.equal(await wizard.evaluate(element => element.scrollTop), 0, 'Previous form step should start at top');
  assert.equal(await page.evaluate(() => window.scrollY), background);
  assert.equal(writes, 0);
  assert.deepEqual(errors, []);
  console.log('PASS: mobile/desktop pagination, page sizes, nested tables, asynchronous rows, modal pagination, route/query/same-route/history navigation and form steps all reset the correct scroll container.');
} finally { await browser.close(); }
