import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { goalSnapshot } from "../../Server/modules/mentorship/mentorship.policy.js";

// Uses a separate headless browser and API fixtures. No real alumni responses
// are read or written. Start Edge/Chrome with remote debugging on port 9233.
const artifacts = path.join(
  os.tmpdir(),
  "SielAlumni-mentee-overview-check",
);
await mkdir(artifacts, { recursive: true });
const target = await (
  await fetch("http://localhost:9233/json/new?about:blank", { method: "PUT" })
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

const student = {
  _id: "111111111111111111111111",
  authId: "aaaaaaaaaaaaaaaaaaaaaaaa",
  name: "Alex Santos",
  email: "alex@example.test",
  role: "student",
  program: "BS Information Technology",
  passwordSetupRequired: false,
};
const mentor = {
  ...student,
  _id: "222222222222222222222222",
  authId: "bbbbbbbbbbbbbbbbbbbbbbbb",
  name: "Jamie Reyes",
  email: "jamie@example.test",
  role: "alumni",
};
const secondMentor = {
  ...mentor,
  _id: "333333333333333333333333",
  authId: "cccccccccccccccccccccccc",
  name: "Morgan Cruz",
  email: "morgan@example.test",
};
const connections = [
  {
    _id: "dddddddddddddddddddddddd",
    requesterAuthId: student.authId,
    requesterEmail: student.email,
    recipientAuthId: mentor.authId,
    recipientEmail: mentor.email,
    status: "accepted",
  },
  {
    _id: "eeeeeeeeeeeeeeeeeeeeeeee",
    requesterAuthId: student.authId,
    requesterEmail: student.email,
    recipientAuthId: secondMentor.authId,
    recipientEmail: secondMentor.email,
    status: "accepted",
  },
];
const otherStudent = { ...student, authId: 'ffffffffffffffffffffffff', name: 'Sam Rivera', email: 'sam@example.test', program: 'BS Computer Science' };
connections[1].requesterAuthId = otherStudent.authId;
connections[1].recipientAuthId = mentor.authId;
const saved = new Map(connections.map((connection) => [connection._id, []]));
const snapshots = () =>
  connections
    .filter((connection) =>
      [connection.requesterAuthId, connection.recipientAuthId].includes(
        user.authId,
      ),
    )
    .map((connection) => ({
      connectionId: connection._id,
      student: connection._id === connections[0]._id ? student : otherStudent,
      mentor:
        connection.recipientAuthId === mentor.authId ? mentor : secondMentor,
      ...goalSnapshot(saved.get(connection._id)),
    }));
let user = student,
  failNextUpdate = true,
  updates = 0,
  empty = false;
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
      message = "";
    if (request.method !== "OPTIONS") {
      const input = request.postData ? JSON.parse(request.postData) : {};
      if (route === "/auth/me" || route === "/users/me") data = user;
      else if (route === "/users") data = [mentor, secondMentor];
      else if (route === "/connections/me") data = connections;
      else if (route === "/development/mentees") data = [student];
      else if (route === "/notifications/unread-count") data = { count: 0 };
      else if (route === "/mentorship/me") data = empty ? [] : snapshots();
      else if (route === "/mentorship/matches")
        data = {
          preferences: { interests: [], careerGoals: "" },
          matches: [],
          profile: { skills: [], program: student.program },
          candidateCount: 2,
        };
      else if (route.startsWith("/mentorship/") && request.method === "PUT") {
        updates++;
        const id = route.split("/")[2],
          key = route.split("/").pop(),
          records = saved.get(id),
          old = records.find((goal) => goal.goalKey === key);
        if (failNextUpdate) {
          failNextUpdate = false;
          responseCode = 503;
          message = "Fixture progress save failed";
        } else if (input.revision !== (old?.revision || 0)) {
          responseCode = 409;
          message =
            "This goal was updated by your mentorship partner. Refresh and try again.";
        } else {
          await new Promise((resolve) => setTimeout(resolve, 100));
          const next = {
            goalKey: key,
            status: user.role === 'student' ? old?.confirmedByAuthId ? 'completed' : input.note?.trim() ? 'in_progress' : 'not_started' : input.status,
            confirmedByAuthId: old?.confirmedByAuthId || (user.role === 'alumni' && input.status === 'completed' ? user.authId : null),
            note: input.note,
            revision: input.revision + 1,
            updatedAt: new Date().toISOString(),
            updatedByName: user.name,
            updatedByRole: user.role,
            completedAt:
              input.status === "completed" ? new Date().toISOString() : null,
          };
          saved.set(id, [
            ...records.filter((goal) => goal.goalKey !== key),
            next,
          ]);
          data = snapshots().find((tracker) => tracker.connectionId === id);
        }
      }
    }
    await send("Fetch.fulfillRequest", {
      requestId,
      responseCode,
      responseHeaders: [
        { name: "Content-Type", value: "application/json" },
        { name: "Access-Control-Allow-Origin", value: "http://localhost:5173" },
        { name: "Access-Control-Allow-Credentials", value: "true" },
        { name: "Access-Control-Allow-Methods", value: "GET,PUT,POST,OPTIONS" },
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
const click = (label, scope = "document") =>
  evaluate(
    `Array.from(${scope}.querySelectorAll('button')).find(button=>button.textContent.trim()===${JSON.stringify(label)}).click()`,
  );
const fill = (label, value) =>
  evaluate(
    `(()=>{const input=document.querySelector('[aria-label='+${JSON.stringify(JSON.stringify(label))}+']');const prototype=input.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLTextAreaElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event(input.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`,
  );
const goal = (key) =>
  `document.querySelector('[data-mentorship-goal="${key}"]')`;
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
    name + " overflow",
  );
  const shot = await send("Page.captureScreenshot", { format: "png" });
  await writeFile(
    path.join(artifacts, name + ".png"),
    Buffer.from(shot.data, "base64"),
  );
};
const navigate = async (route) => {
  await evaluate("window.oldMentorshipDocument=true");
  await send("Page.navigate", { url: "http://localhost:5173" + route });
  await until(
    `!window.oldMentorshipDocument&&Array.from(document.querySelectorAll('button')).some(button=>button.textContent.trim()==='Progress tracker')`,
  );
  await click("Progress tracker");
  await until(`document.querySelectorAll('[data-mentorship-goal]').length===3`);
};
user = mentor;
failNextUpdate = false;
try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: 'http://localhost:3002/api/*' }] });
  await send('Page.navigate', { url: 'http://localhost:5173/alumni/mentorship' });
  await until(`document.querySelector('nav[aria-label="Mentor workspace"]')`);
  await click('Progress tracker');
  await until(`document.querySelectorAll('[data-mentee-progress]').length === 2`);
  await photo('overview-desktop', 1440, false);
  await photo('overview-mobile', 390, false);
  await photo('overview-mobile-dark', 320, true);
  await fill('Filter mentee progress', 'completed');
  await until(`document.body.textContent.includes('No mentees found')`);
  await click('Clear filters');
  await evaluate(`document.querySelector('[aria-label="View progress for Alex Santos"]').click()`);
  await until(`document.querySelectorAll('[data-mentorship-goal]').length === 3`);
  await click('Review goal', goal('resume_building'));
  await fill('Status for Resume Building', 'completed');
  await until(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'All mentees').disabled`);
  await fill('Note for Resume Building', 'Resume reviewed. Clear project examples.');
  await click('Save mentor review', goal('resume_building'));
  await until(`document.body.textContent.includes('Resume Building progress saved.')`);
  assert.equal(saved.get(connections[0]._id)[0].status, 'completed');
  assert.equal(saved.get(connections[1]._id).length, 0);
  await photo('detail-mobile', 390, false);
  await photo('detail-desktop', 1440, false);
  await click('All mentees');
  await until(`document.querySelectorAll('[data-mentee-progress]').length === 2`);
  await evaluate(`document.querySelector('[aria-label="View progress for Sam Rivera"]').click()`);
  await until(`document.querySelector('[data-mentee-detail]')?.textContent.includes('Sam Rivera')`);
  assert.equal(await evaluate(`document.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')`), '0');
  await click('Review goal', goal('resume_building'));
  assert.equal(await evaluate(`document.querySelector('[aria-label="Note for Resume Building"]').value`), '');
  await click('Cancel', goal('resume_building'));
  await click('All mentees');
  await fill('Filter mentee progress', 'not_started');
  await until(`document.querySelectorAll('[data-mentee-progress]').length === 1`);
  assert.ok(await evaluate(`document.querySelector('[data-mentee-progress]').textContent.includes('Sam Rivera')`));
  assert.deepEqual(runtimeErrors, []);
  console.log('Passed: multiple mentees, filters, per-mentee review isolation, unsaved review guard, saved overview progress, desktop/mobile/dark layouts. Screenshots: ' + artifacts);
} finally {
  await send('Browser.close').catch(() => {});
  socket.close();
}
