import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as connect } from '../../Client/node_modules/socket.io-client/build/esm/index.js';
import { createPresenceStore } from './presence.store.js';
import { attachPresence } from './presence.socket.js';

test('presence tracks multiple tabs and retains Busy across reconnects', () => {
  const store = createPresenceStore({ now: () => new Date('2026-11-05T08:00:00Z') });
  store.markOnline('a', 'tab-1');
  store.markOnline('a', 'tab-2');
  assert.equal(store.getStatus('a'), 'active');
  assert.equal(store.setStatus('a', 'busy'), true);
  store.markOffline('a', 'tab-1');
  assert.equal(store.getStatus('a'), 'busy');
  assert.equal(store.getLastSeen('a'), null);
  store.markOffline('a', 'tab-2');
  assert.equal(store.getStatus('a'), 'offline');
  assert.equal(store.contact('a').lastSeen, '2026-11-05T08:00:00.000Z');
  store.markOnline('a', 'tab-3');
  assert.equal(store.getStatus('a'), 'busy');
  assert.equal(store.getLastSeen('a'), null);
  assert.equal(store.setStatus('a', 'admin'), false);
  assert.equal(store.getStatus('a'), 'busy');
  const restarted = createPresenceStore();
  restarted.markOnline('a', 'new-server', 'busy');
  assert.equal(restarted.getStatus('a'), 'busy');
});

const event = (socket, name) => new Promise((resolve, reject) => {
  const timeout = setTimeout(() => { socket.off(name, done); reject(new Error(`Missing ${name}`)); }, 3000);
  function done(value) { clearTimeout(timeout); resolve(value); }
  socket.once(name, done);
});
const request = (socket, status) => new Promise((resolve, reject) =>
  socket.timeout(3000).emit('presence:set', { status }, (error, reply) => error ? reject(error) : resolve(reply)));

test('real sockets broadcast Active/Busy only to authorized watchers and sync account tabs', async t => {
  const http = createServer();
  const io = new Server(http);
  const store = createPresenceStore();
  const saved = new Map();
  const clients = [];
  io.on('connection', socket => {
    const id = socket.handshake.auth.id;
    socket.user = { _id: id, presenceStatus: saved.get(id) };
    socket.join(`user:${id}`);
    attachPresence(socket, { io, store,
      saveStatus: async (authId, status) => { saved.set(authId, status); },
      canWatch: async (user, ids) => ids.filter(id => user._id !== 'stranger' && ['a', 'b'].includes(id)),
    });
  });
  await new Promise(resolve => http.listen(0, '127.0.0.1', resolve));
  t.after(async () => { clients.forEach(client => client.disconnect()); await new Promise(resolve => io.close(resolve)); });
  const open = async id => {
    const client = connect(`http://127.0.0.1:${http.address().port}`, { auth: { id }, transports: ['websocket'], autoConnect: false });
    clients.push(client);
    const initial = event(client, 'presence:self');
    client.connect();
    const value = await initial;
    return { client, value };
  };
  const { client: a } = await open('a');
  const { client: b } = await open('b');
  const { client: stranger } = await open('stranger');
  const snapshot = event(b, 'presence:contacts');
  b.emit('presence:watch', ['a']);
  assert.deepEqual(await snapshot, [{ authId: 'a', status: 'active', lastSeen: null }]);
  const denied = event(stranger, 'presence:contacts');
  stranger.emit('presence:watch', ['a']);
  assert.deepEqual(await denied, []);
  const changed = event(b, 'presence:changed');
  assert.equal((await request(a, 'busy')).success, true);
  assert.equal((await changed).status, 'busy');
  assert.equal(saved.get('a'), 'busy');
  const { client: second, value } = await open('a');
  assert.equal(value.status, 'busy');
  const self = event(second, 'presence:self');
  assert.equal((await request(a, 'active')).success, true);
  assert.equal((await self).status, 'active');
  assert.equal((await request(a, 'invisible')).success, false);
  assert.equal(store.getStatus('a'), 'active');
  const stillOnline = event(b, 'presence:changed');
  a.disconnect();
  assert.equal((await stillOnline).status, 'active');
  const wentOffline = event(b, 'presence:changed');
  second.disconnect();
  assert.equal((await wentOffline).status, 'offline');
});

test('failed status persistence leaves the visible status unchanged', async () => {
  const listeners = new Map();
  const store = createPresenceStore();
  const socket = { id: 'a-tab', user: { _id: 'a' }, on: (name, handler) => listeners.set(name, handler) };
  const io = { to: () => ({ emit() {} }) };
  attachPresence(socket, { io, store, saveStatus: async () => { throw new Error('Database unavailable'); }, canWatch: async () => [] });
  let result;
  await listeners.get('presence:set')({ status: 'busy' }, value => { result = value; });
  assert.equal(result.success, false);
  assert.equal(store.getStatus('a'), 'active');
});
