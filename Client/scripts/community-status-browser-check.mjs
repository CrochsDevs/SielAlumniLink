import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// Isolated Edge/Chrome on port 9231. All API responses are fixtures;
// no application accounts, posts, or moderation settings are changed.
const artifacts = path.join(os.tmpdir(), "SielAlumni-community-status-check");
await mkdir(artifacts, { recursive: true });
const target = await (
  await fetch("http://localhost:9231/json/new?about:blank", { method: "PUT" })
).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.onopen = resolve;
  socket.onerror = reject;
});
let sequence = 0;
const waiting = new Map();
const listeners = new Map();
const runtimeErrors = [];
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => {
      waiting.delete(id);
      reject(new Error(`Timeout: ${method}`));
    }, 15000);
    waiting.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params }));
  });
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (!message.id) {
    listeners.get(message.method)?.(message.params);
    return;
  }
  const request = waiting.get(message.id);
  if (!request) return;
  clearTimeout(request.timeout);
  waiting.delete(message.id);
  if (message.error) request.reject(new Error(message.error.message));
  else request.resolve(message.result);
};
const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails)
    throw new Error(
      result.exceptionDetails.exception?.description ||
        result.exceptionDetails.text,
    );
  return result.result.value;
};
const until = async (expression) => {
  const start = Date.now();
  while (Date.now() - start < 15000) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`UI wait failed: ${expression}`);
};

const account = { _id: '111111111111111111111111', authId: 'aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Alumni Tester', email: 'alumni@example.test', role: 'alumni', passwordSetupRequired: false };
const caseRow = { _id: 'cccccccccccccccccccccccc', category: 'spam', status: 'confirmed', severity: 'medium', explanation: 'Repeated promotional content was posted in the community.', createdAt: new Date().toISOString(), evidence: { text: 'Example content under review' } };
let restricted = false;
let submitted = false;
const status = () => ({ restrictions: restricted ? [{ _id: 'rrrr', caseId: caseRow._id, level: 2, reason: 'Repeated promotional posts.', startsAt: new Date(Date.now() - 86400000).toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString() }] : [], reports: [], cases: restricted ? [caseRow] : [], appeals: submitted ? [{ _id: 'appeal', caseId: caseRow._id, status: 'pending', explanation: 'Please review the context of my post.', createdAt: new Date().toISOString() }] : [], appealsEnabled: true });
listeners.set('Runtime.exceptionThrown', ({ exceptionDetails }) => runtimeErrors.push(exceptionDetails.exception?.description || exceptionDetails.text));
listeners.set('Fetch.requestPaused', async ({ requestId, request }) => {
  try {
    const route = new URL(request.url).pathname.replace('/api', '');
    let data = [];
    if (route === '/auth/me' || route === '/users/me') data = account;
    else if (route === '/community/me') data = status();
    else if (route === `/community/cases/${caseRow._id}/appeals` && request.method === 'POST') { submitted = true; data = {}; }
    else if (route === `/community/cases/${caseRow._id}`) data = caseRow;
    else if (route.includes('notifications')) data = { notifications: [], unreadCount: 0 };
    else if (route.includes('conversations')) data = { conversations: [], unreadCount: 0 };
    await send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [
      { name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: 'http://localhost:5173' }, { name: 'Access-Control-Allow-Credentials', value: 'true' }, { name: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' }, { name: 'Access-Control-Allow-Headers', value: 'Content-Type,X-Account-Id' }
    ], body: Buffer.from(JSON.stringify({ success: true, data })).toString('base64') });
  } catch (error) { runtimeErrors.push(error.message); }
});
const click = (text) => evaluate(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === ${JSON.stringify(text)}).click()`);
const screenshot = async (name, width, dark) => {
  await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 768 });
  await evaluate(`document.documentElement.classList.toggle('dark', ${dark})`);
  await new Promise(r => setTimeout(r, 150));
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), true, `Overflow: ${width}`);
  const result = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(path.join(artifacts, `${name}-${width}-${dark ? 'dark' : 'light'}.png`), Buffer.from(result.data, 'base64'));
};
try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/*' }] });
  await send('Page.navigate', { url: 'http://localhost:5173/community-status' });
  await until("document.querySelector('#access-heading')");
  assert.equal(await evaluate("Boolean(document.querySelector('aside[aria-label=\"Alumni sidebar\"] a[aria-current=page][href=\"/community-status\"]'))"), true);
  for (const width of [390, 768, 1440]) for (const dark of [false, true]) await screenshot('clear', width, dark);
  restricted = true;
  await click('Refresh status');
  await until("document.querySelector('.community-restriction-card')");
  for (const width of [390, 1440]) for (const dark of [false, true]) await screenshot('restricted', width, dark);
  await click('View case details');
  await until("document.querySelector('dialog:modal textarea')");
  assert.equal(await evaluate("document.querySelector('dialog button[type=submit], dialog form button').disabled"), true);
  await evaluate("(() => { const field = document.querySelector('dialog textarea'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(field, 'Please review the context of my post.'); field.dispatchEvent(new Event('input', { bubbles: true })); })()");
  await click('Submit Appeal');
  await until("!document.querySelector('dialog:modal') && document.querySelector('#my-appeals .community-status-record')");
  await click('View case details');
  await until("document.querySelector('dialog:modal')?.textContent.includes('already appealed')");
  assert.equal(await evaluate("Boolean(document.querySelector('dialog textarea'))"), false);
  assert.deepEqual(runtimeErrors, []);
  console.log(JSON.stringify({ result: 'passed', checks: ['alumni sidebar active state', 'responsive light/dark layouts', 'restricted account notice', 'appeal validation and submission', 'duplicate appeal prevention'], artifacts }));
} finally { await send('Page.close'); socket.close(); }
