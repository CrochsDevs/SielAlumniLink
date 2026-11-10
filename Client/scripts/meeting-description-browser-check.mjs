// Run with isolated Edge/Chrome on port 9235. API fixtures never change real student records.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// Uses a separate headless browser and API fixtures. No real alumni responses
// are read or written. Start Edge/Chrome with remote debugging on port 9235.
const artifacts = path.join(os.tmpdir(), "SielAlumni-meeting-description-check");
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
  } else {
    const pending = listeners.get(message.method)?.(message.params);
    pending?.catch(error => {
      // Closing/replacing a preview aborts its request, invalidating the mock
      // interception before the fixture response can be delivered.
      if (error.message !== 'Invalid InterceptionId.') runtimeErrors.push(error.message);
    });
  }
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
  throw new Error(`UI wait failed: ${expression}\n${await evaluate('document.body.innerText')}\n${runtimeErrors.join('\n')}`);
};

const origin = process.env.MEETING_TEST_ORIGIN || "http://localhost:5180";
let role = "admin";
let endedFixture = false;
let adminEndedFixture = false;
let endedRequests = 0;
const roster = [
  { authId: '1', name: 'Alex Santos', attendedSeconds: 30 },
  { authId: '2', name: 'Jamie Cruz', attendedSeconds: 0 },
  { authId: '3', name: 'Leanne Castro', attendedSeconds: 90, certificateId: 'issued-certificate' },
];
const account = () => ({ _id: "a".repeat(24), authId: "a".repeat(24), role, name: "Preview Tester", email: "preview@example.test", passwordSetupRequired: false });
const event = { _id: "b".repeat(24), title: "Rich text meeting preview", descriptionFormat: "html", description: '<h2>Agenda heading</h2><p><strong>Welcome</strong><br><em>Bring your ID</em> &amp; notes</p><ul><li><p>First topic</p></li></ul><p><a href="https://example.com">More details</a></p><script>window.__unsafe = true</script>', startAt: "2026-11-09T02:00:00Z", organizer: "CLSU", activityType: "seminar", deliveryMode: "online" };
const headers = [{ name: "Content-Type", value: "application/json" }, { name: "Access-Control-Allow-Origin", value: origin }, { name: "Access-Control-Allow-Credentials", value: "true" }, { name: "Access-Control-Allow-Headers", value: "Content-Type, X-Account-Id" }, { name: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" }];
event.description += '<p>Long activity description to verify scrolling stays inside the meeting description.</p>'.repeat(80);
listeners.set("Fetch.requestPaused", async ({ requestId, request }) => {
  const route = new URL(request.url).pathname.replace("/api", "");
  if (route === `/meetings/${event._id}` && request.method === 'GET' && endedFixture) {
    endedRequests++;
    await send('Fetch.fulfillRequest', { requestId, responseCode: 410, responseHeaders: headers, body: Buffer.from(JSON.stringify({ success: false, message: 'This meeting has ended. View your participation records and certificates from your portfolio.' })).toString('base64') });
    return;
  }
  let data = [];
  if (["/auth/me", "/users/me"].includes(route)) data = account();
  else if (route === "/tracer/access") data = { updateRequired: false, quarter: "2026-Q4", nextUpdateAt: "2099-01-01T00:00:00Z" };
  else if (route === `/meetings/${event._id}`) data = { event, meeting: adminEndedFixture ? { state: 'ended' } : null, capacity: 8, registration: { authId: account().authId }, access: { state: "open" } };
  else if (route === `/meetings/${event._id}/participants`) data = roster;
  await send("Fetch.fulfillRequest", { requestId, responseCode: 200, responseHeaders: headers, body: Buffer.from(JSON.stringify({ success: true, data })).toString("base64") });
});
try {
  await send("Page.enable"); await send("Runtime.enable");
  await send("Fetch.enable", { patterns: [{ urlPattern: "http://localhost:3002/api/*" }] });
  for (const audience of ["admin", "alumni", "student"]) {
    role = audience;
    await send("Page.navigate", { url: `${origin}/meetings/${event._id}` });
    await until(`document.querySelector('.meeting-description strong')`);
    const rendered = await evaluate(`(() => {
      const description = document.querySelector('.meeting-description');
      return { background: getComputedStyle(document.querySelector('.meeting-room')).backgroundColor,
        text: description.textContent, list: description.querySelectorAll('li').length,
        link: description.querySelector('a').href, heading: getComputedStyle(description.querySelector('h2')).fontSize,
        body: getComputedStyle(description).fontSize, unsafe: !!window.__unsafe,
        script: !!description.querySelector('script') };
    })()`);
    assert.equal(rendered.background, "rgb(23, 25, 29)", `${audience} meeting keeps dark background`);
    assert.ok(rendered.text.includes("Bring your ID & notes"));
    assert.equal(rendered.text.includes("<p>"), false);
    assert.equal(rendered.list, 1); assert.equal(rendered.link, "https://example.com/");
    assert.ok(parseFloat(rendered.heading) > parseFloat(rendered.body));
    assert.equal(rendered.unsafe, false); assert.equal(rendered.script, false);
    for (const [width, height] of [[1440, 900], [1366, 768], [390, 844], [844, 390]]) {
      await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 768 });
      await new Promise(resolve => setTimeout(resolve, 150));
      assert.equal(await evaluate(`document.documentElement.scrollWidth <= ${width + 1}`), true);
      assert.equal(await evaluate(`document.documentElement.scrollHeight <= ${height + 1}`), true, `Meeting fits ${audience} ${width}x${height}`);
      assert.equal(await evaluate(`(() => { const button = document.querySelector('.meeting-join-card > div:last-child > button'); const box = button.getBoundingClientRect(); return box.top >= 0 && box.bottom <= innerHeight; })()`), true, `Join control visible ${width}x${height}`);
      const shot = await send("Page.captureScreenshot", { format: "png" });
      await writeFile(path.join(artifacts, `${audience}-${width}.png`), Buffer.from(shot.data, "base64"));
    }
  }
  // Exercise joined layout states without opening a real meeting or capturing media.
  await evaluate(`(() => {
    const room = document.querySelector('.meeting-room');
    room.classList.remove('is-preview'); room.classList.add('is-joined', 'has-panel');
    window.__tile = document.querySelector('[data-meeting-peer]').outerHTML;
    const toolbar = document.createElement('footer'); toolbar.className = 'meeting-toolbar';
    toolbar.innerHTML = ['Microphone', 'Camera', 'Stop sharing', 'Raise hand', 'People', 'Chat', 'End meeting'].map(label => '<button>' + label + '</button>').join('');
    room.append(toolbar);
  })()`);
  for (const [width, height] of [[1920, 1080], [1366, 768], [390, 844], [844, 390]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
    for (const mode of ['share-only', 'share-peers', 'gallery']) {
      await evaluate(`(() => {
        const stage = document.querySelector('.meeting-stage');
        stage.classList.toggle('has-share', ${mode !== 'gallery'});
        const gallery = '<div class="meeting-gallery grid gap-3 sm:grid-cols-2 xl:grid-cols-3">' + window.__tile.repeat(${mode === 'gallery' ? 8 : 3}) + '</div>';
        stage.innerHTML = ${mode !== 'gallery'} ? window.__tile + (${mode === 'share-peers'} ? gallery : '') : gallery;
        stage.innerHTML += '<p>Attendance is recorded while connected.</p>';
      })()`);
      await new Promise(resolve => setTimeout(resolve, 100));
      assert.equal(await evaluate(`document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1`), true, `${mode} fits viewport`);
      assert.equal(await evaluate(`(() => {
        const stage = document.querySelector('.meeting-stage').getBoundingClientRect();
        const toolbar = document.querySelector('.meeting-toolbar').getBoundingClientRect();
        const gallery = document.querySelector('.meeting-gallery');
        const share = document.querySelector('.meeting-stage.has-share > [data-meeting-peer]');
        return stage.bottom <= toolbar.top + 1 && (share ? share.getBoundingClientRect().bottom <= stage.bottom + 1 : true) && (gallery ? gallery.getBoundingClientRect().bottom <= stage.bottom + 1 : true);
      })()`), true, `${mode} tiles fit above controls ${width}x${height}`);
      if (mode === 'share-only') assert.equal(await evaluate(`(() => { const stage = document.querySelector('.meeting-stage'); return stage.querySelector('[data-meeting-peer]').getBoundingClientRect().height > stage.clientHeight - 60; })()`), true, 'Solo share fills available height');
      if (mode === 'share-peers') assert.equal(await evaluate(`(() => { const stage = document.querySelector('.meeting-stage'); const share = stage.querySelector(':scope > [data-meeting-peer]').getBoundingClientRect(); const gallery = stage.querySelector('.meeting-gallery').getBoundingClientRect(); return gallery.left >= share.right && Math.abs(gallery.top - share.top) <= 1 && gallery.height >= share.height - 1; })()`), true, 'Participants stay on the right of the shared screen');
    }
  }
  role = 'admin'; adminEndedFixture = true;
  await send('Page.navigate', { url: `${origin}/meetings/${event._id}` });
  await until(`document.querySelector('.meeting-room.is-ended .meeting-attendance-list')`);
  assert.equal(await evaluate(`!!document.querySelector('.meeting-room.is-ended .meeting-stage [data-meeting-peer]')`), true, 'Ended session keeps the video preview');
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('.meeting-join-card button')).some(button => button.textContent.includes('microphone'))`), true, 'Ended session keeps media controls');
  assert.equal(await evaluate(`document.querySelectorAll('.meeting-attendance-record').length`), 3);
  assert.equal(await evaluate(`document.querySelectorAll('.meeting-attendance-record button:enabled').length`), 1);
  assert.equal(await evaluate(`document.querySelectorAll('.meeting-attendance-record button:disabled').length`), 1);
  assert.equal(await evaluate(`document.querySelector('.meeting-session-summary').textContent.includes('Attended2')`), true);
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.equal(await evaluate(`document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1`), true, 'Ended workspace fits viewport');
    if (width > 768) assert.equal(await evaluate(`document.querySelector('.meeting-side-panel').getBoundingClientRect().left > document.querySelector('.meeting-stage').getBoundingClientRect().right`), true, 'Attendance stays on the right');
    await evaluate(`Array.from(document.querySelectorAll('nav[aria-label="Meeting panels"] button')).find(button => button.textContent.startsWith('Participants')).click()`);
    await until(`document.querySelectorAll('.meeting-side-panel > ul > li').length === 3`);
    assert.equal(await evaluate(`document.querySelector('.meeting-side-panel').textContent.includes('Participants appear here after you join')`), false);
    await evaluate(`Array.from(document.querySelectorAll('nav[aria-label="Meeting panels"] button')).find(button => button.textContent.startsWith('Attendance')).click()`);
    await until(`document.querySelectorAll('.meeting-attendance-record').length === 3`);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(path.join(artifacts, `ended-attendance-${width}.png`), Buffer.from(shot.data, 'base64'));
  }
  role = 'student'; adminEndedFixture = false; endedFixture = true;
  await send('Page.navigate', { url: `${origin}/meetings/${event._id}` });
  await until(`document.querySelector('.meeting-unavailable h2')?.textContent === 'Meeting closed'`);
  await new Promise(resolve => setTimeout(resolve, 9000));
  assert.equal(endedRequests, 1, 'Ended meetings are not polled again after 410');
  assert.equal(await evaluate(`!!document.querySelector('.meeting-unavailable a[href="/activities"]')`), true);
  assert.equal(await evaluate(`!document.querySelector('.meeting-join-card')`), true);
  role = 'alumni';
  await send('Page.navigate', { url: `${origin}/meetings/${event._id}` });
  await until(`document.querySelector('.meeting-unavailable a[href="/alumni"]')?.textContent === 'Close'`);
  assert.equal(await evaluate(`!document.querySelector('a[href="/alumni/portfolio"]')`), true, 'Alumni return to their dashboard, not a nonexistent portfolio');
  console.log(`Passed: formatted descriptions, viewport fit, participant sidebar and joined layout fixtures; closed meeting provides role-specific Close navigation and stops polling after one 410 response. Mock APIs only. Artifacts: ${artifacts}`);
} finally {
  await send("Browser.close").catch(() => {});
  socket.close();
}

