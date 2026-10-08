import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import jwt from 'jsonwebtoken';
import { io as connect } from '../../Client/node_modules/socket.io-client/build/esm/index.js';
import AuthModel from '../modules/auth/auth.models.js';
import UserModel from '../modules/users/users.models.js';
import ConnectionModel from '../modules/connections/connections.models.js';
import NotificationModel from '../modules/notifications/notifications.models.js';

// Local socket server with isolated identity/database stubs; no application records are changed.
process.env.JWT_SECRET = 'isolated-connection-websocket-test';
const { initSocket } = await import('./socket.js');
const { createConnection, updateConnection, deleteConnection } = await import('../modules/connections/connections.controllers.js');
const admin = { _id: '000000000000000000000001', email: 'admin@example.test', role: 'admin' };
const member = { _id: '000000000000000000000002', email: 'member@example.test', role: 'alumni' };
const target = { _id: '000000000000000000000003', email: 'target@example.test', role: 'student' };
const record = { _id: '000000000000000000000004', requesterAuthId: member._id, recipientAuthId: target._id, requesterEmail: member.email, recipientEmail: target.email, status: 'pending' };
const restore = [];
function stub(object, method, implementation) { const original = object[method]; object[method] = implementation; restore.push(() => { object[method] = original; }); }
let http, socketServer, adminSocket, memberSocket, url;
let memberEvents = 0;
let writes = 0;
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
const nextEvent = socket => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Missing connection update event')), 2000);
  socket.once('connections:changed', data => { clearTimeout(timer); resolve(data); });
});
before(async () => {
  stub(AuthModel, 'findByEmail', async email => [admin, member, target].find(user => user.email === email));
  stub(AuthModel, 'findById', async () => target);
  stub(UserModel, 'findByEmail', async () => ({ name: 'Member' }));
  stub(NotificationModel, 'notify', async () => {});
  stub(ConnectionModel, 'request', async () => ({ ...record }));
  stub(ConnectionModel, 'findById', async () => ({ ...record }));
  stub(ConnectionModel, 'updateStatus', async (_id, status) => { writes++; return { ...record, status }; });
  stub(ConnectionModel, 'deleteById', async () => true);
  http = createServer();
  socketServer = initSocket(http);
  http.listen(0, '127.0.0.1');
  await once(http, 'listening');
  url = `http://127.0.0.1:${http.address().port}`;
  const client = user => connect(url, { transports: ['websocket'], reconnection: false,
    extraHeaders: { cookie: `token=${jwt.sign({ email: user.email }, process.env.JWT_SECRET)}` } });
  adminSocket = client(admin);
  memberSocket = client(member);
  memberSocket.on('connections:changed', () => memberEvents++);
  await Promise.all([once(adminSocket, 'connect'), once(memberSocket, 'connect')]);
});
after(async () => {
  adminSocket?.disconnect(); memberSocket?.disconnect();
  if (socketServer) await new Promise(resolve => socketServer.close(resolve));
  restore.reverse().forEach(fn => fn());
});

test('creation, status changes and deletion notify admins through real WebSocket transport', async () => {
  for (const [handler, req] of [
    [createConnection, { user: member, body: { recipientAuthId: target._id } }],
    [updateConnection, { user: target, body: { status: 'accepted' }, params: { id: record._id } }],
    [updateConnection, { user: target, body: { status: 'declined' }, params: { id: record._id } }],
    [deleteConnection, { user: admin, params: { id: record._id } }],
  ]) {
    const pending = nextEvent(adminSocket);
    const res = response();
    await handler(req, res);
    assert.ok(res.code < 300);
    assert.deepEqual(await pending, { authIds: [member._id, target._id] });
  }
  assert.equal(memberEvents, 0);
});

test('unrelated users cannot change a connection before authorization', async () => {
  const beforeWrites = writes;
  const res = response();
  await updateConnection({ user: { _id: 'outsider', role: 'alumni' }, body: { status: 'accepted' }, params: { id: record._id } }, res);
  assert.equal(res.code, 403);
  assert.equal(writes, beforeWrites);
});

test('unauthenticated WebSocket clients are rejected', async () => {
  const guest = connect(url, { transports: ['websocket'], reconnection: false });
  try { const [error] = await once(guest, 'connect_error'); assert.match(error.message, /auth token/i); }
  finally { guest.disconnect(); }
});
