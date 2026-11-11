import assert from 'node:assert/strict';
import path from 'node:path';
import express from '../../Server/node_modules/express/index.js';
import { serveClient } from '../../Server/config/client-app.js';
import { chromium } from '../node_modules/.search-validation/node_modules/playwright/index.mjs';

// Production UI with isolated accounts, notifications and feed responses.
const app = express();
serveClient(app, path.resolve('dist'));
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const postId = 'aaaaaaaaaaaaaaaaaaaaaaaa', ownerId = 'bbbbbbbbbbbbbbbbbbbbbbbb';
  for (const role of ['alumni', 'student', 'admin']) {
    const context = await browser.newContext({ viewport: { width: role === 'student' ? 390 : 1440, height: 900 } });
    await context.routeWebSocket('**/socket.io/**', socket => socket.close());
    const page = await context.newPage(), errors = [], reads = [];
    page.on('pageerror', error => errors.push(error.message));
    const user = { _id: ownerId, authId: ownerId, role, name: 'Post Owner', email: 'owner@example.test', passwordSetupRequired: false };
    const notices = [
      ['feed_comment', 'Alex Rivera', 'commented on your post.'],
      ['feed_like', 'Taylor Cruz', 'liked your post.'],
      ['feed_share', 'Jamie Santos', 'shared your post.'],
    ].map(([kind, name, action], i) => ({
      _id: String(i + 1).padStart(24, '0'), kind, actor: { name },
      title: `${name} ${action}`, body: 'A milestone from the post owner',
      link: `/feed?post=${postId}`, read: false, createdAt: new Date().toISOString(),
    }));
    const post = { _id: postId, author: user, type: 'update', title: '', body: 'A milestone from the post owner',
      audience: 'public', createdAt: new Date().toISOString(), images: [], details: {}, isMine: true,
      likesCount: 1, commentsCount: 1, sharesCount: 1 };
    await page.route('**/api/**', route => {
      const endpoint = new URL(route.request().url()).pathname.replace('/api', '');
      let data = [];
      if (['/auth/me', '/users/me'].includes(endpoint)) data = user;
      else if (endpoint === '/notifications') data = notices;
      else if (endpoint === '/notifications/unread-count') data = { count: 3 };
      else if (endpoint.endsWith('/read') && endpoint.startsWith('/notifications/')) reads.push(endpoint);
      else if (endpoint === `/feed/${postId}`) data = post;
      else if (endpoint === '/feed') data = { posts: [post], nextCursor: null };
      else if (endpoint === '/feed/status') data = { restricted: false };
      else if (endpoint === '/tracer/access') data = { updateRequired: false, quarter: '2026-Q4', nextUpdateAt: '2027-01-01T00:00:00Z' };
      return route.fulfill({ json: { success: true, data } });
    });
    await page.goto(`${origin}/${role}/message`);
    await page.getByRole('button', { name: 'Notifications', exact: true }).click();
    const panel = page.locator('.notifications-panel');
    await panel.getByText('Alex Rivera', { exact: true }).waitFor();
    for (const [, name, action] of [
      ['feed_comment', 'Alex Rivera', 'commented on your post.'],
      ['feed_like', 'Taylor Cruz', 'liked your post.'],
      ['feed_share', 'Jamie Santos', 'shared your post.'],
    ]) {
      assert.ok(await panel.getByRole('button', { name: new RegExp(`${name} ${action.replace('.', '\\.')}`) }).isVisible());
    }
    await page.screenshot({ path: path.resolve(`../artifacts/feed-notifications-${role}.png`), fullPage: true });
    await panel.getByRole('button', { name: /Alex Rivera commented on your post/ }).click();
    await page.waitForURL(`**/feed?post=${postId}`);
    await page.getByText(post.body, { exact: true }).waitFor();
    assert.ok(reads.some(endpoint => endpoint.includes(notices[0]._id)));
    assert.deepEqual(errors, []);
    console.log(`PASS ${role}: commenter, liker, sharer, notification read and post navigation`);
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
