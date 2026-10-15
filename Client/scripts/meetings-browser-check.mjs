import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Requires isolated meetings-preview-server.mjs, Vite on 5174 with fixture URLs,
// and headless Edge on 9236 with fake media devices. No live student records.
const artifacts = path.join(os.tmpdir(), "SielAlumni-meetings-check");
await mkdir(artifacts, { recursive: true });
const browser = await (
  await fetch("http://localhost:9236/json/version")
).json();
const wire = new WebSocket(browser.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  wire.onopen = resolve;
  wire.onerror = reject;
});
let sequence = 0;
const pending = new Map(),
  errors = [];
const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const id = ++sequence,
      timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Timeout: ${method}`));
      }, 25000);
    pending.set(id, { resolve, reject, timer });
    wire.send(JSON.stringify({ id, method, params, sessionId }));
  });
wire.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const request = pending.get(message.id);
    if (!request) return;
    clearTimeout(request.timer);
    pending.delete(message.id);
    message.error
      ? request.reject(new Error(message.error.message))
      : request.resolve(message.result);
  } else if (message.method === "Runtime.exceptionThrown")
    errors.push(
      message.params.exceptionDetails.exception?.description ||
        message.params.exceptionDetails.text,
    );
};
const evaluate = async (session, expression) => {
  const result = await send(
    "Runtime.evaluate",
    { expression, returnByValue: true, awaitPromise: true },
    session,
  );
  if (result.exceptionDetails)
    throw new Error(
      result.exceptionDetails.exception?.description ||
        result.exceptionDetails.text,
    );
  return result.result.value;
};
const until = async (session, expression) => {
  const started = Date.now();
  while (Date.now() - started < 22000) {
    if (await evaluate(session, `Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  const diagnostic = await evaluate(
    session,
    `({videos:Array.from(document.querySelectorAll('video')).map(video=>({peer:video.parentElement.getAttribute('data-meeting-peer'),width:video.videoWidth,paused:video.paused,muted:video.muted,ready:video.readyState,tracks:video.srcObject?.getTracks().map(track=>({kind:track.kind,enabled:track.enabled,ready:track.readyState,muted:track.muted}))})),peers:window.__meetingPcs?.map(pc=>({state:pc.connectionState,ice:pc.iceConnectionState,signaling:pc.signalingState}))})`,
  );
  const shot = await send("Page.captureScreenshot", { format: "png" }, session);
  await writeFile(
    path.join(artifacts, "failure.png"),
    Buffer.from(shot.data, "base64"),
  );
  throw new Error(
    `UI wait failed: ${expression}\n${JSON.stringify(diagnostic)}\n${await evaluate(session, "document.body.innerText")}`,
  );
};
const open = async (user) => {
  const { browserContextId } = await send("Target.createBrowserContext");
  await send("Browser.grantPermissions", {
    browserContextId,
    origin: "http://localhost:5174",
    permissions: ["audioCapture", "videoCapture"],
  });
  const { targetId } = await send("Target.createTarget", {
    url: "about:blank",
    browserContextId,
  });
  const { sessionId } = await send("Target.attachToTarget", {
    targetId,
    flatten: true,
  });
  await send("Page.enable", {}, sessionId);
  await send("Runtime.enable", {}, sessionId);
  await send("Network.enable", {}, sessionId);
  await send(
    "Network.setCookie",
    {
      name: "meeting_fixture_user",
      value: user,
      domain: "localhost",
      path: "/",
      sameSite: "Lax",
    },
    sessionId,
  );
  await send(
    "Page.addScriptToEvaluateOnNewDocument",
    {
      source:
        "window.__meetingPcs=[];const NativePeer=window.RTCPeerConnection;window.RTCPeerConnection=class extends NativePeer{constructor(...args){super(...args);window.__meetingPcs.push(this);}};",
    },
    sessionId,
  );
  return sessionId;
};
const navigate = (session, route) =>
  send("Page.navigate", { url: "http://localhost:5174" + route }, session);
const click = (session, label) =>
  evaluate(
    session,
    `Array.from(document.querySelectorAll('button')).find(button=>button.textContent.trim()===${JSON.stringify(label)}||button.getAttribute('aria-label')===${JSON.stringify(label)}).click()`,
  );
const photo = async (session, name, width) => {
  await send(
    "Emulation.setDeviceMetricsOverride",
    { width, height: 1000, deviceScaleFactor: 1, mobile: width < 768 },
    session,
  );
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(
    await evaluate(
      session,
      `document.documentElement.scrollWidth <= ${width + 1}`,
    ),
    true,
    "Horizontal overflow: " + name,
  );
  const image = await send(
    "Page.captureScreenshot",
    { format: "png" },
    session,
  );
  await writeFile(
    path.join(artifacts, name + ".png"),
    Buffer.from(image.data, "base64"),
  );
};
const eventId = "eeeeeeeeeeeeeeeeeeeeeeee";
try {
  const host = await open("host"),
    student = await open("student");
  await navigate(host, "/admin/events");
  await until(host, `document.body.innerText.includes('Create event')`);
  await click(host, "Create event");
  await until(host, `document.querySelector('#ev-registration-limited')`);
  await evaluate(
    host,
    `document.querySelector('#ev-registration-limited').click()`,
  );
  assert.equal(
    await evaluate(
      host,
      `document.querySelector('#ev-registration-close').required`,
    ),
    true,
  );
  await photo(host, "admin-registration-settings", 1440);
  await navigate(host, `/meetings/${eventId}`);
  await until(host, `document.body.innerText.includes('Ready to join?')`);
  await navigate(student, "/student/events");
  await until(
    student,
    `document.body.innerText.includes('Web Accessibility Workshop')`,
  );
  await photo(student, "student-events-desktop", 1440);
  assert.equal(
    await evaluate(
      student,
      `Array.from(document.querySelectorAll('a')).some(link=>link.textContent.trim()==='View meeting')`,
    ),
    false,
    "No meeting link before registration",
  );
  assert.equal(
    await evaluate(
      student,
      `(async()=>{const response=await fetch('http://localhost:3003/api/meetings/${eventId}',{credentials:'include'});return response.status;})()`,
    ),
    403,
    "Direct meeting metadata is protected",
  );
  assert.equal(
    await evaluate(
      student,
      `Array.from(document.querySelectorAll('button')).find(button=>button.textContent.trim()==='Registration closed').disabled`,
    ),
    true,
  );
  assert.equal(
    await evaluate(
      student,
      `Array.from(document.querySelectorAll('button')).find(button=>button.textContent.trim()==='Registration not open').disabled`,
    ),
    true,
  );
  await click(student, "Register");
  await until(
    student,
    `Array.from(document.querySelectorAll('a')).some(link=>link.textContent.trim()==='View meeting')`,
  );
  await evaluate(
    student,
    `Array.from(document.querySelectorAll('a')).find(link=>link.textContent.trim()==='View meeting').click()`,
  );
  await until(
    student,
    `document.body.innerText.includes('Waiting for the host')`,
  );
  await photo(student, "prejoin-mobile", 390);
  await click(host, "Enable camera");
  await until(host, `document.querySelector('video')?.videoWidth>0`);
  await click(host, "Enable microphone");
  await click(host, "Start & join meeting");
  await until(host, `document.body.innerText.includes('Live · 1/8')`);
  await until(
    student,
    `Array.from(document.querySelectorAll('button')).some(button=>button.textContent.trim()==='Join meeting')`,
  );
  await click(student, "Enable camera");
  await until(student, `document.querySelector('video')?.videoWidth>0`);
  await click(student, "Enable microphone");
  await click(student, "Join meeting");
  await until(student, `document.body.innerText.includes('Live · 2/8')`);
  await until(host, `document.body.innerText.includes('Live · 2/8')`);
  for (const session of [host, student]) {
    await until(
      session,
      `(()=>{Array.from(document.querySelectorAll('button')).filter(button=>button.textContent.trim()==='Enable playback').forEach(button=>button.click());return document.querySelectorAll('video').length===2&&Array.from(document.querySelectorAll('video')).every(video=>video.videoWidth>0);})()`,
    );
    const stats = await evaluate(
      session,
      `(async()=>{const report=await window.__meetingPcs[0].getStats();return [...report.values()].filter(item=>item.type==='inbound-rtp'||item.type==='outbound-rtp').map(item=>({type:item.type,kind:item.kind,packetsReceived:item.packetsReceived||0,packetsSent:item.packetsSent||0,framesDecoded:item.framesDecoded||0}));})()`,
    );
    assert.ok(
      stats.some(
        (item) =>
          item.kind === "video" &&
          item.type === "inbound-rtp" &&
          item.framesDecoded > 0,
      ),
      "Actual remote video frames",
    );
    assert.ok(
      stats.some(
        (item) =>
          item.kind === "audio" &&
          item.type === "inbound-rtp" &&
          item.packetsReceived > 0,
      ),
      "Actual remote audio packets",
    );
  }
  await photo(host, "meeting-desktop", 1440);
  await photo(student, "meeting-mobile", 390);
  await click(student, "Raise hand");
  await until(host, `document.querySelector('li svg.text-amber-400')`);
  await click(student, "Mute microphone");
  await until(
    host,
    `document.querySelectorAll('li svg.text-zinc-500').length>0`,
  );
  await click(student, "Chat");
  await evaluate(
    student,
    `(()=>{const input=document.querySelector('input[placeholder="Message everyone"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Hello from the student room');input.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
  await click(student, "Send message");
  await click(host, "Chat");
  await until(
    host,
    `document.body.innerText.includes('Hello from the student room')`,
  );
  const third = await open("stranger");
  await navigate(third, "/student/events");
  await until(
    third,
    `document.body.innerText.includes('Web Accessibility Workshop')`,
  );
  await click(third, "Register");
  await until(
    third,
    `Array.from(document.querySelectorAll('a')).some(link=>link.textContent.trim()==='View meeting')`,
  );
  await evaluate(
    third,
    `Array.from(document.querySelectorAll('a')).find(link=>link.textContent.trim()==='View meeting').click()`,
  );
  await until(
    third,
    `Array.from(document.querySelectorAll('button')).some(button=>button.textContent.trim()==='Join meeting')`,
  );
  await click(third, "Enable camera");
  await until(third, `document.querySelector('video')?.videoWidth>0`);
  await click(third, "Join meeting");
  for (const session of [host, student, third])
    await until(
      session,
      `(()=>{Array.from(document.querySelectorAll('button')).filter(button=>button.textContent.trim()==='Enable playback').forEach(button=>button.click());return document.querySelectorAll('video').length===3&&Array.from(document.querySelectorAll('video')).every(video=>video.videoWidth>0);})()`,
    );
  await photo(host, "three-party-meeting", 1440);
  await click(host, "Share screen");
  await until(host, `document.body.innerText.includes('Stop sharing')`);
  await until(
    student,
    `document.querySelector('[data-meeting-peer].border-emerald-500')`,
  );
  await photo(host, "screen-sharing", 1440);
  await click(host, "Stop sharing");
  await until(host, `!document.body.innerText.includes('Stop sharing')`);
  await click(host, "End meeting");
  await until(host, `document.querySelector('dialog')`);
  await click(host, "End for everyone");
  await until(
    student,
    `document.body.innerText.includes('The host ended this meeting')`,
  );
  await until(
    host,
    `document.body.innerText.includes('This session has ended')`,
  );
  assert.equal(
    await evaluate(
      student,
      `Array.from(document.querySelectorAll('video')).every(video=>!video.srcObject||video.srcObject.getTracks().every(track=>track.readyState==='ended'))`,
    ),
    true,
    "Devices released",
  );
  await click(host, "Attendance");
  await until(
    host,
    `document.body.innerText.includes('recorded')&&Array.from(document.querySelectorAll('button')).some(button=>button.textContent.trim()==='Confirm & issue certificate'&&!button.disabled)`,
  );
  await photo(host, "host-attendance", 1440);
  await click(host, "Confirm & issue certificate");
  await until(host, `document.querySelector('dialog img')?.naturalWidth>0`);
  await navigate(student, "/student/certificate");
  await until(student, `document.querySelector('article[data-certificate]')`);
  assert.ok(
    await evaluate(
      student,
      `document.body.innerText.includes('Web Accessibility Workshop')`,
    ),
  );
  // Registration alone does not unlock a room whose start is more than 15 minutes away.
  await navigate(student, "/student/events");
  await until(
    student,
    `document.body.innerText.includes('Scheduled Meeting Seminar')`,
  );
  const futureCard = `Array.from(document.querySelectorAll('article')).find(card=>card.textContent.includes('Scheduled Meeting Seminar'))`;
  await evaluate(student, `${futureCard}.querySelector('button').click()`);
  await until(
    student,
    `${futureCard}.textContent.includes('Meeting not available yet')`,
  );
  assert.equal(
    await evaluate(student, `${futureCard}.querySelector('button').disabled`),
    true,
  );
  assert.equal(
    await evaluate(student, `${futureCard}.querySelector('a')===null`),
    true,
  );
  assert.equal(
    await evaluate(
      student,
      `(async()=>{const response=await fetch('http://localhost:3003/api/meetings/222222222222222222222222',{credentials:'include'});return response.status;})()`,
    ),
    403,
  );
  await photo(student, "scheduled-meeting-locked", 390);
  await navigate(student, "/meetings/222222222222222222222222");
  await until(
    student,
    `document.body.innerText.includes('15 minutes before the scheduled start')`,
  );
  assert.equal(
    await evaluate(student, `document.querySelector('video')===null`),
    true,
    "Early direct URL cannot open the room preview",
  );
  // On-site activity uses the same registration requirement and an admin check-in.
  await navigate(student, "/student/events");
  await until(
    student,
    `document.body.innerText.includes('On-site Leadership Seminar')`,
  );
  const onsiteCard = `Array.from(document.querySelectorAll('article')).find(card=>card.textContent.includes('On-site Leadership Seminar'))`;
  assert.equal(
    await evaluate(
      student,
      `${onsiteCard}.textContent.includes('CLSU Auditorium')`,
    ),
    false,
    "Venue remains locked until registration",
  );
  await evaluate(student, `${onsiteCard}.querySelector('button').click()`);
  await until(
    student,
    `${onsiteCard}.textContent.includes('View registration')`,
  );
  await click(student, "View registration");
  await until(
    student,
    `document.querySelector('dialog')?.textContent.includes('CLSU Auditorium')`,
  );
  await photo(student, "onsite-registration-mobile", 390);
  await navigate(host, "/admin/events/dddddddddddddddddddddddd/attendance");
  await until(host, `document.querySelector('[data-participant]')`);
  assert.equal(
    await evaluate(
      host,
      `Array.from(document.querySelectorAll('button')).find(button=>button.textContent.trim()==='Confirm & issue certificate').disabled`,
    ),
    true,
  );
  await click(host, "Check in");
  await until(host, `document.body.innerText.includes('Checked in ')`);
  await photo(host, "onsite-attendance", 1440);
  await fetch("http://localhost:3003/__test/advance", { method: "POST" });
  await navigate(student, "/student/events");
  await until(
    student,
    `${futureCard}?.querySelector('a')?.textContent.includes('View meeting')`,
  );
  await navigate(host, "/admin/events/dddddddddddddddddddddddd/attendance");
  await until(
    host,
    `Array.from(document.querySelectorAll('button')).some(button=>button.textContent.trim()==='Confirm & issue certificate'&&!button.disabled)`,
  );
  await click(host, "Confirm & issue certificate");
  await until(host, `document.querySelector('dialog img')?.naturalWidth>0`);
  await navigate(student, "/student/certificate");
  await until(
    student,
    `document.querySelectorAll('article[data-certificate]').length===2`,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Passed: registration and deadlines; scheduled meeting access blocks early links, previews and direct requests, then unlocks near start; two/three-party video, audio, sharing and chat; on-site check-in and certificates. Synthetic media, in-memory fixtures only. Artifacts: " +
      artifacts,
  );
} finally {
  await send("Browser.close").catch(() => {});
  wire.close();
}
