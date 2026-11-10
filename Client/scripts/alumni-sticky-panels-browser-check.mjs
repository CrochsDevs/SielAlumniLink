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

const origin = 'http://localhost:5180';
const alumni = { _id: 'a'.repeat(24), authId: 'a'.repeat(24), role: 'alumni', name: 'Alumni Tester', email: 'alumni@example.test', passwordSetupRequired: false };
const headers = [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: origin }, { name: 'Access-Control-Allow-Credentials', value: 'true' }, { name: 'Access-Control-Allow-Headers', value: 'Content-Type, X-Account-Id' }, { name: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' }];
listeners.set('Fetch.requestPaused', async ({ requestId, request }) => {
  const route = new URL(request.url).pathname.replace('/api', '');
  const data = ['/auth/me', '/users/me'].includes(route) ? alumni : route === '/tracer/access' ? { updateRequired: false, quarter: '2026-Q4', nextUpdateAt: '2099-01-01' } : [];
  await send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: headers, body: Buffer.from(JSON.stringify({ success: true, data })).toString('base64') });
});
try {
  await send('Page.enable'); await send('Runtime.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: 'http://localhost:3002/api/*' }] });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${origin}/alumni` });
  await until(`document.querySelectorAll('.alumni-dashboard-rail').length === 2`);
  assert.equal(await evaluate(`(() => { const bar=document.querySelector('.member-topbar').getBoundingClientRect(); const sidebar=document.querySelector('.alumni-sidebar').getBoundingClientRect(); return Math.abs(bar.left-sidebar.right) <= 1 && Math.abs(bar.right-innerWidth) <= 1 && bar.top === 0 && getComputedStyle(document.querySelector('.member-topbar > header')).borderRadius === '0px'; })()`), true, 'Topbar fills the content width flush to the top');
  // Extend the feed column to represent a long feed without creating real posts.
  await evaluate(`document.querySelector('.alumni-dashboard-rail').parentElement.children[1].style.minHeight = '2600px'; window.scrollTo(0,800);`);
  await new Promise(resolve => setTimeout(resolve, 350));
  const positions = await evaluate(`Array.from(document.querySelectorAll('.alumni-dashboard-rail')).map(rail => ({ position: getComputedStyle(rail).position, top: rail.getBoundingClientRect().top, bottom: rail.getBoundingClientRect().bottom }))`);
  assert.ok(positions.every(rail => rail.position === 'sticky' && rail.top >= 99 && rail.top <= 101 && rail.bottom <= 900), JSON.stringify(positions));
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('.alumni-dashboard-rail')).every(rail => getComputedStyle(rail).position !== 'sticky')`), true);
  assert.equal(await evaluate(`document.documentElement.scrollWidth <= 391`), true);
  console.log('Passed: alumni profile and community panels remain visible after scrolling the feed on desktop; panels use normal flow on mobile with no horizontal overflow. Mock APIs only.');
} finally {
  await send('Browser.close').catch(()=>{});
  socket.close();
}

