// Regression checks for the five follow-up findings, 2026-10-28.
// Actual HTTP/socket handlers, isolated database fixtures, no external writes.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { signSessionToken, verifySessionToken } from '../modules/auth/session-token.js';

process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/followup_review_fixture';
process.env.JWT_SECRET = randomBytes(48).toString('hex');
process.env.NODE_ENV = 'production';
process.env.FRONTEND_URL = 'https://alumnilink.example';
process.env.DOTENV_CONFIG_QUIET = 'true';
let failMail = false;
nodemailer.createTransport = () => ({ sendMail: async () => { if (failMail) throw new Error('Fixture mail failure'); } });
const records = new Map();
const rows = name => { if (!records.has(name)) records.set(name, []); return records.get(name); };
const equal = (a, b) => a instanceof ObjectId || b instanceof ObjectId ? String(a) === String(b)
  : a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b;
const evaluate = (doc, expression) => {
  if (typeof expression === 'string' && expression.startsWith('$')) return doc[expression.slice(1)];
  if (expression === null || typeof expression !== 'object') return expression;
  if (Array.isArray(expression)) return expression.map(item => evaluate(doc, item));
  const [[operator, value]] = Object.entries(expression);
  if (operator === '$literal') return value;
  const args = evaluate(doc, value);
  if (operator === '$ifNull') return args[0] ?? args[1];
  if (operator === '$concatArrays') return args.flat();
  if (operator === '$setUnion') return [...new Set(args.flat())];
  if (operator === '$size') return args.length;
  if (operator === '$lte') return args[0] <= args[1];
  throw new Error(`Unsupported fixture expression: ${operator}`);
};
const matches = (doc, filter) => Object.entries(filter).every(([key, value]) => {
  if (key === '$or') return value.some(part => matches(doc, part));
  if (key === '$expr') return evaluate(doc, value);
  const actual = doc[key];
  if (value && typeof value === 'object' && !(value instanceof Date) && !(value instanceof ObjectId)) {
    return Object.entries(value).every(([op, expected]) => {
      if (op === '$in') return expected.some(item => equal(actual, item));
      if (op === '$gt') return actual > expected;
      if (op === '$lt') return actual < expected;
      if (op === '$ne') return !equal(actual, expected);
      if (op === '$exists') return (actual !== undefined) === expected;
      if (op === '$type') return typeof actual === expected;
      throw new Error(`Unsupported fixture operator: ${op}`);
    });
  }
  return value === null ? actual == null : equal(actual, value);
});
const apply = (doc, update) => {
  Object.assign(doc, update.$set || {});
  for (const [key, value] of Object.entries(update.$inc || {})) doc[key] = (doc[key] || 0) + value;
  for (const key of Object.keys(update.$unset || {})) delete doc[key];
  for (const [key, value] of Object.entries(update.$push || {})) {
    doc[key] ||= []; doc[key].push(...(value?.$each || [value]));
  }
  for (const [key, value] of Object.entries(update.$addToSet || {})) {
    doc[key] = [...new Set([...(doc[key] || []), ...(value?.$each || [value])])];
  }
  for (const [key, value] of Object.entries(update.$pull || {})) {
    doc[key] = (doc[key] || []).filter(item => !equal(item, value));
  }
};
let beforePasswordWrite;
const db = { collection(name) { return {
  async findOne(filter) { const doc = rows(name).find(item => matches(item, filter)); return doc ? { ...doc } : null; },
  find(filter) { const docs = rows(name).filter(item => matches(item, filter)); return {
    sort() { return this; }, limit() { return this; }, async toArray() { return docs; },
  }; },
  async insertOne(doc) { doc._id ||= new ObjectId(); rows(name).push(doc); return { insertedId: doc._id }; },
  async updateOne(filter, update) {
    if (name === 'auth' && Object.hasOwn(update.$set || {}, 'password') && beforePasswordWrite) {
      const pause = beforePasswordWrite; beforePasswordWrite = null; await pause();
    }
    const doc = rows(name).find(item => matches(item, filter));
    if (!doc) return { matchedCount: 0, modifiedCount: 0 };
    apply(doc, update); return { matchedCount: 1, modifiedCount: 1 };
  },
  async findOneAndUpdate(filter, update, options = {}) {
    let doc = rows(name).find(item => matches(item, filter));
    if (!doc && options.upsert) { doc = { ...filter, ...update.$setOnInsert }; rows(name).push(doc); }
    if (!doc) return null;
    apply(doc, update); return { ...doc };
  },
}; } };
MongoClient.prototype.db = () => db;
MongoClient.prototype.connect = async () => { throw new Error('Real database access is forbidden'); };
const admin = { _id: new ObjectId(), email: 'private-admin@example.test', role: 'admin', passwordSetupRequired: false, password: await bcrypt.hash('Admin-fixture-password', 4) };
const student = { _id: new ObjectId(), email: 'student@example.test', role: 'student', passwordSetupRequired: false, password: await bcrypt.hash('Student-fixture-password', 4) };
const firstTime = { _id: new ObjectId(), email: 'first-time@example.test', role: 'alumni', passwordSetupRequired: true };
const unset = { _id: new ObjectId(), email: 'unset@example.test', role: 'student', passwordSetupRequired: true };
const disabled = { ...student, _id: new ObjectId(), email: 'disabled@example.test', disabledAt: new Date() };
rows('auth').push(admin, student, firstTime, unset, disabled);
for (const account of rows('auth')) rows('users').push({ _id: new ObjectId(), authId: account._id, email: account.email, name: 'Fixture user', role: account.role, profileLinks: [] });
const { default: app } = await import('../src/app.js');
const { initSocket } = await import('../realtime/socket.js');
const { default: AuthModel } = await import('../modules/auth/auth.models.js');
const server = createServer(app), io = initSocket(server);
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const cookie = account => `token=${signSessionToken(account)}`;
const request = async (endpoint, { body, token, method } = {}) => {
  const res = await fetch(base + endpoint, { method: method || (body ? 'POST' : 'GET'),
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Cookie: token } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, body: await res.json(), headers: res.headers };
};
const requireClient = createRequire(new URL('../../Client/package.json', import.meta.url));
const { io: connect } = requireClient('socket.io-client');
const sockets = [];
const open = account => {
  const socket = connect(base, { autoConnect: false, transports: ['websocket'], reconnection: false,
    extraHeaders: { Origin: process.env.FRONTEND_URL, Cookie: cookie(account) } });
  sockets.push(socket); return socket;
};
const event = (socket, name) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${name}`)), 5000);
  socket.once(name, value => { clearTimeout(timer); resolve(value); });
  socket.once('connect_error', error => { clearTimeout(timer); reject(error); });
});
const checks = [];
const fixed = text => { checks.push(text); console.log(`FIXED: ${text}`); };
let release;
try {
  // Hold a stale first-setup request immediately before its actual model write.
  const originalCookie = cookie(firstTime);
  let reached;
  let pauseTimer;
  const paused = new Promise((resolve, reject) => {
    reached = () => { clearTimeout(pauseTimer); resolve(); };
    pauseTimer = setTimeout(() => reject(new Error('First-setup request did not reach the password write')), 5000);
  });
  beforePasswordWrite = async () => { reached(); await new Promise(resolve => { release = resolve; }); };
  const staleRequest = request('/api/auth/password/setup', { token: originalCookie,
    body: { newPassword: 'Stale-request-password', confirmPassword: 'Stale-request-password' } });
  await paused;
  const owner = await request('/api/auth/password/setup', { token: originalCookie,
    body: { newPassword: 'Owner-chosen-password', confirmPassword: 'Owner-chosen-password' } });
  assert.equal(owner.status, 200);
  assert.ok(await bcrypt.compare('Owner-chosen-password', firstTime.password));
  release();
  const stale = await staleRequest;
  assert.equal(stale.status, 409);
  assert.equal(stale.headers.get('set-cookie'), null);
  assert.ok(await bcrypt.compare('Owner-chosen-password', firstTime.password));
  assert.equal((await request('/api/auth/login', { body: { email: firstTime.email, password: 'Stale-request-password' } })).status, 401);
  assert.equal((await request('/api/auth/login', { body: { email: firstTime.email, password: 'Owner-chosen-password' } })).status, 200);
  const ownerToken = decodeURIComponent(owner.headers.get('set-cookie').match(/^token=([^;]+)/)[1]);
  assert.equal(verifySessionToken(ownerToken).sv, 1);
  assert.equal((await request('/api/users/me', { token: originalCookie })).status, 401);
  assert.equal((await request('/api/users/me', { token: `token=${ownerToken}` })).status, 200);
  fixed('Overlapping first-setup requests cannot overwrite the winning password or issue a stale replacement session');

  const adminSocket = open(admin); const adminInitial = event(adminSocket, 'presence:update'); adminSocket.connect(); await adminInitial;
  const studentSocket = open(student), memberPresence = [];
  studentSocket.on('presence:update', value => memberPresence.push(value));
  const snapshot = event(adminSocket, 'presence:update'), studentConnected = event(studentSocket, 'connect');
  studentSocket.connect(); await studentConnected;
  const presence = await snapshot;
  assert.ok(presence.online.some(item => item.authId === String(student._id)));
  assert.ok(presence.online.every(item => Object.keys(item).length === 1 && typeof item.authId === 'string'));
  assert.equal(JSON.stringify(presence).includes('@'), false);
  // Wait for the same broadcast round to drain on both client connections.
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.deepEqual(memberPresence, []);
  assert.equal(rows('connections').length, 0);
  fixed('Presence remains available to administrators, carries no login emails, and is not broadcast to ordinary members');

  const invalidLink = { type: 'website', url: 'javascript:alert(1)' };
  const ordinary = await request('/api/users/me', { method: 'PUT', token: cookie(student), body: { profileLinks: [invalidLink] } });
  assert.equal(ordinary.status, 400);
  const operator = await request('/api/users/me', { method: 'PUT', token: cookie(student), body: { $push: { profileLinks: { $each: Array(21).fill(invalidLink) } } } });
  assert.equal(operator.status, 400);
  for (const op of ['$addToSet', '$pull', '$set', '$unset', '$inc']) {
    assert.equal((await request('/api/users/me', { method: 'PUT', token: cookie(student), body: { [op]: { profileLinks: invalidLink } } })).status, 400);
  }
  const validLinks = Array(20).fill({ type: 'website', url: 'https://example.test' });
  assert.equal((await request('/api/users/me', { method: 'PUT', token: cookie(student), body: { profileLinks: [...validLinks, validLinks[0]] } })).status, 400);
  assert.equal((await request('/api/users/me', { method: 'PUT', token: cookie(student), body: { profileLinks: validLinks } })).status, 200);
  assert.equal(rows('users').find(item => String(item.authId) === String(student._id)).profileLinks.length, 20);
  fixed('Raw profile operators are rejected; direct link URLs and the 20-link limit are enforced');

  const profile = rows('users').find(item => String(item.authId) === String(student._id));
  assert.equal((await request('/api/users/me', { method: 'PUT', token: cookie(student), body: { addEducation: { school: 'CLSU', degree: 'BS Computer Science' } } })).status, 200);
  assert.equal(profile.education[0].school, 'CLSU');
  assert.equal((await request('/api/users/me', { method: 'PUT', token: cookie(student), body: { addSkill: { $each: ['Injected'] } } })).status, 400);
  profile.skills = Array.from({ length: 9 }, (_, i) => `Skill-${i}`);
  const skillResponses = await Promise.all(['Final-slot-A', 'Final-slot-B'].map(addSkill => request('/api/users/me', { method: 'PUT', token: cookie(student), body: { addSkill } })));
  assert.deepEqual(skillResponses.map(result => result.status).sort(), [200, 400]);
  assert.equal(profile.skills.length, 10);
  assert.equal((await request('/api/users/me', { method: 'PUT', token: cookie(student), body: { removeSkill: 'Skill-0' } })).status, 200);
  assert.equal(profile.skills.length, 9);
  fixed('Explicit education/skill actions preserve profile features and enforce the skill limit under concurrent additions');

  const missing = await request('/api/auth/login', { body: { email: 'absent@example.test', password: 'Wrong-password' } });
  for (const account of [student, unset, disabled]) {
    const known = await request('/api/auth/login', { body: { email: account.email, password: 'Wrong-password' } });
    assert.equal(known.status, missing.status);
    assert.deepEqual(known.body, missing.body);
    assert.equal(known.headers.get('set-cookie'), null);
  }
  const unknownRecovery = await request('/api/auth/forgot-password', { body: { email: 'recovery-absent@example.test' } });
  const knownRecovery = await request('/api/auth/forgot-password', { body: { email: student.email } });
  assert.deepEqual(knownRecovery.body, unknownRecovery.body);
  failMail = true;
  const failedRecovery = await request('/api/auth/forgot-password', { body: { email: admin.email } });
  assert.equal(failedRecovery.status, unknownRecovery.status);
  assert.deepEqual(failedRecovery.body, unknownRecovery.body);
  assert.equal(admin.resetOTP, null);
  failMail = false;
  fixed('Login failures and recovery responses do not reveal registered, disabled or passwordless accounts; failed delivery exposes no code');

  const logoutCookie = cookie(student), revoke = AuthModel.revokeSessionsById;
  try {
    AuthModel.revokeSessionsById = async () => { throw new Error('Simulated revocation storage failure'); };
    const failedLogout = await request('/api/auth/logout', { method: 'POST', token: logoutCookie });
    assert.equal(failedLogout.status, 503);
    assert.equal(failedLogout.body.success, false);
    assert.equal(failedLogout.headers.get('set-cookie'), null);
  } finally { AuthModel.revokeSessionsById = revoke; }
  assert.equal((await request('/api/users/me', { token: logoutCookie })).status, 200);
  const disconnected = event(studentSocket, 'disconnect');
  const successfulLogout = await request('/api/auth/logout', { method: 'POST', token: logoutCookie });
  assert.equal(successfulLogout.status, 200);
  assert.ok(successfulLogout.headers.get('set-cookie').includes('token=;'));
  await disconnected;
  assert.equal((await request('/api/users/me', { token: logoutCookie })).status, 401);
  fixed('Failed logout reports 503 and permits retry; successful retry revokes copied sessions and disconnects sockets');

  console.log(`Completed ${checks.length} follow-up regression checks covering all five findings. Real database/email/provider operations: 0.`);
} finally {
  release?.();
  for (const socket of sockets) socket.disconnect();
  await new Promise(resolve => io.close(resolve));
  if (server.listening) await new Promise(resolve => server.close(resolve));
}
