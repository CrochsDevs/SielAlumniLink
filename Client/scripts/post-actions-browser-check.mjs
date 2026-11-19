import assert from 'node:assert/strict';
import path from 'node:path';
import express from '../../Server/node_modules/express/index.js';
import { serveClient } from '../../Server/config/client-app.js';
import { chromium } from '../node_modules/.search-validation/node_modules/playwright/index.mjs';

// Browser fixtures exercise layout and interaction only. Database/security checks
// live in feed.integration.test.js and use an isolated real MongoDB database.
const user = { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', authId: 'bbbbbbbbbbbbbbbbbbbbbbbb', name: 'Admin Tester', role: 'admin', email: 'admin@example.test' };
const owner = { authId: 'cccccccccccccccccccccccc', name: 'Post Owner', role: 'alumni', email: 'owner@example.test' };
const now = new Date().toISOString();
const foreign = { _id: '111111111111111111111111', author: owner, body: 'Community post to review', type: 'update', audience: 'public', images: [], createdAt: now, viewerState: {}, likesCount: 0, commentsCount: 0, sharesCount: 0 };
const own = { ...foreign, _id: '222222222222222222222222', author: user, body: 'My editable post', isMine: true, viewerState: {} };
let report = null;
let trashed = false;
let writes = 0;
const app = express();
app.use(express.json());
app.use('/api', async (req, res) => {
  let data = [];
  if (['/auth/me', '/users/me'].includes(req.path)) data = user;
  else if (req.path === '/feed/status') data = { restricted: false };
  else if (req.path === '/community/me') data = { restrictions: [], cases: [] };
  else if (req.path === '/community/admin/stats') data = { provider: { configured: false } };
  else if (req.path === '/community/admin/cases') data = { cases: [], nextCursor: null };
  else if (req.path === '/feed') {
    const posts = [foreign, ...(trashed ? [] : [own])];
    data = { posts: posts.filter(post => req.query.collection === 'saved' ? post.viewerState.saved : req.query.collection === 'hidden' ? post.viewerState.preference === 'not_interested' : post.viewerState.preference !== 'not_interested'), nextCursor: null };
  } else if (req.path === '/feed/post-reports') data = { reports: report ? [report] : [], counts: report ? { [report.status]: 1 } : {}, nextCursor: null };
  else if (req.path.startsWith('/feed/post-reports/')) {
    if (req.method === 'PATCH') { report.status = req.body.status; report.adminNotes = req.body.adminNotes; report.history.push({ status: report.status, at: now, by: user.authId, notes: req.body.adminNotes }); }
    data = report;
  } else if (/\/feed\/[^/]+\/(state|pin)$/.test(req.path)) {
    const post = req.path.includes(own._id) ? own : foreign;
    if (req.path.endsWith('/state')) Object.assign(post.viewerState, req.body);
    else post.isPinned = req.body.pinned;
    data = post;
  } else if (req.path.endsWith('/report')) {
    writes++;
    await new Promise(resolve => setTimeout(resolve, 150));
    report = { _id: '333333333333333333333333', postId: foreign._id, owner, reporter: user, reason: req.body.reason, description: req.body.description, status: 'pending', createdAt: now, adminNotes: '', history: [], snapshot: { body: foreign.body, images: [] }, post: foreign };
    data = report;
  } else if (req.path === `/feed/${own._id}`) {
    if (req.method === 'DELETE') trashed = true;
    else if (req.method === 'PUT') own.body = req.body.body;
    data = own;
  } else if (req.path === '/notifications/unread-count') data = { count: 0 };
  res.json({ success: true, data });
});
serveClient(app, path.resolve('dist'));
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
try {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    for (const width of [1440, 390]) {
      foreign.viewerState = {}; own.viewerState = {}; own.isPinned = false; own.body = 'My editable post'; trashed = false; report = null; writes = 0;
      const context = await browser.newContext({ viewport: { width, height: 950 } });
      await context.route('**/api/**', async route => { const url = new URL(route.request().url()); await route.fulfill({ response: await route.fetch({ url: origin + url.pathname + url.search }) }); });
      await context.routeWebSocket('**/socket.io/**', socket => socket.close());
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${origin}/feed`);
      const other = page.locator(`#post-${foreign._id}`);
      const mine = page.locator(`#post-${own._id}`);
      await other.getByRole('button', { name: 'Post options', exact: true }).click();
      assert.deepEqual(await other.locator('[aria-label="Post options"] button').allTextContents(), ['Interested', 'Not interested', 'Save post', 'Report post']);
      await page.getByText('Community administration', { exact: true }).click();
      await other.getByRole('button', { name: 'Interested', exact: true }).waitFor({ state: 'hidden' });
      await other.getByRole('button', { name: 'Post options', exact: true }).click();
      await other.getByRole('button', { name: 'Interested', exact: true }).click();
      await page.reload();
      await other.getByRole('button', { name: 'Post options', exact: true }).click();
      await other.getByRole('button', { name: 'Remove interest', exact: true }).waitFor();
      await other.getByRole('button', { name: 'Not interested', exact: true }).click();
      await other.waitFor({ state: 'detached' });
      await page.getByRole('button', { name: 'Not interested posts', exact: true }).click();
      await other.getByRole('button', { name: 'Post options', exact: true }).click();
      await other.getByRole('button', { name: 'Remove preference', exact: true }).click();
      await other.waitFor({ state: 'detached' });
      await page.getByRole('button', { name: 'Feed', exact: true }).click();
      await other.getByRole('button', { name: 'Post options', exact: true }).click();
      await other.getByRole('button', { name: 'Save post', exact: true }).click();
      await page.getByRole('button', { name: 'Saved posts', exact: true }).click();
      await other.waitFor(); await mine.waitFor({ state: "detached" });
      await other.getByRole('button', { name: 'Post options', exact: true }).click();
      await other.getByRole('button', { name: 'Report post', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Report Post', exact: true });
      assert.equal(await dialog.getByRole('button', { name: 'Submit Report', exact: true }).isDisabled(), true);
      await dialog.getByLabel('Spam or misleading content', { exact: true }).check();
      await dialog.getByLabel('Additional explanation (optional)').fill('Please investigate.');
      await page.screenshot({ path: path.resolve(`../artifacts/post-report-${width}.png`), fullPage: true });
      await dialog.getByRole('button', { name: 'Submit Report', exact: true }).click();
      await dialog.waitFor({ state: 'detached' }); assert.equal(writes, 1);
      await page.getByRole('button', { name: 'Feed', exact: true }).click();
      await mine.getByRole('button', { name: 'Post options', exact: true }).click();
      assert.deepEqual(await mine.locator('[aria-label="Post options"] button').allTextContents(), ['Pin post', 'Save post', 'Edit post', 'Move to trash']);
      await mine.getByRole('button', { name: 'Pin post', exact: true }).click();
      await mine.getByText('Pinned post', { exact: true }).waitFor();
      await mine.getByRole('button', { name: 'Post options', exact: true }).click();
      await mine.getByRole('button', { name: 'Edit post', exact: true }).click();
      await page.getByRole('textbox', { name: 'Post details', exact: true }).fill('Edited through the existing composer');
      await page.getByRole('button', { name: 'Save changes', exact: true }).click();
      await mine.getByText('Edited through the existing composer', { exact: true }).waitFor();
      await mine.getByRole('button', { name: 'Post options', exact: true }).click();
      await mine.getByRole('button', { name: 'Move to trash', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Move to trash', exact: true }).click();
      await mine.waitFor({ state: 'detached' });
      await page.goto(`${origin}/admin/post-reports`);
      await page.getByRole('heading', { name: 'Community Moderation Center', exact: true }).waitFor();
      assert.equal(new URL(page.url()).pathname, '/admin/community');
      assert.equal(await page.getByRole('link', { name: 'Post Reports', exact: true }).count(), 0);
      await page.screenshot({ path: path.resolve(`../artifacts/community-admin-${width}.png`), fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: conditional menus, outside click, persisted interest, hidden-post undo, saved collection, report, pin, edit, trash, consolidated admin navigation, no horizontal page overflow`);
      await context.close();
    }
  } finally { await browser.close(); }
} finally { await new Promise(resolve => server.close(resolve)); }
