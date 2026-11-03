import { chromium } from '../node_modules/.search-validation/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';

// Isolated UI fixtures: all API/socket/image requests are intercepted.
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const id = value => value.toString(16).padStart(24, '0');
const errors = [];
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    const self = id(1), sender = id(2), group = id(10), role = mobile ? 'student' : 'admin';
    const photo = 'https://images.example.test/alex.svg';
    let name = 'Alex Fixture';
    const conversation = { _id: group, name: 'Project Fixture', isGroup: true, memberCount: 3, unread: 0, time: new Date().toISOString() };
    const history = () => [
      { _id: id(20), from: 'them', senderAuthId: sender, senderEmail: 'old-login@example.test', senderName: name, senderProfilePicture: photo, text: 'Historical group message', readByMe: true, at: '2026-10-29T01:00:00Z' },
      { _id: id(21), from: 'them', senderAuthId: id(3), senderEmail: 'another-login@example.test', senderName: 'No Photo Fixture', senderProfilePicture: null, text: 'No photo message', readByMe: true, at: '2026-10-29T01:01:00Z' },
    ];
    await context.route('https://images.example.test/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="#009639"/></svg>' }));
    await context.routeWebSocket('**/socket.io/**', socket => socket.close());
    await context.route('**/api/**', route => {
      const req = route.request(), endpoint = new URL(req.url()).pathname.replace('/api', '');
      let data = [];
      if (['/auth/me', '/users/me'].includes(endpoint)) data = { _id: id(4), authId: self, name: 'Self Fixture', role, email: 'self@example.test', passwordSetupRequired: false };
      else if (endpoint === '/conversations') data = [conversation];
      else if (endpoint.endsWith('/messages')) data = history();
      else if (endpoint.endsWith('/read')) data = { conversationId: group, readerAuthId: self, messageIds: req.postDataJSON().messageIds, unread: 0 };
      else if (endpoint === '/notifications/unread-count') data = { count: 0 };
      else if (endpoint === '/tracer/access') data = { updateRequired: false, quarter: '2026-Q4', nextUpdateAt: '2027-01-01T00:00:00Z' };
      return route.fulfill({ json: { success: true, data } });
    });
    await page.goto(`http://localhost:5173/${role}/message`);
    const groupSection = text => page.locator('.message-stream-group').filter({ hasText: text });
    await groupSection('Historical group message').getByText(name, { exact: true }).waitFor();
    const avatar = groupSection('Historical group message').locator('img');
    await avatar.waitFor();
    assert.equal(await avatar.getAttribute('src'), photo);
    await page.waitForFunction(() => document.querySelector('.message-stream-avatar img')?.naturalWidth > 0);
    assert.equal(await page.getByText('old-login@example.test', { exact: true }).count(), 0);
    assert.equal(await groupSection('No photo message').locator('.message-stream-avatar').textContent(), 'N');
    await page.evaluate(async ({ group, sender, photo, name }) => {
      const { getSocket } = await import('/src/realtime/socket.js');
      getSocket().emitEvent(['message:new', { conversationId: group, message: { _id: '000000000000000000000022', senderAuthId: sender,
        senderEmail: 'old-login@example.test', senderName: name, senderProfilePicture: photo, text: 'Live group message', at: new Date().toISOString() } }]);
    }, { group, sender, photo, name });
    await groupSection('Live group message').getByText(name, { exact: true }).waitFor();
    assert.equal(await groupSection('Live group message').locator('img').getAttribute('src'), photo);
    name = 'Updated Alex';
    await page.evaluate(async ({ sender, name, photo }) => {
      const { getSocket } = await import('/src/realtime/socket.js');
      getSocket().emitEvent(['profile:updated', { authId: sender, name, profilePicture: photo }]);
    }, { sender, name, photo });
    await groupSection('Historical group message').getByText(name, { exact: true }).waitFor();
    await groupSection('Live group message').getByText(name, { exact: true }).waitFor();
    assert.equal(await page.getByText('Alex Fixture', { exact: true }).count(), 0);
    if (!mobile) {
      await page.evaluate(({ self, group, conversation }) => {
        localStorage.setItem(`chatdock:${self}`, JSON.stringify({ openChats: [{ id: group, convo: conversation, minimized: false }], threads: {} }));
      }, { self, group, conversation });
      await page.goto('http://localhost:5173/admin/accounts');
      const dock = page.getByRole('log', { name: 'Messages with Project Fixture' });
      await dock.getByText(name, { exact: true }).waitFor();
      assert.equal(await dock.getByRole('img', { name: `${name} profile picture` }).getAttribute('src'), photo);
      assert.equal(await dock.getByText('old-login@example.test', { exact: true }).count(), 0);
    }
    await context.close();
    console.log(`PASS ${mobile ? 'mobile' : 'desktop and floating chat'}: group sender name/photo, history, realtime messages, profile updates, missing-photo fallback`);
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
