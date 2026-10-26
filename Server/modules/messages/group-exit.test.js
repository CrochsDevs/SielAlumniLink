import test from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { exitGroup } from './group-exit.js';
import { groupRoles } from './group-admin.js';
import { renameGroup } from './group-name.js';

const id = 'aaaaaaaaaaaaaaaaaaaaaaaa';
function fixture() {
  const group = { _id: new ObjectId(id), isGroup: true, name: 'Group', createdBy: 'creator', adminAuthIds: ['creator'], participants: ['creator', 'member', 'third'].map(authId => ({ authId })), lastMessage: { text: 'Keep history' } };
  const matches = query => String(query._id) === String(group._id) && query.isGroup === group.isGroup && group.participants.some(p => p.authId === query['participants.authId']) && ['participants', 'adminAuthIds', 'createdBy'].every(key => !Object.hasOwn(query, key) || (query[key]?.$exists === false ? !Object.hasOwn(group, key) : JSON.stringify(query[key]) === JSON.stringify(group[key])));
  const collection = {
    async findOne(query) { return matches(query) ? structuredClone(group) : null; },
    async findOneAndUpdate(query, update) {
      if (!matches(query)) return null;
      Object.assign(group, update.$set);
      return structuredClone(group);
    },
  };
  return { group, collection };
}

test('members can leave but cannot kick others; outsiders and direct chats are rejected', async () => {
  const { group, collection } = fixture();
  await assert.rejects(exitGroup(collection, id, 'member', 'third'), error => error.status === 403);
  await assert.rejects(exitGroup(collection, id, 'outsider'), error => error.status === 404);
  await assert.rejects(exitGroup(collection, 'bad', 'creator'), error => error.status === 404);
  const updated = await exitGroup(collection, id, 'member');
  assert.deepEqual(updated.participants.map(p => p.authId), ['creator', 'third']);
  assert.deepEqual(updated.adminAuthIds, ['creator']);
  assert.equal(group.lastMessage.text, 'Keep history');
  await assert.rejects(exitGroup(collection, id, 'member'), error => error.status === 404);
  group.isGroup = false;
  await assert.rejects(exitGroup(collection, id, 'creator'), error => error.status === 404);
});

test('admins can kick members and other admins, including the creator', async () => {
  const { group, collection } = fixture();
  group.adminAuthIds.push('member');
  await exitGroup(collection, id, 'member', 'creator');
  assert.deepEqual(group.adminAuthIds, ['member']);
  assert.deepEqual(groupRoles(group).adminAuthIds, ['member']);
  await assert.rejects(exitGroup(collection, id, 'creator', 'member'), error => error.status === 404);
  await assert.rejects(exitGroup(collection, id, 'member', 'missing'), error => error.status === 404);
});

test('last admin leaving transfers admin rights; existing admins are retained', async () => {
  const { group, collection } = fixture();
  await exitGroup(collection, id, 'creator');
  assert.deepEqual(group.adminAuthIds, ['member']);
  assert.equal(group.createdBy, 'creator');
  await exitGroup(collection, id, 'member');
  assert.deepEqual(group.adminAuthIds, ['third']);
  await exitGroup(collection, id, 'third');
  assert.deepEqual(group.participants, []);
  assert.deepEqual(group.adminAuthIds, []);
  const second = fixture();
  second.group.adminAuthIds.push('third');
  await exitGroup(second.collection, id, 'creator');
  assert.deepEqual(second.group.adminAuthIds, ['third']);
});

test('legacy creator departure persists original creator and assigns a successor', async () => {
  const { group, collection } = fixture();
  delete group.createdBy;
  delete group.adminAuthIds;
  await exitGroup(collection, id, 'creator');
  assert.equal(group.createdBy, 'creator');
  assert.deepEqual(group.adminAuthIds, ['member']);
});

test('a creator added again does not regain admin privileges', async () => {
  const { group, collection } = fixture();
  await exitGroup(collection, id, 'creator');
  group.participants.push({ authId: 'creator' });
  assert.deepEqual(groupRoles(group).adminAuthIds, ['member']);
  // Use the permission filter against its creator fallback and explicit roles.
  const guarded = { findOne: collection.findOne, async findOneAndUpdate(query) {
    assert.ok(query.$or.every(condition => condition.adminAuthIds === 'creator' || condition.adminAuthIds?.$exists === false));
    return null;
  } };
  await assert.rejects(renameGroup(guarded, id, 'creator', 'Blocked'), error => error.status === 403);
  await assert.rejects(exitGroup(collection, id, 'creator', 'member'), error => error.status === 403);
});

test('concurrent departures retry and keep a remaining admin', async () => {
  const { group, collection } = fixture();
  await Promise.all([exitGroup(collection, id, 'creator'), exitGroup(collection, id, 'member')]);
  assert.deepEqual(group.participants.map(p => p.authId), ['third']);
  assert.deepEqual(group.adminAuthIds, ['third']);
});

test('role changes during a removal are retried without losing a promotion', async () => {
  const { group, collection } = fixture();
  const update = collection.findOneAndUpdate;
  let once = true;
  collection.findOneAndUpdate = async (...args) => {
    if (once) { once = false; group.adminAuthIds.push('third'); }
    return update(...args);
  };
  await exitGroup(collection, id, 'member');
  assert.deepEqual(group.adminAuthIds, ['creator', 'third']);
  collection.findOneAndUpdate = async () => null;
  await assert.rejects(exitGroup(collection, id, 'creator'), error => error.status === 409);
});
