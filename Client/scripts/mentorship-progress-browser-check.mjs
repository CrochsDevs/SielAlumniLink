import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { goalSnapshot } from "../../Server/modules/mentorship/mentorship.policy.js";

// Uses a separate headless browser and API fixtures. No real alumni responses
// are read or written. Start Edge/Chrome with remote debugging on port 9233.
const artifacts = path.join(
  os.tmpdir(),
  "SielAlumni-mentorship-progress-check",
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
      student,
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
try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Fetch.enable", {
    patterns: [{ urlPattern: "http://localhost:3002/api/*" }],
  });
  await send("Page.navigate", {
    url: "http://localhost:5173/student/mentorship",
  });
  await until(
    `document.querySelector('nav[aria-label="Student mentorship workspace"]')`,
  );
  await click("Progress tracker");
  await until(`document.querySelectorAll('[data-mentorship-goal]').length===3`);
  assert.equal(
    await evaluate(
      `document.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')`,
    ),
    "0",
  );
  await photo("student-progress-desktop", 1440, false);
  await photo("student-progress-mobile-dark", 390, true);
  await photo("student-progress-small-mobile", 320, false);
  assert.equal(await evaluate(`document.querySelector('[aria-label="Status for Resume Building"]')===null`), true);
  await fill(
    "Note for Resume Building",
    "Drafted my resume and collected project examples.",
  );
  await click("Save activity", goal("resume_building"));
  await until(
    `${goal("resume_building")}.querySelector('[role="alert"]')?.textContent.includes('Fixture progress save failed')`,
  );
  assert.equal(saved.get(connections[0]._id).length, 0);
  assert.equal(
    await evaluate(
      `document.querySelector('[aria-label="Note for Resume Building"]').value`,
    ),
    "Drafted my resume and collected project examples.",
  );
  await evaluate(
    `(()=>{const button=${goal("resume_building")}.querySelector('button[type=submit]');button.click();button.click();})()`,
  );
  await until(
    `document.body.textContent.includes('Resume Building progress saved.')`,
  );
  assert.equal(updates, 2);
  assert.equal(saved.get(connections[0]._id)[0].status, "in_progress");
  await fill("Select mentorship connection", connections[1]._id);
  await until(
    `${goal("resume_building")}.textContent.includes('Not Started')`,
  );
  assert.equal(
    await evaluate(
      `document.querySelector('[aria-label="Note for Resume Building"]').value`,
    ),
    "",
  );
  await fill("Select mentorship connection", connections[0]._id);
  await until(
    `${goal("resume_building")}.textContent.includes('In Progress')`,
  );
  await navigate("/student/mentorship");
  assert.equal(
    await evaluate(
      `${goal("resume_building")}.textContent.includes('In Progress')`,
    ),
    true,
  );
  user = mentor;
  await navigate("/alumni/mentorship");
  assert.ok(
    await evaluate(`document.body.textContent.includes('Alex Santos')`),
  );
  assert.equal(
    await evaluate(
      `document.querySelector('[aria-label="Note for Resume Building"]').value`,
    ),
    "Drafted my resume and collected project examples.",
  );
  for (const [key, title] of [
    ["resume_building", "Resume Building"],
    ["interview_preparation", "Interview Preparation"],
    ["career_planning", "Career Planning"],
  ]) {
    await fill("Status for " + title, "completed");
    await click("Save mentor review", goal(key));
    await until(
      `document.body.textContent.includes('${title} progress saved.')`,
    );
  }
  await until(
    `document.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')==='100'`,
  );
  assert.equal(saved.get(connections[0]._id).length, 3);
  await photo("mentor-progress-desktop-dark", 1440, true);
  await photo("mentor-progress-mobile", 390, false);
  user = student;
  await navigate("/student/mentorship");
  assert.equal(
    await evaluate(
      `document.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')`,
    ),
    "100",
  );
  assert.ok(
    await evaluate(
      `${goal("resume_building")}.textContent.includes('Jamie Reyes')`,
    ),
  );
  await fill("Note for Resume Building", "Added a follow-up reflection.");
  saved
    .get(connections[0]._id)
    .find((item) => item.goalKey === "resume_building").revision++;
  await click("Save activity", goal("resume_building"));
  await until(
    `${goal("resume_building")}.textContent.includes('mentorship partner')`,
  );
  await click("Refresh progress");
  await until(
    `!document.querySelector('[role="alert"]')&&document.querySelectorAll('[data-mentorship-goal]').length===3`,
  );
  empty = true;
  await click("Refresh progress");
  await until(
    `document.body.textContent.includes('Start with a mentorship connection')`,
  );
  assert.equal(
    await evaluate(
      `document.querySelectorAll('[data-mentorship-goal]').length`,
    ),
    0,
  );
  assert.deepEqual(runtimeErrors, []);
  console.log(
    "Passed: three default goals, student updates, error/retry, duplicate submission guard, connection isolation, reload persistence, mentor shared updates, 100% completion, stale-edit conflict, empty state, and desktop/mobile layouts. API fixtures only. Screenshots: " +
      artifacts,
  );
} finally {
  await send("Browser.close").catch(() => {});
  socket.close();
}
