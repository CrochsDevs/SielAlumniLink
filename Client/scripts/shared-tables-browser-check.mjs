import { chromium } from '../node_modules/.search-validation/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildAlignmentReport } from '../../Server/modules/tracer/tracer.alignment.js';
import { employmentReport } from '../../Server/modules/employment/employment.policy.js';

// UI fixtures only: every API/socket request is intercepted, including writes.
const artifacts = path.join(tmpdir(), 'SielAlumni-shared-tables');
await mkdir(artifacts, { recursive: true });
const people = Array.from({ length: 23 }, (_, index) => ({
  _id: `person-${index}`, authId: `auth-${index}`, name: `Alumni Member ${index + 1}`,
  email: `member${index + 1}@example.test`, role: 'alumni', studentId: `2022-${index}`,
  program: index % 2 ? 'BS Information Technology' : 'BS Agriculture', batch: '2022',
  status: 'Employed', company: 'Example Company', position: 'Program Associate',
  jobAlignment: 'directly_related', alignmentExplanation: 'Uses skills learned in the graduation program.',
  respondedAt: '2026-10-28T00:00:00Z', updatedAt: '2026-10-28T00:00:00Z',
  salaryRange: 'PHP 25,000–34,999', employmentDate: '2025-01', location: 'Nueva Ecija',
  employmentStatus: 'Employed', employmentHistory: [{ company: 'Example Company', position: 'Program Associate',
    industry: 'Education', startDate: '2025-01', current: true }],
  title: `Community Update ${index + 1}`, body: 'Fixture announcement', isActive: true,
  audience: 'all', questions: [], createdAt: '2026-10-28T00:00:00Z', connectionsCount: 2,
}));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.routeWebSocket('**/socket.io/**', socket => socket.close());
  await page.route('**/api/**', route => {
    const request = route.request(), url = new URL(request.url()), endpoint = url.pathname.replace('/api', '');
    assert.equal(request.method(), 'GET', 'This check must never send a real mutation');
    let data = [];
    if (['/auth/me', '/users/me'].includes(endpoint)) data = { _id: 'self', authId: 'self', name: 'Admin Preview', role: 'admin', passwordSetupRequired: false };
    else if (endpoint === '/notifications/unread-count') data = { count: 0 };
    else if (endpoint === '/tracer' || endpoint === '/users' || endpoint === '/announcements' || endpoint === '/surveys') data = people;
    else if (endpoint === '/tracer/alignment') data = buildAlignmentReport(people, Object.fromEntries(url.searchParams));
    else if (endpoint === '/employment/reports') data = employmentReport(people, Object.fromEntries(url.searchParams));
    else if (endpoint === '/connections/members') data = { items: people.slice(0, 10), total: people.length, page: 1, pages: 3 };
    return route.fulfill({ json: { success: true, data } });
  });
  const tableStyle = () => page.locator('main table').first().evaluate(table => {
    const header = getComputedStyle(table.querySelector('thead th'));
    const cell = getComputedStyle(table.querySelector('tbody td'));
    return { headerBackground: header.backgroundColor, headerColor: header.color, headerSize: header.fontSize,
      headerWeight: header.fontWeight, headerPadding: header.padding, headerTransform: header.textTransform,
      headerFont: header.fontFamily, cellFont: cell.fontFamily,
      cellSize: cell.fontSize, cellPadding: cell.padding, cellBorder: cell.borderBottomColor };
  });
  let checks = 0;
  for (const dark of [false, true]) {
    let reference;
    for (const route of ['tracer', 'tracer?view=alignment', 'tracer?view=employment', 'users', 'announcements', 'surveys', 'connections']) {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(`http://localhost:5173/admin/${route}`, { waitUntil: 'networkidle' });
      await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), dark);
      await page.locator('main tbody td').first().waitFor();
      const style = await tableStyle();
      reference ||= style;
      assert.deepEqual(style, reference, `${route}: tables must share header/cell styles in ${dark ? 'dark' : 'light'} mode`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if (route.startsWith('tracer')) {
        assert.equal(await page.locator('main table').first().evaluate(table => {
          const summary = document.querySelector('main [aria-label="Summary statistics"]');
          return !!(table.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_PRECEDING);
        }), true, 'Statistics must come before the response table');
        const top = await page.locator('main thead th').first().boundingBox();
        assert.ok(top.y < 850, `${route}: table header should be visible on desktop`);
      }
      if (route === 'tracer') {
        await page.locator('main tbody tr').first().hover();
        const colors = await page.locator('main tbody tr').first().locator('td').evaluateAll(cells => cells.map(cell => getComputedStyle(cell).backgroundColor));
        assert.equal(new Set(colors).size, 1, 'Sticky and scrolling cells share the same hover color');
        for (const role of ['student', 'alumni', 'admin']) {
          await page.locator('.member-workspace').evaluate((element, role) => { element.dataset.workspaceRole = role; }, role);
          assert.deepEqual(await tableStyle(), reference, `Shared table rules also apply to the ${role} workspace`);
        }
      }
      checks++;
    }
  }
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('http://localhost:5173/admin/tracer', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.documentElement.classList.remove('dark'));
    const frame = page.getByRole('region', { name: 'Tracer study responses', exact: true });
    await frame.waitFor();
    assert.equal(await page.getByRole('button', { name: 'Tracer Responses', exact: true }).getAttribute('aria-pressed'), 'true');
    await frame.scrollIntoViewIfNeeded();
    const bounds = await page.locator('main thead th').first().boundingBox();
    assert.ok(bounds.y >= 0 && bounds.y + bounds.height < 900, `Records remain accessible below the summary at ${width}px`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const scroll = await frame.evaluate(element => {
      element.scrollLeft = element.scrollWidth;
      element.scrollTop = 180;
      return { x: element.scrollLeft, y: element.scrollTop };
    });
    assert.ok(scroll.x > 0, 'Wide columns must scroll inside their table');
    assert.ok(scroll.y > 0, 'Long records must scroll inside their table');
    const header = await page.locator('main thead th').nth(10).boundingBox();
    const container = await frame.boundingBox();
    assert.ok(Math.abs(header.y - container.y) < 2, 'Headers stay visible while scrolling');
    await frame.evaluate(element => { element.scrollLeft = 0; element.scrollTop = 0; });
    await page.screenshot({ path: path.join(artifacts, `tracer-${width}.png`) });
    checks++;
  }
  assert.deepEqual(errors, []);
  console.log(`PASS: ${checks} checks for shared table styles, both themes, summary cards above tables, default responses, sticky headers and contained mobile scrolling. All requests mocked. Screenshots: ${artifacts}`);
} finally { await browser.close(); }
