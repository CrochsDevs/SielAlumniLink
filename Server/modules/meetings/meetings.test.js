import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as connect } from '../../../Client/node_modules/socket.io-client/build/esm/index.js';
import { createMeetingService, MEETING_LIMIT } from './meetings.service.js';
import { createMeetingRuntime } from './meetings.socket.js';
import { createMemoryDb, event, host, student, stranger } from './meetings.fixture.js';
import { validateEvent } from '../events/events.policy.js';
import { meetingAccessWindow } from './meetings.policy.js';
const id = String(event._id);
const forbidden = error => error.status === 403;

test('registered students can view and join exactly 15 minutes before start; early hosting cannot bypass the schedule', async () => {
  const { db, seed } = createMemoryDb();
  const scheduled = { ...event, startAt: new Date('2025-02-15T09:00:00+08:00'), endAt: new Date('2025-02-15T12:00:00+08:00') };
  seed('events', scheduled);
  let clock = new Date('2025-02-15T08:44:59.999+08:00').getTime();
  const service = createMeetingService(db, { now: () => clock });
  await service.register(student, id); await service.start(host, id);
  assert.equal(meetingAccessWindow(scheduled, { state: 'active' }, clock).state, 'upcoming');
  await assert.rejects(service.details(student, id), error => error.status === 403 && /15 minutes/.test(error.message));
  await assert.rejects(service.join(student, id), forbidden);
  // Administrators can prepare the room while student access is still locked.
  assert.equal((await service.details(host, id)).meetingAccess.state, 'upcoming');
  assert.equal((await service.join(host, id)).name, host.name);
  clock++;
  assert.equal((await service.details(student, id)).meetingAccess.state, 'open');
  assert.equal((await service.join(student, id)).name, student.name);
  await assert.rejects(service.details(stranger, id), forbidden);
  await assert.rejects(service.join(stranger, id), forbidden);
  // A changed schedule must take effect immediately, including direct access.
  seed('events', { ...scheduled, startAt: new Date('2025-02-15T10:00:00+08:00') });
  await assert.rejects(service.details(student, id), forbidden);
  await assert.rejects(service.join(student, id), forbidden);
});

test('after a meeting ends, students cannot reopen it; an ongoing session remains accessible until the host ends it', async () => {
  const { db, seed } = createMemoryDb();
  const scheduled = { ...event, startAt: new Date('2025-02-15T09:00:00+08:00'), endAt: new Date('2025-02-15T12:00:00+08:00') };
  seed('events', scheduled);
  let clock = new Date('2025-02-15T10:00:00+08:00').getTime();
  const service = createMeetingService(db, { now: () => clock });
  await service.register(student, id); await service.start(host, id);
  clock = scheduled.endAt.getTime();
  assert.equal((await service.details(student, id)).meetingAccess.state, 'open');
  await service.end(host, id);
  await assert.rejects(service.details(student, id), error => error.status === 410);
  await assert.rejects(service.join(student, id), error => error.status === 410);
  assert.equal((await service.details(host, id)).meeting.state, 'ended');
  assert.equal(meetingAccessWindow(scheduled, null, clock).state, 'ended');
});

test('alumni access opens at exactly T minus 15 minutes, even when the host has started early', async () => {
  const { db, seed } = createMemoryDb();
  const scheduled = { ...event, startAt: new Date('2026-11-09T10:00:00+08:00'), endAt: new Date('2026-11-09T12:00:00+08:00') };
  seed('events', scheduled);
  const alumni = { ...student, role: 'alumni' };
  let clock = new Date('2026-11-09T09:44:59.999+08:00').getTime();
  const service = createMeetingService(db, { now: () => clock });
  await service.register(alumni, id); await service.start(host, id);
  await assert.rejects(service.join(alumni, id), forbidden);
  clock++;
  assert.equal((await service.details(alumni, id)).meetingAccess.state, 'open');
  assert.equal((await service.join(alumni, id)).name, student.name);
});

test('event creation validates activity type, online mode, and dates; legacy defaults remain onsite', () => {
  assert.equal(validateEvent({ title: 'Test', startAt: new Date().toISOString() }).deliveryMode, 'onsite');
  for (const change of [{ activityType: 'job' }, { deliveryMode: 'zoom' }, { startAt: 'bad' }, { endAt: event.startAt.toISOString() }]) assert.throws(() => validateEvent({ ...event, startAt: event.startAt.toISOString(), endAt: event.endAt.toISOString(), ...change }), error => error.status === 400);
  assert.deepEqual(validateEvent({ isActive: false }, true), { isActive: false });
});
test('registration is owned, idempotent, and required before a student joins', async () => {
  const { db } = createMemoryDb(), service = createMeetingService(db);
  await assert.rejects(service.start(student, id), forbidden);
  await service.start(host, id);
  await assert.rejects(service.join(student, id), forbidden);
  const registrations = await Promise.all(Array.from({ length: 8 }, () => service.register(student, id)));
  assert.equal(new Set(registrations.map(record => record._id)).size, 1);
  assert.equal((await service.join(student, id)).name, student.name);
  await assert.rejects(service.details(stranger, id), forbidden);
  await assert.rejects(service.roster(student, id), forbidden);
});
test('only published online activities can be joined and certificates require recorded attendance plus an ended meeting', async () => {
  const { db, seed } = createMemoryDb(), service = createMeetingService(db);
  seed('events', { ...event, isActive: false }); await assert.rejects(service.details(student, id), error => error.status === 404);
  seed('events', { ...event, deliveryMode: 'onsite' }); await assert.rejects(service.start(host, id), error => error.status === 400);
  seed('events', event); await service.register(student, id); await service.start(host, id);
  await assert.rejects(service.certify(student, id, student._id), forbidden);
  await assert.rejects(service.certify(host, id, student._id), error => error.status === 400);
  await service.end(host, id);
  await assert.rejects(service.certify(host, id, student._id), error => error.status === 400);
});
test('server elapsed time accumulates across visits, confirmed certificates preserve activity metadata and retries are safe', async () => {
  const { db, bucket, seed } = createMemoryDb();
  const service = createMeetingService(db); await service.register(student, id); const meeting = await service.start(host, id);
  await service.recordVisit(student, event, meeting.sessionId, 1000, 61000);
  await service.recordVisit(student, event, meeting.sessionId, 100000, 130000);
  assert.equal((await service.roster(host, id))[0].attendedSeconds, 90);
  assert.equal([...bucket('student_event_attendance').values()][0].onlineSeconds, 90);
  await service.end(host, id);
  // Later calendar edits must not change the actual participation certificate.
  seed('events', { ...event, title: 'Changed title', activityType: 'seminar' });
  const certificates = await Promise.all(Array.from({ length: 5 }, () => service.certify(host, id, student._id)));
  assert.equal(new Set(certificates.map(doc => doc._id)).size, 1); assert.equal(bucket('digital_certificates').size, 1);
  assert.equal(certificates[0].title, event.title); assert.equal(certificates[0].activityType, 'training');
});
test('real Socket.IO: host gate, same-room signaling, chat, removal, room capacity, and host disconnect save attendance', { timeout: 20000 }, async () => {
  const { db, seed } = createMemoryDb(); let clock = Date.now();
  seed('users', { ...host, authId: String(host._id), profilePicture: 'https://example.test/host.jpg' });
  seed('users', { ...student, authId: String(student._id), profilePicture: 'https://example.test/student.jpg' });
  const service = createMeetingService(db, { now: () => clock });
  const http = createServer(), server = new Server(http);
  const runtime = createMeetingRuntime(server, service, { now: () => clock });
  const users = { host, student, stranger };
  server.use((socket, next) => { socket.user = users[socket.handshake.auth.user]; socket.user ? next() : next(new Error('Unauthorized')); });
  server.on('connection', runtime.attach);
  await new Promise(resolve => http.listen(0, '127.0.0.1', resolve));
  const sockets = [];
  const open = async user => { const socket = connect(`http://127.0.0.1:${http.address().port}`, { auth: { user }, transports: ['websocket'], reconnection: false }); sockets.push(socket); await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); }); return socket; };
  const request = (socket, action, data = {}) => new Promise(resolve => socket.emit(action, data, resolve));
  try {
    await service.start(host, id); await service.register(student, id); await service.register(stranger, id);
    const a = await open('host'), b = await open('student'), outside = await open('stranger');
    assert.equal((await request(b, 'meeting:join', { eventId: id })).success, false);
    const hostJoin = await request(a, 'meeting:join', { eventId: id });
    assert.equal(hostJoin.success, true);
    assert.equal(hostJoin.data.self.profilePicture, 'https://example.test/host.jpg');
    const peerJoined = new Promise(resolve => a.once('meeting:peer-joined', resolve));
    const studentJoin = await request(b, 'meeting:join', { eventId: id });
    assert.equal(studentJoin.data.peers.length, 1);
    assert.equal(studentJoin.data.peers[0].profilePicture, 'https://example.test/host.jpg');
    assert.equal((await peerJoined).profilePicture, 'https://example.test/student.jpg');
    const peerUpdated = new Promise(resolve => a.once('meeting:peer-updated', resolve));
    await request(b, 'meeting:status', { mic: true, profilePicture: 'https://example.test/forged.jpg' });
    assert.equal((await peerUpdated).profilePicture, 'https://example.test/student.jpg');
    a.emit('meeting:signal', null); a.emit('meeting:signal', 'invalid');
    const signal = new Promise(resolve => b.once('meeting:signal', resolve));
    a.emit('meeting:signal', { to: b.id, description: { type: 'offer', sdp: 'fixture-offer' } }); assert.equal((await signal).from, a.id);
    let leaked = false; outside.on('meeting:signal', () => { leaked = true; });
    a.emit('meeting:signal', { to: outside.id, description: { type: 'offer', sdp: 'no-leak' } });
    const chat = new Promise(resolve => a.once('meeting:chat', resolve));
    await request(b, 'meeting:chat', { text: 'Hello everyone' }); assert.equal((await chat).name, student.name);
    assert.equal((await request(b, 'meeting:remove', { peerId: a.id })).success, false);
    clock += 30000;
    assert.equal((await request(a, 'meeting:remove', { peerId: b.id })).success, true);
    assert.equal((await request(b, 'meeting:join', { eventId: id })).success, false);
    assert.equal((await service.roster(host, id)).find(row => row.authId === String(student._id)).attendedSeconds, 30);
    await request(outside, 'meeting:join', { eventId: id });
    // The host and the outside participant occupy the first two seats.
    for (let n = 0; n < MEETING_LIMIT - 2; n++) {
      const user = { ...student, _id: String(n + 1).padStart(24, '0'), email: `seat${n}@example.test` }; users[`seat${n}`] = user;
      seed('auth', user); seed('users', { ...user, authId: user._id });
      await service.register(user, id); const socket = await open(`seat${n}`); assert.equal((await request(socket, 'meeting:join', { eventId: id })).success, true);
    }
    const extraUser = { ...student, _id: 'ffffffffffffffffffffffff', email: 'extra@example.test' }; users.extra = extraUser;
    seed('auth', extraUser); seed('users', { ...extraUser, authId: extraUser._id }); await service.register(extraUser, id);
    const extra = await open('extra'); assert.match((await request(extra, 'meeting:join', { eventId: id })).message, /full/);
    clock += 60000;
    const ended = new Promise(resolve => outside.once('meeting:ended', resolve)); a.disconnect(); await ended;
    assert.equal((await service.details(host, id)).meeting.state, 'ended');
    assert.equal((await service.roster(host, id)).find(row => row.authId === String(stranger._id)).attendedSeconds, 60);
    assert.equal(leaked, false);
  } finally { sockets.forEach(socket => socket.disconnect()); await new Promise(resolve => server.close(resolve)); }
});
