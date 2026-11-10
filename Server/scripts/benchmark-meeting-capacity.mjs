// Isolated real Socket.IO clients + in-memory persistence. No production DB writes.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { performance, monitorEventLoopDelay } from 'node:perf_hooks';
import { writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Server } from 'socket.io';
import { io } from '../../Client/node_modules/socket.io-client/build/esm/index.js';
import { createMeetingService, MEETING_LIMIT } from '../modules/meetings/meetings.service.js';
import { createMeetingRuntime } from '../modules/meetings/meetings.socket.js';
import { createMemoryDb, event, host } from '../modules/meetings/meetings.fixture.js';

const { db, seed } = createMemoryDb();
let clock = Date.now();
const service = createMeetingService(db, { now: () => clock });
const http = createServer();
const server = new Server(http);
const runtime = createMeetingRuntime(server, service, { now: () => clock });
const accounts = [host, ...Array.from({ length: MEETING_LIMIT }, (_, index) => ({
  _id: String(index + 1).padStart(24, '0'), role: index % 2 ? 'alumni' : 'student',
  name: `Load participant ${index + 1}`, email: `load-${index + 1}@example.test`,
}))];
const sockets = [];
const delays = monitorEventLoopDelay({ resolution: 10 });
const percentile = (values, quantile) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * quantile))] || 0;
const stats = values => ({ count: values.length, p50Ms: +percentile(values, .5).toFixed(2), p95Ms: +percentile(values, .95).toFixed(2), maxMs: +Math.max(0, ...values).toFixed(2) });
const until = async (check, label, timeout = 15000) => {
  const start = performance.now();
  while (!check()) {
    if (performance.now() - start > timeout) throw new Error(`${label} timed out`);
    await new Promise(resolve => setTimeout(resolve, 10));
  }
};
const request = (socket, action, payload = {}) => new Promise((resolve, reject) => {
  socket.timeout(15000).emit(action, payload, (error, response) => error ? reject(error) : resolve(response));
});
server.use((socket, next) => {
  socket.user = accounts[socket.handshake.auth.account];
  socket.user ? next() : next(new Error('Unauthorized'));
});
server.on('connection', runtime.attach);
try {
  await new Promise(resolve => http.listen(0, '127.0.0.1', resolve));
  const eventId = String(event._id);
  for (const user of accounts.slice(1)) {
    seed('auth', user); seed('users', { ...user, authId: user._id });
    await service.register(user, eventId);
  }
  await service.start(host, eventId);
  delays.enable();
  const cpuBefore = process.cpuUsage();
  const started = performance.now();
  await Promise.all(accounts.map(async (_, account) => {
    const socket = io(`http://127.0.0.1:${http.address().port}`, { auth: { account }, transports: ['websocket'], reconnection: false, forceNew: true });
    sockets[account] = socket;
    await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
  }));
  assert.equal((await request(sockets[0], 'meeting:join', { eventId })).success, true);
  const joinLatencies = [];
  await Promise.all(sockets.slice(1, MEETING_LIMIT).map(async socket => {
    const start = performance.now();
    const result = await request(socket, 'meeting:join', { eventId });
    joinLatencies.push(performance.now() - start);
    assert.equal(result.success, true, result.message);
  }));
  const excess = await request(sockets[MEETING_LIMIT], 'meeting:join', { eventId });
  assert.equal(excess.success, false); assert.match(excess.message, /full \(100 participants\)/);
  const members = sockets.slice(0, MEETING_LIMIT);
  const sent = new Map();
  const received = new Set();
  const signalLatencies = [];
  for (const socket of members) socket.on('meeting:signal', message => {
    const token = message.description ? message.description.sdp.split('|')[0] : message.candidate.candidate;
    assert.equal(received.has(token), false);
    received.add(token);
    signalLatencies.push(performance.now() - sent.get(token));
  });
  const signalStart = performance.now();
  for (const [i, socket] of members.entries()) {
    for (const [j, target] of members.entries()) {
      if (i === j) continue;
      for (let type = 0; type < 4; type++) {
        const token = `load:${i}:${j}:${type}`;
        sent.set(token, performance.now());
        socket.emit('meeting:signal', { to: target.id, ...(type < 2 ? { description: { type: type ? 'answer' : 'offer', sdp: `${token}|${'v=0\r\na=load-fixture\r\n'.repeat(30)}` } } : { candidate: { candidate: token, sdpMid: '0', sdpMLineIndex: 0 } }) });
      }
    }
  }
  await until(() => received.size === sent.size, `Signaling ${received.size}/${sent.size}`);
  const signalMs = performance.now() - signalStart;
  let chats = 0;
  const chatLatencies = [];
  const chatSent = new Map();
  for (const socket of members) socket.on('meeting:chat', message => {
    if (chatSent.has(message.text)) { chats++; chatLatencies.push(performance.now() - chatSent.get(message.text)); }
  });
  await Promise.all(members.map(async (socket, index) => {
    const text = `load-chat-${index}`;
    chatSent.set(text, performance.now());
    const result = await request(socket, 'meeting:chat', { text });
    assert.equal(result.success, true, result.message);
  }));
  await until(() => chats === MEETING_LIMIT * MEETING_LIMIT, 'Chat delivery');
  const metadataStart = performance.now();
  await Promise.all(accounts.slice(0, MEETING_LIMIT).map(async user => assert.equal((await service.details(user, eventId)).capacity, 100)));
  const metadataMs = performance.now() - metadataStart;
  clock += 60000;
  const attendanceStart = performance.now();
  await runtime.end(eventId, host);
  const attendanceMs = performance.now() - attendanceStart;
  const attended = (await service.roster(host, eventId)).filter(row => row.attendedSeconds === 60);
  assert.equal(attended.length, MEETING_LIMIT - 1);
  const cpu = process.cpuUsage(cpuBefore);
  const summary = {
    environment: { node: process.version, platform: process.platform, cpu: os.cpus()[0]?.model, logicalCpus: os.availableParallelism(), memoryGB: +(os.totalmem() / 1024 ** 3).toFixed(1) },
    limitations: 'Localhost, synthetic authentication and in-memory persistence; no real SDP negotiation or media in this benchmark.',
    participants: MEETING_LIMIT, extraParticipantRejected: true,
    join: stats(joinLatencies), signal: { ...stats(signalLatencies), totalMs: +signalMs.toFixed(2), lost: sent.size - received.size },
    chat: { ...stats(chatLatencies), expectedDeliveries: MEETING_LIMIT ** 2 },
    metadata100CallsMs: +metadataMs.toFixed(2), attendance: { saved: attended.length, endMs: +attendanceMs.toFixed(2) },
    eventLoopP95Ms: +(delays.percentile(95) / 1e6).toFixed(2), eventLoopMaxMs: +(delays.max / 1e6).toFixed(2),
    processRssMB: +(process.memoryUsage().rss / 1024 ** 2).toFixed(1), cpuSeconds: +((cpu.user + cpu.system) / 1e6).toFixed(2), elapsedSeconds: +((performance.now() - started) / 1000).toFixed(2),
  };
  await writeFile(path.join(os.tmpdir(), 'siel-meeting-capacity-100.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
} finally {
  delays.disable();
  sockets.forEach(socket => socket.disconnect());
  await new Promise(resolve => server.close(resolve));
}
