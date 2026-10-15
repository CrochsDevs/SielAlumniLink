import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// Isolated Edge/Chrome on port 9228. All API responses are fixtures;
// no application accounts, posts, or moderation settings are changed.
const artifacts = path.join(os.tmpdir(), "SielAlumni-feed-moderation-check");
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
  if (!message.id) {
    listeners.get(message.method)?.(message.params);
    return;
  }
  const request = waiting.get(message.id);
  if (!request) return;
  clearTimeout(request.timeout);
  waiting.delete(message.id);
  if (message.error) request.reject(new Error(message.error.message));
  else request.resolve(message.result);
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
const admin = {
  _id: "111111111111111111111111",
  authId: "aaaaaaaaaaaaaaaaaaaaaaaa",
  name: "Admin Tester",
  email: "admin@example.test",
  role: "admin",
  passwordSetupRequired: false,
};
const alumni = {
  _id: "222222222222222222222222",
  authId: "bbbbbbbbbbbbbbbbbbbbbbbb",
  name: "Alumni Tester",
  email: "alumni@example.test",
  role: "alumni",
  passwordSetupRequired: false,
  program: "BS Information Technology",
  batch: "2025",
};
let account = admin;
let restricted = false;
let failNextModeration = true;
let deleted = false;
let comments = [
  {
    _id: "cccccccccccccccccccccccc",
    author: alumni,
    body: "A comment to moderate",
    isMine: false,
    createdAt: new Date().toISOString(),
  },
];
const post = {
  _id: "dddddddddddddddddddddddd",
  author: alumni,
  body: "A community update to moderate",
  audience: "connections",
  type: "update",
  details: {},
  images: [],
  createdAt: new Date().toISOString(),
  likesCount: 1,
  likedByMe: false,
  commentsCount: 1,
  sharesCount: 0,
  commentsDisabled: false,
  moderation: { blocked: false, authorRestricted: false },
};
const view = () => ({
  ...post,
  isMine: account.role === "alumni",
  commentsCount: comments.length,
  moderation:
    account.role === "admin"
      ? {
          ...post.moderation,
          authorRestricted: restricted,
          authorRestrictionReason: "Repeated spam",
        }
      : undefined,
});
const actions = [];
listeners.set("Runtime.exceptionThrown", ({ exceptionDetails }) =>
  runtimeErrors.push(
    exceptionDetails.exception?.description || exceptionDetails.text,
  ),
);
listeners.set("Fetch.requestPaused", async ({ requestId, request }) => {
  try {
    const url = new URL(request.url);
    const route = url.pathname.replace("/api", "");
    let data = [],
      responseCode = 200,
      message;
    if (request.method === "OPTIONS") data = null;
    else if (route === "/auth/me" || route === "/users/me") data = account;
    else if (route === "/users") data = [admin, alumni];
    else if (route === "/feed/status")
      data = {
        restricted: account.role !== "admin" && restricted,
        reason: "Repeated spam",
      };
    else if (route === "/feed/restrictions")
      data = restricted ? [{ author: alumni, reason: "Repeated spam" }] : [];
    else if (
      route.startsWith("/feed/restrictions/") &&
      request.method === "PUT"
    ) {
      const input = JSON.parse(request.postData);
      restricted = input.enabled;
      actions.push({ route, ...input });
      data = { restricted };
    } else if (route.endsWith("/moderation") && request.method === "PUT") {
      const input = JSON.parse(request.postData);
      actions.push({ route, ...input });
      if (failNextModeration) {
        failNextModeration = false;
        responseCode = 503;
        message = "Test moderation failure. Retry.";
      } else {
        if (input.action === "block") {
          post.moderation.blocked = input.enabled;
          post.moderation.reason = input.reason;
        } else post.commentsDisabled = input.enabled;
        data = view();
      }
    } else if (route.endsWith("/comments") && request.method === "GET")
      data = { comments, nextCursor: null };
    else if (route.includes("/comments/") && request.method === "DELETE") {
      comments = [];
      data = null;
    } else if (route === `/feed/${post._id}` && request.method === "DELETE") {
      deleted = true;
      data = null;
    } else if (route === `/feed/${post._id}`) data = view();
    else if (route === "/feed") {
      const mode = url.searchParams.get("moderation") || "published";
      const included =
        !deleted &&
        (mode === "all" || post.moderation.blocked === (mode === "blocked"));
      data = { posts: included ? [view()] : [], nextCursor: null };
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
const click = async (label, scope = "document") =>
  evaluate(
    `Array.from(${scope}.querySelectorAll('button')).find(button => button.textContent.trim() === ${JSON.stringify(label)}).click()`,
  );
const setControl = async (selector, value, type = "HTMLTextAreaElement") =>
  evaluate(
    `(() => { const field=document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(${type}.prototype,'value').set.call(field,${JSON.stringify(value)}); field.dispatchEvent(new Event('${type === "HTMLSelectElement" ? "change" : "input"}',{bubbles:true})); })()`,
  );
const menu = async (label) => {
  await evaluate(
    "document.querySelector('summary[aria-label=\"Admin post controls\"]').click()",
  );
  await click(label, "document.querySelector('article details')");
  await until("document.querySelector('dialog:modal')");
};
const invalidate = async () =>
  evaluate(
    "(async()=>{const {getSocket}=await import('/src/realtime/socket.js');getSocket().emitEvent(['feed:changed']);})()",
  );
const screenshot = async (label, width, dark) => {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: width < 768,
  });
  await evaluate(`document.documentElement.classList.toggle('dark',${dark})`);
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(
    await evaluate("document.documentElement.scrollWidth <= innerWidth + 1"),
    true,
    `Page overflow at ${width}`,
  );
  const result = await send("Page.captureScreenshot", { format: "png" });
  await writeFile(
    path.join(artifacts, `${label}-${width}-${dark ? "dark" : "light"}.png`),
    Buffer.from(result.data, "base64"),
  );
};
try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Fetch.enable", {
    patterns: [{ urlPattern: "http://localhost:3002/api/*" }],
  });
  await send("Page.navigate", { url: "http://localhost:5173/feed" });
  await until(
    "document.querySelector('summary[aria-label=\"Admin post controls\"]')",
  );
  for (const width of [320, 390, 768, 1024, 1440])
    for (const dark of [false, true])
      await screenshot("admin-feed", width, dark);
  await menu("Block post");
  assert.equal(
    await evaluate(
      "document.querySelector('dialog button[type=submit]').disabled",
    ),
    true,
  );
  await setControl('textarea[aria-label="Moderation reason"]', "Spam");
  await click("Block this post", "document.querySelector('dialog')");
  await until(
    "document.querySelector('dialog [role=alert]')?.textContent.includes('Test moderation failure')",
  );
  assert.equal(post.moderation.blocked, false);
  await click("Block this post", "document.querySelector('dialog')");
  await until("!document.querySelector('article')");
  await setControl(
    'select[aria-label="Moderation filter"]',
    "blocked",
    "HTMLSelectElement",
  );
  await until(
    "document.querySelector('article')?.textContent.includes('Only administrators')",
  );
  assert.equal(
    await evaluate(
      "document.querySelector('article button[aria-pressed]').disabled",
    ),
    true,
  );
  await screenshot("blocked-post", 390, true);
  await menu("Restore post");
  await click("Restore this post", "document.querySelector('dialog')");
  await until("!document.querySelector('article')");
  await setControl(
    'select[aria-label="Moderation filter"]',
    "published",
    "HTMLSelectElement",
  );
  await until("document.querySelector('article')");
  await menu("Turn off comments");
  await setControl(
    'textarea[aria-label="Moderation reason"]',
    "Pause discussion",
  );
  await click("Turn off comments", "document.querySelector('dialog')");
  await until(
    "document.querySelector('article')?.textContent.includes('Comments are turned off.')",
  );
  await click("Comment", "document.querySelector('article')");
  await until(
    "document.querySelector('button[aria-label=\"Delete comment\"]')",
  );
  assert.equal(
    await evaluate(
      "!!document.querySelector('textarea[aria-label=\"Write a comment\"]')",
    ),
    false,
  );
  await evaluate(
    "document.querySelector('button[aria-label=\"Delete comment\"]').click()",
  );
  await until(
    "!document.querySelector('button[aria-label=\"Delete comment\"]')",
  );
  assert.equal(comments.length, 0);
  await menu("Turn on comments");
  await click("Turn on comments", "document.querySelector('dialog')");
  await until(
    "document.querySelector('textarea[aria-label=\"Write a comment\"]')",
  );
  await menu("Restrict member from feed");
  await setControl('textarea[aria-label="Moderation reason"]', "Repeated spam");
  await click("Restrict member from feed", "document.querySelector('dialog')");
  await until(
    "document.querySelector('article')?.textContent.includes('Member participation restricted')",
  );
  await invalidate();
  await until(
    "Array.from(document.querySelectorAll('button')).some(button=>button.textContent.trim()==='Restore participation')",
  );
  account = alumni;
  await send("Page.reload");
  await until(
    "document.body.textContent.includes('Your feed participation is restricted.') && document.querySelector('article')",
  );
  assert.equal(
    await evaluate(
      "!!document.querySelector('summary[aria-label=\"Admin post controls\"]')",
    ),
    false,
  );
  assert.equal(
    await evaluate(
      "document.querySelector('article button[aria-pressed]').disabled",
    ),
    true,
  );
  assert.equal(
    await evaluate(
      "Array.from(document.querySelectorAll('button')).some(button=>button.textContent.includes('Start a post'))",
    ),
    false,
  );
  await screenshot("restricted-alumni", 390, false);
  account = admin;
  await send("Page.reload");
  await until(
    "Array.from(document.querySelectorAll('button')).some(button=>button.textContent.trim()==='Restore participation')",
  );
  await click("Restore participation");
  await until("document.body.textContent.includes('No restricted members.')");
  assert.equal(restricted, false);
  await menu("Delete post");
  await click("Delete post", "document.querySelector('dialog')");
  await until("!document.querySelector('article')");
  assert.equal(deleted, true);
  assert.equal(actions.filter((action) => action.action === "block").length, 3);
  assert.deepEqual(runtimeErrors, []);
  console.log(
    "Passed: admin controls, block failure/retry, blocked filter, restore, comments off/on, deleting others’ comments, member restriction/restore, alumni permissions, socket refresh, delete post, and responsive themes.",
  );
  console.log("Screenshots:", artifacts);
} catch (error) {
  console.log(
    "Browser diagnostic:",
    await evaluate("document.body.innerText").catch(() => "unavailable"),
  );
  throw error;
} finally {
  await send("Browser.close").catch(() => {});
  socket.close();
}
