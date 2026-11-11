import assert from 'node:assert/strict';
import path from 'node:path';
import express from '../../Server/node_modules/express/index.js';
import multer from '../../Server/node_modules/multer/index.js';
import { serveClient } from '../../Server/config/client-app.js';
import { resolveMessageMentions } from '../../Server/modules/messages/message-mentions.js';
import { chromium, firefox, webkit } from '../node_modules/.search-validation/node_modules/playwright/index.mjs';

// Real production UI and mention validation, with an isolated in-memory API.
const self = 'aaaaaaaaaaaaaaaaaaaaaaaa', jordan = 'bbbbbbbbbbbbbbbbbbbbbbbb', sam = 'cccccccccccccccccccccccc';
const groupId = 'dddddddddddddddddddddddd', directId = 'eeeeeeeeeeeeeeeeeeeeeeee';
const user = { _id: self, authId: self, role: 'admin', name: 'Group Admin', email: 'admin@example.test', passwordSetupRequired: false };
const memberPhoto = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="32" height="32"%3E%3Crect width="32" height="32" fill="green"/%3E%3C/svg%3E';
const members = [{ authId: self, name: user.name }, { authId: jordan, name: 'Jordan Lee', profilePicture: memberPhoto }, { authId: sam, name: 'Sam Cruz' }];
const group = { _id: groupId, isGroup: true, name: 'Mention Group', participants: members, memberCount: 3, adminAuthIds: [self], createdBy: self, unread: 0 };
const direct = { _id: directId, isGroup: false, name: 'Jordan Lee', authId: jordan, unread: 0 };
let messages = [], memberReads = 0, sends = 0, uploads = 0;
const app = express();
app.use(express.json());
app.post('/api/conversations/:id/messages', multer({ storage: multer.memoryStorage() }).single('file'));
app.use('/api', async (req, res) => {
  let data = [];
  if (['/auth/me', '/users/me'].includes(req.path)) data = user;
  else if (req.path === '/conversations') data = [group, direct];
  else if (req.path.endsWith('/members')) { memberReads++; data = { ...group, members }; }
  else if (req.path.endsWith('/read')) data = { conversationId: groupId, readerAuthId: self, messageIds: req.body.messageIds || [], unread: 0 };
  else if (req.path === `/conversations/${groupId}/messages` && req.method === 'POST') {
    sends++;
    const mentions = await resolveMessageMentions(group, req.body.text, req.body.mentionAuthIds, async () => members);
    data = { _id: sends.toString(16).padStart(24, '0'), clientMessageId: req.body.clientMessageId, text: req.body.text, mentions, from: 'me', senderAuthId: self, senderName: user.name, at: new Date().toISOString(), read: false };
    if (req.file) { uploads++; data.attachment = { kind: 'file', name: req.file.originalname, url: '/api/fixture-attachment' }; }
    messages.push(data);
  } else if (req.path.startsWith('/conversations/messages/') && req.method === 'PUT') {
    data = messages.find(message => message._id === req.path.split('/').at(-1));
    data.text = req.body.text;
    data.mentions = await resolveMessageMentions(group, data.text, req.body.mentionAuthIds, async () => members);
    data.edited = true;
  } else if (req.path.endsWith('/messages')) data = req.path.includes(groupId) ? messages : [];
  else if (req.path === '/notifications/unread-count') data = { count: 0 };
  else if (req.path === '/tracer/access') data = { updateRequired: false, quarter: '2026-Q4', nextUpdateAt: '2027-01-01T00:00:00Z' };
  res.json({ success: true, data });
});
serveClient(app, path.resolve(process.env.CLIENT_BUILD_DIR || 'dist'));
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
try {
  for (const [name, engine, options] of [['Edge', chromium, { channel: 'msedge' }], ['Firefox', firefox, {}], ['WebKit', webkit, {}]]) {
    if (process.env.BROWSER_ENGINE && process.env.BROWSER_ENGINE !== name) continue;
    user.role = 'admin';
    messages = []; memberReads = 0; sends = 0; uploads = 0;
    const browser = await engine.launch({ headless: true, ...options });
    try {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await context.routeWebSocket('**/socket.io/**', socket => socket.close());
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => { errors.push(error.message); console.error(name, error.message); });
      await page.goto(`${origin}/admin/message?conversation=${groupId}`);
      let input = page.getByPlaceholder('Message group...');
      await input.waitFor();
      assert.equal(memberReads, 0, 'Member picker loads on demand');
      await input.fill('Hello @Jo');
      await page.getByRole('option', { name: '@Jordan Lee', exact: true }).waitFor();
      const memberOption = page.getByRole('option', { name: '@Jordan Lee', exact: true });
      assert.equal(await memberOption.locator('img').getAttribute('src'), memberPhoto);
      assert.equal(await memberOption.locator('img').evaluate(image => image.complete && image.naturalWidth > 0), true, 'Member picture must load in suggestions');
      await input.press('Enter');
      assert.equal(sends, 0, 'Enter chooses a member instead of submitting prematurely');
      assert.equal(await input.inputValue(), 'Hello @Jordan Lee ');
      await input.pressSequentially('welcome!');
      assert.equal(await page.getByRole('listbox', { name: 'Mention group member' }).count(), 0);
      await page.getByRole('button', { name: 'Send message', exact: true }).click();
      await page.locator(`[data-mention-auth-id="${jordan}"]`).waitFor();
      assert.equal(messages[0].mentions[0].authId, jordan);
      assert.equal(await page.locator(`[data-mention-auth-id="${jordan}"]`).evaluate(node => getComputedStyle(node).fontWeight), '700', 'Account mentions must render bold');
      assert.equal(memberReads, 1, 'Typing must not fetch the members on each keypress');
      await page.waitForLoadState('networkidle');
      await page.reload();
      await page.locator(`[data-mention-auth-id="${jordan}"]`).waitFor();
      await page.getByRole('button', { name: 'Message options', exact: true }).click();
      await page.getByRole('menuitem', { name: 'Edit message', exact: true }).click();
      input = page.getByRole('combobox', { name: 'Edit message text' });
      await input.fill('Updated @Sa');
      await page.getByRole('option', { name: '@Sam Cruz', exact: true }).click();
      await page.getByRole('button', { name: 'Save edit', exact: true }).click();
      await page.locator(`[data-mention-auth-id="${sam}"]`).waitFor();
      assert.equal(await page.locator(`[data-mention-auth-id="${jordan}"]`).count(), 0);
      await page.waitForLoadState('networkidle');
      await page.goto(`${origin}/admin/message?conversation=${directId}`);
      await page.getByPlaceholder('Message Jordan...').fill('@Jo');
      assert.equal(await page.getByRole('listbox', { name: 'Mention group member' }).count(), 0);
      await page.evaluate(group => localStorage.setItem('chatdock:aaaaaaaaaaaaaaaaaaaaaaaa', JSON.stringify({ openChats: [{ id: group._id, convo: group, minimized: false }], threads: {} })), group);
      await page.waitForLoadState('networkidle');
      await page.goto(`${origin}/admin/settings`);
      const dock = page.getByRole('log', { name: 'Messages with Mention Group' });
      await dock.waitFor();
      input = page.getByPlaceholder('Write a message...');
      await input.fill('@Sa');
      await page.getByRole('option', { name: '@Sam Cruz', exact: true }).click();
      await page.getByRole('button', { name: 'Send message', exact: true }).click();
      await dock.locator(`[data-mention-auth-id="${sam}"]`).nth(1).waitFor();
      await page.waitForLoadState('networkidle');
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${origin}/admin/message?conversation=${groupId}`);
      await page.getByPlaceholder('Message group...').fill('@Jo');
      await page.getByRole('option', { name: '@Jordan Lee', exact: true }).waitFor();
      await page.screenshot({ path: path.resolve(`../artifacts/group-mentions-${name}.png`), fullPage: true });
      await page.getByRole('option', { name: '@Jordan Lee', exact: true }).click();
      await page.locator('label[title="Attach file"] input').setInputFiles({ name: 'mention.txt', mimeType: 'text/plain', buffer: Buffer.from('Isolated attachment fixture') });
      await page.getByRole('button', { name: 'Send message', exact: true }).click();
      await page.getByRole('link', { name: 'mention.txt', exact: true }).waitFor();
      assert.equal(uploads, 1);
      assert.equal(messages.at(-1).mentions[0].authId, jordan);
      for (const role of ['alumni', 'student']) {
        user.role = role;
        await page.waitForLoadState('networkidle');
        await page.goto(`${origin}/${role}/message?conversation=${groupId}`);
        input = page.getByPlaceholder('Message group...');
        await input.waitFor();
        await input.pressSequentially('@jordan', { delay: 40 });
        await page.getByRole('option', { name: '@Jordan Lee', exact: true }).waitFor();
        await input.press('Shift+Tab');
        assert.equal(await page.getByRole('listbox', { name: 'Mention group member' }).count(), 0);
        assert.equal(await input.inputValue(), '@jordan', 'Leaving the field must not select a mention');
        // WebKit can keep focus on text fields when full keyboard access is off.
        // Explicitly blur before verifying an actual focus transition.
        await input.evaluate(element => element.blur());
        await input.focus();
        await page.getByRole('option', { name: '@Jordan Lee', exact: true }).waitFor();
        await input.press('Escape');
        await page.getByRole('button', { name: 'Mention a group member', exact: true }).click();
        await page.getByRole('option', { name: '@Jordan Lee', exact: true }).waitFor();
        await page.getByRole('option', { name: '@Jordan Lee', exact: true }).click();
        assert.equal(await input.inputValue(), '@Jordan Lee ');
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.deepEqual(errors, []);
      console.log(`PASS ${name}: picker, send/edit/reload, attachments, floating chat, alumni/student typing, Shift+Tab, and refocus suggestions`);
      await context.close();
    } finally { await browser.close(); }
  }
} finally { await new Promise(resolve => server.close(resolve)); }
