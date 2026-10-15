import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// Uses a separate headless browser and API fixtures. No real alumni responses
// are read or written. Start Edge/Chrome with remote debugging on port 9234.
const artifacts = path.join(os.tmpdir(), "SielAlumni-success-stories-check");
await mkdir(artifacts, { recursive: true });
const target = await (
  await fetch("http://localhost:9234/json/new?about:blank", { method: "PUT" })
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

const alumni = {
  _id: "111111111111111111111111",
  authId: "aaaaaaaaaaaaaaaaaaaaaaaa",
  name: "Jamie Reyes",
  email: "jamie@example.test",
  role: "alumni",
  program: "BS Information Technology",
  batch: "2020",
  passwordSetupRequired: false,
};
const student = {
  ...alumni,
  _id: "222222222222222222222222",
  authId: "bbbbbbbbbbbbbbbbbbbbbbbb",
  name: "Alex Santos",
  email: "alex@example.test",
  role: "student",
  batch: "2026",
};
const friend = {
  ...alumni,
  _id: "333333333333333333333333",
  authId: "cccccccccccccccccccccccc",
  name: "Morgan Cruz",
};
let user = alumni,
  restricted = false,
  failPost = true,
  postRequests = 0,
  removedPhotos = 0,
  failList = false;
const titles = [
  "From student projects to engineering leadership",
  "Building technology that serves the community",
  "What I wish I knew before my first interview",
];
const topics = ["career_journey", "achievement", "advice"];
let stories = Array.from({ length: 14 }, (_, index) => {
  const topic = topics[index % 3],
    sections = {
      topic,
      journey:
        topic === "career_journey"
          ? "I started with a campus project and learned to build reliable software."
          : "",
      achievements:
        topic === "achievement"
          ? "Our team delivered a community service platform."
          : "",
      advice:
        topic === "advice"
          ? "Practice explaining your projects, ask for feedback, and keep learning."
          : "",
    };
  return {
    _id: String(index + 1).padStart(24, "0"),
    type: "story",
    title: titles[index] || "A graduate story " + (index + 1),
    body: Object.values(sections).slice(1).filter(Boolean).join("\n"),
    details: index === 13 ? {} : { story: sections },
    author: index % 2 ? friend : alumni,
    audience: "public",
    images: [],
    createdAt: "2026-10-" + String(index + 1).padStart(2, "0"),
  };
});
const privateStory = {
  ...stories[0],
  _id: "dddddddddddddddddddddddd",
  title: "A private reflection",
  audience: "connections",
  author: alumni,
};
stories.push(privateStory);
const logo = await readFile(
  new URL("../src/assets/logo/clsu_logo.png", import.meta.url),
);
const allowed = (story) =>
  story.audience === "public" || story.author.authId === user.authId;
const serialize = (story) => ({
  ...story,
  isMine: story.author.authId === user.authId,
});
const runtimeErrorsFromFixture = [];
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
      message = "",
      rawBody,
      contentType = "application/json";
    if (request.method !== "OPTIONS") {
      const body =
        request.postData &&
        request.headers["Content-Type"]?.includes("application/json")
          ? JSON.parse(request.postData)
          : {};
      if (route === "/auth/me" || route === "/users/me") data = user;
      else if (route === "/notifications/unread-count") data = { count: 0 };
      else if (route === "/feed/status")
        data = { restricted, reason: restricted ? "Fixture restriction" : "" };
      else if (route === "/feed/stories") {
        if (failList) {
          failList = false;
          responseCode = 503;
          message = "Fixture story list failed";
        } else {
          let rows = stories
            .filter(allowed)
            .filter(
              (story) =>
                (!url.searchParams.get("topic") ||
                  url.searchParams.get("topic") === "all" ||
                  story.details.story?.topic ===
                    url.searchParams.get("topic")) &&
                (url.searchParams.get("mine") !== "true" ||
                  story.author.authId === user.authId) &&
                (!url.searchParams.get("q") ||
                  (story.title + " " + story.body)
                    .toLowerCase()
                    .includes(url.searchParams.get("q").toLowerCase())),
            )
            .sort((a, b) => b._id.localeCompare(a._id));
          const before = url.searchParams.get("before");
          if (before) rows = rows.filter((story) => story._id < before);
          const limit = Number(url.searchParams.get("limit") || 12);
          data = {
            posts: rows.slice(0, limit).map(serialize),
            nextCursor: rows.length > limit ? rows[limit - 1]._id : null,
          };
        }
      } else if (route === "/upload/feed-image") {
        data = { id: "eeeeeeeeeeeeeeeeeeeeeeee", width: 400, height: 400 };
        responseCode = 201;
      } else if (
        route.startsWith("/upload/feed-image/") &&
        request.method === "DELETE"
      ) {
        removedPhotos++;
      } else if (/\/feed\/[^/]+\/images\//.test(route)) {
        contentType = "image/png";
        rawBody = logo.toString("base64");
      } else if (route === "/feed" && request.method === "POST") {
        postRequests++;
        if (failPost) {
          failPost = false;
          responseCode = 503;
          message = "Fixture publish failed. Please retry.";
        } else {
          await new Promise((resolve) => setTimeout(resolve, 100));
          data = {
            ...body,
            _id: "ffffffffffffffffffffffff",
            author: user,
            isMine: true,
            createdAt: new Date().toISOString(),
            images: (body.images || []).map((image) => ({
              ...image,
              url: "/api/feed/ffffffffffffffffffffffff/images/" + image.id,
              width: 400,
              height: 400,
            })),
          };
          stories.unshift(data);
          responseCode = 201;
        }
      } else if (route.startsWith("/feed/") && request.method === "DELETE") {
        stories = stories.filter(
          (story) => story._id !== route.split("/").pop(),
        );
      } else if (route.startsWith("/feed/")) {
        const story = stories.find(
          (story) => story._id === route.split("/").pop(),
        );
        if (!story || !allowed(story)) {
          responseCode = 404;
          message = "Post not found or no longer available to you";
        } else data = serialize(story);
      }
    }
    await send("Fetch.fulfillRequest", {
      requestId,
      responseCode,
      responseHeaders: [
        { name: "Content-Type", value: contentType },
        { name: "Access-Control-Allow-Origin", value: "http://localhost:5173" },
        { name: "Access-Control-Allow-Credentials", value: "true" },
        {
          name: "Access-Control-Allow-Methods",
          value: "GET,POST,PUT,DELETE,OPTIONS",
        },
        { name: "Access-Control-Allow-Headers", value: "Content-Type" },
      ],
      body:
        rawBody ||
        Buffer.from(
          JSON.stringify({ success: responseCode < 400, data, message }),
        ).toString("base64"),
    });
  } catch (error) {
    runtimeErrorsFromFixture.push(error.message);
    await send("Fetch.failRequest", { requestId, errorReason: "Failed" });
  }
});
const click = (label, scope = "document") =>
  evaluate(
    `Array.from(${scope}.querySelectorAll('button')).find(button=>button.textContent.trim()===${JSON.stringify(label)}).click()`,
  );
const fill = (label, value) =>
  evaluate(
    `(()=>{const input=document.querySelector('[aria-label='+${JSON.stringify(JSON.stringify(label))}+']');const prototype=input.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
const navigate = async (path) => {
  await evaluate("window.oldStoriesDocument=true");
  await send("Page.navigate", { url: "http://localhost:5173" + path });
  await until(
    `!window.oldStoriesDocument&&document.querySelectorAll('[data-success-story]').length>0`,
  );
};
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
    name + " page overflow",
  );
  assert.equal(
    await evaluate(
      `(()=>{const dialog=document.querySelector('dialog');return !dialog||dialog.scrollWidth<=dialog.clientWidth+1;})()`,
    ),
    true,
    name + " dialog overflow",
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
  await send("Page.navigate", { url: "http://localhost:5173/alumni/success" });
  await until(`document.querySelectorAll('[data-success-story]').length===12`);
  await photo("alumni-stories-desktop", 1440, false);
  await photo("alumni-stories-mobile-dark", 390, true);
  await click("Load more stories");
  await until(`document.querySelectorAll('[data-success-story]').length===15`);
  await click(
    "Advice",
    `document.querySelector('nav[aria-label="Story topics"]')`,
  );
  await until(`document.querySelectorAll('[data-success-story]').length===4`);
  await fill("Search success stories", "no-match");
  await evaluate(
    `document.querySelector('[aria-label="Story filters"] form').requestSubmit()`,
  );
  await until(`document.body.textContent.includes('No stories found')`);
  await click("Browse all stories");
  await until(`document.querySelectorAll('[data-success-story]').length===12`);
  await click("Share your story");
  await until(`document.querySelector('[aria-label="Story title"]')`);
  await fill("Story title", "Building a career through community projects");
  await click("Publish story", 'document.querySelector("dialog")');
  await until(
    `document.querySelector('dialog [role="alert"]')?.textContent.includes('career journey')`,
  );
  await fill(
    "Career journey",
    "I began by building projects for campus organizations and took my first developer role after graduation.",
  );
  await fill(
    "Professional achievements",
    "Led a team that delivered a community information platform.",
  );
  await fill(
    "Advice for students",
    "Build projects that matter, ask for feedback, and practice explaining your work.",
  );
  await evaluate(
    `(()=>{const input=document.querySelector('[aria-label="Add story cover photo"]');const transfer=new DataTransfer();transfer.items.add(new File([Uint8Array.from(atob('${logo.toString("base64")}'),char=>char.charCodeAt(0))],'story-cover.png',{type:'image/png'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
  await until(
    `document.querySelector('[aria-label="Story photo description"]')`,
  );
  await fill(
    "Story photo description",
    "A photo representing my campus journey",
  );
  await photo("story-composer-mobile", 390, false);
  await click("Publish story", 'document.querySelector("dialog")');
  await until(
    `document.querySelector('dialog [role="alert"]')?.textContent.includes('Fixture publish failed')`,
  );
  assert.equal(
    await evaluate(
      `document.querySelector('[aria-label="Career journey"]').value`,
    ),
    "I began by building projects for campus organizations and took my first developer role after graduation.",
  );
  await evaluate(
    `(()=>{const button=document.querySelector('dialog button[type=submit]');button.click();button.click();})()`,
  );
  await until(
    `!document.querySelector('dialog')&&document.body.textContent.includes('Your story is published')&&document.querySelector('[data-success-story=\"ffffffffffffffffffffffff\"]')`,
  );
  assert.equal(postRequests, 2);
  const published = stories.find(
    (story) => story._id === "ffffffffffffffffffffffff",
  );
  assert.ok(published.details.story.achievements);
  assert.ok(published.details.story.advice);
  assert.equal(published.audience, "public");
  await click(
    "Read story",
    `document.querySelector('[data-success-story="ffffffffffffffffffffffff"]')`,
  );
  await until(
    `document.querySelector('dialog')?.textContent.includes('Led a team')`,
  );
  await photo("story-reader-desktop-dark", 1440, true);
  await photo("story-reader-small-mobile", 320, false);
  assert.equal(
    await evaluate(`new URLSearchParams(location.search).get('story')`),
    published._id,
  );
  await click("Close story", 'document.querySelector("dialog")');
  await click("My stories");
  await until(
    `document.querySelectorAll('[data-success-story]').length>0&&Array.from(document.querySelectorAll('[data-success-story]')).every(card=>card.textContent.includes('Jamie Reyes'))`,
  );
  user = student;
  await navigate("/student/success");
  assert.equal(
    await evaluate(
      `Array.from(document.querySelectorAll('button')).some(button=>button.textContent.trim()==='Share your story')`,
    ),
    false,
  );
  assert.equal(
    await evaluate(
      `document.querySelector('[data-success-story="dddddddddddddddddddddddd"]')!==null`,
    ),
    false,
  );
  await photo("student-stories-desktop", 1440, false);
  await photo("student-stories-mobile-dark", 390, true);
  await click(
    "Read story",
    `document.querySelector('[data-success-story="ffffffffffffffffffffffff"]')`,
  );
  await until(
    `document.querySelector('dialog')?.textContent.includes('Build projects that matter')`,
  );
  assert.equal(
    await evaluate(
      `Array.from(document.querySelectorAll('dialog button')).some(button=>button.textContent.trim()==='Delete story')`,
    ),
    false,
  );
  await click("Close story", 'document.querySelector("dialog")');
  await navigate("/stories?story=dddddddddddddddddddddddd");
  await until(
    `document.querySelector('dialog [role="alert"]')?.textContent.includes('no longer available')`,
  );
  assert.equal(
    await evaluate(
      `document.querySelector('dialog').textContent.includes('A private reflection')`,
    ),
    false,
  );
  await evaluate(
    `document.querySelector('[aria-label="Close dialog"]').click()`,
  );
  failList = true;
  await evaluate(
    `document.querySelector('[aria-label="Refresh stories"]').click()`,
  );
  await until(
    `document.querySelector('[role="alert"]')?.textContent.includes('Fixture story list failed')`,
  );
  await click("Retry");
  await until(
    `!document.querySelector('[role="alert"]')&&document.querySelectorAll('[data-success-story]').length>0`,
  );
  user = alumni;
  await navigate("/alumni/success?story=ffffffffffffffffffffffff");
  await until(
    `document.querySelector('dialog')?.textContent.includes('Delete story')`,
  );
  await click("Delete story", 'document.querySelector("dialog")');
  await click("Confirm delete", 'document.querySelector("dialog")');
  await until(
    `!document.querySelector('dialog')&&document.body.textContent.includes('Story deleted.')`,
  );
  restricted = true;
  await evaluate(
    `document.querySelector('[aria-label="Refresh stories"]').click()`,
  );
  await until(
    `document.body.textContent.includes('Your feed participation is restricted')`,
  );
  assert.equal(
    await evaluate(
      `Array.from(document.querySelectorAll('button')).find(button=>button.textContent.trim()==='Share your story').disabled`,
    ),
    true,
  );
  assert.deepEqual(runtimeErrorsFromFixture, []);
  assert.deepEqual(runtimeErrors, []);
  console.log(
    "Passed: story gallery, topic and keyword filters, pagination, structured publishing, optional photo, failure/retry, duplicate-submit guard, student read-only access, private-story denial, deep links, author deletion, restriction handling, and mobile/desktop layouts. API fixtures only. Screenshots: " +
      artifacts,
  );
} finally {
  await send("Browser.close").catch(() => {});
  socket.close();
}
