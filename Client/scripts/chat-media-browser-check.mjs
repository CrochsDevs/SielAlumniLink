import { chromium } from '../node_modules/.search-validation/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';

// Every API/socket request is mocked; this test never changes real chat records.
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZYsAAAAASUVORK5CYII=';
try {
  for (const variant of ['desktop', 'mobile', 'dock']) {
    const mobile = variant === 'mobile';
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, hasTouch: mobile, isMobile: mobile });
    const page = await context.newPage(), errors = [], writes = [];
    const role = mobile ? 'student' : 'admin';
    const conversation = { _id: 'conversation', authId: 'other', name: 'Alex Fixture', isGroup: false, unread: 0 };
    let fail = false;
    page.on('pageerror', error => errors.push(error.message));
    await context.routeWebSocket('**/socket.io/**', socket => socket.close());
    await context.route('**/api/**', route => {
      const req = route.request(), endpoint = new URL(req.url()).pathname.replace('/api', '');
      let data = [];
      if (endpoint.endsWith('/attachment')) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="300"><rect width="900" height="300" fill="#8ac6a1"/><text x="40" y="160" font-size="44">Chat photo fixture</text></svg>' });
      if (['/auth/me', '/users/me'].includes(endpoint)) data = { _id: 'profile', authId: 'self', role, name: 'Tester', email: 'self@example.test', passwordSetupRequired: false };
      else if (endpoint === '/conversations') data = [conversation];
      else if (endpoint.endsWith('/messages') && req.method() === 'POST') {
        const body = req.postDataBuffer().toString('latin1');
        const text = body.match(/name="text"\r\n\r\n([\s\S]*?)\r\n--/)?.[1] || '';
        assert.ok(req.headers()['content-type'].startsWith('multipart/form-data; boundary='));
        assert.ok(body.includes('name="file"; filename="clipboard.png"'));
        assert.equal(body.includes('data:image/'), false, 'message uploads must not contain base64');
        writes.push({ text });
        if (fail) return route.fulfill({ status: 502, json: { success: false, message: 'Fixture upload failed' } });
        data = { _id: `saved-${writes.length}`, from: 'me', text, read: false,
          attachment: { kind: 'image', name: 'clipboard.png', url: `/api/conversations/conversation/messages/saved-${writes.length}/attachment` } };
      } else if (endpoint === '/notifications/unread-count') data = { count: 0 };
      else if (endpoint === '/tracer/access') data = { updateRequired: false, quarter: '2026-Q4', nextUpdateAt: '2027-01-01T00:00:00Z' };
      return route.fulfill({ json: { success: true, data } });
    });
    await page.goto(`http://localhost:5173/${role}/message`);
    if (variant === 'dock') {
      await page.evaluate(conversation => localStorage.setItem('chatdock:self', JSON.stringify({ openChats: [{ id: 'conversation', convo: conversation, minimized: false }], threads: {} })), conversation);
      await page.goto('http://localhost:5173/admin/accounts');
    }
    const scope = variant === 'dock' ? page.locator('.fixed.bottom-0.right-4') : page.locator('.inbox-thread');
    const field = scope.locator('form input:not([type="file"])');
    const preview = () => scope.getByRole('img', { name: 'Image ready to send' });
    const paste = () => field.evaluate((element, png) => {
      const data = new DataTransfer();
      data.items.add(new File([Uint8Array.from(atob(png), char => char.charCodeAt(0))], 'clipboard.png', { type: 'image/png' }));
      element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    }, png);
    const send = scope.getByRole('button', { name: 'Send message', exact: true });
    await field.waitFor();
    await paste(); await preview().waitFor();
    assert.ok((await preview().getAttribute('src')).startsWith('blob:'), 'local preview uses an object URL');
    assert.equal(writes.length, 0, 'paste must not upload immediately');
    await scope.getByRole('button', { name: 'Remove attachment' }).click();
    assert.equal(await preview().count(), 0);
    await paste(); await preview().waitFor(); await send.click();
    await preview().waitFor({ state: 'detached' });
    const photo = scope.locator('[data-slot="message-photo"]').first();
    await photo.waitFor();
    await page.waitForFunction(() => document.querySelector('[data-slot="message-photo"] img')?.naturalWidth > 0);
    const bubble = photo.locator('..');
    assert.equal(await bubble.locator('[data-slot="bubble-content"]').count(), 0, 'photo-only message has no padded green content bubble');
    assert.ok((await photo.boundingBox()).width <= 322, 'photo has a compact Messenger-style width');
    const source = await photo.locator('img').getAttribute('src');
    assert.ok(source.startsWith('http://localhost:3002/api/conversations/'), 'image loads from the protected API');
    await photo.click();
    await page.getByRole('dialog', { name: 'Photo viewer' }).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('dialog', { name: 'Photo viewer' }).waitFor({ state: 'detached' });
    await field.fill('A photo caption'); await paste(); await preview().waitFor(); await send.click();
    await preview().waitFor({ state: 'detached' });
    await scope.getByText('A photo caption', { exact: true }).waitFor();
    assert.equal(writes[1].text, 'A photo caption');
    fail = true; await paste(); await preview().waitFor(); await send.click();
    await page.getByText('Fixture upload failed', { exact: true }).waitFor();
    assert.equal(await preview().count(), 1, 'failed Cloudinary send retains the local file for retry');
    fail = false; await send.click(); await preview().waitFor({ state: 'detached' });
    await page.screenshot({ path: path.join(os.tmpdir(), `SielAlumni-chat-media-${variant}.png`) });
    assert.deepEqual(errors, []);
    console.log(`PASS ${variant}: preview/remove, multipart upload, protected image URL, photo without green frame, caption, viewer/Escape, failed-upload retry`);
    await context.close();
  }
} finally { await browser.close(); }
