import { chromium } from '../node_modules/.search-validation/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';

// Real browser cookie jars / tab communication; all API and socket traffic is mocked.
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const users = {
  a: { _id: 'profile-a', authId: 'auth-a', role: 'student', name: 'Alpha Fixture', email: 'alpha@example.test', passwordSetupRequired: false },
  b: { _id: 'profile-b', authId: 'auth-b', role: 'student', name: 'Beta Fixture', email: 'beta@example.test', passwordSetupRequired: false },
};
users.c = { ...users.b, passwordSetupRequired: true };
const errors = [], requests = [], disconnects = [];
const cookie = value => ({ name: 'fixture-session', value, url: 'http://localhost:3002', httpOnly: true, sameSite: 'Lax' });
const install = async (context, noChannel = false) => {
  if (noChannel) await context.addInitScript(() => { window.BroadcastChannel = undefined; });
  await context.routeWebSocket('**/socket.io/**', socket => socket.close());
  await context.route('**/api/**', async route => {
    const req = route.request(), endpoint = new URL(req.url()).pathname.replace('/api', '');
    const key = (await req.headerValue('cookie'))?.match(/fixture-session=([abc])/)?.[1];
    const user = users[key] || null;
    const expected = await req.headerValue('x-account-id');
    requests.push({ endpoint, expected, account: user?.authId, method: req.method() });
    const headers = {};
    let data = [], status = 200;
    if (endpoint === '/auth/login') {
      const next = req.postDataJSON().email.startsWith('beta') ? 'b' : 'a';
      data = { user: users[next] };
      headers['set-cookie'] = `fixture-session=${next}; Path=/; HttpOnly; SameSite=Lax`;
    } else if (endpoint === '/auth/magic-link/verify') {
      data = { user: users.c };
      headers['set-cookie'] = 'fixture-session=c; Path=/; HttpOnly; SameSite=Lax';
    } else if (endpoint === '/auth/password/setup') {
      data = { user: users.b };
      headers['set-cookie'] = 'fixture-session=b; Path=/; HttpOnly; SameSite=Lax';
    } else if (endpoint === '/auth/logout') {
      // The real revocation socket may clear local auth before HTTP completes.
      await req.frame().page().evaluate(() => window.dispatchEvent(new Event('auth:expired')));
      headers['set-cookie'] = 'fixture-session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax';
    } else if (['/auth/me', '/users/me'].includes(endpoint)) data = user;
    else if (endpoint === '/conversations') data = user?.authId === 'auth-a' ? [{ _id: 'private-a', name: 'Alpha Contact', authId: 'contact-a', preview: 'ALPHA_PRIVATE_TEXT' }] : [];
    else if (endpoint.endsWith('/messages')) data = [{ _id: 'alpha-message', from: 'them', text: 'ALPHA_PRIVATE_TEXT', at: new Date().toISOString() }];
    else if (endpoint === '/notifications/unread-count') data = { count: 0 };
    else if (endpoint === '/feed') data = { posts: [], nextCursor: null };
    if (expected && user && expected !== user.authId && endpoint !== '/auth/me') {
      return route.fulfill({ status: 409, json: { success: false, code: 'SESSION_ACCOUNT_CHANGED', message: 'Your browser account changed.' } });
    }
    return route.fulfill({ status, headers, json: { success: true, data } });
  });
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
};
const owner = async (page, expected) => {
  await page.waitForFunction(async expected => {
    const { getRequestAccount } = await import('/src/auth/session-sync.js');
    return getRequestAccount() === expected;
  }, expected);
};
const signIn = async (page, email) => {
  await page.getByRole('button', { name: 'Use password instead', exact: true }).click();
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill('Fixture-password');
  await page.getByRole('button', { name: 'Log in with email', exact: true }).click();
};
try {
  for (const noChannel of [false, true]) {
    const context = await browser.newContext();
    await install(context, noChannel);
    await context.addCookies([cookie('a')]);
    const first = await context.newPage(), second = await context.newPage();
    const isolated = await browser.newContext();
    await install(isolated);
    await isolated.addCookies([cookie('a')]);
    const isolatedPage = await isolated.newPage();
    await isolatedPage.goto('http://localhost:5173/student/accounts', { waitUntil: 'networkidle' });
    await first.goto('http://localhost:5173/student/accounts', { waitUntil: 'networkidle' });
    await owner(first, 'auth-a');
    await first.evaluate(() => localStorage.setItem('chatdock:auth-a', JSON.stringify({
      openChats: [{ id: 'private-a', convo: { _id: 'private-a', name: 'Alpha Contact', authId: 'contact-a' }, minimized: false }],
      threads: { 'private-a': [{ _id: 'old', from: 'them', text: 'ALPHA_PRIVATE_TEXT' }] },
    })));
    await first.reload({ waitUntil: 'networkidle' });
    await first.getByText('ALPHA_PRIVATE_TEXT', { exact: true }).waitFor();
    await first.exposeFunction('recordDisconnect', () => disconnects.push(noChannel ? 'storage' : 'broadcast'));
    await first.evaluate(async () => {
      const { getSocket } = await import('/src/realtime/socket.js');
      const socket = getSocket(), original = socket.disconnect.bind(socket);
      socket.disconnect = (...args) => { void window.recordDisconnect(); return original(...args); };
    });
    await second.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
    await owner(second, 'auth-a');
    await signIn(second, 'beta@example.test');
    await first.waitForURL('**/student');
    await second.waitForURL('**/student');
    await owner(first, 'auth-b'); await owner(second, 'auth-b');
    assert.equal(await first.getByText('ALPHA_PRIVATE_TEXT', { exact: true }).count(), 0);
    assert.equal(await first.evaluate(() => (localStorage.getItem('chatdock:auth-b') || '').includes('ALPHA_PRIVATE_TEXT')), false);
    assert.ok(disconnects.includes(noChannel ? 'storage' : 'broadcast'));
    const notice = await first.evaluate(() => localStorage.getItem('alumnilink:session-change'));
    assert.equal(notice.includes('@'), false);
    assert.equal(notice.includes('auth-b'), false);
    assert.equal(await first.evaluate(() => document.cookie.includes('fixture-session')), false);
    assert.equal((await context.cookies()).find(item => item.name === 'fixture-session').value, 'b');
    await owner(isolatedPage, 'auth-a');
    assert.equal((await isolated.cookies()).find(item => item.name === 'fixture-session').value, 'a');

    // Simulate a missed notification: a tab returning to focus must re-read the cookie.
    await context.addCookies([cookie('a')]);
    await first.bringToFront();
    await first.evaluate(() => window.dispatchEvent(new Event('focus')));
    await first.waitForURL('**/student'); await owner(first, 'auth-a');
    await first.getByText(/Welcome back, Alpha/).waitFor();
    await second.bringToFront();
    await second.evaluate(() => window.dispatchEvent(new Event('focus')));
    await owner(second, 'auth-a');
    await second.waitForURL('**/student');
    await second.getByText(/Welcome back, Alpha/).waitFor();

    await second.evaluate(() => { history.pushState({}, '', '/logout'); dispatchEvent(new PopStateEvent('popstate')); });
    await second.getByRole('button', { name: 'Yes, log out', exact: true }).click();
    await first.waitForURL('**/login'); await second.waitForURL('**/login');
    await owner(first, null); await owner(second, null);
    await owner(isolatedPage, 'auth-a');
    console.log(`PASS: ${noChannel ? 'storage fallback' : 'BroadcastChannel'} synchronizes login/logout, clears old chats, reconnects sessions and revalidates missed changes on focus.`);
    await context.close();
    await isolated.close();
  }
  const magicContext = await browser.newContext();
  await install(magicContext);
  const peer = await magicContext.newPage(), verification = await magicContext.newPage();
  await peer.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
  await verification.goto('http://localhost:5173/verify-magic-link?token=fixture-setup', { waitUntil: 'networkidle' });
  await peer.waitForURL('**/setup-password');
  await verification.waitForURL('**/setup-password');
  assert.equal(requests.filter(req => req.endpoint === '/auth/magic-link/verify').length, 1, 'The single-use verification must not be replayed on remount');
  await peer.getByPlaceholder('Enter a new password', { exact: true }).fill('New-fixture-password');
  await peer.getByPlaceholder('Confirm your new password', { exact: true }).fill('New-fixture-password');
  await peer.getByRole('button', { name: 'Set password', exact: true }).click();
  await peer.waitForURL('**/student'); await verification.waitForURL('**/student');
  await owner(peer, 'auth-b'); await owner(verification, 'auth-b');
  console.log('PASS: magic-link sign-in and first-password setup synchronize both tabs without replaying the login link; separate browser contexts remain isolated.');

  let release;
  const paused = new Promise(resolve => {
    void magicContext.route('**/api/session-fixture/delayed', async route => {
      resolve();
      await new Promise(done => { release = done; });
      await route.fulfill({ json: { success: true, data: 'OLD_PRIVATE_RESPONSE' } });
    });
  });
  await peer.evaluate(async () => {
    const { default: api } = await import('/src/utils/axios.js');
    window.staleResponse = api.get('/session-fixture/delayed').then(() => 'accepted', error => error.code);
  });
  await paused;
  await peer.evaluate(async () => {
    const { setRequestAccount } = await import('/src/auth/session-sync.js');
    setRequestAccount({ authId: 'other-account' });
  });
  release();
  assert.equal(await peer.evaluate(() => window.staleResponse), 'ERR_CANCELED');
  await magicContext.close();
  console.log('PASS: a delayed response for a previous account is canceled instead of reaching the new account UI.');
  assert.deepEqual(errors, []);
  assert.ok(requests.some(req => req.expected === 'auth-b' && req.account === 'auth-b'));
  console.log('PASS: protected requests carry the displayed account ID; notices contain no identity or credentials. Real API/mail/database operations: 0.');
} finally { await browser.close(); }
