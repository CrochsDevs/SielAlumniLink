import assert from 'node:assert/strict';
import { chromium } from '../node_modules/.search-validation/node_modules/playwright/index.mjs';

// Mock every API/socket request; never read or change real accounts or posts.
const id = number => number.toString(16).padStart(24, '0');
const person = (number, name) => ({ _id: id(number), authId: id(number + 100), name, role: 'alumni', program: 'BS Information Technology', batch: '2025' });
const user = { ...person(1, 'Fixture Student'), role: 'student', passwordSetupRequired: false };
const author = person(2, 'Post Author');
const first = person(3, 'First Liker'), second = person(4, 'Second Liker');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let failLikes = false, empty = false, commentsLoaded = 0;
    await context.routeWebSocket('**/socket.io/**', socket => socket.close());
    await context.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      const endpoint = url.pathname.replace('/api', '');
      let data = [];
      if (['/auth/me', '/users/me'].includes(endpoint)) data = user;
      else if (endpoint === '/feed/status') data = { restricted: false };
      else if (endpoint === '/feed') data = { posts: [{ _id: id(10), author, body: 'Engagement fixture', type: 'update', audience: 'public', images: [], createdAt: '2026-11-12T01:00:00Z', likesCount: empty ? 0 : 2, commentsCount: 1, sharesCount: 0 }], nextCursor: null };
      else if (endpoint.endsWith('/likes')) {
        if (failLikes) return route.fulfill({ status: 503, json: { success: false, message: 'Likes fixture unavailable' } });
        data = empty ? { people: [], nextCursor: null } : url.searchParams.has('before') ? { people: [second], nextCursor: null } : { people: [first], nextCursor: first.authId };
      } else if (endpoint.endsWith('/comments')) {
        commentsLoaded++;
        data = { comments: [{ _id: id(20), author: person(5, 'Comment Author'), body: 'Visible fixture comment', createdAt: '2026-11-12T02:00:00Z', repliesCount: 0 }], nextCursor: null };
      } else if (endpoint === '/notifications/unread-count') data = { count: 0 };
      return route.fulfill({ json: { success: true, data } });
    });
    await page.goto('http://localhost:5173/feed');
    await page.getByRole('button', { name: 'View 2 likes', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'People who liked this post' });
    await dialog.getByRole('link', { name: /First Liker/ }).waitFor();
    assert.equal(await dialog.getByRole('link', { name: /First Liker/ }).getAttribute('href'), `/alumni/profile/${first._id}`);
    await dialog.getByRole('button', { name: 'Show more', exact: true }).click();
    await dialog.getByRole('link', { name: /Second Liker/ }).waitFor();
    assert.equal(await dialog.getByRole('link').count(), 2);
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });

    failLikes = true;
    await page.getByRole('button', { name: 'View 2 likes', exact: true }).click();
    await dialog.getByRole('alert').waitFor();
    failLikes = false;
    await dialog.getByRole('button', { name: 'Retry', exact: true }).click();
    await dialog.getByRole('link', { name: /First Liker/ }).waitFor();
    await dialog.getByRole('button', { name: 'Close dialog' }).click();
    assert.equal(commentsLoaded, 0, 'likes must not open comments');
    await page.getByRole('button', { name: '1 comment', exact: true }).click();
    await page.getByText('Visible fixture comment', { exact: true }).waitFor();
    assert.equal(await page.getByRole('link', { name: /Comment Author/ }).getAttribute('href'), `/alumni/profile/${id(5)}`);
    assert.equal(await page.getByRole('button', { name: '1 comment', exact: true }).getAttribute('aria-expanded'), 'true');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

    empty = true;
    await page.reload();
    await page.getByRole('button', { name: 'View 0 likes', exact: true }).click();
    await dialog.getByText('No likes yet.', { exact: true }).waitFor();
    await dialog.getByRole('button', { name: 'Close dialog' }).click();

    // Render a saved chat mention and check its final CSS, including dark mode.
    await page.evaluate(async () => {
      const { default: React } = await import('/node_modules/.vite/deps/react.js');
      const { default: ReactDOM } = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { default: MessageBubble } = await import('/src/components/chat/MessageBubble.jsx');
      const host = document.createElement('div');
      document.body.append(host);
      ReactDOM.createRoot(host).render(React.createElement(MessageBubble, { mine: false, msg: { text: '@Angelo Castro hi', mentions: [{ authId: 'fixture', name: 'Angelo Castro', start: 0, end: 14 }] } }));
    });
    const mention = page.locator('[data-mention-auth-id="fixture"]');
    await mention.waitFor();
    for (const dark of [false, true]) {
      await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), dark);
      assert.equal(await mention.evaluate(element => getComputedStyle(element).textDecorationLine), 'none');
      assert.equal(await mention.evaluate(element => getComputedStyle(element).fontWeight), '700');
    }
    assert.deepEqual(errors, []);
    console.log(`PASS ${mobile ? 'mobile' : 'desktop'}: likes, profiles, pagination, retry, empty state, comment authors, mentions without underline`);
    await context.close();
  }
} finally { await browser.close(); }
