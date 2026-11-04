import { chromium } from '../node_modules/.search-validation/node_modules/playwright/index.mjs';
import { buildAlignmentReport } from '../../Server/modules/tracer/tracer.alignment.js';
import { buildTracerPeriodReport } from '../../Server/modules/tracer/tracer.period-report.js';
import { employmentReport } from '../../Server/modules/employment/employment.policy.js';
import { matchesNumberFilter, manilaDate } from '../src/utils/tableFilters.js';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

assert.ok(matchesNumberFilter(0, '=0'));
assert.ok(matchesNumberFilter(5, '>=5'));
assert.ok(matchesNumberFilter(4, '<5'));
assert.ok(matchesNumberFilter(100, '>=50%'));
assert.ok(matchesNumberFilter(null, 'unknown'));
assert.equal(matchesNumberFilter(null, '=0'), false);
assert.equal(manilaDate('2026-03-31T16:00:00Z'), '2026-04-01');

const profiles = ['Alice', 'Ben', 'Cara'].map((name, index) => ({
  _id: name, name, email: `${name.toLowerCase()}@example.test`, batch: String(2023 - index),
  program: ['BS IT', 'BS Accountancy', 'BS Education'][index], employmentStatus: index === 2 ? 'Studying' : 'Employed',
  employmentHistory: index === 2 ? [] : [{ company: index ? 'Finance Co' : 'Tech Co', position: index ? 'Accountant' : 'Developer',
    industry: index ? 'Accounting' : 'Technology', startDate: '2025-01', current: true }],
}));
const documents = profiles.map((person, index) => ({
  _id: person._id, authId: person._id, email: person.email, _tracerName: person.name,
  batch: person.batch, program: person.program, status: person.employmentStatus,
  company: index === 0 ? 'Tech Co' : index === 1 ? 'Finance Co' : 'Graduate School',
  position: index === 0 ? 'Developer' : index === 1 ? 'Accountant' : 'Masters',
  salaryRange: '30k', employmentDate: '2025-01-01', location: 'Manila',
  jobAlignment: index === 0 ? 'directly_related' : index === 1 ? 'unrelated' : '',
  alignmentExplanation: index === 0 ? 'Build applications' : index === 1 ? 'Prepare accounts' : '',
  respondedAt: '2026-10-01T00:00:00Z', updatedAt: '2026-11-04T00:00:00Z',
}));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, acceptDownloads: true });
    await context.addInitScript(() => localStorage.setItem('theme', 'dark'));
    await context.routeWebSocket('**/socket.io/**', socket => socket.close());
    await context.route('**/api/**', route => {
      const url = new URL(route.request().url()), endpoint = url.pathname.replace('/api', ''), filters = Object.fromEntries(url.searchParams);
      if (endpoint === '/tracer') {
        const result = buildTracerPeriodReport(documents, filters);
        return route.fulfill({ json: { success: true, data: result.responses, periods: result.periods } });
      }
      const data = ['/auth/me', '/users/me'].includes(endpoint) ? { _id: '000000000000000000000001', authId: '000000000000000000000001', role: 'admin', name: 'Admin Fixture', email: 'admin@example.test', passwordSetupRequired: false }
        : endpoint === '/tracer/alignment' ? buildAlignmentReport(documents, filters)
        : endpoint === '/employment/reports' ? employmentReport(profiles, filters)
        : endpoint === '/notifications/unread-count' ? { count: 0 } : [];
      return route.fulfill({ json: { success: true, data } });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const verifyHeaders = async (region, count) => {
      await region.locator('tbody tr').nth(2).waitFor();
      assert.equal(await region.locator('thead th').count(), count);
      assert.equal(await region.locator('thead input, thead select').count(), count);
    };
    await page.goto('http://127.0.0.1:5173/admin/tracer');
    const responses = page.getByRole('region', { name: 'Tracer study responses', exact: true });
    await verifyHeaders(responses, 12);
    for (const [label, value] of [['Graduate', 'Alice'], ['Company / Business / School', 'Tech'], ['Job / Business / Course', 'Developer'], ['Salary / Income', '30k'], ['Location', 'Manila'], ['Start Month', '2025-01'], ['Responded', '2026-10-01'], ['Updated', '2026-11-04']]) {
      await responses.getByLabel(`Filter ${label}`, { exact: true }).fill(value);
    }
    for (const [label, value] of [['Batch', '2023'], ['Tracing Period', '2026 Q4'], ['Program', 'BS IT'], ['Status', 'Employed']]) {
      await responses.getByLabel(`Filter ${label}`, { exact: true }).selectOption(value);
    }
    assert.equal(await responses.locator('tbody tr').count(), 1);
    const csvEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
    const csv = await readFile(await (await csvEvent).path(), 'utf8');
    assert.ok(csv.includes('alice@example.test'));
    assert.equal(csv.includes('ben@example.test'), false);
    await page.getByRole('button', { name: 'Clear column filters', exact: true }).click();
    assert.equal(await responses.locator('tbody tr').count(), 3);

    await page.goto('http://127.0.0.1:5173/admin/tracer?view=alignment');
    const alignment = page.getByRole('region', { name: 'Alumni program and work alignment', exact: true });
    const programs = page.getByRole('region', { name: 'Alignment totals by program', exact: true });
    await verifyHeaders(alignment, 5);
    await verifyHeaders(programs, 7);
    await programs.getByLabel('Filter program summary Working', { exact: true }).fill('>0');
    assert.equal(await programs.locator('tbody tr').count(), 2);
    await programs.getByLabel('Filter program summary Direct alignment rate', { exact: true }).fill('>=50%');
    assert.equal(await programs.locator('tbody tr').count(), 1);
    await programs.getByText('BS IT', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Clear program column filters', exact: true }).click();
    await programs.getByLabel('Filter program summary Direct alignment rate', { exact: true }).fill('unknown');
    await programs.getByText('BS Education', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Clear program column filters', exact: true }).click();
    await programs.getByLabel('Filter program summary Graduation program', { exact: true }).fill('No matching program');
    await programs.getByText('No programs match these column filters.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Clear program column filters', exact: true }).click();

    await page.goto('http://127.0.0.1:5173/admin/tracer?view=employment');
    const employment = page.getByRole('region', { name: 'Alumni employment records', exact: true });
    await verifyHeaders(employment, 5);
    await employment.getByLabel('Filter employment Alumni', { exact: true }).fill('Alice');
    await employment.getByLabel('Filter employment Company / position', { exact: true }).fill('Developer');
    await employment.getByLabel('Filter employment Status', { exact: true }).selectOption('Employed');
    await employment.getByLabel('Filter employment Industry', { exact: true }).selectOption('Technology');
    await employment.getByLabel('Filter employment Employment History', { exact: true }).selectOption('current');
    assert.equal(await employment.locator('tbody tr').count(), 1);
    await employment.getByText('Alice', { exact: true }).waitFor();
    await employment.getByLabel('Filter employment Employment History', { exact: true }).selectOption('none');
    await page.getByText('No alumni match this selection.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Clear column filters', exact: true }).click();
    assert.equal(await employment.locator('tbody tr').count(), 3);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`${mobile ? 'Mobile' : 'Desktop'}: all 29 headers have filters; text, categories, dates, numeric rates, history, CSV, clear and empty states passed`);
  }
} finally { await browser.close(); }
