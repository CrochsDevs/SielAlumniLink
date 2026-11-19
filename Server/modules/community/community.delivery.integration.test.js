import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { MongoClient, ObjectId } from 'mongodb';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { client } from '../../config/db.js';
import { signSessionToken } from '../auth/session-token.js';
import { ensureCommunityIndexes } from './community.service.js';
import { ensureFeedIndexes } from '../feed/feed.service.js';
import { io as socketClient } from '../../../Client/node_modules/socket.io-client/build/esm/index.js';

test('real HTTP cookies and sockets: restriction enforcement cannot be bypassed in delivery endpoints', { timeout: 120000 }, async () => {
  const connection = new MongoClient(process.env.TEST_MONGO_URI || process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  const name = `cmd_${randomUUID().replaceAll('-', '')}`, db = connection.db(name), originalDb = client.db;
  const originalKey = process.env.OPENAI_API_KEY;
  let server, realtime, socket;
  try {
    await connection.connect(); await ensureCommunityIndexes(db); await ensureFeedIndexes(db);
    client.db = () => db; process.env.OPENAI_API_KEY = ''; process.env.JWT_SECRET ||= 'local-moderation-test-secret';
    const a = { _id: new ObjectId(), name: 'A', role: 'alumni', email: 'a@example.test' };
    const b = { _id: new ObjectId(), name: 'B', role: 'alumni', email: 'b@example.test' };
    const admin = { _id: new ObjectId(), name: 'Admin', role: 'admin', email: 'admin@example.test' };
    await db.collection('auth').insertMany([a, b, admin]);
    await db.collection('users').insertMany([a, b, admin].map(user => ({ authId: String(user._id), name: user.name, email: user.email })));
    await db.collection('connections').insertOne({ requesterAuthId: a._id, recipientAuthId: b._id, requesterEmail: a.email, recipientEmail: b.email, status: 'accepted' });
    const { default: app } = await import('../../src/app.js');
    const { initSocket } = await import('../../realtime/socket.js');
    const { ConversationModel } = await import('../messages/messages.models.js');
    const conversation = await ConversationModel.getOrCreate(a._id, a.email, b._id, b.email);
    server = createServer(app); realtime = initSocket(server);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const request = async (actor, method, path, body) => {
      const response = await fetch(origin + '/api' + path, { method, headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173', ...(actor ? { Cookie: `token=${signSessionToken(actor)}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, body: await response.json() };
    };
    assert.equal((await request(null, 'GET', '/community/me')).status, 401);
    assert.equal((await request(a, 'GET', '/community/admin/stats')).status, 403);
    const normal = await request(a, 'POST', '/feed', { body: 'Normal alumni announcement over authenticated HTTP' });
    assert.equal(normal.status, 201, normal.body.message);
    assert.equal((await request(a, 'POST', `/conversations/${conversation._id}/messages`, { text: 'Normal connected message' })).status, 201);
    const caseId = new ObjectId(), time = new Date();
    await db.collection('community_cases').insertOne({ _id: caseId, userId: String(a._id), type: 'post', targetId: String(normal.body.data._id), category: 'spam', severity: 'medium', detection: 'user_report', status: 'pending', explanation: 'Case fixture', createdAt: time, updatedAt: time, history: [] });
    assert.equal((await request(admin, 'PATCH', `/community/admin/cases/${caseId}`, { status: 'under_review', notes: 'Reviewing evidence' })).status, 200);
    assert.equal((await request(admin, 'PATCH', `/community/admin/cases/${caseId}`, { status: 'confirmed', notes: 'Confirmed repeated spam', level: 3, durationDays: 1 })).status, 200);
    for (const [path, body] of [['/feed', { body: 'Attempt to bypass posting restriction' }], [`/conversations/${conversation._id}/messages`, { text: 'Attempt to bypass messaging restriction' }], ['/connections', { recipientAuthId: String(admin._id), role: 'admin', userId: String(admin._id) }]]) {
      const response = await request(a, 'POST', path, body); assert.equal(response.status, 403, response.body.message); assert.equal(response.body.code, 'COMMUNITY_RESTRICTED'); assert.ok(response.body.restriction.expiresAt); assert.equal(response.body.appealUrl, '/community-status');
    }
    assert.equal((await request(a, 'GET', '/feed')).status, 200);
    socket = socketClient(origin, { transports: ['websocket'], reconnection: false, extraHeaders: { Cookie: `token=${signSessionToken(a)}`, Origin: 'http://localhost:5173' } });
    await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
    const blocked = new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('Restricted socket event was not rejected')), 5000); socket.once('community:restricted', data => { clearTimeout(timer); resolve(data); }); });
    socket.emit('call:signal', { toAuthId: String(b._id), kind: 'invite', data: {} });
    assert.equal((await blocked).code, 'COMMUNITY_RESTRICTED'); socket.disconnect();
    const changed = await request(admin, 'POST', `/community/admin/cases/${caseId}/restrictions`, { notes: 'Administrator authorized full restriction', level: 4, durationDays: 1 });
    assert.equal(changed.status, 200, changed.body.message);
    assert.equal((await request(a, 'GET', '/feed')).status, 403);
    assert.equal((await request(a, 'GET', '/community/me')).status, 200);
    assert.equal((await request(a, 'GET', '/users/me')).status, 200);
    assert.equal((await request(b, 'POST', `/conversations/${conversation._id}/messages`, { text: 'Recipient must not receive this' })).status, 403);
    assert.equal((await request(a, 'POST', `/community/cases/${caseId}/appeals`, { explanation: 'Please reconsider the evidence.' })).status, 200);
    assert.equal((await request(admin, 'PATCH', `/community/admin/appeals/${caseId}`, { status: 'under_review', notes: 'Reviewing appeal' })).status, 200);
    assert.equal((await request(admin, 'PATCH', `/community/admin/appeals/${caseId}`, { status: 'approved', notes: 'Incorrect decision overturned' })).status, 200);
    assert.equal((await request(a, 'POST', `/conversations/${conversation._id}/messages`, { text: 'Messaging restored after appeal' })).status, 201);
    assert.equal((await request(a, 'POST', '/feed', { body: 'Posting restored after appeal' })).status, 201);
    assert.equal(await db.collection('messages').countDocuments({ text: 'Recipient must not receive this' }), 0);
  } finally {
    socket?.disconnect();
    if (realtime) await new Promise(resolve => realtime.close(resolve));
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    client.db = originalDb;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey;
    if (/^cmd_[a-f0-9]{32}$/.test(name)) await db.dropDatabase().catch(() => {});
    await connection.close();
  }
});
