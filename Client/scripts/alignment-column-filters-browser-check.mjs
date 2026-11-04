import { chromium } from '../node_modules/.search-validation/node_modules/playwright/index.mjs';
import { buildAlignmentReport } from '../../Server/modules/tracer/tracer.alignment.js';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const documents = Array.from({ length: 12 }, (_, index) => {
  const group = index % 3;
  return { _id: String(index), authId: String(index), alumniName: `${['Alice', 'Ben', 'Cara'][group]} Graduate ${index}`,
    email: `graduate${index}@example.test`, responseHistory: [{
      batch: String(2023 - group), program: ['BS IT', 'BS Accountancy', 'BS Education'][group],
      status: 'Employed', position: ['Developer', 'Accountant', 'Teacher'][group], company: `Company ${group}`,
      jobAlignment: ['directly_related', 'unrelated', 'partly_related'][group],
      alignmentExplanation: ['Build applications', 'Prepare accounts', 'Teach mathematics'][group], recordedAt: '2026-11-04',
    }] };
});
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, acceptDownloads: true });
    await context.addInitScript(() => localStorage.setItem('theme', 'dark'));
    await context.routeWebSocket('**/socket.io/**', socket => socket.close());
    const errors = [];
    await context.route('**/api/**', route => {
      const url = new URL(route.request().url()), endpoint = url.pathname.replace('/api', '');
      const data = ['/auth/me', '/users/me'].includes(endpoint) ? { _id: '000000000000000000000001', authId: '000000000000000000000001', role: 'admin', name: 'Admin Fixture', email: 'admin@example.test', passwordSetupRequired: false }
        : endpoint === '/tracer/alignment' ? buildAlignmentReport(documents, Object.fromEntries(url.searchParams))
        : endpoint === '/notifications/unread-count' ? { count: 0 } : [];
      return route.fulfill({ json: { success: true, data } });
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5173/admin/tracer?view=alignment');
    const region = page.getByRole('region', { name: 'Alumni program and work alignment', exact: true });
    const section = region.locator('..');
    await region.locator('tbody tr').nth(11).waitFor();
    assert.equal(await region.locator('thead input').count(), 3);
    assert.equal(await region.locator('thead select').count(), 2);
    await section.locator('.data-pagination').getByRole('combobox').click();
    await page.getByRole('option', { name: '5 / page', exact: true }).click();
    await section.getByRole('button', { name: 'Next page', exact: true }).click();
    await region.getByLabel('Filter alumni or program', { exact: true }).fill('Alice');
    assert.equal(await region.locator('tbody tr').count(), 4);
    assert.equal(await section.getByRole('button', { name: '1', exact: true }).getAttribute('aria-current'), 'page');
    await region.getByLabel('Filter follow-up years', { exact: true }).selectOption('3');
    await region.getByLabel('Filter reported job or business', { exact: true }).fill('Developer');
    await region.getByLabel('Filter table alignment', { exact: true }).selectOption('directly_related');
    await region.getByLabel('Filter duties and explanation', { exact: true }).fill('applications');
    assert.equal(await region.locator('tbody tr').count(), 4);
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Filter duties and explanation');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export alignment CSV', exact: true }).click();
    const download = await downloadPromise;
    const csv = await readFile(await download.path(), 'utf8');
    assert.ok(csv.includes('graduate0@example.test'));
    assert.equal(csv.includes('graduate1@example.test'), false);
    assert.ok(csv.includes('Filter duties and explanation'));
    await region.getByLabel('Filter table alignment', { exact: true }).selectOption('unrelated');
    await region.getByText('No responses match these column filters. Clear or adjust the filters above.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Export alignment CSV', exact: true }).isDisabled(), true);
    await section.getByRole('button', { name: 'Clear column filters', exact: true }).click();
    assert.equal(await region.locator('tbody tr').count(), 5);
    assert.equal(await region.getByLabel('Filter duties and explanation', { exact: true }).inputValue(), '');
    assert.deepEqual(errors, []);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await context.close();
    console.log(`${mobile ? 'Mobile' : 'Desktop'}: header filters, combined matching, pagination reset, input focus, filtered CSV, empty state, and clear passed`);
  }
} finally { await browser.close(); }
