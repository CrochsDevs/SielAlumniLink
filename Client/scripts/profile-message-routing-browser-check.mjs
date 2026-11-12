import assert from 'node:assert/strict';
import { chromium } from '../node_modules/.search-validation/node_modules/playwright/index.mjs';

// Isolated fixtures: no real accounts, conversations or messages are changed.
const id = number => number.toString(16).padStart(24, '0');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const role of ['student', 'alumni', 'admin']) {
    for (const width of [390, 700, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      const errors = [], recipients = [];
      page.on('pageerror', error => errors.push(error.message));
      const user = { _id: id(1), authId: id(2), name: 'Self Fixture', role, email: 'self@example.test', passwordSetupRequired: false };
      const profile = { _id: id(3), authId: id(4), name: 'Carl Fixture', role: 'alumni', program: 'Information Technology', batch: '2023', skills: [], employmentHistory: [], education: [] };
      const conversation = { _id: id(5), authId: profile.authId, name: profile.name, isGroup: false, unread: 0 };
      await context.routeWebSocket('**/socket.io/**', socket => socket.close());
      await context.route('**/api/**', async route => {
        const request = route.request(), endpoint = new URL(request.url()).pathname.replace('/api', '');
        let data = [];
        if (['/auth/me', '/users/me'].includes(endpoint)) data = user;
        else if (endpoint === `/users/${profile._id}`) data = profile;
        else if (endpoint === '/connections/me') data = [{ _id: id(6), requesterAuthId: user.authId, recipientAuthId: profile.authId, status: 'accepted' }];
        else if (endpoint === '/conversations' && request.method() === 'POST') { recipients.push(request.postDataJSON()); data = conversation; }
        else if (endpoint === '/conversations') data = [conversation];
        else if (endpoint.endsWith('/messages')) data = [{ _id: id(7), from: 'them', text: 'Selected profile conversation', readByMe: true, at: '2026-11-12T01:00:00Z' }];
        else if (endpoint === '/notifications/unread-count') data = { count: 0 };
        else if (endpoint === '/tracer/access') data = { updateRequired: false, quarter: '2026-Q4', nextUpdateAt: '2027-01-01T00:00:00Z' };
        await route.fulfill({ json: { success: true, data } });
      });
      const profileUrl = `http://localhost:5173/alumni/profile/${profile._id}`;
      await page.goto(profileUrl);
      await page.getByRole('button', { name: 'Message', exact: true }).click();
      assert.deepEqual(recipients, [{ recipientAuthId: profile.authId }]);
      if (width < 768) {
        await page.waitForURL(`**/${role}/message?conversation=${conversation._id}`);
        await page.getByRole('textbox', { name: 'Message Carl...' }).waitFor();
        await page.getByText('Selected profile conversation', { exact: true }).waitFor();
      } else {
        await page.getByRole('log', { name: `Messages with ${profile.name}` }).getByText('Selected profile conversation', { exact: true }).waitFor();
        assert.equal(page.url(), profileUrl);
      }
      assert.deepEqual(errors, []);
      console.log(`PASS ${role} at ${width}px: profile Message opens ${width < 768 ? 'the selected inbox conversation' : 'the floating chat'}`);
      await context.close();
    }
  }
} finally { await browser.close(); }
