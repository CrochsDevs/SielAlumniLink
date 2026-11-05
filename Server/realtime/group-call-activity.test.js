import test from 'node:test';
import assert from 'node:assert/strict';
import { createGroupCallJoinRecorder } from './group-call-activity.js';

test('joining a group call persists a message and broadcasts the saved activity to group members', async () => {
  const saved = [], broadcasts = [], touched = [];
  const createdAt = new Date('2026-11-05T08:00:00Z');
  const record = createGroupCallJoinRecorder({
    conversations: {
      findById: async () => ({ isGroup: true, participants: [{ authId: 'lester' }, { authId: 'leanne' }] }),
      touch: async (...args) => touched.push(args),
    },
    messages: { create: async message => { saved.push(message); return { ...message, _id: 'saved-message', createdAt }; } },
    senders: async () => new Map([['lester', { senderName: 'Lester', senderProfilePicture: 'profile.jpg' }]]),
    emit: (...args) => broadcasts.push(args),
  });
  await record({ conversationId: 'group', callId: 'call', kind: 'voice', member: { _id: 'lester', email: 'lester@example.test' }, name: 'Lester' });
  assert.equal(saved.length, 1);
  assert.equal(saved[0].text, 'Lester joined the call');
  assert.deepEqual(saved[0].call, { id: 'call', kind: 'voice', group: true, status: 'joined', event: 'joined', actorName: 'Lester' });
  assert.deepEqual(broadcasts.map(([id]) => id), ['lester', 'leanne']);
  assert.ok(broadcasts.every(([, event, payload]) => event === 'message:new' && payload.message._id === 'saved-message' && payload.message.at === createdAt));
  assert.equal(broadcasts[0][2].message.senderName, 'Lester');
  assert.equal(touched[0][1].text, 'Lester joined the call');
});

test('a removed member or missing group cannot create call activity', async () => {
  for (const group of [null, { isGroup: false, participants: [] }, { isGroup: true, participants: [{ authId: 'someone-else' }] }]) {
    const record = createGroupCallJoinRecorder({ conversations: { findById: async () => group },
      messages: { create: () => assert.fail('No activity should be created') }, emit: () => assert.fail('No activity should be broadcast') });
    await record({ conversationId: 'group', member: { _id: 'removed' }, name: 'Removed' });
  }
});
