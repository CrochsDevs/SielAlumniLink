import { chromium } from '../node_modules/.search-validation/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';

// All API/socket traffic is mocked. No real messages, accounts or blocks are changed.
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const id = n => n.toString(16).padStart(24, '0');
const errors = [];
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    const self = id(1), direct = id(10), group = id(11), role = mobile ? 'student' : 'admin';
    const conversations = [
      { _id: direct, authId: id(2), name: 'Alex Fixture', email: 'alex@example.test', isGroup: false, unread: 1, preview: 'Latest fixture', time: '2026-10-29T02:00:00Z' },
      { _id: group, name: 'Fixture Group', isGroup: true, memberCount: 3, adminAuthIds: [self], createdBy: self, unread: 0, time: '2026-10-28T02:00:00Z' },
    ];
    const messages = [
      { _id: id(20), from: 'me', text: 'Previously sent', read: false, at: '2026-10-29T01:00:00Z' },
      { _id: id(21), from: 'me', text: 'Previously read', read: true, at: '2026-10-29T01:01:00Z' },
      { _id: id(22), from: 'them', text: 'Incoming fixture', readByMe: false, at: '2026-10-29T01:02:00Z' },
    ];
    const reads = [], sends = [], writes = [];
    let deleted = false, rejectDelete = false;
    await context.routeWebSocket('**/socket.io/**', socket => socket.close());
    await context.route('**/api/**', async route => {
      const request = route.request(), endpoint = new URL(request.url()).pathname.replace('/api', '');
      const method = request.method();
      let data = [];
      if (['/auth/me', '/users/me'].includes(endpoint)) data = { _id: id(3), authId: self, role, name: 'Fixture Tester', email: 'tester@example.test', passwordSetupRequired: false };
      else if (endpoint === '/conversations') data = conversations.filter(row => !deleted || row._id !== direct);
      else if (endpoint.endsWith('/read')) {
        const ids = request.postDataJSON().messageIds;
        reads.push(...ids);
        messages.forEach(message => { if (ids.includes(message._id)) message.readByMe = true; });
        data = { conversationId: endpoint.split('/')[2], readerAuthId: self, messageIds: ids, unread: 0 };
      } else if (endpoint.endsWith('/messages') && method === 'GET') data = endpoint.includes(direct) ? messages : [];
      else if (endpoint.endsWith('/messages') && method === 'POST') {
        sends.push({ route, body: request.postDataJSON() });
        return; // Explicitly held to inspect Sending… and acknowledgement races.
      } else if (endpoint.endsWith('/block')) {
        writes.push(method + endpoint);
        conversations[0].blocked = conversations[0].blockedByMe = method === 'POST';
        data = conversations[0];
      } else if (method === 'DELETE' && endpoint === `/conversations/${direct}`) {
        writes.push(method + endpoint);
        if (rejectDelete) return route.fulfill({ status: 500, json: { success: false, message: 'Fixture delete failed' } });
        deleted = true;
        data = { conversationId: direct, clearedAt: new Date().toISOString() };
      } else if (endpoint === '/notifications/unread-count') data = { count: 0 };
      else if (endpoint === '/tracer/access') data = { updateRequired: false, quarter: '2026-Q4', nextUpdateAt: '2027-01-01T00:00:00Z' };
      return route.fulfill({ json: { success: true, data } });
    });
    await page.goto(`http://localhost:5173/${role}/message`);
    await page.bringToFront();
    const bubble = text => page.locator('[data-slot="bubble"]').filter({ hasText: text });
    await bubble('Previously sent').getByText('Sent', { exact: true }).waitFor();
    await bubble('Previously read').getByText('Read', { exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelector('[data-chat-thread] [data-read-id]') === null);
    assert.ok(reads.includes(id(22)), 'visible incoming messages are acknowledged');

    // Same-text concurrent sends use distinct correlation IDs. Socket acknowledgement
    // and a receipt can arrive before the original HTTP response.
    const input = page.getByPlaceholder('Message Alex...');
    for (let n = 0; n < 2; n++) { await input.fill('Concurrent fixture'); await input.press('Enter'); }
    await page.waitForFunction(() => document.querySelectorAll('[data-slot="bubble"] [aria-live]').length >= 4);
    assert.equal(await bubble('Concurrent fixture').getByText('Sending…', { exact: true }).count(), 2);
    while (sends.length < 2) await new Promise(resolve => setTimeout(resolve, 20));
    await page.evaluate(async ({ direct, self, body, savedId }) => {
      const { getSocket } = await import('/src/realtime/socket.js');
      getSocket().emitEvent(['message:new', { conversationId: direct, message: { _id: savedId, senderAuthId: self, ...body, at: new Date().toISOString() } }]);
      getSocket().emitEvent(['message:read', { conversationId: direct, readerAuthId: 'recipient', messageIds: [savedId] }]);
    }, { direct, self, body: sends[0].body, savedId: id(30) });
    await bubble('Concurrent fixture').getByText('Read', { exact: true }).waitFor();
    assert.equal(await bubble('Concurrent fixture').getByText('Sending…', { exact: true }).count(), 1);
    for (let n = 0; n < 2; n++) await sends[n].route.fulfill({ status: 201, json: { success: true, data: { ...sends[n].body, _id: id(30 + n), from: 'me', read: false, at: new Date().toISOString() } } });
    await bubble('Concurrent fixture').getByText('Sent', { exact: true }).waitFor();
    assert.equal(await bubble('Concurrent fixture').count(), 2);
    assert.equal(await bubble('Concurrent fixture').getByText('Read', { exact: true }).count(), 1);
    await page.screenshot({ path: path.join(os.tmpdir(), `SielAlumni-chat-delivery-${mobile ? 'mobile' : 'desktop'}.png`) });

    const back = async () => { if (mobile && await page.getByRole('button', { name: 'Back to conversations' }).isVisible()) await page.getByRole('button', { name: 'Back to conversations' }).click(); };
    await back();
    for (const dark of [false, true]) {
      await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), dark);
      assert.equal(await page.locator(mobile ? '.inbox-conversation-item' : '.inbox-conversation-item[aria-pressed="true"]').first().evaluate(element => getComputedStyle(element).backgroundColor), 'rgba(0, 0, 0, 0)');
    }
    const options = () => page.getByRole('button', { name: 'Chat options for Alex Fixture' });
    await options().click();
    assert.deepEqual(await page.getByRole('menuitem').allTextContents(), ['Block', 'Delete chat']);
    const bounds = await page.getByRole('menu').boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= page.viewportSize().width);
    await page.keyboard.press('Escape');
    assert.equal(await options().getAttribute('aria-expanded'), 'false');
    await options().click(); await page.getByRole('menuitem', { name: 'Block', exact: true }).click();
    await page.getByRole('button', { name: 'Block', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.conversation-actions-trigger:not([disabled])'));
    if (mobile) await page.locator('.inbox-conversation-item').filter({ hasText: 'Alex Fixture' }).click();
    await page.getByText('You blocked this account. Use the chat options to unblock it.').waitFor();
    assert.equal(await input.count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Voice call', exact: true }).count(), 0);
    await back(); await options().click(); await page.getByRole('menuitem', { name: 'Unblock', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.conversation-actions-trigger:not([disabled])'));
    if (mobile) await page.locator('.inbox-conversation-item').filter({ hasText: 'Alex Fixture' }).click();
    await input.waitFor();
    await back();
    await options().click(); await page.getByRole('menuitem', { name: 'Delete chat' }).click();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(writes.filter(value => value === `DELETE/conversations/${direct}`).length, 0);
    rejectDelete = true;
    await options().click(); await page.getByRole('menuitem', { name: 'Delete chat' }).click();
    await page.getByRole('button', { name: 'Delete chat', exact: true }).click();
    await page.getByText('Fixture delete failed', { exact: true }).waitFor();
    await options().waitFor();
    rejectDelete = false;
    await options().click(); await page.getByRole('menuitem', { name: 'Delete chat' }).click();
    await page.getByRole('button', { name: 'Delete chat', exact: true }).click();
    await options().waitFor({ state: 'detached' });
    await page.reload();
    await page.locator('.inbox-thread-header').waitFor();
    await back();
    await page.getByRole('button', { name: 'Chat options for Fixture Group' }).click();
    assert.deepEqual(await page.getByRole('menuitem').allTextContents(), ['Delete chat']);
    assert.equal(await options().count(), 0);
    if (!mobile) {
      // Cached/minimized chats must not produce receipts merely from fetching.
      deleted = false;
      messages.push(...Array.from({ length: 35 }, (_, n) => ({ _id: id(100 + n), from: 'them', text: `Dock incoming ${n}`, readByMe: false, at: new Date(Date.now() + n).toISOString() })));
      await page.evaluate(({ self, direct, conversation, messages }) => {
        localStorage.setItem(`chatdock:${self}`, JSON.stringify({ openChats: [{ id: direct, convo: conversation, minimized: true }], threads: { [direct]: messages } }));
      }, { self, direct, conversation: conversations[0], messages });
      await page.goto('http://localhost:5173/admin/accounts', { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Restore chat with Alex Fixture' }).waitFor();
      assert.equal(reads.includes(id(134)), false, 'minimized cache fetch must not mark messages read');
      await page.getByRole('button', { name: 'Restore chat with Alex Fixture' }).click();
      await page.waitForFunction(id => !document.querySelector(`[data-read-id="${id}"]`), id(134));
      assert.equal(reads.includes(id(134)), true, 'visible dock message is acknowledged');
      assert.equal(reads.includes(id(100)), false, 'offscreen message above the scroll viewport stays unread');
      const dock = page.getByRole('log', { name: 'Messages with Alex Fixture' });
      await dock.getByText('Previously sent', { exact: true }).waitFor({ state: 'attached' });
      assert.equal(await dock.locator('[data-slot="bubble"]').filter({ hasText: 'Previously sent' }).getByText('Sent', { exact: true }).count(), 1);
      assert.equal(await dock.locator('[data-slot="bubble"]').filter({ hasText: 'Previously read' }).getByText('Read', { exact: true }).count(), 1);
      // Headless Edge keeps pages focused, so explicitly exercise the browser
      // visibility/focus guard with a hidden-tab fixture.
      await page.evaluate(() => {
        Object.defineProperty(document, 'hasFocus', { configurable: true, value: () => false });
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await page.evaluate(async ({ direct, messageId }) => {
        const { getSocket } = await import('/src/realtime/socket.js');
        getSocket().emitEvent(['message:new', { conversationId: direct, message: { _id: messageId, senderAuthId: 'recipient', text: 'Background incoming', at: new Date().toISOString() } }]);
      }, { direct, messageId: id(150) });
      await new Promise(resolve => setTimeout(resolve, 350));
      assert.equal(reads.includes(id(150)), false, 'inactive tab must not acknowledge incoming messages');
      await page.evaluate(() => {
        delete document.hasFocus; delete document.visibilityState;
        window.dispatchEvent(new Event('focus'));
      });
      await page.waitForFunction(id => !document.querySelector(`[data-read-id="${id}"]`), id(150));
      assert.equal(reads.includes(id(150)), true);
    }
    await context.close();
    console.log(`PASS ${mobile ? 'mobile student' : 'desktop admin'}: sending/sent/read, read acknowledgement, concurrent sends, menu, block/unblock, delete/cancel/failure, group menu`);
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
