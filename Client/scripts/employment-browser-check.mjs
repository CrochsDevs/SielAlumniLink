// Browser QA uses an isolated Edge session and API fixtures; no real profiles are changed.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  employmentState,
  updateEmployment,
  addPastEmployment,
  employmentReport,
  changeExperience,
  assertEmploymentRevision,
} from "../../Server/modules/employment/employment.policy.js";

const artifacts = path.join(os.tmpdir(), "SielAlumni-employment-check");
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
let user = {
  _id: "aaaaaaaaaaaaaaaaaaaaaaaa",
  authId: "aaaaaaaaaaaaaaaaaaaaaaaa",
  name: "Alex Santos",
  email: "alex@example.test",
  role: "alumni",
  batch: "2025",
  program: "Engineering",
  passwordSetupRequired: false,
};
let profile = { ...user, employmentHistory: [] };
let reports;
let failNextSave = false;
let requestError;
let closing = false;
listeners.set("Runtime.exceptionThrown", ({ exceptionDetails }) =>
  runtimeErrors.push(
    exceptionDetails.exception?.description || exceptionDetails.text,
  ),
);
listeners.set("Fetch.requestPaused", async ({ requestId, request }) => {
  try {
    const url = new URL(request.url);
    const route = url.pathname.replace("/api", "");
    let data = [];
    let responseCode = 200;
    let message = "";
    try {
    if (request.method !== "OPTIONS") {
      const body = request.postData ? JSON.parse(request.postData) : {};
      if (route === "/users/me/experience" && request.method === "PUT") {
        profile = { ...profile, ...changeExperience(profile, body) };
        data = { ...profile, ...user, historyRevision: employmentState(profile).historyRevision };
      } else if (route === "/auth/me" || route === "/users/me") {
        assert.notEqual(request.method, "PUT", "Employment changes must use the validated endpoint");
        data = { ...profile, ...user, historyRevision: employmentState(profile).historyRevision };
      }
      else if (route === "/tracer/access") data = { updateRequired: false, quarter: "test", nextUpdateAt: new Date(Date.now() + 86400000).toISOString() };
      else if (route === "/employment/me" && request.method === "PUT") {
        if (failNextSave) {
          failNextSave = false;
          responseCode = 500;
          message = "Fixture save failed";
        } else {
          assertEmploymentRevision(profile, body.revision);
          profile = { ...profile, ...updateEmployment(profile, body) };
          data = employmentState(profile);
        }
      } else if (route === "/employment/me") data = employmentState(profile);
      else if (route === "/tracer")
        data = [
          {
            _id: "survey1",
            email: "tracer@example.test",
            batch: "2025",
            program: "Engineering",
            status: "Employed",
            company: "Survey Company",
            position: "Survey Engineer",
            employmentDate: "2025-01-01",
            respondedAt: "2026-01-01",
          },
        ];
      else if (route === "/employment/history" && request.method === "POST") {
        assertEmploymentRevision(profile, body.revision);
        profile = { ...profile, ...addPastEmployment(profile, body) };
        data = employmentState(profile);
      } else if (
        route.startsWith("/employment/history/") &&
        request.method === "DELETE"
      ) {
        assert.equal(body.revision, employmentState(profile).historyRevision);
        const index = Number(route.split("/").pop());
        profile.employmentHistory = profile.employmentHistory.filter(
          (_, i) => i !== index,
        );
        data = employmentState(profile);
      } else if (route === "/employment/reports")
        data = employmentReport(reports, {
          batch: url.searchParams.get("batch") || "",
          program: url.searchParams.get("program") || "",
        });
      else if (route === "/notifications") data = [];
      else if (route === "/notifications/unread-count") data = { count: 0 };
    }
    } catch (error) {
      if (!error.status) throw error;
      responseCode = error.status;
      message = error.message;
    }
    await send("Fetch.fulfillRequest", {
      requestId,
      responseCode,
      responseHeaders: [
        { name: "Content-Type", value: "application/json" },
        { name: "Access-Control-Allow-Origin", value: "http://127.0.0.1:5173" },
        { name: "Access-Control-Allow-Credentials", value: "true" },
        {
          name: "Access-Control-Allow-Methods",
          value: "GET,PUT,POST,DELETE,OPTIONS",
        },
        { name: "Access-Control-Allow-Headers", value: "Content-Type" },
      ],
      body: Buffer.from(
        JSON.stringify({ success: responseCode === 200, data, message }),
      ).toString("base64"),
    });
  } catch (error) {
    if (closing) return;
    requestError = error;
    await send("Fetch.failRequest", { requestId, errorReason: "Failed" }).catch(() => {});
  }
});
const click = (label) =>
  evaluate(
    `Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(label)}).click()`,
  );
const fill = (label, value) =>
  evaluate(
    `(()=>{const input=document.querySelector('[aria-label='+${JSON.stringify(JSON.stringify(label))}+']');const setter=Object.getOwnPropertyDescriptor(input.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set;setter.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event(input.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`,
  );
const submit = () =>
  evaluate(`document.querySelector('main form').requestSubmit()`);
const photo = async (name, width, dark) => {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: width < 768,
  });
  await evaluate(`document.documentElement.classList.toggle('dark',${dark})`);
  await new Promise((resolve) => setTimeout(resolve, 350));
  assert.equal(
    await evaluate(`document.documentElement.scrollWidth<=${width + 1}`),
    true,
    `${name} overflow`,
  );
  const shot = await send("Page.captureScreenshot", { format: "png" });
  await writeFile(
    path.join(artifacts, name + ".png"),
    Buffer.from(shot.data, "base64"),
  );
};
try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Fetch.enable", {
    patterns: [{ urlPattern: "http://localhost:3002/api/*" }],
  });
  await send("Page.navigate", {
    url: "http://127.0.0.1:5173/alumni/employment",
  });
  await until(`document.querySelector('[aria-label="Employment status"]')`);
  assert.equal(
    await evaluate(
      `document.querySelector('[aria-label="Employment status"]').value`,
    ),
    "",
  );
  await fill("Employment status", "Employed");
  await until(`document.querySelector('[aria-label="Current company"]')`);
  for (const [label, value] of [
    ["Current company", "Campus Engineering"],
    ["Position", "Engineer"],
    ["Industry", "Engineering"],
    ["Start month", "2025-01"],
  ])
    await fill(label, value);
  await submit();
  await until(`document.body.textContent.includes('Employment updated.')`);
  assert.equal(profile.employmentHistory.length, 1);
  await photo("alumni-desktop", 1440, false);
  await photo("alumni-mobile-dark", 390, true);
  await fill("Position", "Senior Engineer");
  await fill("Start month", "2026-08");
  await submit();
  await until(`document.body.textContent.includes('Employment updated.')`);
  assert.equal(profile.employmentHistory.length, 2);
  assert.equal(profile.employmentHistory[0].current, false);
  await evaluate("window.beforeEmploymentReload=true");
  await send("Page.reload");
  await until(
    `!window.beforeEmploymentReload && document.querySelector('[aria-label="Position"]')?.value==='Senior Engineer'`,
  );
  failNextSave = true;
  await fill("Industry", "Manufacturing");
  await submit();
  await until(
    `document.querySelector('[role="alert"]')?.textContent.includes('Fixture save failed')`,
  );
  assert.equal(profile.employmentHistory[1].industry, "Engineering");
  await fill("Industry", "Engineering");
  await submit();
  await until(`document.body.textContent.includes('Employment updated.')`);
  await click("Add past experience");
  await until(`document.querySelector('dialog')`);
  for (const [label, value] of [
    ["Company", "Old Company"],
    ["Past position", "Intern"],
    ["Past industry", "Engineering"],
    ["Past start month", "2023-01"],
    ["Past end month", "2023-06"],
  ])
    await fill(label, value);
  await photo("past-experience-mobile", 390, false);
  await evaluate(`document.querySelector('dialog form').requestSubmit()`);
  await until(`document.body.textContent.includes('Past experience added.')`);
  assert.equal(profile.employmentHistory.length, 3);
  await evaluate(
    `document.querySelector('[aria-label="Remove Intern at Old Company"]').click()`,
  );
  await until(`document.querySelector('dialog')`);
  await click("Remove");
  await until(`document.body.textContent.includes('Experience removed.')`);
  assert.equal(profile.employmentHistory.length, 2);
  await fill("Employment status", "Unemployed");
  await submit();
  await until(`document.body.textContent.includes('Employment updated.')`);
  assert.equal(
    profile.employmentHistory.filter((job) => job.current).length,
    0,
  );
  reports = [
    profile,
    {
      _id: "bbbbbbbbbbbbbbbbbbbbbbbb",
      name: "Jordan Cruz",
      batch: "2024",
      program: "IT",
      ...updateEmployment(
        {},
        {
          employmentStatus: "Self-employed",
          currentCompany: "Studio",
          position: "Owner",
          industry: "Design",
          startDate: "2024-01",
        },
      ),
    },
    {
      _id: "cccccccccccccccccccccccc",
      name: "Pat Reyes",
      batch: "2024",
      program: "IT",
    },
  ];
  user = { ...user, role: "admin" };
  await send("Page.navigate", {
    url: "http://127.0.0.1:5173/admin/employment",
  });
  await until(
    `location.pathname==='/admin/tracer'&&document.body.textContent.includes('50%')&&document.body.textContent.includes('Jordan Cruz')`,
  );
  assert.equal(await evaluate(`location.search`), "?view=employment");
  assert.equal(
    await evaluate(
      `document.querySelectorAll('aside a[href="/admin/employment"]').length`,
    ),
    0,
  );
  await photo("reports-desktop", 1440, false);
  await photo("reports-mobile-dark", 390, true);
  await evaluate(
    `document.querySelector('button[aria-label="View employment history for Alex Santos"]').click()`,
  );
  await until(
    `document.querySelector('dialog[aria-label="Alex Santos employment history"][open]')`,
  );
  await photo("progression-mobile", 390, false);
  await evaluate(`document.querySelector('dialog[open] button[aria-label^="Close employment history"]').click()`);
  await fill("Filter batch", "2024");
  await until(
    `!document.querySelector('tbody')?.textContent.includes('Alex Santos')&&document.body.textContent.includes('100%')`,
  );
  await fill("Filter batch", "");
  await until(`document.body.textContent.includes('Alex Santos')`);
  await fill("Search alumni employment", "Jordan");
  await until(
    `document.querySelector('tbody')?.textContent.includes('Jordan Cruz')&&!document.querySelector('tbody')?.textContent.includes('Alex Santos')`,
  );
  await evaluate(
    `window.employmentExport=null;const original=URL.createObjectURL;URL.createObjectURL=blob=>{window.employmentExport=blob;return original(blob);}`,
  );
  await click("Export CSV");
  const csv = await evaluate(`window.employmentExport.text()`);
  assert.ok(csv.includes("Industry"));
  assert.ok(csv.includes("Career progression"));
  assert.ok(csv.includes("Jordan Cruz"));
  assert.ok(!csv.includes("Alex Santos"));
  await click("Tracer Responses");
  await until(
    `document.querySelector('[data-tracer-table]')?.textContent.includes('tracer@example.test')`,
  );
  assert.equal(await evaluate(`location.pathname`), "/admin/tracer");
  assert.equal(await evaluate(`document.querySelectorAll('main').length`), 1);
  await photo("tracer-responses-mobile", 390, false);
  await fill("Search tracer responses", "no-match");
  await until(
    `document.querySelector('[data-tracer-table]')?.textContent.includes('No responses found')`,
  );
  await fill("Search tracer responses", "Survey Company");
  await until(
    `document.querySelector('[data-tracer-table]')?.textContent.includes('tracer@example.test')`,
  );
  await click("Export CSV");
  const tracerCSV = await evaluate(`window.employmentExport.text()`);
  assert.ok(tracerCSV.includes("tracer@example.test"));
  await click("Employment Reports");
  await until(
    `document.body.textContent.includes('Jordan Cruz')&&document.body.textContent.includes('Industry distribution')`,
  );
  await send("Page.navigate", {
    url: "http://127.0.0.1:5173/admin/tracer?view=responses",
  });
  await until(
    `document.querySelector('[data-tracer-table]')?.textContent.includes('tracer@example.test')`,
  );
  await click("Employment Reports");
  await until(`document.body.textContent.includes('Industry distribution')`);
  // The profile editor and employment page must agree and reject stale tabs.
  user = { ...user, role: "alumni" };
  await send("Page.navigate", { url: "http://127.0.0.1:5173/alumni/profile" });
  await until(`document.querySelectorAll('[aria-label="Edit experience"]').length === 2`);
  const experienceSection = `Array.from(document.querySelectorAll('main section')).find(s=>s.querySelector('h3')?.textContent.trim()==='Experience')`;
  await evaluate(`Array.from((${experienceSection}).querySelectorAll('button')).find(b=>b.textContent.trim()==='Add').click()`);
  await until(`document.querySelector('[aria-label="Add experience form"]')`);
  const profileFill = async (selector, value) => evaluate(`(()=>{
    const el=document.querySelector(${JSON.stringify(selector)});
    Object.getOwnPropertyDescriptor(el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});
    el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));
  })()`);
  const addGroup = '[aria-label="Add experience form"]';
  for (const [selector, value] of [
    ['[placeholder="Position"]', 'Profile Developer'], ['[placeholder="Company"]', 'Profile Studio'],
    ['[aria-label="Industry"]', 'Technology'], ['input[type="month"]', '2099-01'],
  ]) await profileFill(`${addGroup} ${selector}`, value);
  await evaluate(`document.querySelector('${addGroup} input[type="checkbox"]').click()`);
  await click("Add Experience");
  await until(`document.body.textContent.includes('Start month cannot be in the future')`);
  assert.equal(profile.employmentHistory.length, 2);
  await profileFill(`${addGroup} input[type="month"]`, '2025-01');
  await click("Add Experience");
  await until(`!document.querySelector('${addGroup}') && document.querySelectorAll('[aria-label="Edit experience"]').length === 3`);
  assert.equal(profile.employmentStatus, 'Employed');
  assert.equal(employmentReport([profile]).summary.employed, 1);
  assert.equal(employmentState(profile).currentCompany, 'Profile Studio');
  await photo('profile-career-mobile', 390, false);
  await send("Page.navigate", { url: "http://127.0.0.1:5173/alumni/employment" });
  await until(`document.querySelector('[aria-label="Current company"]')?.value==='Profile Studio'`);
  // Another tab saves after this screen loaded.
  profile = { ...profile, ...updateEmployment(profile, { ...employmentState(profile), industry: 'Design' }) };
  await fill('Location', 'Stale location');
  await submit();
  await until(`document.querySelector('[role="alert"]')?.textContent.includes('records changed')`);
  assert.equal(employmentState(profile).location, '');
  await click('Refresh');
  await until(`document.querySelector('[aria-label="Industry"]')?.value==='Design'`);
  await send("Page.navigate", { url: "http://127.0.0.1:5173/alumni/profile" });
  await until(`document.querySelectorAll('[aria-label="Edit experience"]').length === 3`);
  await evaluate(`document.querySelectorAll('[aria-label="Edit experience"]')[2].click()`);
  const editGroup = '[aria-label="Edit experience form"]';
  await until(`document.querySelector('${editGroup} input[type="month"]')?.value==='2025-01'`);
  await profileFill(`${editGroup} [aria-label="Industry"]`, 'Engineering');
  await click('Save Changes');
  await until(`!document.querySelector('${editGroup}')`);
  assert.equal(profile.employmentHistory.length, 3);
  assert.equal(employmentState(profile).industry, 'Engineering');
  await evaluate(`document.querySelectorAll('[aria-label="Edit experience"]')[2].click()`);
  await until(`document.querySelector('${editGroup}')`);
  profile = { ...profile, ...updateEmployment(profile, { ...employmentState(profile), position: 'Concurrent Architect', startDate: '2026-09' }) };
  await profileFill(`${editGroup} [aria-label="Position"]`, 'Stale title');
  await click('Save Changes');
  await until(`!document.querySelector('${editGroup}') && document.querySelectorAll('[aria-label="Edit experience"]').length===4`);
  assert.equal(employmentState(profile).position, 'Concurrent Architect');
  await evaluate(`document.querySelectorAll('[aria-label="Edit experience"]')[3].click()`);
  await until(`document.querySelector('${editGroup}')`);
  await evaluate(`document.querySelector('${editGroup} input[type="checkbox"]').click()`);
  await evaluate(`(()=>{const el=document.querySelectorAll('${editGroup} input[type="month"]')[1];Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'2026-10');el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await click('Save Changes');
  await until(`!document.querySelector('${editGroup}')`);
  assert.equal(profile.employmentStatus, 'Unemployed');
  assert.equal(profile.employmentHistory.filter(job=>job.current).length, 0);
  await evaluate(`document.querySelectorAll('[aria-label="Remove experience"]')[3].click()`);
  await until(`document.querySelector('.swal2-confirm')`);
  await evaluate(`document.querySelector('.swal2-confirm').click()`);
  await until(`document.querySelectorAll('[aria-label="Edit experience"]').length===3`);
  assert.equal(profile.employmentHistory.length, 3);
  // A student retains the ability to record validated experience on their own profile.
  user = { ...user, role: 'student' };
  await send("Page.navigate", { url: "http://127.0.0.1:5173/student/profile" });
  await until(`document.querySelectorAll('[aria-label="Edit experience"]').length===3`);
  await evaluate(`document.querySelectorAll('[aria-label="Edit experience"]')[0].click()`);
  await until(`document.querySelector('${editGroup}')`);
  await profileFill(`${editGroup} [aria-label="Location"]`, 'Student record correction');
  await click('Save Changes');
  await until(`!document.querySelector('${editGroup}')`);
  assert.equal(profile.employmentHistory[0].location, 'Student record correction');
  assert.equal(profile.employmentStatus, 'Unemployed');
  assert.equal(employmentReport([profile]).summary.employed, 0);
  if (requestError) throw requestError;
  assert.deepEqual(runtimeErrors, []);
  console.log(
    "Passed: profile add/edit/end/remove, shared employment status, stale-tab conflicts, student experience, alumni updates, reload persistence, role changes, save errors, past-role add/remove, unemployment, report filters, career history, CSV, merged Tracer tabs, legacy URL redirect, and mobile/desktop layouts. API fixtures only. Screenshots: " +
      artifacts,
  );
} finally {
  closing = true;
  listeners.delete("Fetch.requestPaused");
  await send("Fetch.disable").catch(() => {});
  await send("Browser.close").catch(() => {});
  socket.close();
}
