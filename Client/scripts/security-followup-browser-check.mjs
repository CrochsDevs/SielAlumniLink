import { chromium } from '../node_modules/.search-validation/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';

// Every API/socket request is intercepted. No real account/provider operations.
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  const errors = [], writes = [];
  let role, failLogout, signedOut, profile;
  page.on('pageerror', error => errors.push(error.message));
  await page.routeWebSocket('**/socket.io/**', socket => socket.close());
  await page.route('**/api/**', route => {
    const req = route.request(), endpoint = new URL(req.url()).pathname.replace('/api', '');
    let data = [];
    if (['/auth/me', '/users/me'].includes(endpoint)) data = signedOut ? null : profile;
    else if (endpoint === '/notifications/unread-count') data = { count: 0 };
    else if (endpoint === '/tracer/access') data = { updateRequired: false, quarter: '2026-Q4', nextUpdateAt: '2027-01-01T00:00:00Z' };
    if (req.method() !== 'GET') {
      const body = req.postDataJSON();
      writes.push({ endpoint, body });
      if (endpoint === '/auth/logout') {
        if (failLogout) return route.fulfill({ status: 503, json: { success: false, message: 'Unable to complete logout. Please try again.' } });
        signedOut = true;
      } else if (endpoint === '/users/me') {
        assert.equal(Object.keys(body).some(key => key.startsWith('$')), false);
        if (body.addSkill) profile.skills.push(body.addSkill);
        if (body.removeSkill) profile.skills = profile.skills.filter(skill => skill !== body.removeSkill);
        if (body.addEducation) profile.education.push(body.addEducation);
        data = profile;
      } else if (!endpoint.endsWith('/view')) return route.abort();
    }
    return route.fulfill({ json: { success: true, data } });
  });
  const reset = () => {
    signedOut = false;
    profile = { _id: '000000000000000000000001', authId: '000000000000000000000002', role,
      name: 'Fixture Member', email: 'fixture@example.test', passwordSetupRequired: false,
      skills: [], education: [], employmentHistory: [] };
  };
  const navigate = path => page.evaluate(path => {
    history.pushState({}, '', path);
    dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (role of ['student', 'alumni', 'admin']) {
      reset(); failLogout = true;
      const home = `/${role}/${role === 'admin' ? 'settings' : 'accounts'}`;
      await page.goto(`http://localhost:5173${home}`, { waitUntil: 'networkidle' });
      await navigate('/logout');
      await page.getByRole('button', { name: 'Yes, log out', exact: true }).click();
      await page.getByRole('heading', { name: 'Logout incomplete' }).waitFor();
      assert.ok(page.url().endsWith('/logout'));
      await page.getByRole('button', { name: 'OK', exact: true }).click();
      await page.waitForURL(`**${home}`);
      assert.equal(await page.getByRole('button', { name: /send single-use link/i }).count(), 0);
      failLogout = false;
      await navigate('/logout');
      await page.getByRole('button', { name: 'Yes, log out', exact: true }).click();
      await page.waitForURL('**/login');
      await page.getByRole('button', { name: /send single-use link/i }).waitFor();
    }
    for (role of ['student', 'alumni']) {
      reset();
      await page.goto(`http://localhost:5173/${role}/profile`, { waitUntil: 'networkidle' });
      const education = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Education', exact: true }) });
      await education.getByRole('button', { name: 'Add', exact: true }).click({ timeout: 5000 }).catch(async error => {
        console.log(JSON.stringify({ role, width, url: page.url(), body: (await page.locator('body').innerText()).slice(0, 2200), writes }));
        throw error;
      });
      await education.getByPlaceholder('School', { exact: true }).fill('CLSU');
      await education.getByPlaceholder('Degree', { exact: true }).fill('BS Computer Science');
      await education.getByRole('button', { name: 'Add Education', exact: true }).click();
      await education.getByText('CLSU', { exact: true }).waitFor();
      assert.equal(writes.filter(write => write.endpoint === '/users/me').at(-1).body.addEducation.school, 'CLSU');
      await page.getByRole('button', { name: 'Edit profile', exact: true }).first().click();
      const skill = page.getByRole('combobox', { name: 'Add a skill', exact: true });
      await skill.fill('RegressionSkill');
      await skill.press('Enter');
      await page.getByRole('button', { name: 'Remove RegressionSkill', exact: true }).waitFor();
      assert.deepEqual(writes.filter(write => write.endpoint === '/users/me').at(-1).body, { addSkill: 'RegressionSkill' });
      await page.getByRole('button', { name: 'Remove RegressionSkill', exact: true }).click();
      await page.getByRole('button', { name: 'Remove RegressionSkill', exact: true }).waitFor({ state: 'detached' });
      assert.deepEqual(writes.filter(write => write.endpoint === '/users/me').at(-1).body, { removeSkill: 'RegressionSkill' });
    }
  }
  assert.deepEqual(errors, []);
  assert.equal(writes.filter(write => write.endpoint === '/auth/logout').length, 12);
  console.log('PASS: mobile/desktop logout failure stays authenticated, shows an error and allows successful retry for all three roles; student/alumni education and skill actions use the explicit API. All API writes were mocked.');
} finally { await browser.close(); }
