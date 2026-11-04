import { chromium } from '../node_modules/.search-validation/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildTracerPeriodReport } from '../../Server/modules/tracer/tracer.period-report.js';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const records = Array.from({ length: 55 }, (_, index) => ({
  _id: String(index).padStart(3, '0'), authId: `member-${index}`, email: `graduate${index}@example.test`, batch: '2020', program: 'BS IT',
  _tracerName: `Graduate Person ${index}`,
  _tracerPicture: index === 54 ? 'https://images.example.test/graduate.svg' : index === 53 ? 'https://images.example.test/missing.svg' : null,
  status: 'Employed', company: 'Current employer', position: 'Developer', respondedAt: '2025-05-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z',
  responseHistory: [
    { status: 'Employed', company: 'Year 2025 employer', recordedAt: '2025-05-01T00:00:00Z' },
    { status: index === 54 ? 'Studying' : 'Unemployed', company: index === 54 ? 'Quarter one graduate school' : '', recordedAt: '2026-02-01T00:00:00Z' },
  ],
}));
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, acceptDownloads: true });
    await context.routeWebSocket('**/socket.io/**', socket => socket.close());
    await context.route('https://images.example.test/**', route => route.request().url().endsWith('/missing.svg')
      ? route.fulfill({ status: 404, body: '' })
      : route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#009639"/></svg>' }));
    const requests = [], writes = [], errors = [];
    await context.route('**/api/**', async route => {
      const request = route.request(), url = new URL(request.url()), endpoint = url.pathname.replace('/api', '');
      if (!['GET', 'OPTIONS'].includes(request.method())) writes.push(endpoint);
      if (endpoint === '/tracer') {
        const filters = Object.fromEntries(url.searchParams);
        requests.push(filters);
        const result = buildTracerPeriodReport(records, filters);
        if (filters.year === '2025') await new Promise(resolve => setTimeout(resolve, 180));
        return route.fulfill({ json: { success: true, data: result.responses, periods: result.periods } });
      }
      const data = ['/auth/me', '/users/me'].includes(endpoint)
        ? { _id: '000000000000000000000001', authId: '000000000000000000000001', role: 'admin', name: 'Tracer Tester', email: 'admin@example.test', passwordSetupRequired: false }
        : endpoint === '/notifications/unread-count' ? { count: 0 } : [];
      return route.fulfill({ json: { success: true, data } });
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5173/admin/tracer');
    const section = page.getByRole('region', { name: 'Tracer survey responses', exact: true });
    await section.locator('tbody tr').nth(49).waitFor();
    await section.getByRole('img', { name: 'Graduate Person 54 profile picture', exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelector('img[alt="Graduate Person 54 profile picture"]')?.naturalWidth > 0);
    await section.getByText('Graduate Person 54', { exact: true }).waitFor();
    await section.getByText('graduate54@example.test', { exact: true }).waitFor();
    await page.waitForFunction(() => !document.querySelector('img[src="https://images.example.test/missing.svg"]'));
    assert.equal(await section.locator('tbody tr').filter({ hasText: 'Graduate Person 53' }).getByRole('img').count(), 0);
    assert.equal(await section.locator('tbody tr').filter({ hasText: 'Graduate Person 52' }).getByRole('img').count(), 0);
    await section.getByRole('button', { name: 'Next page', exact: true }).click();
    assert.equal(await section.locator('tbody tr').count(), 5);
    await section.getByLabel('Tracing year', { exact: true }).selectOption('2026');
    await section.getByLabel('Tracing quarter', { exact: true }).selectOption('1');
    await section.getByText('Quarter one graduate school', { exact: true }).waitFor();
    assert.equal(await section.locator('tbody tr').count(), 50);
    assert.equal(await section.getByRole('button', { name: '1', exact: true }).getAttribute('aria-current'), 'page');
    assert.equal(await section.getByText('Current employer', { exact: true }).count(), 0);
    await section.locator('.admin-stat-card').filter({ hasText: 'Employed' }).getByText('0', { exact: true }).waitFor();
    assert.ok(requests.some(request => request.year === '2026' && request.quarter === '1'));
    await section.getByLabel('Filter by employment status', { exact: true }).selectOption('Studying');
    assert.equal(await section.locator('tbody tr').count(), 1);
    const downloadEvent = page.waitForEvent('download');
    await section.getByRole('button', { name: 'Export CSV', exact: true }).click();
    const download = await downloadEvent;
    assert.equal(download.suggestedFilename(), 'tracer-report-2026-Q1.csv');
    const csv = await readFile(await download.path(), 'utf8');
    assert.ok(csv.includes('Tracing Year') && csv.includes('Tracing Quarter'));
    assert.ok(csv.includes('Graduate Name') && csv.includes('Graduate Person 54'));
    assert.ok(csv.includes('Quarter one graduate school'));
    assert.ok(csv.includes('"2026","Q1"'));
    assert.equal(csv.includes('Current employer'), false);
    await section.getByLabel('Filter by employment status', { exact: true }).selectOption('all');
    await section.getByLabel('Tracing quarter', { exact: true }).selectOption('2');
    await section.getByText('No responses for this tracing period', { exact: true }).waitFor();
    assert.equal(await section.getByRole('button', { name: 'Export CSV', exact: true }).isDisabled(), true);
    await section.getByLabel('Tracing year', { exact: true }).selectOption('2025');
    await section.getByLabel('Tracing year', { exact: true }).selectOption('2026');
    await section.getByLabel('Tracing quarter', { exact: true }).selectOption('4');
    await section.getByText('Current employer', { exact: true }).first().waitFor();
    await page.waitForTimeout(250);
    assert.equal(await section.getByText('Year 2025 employer', { exact: true }).count(), 0);
    await page.reload();
    await section.getByText('Current employer', { exact: true }).first().waitFor();
    assert.equal(await section.getByLabel('Tracing year', { exact: true }).inputValue(), '2026');
    assert.equal(await section.getByLabel('Tracing quarter', { exact: true }).inputValue(), '4');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(writes, []);
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`${mobile ? 'Mobile' : 'Desktop'}: tracing year/quarter, historical data, summaries, pagination reset, status, CSV, empty state, request races, and reload passed`);
  }
} finally { await browser.close(); }
