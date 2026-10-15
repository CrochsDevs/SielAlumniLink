import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { buildAlignmentReport } from "../../Server/modules/tracer/tracer.alignment.js";

// Uses a separate headless browser and API fixtures. No real alumni responses
// are read or written. Start Edge/Chrome with remote debugging on port 9229.
const artifacts = path.join(os.tmpdir(), "SielAlumni-tracer-alignment-check");
await mkdir(artifacts, { recursive: true });
const target = await (
  await fetch("http://localhost:9229/json/new?about:blank", { method: "PUT" })
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
  } else listeners.get(message.method)?.(message.params);
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

const author = {
  _id: "aaaaaaaaaaaaaaaaaaaaaaaa",
  authId: "aaaaaaaaaaaaaaaaaaaaaaaa",
  name: "Admin Tester",
  email: "admin@example.test",
  role: "admin",
  passwordSetupRequired: false,
};
const baseObservation = {
  batch: "2020",
  program: "Bachelor of Science in Information Technology",
  status: "Employed",
  company: "Example Technologies",
  position: "Software Developer",
  alignmentExplanation:
    "Develops software using programming and database skills.",
};
const obs = (year, jobAlignment, extra = {}) => ({
  ...baseObservation,
  jobAlignment,
  recordedAt: `${year}-06-01T08:00:00Z`,
  ...extra,
});
const documents = [
  {
    authId: "it",
    email: "it-graduate@example.test",
    responseHistory: [
      obs(2021, "unrelated"),
      obs(2023, "partly_related"),
      obs(2025, "directly_related"),
      obs(2026, "unrelated"),
    ],
  },
  {
    authId: "agri",
    email: "agri-graduate@example.test",
    responseHistory: [
      obs(2026, "partly_related", {
        batch: "2022",
        program: "Bachelor of Science in Agriculture",
        status: "Self-employed",
        company: "Family Farm",
        position: "Farm business owner",
      }),
    ],
  },
  {
    authId: "legacy",
    email: "legacy-graduate@example.test",
    batch: "2021",
    program: "Bachelor of Science in Nursing",
    status: "Employed",
    company: "Hospital",
    position: "Nurse",
    updatedAt: "2025-01-01T08:00:00Z",
  },
  {
    authId: "old",
    email: "old-response@example.test",
    responseHistory: [obs(2021, "directly_related")],
  },
];
let failNext = false;
listeners.set("Runtime.exceptionThrown", ({ exceptionDetails }) =>
  runtimeErrors.push(
    exceptionDetails.exception?.description || exceptionDetails.text,
  ),
);
listeners.set("Fetch.requestPaused", async ({ requestId, request }) => {
  try {
    const url = new URL(request.url),
      route = url.pathname.replace("/api", "");
    let data = [],
      responseCode = 200,
      message = "";
    if (request.method !== "OPTIONS") {
      if (route === "/auth/me" || route === "/users/me") data = author;
      else if (route === "/tracer/alignment") {
        if (failNext) {
          failNext = false;
          responseCode = 503;
          message = "Fixture alignment report failed";
        } else
          data = buildAlignmentReport(
            documents,
            Object.fromEntries(url.searchParams),
          );
      } else if (route === "/notifications/unread-count") data = { count: 0 };
    }
    await send("Fetch.fulfillRequest", {
      requestId,
      responseCode,
      responseHeaders: [
        { name: "Content-Type", value: "application/json" },
        { name: "Access-Control-Allow-Origin", value: "http://localhost:5173" },
        { name: "Access-Control-Allow-Credentials", value: "true" },
        { name: "Access-Control-Allow-Headers", value: "Content-Type" },
        { name: "Access-Control-Allow-Methods", value: "GET,OPTIONS" },
      ],
      body: Buffer.from(
        JSON.stringify({ success: responseCode === 200, data, message }),
      ).toString("base64"),
    });
  } catch (error) {
    runtimeErrors.push(error.message);
    await send("Fetch.failRequest", { requestId, errorReason: "Failed" });
  }
});
const click = (label) =>
  evaluate(
    `Array.from(document.querySelectorAll('button')).find(button=>button.textContent.trim()===${JSON.stringify(label)}).click()`,
  );
const select = (label, value) =>
  evaluate(
    `(()=>{const field=document.querySelector('[aria-label='+${JSON.stringify(JSON.stringify(label))}+']');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(field,${JSON.stringify(value)});field.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
const roster = `document.querySelector('[aria-label="Alumni program and work alignment"]')`;
const capture = async (label, width, dark) => {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: width < 768,
  });
  await evaluate(`document.documentElement.classList.toggle('dark',${dark})`);
  await new Promise((resolve) => setTimeout(resolve, 350));
  assert.equal(
    await evaluate(`document.documentElement.scrollWidth <= ${width + 1}`),
    true,
    "page should not overflow",
  );
  const shot = await send("Page.captureScreenshot", { format: "png" });
  await writeFile(
    path.join(artifacts, label + ".png"),
    Buffer.from(shot.data, "base64"),
  );
};
try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Fetch.enable", {
    patterns: [{ urlPattern: "http://localhost:3002/api/*" }],
  });
  await send("Page.navigate", { url: "http://localhost:5173/admin/tracer" });
  await until(`${roster}?.textContent.includes('it-graduate@example.test')`);
  assert.equal(
    await evaluate(
      `document.querySelector('[aria-label="Follow-up period"]').value`,
    ),
    "3-5",
  );
  assert.ok(await evaluate(`document.body.textContent.includes('50%')`));
  assert.ok(
    await evaluate(
      `${roster}.textContent.includes('5 years after graduation')`,
    ),
  );
  assert.ok(await evaluate(`${roster}.textContent.includes('Not reported')`));
  assert.ok(
    !(await evaluate(
      `${roster}.textContent.includes('old-response@example.test')`,
    )),
  );
  await capture("alignment-desktop", 1440, false);
  await capture("alignment-mobile-dark", 390, true);
  await select("Graduation program", "Bachelor of Science in Agriculture");
  await until(
    `${roster}?.textContent.includes('agri-graduate@example.test')&&!${roster}?.textContent.includes('it-graduate@example.test')`,
  );
  assert.ok(await evaluate(`document.body.textContent.includes('100%')`));
  await select("Graduation year", "2020");
  await until(
    `document.body.textContent.includes('No responses in this follow-up period')`,
  );
  assert.ok(
    await evaluate(
      `document.body.textContent.includes('No assessed responses')`,
    ),
  );
  await select("Graduation year", "");
  await select("Graduation program", "");
  await until(`${roster}?.textContent.includes('it-graduate@example.test')`);
  await select("Work alignment", "not_reported");
  await until(
    `${roster}?.textContent.includes('legacy-graduate@example.test')&&!${roster}?.textContent.includes('it-graduate@example.test')`,
  );
  assert.ok(
    await evaluate(
      `document.body.textContent.includes('No assessed responses')`,
    ),
  );
  await select("Work alignment", "");
  await select("Follow-up period", "6+");
  await until(`${roster}?.textContent.includes('6 years after graduation')`);
  assert.ok(await evaluate(`${roster}.textContent.includes('Unrelated')`));
  await select("Follow-up period", "all");
  await until(`${roster}?.textContent.includes('old-response@example.test')`);
  await evaluate(
    `window.alignmentExport=null;const original=URL.createObjectURL;URL.createObjectURL=blob=>{window.alignmentExport=blob;return original(blob);}`,
  );
  await click("Export alignment CSV");
  const csv = await evaluate("window.alignmentExport.text()");
  assert.ok(csv.includes("Graduation program"));
  assert.ok(csv.includes("agri-graduate@example.test"));
  assert.ok(csv.includes("Duties and explanation"));
  failNext = true;
  await click("Refresh");
  await until(
    `document.querySelector('[role="alert"]')?.textContent.includes('Fixture alignment report failed')`,
  );
  await click("Retry");
  await until(`${roster}?.textContent.includes('agri-graduate@example.test')`);
  await click("Tracer Responses");
  await until(`document.querySelector('[data-tracer-table]')`);
  await click("Program\u2013Job Alignment");
  await until(
    `${roster}?.textContent.includes('legacy-graduate@example.test')`,
  );
  assert.deepEqual(runtimeErrors, []);
  console.log(
    "Passed: default 3-5-year alignment view, dated snapshots, all-course filters, unassessed legacy records, period changes, CSV export, retry, tab navigation, desktop/mobile layouts. Test data only. Screenshots: " +
      artifacts,
  );
} finally {
  await send("Browser.close").catch(() => {});
  socket.close();
}
