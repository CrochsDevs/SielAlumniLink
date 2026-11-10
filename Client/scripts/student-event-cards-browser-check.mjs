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

const origin = process.env.EVENT_CARDS_TEST_ORIGIN || "http://localhost:5180";
listeners.set('Runtime.exceptionThrown', ({ exceptionDetails }) => { runtimeErrors.push(exceptionDetails.exception?.description || exceptionDetails.text); });
const student = { _id: "a".repeat(24), authId: "a".repeat(24), role: "student", name: "Student Tester", email: "student@example.test", passwordSetupRequired: false };
const events = Array.from({ length: 4 }, (_, index) => ({ _id: String(index + 1).repeat(24), title: `Activity ${index + 1}`, organizer: "CLSU", activityType: "seminar", deliveryMode: "online", startAt: "2026-11-09T02:00:00Z", descriptionFormat: "html", description: index === 0 ? '<h2>Full agenda</h2>' + '<p>Long description with <strong>formatted information</strong> and several topics to discuss.</p>'.repeat(80) + '<p>Final paragraph preserved.</p>' : '<p>Short description.</p>', registrationWindow: { state: "open" } }));
const headers = [{ name: "Content-Type", value: "application/json" }, { name: "Access-Control-Allow-Origin", value: origin }, { name: "Access-Control-Allow-Credentials", value: "true" }, { name: "Access-Control-Allow-Headers", value: "Content-Type, X-Account-Id" }, { name: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" }];
listeners.set("Fetch.requestPaused", async ({ requestId, request }) => {
  const route = new URL(request.url).pathname.replace("/api", "");
  const data = ["/auth/me", "/users/me"].includes(route) ? student : route === "/events" ? events : [];
  await send("Fetch.fulfillRequest", { requestId, responseCode: 200, responseHeaders: headers, body: Buffer.from(JSON.stringify({ success: true, data })).toString("base64") });
});
try {
  await send("Page.enable"); await send("Runtime.enable");
  await send("Fetch.enable", { patterns: [{ urlPattern: "http://localhost:3002/api/*" }] });
  await send("Page.navigate", { url: `${origin}/student/events` });
  await until(`document.querySelectorAll('article[data-event]').length === 4`);
  for (const width of [1440, 390]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: 950, deviceScaleFactor: 1, mobile: width < 768 });
    await new Promise(resolve => setTimeout(resolve, 200));
    const sizes = await evaluate(`Array.from(document.querySelectorAll('article[data-event]')).map(card => ({ card: card.getBoundingClientRect().height, preview: card.querySelector('.event-description-preview').getBoundingClientRect().height }))`);
    assert.ok(sizes.every(size => size.card < 600 && size.preview <= 67), JSON.stringify(sizes));
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= ${width + 1}`), true);
    await evaluate(`document.querySelector('button[aria-label="View details for Activity 1"]').click()`);
    await until(`document.querySelector('dialog[open] .opportunity-prose strong')`);
    assert.equal(await evaluate(`document.querySelector('dialog .opportunity-prose').textContent.includes('Final paragraph preserved.')`), true);
    assert.equal(await evaluate(`document.querySelectorAll('dialog .opportunity-prose strong').length`), 80);
    await evaluate(`document.querySelector('button[aria-label="Close dialog"]').click()`);
    await until(`!document.querySelector('dialog')`);
    assert.equal(await evaluate(`document.body.style.overflow !== 'hidden'`), true);
    const shot = await send("Page.captureScreenshot", { format: "png" });
    await writeFile(path.join(artifacts, `cards-${width}.png`), Buffer.from(shot.data, "base64"));
  }
  student.role = 'admin';
  await send('Page.navigate', { url: `${origin}/admin/events` });
  await until(`Array.from(document.querySelectorAll('a')).some(link => link.textContent.trim() === 'Browse activities')`);
  await evaluate(`Array.from(document.querySelectorAll('a')).find(link => link.textContent.trim() === 'Browse activities').click()`);
  await until(`location.pathname === '/activities' && document.querySelectorAll('article[data-event]').length === 4`);
  assert.equal(await evaluate(`!!document.querySelector('aside[aria-label="Admin sidebar"]') || !!document.querySelector('.admin-sidebar')`), true, 'Admin navigation is retained');
  assert.equal(await evaluate(`document.querySelectorAll('.event-card-actions a[href$="/attendance"]').length`), 4);
  await evaluate(`document.querySelector('button[aria-label="View details for Activity 1"]').click()`);
  await until(`document.querySelector('dialog a[href="/meetings/${events[0]._id}"]')`);
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('dialog button')).some(button => button.textContent.trim() === 'Register')`), false);
  await evaluate(`document.querySelector('button[aria-label="Close dialog"]').click()`);
  await until(`!document.querySelector('dialog')`);
  await evaluate(`document.querySelector('a[aria-label="Edit Activity 1"]').click()`);
  await until(`document.querySelector('form[aria-label="Edit event"] input[id="ev-title"]')?.value === 'Activity 1'`);
  await until(`document.querySelectorAll('#ev-desc strong').length === 80`);
  assert.equal(await evaluate(`new URLSearchParams(location.search).has('edit')`), false, 'Edit request is consumed so closing does not reopen the modal');
  console.log(`Passed: compact cards, formatted details, admin browse navigation, attendance and meeting links, Edit opens the selected event with its full formatted description. Mock APIs only. Artifacts: ${artifacts}`);
} finally {
  await send("Browser.close").catch(() => {});
  socket.close();
}

