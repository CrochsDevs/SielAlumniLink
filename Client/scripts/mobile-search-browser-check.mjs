import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '../node_modules/.search-validation/node_modules/playwright/index.mjs';

// All account, search and socket traffic is mocked.
const person = { _id: '000000000000000000000001', authId: '000000000000000000000002', name: 'Lester Rodriguez', role: 'alumni', program: 'Computer Science', batch: '2020' };
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const role of ['student', 'alumni', 'admin']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await context.routeWebSocket('**/socket.io/**', socket => socket.close());
    await context.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      let data = [];
      if (['/api/auth/me', '/api/users/me'].includes(url.pathname)) data = { _id: '000000000000000000000003', authId: '000000000000000000000004', name: 'Search Tester', role, passwordSetupRequired: false };
      else if (url.pathname.startsWith('/api/search/')) {
        const items = url.searchParams.get('q') === 'Nobody' ? [] : [person];
        const category = url.searchParams.get('category') || 'all';
        const feedPosts = url.pathname.endsWith('/all') && ['all', 'posts'].includes(category) && url.searchParams.get('q') !== 'Nobody'
          ? [{ _id: '000000000000000000000010', source: 'feed', authorProfileId: person._id, authorName: person.name, authorRole: 'alumni', body: 'A feed update from Lester', title: '', createdAt: '2026-11-12T01:00:00Z' }] : [];
        data = { people: { items: category === 'posts' ? [] : items, total: category === 'posts' ? 0 : items.length, page: 1, pages: 1 }, posts: { items: feedPosts, total: feedPosts.length, page: 1, pages: feedPosts.length ? 1 : 0 } };
      } else if (url.pathname === '/api/notifications/unread-count') data = { count: 0 };
      else if (url.pathname === '/api/tracer/access') data = { updateRequired: false, quarter: '2026-Q4', nextUpdateAt: '2027-01-01T00:00:00Z' };
      await route.fulfill({ json: { success: true, data } });
    });
    await page.goto('http://localhost:5173/search');
    const key = 'alumnilink:search-history:000000000000000000000004';
    await page.evaluate(({ key, person }) => localStorage.setItem(key, JSON.stringify({ people: [person], queries: ['Mentorship', 'Career', 'Alumni', 'Internship'] })), { key, person });
    await page.reload();
    await page.getByRole('button', { name: 'Open search', exact: true }).click();
    const search = page.locator('.global-search');
    const input = search.getByRole('combobox', { name: 'Search AlumniLink' });
    await input.waitFor();
    assert.equal(await input.evaluate(element => element === document.activeElement), true);
    const bounds = await search.boundingBox();
    assert.deepEqual({ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }, { x: 0, y: 0, width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
    await search.getByRole('button', { name: 'View Lester Rodriguez', exact: true }).waitFor();
    await search.getByRole('button', { name: 'Show all', exact: true }).click();
    await search.getByRole('button', { name: 'Internship', exact: true }).waitFor();
    for (const dark of [false, true]) {
      await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), dark);
      await page.screenshot({ path: path.join(os.tmpdir(), `SielAlumni-mobile-search-${role}-${dark ? 'dark' : 'light'}.png`) });
    }
    await search.getByRole('button', { name: 'Back from search' }).click();
    await page.getByRole('button', { name: 'Open search', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.body.style.overflow), '');
    await page.getByRole('button', { name: 'Open search', exact: true }).click();
    await input.fill('Lester');
    await search.getByRole('option').filter({ hasText: 'Lester Rodriguez' }).waitFor();
    await input.press('Enter');
    await page.waitForURL('**/search?q=Lester');
    const feedLink = page.getByRole('link', { name: 'View post and comments', exact: true });
    await feedLink.waitFor();
    assert.equal(await feedLink.getAttribute('href'), '/feed?post=000000000000000000000010');
    assert.equal(await page.getByRole('combobox', { name: 'Sort search results' }).inputValue(), 'relevant');
    await page.getByRole('button', { name: 'posts', exact: true }).click();
    await feedLink.waitFor();
    await page.getByRole('button', { name: 'all', exact: true }).click();
    await page.getByRole('button', { name: 'Open search', exact: true }).click();
    await search.getByRole('button', { name: 'Clear search', exact: true }).click();
    await search.getByRole('button', { name: 'Lester', exact: true }).waitFor();
    await input.fill('Nobody');
    await search.getByText('No matching results found', { exact: true }).waitFor();
    await input.press('Escape');
    await page.getByRole('button', { name: 'Open search', exact: true }).waitFor();
    await page.setViewportSize({ width: 320, height: 700 });
    await page.getByRole('button', { name: 'Open search', exact: true }).click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await search.getByRole('button', { name: 'Back from search' }).click();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole('button', { name: 'Open search', exact: true }).click();
    assert.equal(await search.evaluate(element => element.classList.contains('global-search-mobile-open')), false);
    const panel = await search.locator('.global-search-panel').boundingBox();
    assert.equal(panel.width, 380);
    await input.fill('Lester');
    await search.getByRole('option').filter({ hasText: 'Lester Rodriguez' }).waitFor();
    assert.deepEqual(errors, []);
    console.log(`PASS ${role}: fullscreen, recent searches, feed results in All/Posts with Most Relevant, post links, themes, back, empty results, 320px, desktop dropdown`);
    await context.close();
  }
} finally { await browser.close(); }
