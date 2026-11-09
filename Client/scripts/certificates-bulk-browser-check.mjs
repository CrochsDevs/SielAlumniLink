// Run with isolated Edge/Chrome on port 9235. API fixtures never change real student records.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// Uses a separate headless browser and API fixtures. No real alumni responses
// are read or written. Start Edge/Chrome with remote debugging on port 9235.
const artifacts = path.join(os.tmpdir(), "SielAlumni-certificates-bulk-check");
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

const origin = process.env.CERTIFICATE_TEST_ORIGIN || "http://localhost:5174";
const admin = { _id: "c".repeat(24), authId: "c".repeat(24), name: "Admin Tester", role: "admin", passwordSetupRequired: false };
const people = Array.from({ length: 225 }, (_, index) => ({ authId: (index + 1).toString(16).padStart(24, "0"), name: `Student ${String(index + 1).padStart(3, "0")}`, email: `student${index + 1}@example.test`, program: "BS Information Technology" }));
let attendance = people.map((person, index) => ({ _id: (index + 1000).toString(16).padStart(24, "0"), authId: person.authId, studentName: person.name, studentEmail: person.email, title: index % 2 ? "Research Seminar" : "Leadership Training", activityType: index % 2 ? "seminar" : "training", date: "2025-02-15" }));
let certificates = [];
let failOnce = true;
const calls = [];
const headers = [{ name: "Content-Type", value: "application/json" }, { name: "Access-Control-Allow-Origin", value: origin }, { name: "Access-Control-Allow-Credentials", value: "true" }, { name: "Access-Control-Allow-Headers", value: "Content-Type, X-Account-Id" }, { name: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" }];
listeners.set("Runtime.exceptionThrown", ({ exceptionDetails }) => runtimeErrors.push(exceptionDetails.exception?.description || exceptionDetails.text));
listeners.set("Fetch.requestPaused", async ({ requestId, request }) => {
  const route = new URL(request.url).pathname.replace("/api", "");
  let data = [], responseCode = 200, message;
  if (["/auth/me", "/users/me"].includes(route)) data = admin;
  else if (route === "/certificates/participants") data = people;
  else if (route === "/certificates/attendance") data = attendance;
  else if (route === "/certificates/issued") data = certificates;
  else if (request.method === "POST" && (route.endsWith("/confirm") || route === "/certificates/participations")) {
    const input = JSON.parse(request.postData);
    const record = attendance.find(item => route.includes(item._id));
    const person = people.find(item => item.authId === (record?.authId || input.studentAuthId));
    calls.push({ route, ...input });
    if (record?.studentName === "Student 003" && failOnce) { failOnce = false; responseCode = 503; message = "Temporary failure. Retry this student."; }
    else {
      data = { _id: `certificate-${person.authId}`, studentAuthId: person.authId, recipientName: person.name, title: record?.title || input.title, activityType: input.type, participationDate: record?.date || input.date, certificateNumber: `CLSU-${person.authId}`, organizer: input.organizer };
      certificates.push(data);
      if (record) attendance = attendance.filter(item => item._id !== record._id);
    }
  }
  await send("Fetch.fulfillRequest", { requestId, responseCode, responseHeaders: headers, body: Buffer.from(JSON.stringify({ success: responseCode === 200, data, message })).toString("base64") });
});
const click = label => evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === ${JSON.stringify(label)}).click()`);
const setValue = (selector, value, type = "HTMLInputElement") => evaluate(`(() => { const field = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(${type}.prototype, 'value').set.call(field, ${JSON.stringify(value)}); field.dispatchEvent(new Event('${type === "HTMLSelectElement" ? "change" : "input"}', { bubbles: true })); })()`);
const screenshot = async (name, width, dark = false) => {
  await send("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width < 768 });
  await evaluate(`document.documentElement.classList.toggle('dark', ${dark})`);
  await new Promise(resolve => setTimeout(resolve, 350));
  assert.equal(await evaluate(`document.documentElement.scrollWidth <= ${width + 1}`), true, "Page fits viewport");
  const shot = await send("Page.captureScreenshot", { format: "png" });
  await writeFile(path.join(artifacts, `${name}.png`), Buffer.from(shot.data, "base64"));
};
try {
  await send("Page.enable"); await send("Runtime.enable");
  await send("Fetch.enable", { patterns: [{ urlPattern: "http://localhost:3002/api/*" }] });
  await send("Page.navigate", { url: `${origin}/admin/certificates` });
  await until(`document.querySelectorAll('[data-attendance]').length === 20`);
  await screenshot("attendance-desktop", 1440);
  await evaluate(`document.querySelector('input[aria-label="Select all on this page"]').click()`);
  await evaluate(`document.querySelector('button[aria-label="Next page"]').click()`);
  await until(`document.querySelector('[data-attendance]')?.textContent.includes('Student 021')`);
  await evaluate(`document.querySelector('tbody input[type="checkbox"]').click()`);
  await until(`document.querySelector('.cert-admin-selection')?.textContent.includes('21')`);
  await click("Issue selected");
  await until(`document.querySelector('dialog')`);
  await evaluate(`document.querySelector('dialog input[type="checkbox"]').click()`);
  // Two rapid submissions must still issue only once per target.
  await evaluate(`(() => { const form = document.querySelector('dialog form'); form.requestSubmit(); form.requestSubmit(); })()`);
  await until(`document.querySelector('dialog [role="alert"]')`);
  assert.equal(certificates.length, 20);
  assert.equal(calls.length, 21);
  assert.equal(await evaluate(`document.querySelector('.cert-admin-selection strong').textContent`), "1");
  assert.equal(calls.filter(item => item.type === "seminar").length, 10);
  await click("Confirm & issue certificates");
  await until(`!document.querySelector('dialog') && document.querySelectorAll('[data-attendance]').length === 20`);
  assert.equal(certificates.length, 21); assert.equal(calls.length, 22);
  await setValue('input[aria-label="Search certificate records"]', "Student 225");
  await until(`document.querySelectorAll('[data-attendance]').length === 1`);
  await setValue('input[aria-label="Search certificate records"]', "no matching student");
  await until(`document.body.textContent.includes('No matching records')`);
  await click("Clear filters");
  await setValue('select[aria-label="Filter by activity"]', "Research Seminar", "HTMLSelectElement");
  await until(`Array.from(document.querySelectorAll('tbody tr')).every(row => row.textContent.includes('Research Seminar'))`);
  await click("Clear filters");
  await click("Record participation");
  await until(`document.querySelector('.cert-admin-recipient-list')`);
  await setValue('dialog input[type="search"]', "Student 22");
  await click("Select matching (6)");
  await until(`document.querySelector('.cert-admin-recipient-heading').textContent.includes('6 selected')`);
  await setValue('dialog input[maxlength="300"]', "Innovation Workshop");
  await evaluate(`document.querySelector('dialog input[type="checkbox"][required]').click()`);
  await click("Confirm & issue certificates");
  await until(`!document.querySelector('dialog')`);
  assert.equal(certificates.length, 27);
  await evaluate(`Array.from(document.querySelectorAll('.admin-tabs button')).find(button => button.textContent.includes('Issued certificates')).click()`);
  await until(`document.querySelectorAll('tbody tr').length === 20 && document.querySelector('[data-certificate]')`);
  await screenshot("issued-desktop", 1440);
  await screenshot("issued-mobile-dark", 390, true);
  await evaluate(`document.querySelector('button[aria-label="Next page"]').click()`);
  await until(`document.querySelectorAll('tbody tr').length === 7`);
  await setValue('input[aria-label="Search certificate records"]', "Innovation Workshop");
  await until(`document.querySelectorAll('tbody tr').length === 6`);
  await evaluate(`window.__csv = ''; URL.createObjectURL = blob => { blob.text().then(text => window.__csv = text); return 'blob:fixture'; }; HTMLAnchorElement.prototype.click = function() {};`);
  await click("Export CSV");
  await until(`window.__csv.includes('Innovation Workshop')`);
  assert.equal((await evaluate(`window.__csv`)).split("\r\n").length, 7);
  assert.deepEqual(runtimeErrors, []);
  console.log(`Passed: 225-record fixture, search, activity filters, pagination, selection across pages, batch issuance, partial-failure retry, duplicate-submit guard, multiple recipients, filtered CSV, desktop/mobile dark mode. Mock APIs only. Artifacts: ${artifacts}`);
} finally {
  await send("Browser.close").catch(() => {});
  socket.close();
}

