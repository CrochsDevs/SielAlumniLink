import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// Uses a separate headless browser and API fixtures. No real alumni responses
// are read or written. Start Edge/Chrome with remote debugging on port 9233.
const artifacts = path.join(os.tmpdir(), "SielAlumni-mentor-matching-check");
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
  program: "BS IT",
  passwordSetupRequired: false,
};
const mentor = {
  _id: "222222222222222222222222",
  name: "Jamie Reyes",
  email: "jamie@example.test",
  role: "alumni",
  program: "BS IT",
  headline: "Software engineer",
};
let preferences = { interests: ["Software"], careerGoals: "" },
  connections = [],
  saves = 0,
  failedSave = true,
  failedLoad = true,
  empty = false;
const result = () => ({
  preferences,
  matches: empty
    ? []
    : [
        {
          mentor,
          score: 78,
          reasons: ["Shared skills: JavaScript", "Same program: BS IT"],
        },
      ],
  profile: { skills: ["JavaScript"], program: "BS IT" },
  candidateCount: 1,
});
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
      if (route === "/auth/me" || route === "/users/me") data = student;
      else if (route === "/users") data = [mentor];
      else if (route === "/connections/me") data = connections;
      else if (route === "/notifications/unread-count") data = { count: 0 };
      else if (route === "/mentorship/matches") {
        if (failedLoad) {
          responseCode = 503;
        } else data = result();
      } else if (route === "/mentorship/matches/preferences") {
        saves++;
        if (failedSave) {
          failedSave = false;
          responseCode = 503;
          message = "Fixture save failed";
        } else {
          await new Promise((resolve) => setTimeout(resolve, 120));
          preferences = JSON.parse(request.postData);
          data = result();
        }
      } else if (route === "/connections" && request.method === "POST") {
        connections = [
          {
            requesterEmail: student.email,
            recipientEmail: mentor.email,
            status: "pending",
          },
        ];
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
    await send("Fetch.failRequest", { requestId, errorReason: "Failed" }).catch(() => {});
  }
});
const click = (label) =>
  evaluate(
    `Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === ${JSON.stringify(label)}).click()`,
  );
const fill = (id, value) =>
  evaluate(
    `(() => { const input = document.getElementById(${JSON.stringify(id)}); Object.getOwnPropertyDescriptor(input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event('input', { bubbles: true })); })()`,
  );
const photo = async (name, width, dark) => {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: width < 768,
  });
  await evaluate(`document.documentElement.classList.toggle('dark', ${dark})`);
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.equal(
    await evaluate(`document.documentElement.scrollWidth <= ${width + 1}`),
    true,
    name + " overflow",
  );
  const shot = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
  });
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
    url: "http://localhost:5173/student/mentorship",
  });
  await until(`document.body.textContent.includes('Try again')`);
  failedLoad = false;
  await click("Try again");
  await until(`document.body.textContent.includes('Why this mentor?')`);
  assert.equal(await evaluate(`document.querySelectorAll('[aria-label="Connection status: Connected"]').length`), 0);
  await photo("matching-desktop", 1440, false);
  await photo("matching-mobile-dark", 390, true);
  await photo("matching-small-mobile", 320, false);
  await fill("mentor-goals", "Become a software engineer");
  await click("Update recommendations");
  await until(`document.body.textContent.includes('Fixture save failed')`);
  assert.equal(
    await evaluate(`document.getElementById('mentor-goals').value`),
    "Become a software engineer",
  );
  await evaluate(
    `(() => { const button = document.querySelector('form button[type=submit]'); button.click(); button.click(); })()`,
  );
  await until(`document.body.textContent.includes('career direction is saved')`);
  assert.equal(saves, 2);
  await click("Connect");
  await until(
    `document.body.textContent.includes('Request sent to Jamie Reyes')`,
  );
  assert.equal(
    await evaluate(
      `Boolean(document.querySelector('article [aria-label="Connection status: Request sent"]')) && !Array.from(document.querySelectorAll('article button')).some(button => ['Request sent', 'Connect', 'Message', 'View progress'].includes(button.textContent.trim()))`,
    ),
    true,
  );
  assert.equal(await evaluate(`document.querySelectorAll('[aria-label="Connection status: Connected"]').length`), 0);
  await click("Browse all mentors");
  await until(`document.body.textContent.includes('Explore all mentors')`);
  await click("Back to recommendations");
  await until(
    `document.getElementById('mentor-goals')?.value === 'Become a software engineer'`,
  );
  connections = [
    {
      requesterEmail: mentor.email,
      recipientEmail: student.email,
      status: "pending",
    },
  ];
  await send("Page.reload");
  await until(`document.querySelector('a[href="/student/requests"]')`);
  assert.equal(await evaluate(`document.querySelectorAll('[aria-label="Connection status: Connected"]').length`), 0);
  connections[0].status = "accepted";
  await send("Page.reload");
  await until(
    `Array.from(document.querySelectorAll('button')).some(button => button.textContent.trim() === 'Message')`,
  );
  assert.equal(await evaluate(`document.querySelectorAll('[aria-label="Connection status: Connected"]').length`), 1);
  connections = [];
  await evaluate(`window.dispatchEvent(new Event('focus'))`);
  await until(`!document.querySelector('[aria-label="Connection status: Connected"]') && Array.from(document.querySelectorAll('article button')).some(button=>button.textContent.trim()==='Connect')`);
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('article button')).some(button=>button.textContent.trim()==='View progress')`), false);
  empty = true;
  await click("Browse all mentors");
  await click("Back to recommendations");
  await until(`document.body.textContent.includes('find the right mentor')`);
  assert.deepEqual(runtimeErrors, []);
  console.log(
    "Passed: load retry, ranking display, save failure recovery, duplicate submission guard, persistence on remount, connect/pending/incoming/accepted states, empty matches, desktop and mobile layouts. API fixtures only. Screenshots: " +
      artifacts,
  );
} catch (error) {
  console.error(await evaluate("document.body.innerText"), runtimeErrors);
  throw error;
} finally {
  listeners.delete("Fetch.requestPaused");
  await send("Fetch.disable").catch(() => {});
  await send("Browser.close").catch(() => {});
  socket.close();
}
