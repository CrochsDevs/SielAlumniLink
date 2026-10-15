import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// Uses a separate headless browser and API fixtures. No real alumni responses
// are read or written. Start Edge/Chrome with remote debugging on port 9228.
const artifacts = path.join(os.tmpdir(), "SielAlumni-tracer-check");
await mkdir(artifacts, { recursive: true });
const target = await (
  await fetch("http://localhost:9228/json/new?about:blank", { method: "PUT" })
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
  _id: "111111111111111111111111",
  authId: "aaaaaaaaaaaaaaaaaaaaaaaa",
  name: "Tracer Test Alumni",
  email: "tracer-test@example.test",
  role: "alumni",
  passwordSetupRequired: false,
};
let savedResponse = null;
let failNextSave = true;
let failNextLoad = false;
const saveRequests = [];
listeners.set("Runtime.exceptionThrown", ({ exceptionDetails }) =>
  runtimeErrors.push(
    exceptionDetails.exception?.description || exceptionDetails.text,
  ),
);
listeners.set("Fetch.requestPaused", async ({ requestId, request }) => {
  try {
    const route = new URL(request.url).pathname.replace("/api", "");
    let data = [],
      responseCode = 200,
      message;
    if (request.method === "OPTIONS") data = null;
    else if (route === "/auth/me" || route === "/users/me") data = author;
    else if (route === "/tracer/me") {
      if (failNextLoad) {
        failNextLoad = false;
        responseCode = 503;
        message = "Unable to load the test response.";
      } else data = savedResponse;
    } else if (route === "/tracer" && request.method === "POST") {
      const payload = JSON.parse(request.postData);
      saveRequests.push(payload);
      if (failNextSave) {
        failNextSave = false;
        responseCode = 503;
        message = "Save failed for test. Please retry.";
      } else {
        savedResponse = payload;
        data = payload;
      }
    }
    await send("Fetch.fulfillRequest", {
      requestId,
      responseCode,
      responseHeaders: [
        { name: "Content-Type", value: "application/json" },
        { name: "Access-Control-Allow-Origin", value: "http://localhost:5173" },
        { name: "Access-Control-Allow-Credentials", value: "true" },
        {
          name: "Access-Control-Allow-Methods",
          value: "GET,POST,PUT,DELETE,OPTIONS",
        },
        { name: "Access-Control-Allow-Headers", value: "Content-Type" },
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
const setValue = async (id, value, select = false) =>
  evaluate(`(() => {
  const field = document.getElementById(${JSON.stringify(id)});
  Object.getOwnPropertyDescriptor(field.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : ${select ? "HTMLSelectElement" : "HTMLInputElement"}.prototype, 'value').set.call(field, ${JSON.stringify(value)});
  field.dispatchEvent(new Event('${select ? "change" : "input"}', { bubbles: true }));
})()`);
const next = async () =>
  evaluate(
    "document.querySelector('dialog[data-tracer-modal] button[type=submit]').click()",
  );
const capture = async (label, width, theme) => {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: width < 768,
  });
  await evaluate(
    `document.documentElement.classList.toggle('dark', ${theme === "dark"})`,
  );
  await new Promise((resolve) => setTimeout(resolve, 200));
  const layout = await evaluate(
    "({modal:document.querySelector('[data-tracer-modal]').clientWidth, content:document.querySelector('[data-tracer-modal]').scrollWidth})",
  );
  assert.ok(
    layout.content <= layout.modal + 1,
    `Modal overflow at ${width}px: ${JSON.stringify(layout)}`,
  );
  const shot = await send("Page.captureScreenshot", { format: "png" });
  await writeFile(
    path.join(artifacts, `${label}-${theme}-${width}.png`),
    Buffer.from(shot.data, "base64"),
  );
};

try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Fetch.enable", {
    patterns: [{ urlPattern: "http://localhost:3002/api/*" }],
  });
  await send("Page.navigate", { url: "http://localhost:5173/alumni/tracer" });
  await until(
    "document.querySelector('dialog[data-tracer-modal] #tracer-batch')",
  );
  assert.equal(
    await evaluate(
      "document.querySelector('[data-tracer-modal]').matches(':modal')",
    ),
    true,
  );
  assert.equal(await evaluate("document.body.style.overflow"), "hidden");
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"]) await capture("basic", width, theme);
  await next();
  await until("document.querySelector('#tracer-batch[aria-invalid=true]')");
  assert.equal(saveRequests.length, 0, "Invalid first step must not save");
  await setValue("tracer-batch", "2020", true);
  assert.equal(
    await evaluate(
      "document.querySelectorAll('#tracer-program optgroup').length",
    ),
    9,
  );
  assert.equal(
    await evaluate(
      "document.querySelectorAll('#tracer-program option[value]:not([value=\"\"])').length",
    ),
    44,
  );
  await setValue(
    "tracer-program",
    "Bachelor of Science in Information Technology",
    true,
  );
  await next();
  await until("document.querySelector('#tracer-status')");
  await setValue("tracer-company", "Test Company");
  await setValue("tracer-position", "Web Developer");
  await next();
  await until("document.querySelector('#tracer-employmentDate')");
  await setValue("tracer-employmentDate", "2024-06");
  await setValue("tracer-location", "Nueva Ecija");
  await setValue("tracer-jobAlignment", "directly_related", true);
  await setValue(
    "tracer-alignmentExplanation",
    "I use programming and database skills to build web applications.",
  );
  await evaluate(
    "Array.from(document.querySelectorAll('[data-tracer-modal] button')).find(b => b.textContent.trim() === 'Previous').click()",
  );
  await until("document.querySelector('#tracer-status')");
  assert.equal(
    await evaluate("document.querySelector('#tracer-status').value"),
    "Employed",
    "Previous must preserve answers",
  );
  await next();
  await until("document.querySelector('#tracer-employmentDate')");
  assert.equal(
    await evaluate("document.querySelector('#tracer-employmentDate').value"),
    "2024-06",
  );
  for (const theme of ["light", "dark"])
    await capture("job-details", 390, theme);
  await next();
  await until("document.querySelector('[data-tracer-modal] dl')");
  assert.equal(saveRequests.length, 0, "Only the review step may save");
  assert.equal(
    await evaluate(
      "document.querySelectorAll('[data-tracer-modal] dt').length",
    ),
    10,
  );
  for (const width of [320, 390, 768, 1440])
    await capture("review", width, "dark");
  await next();
  await until(
    "document.querySelector('[data-tracer-modal]').textContent.includes('Save failed for test')",
  );
  assert.equal(
    await evaluate(
      "document.querySelector('[data-tracer-modal] [role=status]')?.textContent.includes('Thank you') || false",
    ),
    false,
    "Failure must not show success",
  );
  assert.equal(
    await evaluate(
      "document.querySelectorAll('[data-tracer-modal] dt').length",
    ),
    10,
    "Failed save must preserve review",
  );
  await evaluate(
    "(() => {const button=document.querySelector('[data-tracer-modal] button[type=submit]');button.click();button.click();})()",
  );
  await until(
    "document.querySelector('[data-tracer-modal] [role=status]')?.textContent.includes('Thank you')",
  );
  assert.equal(saveRequests.length, 2, "A double click must not submit twice");
  assert.deepEqual(savedResponse, {
    batch: "2020",
    program: "Bachelor of Science in Information Technology",
    status: "Employed",
    company: "Test Company",
    position: "Web Developer",
    salaryRange: "Prefer not to say",
    employmentDate: "2024-06",
    location: "Nueva Ecija",
    jobAlignment: "directly_related",
    alignmentExplanation:
      "I use programming and database skills to build web applications.",
  });
  await capture("saved", 390, "dark");
  await evaluate(
    "Array.from(document.querySelectorAll('[data-tracer-modal] button')).find(b => b.textContent.trim() === 'Update my response').click()",
  );
  await until("document.querySelector('#tracer-batch')");
  assert.equal(
    await evaluate("document.querySelector('#tracer-program').value"),
    savedResponse.program,
  );
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
  await until("!document.querySelector('[data-tracer-modal]')");
  assert.notEqual(await evaluate("document.body.style.overflow"), "hidden");
  await send("Page.reload");
  await until("document.querySelector('#tracer-batch')");
  assert.equal(
    await evaluate("document.querySelector('#tracer-batch').value"),
    savedResponse.batch,
    "Saved response must preload after refresh",
  );
  failNextLoad = true;
  await send("Page.reload");
  await until(
    "document.querySelector('[data-tracer-modal]')?.textContent.includes('Unable to load the test response')",
  );
  await evaluate(
    "Array.from(document.querySelectorAll('[data-tracer-modal] button')).find(b => b.textContent.trim() === 'Retry').click()",
  );
  await until("document.querySelector('#tracer-batch')");
  assert.equal(
    await evaluate("document.querySelector('#tracer-batch').value"),
    savedResponse.batch,
  );
  await next();
  await until("document.querySelector('#tracer-status')");
  await setValue("tracer-status", "Self-employed", true);
  await until(
    "document.querySelector('label[for=tracer-company]').textContent.includes('Business')",
  );
  await setValue("tracer-company", "My Studio");
  await setValue("tracer-position", "Freelance Designer");
  await next();
  await until("document.querySelector('#tracer-employmentDate')");
  assert.equal(
    await evaluate(
      "document.querySelector('label[for=tracer-salaryRange]').textContent.includes('Income')",
    ),
    true,
  );
  await setValue("tracer-employmentDate", "2025-01");
  await setValue("tracer-jobAlignment", "partly_related", true);
  await setValue(
    "tracer-alignmentExplanation",
    "I use some digital skills in freelance design work.",
  );
  await next();
  await until("document.querySelector('[data-tracer-modal] dl')");
  await next();
  await until(
    "document.querySelector('[data-tracer-modal] [role=status]')?.textContent.includes('Thank you')",
  );
  assert.equal(savedResponse.status, "Self-employed");
  assert.equal(savedResponse.company, "My Studio");

  const editStatus = async (status) => {
    await evaluate(
      "Array.from(document.querySelectorAll('[data-tracer-modal] button')).find(b => b.textContent.trim() === 'Update my response').click()",
    );
    await until("document.querySelector('#tracer-batch')");
    await next();
    await until("document.querySelector('#tracer-status')");
    await setValue("tracer-status", status, true);
  };
  await editStatus("Studying");
  await until(
    "document.querySelector('label[for=tracer-company]').textContent.includes('School')",
  );
  await setValue("tracer-company", "CLSU Graduate School");
  await setValue("tracer-position", "Master of Science");
  await setValue("tracer-location", "Nueva Ecija");
  await next();
  await until("document.querySelector('[data-tracer-modal] dl')");
  assert.equal(
    await evaluate(
      "document.querySelectorAll('[data-tracer-modal] dt').length",
    ),
    6,
  );
  assert.equal(
    await evaluate(
      "!!document.querySelector('#tracer-salaryRange, #tracer-employmentDate')",
    ),
    false,
  );
  await next();
  await until(
    "document.querySelector('[data-tracer-modal] [role=status]')?.textContent.includes('Thank you')",
  );
  assert.equal(savedResponse.company, "CLSU Graduate School");
  assert.equal(savedResponse.salaryRange, "");
  assert.equal(savedResponse.employmentDate, "");

  await editStatus("Unemployed");
  await until("!document.querySelector('#tracer-company')");
  assert.equal(
    await evaluate(
      "document.querySelectorAll('[aria-label=\"Tracer study progress\"] li').length",
    ),
    3,
  );
  await next();
  await until("document.querySelector('[data-tracer-modal] dl')");
  assert.equal(
    await evaluate(
      "document.querySelectorAll('[data-tracer-modal] dt').length",
    ),
    3,
  );
  await evaluate(
    "Array.from(document.querySelectorAll('[data-tracer-modal] button')).find(b => b.textContent.trim() === 'Previous').click()",
  );
  await until("document.querySelector('#tracer-status')");
  assert.equal(
    await evaluate("document.querySelector('#tracer-status').value"),
    "Unemployed",
  );
  await next();
  await until("document.querySelector('[data-tracer-modal] dl')");
  await next();
  await until(
    "document.querySelector('[data-tracer-modal] [role=status]')?.textContent.includes('Thank you')",
  );
  assert.deepEqual(savedResponse, {
    batch: "2020",
    program: "Bachelor of Science in Information Technology",
    status: "Unemployed",
    company: "",
    position: "",
    salaryRange: "",
    employmentDate: "",
    location: "",
    jobAlignment: "",
    alignmentExplanation: "",
  });
  await send("Page.reload");
  await until("document.querySelector('#tracer-batch')");
  await next();
  await until("document.querySelector('#tracer-status')");
  assert.equal(
    await evaluate("document.querySelector('#tracer-status').value"),
    "Unemployed",
  );
  assert.equal(
    await evaluate("!!document.querySelector('#tracer-company')"),
    false,
  );
  assert.deepEqual(runtimeErrors, []);
  console.log(
    "Tracer browser check passed: modal, four steps, validation, retained answers, review, failure/retry, duplicate-submit guard, prefill, themes, and mobile/desktop layouts.",
  );
  console.log("Screenshots:", artifacts);
} catch (error) {
  console.log(
    "Browser diagnostic:",
    await evaluate(
      "document.querySelector('[data-tracer-modal]')?.innerText || document.body.innerText",
    ).catch(() => "unavailable"),
  );
  throw error;
} finally {
  await send("Browser.close").catch(() => {});
  socket.close();
}
