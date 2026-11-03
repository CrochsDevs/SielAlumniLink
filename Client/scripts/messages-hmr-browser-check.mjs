import { chromium } from '../node_modules/.search-validation/node_modules/playwright/index.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Mock accounts/API only. Temporary hook edits exercise Vite Fast Refresh and
// are restored byte-for-byte; no real accounts or conversations are changed.
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const pages = [], errors = [];
const hookError = /order of Hooks|Should have a queue|final argument passed to useLayoutEffect|Rendered (more|fewer) hooks|Invalid hook call/i;
const exercise = async page => {
  await page.getByPlaceholder('Message Alex...').fill('Draft fixture');
  await page.locator('.inbox-conversation-row').first().hover();
  await page.getByRole('button', { name: 'Chat options for Alex Fixture' }).click();
  await page.getByRole('menu', { name: 'Chat actions for Alex Fixture' }).waitFor();
  await page.keyboard.press('Escape');
};
const changeAndRestore = async (file, transform) => {
  const original = await readFile(file), modified = transform(original.toString('utf8'));
  assert.notEqual(modified, original.toString('utf8'));
  try {
    await writeFile(file, modified);
    await new Promise(resolve => setTimeout(resolve, 1200));
    for (const page of pages) await exercise(page);
  } finally {
    // Do not overwrite a concurrent user edit.
    assert.equal(await readFile(file, 'utf8'), modified, `Source changed during HMR check: ${file}`);
    await writeFile(file, original);
    await new Promise(resolve => setTimeout(resolve, 1200));
  }
  for (const page of pages) await exercise(page);
};
try {
  for (const role of ['admin', 'alumni', 'student']) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 850 } });
    await context.routeWebSocket('**/socket.io/**', socket => socket.close());
    await context.route('**/api/**', route => {
      const endpoint = new URL(route.request().url()).pathname.replace('/api', '');
      let data = [];
      if (['/auth/me', '/users/me'].includes(endpoint)) data = { _id: `profile-${role}`, authId: `auth-${role}`, role, name: 'Tester', email: `${role}@example.test`, passwordSetupRequired: false };
      else if (endpoint === '/conversations') data = [{ _id: 'fixture', name: 'Alex Fixture', authId: 'other', unread: 0 }];
      else if (endpoint.endsWith('/messages')) data = [{ _id: 'saved', from: 'me', text: 'Message fixture', read: true }];
      else if (endpoint === '/notifications/unread-count') data = { count: 0 };
      else if (endpoint === '/tracer/access') data = { updateRequired: false, quarter: '2026-Q4', nextUpdateAt: '2027-01-01T00:00:00Z' };
      return route.fulfill({ json: { success: true, data } });
    });
    const page = await context.newPage();
    page.on('pageerror', error => { errors.push(error.message); console.log('PAGE ERROR:', error.message); });
    page.on('console', message => { if (hookError.test(message.text())) errors.push(message.text()); });
    await page.goto(`http://localhost:5173/${role}/message`);
    await exercise(page);
    pages.push(page);
  }
  await changeAndRestore('src/components/chat/useInbox.js', source => source.replace('export function useInbox() {', 'export function useInbox() {\n  useEffect(() => {}, []); // Temporary HMR regression fixture'));
  await changeAndRestore('src/components/chat/useMessageComposer.js', source => source.replace('export function useMessageComposer(conversationId, onSend, onEdit) {', 'export function useMessageComposer(conversationId, onSend, onEdit) {\n  useEffect(() => {}, []); // Temporary HMR regression fixture'));
  await changeAndRestore('src/components/chat/ConversationActions.jsx', source => source.replace('}, [open]);', '}, [open, conversation.isGroup]); // Temporary HMR regression fixture'));
  for (const page of pages) { await page.reload(); await exercise(page); }
  assert.deepEqual(errors, []);
  console.log('PASS admin/alumni/student: cold load, rerenders, added/removed hooks, changed layout-effect dependencies, Fast Refresh and refresh without hook errors');
} finally { await browser.close(); }
