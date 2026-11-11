import test from 'node:test';
import assert from 'node:assert/strict';
import { createFeedMessaging } from './feed-messaging.js';

function fixture() {
  const user = { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', email: 'sender@example.test' };
  const person = { authId: 'bbbbbbbbbbbbbbbbbbbbbbbb', email: 'friend@example.test', name: 'Bea' };
  const group = { _id: 'cccccccccccccccccccccccc', isGroup: true, name: 'Project group', participants: [{ authId: user._id }, { authId: person.authId }, { authId: 'third' }] };
  const direct = { _id: 'dddddddddddddddddddddddd', participants: group.participants.slice(0, 2) };
  const saved = [], broadcasts = [], touched = [];
  const feed = {
    async get() { return { _id: 'post', body: 'Protected post content' }; },
    async recipients() { return [person]; },
  };
  const conversations = {
    async findMine() { return [group, direct]; },
    async findById(id) { return [group, direct].find(item => item._id === id) || null; },
    async getOrCreate() { return direct; },
    async touch(...args) { touched.push(args); },
  };
  const service = createFeedMessaging({ feed, conversations,
    messages: { async create(message) { const result = { ...message, _id: 'message', createdAt: new Date() }; saved.push(result); return result; } },
    senders: async () => new Map([[user._id, { senderAuthId: user._id, senderName: 'Alex' }]]),
    emit: (...args) => broadcasts.push(args), origin: 'https://alumni.example.test',
  });
  return { user, person, group, direct, feed, service, saved, broadcasts, touched };
}

test('recipient picker includes connected alumni and the sender’s group chats', async () => {
  const { service, user, person, group } = fixture();
  assert.deepEqual(await service.recipients(user, 'post'), [person, {
    conversationId: group._id, isGroup: true, name: group.name, memberCount: 3,
  }]);
});

test('sharing to a group saves only a link and broadcasts it to all current members', async () => {
  const { service, user, group, saved, broadcasts, touched } = fixture();
  const result = await service.send(user, 'post', { conversationId: group._id });
  assert.deepEqual(result, { conversationId: group._id });
  assert.equal(saved.length, 1);
  assert.equal(saved[0].text, 'Shared a post: https://alumni.example.test/feed?post=post');
  assert.equal(saved[0].body, undefined);
  assert.equal(saved[0].conversationId, group._id);
  assert.deepEqual(broadcasts.map(([id]) => id), group.participants.map(member => member.authId));
  assert.ok(broadcasts.every(([, event, payload]) => event === 'message:new' && payload.message._id === 'message' && payload.message.senderName === 'Alex'));
  assert.equal(touched[0][1].text, saved[0].text);
});

test('a removed member, outsider, direct chat ID, or invalid group ID cannot send to a group', async () => {
  const { service, user, group, direct, saved, broadcasts } = fixture();
  for (const conversationId of [null, {}, 'bad', 'eeeeeeeeeeeeeeeeeeeeeeee', direct._id]) {
    await assert.rejects(service.send(user, 'post', { conversationId }), error => [400, 404].includes(error.status));
  }
  group.participants = group.participants.filter(member => member.authId !== user._id);
  await assert.rejects(service.send(user, 'post', { conversationId: group._id }), error => error.status === 404);
  assert.equal(saved.length, 0);
  assert.equal(broadcasts.length, 0);
});

test('inaccessible posts cannot be sent and ambiguous recipients are rejected', async () => {
  const { service, user, group, feed, saved } = fixture();
  await assert.rejects(service.send(user, 'post', { conversationId: group._id, recipientAuthId: 'someone' }), error => error.status === 400);
  feed.get = async () => { throw Object.assign(new Error('Post not found'), { status: 404 }); };
  await assert.rejects(service.send(user, 'post', { conversationId: group._id }), error => error.status === 404);
  assert.equal(saved.length, 0);
});

test('direct sharing keeps the connection permission gate and opens the same direct conversation', async () => {
  const { service, user, person, direct, saved, broadcasts } = fixture();
  await assert.rejects(service.send(user, 'post', { recipientAuthId: 'outsider' }), error => error.status === 403);
  assert.deepEqual(await service.send(user, 'post', { recipientAuthId: person.authId }), { conversationId: direct._id, recipientEmail: person.email });
  assert.equal(saved.length, 1);
  assert.equal(broadcasts.length, 2);
});
