import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { changeInterview, interviewView } from "../../Server/modules/mentorship/interview.policy.js";
import { goalSnapshot } from "../../Server/modules/mentorship/mentorship.policy.js";

// Uses a separate headless browser and API fixtures. No real alumni responses
// are read or written. Start Edge/Chrome with remote debugging on port 9233.
const artifacts = path.join(
  os.tmpdir(),
  "SielAlumni-interview-check",
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
  throw new Error(`UI wait failed: ${expression}\n${await evaluate("document.body.innerText")}\n${runtimeErrors.join("; ")}`);
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
let user = student;
let record = null;
let failNext = false;
const tracker = () => {
  const result = goalSnapshot(record ? [record] : []);
  result.goals[1].interview = interviewView(record, user.role === 'student');
  return { connectionId: connections[0]._id, student, mentor, ...result };
};
listeners.set('Runtime.exceptionThrown', ({ exceptionDetails }) => runtimeErrors.push(exceptionDetails.exception?.description || exceptionDetails.text));
listeners.set('Fetch.requestPaused', async ({ requestId, request }) => {
  let data = [], responseCode = 200, message = '';
  try {
    const route = new URL(request.url).pathname.replace('/api', '');
    if (request.method !== 'OPTIONS') {
      if (route === '/auth/me' || route === '/users/me') data = user;
      else if (route === '/tracer/access') data = { updateRequired: false, quarter: 'test', nextUpdateAt: new Date(Date.now() + 86400000).toISOString() };
      else if (route === '/connections/me') data = [connections[0]];
      else if (route === '/development/mentees') data = [student];
      else if (route === '/notifications/unread-count') data = { count: 0 };
      else if (route === '/mentorship/me') data = [tracker()];
      else if (route === '/mentorship/matches') data = { preferences: { interests: [], careerGoals: '' }, matches: [], profile: { skills: [] }, candidateCount: 1 };
      else if (route.endsWith('/interview') && request.method === 'PUT') {
        if (failNext) { failNext = false; throw Object.assign(new Error('Temporary save failure. Try again.'), { status: 503 }); }
        const input = JSON.parse(request.postData);
        record = { ...record, ...changeInterview(record, input, user.role === 'student', user.authId), goalKey: 'interview_preparation', revision: (record?.revision || 0) + 1, updatedByRole: user.role };
        data = tracker();
      } else if (route === `/mentorship/${connections[0]._id}`) data = tracker();
    }
  } catch (error) { responseCode = error.status || 500; message = error.message; }
  await send('Fetch.fulfillRequest', { requestId, responseCode, responseHeaders: [
    { name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: 'http://localhost:5173' },
    { name: 'Access-Control-Allow-Credentials', value: 'true' }, { name: 'Access-Control-Allow-Methods', value: 'GET,PUT,POST,OPTIONS' }, { name: 'Access-Control-Allow-Headers', value: 'Content-Type,X-Account-Id' },
  ], body: Buffer.from(JSON.stringify({ success: responseCode === 200, data, message })).toString('base64') });
});
const click = (label, scope = "document") =>
  evaluate(
    `Array.from(${scope}.querySelectorAll('button')).find(button=>button.textContent.trim()===${JSON.stringify(label)}).click()`,
  );
const openEditor = async title => {
  const selector = `[data-mentorship-goal]`;
  await evaluate(`(()=>{const card=Array.from(document.querySelectorAll(${JSON.stringify(selector)})).find(card=>card.querySelector('h3')?.textContent.trim()===${JSON.stringify(title)});const button=card?.querySelector('button[aria-controls^="goal-editor-"]');if(button?.getAttribute('aria-expanded')==='false')button.click();})()`);
  await until(`Array.from(document.querySelectorAll('[data-mentorship-goal]')).find(card=>card.querySelector('h3')?.textContent.trim()===${JSON.stringify(title)})?.querySelector('form')`);
};
const fill = async (label, value) => {
  if(label.startsWith('Note for ') || label.startsWith('Status for ')) await openEditor(label.replace(/^(Note|Status) for /, ''));
  return evaluate(`(()=>{const input=document.querySelector('[aria-label='+${JSON.stringify(JSON.stringify(label))}+']');const prototype=input.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLTextAreaElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event(input.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);
};
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
  await evaluate(`document.querySelector('[data-mentorship-goal="interview_preparation"]').scrollIntoView({block:'start'})`);
  await new Promise(resolve => setTimeout(resolve, 150));
  const shot = await send("Page.captureScreenshot", { format: "png" });
  await writeFile(
    path.join(artifacts, name + ".png"),
    Buffer.from(shot.data, "base64"),
  );
};
const navigate = async (route) => {
  await evaluate("window.oldMentorshipDocument=true");
  await send("Page.navigate", { url: "http://localhost:5173" + route });
  if (route.startsWith('/student')) {
    await until(`!window.oldMentorshipDocument && document.querySelector('nav[aria-label="Student mentorship workspace"]')`);
    await evaluate(`document.querySelector('nav[aria-label="Student mentorship workspace"] button:nth-child(3)').click()`);
  } else {
    await until(`!window.oldMentorshipDocument && document.querySelector('nav[aria-label="Mentor workspace"]')`);
    await click('Progress tracker');
    await until(`document.querySelector('[data-mentee-progress]')`);
    await evaluate(`document.querySelector('[aria-label="View progress for Alex Santos"]').click()`);
  }
  await until(`document.querySelectorAll('[data-mentorship-goal]').length===3`);
};

const openInterview = async () => {
  const label = user.role === 'student' ? 'Open interview practice' : 'View interview answers';
  await click(label);
  await until(`document.getElementById('interview-${connections[0]._id}')`);
};
const waitSaved = async revision => {
  await until(`${goal('interview_preparation')}.querySelector('button[aria-expanded]')?.getAttribute('aria-expanded')==='false'`);
  assert.equal(record.revision, revision);
};
try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*://localhost:3002/api/*' }, { urlPattern: '*://127.0.0.1:3002/api/*' }] });
  await navigate('/student/mentorship');
  await openInterview();
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Submit answers').disabled`), true);
  await fill('Answer: Tell me about yourself.', 'Private initial answer');
  failNext = true;
  await click('Save draft');
  await until(`document.body.textContent.includes('Temporary save failure')`);
  assert.equal(await evaluate(`document.querySelector('textarea').value`), 'Private initial answer');
  await click('Save draft');
  await waitSaved(1);
  user = mentor;
  await navigate('/alumni/mentorship');
  await openInterview();
  assert.equal(await evaluate(`document.body.textContent.includes('Private initial answer')`), false);
  assert.equal(await evaluate(`document.body.textContent.includes('Draft answers stay private')`), true);
  user = student;
  await navigate('/student/mentorship');
  await openInterview();
  for (const question of tracker().goals[1].interview.questions) await fill('Answer: ' + question.question, 'My concrete example for ' + question.id);
  await photo('interview-student-mobile', 390, false);
  await click('Submit answers');
  await waitSaved(2);
  await openInterview();
  assert.equal(await evaluate(`document.querySelectorAll('textarea').length`), 0);
  user = mentor;
  await navigate('/alumni/mentorship');
  await openInterview();
  for (const question of record.interview.submission.questions) await fill('Feedback: ' + question.question, 'Explain the result for ' + question.id);
  await photo('interview-mentor-mobile-dark', 390, true);
  await click('Request revisions');
  await waitSaved(3);
  user = student;
  await navigate('/student/mentorship');
  await openInterview();
  assert.equal(await evaluate(`document.body.textContent.includes('Explain the result for introduction')`), true);
  await fill('Answer: Tell me about yourself.', 'Revised introduction with measurable results');
  await click('Submit answers');
  await waitSaved(4);
  user = mentor;
  await navigate('/alumni/mentorship');
  await openInterview();
  assert.equal(await evaluate(`document.body.textContent.includes('Revised introduction with measurable results')`), true);
  for (const question of record.interview.submission.questions) await fill('Feedback: ' + question.question, 'Clear answer and useful example for ' + question.id);
  await click('Confirm Completed');
  await waitSaved(5);
  assert.equal(record.status, 'completed');
  user = student;
  await navigate('/student/mentorship');
  await openInterview();
  assert.equal(await evaluate(`document.querySelectorAll('textarea').length`), 0);
  await photo('interview-completed-desktop', 1440, false);
  assert.equal(await evaluate(`document.body.textContent.includes('33%')`), true);
  assert.deepEqual(runtimeErrors, []);
  console.log(JSON.stringify({ passed: true, flow: 'draft privacy, failed save retry, submit, revision, resubmit, mentor completion, mobile layouts', artifacts }, null, 2));
} finally {
  await send('Page.close').catch(() => {});
  socket.close();
}
