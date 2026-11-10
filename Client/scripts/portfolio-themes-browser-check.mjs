// Run with isolated Edge/Chrome on port 9235. API fixtures never change real records.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { RESUME_THEMES } from '../src/utils/resumeThemes.js';

// Uses a separate headless browser and API fixtures. No real alumni responses
// are read or written. Start Edge/Chrome with remote debugging on port 9235.
const artifacts = path.join(os.tmpdir(), "SielAlumni-event-cards-check");
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

const origin = 'http://localhost:5180';
const alumni = { _id: 'a'.repeat(24), authId: 'a'.repeat(24), role: 'student', name: 'Resume Tester', program: 'BS Information Technology', education: [{degree:'BS Information Technology', school:'Central Luzon State University', year:'2025'}], profilePicture: 'data:image/webp;base64,UklGRkYAAABXRUJQVlA4IDoAAAAQAwCdASoYABgAPm0ylUekIqIhKAgAgA2JZQB2AACKtrAA/u0HL/4hd7G2///U4/+Tj/5OP6ygAAAA', email: 'alumni@example.test', passwordSetupRequired: false };
const headers = [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: origin }, { name: 'Access-Control-Allow-Credentials', value: 'true' }, { name: 'Access-Control-Allow-Headers', value: 'Content-Type, X-Account-Id' }, { name: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' }];
listeners.set('Fetch.requestPaused', async ({ requestId, request }) => {
  const route = new URL(request.url).pathname.replace('/api', '');
  const data = ['/auth/me', '/users/me'].includes(route) ? alumni : route === '/development/me' ? { portfolio: { skills: ['React', 'Node.js'], projects: [{title: 'CLSU project', desc: 'Built a useful system.'}], certifications: [], seminars: [], awards: [], research: [] }, internships: [], digitalCertificates: [] } : route === '/tracer/access' ? { updateRequired: false, quarter: '2026-Q4', nextUpdateAt: '2099-01-01' } : [];
  await send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: headers, body: Buffer.from(JSON.stringify({ success: true, data })).toString('base64') });
});
try {
  await send('Page.enable'); await send('Runtime.enable');
  listeners.set('Runtime.exceptionThrown', params => {runtimeErrors.push(params.exceptionDetails.exception?.description || params.exceptionDetails.text);});
  await send('Fetch.enable', { patterns: [{ urlPattern: 'http://localhost:3002/api/*' }] });
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:`${origin}/student/portfolio`});
  await until(`document.querySelector('select[aria-describedby]')?.options.length===18`);
  for (const theme of ['classic','modern','professional','minimal','emerald','executive','academic','midnight','cobalt','studio','nordic','terracotta','monochrome','aurora','editorial','timeline','linen','ledger']) {
    await evaluate(`(() => {const select=document.querySelector('select[aria-describedby]'); select.value='${theme}'; select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await until(`document.querySelector('section[aria-label="Your resume"] [data-resume-theme="${theme}"]')`);
    await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Preview resume')).click()`);
    await until(`document.querySelector('dialog[open] [data-resume-theme="${theme}"]')`);
    const expectedPhoto = RESUME_THEMES.find(item => item.id === theme).photo === true;
    assert.equal(await evaluate(`!!document.querySelector('dialog img')`),expectedPhoto,'Photo choice in '+theme);
    if (expectedPhoto) assert.equal(await evaluate(`document.querySelector('dialog img').complete&&document.querySelector('dialog img').naturalWidth>0`),true,'Loaded photo in '+theme);
    assert.equal(await evaluate(`!!document.querySelector('.student-resume-print img')`),expectedPhoto,'Printed photo choice in '+theme);
    assert.equal(await evaluate(`document.querySelector('dialog').clientHeight===innerHeight`),true,'Full-screen preview');
    await writeFile(path.join(artifacts,`theme-${theme}.png`),Buffer.from((await send('Page.captureScreenshot')).data,'base64'));
    const pdf=await send('Page.printToPDF',{printBackground:true,preferCSSPageSize:true});
    await writeFile(path.join(artifacts,`theme-${theme}.pdf`),Buffer.from(pdf.data,'base64'));
    await evaluate(`document.querySelector('button[aria-label="Close dialog"]').click()`);
  }
  await send('Page.reload');
  await until(`document.querySelector('select[aria-describedby]')?.value==='ledger'`);
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert.equal(await evaluate(`document.documentElement.scrollWidth<=390`),true,'Mobile has no horizontal overflow');
  assert.equal(runtimeErrors.length,0,runtimeErrors.join('\n'));
  console.log(`Passed: 18 themes with correct photo/text-only variants in preview and print; saved theme survives reload; no mobile overflow. Artifacts: ${artifacts}`);
} finally { await send('Browser.close').catch(()=>{}); socket.close(); }


