import test from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { renameGroup } from './group-name.js';
import { groupRoles, promoteGroupAdmin } from './group-admin.js';

const id = 'aaaaaaaaaaaaaaaaaaaaaaaa';
function fixture(isGroup = true) {
  const group = { _id: new ObjectId(id), isGroup, name: 'Original group', createdBy: 'member', adminAuthIds: ['member'], participants: [{ authId: 'member' }, { authId: 'other' }], lastMessage: { text: 'Hello' } };
  const matches = query => {
    if (String(query._id) !== String(group._id) || query.isGroup !== group.isGroup || !group.participants.some(p => p.authId === query['participants.authId'])) return false;
    if (query.$or && !query.$or.some(condition => {
      if (typeof condition.adminAuthIds === 'string') return group.adminAuthIds?.includes(condition.adminAuthIds);
      if (condition.adminAuthIds?.$exists === false && Object.hasOwn(group, 'adminAuthIds')) return false;
      if (condition.createdBy?.$exists === false) return !Object.hasOwn(group, 'createdBy') && group.participants[0]?.authId === condition['participants.0.authId'];
      return group.createdBy === condition.createdBy;
    })) return false;
    if (query.participants?.$elemMatch && !group.participants.some(p => p.authId === query.participants.$elemMatch.authId)) return false;
    return true;
  };
  const collection = { async findOne(query) { return matches(query) ? group : null; }, async findOneAndUpdate(query, update, options) {
    assert.equal(options.returnDocument, 'after');
    if (!matches(query)) return null;
    Object.assign(group, update.$set);
    if (update.$addToSet) group.adminAuthIds = [...new Set([...(group.adminAuthIds || []), ...update.$addToSet.adminAuthIds.$each])];
    return group;
  } };
  return { group, collection };
}

test('the creator can rename a group while preserving members and messages', async () => {
  const { group, collection } = fixture();
  const result = await renameGroup(collection, id, 'member', '  Batch 2026  ');
  assert.equal(result.name, 'Batch 2026');
  assert.equal(group.name, 'Batch 2026');
  assert.deepEqual(group.participants, [{ authId: 'member' }, { authId: 'other' }]);
  assert.equal(group.lastMessage.text, 'Hello');
  assert.ok(group.updatedAt instanceof Date);
});

test('ordinary members cannot rename or promote themselves', async () => {
  const { collection, group } = fixture();
  await assert.rejects(renameGroup(collection, id, 'other', 'Blocked'), error => error.status === 403);
  await assert.rejects(promoteGroupAdmin(collection, id, 'other', 'other'), error => error.status === 403);
  assert.equal(group.name, 'Original group');
  assert.deepEqual(group.adminAuthIds, ['member']);
});

test('admins can promote members once and the promoted member can rename and appoint admins', async () => {
  const { collection, group } = fixture();
  group.participants.push({ authId: 'third' });
  await Promise.all([promoteGroupAdmin(collection, id, 'member', 'other'), promoteGroupAdmin(collection, id, 'member', 'other')]);
  assert.deepEqual(group.adminAuthIds, ['member', 'other']);
  await renameGroup(collection, id, 'other', 'Renamed by admin');
  assert.equal(group.name, 'Renamed by admin');
  await promoteGroupAdmin(collection, id, 'other', 'third');
  assert.deepEqual(groupRoles(group).adminAuthIds, ['member', 'other', 'third']);
});

test('nonmembers cannot gain admin rights and invalid targets are rejected', async () => {
  const { collection } = fixture();
  await assert.rejects(promoteGroupAdmin(collection, id, 'outsider', 'outsider'), error => error.status === 404);
  for (const target of ['outsider', null, {}, '']) await assert.rejects(promoteGroupAdmin(collection, id, 'member', target), error => error.status === 400);
});

test('legacy groups retain their first member as creator and admin', async () => {
  const { collection, group } = fixture();
  delete group.createdBy;
  delete group.adminAuthIds;
  assert.deepEqual(groupRoles(group), { createdBy: 'member', adminAuthIds: ['member'] });
  await assert.rejects(renameGroup(collection, id, 'other', 'Blocked'), error => error.status === 403);
  await renameGroup(collection, id, 'member', 'Legacy group');
  await promoteGroupAdmin(collection, id, 'member', 'other');
  assert.deepEqual(groupRoles(group).adminAuthIds, ['member', 'other']);
});

test('nonmembers, direct conversations and unknown IDs cannot be renamed', async () => {
  for (const [isGroup, authId, conversationId] of [[true, 'outsider', id], [false, 'member', id], [true, 'member', 'bad-id'], [true, 'member', 'bbbbbbbbbbbbbbbbbbbbbbbb']]) {
    const { group, collection } = fixture(isGroup);
    await assert.rejects(renameGroup(collection, conversationId, authId, 'Changed'), error => error.status === 404);
    assert.equal(group.name, 'Original group');
  }
});

test('invalid names are rejected and the 80 character limit is enforced', async () => {
  const { collection, group } = fixture();
  for (const name of ['', '   ', null, {}, 123, 'x'.repeat(81)]) {
    await assert.rejects(renameGroup(collection, id, 'member', name), error => error.status === 400);
    assert.equal(group.name, 'Original group');
  }
  assert.equal((await renameGroup(collection, id, 'member', 'x'.repeat(80))).name.length, 80);
});
