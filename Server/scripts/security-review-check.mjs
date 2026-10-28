// Isolated regression diagnostic for the 2026-10-28 security review.
// No real DB/mail/provider calls.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { signSessionToken } from '../modules/auth/session-token.js';

process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/security_review_fixture';
process.env.JWT_SECRET = randomBytes(48).toString('hex');
process.env.NODE_ENV = 'production';
process.env.FRONTEND_URL = 'https://alumnilink.example';
process.env.DOTENV_CONFIG_QUIET = 'true';
let mailFails = false;
nodemailer.createTransport = () => ({ sendMail: async message => {
  if (mailFails) throw new Error(`Simulated SMTP failure: ${message.text}`);
} });

const records = new Map();
const rows = name => {
  if (!records.has(name)) records.set(name, []);
  return records.get(name);
};
const equal = (a, b) => a instanceof ObjectId || b instanceof ObjectId
  ? String(a) === String(b) : a === b;
const matches = (doc, filter) => Object.entries(filter).every(([key, expected]) => {
  if (key === '$or') return expected.some(part => matches(doc, part));
  if (key === '$and') return expected.every(part => matches(doc, part));
  const actual = key.split('.').reduce((value, field) => value?.[field], doc);
  if (expected && typeof expected === 'object' && !(expected instanceof ObjectId) && !(expected instanceof Date)) {
    return Object.entries(expected).every(([op, value]) => {
      if (op === '$in') return value.some(item => equal(actual, item));
      if (op === '$ne') return value === null ? actual != null : !equal(actual, value);
      if (op === '$gt') return actual > value;
      if (op === '$lt') return actual < value;
      if (op === '$exists') return (actual !== undefined) === value;
      if (op === '$type') return typeof actual === value;
      throw new Error(`Unsupported fixture operator: ${op}`);
    });
  }
  return expected === null ? actual == null : equal(actual, expected);
});
const applyUpdate = (doc, update) => {
  Object.assign(doc, update.$set || {});
  for (const [field, value] of Object.entries(update.$inc || {})) doc[field] = (doc[field] || 0) + value;
  for (const field of Object.keys(update.$unset || {})) delete doc[field];
  for (const [field, value] of Object.entries(update.$push || {})) {
    doc[field] ||= [];
    doc[field].push(...(value?.$each || [value]));
  }
};
const db = { collection(name) {
  return {
    async findOne(filter) { const doc = rows(name).find(doc => matches(doc, filter)); return doc ? { ...doc } : null; },
    find(filter) {
      const selected = rows(name).filter(doc => matches(doc, filter));
      const cursor = { sort() { return this; }, limit() { return this; },
        async toArray() { return selected; } };
      return cursor;
    },
    async insertOne(doc) {
      doc._id ||= new ObjectId(); rows(name).push(doc);
      return { insertedId: doc._id };
    },
    async updateOne(filter, update) {
      const doc = rows(name).find(item => matches(item, filter));
      if (!doc) return { matchedCount: 0, modifiedCount: 0 };
      applyUpdate(doc, update);
      return { matchedCount: 1, modifiedCount: 1 };
    },
    async deleteOne(filter) {
      const index = rows(name).findIndex(doc => matches(doc, filter));
      if (index === -1) return { deletedCount: 0 };
      rows(name).splice(index, 1); return { deletedCount: 1 };
    },
    async deleteMany(filter) {
      const before = rows(name).length;
      records.set(name, rows(name).filter(doc => !matches(doc, filter)));
      return { deletedCount: before - rows(name).length };
    },
    async findOneAndUpdate(filter, update, options = {}) {
      let doc = rows(name).find(item => matches(item, filter));
      if (!doc && options.upsert) { doc = { ...filter, ...update.$setOnInsert }; rows(name).push(doc); }
      if (doc) applyUpdate(doc, update);
      return doc ? { ...doc } : null;
    },
  };
} };
MongoClient.prototype.db = () => db;
MongoClient.prototype.connect = async () => { throw new Error('Real DB access is forbidden in this diagnostic'); };

const admin = { _id: new ObjectId(), email: 'admin@example.test', role: 'admin',
  password: await bcrypt.hash('Fixture-password-1', 4), passwordSetupRequired: false,
  resetOTP: '654321', resetOTPExpires: new Date(Date.now() + 600000) };
const student = { _id: new ObjectId(), email: 'student@example.test', role: 'student',
  password: await bcrypt.hash('Fixture-password-2', 4), passwordSetupRequired: false };
rows('auth').push(admin, student);
const adminProfile = { _id: new ObjectId(), authId: admin._id, email: admin.email,
  name: 'Fixture Administrator', role: 'admin', contactNumber: 'PRIVATE-FIXTURE-PHONE',
  studentId: 'PRIVATE-FIXTURE-STUDENT-ID', internalOnly: 'PRIVATE-FIXTURE-FIELD' };
const studentProfile = { _id: new ObjectId(), authId: student._id, email: student.email,
  name: 'Fixture Student', role: 'student' };
rows('users').push(adminProfile, studentProfile);
const { default: app } = await import('../src/app.js');
const server = createServer(app);
const { initSocket } = await import('../realtime/socket.js');
const io = initSocket(server);
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const fixes = [];
const fixed = message => { fixes.push(message); console.log(`FIXED: ${message}`); };
const request = async (path, { body, cookie, method } = {}) => {
  const response = await fetch(base + path, {
    method: method || (body ? 'POST' : 'GET'),
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json(), headers: response.headers };
};
const session = user => `token=${signSessionToken(user)}`;
const clientRequire = createRequire(new URL('../../Client/package.json', import.meta.url));
const { io: connect } = clientRequire('socket.io-client');
const openSocket = cookie => connect(base, { transports: ['websocket'], reconnection: false,
  extraHeaders: { Origin: process.env.FRONTEND_URL, Cookie: cookie } });
const connected = socket => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Socket connection timed out')), 5000);
  socket.once('connect', () => { clearTimeout(timer); resolve(); });
  socket.once('connect_error', error => { clearTimeout(timer); reject(error); });
});
let socket;
try {
  const injected = await request('/api/auth/verify-otp', { body: { email: admin.email, otp: { $ne: null } } });
  assert.equal(injected.status, 400);
  assert.equal(injected.body.data, undefined);
  fixed('OTP MongoDB operator injection is rejected without issuing a reset token');

  const legitimate = await request('/api/auth/verify-otp', { body: { email: admin.email, otp: admin.resetOTP } });
  assert.equal(legitimate.status, 200);
  const token = legitimate.body.data.resetToken;
  const promoted = await request('/api/users/me', { cookie: `token=${token}` });
  assert.equal(promoted.status, 401);
  const optionalSession = await request('/api/auth/me', { cookie: `token=${token}` });
  assert.equal(optionalSession.body.data, null);
  const legacyReset = jwt.sign({ email: admin.email }, process.env.JWT_SECRET, { expiresIn: '10m' });
  assert.equal((await request('/api/users/me', { cookie: `token=${legacyReset}` })).status, 401);
  fixed('Reset credentials and legacy reset JWTs cannot authenticate through HTTP session guards');

  const oldSession = session(admin);
  socket = openSocket(oldSession);
  await connected(socket);
  const revoked = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Password recovery did not disconnect socket')), 5000);
    socket.once('disconnect', () => { clearTimeout(timer); resolve(); });
  });
  const reset = await request('/api/auth/reset-password', { body: { token, newPassword: 'New-fixture-password-1' } });
  assert.equal(reset.status, 200);
  assert.ok(await bcrypt.compare('New-fixture-password-1', admin.password));
  await revoked;
  const replay = await request('/api/auth/reset-password', { body: { token, newPassword: 'New-fixture-password-2' } });
  assert.equal(replay.status, 401);
  fixed('Reset token replay is rejected after a successful password reset');

  const sessionAsReset = await request('/api/auth/reset-password', { body: { token: oldSession.slice(6), newPassword: 'New-fixture-password-3' } });
  assert.equal(sessionAsReset.status, 401);
  fixed('Login session JWT cannot be used to reset a password');

  const stillLoggedIn = await request('/api/users/me', { cookie: oldSession });
  assert.equal(stillLoggedIn.status, 401);
  fixed('Password recovery revokes previous HTTP sessions and disconnects an active WebSocket');

  // The SMTP failure branch must never expose this secret, including in production.
  mailFails = true;
  const savedLog = console.log, savedError = console.error;
  const deliveryLogs = [];
  let disclosure;
  try {
    console.log = (...args) => deliveryLogs.push(args.join(' '));
    console.error = (...args) => deliveryLogs.push(args.join(' '));
    disclosure = await request('/api/auth/forgot-password', { body: { email: admin.email } });
  } finally { console.log = savedLog; console.error = savedError; mailFails = false; }
  assert.equal(disclosure.status, 200);
  assert.equal(disclosure.body.success, true);
  assert.equal(Object.hasOwn(disclosure.body, 'devOTP'), false);
  assert.equal(admin.resetOTP, null);
  assert.equal(admin.resetOTPExpires, null);
  assert.equal(deliveryLogs.join('\n').includes('Simulated SMTP failure:'), false);
  fixed('Production SMTP failure returns no OTP, logs no provider secrets and invalidates the failed challenge');

  const authCountBeforeSignup = rows('auth').length;
  const profileCountBeforeSignup = rows('users').length;
  const signup = await request('/api/auth/signup', { body: {
    name: 'Unverified outsider', email: 'unregistered@example.test', password: 'Fixture-password-4', role: 'alumni',
  } });
  assert.equal(signup.status, 403);
  assert.equal(signup.headers.get('set-cookie'), null);
  assert.equal(rows('auth').length, authCountBeforeSignup);
  assert.equal(rows('users').length, profileCountBeforeSignup);
  fixed('Public signup is rejected without creating an identity/profile or issuing a session');

  const pendingStudent = { _id: new ObjectId(), name: 'Imported student without auth',
    email: 'pending-student@example.test', role: 'student' };
  rows('users').push(pendingStudent);
  const activate = await request('/api/auth/magic-link/send', { body: { email: pendingStudent.email } });
  assert.equal(activate.status, 200);
  assert.equal(rows('auth').find(account => account.email === pendingStudent.email).role, 'student');
  fixed('First activation preserves the imported student role');

  const directory = await request('/api/users', { cookie: session(student) });
  assert.equal(directory.status, 200);
  const publicAdmin = directory.body.data.find(profile => profile.authId === String(admin._id));
  for (const field of ['email', 'internalOnly', 'contactNumber', 'studentId']) assert.equal(Object.hasOwn(publicAdmin, field), false);
  const publicProfile = await request(`/api/users/${adminProfile._id}`, { cookie: session(student) });
  assert.equal(publicProfile.body.data.email, undefined);
  assert.equal(publicProfile.body.data.internalOnly, undefined);
  fixed('Member directory and profile responses omit login emails, private data and internal metadata');

  const staleStudent = session(student);
  const deletion = await request(`/api/users/${studentProfile._id}`, { method: 'DELETE', cookie: session(admin) });
  assert.equal(deletion.status, 200);
  assert.ok(rows('auth').includes(student));
  assert.ok(student.disabledAt);
  const deletedLogin = await request('/api/auth/login', { body: { email: student.email, password: 'Fixture-password-2' } });
  assert.equal(deletedLogin.status, 401);
  assert.equal((await request('/api/users/me', { cookie: staleStudent })).status, 401);
  assert.equal(student.password, undefined);
  fixed('Deleting a profile disables its login and rejects its old session');

  const failures = [];
  for (let attempt = 0; attempt < 30; attempt++) {
    failures.push((await request('/api/auth/verify-otp', { body: { email: admin.email, otp: '000000' } })).status);
  }
  assert.ok(failures.includes(429));
  const otpTarget = { _id: new ObjectId(), email: 'otp-budget@example.test', role: 'student', password: 'fixture-hash', passwordSetupRequired: false,
    resetOTP: '888888', resetOTPExpires: new Date(Date.now() + 600000), resetOTPAttempts: 0 };
  rows('auth').push(otpTarget);
  for (let attempt = 0; attempt < 5; attempt++) assert.equal((await request('/api/auth/verify-otp', { body: { email: otpTarget.email, otp: '000000' } })).status, 400);
  assert.equal((await request('/api/auth/verify-otp', { body: { email: otpTarget.email, otp: '888888' } })).status, 400);
  assert.equal(otpTarget.resetOTPAttempts, 5);
  const cooldown = await request('/api/auth/forgot-password', { body: { email: admin.email } });
  assert.equal(cooldown.status, 429); assert.ok(cooldown.headers.get('retry-after'));
  fixed('Repeated recovery requests are throttled; a challenge locks after five guesses; resend cooldown applies');

  for (const badToken of [token, legacyReset]) {
    const deniedSocket = connect(base, { transports: ['websocket'], reconnection: false,
      extraHeaders: { Origin: process.env.FRONTEND_URL, Cookie: `token=${badToken}` } });
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Socket rejection diagnostic timed out')), 5000);
        deniedSocket.once('connect', () => { clearTimeout(timer); reject(new Error('Recovery token authenticated a socket')); });
        deniedSocket.once('connect_error', () => { clearTimeout(timer); resolve(); });
      });
    } finally { deniedSocket.disconnect(); }
  }
  fixed('Reset credentials and legacy reset JWTs cannot authenticate a WebSocket');
  for (const origin of ['https://untrusted.example', 'null', undefined]) {
    const foreign = connect(base, { transports: ['websocket'], reconnection: false,
      extraHeaders: { ...(origin ? { Origin: origin } : {}), Cookie: session(admin) } });
    await assert.rejects(connected(foreign)); foreign.disconnect();
  }
  socket = openSocket(session(admin)); await connected(socket);
  fixed('WebSocket handshake rejects foreign/null/missing Origins and accepts the configured frontend');

  console.log(`Completed ${fixes.length} verified security behaviors; all ten reviewed findings are covered. Real database/mail/provider operations: 0.`);
} finally {
  socket?.disconnect();
  await new Promise(resolve => io.close(resolve));
  if (server.listening) await new Promise(resolve => server.close(resolve));
}
