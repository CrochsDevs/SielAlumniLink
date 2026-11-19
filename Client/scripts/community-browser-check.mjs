import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import dotenv from '../../Server/node_modules/dotenv/lib/main.js';
import { MongoClient, ObjectId } from '../../Server/node_modules/mongodb/lib/index.js';
import { chromium } from '../node_modules/.search-validation/node_modules/playwright/index.mjs';

// Actual application HTTP/auth/moderation services with an isolated real DB.
// No user accounts or records in the production database are accessed.
dotenv.config({ path: fileURLToPath(new URL('../../Server/.env', import.meta.url)), quiet: true });
const { client } = await import('../../Server/config/db.js');
const { signSessionToken } = await import('../../Server/modules/auth/session-token.js');
const { ensureCommunityIndexes } = await import('../../Server/modules/community/community.service.js');
const { ensureFeedIndexes, createFeedService } = await import('../../Server/modules/feed/feed.service.js');
const connection = new MongoClient(process.env.TEST_MONGO_URI || process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
const name = `cmb_${randomUUID().replaceAll('-', '')}`, db = connection.db(name), originalDb = client.db;
const oldKey = process.env.OPENAI_API_KEY, oldServe = process.env.SERVE_CLIENT;
let server, browser;
try {
  await connection.connect(); await ensureCommunityIndexes(db); await ensureFeedIndexes(db);
  client.db = () => db; process.env.OPENAI_API_KEY = ''; process.env.SERVE_CLIENT = 'true';
  const member = { _id: new ObjectId(), name: 'Moderation Member', email: 'member@example.test', role: 'alumni' };
  const reporter = { _id: new ObjectId(), name: 'Reporter', email: 'reporter@example.test', role: 'alumni' };
  const admin = { _id: new ObjectId(), name: 'Moderation Admin', email: 'admin@example.test', role: 'admin' };
  await db.collection('auth').insertMany([member, reporter, admin].map(user => ({ ...user, password: '$2b$10$' + 'a'.repeat(53), passwordSetupRequired: false })));
  await db.collection('users').insertMany([member, reporter, admin].map(user => ({ authId: String(user._id), name: user.name, email: user.email, role: user.role })));
  const { default: app } = await import('../../Server/src/app.js');
  const { community } = await import('../../Server/modules/community/community.runtime.js');
  const feed = createFeedService(db, () => {}, null, community);
  server = createServer(app); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const makeContext = async (user, width) => {
    const context = await browser.newContext({ viewport: { width, height: 950 } });
    await context.route('**/api/**', async route => {
      try {
      const url = new URL(route.request().url());
      const response = await route.fetch({ url: origin + url.pathname + url.search, headers: { ...route.request().headers(), Cookie: `token=${signSessionToken(user)}`, Origin: 'http://localhost:5173' } });
      await route.fulfill({ response, headers: { ...response.headers(), 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true' } });
      } catch (error) {
        if (!/closed|disposed/i.test(error.message)) throw new Error('Browser test API routing failed');
      }
    });
    await context.routeWebSocket('**/socket.io/**', socket => socket.close());
    return context;
  };
  for (const width of [1440, 390]) {
    const post = await feed.create(member, { body: `Moderation appeal browser evidence at ${width} pixels` });
    const report = await feed.report(reporter, post._id, { reason: 'Other', description: 'Please investigate this submission.' });
    await community.review(admin, String(report._id), { status: 'under_review', notes: 'Reviewing the reported content' });
    await community.review(admin, String(report._id), { status: 'confirmed', notes: 'Temporary community restriction pending appeal', level: 4, durationDays: 7 });
    const memberContext = await makeContext(member, width), adminContext = await makeContext(admin, width);
    try {
      const page = await memberContext.newPage(), adminPage = await adminContext.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message)); adminPage.on('pageerror', error => errors.push(error.message));
      const responses = [];
      page.on('response', async response => { if (/\/api\/(?:auth\/me|community\/me)/.test(response.url())) { try { const json = await response.json(); responses.push({ path: new URL(response.url()).pathname, status: response.status(), hasUser: !!json.data, restrictions: json.data?.restrictions?.length, passwordSetup: json.data?.passwordSetupRequired }); } catch {} } });
      await page.goto(origin + '/feed');
      try { await page.waitForURL('**/community-status'); } catch (error) { console.log(JSON.stringify({ responses, errors, url: page.url(), text: (await page.locator('body').innerText()).slice(0, 1500) })); await page.screenshot({ path: path.resolve('../artifacts/community-browser-failure.png'), fullPage: true }); throw error; }
      await page.getByRole('heading', { name: 'Your Account Has Been Temporarily Restricted', exact: true }).waitFor();
      await page.screenshot({ path: path.resolve(`../artifacts/community-restriction-${width}.png`), fullPage: true });
      await page.getByRole('button', { name: 'View Violation Details / Appeal Decision', exact: true }).click();
      await page.getByLabel('Appeal explanation', { exact: true }).fill('The context was misunderstood. Please review this decision.');
      await page.getByRole('button', { name: 'Submit Appeal', exact: true }).click();
      await page.getByText('Your appeal has been submitted for administrator review.', { exact: true }).waitFor();
      await adminPage.goto(origin + '/admin/community');
      await adminPage.getByRole('heading', { name: 'Community Moderation Center', exact: true }).waitFor();
      await adminPage.getByRole('button', { name: 'Appeals', exact: true }).click();
      const appealRow = adminPage.getByRole('row').filter({ hasText: 'pending' }).filter({ hasText: member.name });
      await appealRow.getByRole('button', { name: 'Review Appeal', exact: true }).click();
      let dialog = adminPage.getByRole('dialog', { name: 'Review Appeal', exact: true });
      await dialog.getByLabel('Decision explanation', { exact: true }).fill('Reviewing the original evidence and appeal context');
      await dialog.getByRole('button', { name: 'Mark Under Review', exact: true }).click();
      await dialog.waitFor({ state: 'detached' });
      await adminPage.getByRole('row').filter({ hasText: 'under review' }).filter({ hasText: member.name }).getByRole('button', { name: 'Review Appeal', exact: true }).click();
      dialog = adminPage.getByRole('dialog', { name: 'Review Appeal', exact: true });
      await dialog.getByLabel('Decision explanation', { exact: true }).fill('Appeal approved. The original decision was incorrect.');
      await dialog.getByRole('button', { name: 'Approve and Restore', exact: true }).click();
      await dialog.waitFor({ state: 'detached' });
      await adminPage.getByRole('row').filter({ hasText: 'approved' }).filter({ hasText: member.name }).first().waitFor();
      await adminPage.getByRole('button', { name: 'Moderation Queue', exact: true }).click();
      await adminPage.getByRole('row').filter({ hasText: member.name }).first().getByRole('button', { name: 'Review', exact: true }).click();
      await adminPage.getByRole('dialog', { name: 'Review Moderation Case', exact: true }).getByText('Confidential user report', { exact: true }).waitFor();
      await adminPage.screenshot({ path: path.resolve(`../artifacts/community-review-${width}.png`), fullPage: true });
      await adminPage.getByRole('dialog').getByRole('button', { name: 'Close dialog', exact: true }).click();
      await adminPage.getByRole('button', { name: 'Settings', exact: true }).click();
      await adminPage.getByRole('heading', { name: 'Moderation Settings', exact: true }).waitFor();
      await adminPage.getByText('Not configured. Only automated rules are operational.', { exact: false }).waitFor();
      await adminPage.getByRole('button', { name: 'Save Policy', exact: true }).click();
      await adminPage.getByText('Moderation settings saved.', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Refresh status', exact: true }).click();
      await page.getByText('You have no active community restrictions.', { exact: true }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.equal(await adminPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.deepEqual(errors, []);
      assert.equal(await db.collection('community_cases').countDocuments({ userId: String(member._id), status: 'confirmed' }), 0);
      console.log(`PASS ${width}px: real backend restriction redirect, evidence, appeal submission, admin approval, removed strike, restored features, settings persistence, responsive layout`);
    } finally { await memberContext.unrouteAll({ behavior: 'ignoreErrors' }); await adminContext.unrouteAll({ behavior: 'ignoreErrors' }); await memberContext.close(); await adminContext.close(); }
  }
} finally {
  await browser?.close();
  if (server?.listening) await new Promise(resolve => server.close(resolve));
  client.db = originalDb;
  if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey;
  if (oldServe === undefined) delete process.env.SERVE_CLIENT; else process.env.SERVE_CLIENT = oldServe;
  if (/^cmb_[a-f0-9]{32}$/.test(name)) await db.dropDatabase().catch(() => {});
  await connection.close();
}
