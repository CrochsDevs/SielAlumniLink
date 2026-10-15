import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// Uses a separate headless browser and API fixtures. No real alumni responses
// are read or written. Start Edge/Chrome with remote debugging on port 9235.
const artifacts = path.join(os.tmpdir(), "SielAlumni-admin-dashboard-check");
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

const { summarizeEngagement, reportPeriod } =
  await import("../../Server/modules/reports/reports.policy.js");
let fail = true;
const dates = [];
listeners.set("Runtime.exceptionThrown", ({ exceptionDetails }) =>
  runtimeErrors.push(exceptionDetails.text),
);
listeners.set("Fetch.requestPaused", async ({ requestId, request }) => {
  const url = new URL(request.url);
  let data = [],
    responseCode = 200;
  if (url.pathname.endsWith("/auth/me") || url.pathname.endsWith("/users/me"))
    data = {
      _id: "111111111111111111111111",
      authId: "111111111111111111111111",
      name: "Admin",
      email: "admin@example.test",
      role: "admin",
      passwordSetupRequired: false,
    };
  if (url.pathname.endsWith("/notifications/unread-count")) data = { count: 0 };
  if (url.pathname.endsWith("/reports/dashboard")) {
    const date = url.searchParams.get("date");
    dates.push(date);
    if (fail) responseCode = 503;
    data = {
      date,
      timezone: "Asia/Manila",
      generatedAt: new Date().toISOString(),
      members: { students: 10, alumni: 20, total: 30 },
      mentorship: { accepted: 6, pending: 3, rejected: 1, total: 10 },
      engagement: summarizeEngagement(
        date === "2023-01-01"
          ? []
          : [
              {
                source: "logins",
                hour: date + "T08",
                count: 9,
                actors: ["one", "two"],
              },
            ],
        reportPeriod(date),
      ),
    };
  }
  await send("Fetch.fulfillRequest", {
    requestId,
    responseCode,
    responseHeaders: [
      { name: "Content-Type", value: "application/json" },
      { name: "Access-Control-Allow-Origin", value: "http://localhost:5173" },
      { name: "Access-Control-Allow-Credentials", value: "true" },
    ],
    body: Buffer.from(
      JSON.stringify({
        success: responseCode === 200,
        data,
        message: responseCode === 503 ? "Reports unavailable" : "",
      }),
    ).toString("base64"),
  });
});
const click = (text) =>
  evaluate(
    'Array.from(document.querySelectorAll("button")).find(b => b.textContent.trim() === ' +
      JSON.stringify(text) +
      ").click()",
  );
try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Fetch.enable", {
    patterns: [{ urlPattern: "http://localhost:3002/api/*" }],
  });
  await send("Page.navigate", { url: "http://localhost:5173/admin" });
  await until('document.body.textContent.includes("Reports unavailable")');
  fail = false;
  await click("Retry reports");
  await until(
    'document.body.textContent.includes("Mentorship Status Reports")',
  );
  await evaluate(
    'Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Daily Engagement Summary")).click()',
  );
  await until(
    'document.querySelectorAll("[aria-label$=\\"recorded actions\\"]").length === 24',
  );
  await evaluate(
    'document.querySelectorAll("[aria-label$=\\"recorded actions\\"]")[8].click()',
  );
  await until(
    'document.body.textContent.includes("9 actions · 2 active members")',
  );
  await evaluate(
    'Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Yearly Engagement Summary")).click()',
  );
  await until(
    'document.querySelectorAll("[aria-label$=\\"recorded actions\\"]").length === 12',
  );
  for (const [width, dark] of [
    [1440, false],
    [390, false],
    [320, true],
  ]) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: width < 768,
    });
    await evaluate(
      'document.documentElement.classList.toggle("dark", ' +
        dark +
        "); window.scrollTo(0,0)",
    );
    await new Promise((resolve) => setTimeout(resolve, 250));
    assert.ok(
      await evaluate("document.documentElement.scrollWidth <= " + (width + 1)),
      "viewport overflow " + width,
    );
    const shot = await send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
    });
    await writeFile(
      path.join(artifacts, "admin-" + width + ".png"),
      Buffer.from(shot.data, "base64"),
    );
  }
  await evaluate(
    'window.reportCsv = ""; URL.createObjectURL = blob => { blob.text().then(text => window.reportCsv = text); return "blob:test"; }; HTMLAnchorElement.prototype.click = function() {};',
  );
  await click("Export CSV");
  await until('window.reportCsv.includes("Mentorship status")');
  assert.ok(await evaluate('window.reportCsv.includes("Period total")'));
  await evaluate(
    '(() => { const input = document.querySelector("input[type=date]"); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "2023-01-01"); input.dispatchEvent(new Event("input", { bubbles: true })); })()',
  );
  await until(
    'document.body.textContent.includes("No recorded engagement for this period.")',
  );
  assert.ok(dates.includes("2023-01-01"));
  assert.deepEqual(runtimeErrors, []);
  console.log(
    "PASS: error/retry, period selection, chart detail, CSV, date filtering, empty state, desktop/mobile/dark; screenshots: " +
      artifacts,
  );
} finally {
  await send("Browser.close");
  socket.close();
}
