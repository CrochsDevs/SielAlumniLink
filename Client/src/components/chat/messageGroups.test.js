import test from 'node:test';
import assert from 'node:assert/strict';
import { groupMessages } from './messageGroups.js';

test('consecutive messages stay together until another sender interrupts', () => {
  const messages = [
    { _id: 'first', from: 'me', at: '2026-11-12T01:00:00Z' },
    { _id: 'last', from: 'me', at: '2026-11-12T02:00:00Z' },
    { _id: 'reply', from: 'them', senderAuthId: 'a' },
    { _id: 'reply-again', from: 'them', senderAuthId: 'a' },
    { _id: 'other-member', from: 'them', senderAuthId: 'b' },
    { _id: 'next', from: 'me' },
  ];
  assert.deepEqual(groupMessages(messages, true).map(group => group.map(message => message._id)), [
    ['first', 'last'], ['reply', 'reply-again'], ['other-member'], ['next'],
  ]);
});

test('member activity stays separate from surrounding messages by the same sender', () => {
  const messages = [
    { _id: 'before', text: 'Hello' },
    { _id: 'added', activity: { type: 'members_added' } },
    { _id: 'removed', activity: { type: 'member_removed' } },
    { _id: 'renamed', activity: { type: 'group_renamed' } },
    { _id: 'after', text: 'Welcome' },
    { _id: 'next', text: 'Everyone' },
  ].map(message => ({ ...message, from: 'me', at: '2026-11-10T08:00:00Z' }));
  assert.deepEqual(groupMessages(messages, true).map(group => group.map(message => message._id)), [
    ['before'], ['added'], ['removed'], ['renamed'], ['after', 'next'],
  ]);
});
