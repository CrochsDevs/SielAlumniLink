import { chromium } from '../node_modules/.search-validation/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { summarizeEngagement, reportPeriod } from '../../Server/modules/reports/reports.policy.js';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const rows = [
  { status: 'Employed', jobAlignment: 'directly_related', program: 'Bachelor of Science in Information Technology' },
  { status: 'Self-employed', jobAlignment: 'partly_related', program: 'Bachelor of Science in Information Technology' },
  { status: 'Employed', jobAlignment: 'unrelated', program: 'BS Business Administration' },
  { status: 'Employed', program: 'BS Agriculture' },
  { status: 'Unemployed', program: 'BS Agriculture' },
  { status: 'Studying', program: 'BS Agriculture' },
  { status: 'Unknown', program: '' },
];
const errors = [], requests = [];
const artifacts = path.join(os.tmpdir(), 'SielAlumni-tracer-insights');
let fail = false;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.routeWebSocket('**/socket.io/**', socket => socket.close());
  await context.route('**/api/**', async route => {
    const url = new URL(route.request().url()), endpoint = url.pathname.replace('/api', '');
    let data = [];
    if (['/auth/me', '/users/me'].includes(endpoint)) data = { _id: '111111111111111111111111', authId: '111111111111111111111111', role: 'admin', name: 'Admin', email: 'admin@example.test', passwordSetupRequired: false };
    if (endpoint === '/notifications/unread-count') data = { count: 0 };
    if (endpoint === '/reports/dashboard') {
      const date = url.searchParams.get('date');
      data = { date, members: { alumni: 20, students: 10, total: 30 }, overview: { jobs: 0, applications: 0, pendingApplications: 0, events: 0, registrations: 0, surveys: 0, surveyResponses: 0, certificates: 0, pendingCertificates: 0, announcements: 0, posts: 0, blockedPosts: 0, unreadMessages: 0, tracerResponses: 7, employedAlumni: 4, upcomingEvents: [], recentAnnouncements: [] }, mentorship: { accepted: 0, pending: 0, rejected: 0, total: 0 }, engagement: summarizeEngagement([], reportPeriod(date)) };
    }
    if (endpoint === '/tracer') {
      requests.push(Object.fromEntries(url.searchParams));
      if (fail) return route.fulfill({ status: 503, json: { message: 'Insights unavailable' } });
      const quarter = url.searchParams.get('quarter');
      data = quarter === '2' ? [] : quarter === '3' ? rows.filter(row => row.status === 'Studying') : rows;
      return route.fulfill({ json: { success: true, data, periods: { years: [2026, 2025] } } });
    }
    return route.fulfill({ json: { success: true, data } });
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost:5173/admin');
  const section = page.getByRole('region', { name: 'Tracer study insights', exact: true });
  const viewSwitch = page.getByRole('navigation', { name: 'Dashboard view', exact: true });
  await viewSwitch.getByRole('button', { name: 'Overview', exact: true }).waitFor();
  assert.equal(await section.isVisible(), false);
  await page.getByRole('heading', { name: 'Community engagement', exact: true }).waitFor();
  await viewSwitch.getByRole('button', { name: 'Tracer study insights', exact: true }).click();
  assert.ok(page.url().endsWith('/admin?view=tracer'));
  await page.getByRole('heading', { name: 'Community engagement', exact: true }).waitFor({ state: 'hidden' });
  await section.locator('canvas').nth(2).waitFor();
  await page.waitForFunction(() => document.querySelector('.dashboard-tracer canvas')?.width > 0);
  assert.equal(await section.locator('canvas').count(), 3);
  assert.match(await section.locator('.tracer-insight-stats').innerText(), /57%/);
  assert.match(await section.locator('.tracer-insight-stats').innerText(), /50%/);
  assert.match(await section.locator('canvas').first().getAttribute('aria-label'), /Not reported: 1/);
  await section.getByText('View chart data', { exact: true }).first().click();
  await section.getByRole('dialog', { name: 'Employment status data' }).waitFor();
  assert.match(await section.locator('table').first().innerText(), /Self-employed\s+1\s+14%/);
  await section.getByRole('button', { name: 'Close chart data' }).first().click();
  // Verify Chart.js instances, real tooltip interaction, and theme changes.
  const inspect = () => page.evaluate(async () => {
    const chartUrl = performance.getEntriesByType('resource').find(entry => entry.name.includes('/chart__js.js'))?.name;
    const { Chart } = await import(chartUrl);
    return [...document.querySelectorAll('.dashboard-tracer canvas')].map(canvas => {
      const chart = Chart.getChart(canvas);
      return { type: chart.config.type, values: chart.data.datasets[0].data, max: chart.scales.x?.max, color: chart.options.scales?.x?.ticks.color, ticks: chart.scales.y?.ticks.map(tick => tick.label) };
    });
  });
  assert.deepEqual((await inspect()).map(chart => chart.type), ['doughnut', 'bar', 'bar']);
  assert.deepEqual((await inspect())[1].values, [1, 1, 1, 0, 1]);
  assert.equal((await inspect())[1].max, 4, 'Alignment scale uses all working respondents');
  assert.equal((await inspect())[2].max, 7, 'Program scale uses all respondents, rather than the largest program count');
  assert.ok((await inspect())[2].ticks.some(lines => lines.join(' ') === 'Bachelor of Science in Information Technology'));
  const checkAlignment = async () => {
    const layout = await section.locator('.tracer-charts-grid > section').evaluateAll(cards => cards.slice(0, 2).map(card => ({
      height: card.getBoundingClientRect().height,
      caption: card.querySelector('.dashboard-chart-caption').getBoundingClientRect().top,
      footer: card.querySelector('.tracer-data-trigger').getBoundingClientRect().top,
    })));
    for (const key of ['height', 'caption', 'footer']) assert.ok(Math.abs(layout[0][key] - layout[1][key]) < 1, `Unequal chart ${key}`);
  };
  await checkAlignment();
  await section.locator('canvas').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const point = await page.evaluate(async () => {
    const chartUrl = performance.getEntriesByType('resource').find(entry => entry.name.includes('/chart__js.js'))?.name;
    const { Chart } = await import(chartUrl);
    const canvas = document.querySelector('.dashboard-tracer canvas'), chart = Chart.getChart(canvas);
    const arc = chart.getDatasetMeta(0).data[0], p = arc.getCenterPoint(), rect = canvas.getBoundingClientRect();
    return { x: p.x + rect.left, y: p.y + rect.top };
  });
  await page.mouse.move(point.x, point.y);
  await page.waitForFunction(async () => {
    const chartUrl = performance.getEntriesByType('resource').find(entry => entry.name.includes('/chart__js.js'))?.name;
    const { Chart } = await import(chartUrl);
    return Chart.getChart(document.querySelector('.dashboard-tracer canvas')).tooltip.opacity === 1;
  });
  await page.mouse.move(0, 0);
  await section.getByText('View chart data', { exact: true }).first().click();
  await checkAlignment();
  await page.keyboard.press('Escape');
  assert.equal(await section.locator('dialog[open]').count(), 0);
  await mkdir(artifacts, { recursive: true });
  const lightColor = (await inspect())[1].color;
  for (const [width, dark] of [[1440, false], [390, false], [320, true]]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(value => document.documentElement.classList.toggle('dark', value), dark);
    await page.waitForTimeout(400);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${width}`);
    if (width >= 768) await checkAlignment();
    if (dark) assert.notEqual((await inspect())[1].color, lightColor);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(artifacts, `${width}.png`), fullPage: true });
  }
  await section.getByLabel('Tracing year', { exact: true }).selectOption('2026');
  await section.getByLabel('Quarter', { exact: true }).selectOption('2');
  await section.getByText('No tracer responses for this period.', { exact: true }).waitFor();
  assert.equal(await section.locator('canvas').count(), 0);
  await section.getByLabel('Quarter', { exact: true }).selectOption('3');
  await section.getByText('No working respondents in this period.', { exact: true }).waitFor();
  assert.equal(await section.locator('canvas').count(), 2);
  assert.match(await section.locator('.tracer-insight-stats').innerText(), /—/);
  fail = true;
  await section.getByLabel('Quarter', { exact: true }).selectOption('4');
  await section.getByRole('alert').waitFor();
  fail = false;
  await section.getByRole('button', { name: 'Retry tracer charts' }).click();
  await section.locator('canvas').nth(2).waitFor();
  assert.equal(await section.getByRole('link', { name: 'View tracer study' }).getAttribute('href'), '/admin/tracer?year=2026&quarter=4');
  assert.ok(requests.some(request => request.year === '2026' && request.quarter === '2'));
  await page.getByRole('button', { name: 'Refresh dashboard', exact: true }).click();
  await section.locator('canvas').nth(2).waitFor();
  await viewSwitch.getByRole('button', { name: 'Overview', exact: true }).click();
  await section.waitFor({ state: 'hidden' });
  assert.ok(page.url().endsWith('/admin'));
  await viewSwitch.getByRole('button', { name: 'Tracer study insights', exact: true }).click();
  await section.waitFor({ state: 'visible' });
  assert.equal(await section.getByLabel('Tracing year', { exact: true }).inputValue(), '2026');
  assert.equal(await section.getByLabel('Quarter', { exact: true }).inputValue(), '4');
  await page.reload();
  await section.locator('canvas').nth(2).waitFor();
  assert.equal(await viewSwitch.getByRole('button', { name: 'Tracer study insights', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.deepEqual(errors, []);
  console.log('PASS: dashboard view switch, preserved filters, direct link/reload, Chart.js rendering, labels, alignment, modals, retry, refresh, desktop/mobile/dark layouts.');
} finally { await browser.close(); }
