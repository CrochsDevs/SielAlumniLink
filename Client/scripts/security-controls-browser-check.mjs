import { chromium } from '../node_modules/.search-validation/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';

// Every API write is intercepted and changes only these local fixtures.
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  let role = 'student';
  const selfId = '000000000000000000000001', selfAuthId = '000000000000000000000002';
  const peer = { _id: '000000000000000000000003', authId: '000000000000000000000004',
    name: 'Fixture Mentor', role: 'alumni', program: 'Computer Science', skills: ['JavaScript'], batch: '2025' };
  let connections = [];
  const writes = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.routeWebSocket('**/socket.io/**', socket => socket.close());
  await page.route('**/api/**', route => {
    const req = route.request();
    const endpoint = new URL(req.url()).pathname.replace('/api', '');
    const self = { _id: selfId, authId: selfAuthId, role, name: 'Fixture Member', email: 'self@example.test', passwordSetupRequired: false };
    let data = [];
    if (['/auth/me', '/users/me'].includes(endpoint)) data = self;
    else if (endpoint === '/users') data = [peer];
    else if (endpoint === `/users/${peer._id}`) data = peer;
    else if (endpoint === '/connections/me') data = connections;
    else if (endpoint === '/notifications/unread-count') data = { count: 0 };
    else if (endpoint === '/tracer/access') data = { updateRequired: false, quarter: '2026-Q4' };
    else if (endpoint === '/mentorship/matches') data = { preferences: { interests: [], careerGoals: '' },
      profile: { skills: ['JavaScript'], program: 'Computer Science' }, candidateCount: 1,
      matches: [{ mentor: peer, score: 90, reasons: ['Shared JavaScript skills'] }] };
    else if (endpoint === '/feed') data = { posts: [], nextCursor: null };
    if (req.method() !== 'GET') {
      writes.push({ endpoint, body: req.postDataJSON() });
      if (endpoint === '/connections') data = { _id: 'connection' };
      else if (endpoint === '/conversations') data = { _id: 'conversation', authId: peer.authId, name: peer.name, isGroup: false };
      else if (!endpoint.endsWith('/view')) return route.abort();
    }
    return route.fulfill({ json: { success: true, data } });
  });

  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    role = 'student'; connections = [];
    await page.goto('http://localhost:5173/student/mentorship', { waitUntil: 'networkidle' });
    try {
      await page.getByRole('button', { name: 'Connect', exact: true }).first().click({ timeout: 10000 });
    } catch (error) {
      console.log(JSON.stringify({ url: page.url(), errors, body: (await page.locator('body').innerText()).slice(0, 1600) }));
      throw error;
    }
    await page.getByText(/Request sent to Fixture Mentor/).waitFor();
    assert.deepEqual(writes.filter(write => write.endpoint === '/connections').at(-1).body, { recipientAuthId: peer.authId });

    connections = [{ _id: 'connection', requesterAuthId: selfAuthId, recipientAuthId: peer.authId,
      requesterEmail: 'self@example.test', recipientEmail: 'private-login@example.test', status: 'accepted' }];
    await page.goto(`http://localhost:5173/alumni/profile/${peer._id}`, { waitUntil: 'networkidle' });
    assert.equal(await page.getByText('private-login@example.test', { exact: true }).count(), 0);
    const threadRequest = page.waitForRequest(req => req.method() === 'GET' && req.url().endsWith('/conversations/conversation/messages'));
    await page.getByRole('button', { name: 'Message', exact: true }).first().click();
    await threadRequest;
    assert.deepEqual(writes.filter(write => write.endpoint === '/conversations').at(-1).body, { recipientAuthId: peer.authId });
  }
  for (role of ['student', 'alumni', 'admin']) {
    await page.goto(`http://localhost:5173/${role}/${role === 'admin' ? 'settings' : 'accounts'}`, { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      const { getSocket } = await import('/src/realtime/socket.js');
      getSocket().listeners('auth:revoked').forEach(listener => listener());
    });
    await page.waitForURL('**/login');
    await page.getByRole('button', { name: /send single-use link/i }).waitFor();
  }
  assert.deepEqual(errors, []);
  console.log('PASS: mobile/desktop mentor Connect and profile Message work using account IDs without directory emails; socket revocation returns all three roles to login. All API writes were mocked.');
} finally { await browser.close(); }
