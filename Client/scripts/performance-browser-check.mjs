// Run with isolated Edge/Chrome on port 9235. API fixtures never change real student records.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// Uses a separate headless browser and API fixtures. No real alumni responses
// are read or written. Start Edge/Chrome with remote debugging on port 9235.
const artifacts = path.join(os.tmpdir(), "SielAlumni-event-cards-check");
await mkdir(artifacts, { recursive: true });
const target = await (
  await fetch("http://localhost:9235/json/new?about:blank", { method: "PUT" })
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
  if (message.id) {
    const request = waiting.get(message.id);
    if (!request) return;
    clearTimeout(request.timeout);
    waiting.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  } else {
    const pending = listeners.get(message.method)?.(message.params);
    pending?.catch(error => {
      // Closing/replacing a preview aborts its request, invalidating the mock
      // interception before the fixture response can be delivered.
      if (error.message !== 'Invalid InterceptionId.') runtimeErrors.push(error.message);
    });
  }
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
  throw new Error(`UI wait failed: ${expression}\n${await evaluate('document.body.innerText')}\n${runtimeErrors.join('\n')}`);
};

const origin = process.env.PERFORMANCE_TEST_ORIGIN || 'http://localhost:5180';
const admin = { _id: 'a'.repeat(24), authId: 'a'.repeat(24), role: 'admin', name: 'Performance Tester', passwordSetupRequired: false };
const headers = [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: origin }, { name: 'Access-Control-Allow-Credentials', value: 'true' }, { name: 'Access-Control-Allow-Headers', value: 'Content-Type, X-Account-Id' }, { name: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' }];
const jobs = ['Software Engineer', 'Data Analyst'].map((title, index) => ({ _id: String(index + 1).repeat(24), title, company: 'CLSU', location: 'Science City of Munoz', type: 'Full-time', mode: 'On-site', description: 'Job description', isActive: true, audience: 'all', tags: [], createdAt: '2026-11-09T00:00:00Z' }));
const conversationId = 'c'.repeat(24);
let eventsRequests = 0, holdEvents = false;
const held = [];
const assets = [];
const fulfill = (requestId, data = []) => send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: headers, body: Buffer.from(JSON.stringify({ success: true, data })).toString('base64') });
listeners.set('Runtime.exceptionThrown', ({ exceptionDetails }) => { runtimeErrors.push(exceptionDetails.exception?.description || exceptionDetails.text); });
listeners.set('Network.requestWillBeSent', ({ request }) => { if (request.url.startsWith(origin + '/assets/')) assets.push(request.url); });
listeners.set('Fetch.requestPaused', async ({ requestId, request }) => {
  const route = new URL(request.url).pathname.replace('/api', '');
  if (route === '/events' && request.method === 'GET') {
    eventsRequests++;
    if (holdEvents) { held.push(requestId); return; }
  }
  const data = ['/auth/me', '/users/me'].includes(route) ? admin : route === '/jobs' ? jobs : route === '/conversations' ? [{ _id: conversationId, authId: 'd'.repeat(24), name: 'Alex Santos', email: 'alex@example.test', isGroup: false, unread: 0 }] : [];
  await fulfill(requestId, data);
});
try {
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    const original = window.setInterval;
    window.__pollCallbacks = {};
    window.setInterval = (callback, delay, ...args) => {
      if ([8000,15000,20000].includes(delay)) { (window.__pollCallbacks[delay] ||= []).push(callback); return 999999; }
      return original(callback, delay, ...args);
    };
  })();` });
  await send('Fetch.enable', { patterns: [{ urlPattern: 'http://localhost:3002/api/*' }] });
  await send('Page.navigate', { url: `${origin}/admin/jobs` });
  await until(`document.querySelectorAll('[data-career-card]').length === 2`);
  assert.equal(assets.some(url => /(?:emoji-picker|\/OpportunityEditor-).*\.js(?:$|\?)/.test(url)), false, 'Large optional dependencies are not fetched while browsing');
  await evaluate(`document.querySelector('input[aria-label="Search career board"]').focus()`);
  await send('Input.insertText', { text: 'Data' });
  await evaluate(`document.querySelector('form[aria-label="Career board search"]').requestSubmit()`);
  await until(`document.querySelectorAll('[data-career-card]').length === 1`);
  assert.equal(await evaluate(`document.querySelector('[data-career-card]').textContent.includes('Data Analyst')`), true);
  await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === 'Post an opportunity').click()`);
  await until(`document.querySelector('#career-description[contenteditable="true"]')`);
  assert.equal(assets.some(url => /\/OpportunityEditor-.*\.js(?:$|\?)/.test(url)), true, 'Editor downloads only after opening the modal');
  await send('Page.navigate', { url: `${origin}/activities` });
  await until(`document.querySelector('.events-empty') && window.__pollCallbacks[15000]?.length`);
  const start = eventsRequests;
  await evaluate(`Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}); document.dispatchEvent(new Event('visibilitychange')); window.__pollCallbacks[15000].forEach(callback=>callback());`);
  await new Promise(resolve=>setTimeout(resolve,200));
  assert.equal(eventsRequests, start, 'Hidden tab makes no refresh requests');
  holdEvents = true;
  await evaluate(`delete document.hidden; document.dispatchEvent(new Event('visibilitychange'));`);
  const deadline = Date.now() + 5000;
  while (!held.length && Date.now() < deadline) await new Promise(resolve=>setTimeout(resolve,25));
  assert.ok(held.length, 'Visibility resume triggers a request');
  await evaluate(`window.__pollCallbacks[15000].forEach(callback=>{callback();callback();});`);
  await new Promise(resolve=>setTimeout(resolve,200));
  assert.equal(eventsRequests, start + 1, 'Visible refresh is immediate and overlapping requests are suppressed');
  holdEvents = false;
  for (const id of held.splice(0)) await fulfill(id);
  await send('Page.navigate', { url: `${origin}/admin/message?conversation=${conversationId}` });
  await until(`document.querySelector('button[aria-label="Add emoji"]')`);
  assert.equal(assets.some(url => /emoji-picker.*\.js(?:$|\?)/.test(url)), false, 'Chat does not download the emoji picker until requested');
  await evaluate(`document.querySelector('button[aria-label="Add emoji"]').click()`);
  await until(`document.querySelector('.EmojiPickerReact')`);
  assert.equal(assets.some(url => /emoji-picker.*\.js(?:$|\?)/.test(url)), true);
  assert.deepEqual(runtimeErrors, []);
  console.log('Passed against production build: lazy routes, career search, on-demand editor and emoji picker, hidden-tab polling pause, immediate visible refresh, and suppression of overlapping requests. Mock APIs only.');
} finally {
  for (const id of held) await fulfill(id).catch(()=>{});
  await send('Browser.close').catch(()=>{});
  socket.close();
}

