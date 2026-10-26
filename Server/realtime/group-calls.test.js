import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as connect } from '../../Client/node_modules/socket.io-client/build/esm/index.js';
import { createGroupCallRuntime, GROUP_CALL_LIMIT } from './group-calls.js';

async function fixture(t) {
  const http = createServer(), io = new Server(http);
  const members = new Set(Array.from({ length: 12 }, (_, index) => `user${index}`));
  const records = [], notices = [];
  const runtime = createGroupCallRuntime(io, {
    authorize: async (_user, id) => id === 'group' ? { isGroup: true, name: 'Alumni group', participants: [...members].map(authId => ({ authId })) } : null,
    emitToUser: (...args) => notices.push(args),
    record: async call => records.push(call),
  });
  io.on('connection', socket => { socket.user = { _id: socket.handshake.auth.id, email: `${socket.handshake.auth.id}@example.test` }; runtime.attach(socket); });
  await new Promise(resolve => http.listen(0, '127.0.0.1', resolve));
  const sockets = [];
  t.after(async () => { sockets.forEach(socket => socket.disconnect()); await new Promise(resolve => io.close(resolve)); });
  const client = async id => {
    const socket = connect(`http://127.0.0.1:${http.address().port}`, { auth: { id }, transports: ['websocket'], forceNew: true });
    sockets.push(socket);
    await new Promise(resolve => socket.once('connect', resolve));
    return socket;
  };
  const request = (socket, event, input = {}) => new Promise((resolve, reject) => socket.timeout(2000).emit(`group-call:${event}`, input, (error, response) => error ? reject(error) : resolve(response)));
  return { client, request, members, runtime, records, notices };
}

test('group members start, join, signal, leave and record one shared call', async t => {
  const f = await fixture(t), a = await f.client('user0'), b = await f.client('user1'), c = await f.client('user2');
  const first = await f.request(a, 'join', { conversationId: 'group', kind: 'video' });
  assert.equal(first.success, true);
  assert.equal(f.notices.filter(([, event]) => event === 'group-call:invite').length, 11);
  const second = await f.request(b, 'join', { conversationId: 'group' });
  assert.equal(second.data.peers.length, 1);
  const third = await f.request(c, 'join', { conversationId: 'group' });
  assert.equal(third.data.peers.length, 2);
  const signal = new Promise(resolve => b.once('group-call:signal', resolve));
  a.emit('group-call:signal', { to: b.id, description: { type: 'offer', sdp: 'fixture' }, unwanted: 'ignored' });
  assert.equal((await signal).description.sdp, 'fixture');
  await f.request(a, 'leave');
  assert.equal((await f.request(b, 'inspect', { conversationId: 'group' })).data.count, 2, 'starter leaving keeps other members connected');
  await f.request(b, 'leave'); await f.request(c, 'leave');
  assert.equal(f.records.length, 1);
  assert.equal(f.records[0].kind, 'video');
  assert.equal((await f.request(a, 'inspect', { conversationId: 'group' })).data.active, false);
});

test('nonmembers, direct messages, duplicate tabs and full calls cannot join', async t => {
  const f = await fixture(t), outsider = await f.client('outsider');
  assert.equal((await f.request(outsider, 'join', { conversationId: 'group' })).success, false);
  const a = await f.client('user0');
  assert.equal((await f.request(a, 'join', { conversationId: 'direct' })).success, false);
  assert.equal((await f.request(a, 'join', { conversationId: 'group' })).success, true);
  const duplicate = await f.client('user0');
  assert.equal((await f.request(duplicate, 'join', { conversationId: 'group' })).success, false);
  for (let index = 1; index < GROUP_CALL_LIMIT; index++) assert.equal((await f.request(await f.client(`user${index}`), 'join', { conversationId: 'group' })).success, true);
  assert.equal((await f.request(await f.client('user9'), 'join', { conversationId: 'group' })).success, false);
});

test('removed members lose call access and cannot rejoin or relay signaling', async t => {
  const f = await fixture(t), a = await f.client('user0'), b = await f.client('user1');
  await f.request(a, 'join', { conversationId: 'group' }); await f.request(b, 'join', { conversationId: 'group' });
  const removed = new Promise(resolve => b.once('group-call:ended', resolve));
  f.members.delete('user1');
  await f.runtime.removeMember('group', 'user1');
  assert.match((await removed).reason, /no longer a member/);
  assert.equal((await f.request(b, 'join', { conversationId: 'group' })).success, false);
  assert.equal((await f.request(b, 'status', { mic: true })).success, false);
  assert.equal((await f.request(a, 'inspect', { conversationId: 'group' })).data.count, 1);
  await f.request(a, 'leave');
});

test('disconnect removes peers and closes an empty call', async t => {
  const f = await fixture(t), a = await f.client('user0'), b = await f.client('user1');
  await f.request(a, 'join', { conversationId: 'group' }); await f.request(b, 'join', { conversationId: 'group' });
  const left = new Promise(resolve => a.once('group-call:peer-left', resolve));
  b.disconnect(); await left;
  assert.equal((await f.request(a, 'inspect', { conversationId: 'group' })).data.count, 1);
  await f.request(a, 'leave');
  assert.equal(f.records.length, 1);
});
