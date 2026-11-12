import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from '../node_modules/.search-validation/node_modules/playwright/index.mjs';

// Mocked downloads only; no real accounts or messages are changed.
const id = number => number.toString(16).padStart(24, '0');
const bytes = Buffer.from('PK\u0003\u0004Download fixture');
const filename = 'PanVK fixture (1).adpkg.zip';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const mobile of [false, true]) {
    const role = mobile ? 'student' : 'admin';
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 } });
    const page = await context.newPage();
    let fail = false;
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await context.routeWebSocket('**/socket.io/**', socket => socket.close());
    await context.route('**/api/**', async route => {
      const endpoint = new URL(route.request().url()).pathname.replace('/api', '');
      let data = [];
      if (['/auth/me', '/users/me'].includes(endpoint)) data = { _id: id(1), authId: id(2), name: 'Download Tester', role, passwordSetupRequired: false };
      else if (endpoint === '/conversations') data = [{ _id: id(3), name: 'Carl Fixture', authId: id(4), isGroup: false, unread: 0 }];
      else if (endpoint.endsWith('/messages')) data = [{ _id: id(5), from: 'them', readByMe: true, at: '2026-11-12T01:00:00Z', text: '', attachment: { kind: 'file', name: filename, url: `/api/conversations/${id(3)}/messages/${id(5)}/attachment` } }];
      else if (endpoint.endsWith('/attachment')) return fail
        ? route.fulfill({ status: 502, json: { success: false, message: 'Storage unavailable' } })
        : route.fulfill({ contentType: 'application/octet-stream', headers: { 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}` }, body: bytes });
      else if (endpoint === '/notifications/unread-count') data = { count: 0 };
      await route.fulfill({ json: { success: true, data } });
    });
    const url = `http://localhost:5173/${role}/message?conversation=${id(3)}`;
    await page.goto(url);
    const button = page.getByRole('button', { name: `Download ${filename}`, exact: true });
    const downloadEvent = page.waitForEvent('download');
    await button.click();
    const download = await downloadEvent;
    assert.equal(download.suggestedFilename(), filename);
    assert.deepEqual(await readFile(await download.path()), bytes);
    assert.equal(page.url(), url);
    fail = true;
    await button.click();
    await page.getByRole('alert').filter({ hasText: 'Unable to download this file' }).waitFor();
    assert.equal(page.url(), url);
    fail = false;
    const retryEvent = page.waitForEvent('download');
    await button.click();
    await retryEvent;
    assert.equal(await page.getByRole('alert').filter({ hasText: 'Unable to download this file' }).count(), 0);
    assert.deepEqual(errors, []);
    console.log(`PASS ${mobile ? 'mobile' : 'desktop'}: ZIP bytes, filename, no navigation, inline error, retry`);
    await context.close();
  }
} finally { await browser.close(); }
