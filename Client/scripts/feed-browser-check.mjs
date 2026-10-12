import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// Run against a separate headless Edge/Chrome instance on port 9228.
// Browser-only API fixtures never read or change application user data.
const artifacts = path.join(os.tmpdir(), 'SielAlumni-feed-check');
await mkdir(artifacts, { recursive: true });
const logo = await readFile(new URL('../src/assets/logo/clsu_logo.png', import.meta.url));
const file = path.join(artifacts, 'post-photo.png');
await writeFile(file, logo);
const target = await (await fetch('http://localhost:9228/json/new?about:blank', { method: 'PUT' })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let sequence = 0;
const waiting = new Map();
const listeners = new Map();
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence;
  const timeout = setTimeout(() => { waiting.delete(id); reject(new Error(`Timeout: ${method}`)); }, 15000);
  waiting.set(id, { resolve, reject, timeout });
  socket.send(JSON.stringify({ id, method, params }));
});
socket.onmessage = event => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const request = waiting.get(message.id);
    if (!request) return;
    clearTimeout(request.timeout); waiting.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result);
  } else listeners.get(message.method)?.(message.params);
};
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
};
const until = async expression => {
  const start = Date.now();
  while (Date.now() - start < 15000) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`UI wait failed: ${expression}`);
};
const author = { _id: '111111111111111111111111', authId: 'aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Alumni Photo Tester',
  email: 'photo-test@example.test', role: 'alumni', passwordSetupRequired: false, program: 'BS Information Technology', batch: '2020' };
const friend = { _id: '222222222222222222222222', authId: 'bbbbbbbbbbbbbbbbbbbbbbbb', name: 'Connected Alumni', email: 'friend@example.test', role: 'alumni' };
let posts = [];
let postNumber = 1;
let uploadedNumber = 1;
let failFirstUpload = true;
let removedUploads = 0;
const runtimeErrors = [];
listeners.set('Runtime.exceptionThrown', ({ exceptionDetails }) => runtimeErrors.push(exceptionDetails.exception?.description || exceptionDetails.text));
listeners.set('Fetch.requestPaused', async ({ requestId, request }) => {
  try {
    const url = new URL(request.url);
    let data = [], responseCode = 200;
    let body, contentType = 'application/json';
    const route = url.pathname.replace('/api', '');
    if (request.method === 'OPTIONS') data = null;
    else if (route === '/auth/me' || route === '/users/me') data = author;
    else if (route === '/users') data = [author, friend];
    else if (route === '/connections/me') data = [{ requesterAuthId: author.authId, recipientAuthId: friend.authId, requesterEmail: author.email, recipientEmail: friend.email, status: 'accepted' }];
    else if (route === '/upload/feed-image') {
      if (failFirstUpload) {
        failFirstUpload = false; responseCode = 502;
        body = Buffer.from(JSON.stringify({ success: false, message: 'Test upload interrupted. Retry this photo.' })).toString('base64');
      } else { data = { id: String(uploadedNumber++).padStart(24, '0'), width: logo.readUInt32BE(16), height: logo.readUInt32BE(20) }; responseCode = 201; }
    }
    else if (route.startsWith('/upload/feed-image/') && request.method === 'DELETE') { removedUploads++; data = null; }
    else if (route === '/feed' && request.method === 'POST') {
      const input = JSON.parse(request.postData);
      const id = String(postNumber++).padStart(24, 'f');
      data = { ...input, _id: id, author, isMine: true, createdAt: new Date().toISOString(), likesCount: 0, commentsCount: 0, sharesCount: 0,
        images: input.images.map(image => ({ ...image, width: logo.readUInt32BE(16), height: logo.readUInt32BE(20), url: `/api/feed/${id}/images/${image.id}` })) };
      posts.unshift(data); responseCode = 201;
    } else if (route === '/feed') data = { posts, nextCursor: null };
    else if (/\/images\//.test(route)) { body = logo.toString('base64'); contentType = 'image/png'; }
    else if (route.endsWith('/like')) { const input = JSON.parse(request.postData); data = posts[0] = { ...posts[0], likedByMe: input.liked, likesCount: input.liked ? 1 : 0 }; }
    else if (route.endsWith('/comments')) data = { comments: [], nextCursor: null };
    body ??= Buffer.from(JSON.stringify({ success: true, data })).toString('base64');
    await send('Fetch.fulfillRequest', { requestId, responseCode, responseHeaders: [
      { name: 'Content-Type', value: contentType }, { name: 'Access-Control-Allow-Origin', value: 'http://localhost:5173' },
      { name: 'Access-Control-Allow-Credentials', value: 'true' },
      { name: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
      { name: 'Access-Control-Allow-Headers', value: 'Content-Type' },
    ], body });
  } catch (error) { runtimeErrors.push(error.message); await send('Fetch.failRequest', { requestId, errorReason: 'Failed' }); }
});

try {
  await send('Page.enable'); await send('Runtime.enable'); await send('DOM.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: 'http://localhost:3002/api/*' }] });
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: 'http://localhost:5173/alumni' });
  await until("document.querySelector('main') && document.body.textContent.includes('Share an update with your network')");
  await evaluate("Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Share an update with your network')).click()");
  await until("document.querySelector('dialog[open] input[type=file]')");
  const documentNode = await send('DOM.getDocument');
  const input = await send('DOM.querySelector', { nodeId: documentNode.root.nodeId, selector: 'dialog[open] input[type=file]' });
  await send('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [file, file, file, file, file] });
  await until("document.querySelectorAll('dialog[open] img').length === 5");
  await until("Array.from(document.querySelectorAll('dialog[open] div')).filter(d => d.textContent === 'Photo ready').length === 4 && document.querySelector('dialog[open]').textContent.includes('Retry upload')");
  assert.equal(posts.length, 0, 'Uploading must not publish the post');
  assert.equal(await evaluate("Array.from(document.querySelectorAll('dialog[open] button')).find(b => b.textContent === 'Publish post').disabled"), true, 'A failed upload must block publishing');
  await evaluate("Array.from(document.querySelectorAll('dialog[open] button')).find(b => b.textContent === 'Retry upload').click()");
  await until("Array.from(document.querySelectorAll('dialog[open] div')).filter(d => d.textContent === 'Photo ready').length === 5");
  assert.equal(uploadedNumber, 6, 'Photos must upload immediately, before publishing');
  assert.equal(await evaluate("document.querySelector('dialog[open]').scrollWidth <= document.querySelector('dialog[open]').clientWidth"), true, 'Mobile composer overflow');
  await evaluate("document.querySelector('dialog[open] [aria-label=\"Remove photo 5\"]').click()");
  await until("document.querySelectorAll('dialog[open] img').length === 4");
  assert.equal(removedUploads, 1, 'Removing a selected photo must delete the unused upload');
  await evaluate("document.querySelector('dialog[open] form').requestSubmit()");
  await until("!document.querySelector('dialog[open]') && document.querySelector('article img')");
  assert.equal(posts[0].images.length, 4, 'All selected photos must be persisted');
  assert.equal(uploadedNumber, 6, 'Publishing must reuse uploaded images, not upload them again');
  assert.equal(posts[0].body, '', 'Image-only update is allowed');
  await until("Array.from(document.querySelectorAll('article img')).every(i => i.complete && i.naturalWidth > 0)");
  await evaluate("document.querySelector('article [aria-label=\"View photo 2 of 4\"]').click()");
  await until("document.querySelector('dialog[open] [aria-label=\"Next photo\"]')");
  await evaluate("document.querySelector('[aria-label=\"Next photo\"]').click()");
  assert.equal(await evaluate("document.querySelector('dialog[open] h2').textContent"), 'Photo 3 of 4');
  await evaluate("document.querySelector('[aria-label=\"Close photo viewer\"]').click()");
  await evaluate("Array.from(document.querySelectorAll('article button')).find(b => b.textContent.trim() === 'Like').click()");
  await until("document.querySelector('article [aria-pressed=true]')");
  for (const width of [320, 390, 768, 1024, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
    await new Promise(resolve => setTimeout(resolve, 150));
    const size = await evaluate("({viewport:innerWidth, page:document.documentElement.scrollWidth, feed:document.querySelector('article').getBoundingClientRect().width})");
    assert.ok(size.page <= width + 1, `Horizontal overflow at ${width}px: ${JSON.stringify(size)}`);
    assert.ok(size.feed > 260, `Feed is too narrow at ${width}px: ${size.feed}`);
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(path.join(artifacts, `feed-${width}.png`), Buffer.from(screenshot.data, 'base64'));
    console.log(`Responsive feed: ${width}px, article ${Math.round(size.feed)}px, no overflow`);
  }
  assert.deepEqual(runtimeErrors, [], 'Browser runtime errors');
  console.log('Browser passed: immediate uploads, failed-upload retry, unused-image deletion, publishing without duplicate uploads, gallery navigation, likes, and five viewport sizes.');
  console.log(`Screenshots: ${artifacts}`);
} catch (error) {
  console.log('Browser test diagnostic:', await evaluate("document.querySelector('dialog[open]')?.innerText || document.body.innerText").catch(() => 'unavailable'));
  console.log('Runtime errors:', runtimeErrors);
  throw error;
} finally {
  await send('Browser.close').catch(() => {});
  socket.close();
}
