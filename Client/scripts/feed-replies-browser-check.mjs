import assert from 'node:assert/strict';
import path from 'node:path';
import express from '../../Server/node_modules/express/index.js';
import { serveClient } from '../../Server/config/client-app.js';
import { chromium, firefox, webkit } from '../node_modules/.search-validation/node_modules/playwright/index.mjs';

// Isolated HTTP fixtures; no real accounts, emails, or database operations.
const user = { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', authId: 'bbbbbbbbbbbbbbbbbbbbbbbb', name: 'Reply Author', email: 'reply@example.test', role: 'student' };
const person = { authId: 'cccccccccccccccccccccccc', name: 'Comment Author', role: 'alumni', program: 'BS Information Technology', batch: '2025' };
const root = { _id: '111111111111111111111111', body: 'Original comment', author: person, createdAt: '2026-11-11T06:00:00Z', isMine: false };
let replies = [], writes = [], failSend = false, disabled = false;
const app = express();
app.use(express.json());
app.use('/api', async (req, res) => {
  let data = [];
  if (['/auth/me', '/users/me'].includes(req.path)) data = user;
  else if (req.path === '/feed/status') data = { restricted: false };
  else if (req.path === '/feed') data = { posts: [{ _id: '222222222222222222222222', author: person, body: 'Reply fixture post', type: 'update', audience: 'public', images: [], createdAt: root.createdAt, commentsCount: 1 + replies.length, commentsDisabled: disabled, likesCount: 0, sharesCount: 0 }], nextCursor: null };
  else if (req.path.endsWith('/comments') && req.method === 'POST') {
    writes.push(req.body);
    if (failSend) return res.status(503).json({ success: false, message: 'Reply test unavailable' });
    // Keep the response outstanding long enough to exercise double-submit protection.
    await new Promise(resolve => setTimeout(resolve, 150));
    data = { _id: String(replies.length + 3).padStart(24, '0'), parentCommentId: root._id, body: req.body.body, author: user, createdAt: root.createdAt, isMine: true };
    replies.unshift(data);
  } else if (req.path.includes('/comments/') && req.method === 'DELETE') replies = replies.filter(row => row._id !== req.path.split('/').at(-1));
  else if (req.path.endsWith('/comments')) data = { comments: req.query.parentCommentId ? replies : [{ ...root, repliesCount: replies.length }], nextCursor: null };
  else if (req.path === '/notifications/unread-count') data = { count: 0 };
  res.json({ success: true, data });
});
serveClient(app, path.resolve(process.env.CLIENT_BUILD_DIR || 'dist'));
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
try {
  for (const [name, engine, options] of [['Edge', chromium, { channel: 'msedge' }], ['Firefox', firefox, {}], ['WebKit', webkit, {}]]) {
    replies = []; writes = []; failSend = false; disabled = false;
    const browser = await engine.launch({ headless: true, ...options });
    try {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await context.routeWebSocket('**/socket.io/**', socket => socket.close());
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(origin + '/feed');
      await page.getByRole('button', { name: 'Comment', exact: true }).click();
      await page.getByText('Original comment', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Reply', exact: true }).click();
      const draft = page.getByRole('textbox', { name: 'Reply to Comment Author', exact: true });
      await draft.fill('First reply');
      await draft.evaluate(element => { const form = element.closest('form'); form.requestSubmit(); form.requestSubmit(); });
      await page.locator('p').filter({ hasText: /^First reply$/ }).waitFor();
      assert.equal(writes.length, 1, 'Double submit must issue only one write');
      assert.equal(writes[0].parentCommentId, root._id);
      await page.waitForLoadState('networkidle');
      await page.reload();
      await page.getByRole('button', { name: 'Comment', exact: true }).click();
      await page.getByRole('button', { name: 'View 1 reply', exact: true }).click();
      await page.getByText('First reply', { exact: true }).waitFor();
      const thread = page.getByLabel('Replies to Comment Author', { exact: true });
      await thread.getByRole('button', { name: 'Reply', exact: true }).click();
      const nested = page.getByRole('textbox', { name: 'Reply to Reply Author', exact: true });
      await nested.fill('Nested reply draft');
      failSend = true;
      await page.getByRole('button', { name: 'Post reply', exact: true }).click();
      await page.getByText('Reply test unavailable', { exact: false }).waitFor();
      assert.equal(await nested.inputValue(), 'Nested reply draft');
      failSend = false;
      await page.getByRole('button', { name: 'Post reply', exact: true }).click();
      await page.locator('p').filter({ hasText: /^Nested reply draft$/ }).waitFor();
      assert.equal(writes.at(-1).parentCommentId, replies[1]._id);
      await page.getByRole('button', { name: 'Delete reply', exact: true }).first().click();
      await page.locator('p').filter({ hasText: /^Nested reply draft$/ }).waitFor({ state: 'detached' });
      assert.equal(await page.getByRole('button', { name: 'Delete comment', exact: true }).count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      disabled = true;
      await page.waitForLoadState('networkidle');
      await page.reload();
      await page.getByRole('button', { name: 'Comment', exact: true }).click();
      await page.getByText('Original comment', { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Reply', exact: true }).count(), 0);
      await page.waitForLoadState('networkidle');
      assert.deepEqual(errors, []);
      console.log(`PASS ${name}: reply, double-submit guard, refresh persistence, nested reply, failed draft, deletion, disabled comments, mobile layout`);
      await context.close();
    } finally { await browser.close(); }
  }
} finally { await new Promise(resolve => server.close(resolve)); }
