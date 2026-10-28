import { chromium } from '../node_modules/.search-validation/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';

// Rich-text and legacy plain-text fixtures only. No real opportunities are changed.
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const job = { _id: 'job1', title: 'Frontend Developer Intern', company: 'CLSU - MISO', type: 'Internship', isActive: true, descriptionFormat: 'html', createdAt: '2026-10-01T00:00:00Z',
    description: '<h3>Internship Description</h3><p>Develop accessible university websites with React and JavaScript.</p><h3>Key Responsibilities</h3><ul>' + '<li><p>Build responsive interfaces and collaborate with the development team.</p></li>'.repeat(20) + '</ul><script>window.opportunityInjected = true</script>' };
  const plain = { ...job, _id: 'job2', title: 'Legacy Internship', descriptionFormat: 'text', description: 'Learn to build <components> & collaborate with a mentor.\nNo HTML formatting required.' };
  await page.route('**/socket.io/**', route => route.abort());
  await page.route('**/api/**', route => {
    const endpoint = new URL(route.request().url()).pathname.replace('/api', '');
    const profile = { _id: 'profile', authId: 'self', name: 'Student Tester', role: 'student', passwordSetupRequired: false };
    const data = ['/auth/me', '/users/me'].includes(endpoint) ? profile
      : endpoint === '/jobs' ? [job, plain]
      : endpoint === '/jobs/job1' ? job
      : endpoint === '/referrals' ? [{ _id: 'ref1', title: 'Alumni Internship', organization: 'Campus Partner', type: 'internship', description: 'Connect with an alumni referrer.', isActive: true }]
      : endpoint === '/development/me' ? { internships: [], portfolio: {} }
      : endpoint === '/notifications/unread-count' ? { count: 0 }
      : endpoint === '/feed/status' ? { restricted: false }
      : endpoint === '/feed' ? { posts: [], nextCursor: null } : [];
    return route.fulfill({ json: { success: true, data } });
  });
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('http://localhost:5173/student/internship', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Opportunities', exact: true }).click();
    const card = page.locator('article').filter({ has: page.getByRole('heading', { name: job.title, exact: true }) });
    await card.waitFor();
    assert.doesNotMatch(await card.innerText(), /<\/?(?:h3|p|li|ul|script)>/);
    const preview = card.locator('.line-clamp-4');
    assert.ok(await preview.evaluate(element => element.getBoundingClientRect().height <= 96));
    assert.equal(await card.getByRole('link', { name: 'View opportunity' }).getAttribute('href'), '/student/career/job1');
    const legacy = page.locator('article').filter({ has: page.getByRole('heading', { name: plain.title, exact: true }) });
    assert.match(await legacy.innerText(), /<components> & collaborate/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (width === 375) await page.screenshot({ path: path.join(tmpdir(), 'alumnilink-internship-opportunities.png') });
    await card.getByRole('link', { name: 'View opportunity' }).click();
    await page.locator('.opportunity-prose h3').first().waitFor();
    assert.equal(await page.locator('.opportunity-prose li').count(), 20);
    assert.equal(await page.locator('.opportunity-prose script').count(), 0);
    assert.equal(await page.evaluate(() => window.opportunityInjected), undefined);
  }
  await page.goto('http://localhost:5173/student', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Hiring', exact: true }).click();
  const preview = page.locator('article').filter({ has: page.getByRole('heading', { name: job.title, exact: true }) });
  await preview.waitFor();
  assert.doesNotMatch(await preview.innerText(), /<\/?(?:h3|p|li|ul|script)>/);
  assert.deepEqual(errors, []);
  console.log('PASS: compact internship previews on mobile/desktop, plain-text compatibility, direct full-detail links, sanitized formatted details, and dashboard job previews.');
} finally { await browser.close(); }
