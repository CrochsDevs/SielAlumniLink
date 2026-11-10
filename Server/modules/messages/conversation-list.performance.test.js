import test from 'node:test';
import assert from 'node:assert/strict';
import { Collection, ObjectId } from 'mongodb';
import { ConversationModel, conversationPreference } from './messages.models.js';

test('conversation visibility batches preferences and preserves cleared-history privacy', async t => {
  const owner = 'aaaaaaaaaaaaaaaaaaaaaaaa';
  const conversations = Array.from({ length: 100 }, (_, index) => ({ _id: new ObjectId((index + 1).toString(16).padStart(24, '0')), lastMessage: { at: new Date('2026-11-09') } }));
  const hidden = { _id: JSON.stringify([String(conversations[0]._id), owner]), hidden: true, clearedAt: new Date('2026-11-10') };
  const resurfaced = { _id: JSON.stringify([String(conversations[1]._id), owner]), hidden: true, clearedAt: new Date('2026-11-08') };
  const reads = [];
  t.mock.method(Collection.prototype, 'find', function(query) {
    reads.push({ collection: this.collectionName, query });
    const result = this.collectionName === 'conversations' ? conversations : [hidden, resurfaced];
    return { sort() { return this; }, toArray: async () => result };
  });
  t.mock.method(Collection.prototype, 'findOne', () => { throw new Error('Unexpected per-conversation lookup'); });
  const result = await ConversationModel.findMine(owner);
  assert.equal(reads.length, 2);
  assert.equal(reads[1].query._id.$in.length, 100);
  assert.equal(result.length, 99);
  assert.equal(result.some(item => String(item._id) === String(conversations[0]._id)), false);
  assert.equal(result.find(item => String(item._id) === String(conversations[1]._id))[conversationPreference], resurfaced);
  assert.equal(Object.hasOwn(result.at(-1), conversationPreference), true);
  assert.equal(result.at(-1)[conversationPreference], null);
  assert.equal(JSON.stringify(result).includes('clearedAt'), false, 'Preference metadata stays private');
});
