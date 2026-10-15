// Run with isolated Edge/Chrome on port 9232. API fixtures never change real student records.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// Uses a separate headless browser and API fixtures. No real alumni responses
// are read or written. Start Edge/Chrome with remote debugging on port 9232.
const artifacts = path.join(os.tmpdir(), "SielAlumni-mentorship-design-check");
await mkdir(artifacts, { recursive: true });
const target = await (
  await fetch("http://localhost:9232/json/new?about:blank", { method: "PUT" })
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

const user = {
  _id: "aaaaaaaaaaaaaaaaaaaaaaaa",
  authId: "aaaaaaaaaaaaaaaaaaaaaaaa",
  name: "Alex Santos",
  email: "alex@example.test",
  role: "student",
  program: "BS Information Technology",
  passwordSetupRequired: false,
};
const mentors = [
  [
    "Maria Reyes",
    "BS Information Technology",
    "Software engineer passionate about accessible products and helping students navigate their first role.",
    ["React", "Design systems", "Accessibility"],
  ],
  [
    "Daniel Cruz",
    "BS Computer Science",
    "Turning ideas into useful software. Happy to share lessons from a career in engineering.",
    ["JavaScript", "Python"],
  ],
  [
    "Sofia Ramos",
    "BS Information Technology",
    "Exploring data, research, and product design.",
    ["Data analysis", "Research"],
  ],
  [
    "Carlo Garcia",
    "BS Agriculture",
    "Working with communities to build sustainable agricultural practices.",
    ["Research", "Sustainability"],
  ],
].map(([name, program, bio, skills], index) => ({
  _id: String(index + 1).padStart(24, "b"),
  name,
  program,
  bio,
  skills,
  email: `mentor${index}@example.test`,
  role: "alumni",
  batch: "2022",
  location: "Nueva Ecija",
}));
const connections = [
  {
    requesterEmail: user.email,
    recipientEmail: mentors[1].email,
    status: "accepted",
  },
  {
    requesterEmail: user.email,
    recipientEmail: mentors[2].email,
    status: "pending",
  },
  {
    requesterEmail: mentors[3].email,
    recipientEmail: user.email,
    status: "pending",
  },
];
let mutations = 0,
  failFirst = true;
listeners.set("Runtime.exceptionThrown", ({ exceptionDetails }) =>
  runtimeErrors.push(exceptionDetails.text),
);
listeners.set("Fetch.requestPaused", async ({ requestId, request }) => {
  const route = new URL(request.url).pathname.replace("/api", "");
  let data = [],
    responseCode = 200;
  if (route === "/auth/me" || route === "/users/me") data = user;
  else if (route === "/users") {
    if (failFirst) {
      responseCode = 503;
    } else data = [...mentors, { ...user, email: "otherstudent@example.test" }];
  } else if (route === "/connections/me") data = connections;
  else if (route === "/connections" && request.method === "POST") {
    mutations++;
    connections.push({
      requesterEmail: user.email,
      recipientEmail: JSON.parse(request.postData).email,
      status: "pending",
    });
    data = connections.at(-1);
  }
  await send("Fetch.fulfillRequest", {
    requestId,
    responseCode,
    responseHeaders: [
      { name: "Content-Type", value: "application/json" },
      { name: "Access-Control-Allow-Origin", value: "http://localhost:5173" },
      { name: "Access-Control-Allow-Credentials", value: "true" },
      { name: "Access-Control-Allow-Methods", value: "GET,POST,OPTIONS" },
      { name: "Access-Control-Allow-Headers", value: "Content-Type" },
    ],
    body: Buffer.from(
      JSON.stringify({ success: responseCode === 200, data }),
    ).toString("base64"),
  });
});
const click = (label) =>
  evaluate(
    `Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(label)}).click()`,
  );
const photo = async (name, width, dark) => {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: width < 768,
  });
  await evaluate(`document.documentElement.classList.toggle('dark',${dark})`);
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(
    await evaluate(`document.documentElement.scrollWidth<=${width + 1}`),
    true,
    "Overflow",
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
    url: "http://localhost:5173/student/mentorship",
  });
  await until(`document.querySelector('[role=alert]')`);
  failFirst = false;
  await click("Refresh mentors");
  await until(`document.querySelectorAll('article').length===4`);
  await photo("mentorship-desktop", 1440, false);
  await photo("mentorship-mobile-dark", 390, true);
  await evaluate(
    `document.querySelector('nav[aria-label="Mentor views"] button:nth-child(2)').click()`,
  );
  await until(`document.querySelectorAll('article').length===1`);
  await evaluate(
    `document.querySelector('nav[aria-label="Mentor views"] button:nth-child(3)').click()`,
  );
  await until(`document.querySelectorAll('article').length===2`);
  assert.ok(
    await evaluate(
      `Boolean(document.querySelector('a[href="/student/requests"]'))`,
    ),
  );
  await evaluate(
    `document.querySelector('nav[aria-label="Mentor views"] button').click()`,
  );
  await evaluate(
    `(()=>{const e=document.querySelector('main input[type=search]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'Accessibility');e.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
  await until(`document.querySelectorAll('article').length===1`);
  await click("Connect");
  await until(
    `document.querySelector('article').textContent.includes('Request sent')`,
  );
  assert.equal(mutations, 1);
  await click("Clear filters");
  await until(`document.querySelectorAll('article').length===4`);
  await photo("mentorship-mobile", 390, false);
  await send("Page.reload");
  await until(`document.querySelectorAll('article').length===4`);
  assert.ok(
    await evaluate(
      `document.querySelector('article').textContent.includes('Request sent')`,
    ),
  );
  assert.deepEqual(runtimeErrors, []);
  console.log(
    "Passed: failure/retry, alumni-only discovery, connection tabs, skill search, request submission and reload, mobile/desktop layouts and dark mode. Mock APIs only. Artifacts: " +
      artifacts,
  );
} finally {
  await send("Browser.close").catch(() => {});
  socket.close();
}
