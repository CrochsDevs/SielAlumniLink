// Real local Socket.IO + three browser contexts, using fake devices and mock accounts.
// No production API, database, conversations, or account cookies are used.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { Server } from '../../Server/node_modules/socket.io/dist/index.js';
import { chromium } from '../node_modules/.search-validation/node_modules/playwright/index.mjs';
import { createGroupCallRuntime } from '../../Server/realtime/group-calls.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const origin = 'http://127.0.0.1:5188';
const accounts = ['Alex Santos', 'Jamie Reyes', 'Taylor Cruz'].map((name, index) => ({ _id: `profile${index}`, authId: `member${index}`, email: `member${index}@example.test`, name, role: index === 2 ? 'admin' : 'alumni', passwordSetupRequired: false }));
const group = { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Alumni Circle', isGroup: true, memberCount: 3, createdBy: 'member0', adminAuthIds: ['member0'], participants: accounts.map(account => ({ authId: account.authId, email: account.email })) };
const records = [], errors = [];
const http = createServer((_request, response) => { response.writeHead(404); response.end(); });
const io = new Server(http, { cors: { origin, credentials: true } });
const runtime = createGroupCallRuntime(io, {
  authorize: async (user, id) => id === group._id ? { ...group, displayName: accounts.find(account => account.authId === user._id)?.name } : null,
  emitToUser: (id, event, payload) => io.to(`user:${id}`).emit(event, payload),
  record: async call => records.push(call),
});
io.use((socket, next) => {
  const id = socket.handshake.headers.cookie?.match(/(?:^|;\s*)group_fixture=([^;]+)/)?.[1];
  const account = accounts.find(account => account.authId === id);
  if (!account) return next(new Error('Fixture account required'));
  socket.user = { ...account, _id: account.authId };
  next();
});
io.on('connection', socket => { socket.join(`user:${socket.user._id}`); runtime.attach(socket); });
await new Promise(resolve => http.listen(0, '127.0.0.1', resolve));
const socketOrigin = `http://127.0.0.1:${http.address().port}`;
const vite = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5188', '--strictPort'], { cwd: root, env: { ...process.env, VITE_API_URL: `${socketOrigin}/api`, VITE_SOCKET_URL: socketOrigin }, windowsHide: true, stdio: 'pipe' });
let output = '';
vite.stdout.on('data', chunk => { output += chunk; }); vite.stderr.on('data', chunk => { output += chunk; });
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    if (vite.exitCode != null) throw new Error(output);
    try { ready = (await fetch(origin)).ok; } catch { /* still starting */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.equal(ready, true, output);
  browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  const pages = [];
  for (const account of accounts) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, permissions: ['camera', 'microphone'] });
    await context.addCookies([{ name: 'group_fixture', value: account.authId, url: socketOrigin, httpOnly: true }]);
    await context.addInitScript(() => {
      window.fixturePeers = []; window.fixtureStreams = [];
      const Native = window.RTCPeerConnection;
      window.RTCPeerConnection = class extends Native { constructor(...args) { super(...args); window.fixturePeers.push(this); } };
      const getMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async constraints => { const stream = await getMedia(constraints); window.fixtureStreams.push(stream); return stream; };
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', route => {
      const url = new URL(route.request().url()); let data = [];
      if (['/api/auth/me', '/api/users/me'].includes(url.pathname)) data = account;
      if (url.pathname === '/api/conversations') data = [group];
      if (url.pathname === '/api/tracer/access') data = { updateRequired: false, quarter: '2026-Q4', nextUpdateAt: '2027-01-01T00:00:00Z' };
      if (url.pathname === '/api/meetings/config') data = { iceServers: [] };
      if (url.pathname === '/api/notifications/unread-count') data = { count: 0 };
      return route.fulfill({ headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true' }, json: { success: true, data } });
    });
    await page.goto(`${origin}/${account.role}/message`);
    await page.getByRole('button', { name: 'Start group video call', exact: true }).waitFor();
    await page.waitForFunction(async () => (await import('/src/realtime/socket.js')).getSocket().connected);
    pages.push(page);
  }
  const [a, b, c] = pages;
  await a.getByRole('button', { name: 'Start group video call', exact: true }).click();
  await a.getByRole('button', { name: 'Turn off camera', exact: true }).waitFor();
  for (const page of [b, c]) {
    const invite = page.getByRole('dialog', { name: 'Incoming group call', exact: true });
    await invite.waitFor(); await invite.getByRole('button', { name: 'Join call', exact: true }).click();
  }
  for (const page of pages) {
    await page.waitForFunction(() => document.querySelectorAll('[data-group-call-peer]').length === 3);
    await page.waitForFunction(() => window.fixturePeers.length === 2 && window.fixturePeers.every(peer => peer.connectionState === 'connected'));
    await page.waitForFunction(() => [...document.querySelectorAll('.group-call-peer video')].every(video => video.readyState >= 2));
  }
  await a.getByRole('button', { name: 'Mute microphone', exact: true }).click();
  assert.equal(await a.evaluate(() => window.fixtureStreams.flatMap(stream => stream.getAudioTracks()).some(track => track.enabled)), false);
  await a.getByRole('button', { name: 'Turn on microphone', exact: true }).click();
  await a.getByRole('button', { name: 'Turn off camera', exact: true }).click();
  await a.getByRole('button', { name: 'Turn on camera', exact: true }).waitFor();
  const artifacts = path.join(os.tmpdir(), 'SielAlumni-group-calls'); await mkdir(artifacts, { recursive: true });
  await a.screenshot({ path: path.join(artifacts, 'three-member-call.png') });
  await a.setViewportSize({ width: 320, height: 740 });
  assert.ok(await a.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  assert.ok(await a.getByRole('button', { name: 'Leave group call', exact: true }).evaluate(element => element.getBoundingClientRect().bottom <= innerHeight), 'call controls remain visible without scrolling');
  await a.screenshot({ path: path.join(artifacts, 'mobile-call.png') });
  await a.getByRole('button', { name: 'Leave group call', exact: true }).click();
  assert.equal(await a.evaluate(() => window.fixtureStreams.flatMap(stream => stream.getTracks()).every(track => track.readyState === 'ended')), true);
  await b.waitForFunction(() => document.querySelectorAll('[data-group-call-peer]').length === 2);
  await b.getByRole('button', { name: 'Leave group call', exact: true }).click();
  await c.waitForFunction(() => document.querySelectorAll('[data-group-call-peer]').length === 1);
  await c.getByRole('button', { name: 'Leave group call', exact: true }).click();
  await a.setViewportSize({ width: 1366, height: 900 });
  await a.getByRole('button', { name: 'Start group voice call', exact: true }).waitFor();
  assert.equal(records.length, 1);
  await c.evaluate(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Denied', 'NotAllowedError')); });
  await a.getByRole('button', { name: 'Start group voice call', exact: true }).click();
  await c.getByRole('dialog', { name: 'Incoming group call', exact: true }).getByRole('button', { name: 'Join call', exact: true }).click();
  await c.getByRole('alert').filter({ hasText: 'permission was denied' }).waitFor();
  await c.waitForFunction(() => document.querySelectorAll('[data-group-call-peer]').length === 2);
  await c.getByRole('button', { name: 'Leave group call', exact: true }).click();
  await a.getByRole('button', { name: 'Leave group call', exact: true }).click();
  await a.getByRole('button', { name: 'Start group voice call', exact: true }).waitFor();
  assert.equal(records.length, 2);
  assert.deepEqual(errors, []);
  console.log('PASS: three real WebRTC peers, group video/voice start, incoming/join, mute/camera, starter leaving without ending others, final cleanup/history, permission denial, mobile layout. Mock accounts and fake media only. Screenshots: '+artifacts);
} finally {
  await browser?.close();
  vite.kill();
  await new Promise(resolve => io.close(resolve));
}
