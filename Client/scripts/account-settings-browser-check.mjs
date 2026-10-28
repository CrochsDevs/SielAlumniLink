import { chromium } from '../node_modules/.search-validation/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Account fixtures only. This check never updates a real name, password or profile.
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 375, height: 740 }, isMobile: true, hasTouch: true });
  let role = 'student';
  let writes = 0;
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/socket.io/**', route => route.abort());
  await page.route('**/api/**', route => {
    if (!['GET', 'OPTIONS'].includes(route.request().method())) {
      writes++;
      return route.fulfill({ status: 409, json: { success: false } });
    }
    const endpoint = new URL(route.request().url()).pathname.replace('/api', '');
    const profile = { _id: 'profile', authId: 'auth', role, name: 'Alexandra University Member', email: 'alexandra.registered.personal.email@example.test', profilePicture: '/src/assets/logo/clsu_logo.png', passwordSetupRequired: false };
    const data = ['/auth/me', '/users/me'].includes(endpoint) ? profile
      : endpoint === '/notifications/unread-count' ? { count: 0 }
      : endpoint === '/tracer/access' ? { updateRequired: false, quarter: '2026-Q4', nextUpdateAt: '2027-01-01T00:00:00Z' } : [];
    return route.fulfill({ json: { success: true, data } });
  });
  let checks = 0;
  for (role of ['student', 'alumni', 'admin']) {
    await page.setViewportSize({ width: 375, height: 740 });
    await page.goto(`http://localhost:5173/${role}/${role === 'admin' ? 'settings' : 'accounts'}`, { waitUntil: 'networkidle' });
    const selector = page.getByRole('button', { name: /^Settings section:/ });
    const sheet = page.getByRole('dialog', { name: 'Account settings', exact: true });
    const content = page.locator('.account-settings-content');
    for (const width of [320, 375, 430, 640, 767, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 740 });
      for (const dark of [false, true]) {
        await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), dark);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${role} overflow at ${width}`);
        assert.equal(await selector.isVisible(), width < 768);
        assert.ok(await content.locator('form input').first().evaluate(element => element.getBoundingClientRect().width >= 120), `${role}: profile fields must remain usable at ${width}`);
        if (width < 768) {
          const nav = await page.locator('.account-settings-navigation').boundingBox();
          const form = await content.locator('form').first().boundingBox();
          assert.ok(nav.height < 100, 'Mobile navigation must stay compact');
          assert.ok(form.y < 700, `${role}: profile form must be visible without scrolling past a sidebar`);
          const submit = content.locator('button[type="submit"]').first();
          assert.ok(await submit.evaluate(element => element.getBoundingClientRect().height >= 44));
        } else {
          assert.ok(await page.locator('.account-settings-navigation nav').first().isVisible());
        }
        checks++;
      }
    }
    await page.setViewportSize({ width: 375, height: 740 });
    const sections = role === 'admin' ? ['security', 'notifications', 'appearance', 'account'] : ['password', 'appearance', 'help', 'privacy', 'terms', 'profile'];
    const labels = role === 'admin'
      ? { security: 'Security and Password', notifications: 'Notification', appearance: 'Dark Mode', account: 'Account Management' }
      : { password: 'Change Password', appearance: 'Appearance', help: 'Help & Support', privacy: 'Privacy Policy', terms: 'Terms & Conditions', profile: 'Profile' };
    for (const value of sections) {
      await selector.click();
      await sheet.waitFor();
      const rect = await sheet.boundingBox();
      assert.equal(rect.x, 0);
      assert.equal(rect.width, 375);
      assert.ok(Math.abs(rect.y + rect.height - 740) < 1, 'Settings sheet should anchor to the bottom');
      assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
      await sheet.getByRole('button', { name: new RegExp(`^${labels[value]}`) }).click();
      await sheet.waitFor({ state: 'detached' });
      assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden');
      assert.ok(await selector.evaluate(element => element === document.activeElement));
      assert.ok((await content.innerText()).trim().length > 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    await selector.click();
    await page.getByRole('button', { name: 'Close settings sections', exact: true }).click();
    await sheet.waitFor({ state: 'detached' });
    await selector.click();
    await page.keyboard.press('Escape');
    await sheet.waitFor({ state: 'detached' });
    await selector.click();
    await page.mouse.click(5, 5);
    await sheet.waitFor({ state: 'detached' });
    if (role !== 'admin') {
      assert.ok(await page.locator('.workspace-page-header').getByAltText('Alexandra University Member profile picture').isVisible());
      await page.evaluate(() => document.documentElement.classList.remove('dark'));
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(tmpdir(), `alumnilink-${role}-mobile-account.png`) });
      await selector.click();
      await page.screenshot({ path: path.join(tmpdir(), `alumnilink-${role}-settings-sheet.png`) });
      await page.setViewportSize({ width: 375, height: 400 });
      assert.ok(await page.locator('.account-settings-sheet-content').evaluate(element => element.scrollHeight > element.clientHeight), 'Settings should scroll inside the sheet on short screens');
      await page.keyboard.press('Escape');
      await sheet.waitFor({ state: 'detached' });
    }
    await page.setViewportSize({ width: 375, height: 740 });
    await selector.click();
    await page.setViewportSize({ width: 1440, height: 900 });
    await sheet.waitFor({ state: 'detached' });
    assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden');
    await page.locator('.account-settings-navigation nav').getByRole('button').last().click();
    assert.ok((await content.innerText()).trim().length > 0);
  }
  assert.equal(writes, 0);
  assert.deepEqual(errors, []);
  console.log(`PASS: ${checks} viewport/theme checks, settings sheets, section selection, close/focus, Escape, backdrop, scrolling, resize cleanup, profile forms and no API writes.`);
} finally { await browser.close(); }
