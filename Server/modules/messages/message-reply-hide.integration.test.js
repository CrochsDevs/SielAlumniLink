import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MongoClient, ObjectId } from 'mongodb';
import { client } from '../../config/db.js';
import { createServer } from 'node:http';
import { io as socketClient } from '../../../Client/node_modules/socket.io-client/build/esm/index.js';
import { signSessionToken } from '../auth/session-token.js';

test('replies stay in the same visible conversation; hiding affects only one member', { timeout: 120000 }, async () => {
  const connection = new MongoClient(process.env.TEST_MONGO_URI || process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  const name = `Siel_reply_test_${randomUUID().replaceAll('-', '').slice(0, 20)}`;
  const db = connection.db(name), originalDb = client.db, originalKey = process.env.OPENAI_API_KEY;
  let connected = false, server, realtime;
  const sockets = [];
  try {
    await connection.connect(); connected = true;
    client.db = () => db;
    process.env.OPENAI_API_KEY = ''; // Real database, deterministic moderation provider availability.
    const { ConversationModel, MessageModel } = await import('./messages.models.js');
    const actions = await import('./messages.controllers.js');
    const users = ['a', 'b', 'c'].map(name => ({ _id: new ObjectId(), role: 'admin', email: `${name}@example.test` }));
    const [a, b, outsider] = users;
    await db.collection('auth').insertMany(users);
    await db.collection('users').insertMany(users.map(user => ({ authId: user._id, name: user.email, email: user.email })));
    const thread = await ConversationModel.getOrCreate(a._id, a.email, b._id, b.email);
    const other = await ConversationModel.getOrCreate(a._id, a.email, outsider._id, outsider.email);
    const invoke = async (action, user, body = {}, msgId) => {
      const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
      await action({ user, params: { id: String(thread._id), msgId: String(msgId || '') }, body }, res);
      return res;
    };
    const source = await MessageModel.create({ conversationId: thread._id, senderAuthId: a._id, text: 'Original message' });
    // Check the recipient's actual event as well as the sender's acknowledgement.
    process.env.JWT_SECRET ||= 'local-reply-test-secret';
    const { default: app } = await import('../../src/app.js');
    const { initSocket } = await import('../../realtime/socket.js');
    server = createServer(app);
    realtime = initSocket(server);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const user of [a, b]) {
      const socket = socketClient(origin, { autoConnect: false, transports: ['websocket'],
        extraHeaders: { Cookie: `token=${signSessionToken(user)}`, Origin: 'http://localhost:5173' } });
      sockets.push(socket);
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Chat socket did not connect')), 10000);
        socket.once('connect', () => { clearTimeout(timeout); resolve(); });
        socket.once('connect_error', error => { clearTimeout(timeout); reject(error); });
        socket.connect();
      });
    }
    const delivered = sockets.map(socket => new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Reply was not delivered over socket')), 15000);
      socket.once('message:new', payload => { clearTimeout(timeout); resolve(payload); });
    }));
    const response = await fetch(`${origin}/api/conversations/${thread._id}/messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `token=${signSessionToken(b)}`, Origin: 'http://localhost:5173' },
      body: JSON.stringify({ text: 'A reply', replyToId: String(source._id) }),
    });
    const reply = { code: response.status, body: await response.json() };
    assert.equal(reply.code, 201, reply.body.message);
    for (const payload of await Promise.all(delivered)) {
      assert.equal(payload.conversationId, String(thread._id));
      assert.equal(String(payload.message._id), String(reply.body.data._id));
      assert.equal(payload.message.replyToId, String(source._id));
      assert.equal(payload.message.text, 'A reply');
    }
    assert.equal(reply.body.data.replyToId, String(source._id));
    let history = await invoke(actions.listMessages, b);
    assert.equal(history.body.data.find(m => String(m._id) === String(reply.body.data._id)).replyPreview.text, 'Original message');
    const foreign = await MessageModel.create({ conversationId: other._id, senderAuthId: a._id, text: 'Private in another thread' });
    assert.equal((await invoke(actions.sendMessage, b, { text: 'Bad reference', replyToId: String(foreign._id) })).code, 400);
    assert.equal((await invoke(actions.sendMessage, b, { text: 'Bad ID', replyToId: { value: source._id } })).code, 400);
    assert.equal((await invoke(actions.hideMessage, outsider, {}, source._id)).code, 404);
    assert.equal((await invoke(actions.hideMessage, b, {}, source._id)).code, 200);
    assert.equal((await invoke(actions.hideMessage, b, {}, source._id)).code, 200);
    history = await invoke(actions.listMessages, b);
    assert.ok(!history.body.data.some(m => String(m._id) === String(source._id)));
    assert.deepEqual(history.body.hiddenMessageIds, [String(source._id)]);
    assert.equal(history.body.data.find(m => String(m._id) === String(reply.body.data._id)).replyPreview, null);
    const senderHistory = await invoke(actions.listMessages, a);
    assert.ok(senderHistory.body.data.some(m => String(m._id) === String(source._id)));
    assert.equal(senderHistory.body.data.find(m => String(m._id) === String(reply.body.data._id)).replyPreview.text, 'Original message');
    assert.equal((await invoke(actions.sendMessage, b, { text: 'Hidden source', replyToId: String(source._id) })).code, 400);
    assert.equal(await MessageModel.latestIncoming(thread._id, b._id), null);
    assert.equal(await MessageModel.unreadCount(thread._id, b._id), 0);
    await MessageModel.unsendMessage(source._id, a._id);
    assert.equal((await invoke(actions.listMessages, a)).body.data.find(m => String(m._id) === String(reply.body.data._id)).replyPreview, null);
  } finally {
    sockets.forEach(socket => socket.disconnect());
    if (realtime) await new Promise(resolve => realtime.close(resolve));
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    client.db = originalDb;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey;
    try { if (connected && db.databaseName === name && name.startsWith('Siel_reply_test_')) await db.dropDatabase(); }
    finally { await connection.close(); await client.close(); }
  }
});
