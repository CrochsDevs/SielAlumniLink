import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveMessageMentions } from './message-mentions.js';
import { mentionQuery, mentionParts } from '../../../Client/src/components/chat/mentionText.js';
import { Collection, ObjectId } from 'mongodb';
import { ConversationModel, MessageModel } from './messages.models.js';
import UserModel from '../users/users.models.js';
import { sendMessage, listMessages } from './messages.controllers.js';
import { ConversationControls } from './conversation-controls.js';

const a = 'aaaaaaaaaaaaaaaaaaaaaaaa', b = 'bbbbbbbbbbbbbbbbbbbbbbbb', stranger = 'cccccccccccccccccccccccc';
const group = { isGroup: true, participants: [{ authId: a }, { authId: b }] };
const people = [{ authId: a, name: 'Ann' }, { authId: b, name: 'Ann Lee' }];
const profiles = async ids => people.filter(person => ids.includes(person.authId));

test('mentions use current group membership and server-owned profile names', async () => {
  let reads = 0;
  const text = 'Hi @Ann Lee, please meet @Ann.';
  const result = await resolveMessageMentions(group, text, [b, a, b], async ids => { reads++; assert.deepEqual(ids, [b, a]); return profiles(ids); });
  assert.equal(reads, 1);
  assert.deepEqual(result.map(m => [m.authId, text.slice(m.start, m.end)]), [[b, '@Ann Lee'], [a, '@Ann']]);
});

test('outsiders, direct chats and malformed identities cannot create mentions', async () => {
  for (const input of [[stranger], [{ $ne: null }], ['bad'], Array(21).fill(a), '{}', '{', true]) {
    await assert.rejects(resolveMessageMentions(group, '@Ann', input, () => assert.fail('Must reject before reading profiles')), error => error.status === 400);
  }
  await assert.rejects(resolveMessageMentions({ ...group, isGroup: false }, '@Ann', [a], profiles), error => error.status === 400);
  assert.deepEqual(await resolveMessageMentions({ isGroup: false }, 'Hi', undefined, () => assert.fail('No mentions need no lookup')), []);
});

test('multipart IDs work; removing mention text removes saved mention ranges', async () => {
  assert.equal((await resolveMessageMentions(group, '@Ann', JSON.stringify([a]), profiles)).length, 1);
  assert.deepEqual(await resolveMessageMentions(group, 'Edited without a mention', [a], profiles), []);
  assert.deepEqual(await resolveMessageMentions(group, '@Made Up', [a], profiles), []);
});

test('mentions respect boundaries, overlapping names, repeated names and Unicode offsets', async () => {
  const text = '👋 @Ann Lee! (@Ann) x@Ann @Annex @Ann';
  const mentions = await resolveMessageMentions(group, text, [a, b], profiles);
  assert.deepEqual(mentions.map(m => text.slice(m.start, m.end)), ['@Ann Lee', '@Ann', '@Ann']);
  assert.equal(mentions[0].start, 3);
});

test('removed or unavailable profiles cannot spoof a mentioned name', async () => {
  assert.deepEqual(await resolveMessageMentions(group, '@Ann', [a], async () => []), []);
  await assert.rejects(resolveMessageMentions({ ...group, participants: [] }, '@Ann', [a], profiles), error => error.status === 400);
});

test('picker finds mentions at the caret, but never inside email addresses', () => {
  assert.deepEqual(mentionQuery('Hello @Ann, next', 10), { start: 6, end: 10, query: 'Ann' });
  assert.equal(mentionQuery('test@example.com', 16), null);
  assert.deepEqual(mentionQuery('@', 1), { start: 0, end: 1, query: '' });
});

test('rendering reconstructs original text and ignores invalid or stale ranges', async () => {
  const text = '<script> 👋 @Ann Lee & @Ann';
  const mentions = await resolveMessageMentions(group, text, [b, a], profiles);
  const parts = mentionParts(text, mentions);
  assert.equal(parts.map(part => part.text).join(''), text);
  assert.deepEqual(parts.filter(part => part.authId).map(part => part.authId), [b, a]);
  assert.deepEqual(mentionParts('Hi', [{ start: 0, end: 100, name: 'Hi', authId: a }]), [{ text: 'Hi' }]);
});

test('real send and history handlers carry validated mentions and reject nonmembers before saving', async t => {
  const conversation = { ...group, _id: new ObjectId() };
  let saved, writes = 0;
  t.mock.method(ConversationModel, 'findById', async () => conversation);
  t.mock.method(ConversationModel, 'touch', async () => {});
  t.mock.method(UserModel, 'findChatProfilesByAuthIds', profiles);
  t.mock.method(MessageModel, 'create', async doc => { writes++; saved = { ...doc, _id: new ObjectId(), createdAt: new Date() }; return saved; });
  t.mock.method(MessageModel, 'listByConversation', async () => [saved]);
  t.mock.method(ConversationControls, 'preference', async () => null);
  const invoke = async (action, body) => {
    const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
    await action({ user: { _id: a, email: 'sender@example.test' }, params: { id: String(conversation._id) }, body }, res);
    return res;
  };
  const sent = await invoke(sendMessage, { text: 'Hello @Ann Lee', mentionAuthIds: [b] });
  assert.equal(sent.code, 201);
  assert.equal(saved.mentions[0].authId, b);
  assert.deepEqual(sent.body.data.mentions, saved.mentions);
  const history = await invoke(listMessages, {});
  assert.deepEqual(history.body.data[0].mentions, saved.mentions);
  assert.equal((await invoke(sendMessage, { text: '@Ann Lee', mentionAuthIds: [stranger] })).code, 400);
  conversation.participants = [{ authId: b }];
  assert.equal((await invoke(sendMessage, { text: '@Ann Lee', mentionAuthIds: [b] })).code, 404);
  assert.equal(writes, 1);
});

test('editing recomputes persisted ranges and cannot add mentions for nonmembers', async t => {
  const conversation = { ...group, _id: new ObjectId() };
  const saved = { _id: new ObjectId(), conversationId: conversation._id, senderAuthId: a, text: '@Ann', mentions: [{ authId: a, name: 'Ann', start: 0, end: 4 }] };
  let writes = 0;
  t.mock.method(ConversationModel, 'findById', async () => conversation);
  t.mock.method(UserModel, 'findChatProfilesByAuthIds', profiles);
  t.mock.method(Collection.prototype, 'findOne', async () => saved);
  t.mock.method(Collection.prototype, 'updateOne', async (_filter, changes) => { writes++; Object.assign(saved, changes.$set); });
  const edited = await MessageModel.editMessage(saved._id, a, 'Hello @Ann Lee', [b]);
  assert.equal(edited.mentions[0].authId, b);
  assert.equal(edited.text.slice(edited.mentions[0].start, edited.mentions[0].end), '@Ann Lee');
  await assert.rejects(MessageModel.editMessage(saved._id, a, '@Ann Lee', [stranger]), error => error.status === 400);
  assert.equal(writes, 1);
  assert.equal(await MessageModel.editMessage(saved._id, b, 'Forged sender', [b]), null);
  const cleared = await MessageModel.editMessage(saved._id, a, 'No mention', []);
  assert.deepEqual(cleared.mentions, []);
});
