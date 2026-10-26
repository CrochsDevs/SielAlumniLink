import test from 'node:test';
import assert from 'node:assert/strict';
import { createGroupMembersService } from './group-members.js';

function fixture(count = 3) {
  const group = { _id: 'group', name: 'Batch 2026', isGroup: true, participants: Array.from({ length: count }, (_, i) => ({ authId: `member${i}`, email: `member${i}@example.test` })), lastMessage: { text: 'Hello' } };
  const accounts = new Map([...group.participants, ...['new1', 'new2', 'pending', 'outsider'].map(authId => ({ authId, email: `${authId}@example.test` }))].map(person => [person.authId, { _id: person.authId, email: person.email }]));
  const conversations = {
    async findById(id) { return id === 'group' ? structuredClone(group) : null; },
    async appendMembers(id, actor, expected, members) {
      if (id !== group._id || !group.isGroup || !group.participants.some(p => p.authId === actor) || JSON.stringify(expected) !== JSON.stringify(group.participants)) return null;
      group.participants.push(...members);
      return structuredClone(group);
    },
  };
  const service = createGroupMembersService({
    conversations,
    accounts: { async findById(id) { return accounts.get(id) || null; } },
    profiles: { async findByAuthId(id) { return { name: `Name ${id}`, password: 'private' }; }, async findByEmail() { return null; } },
    connections: { async findMine() { return ['member1', 'new1', 'new2', 'pending'].map(id => ({ requesterAuthId: 'member0', recipientAuthId: id, status: id === 'pending' ? 'pending' : 'accepted' })); } },
  });
  return { service, group, accounts, conversations };
}

test('members can list names and candidates contain only accepted connections outside the group', async () => {
  const { service } = fixture();
  const result = await service.list('group', 'member0');
  assert.equal(result.memberCount, 3);
  assert.deepEqual(result.members[0], { authId: 'member0', name: 'Name member0', email: 'member0@example.test', profilePicture: null, isAdmin: true });
  assert.deepEqual((await service.candidates('group', 'member0')).map(p => p.authId), ['new1', 'new2']);
});

test('nonmembers, missing groups and direct conversations cannot list or add members', async () => {
  const { service, group } = fixture();
  for (const [id, actor] of [['group', 'outsider'], ['missing', 'member0']]) {
    for (const operation of [() => service.list(id, actor), () => service.candidates(id, actor), () => service.add(id, actor, ['new1'])]) {
      await assert.rejects(operation(), error => error.status === 404);
    }
  }
  group.isGroup = false;
  await assert.rejects(service.add('group', 'member0', ['new1']), error => error.status === 404);
  assert.equal(group.participants.length, 3);
});

test('adding connections persists membership, preserves messages and deduplicates retries', async () => {
  const { service, group } = fixture();
  const results = await Promise.all(Array.from({ length: 4 }, () => service.add('group', 'member0', ['new1', 'new1', 'member0'])));
  assert.ok(results.every(result => result.memberCount === 4));
  assert.equal(group.participants.filter(p => p.authId === 'new1').length, 1);
  assert.equal(group.lastMessage.text, 'Hello');
  assert.equal((await service.list('group', 'new1')).memberCount, 4);
});

test('invalid input, pending connections and unavailable accounts cannot partially add members', async () => {
  const { service, group, accounts } = fixture();
  for (const input of [null, [], 'new1', [null], [''], Array(21).fill('new1')]) {
    await assert.rejects(service.add('group', 'member0', input), error => error.status === 400);
  }
  for (const id of ['pending', 'outsider']) await assert.rejects(service.add('group', 'member0', ['new1', id]), error => error.status === 403);
  accounts.delete('new2');
  await assert.rejects(service.add('group', 'member0', ['new1', 'new2']), error => error.status === 404);
  assert.equal(group.participants.length, 3);
});

test('concurrent additions preserve both updates and enforce the 20 member limit', async () => {
  const first = fixture();
  await Promise.all(['new1', 'new2'].map(id => first.service.add('group', 'member0', [id])));
  assert.equal(first.group.participants.length, 5);
  const full = fixture(19);
  const results = await Promise.allSettled(['new1', 'new2'].map(id => full.service.add('group', 'member0', [id])));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.status, 400);
  assert.equal(full.group.participants.length, 20);
});

test('repeated write conflicts return a retryable error instead of overwriting membership', async () => {
  const { service, conversations, group } = fixture();
  conversations.appendMembers = async () => null;
  await assert.rejects(service.add('group', 'member0', ['new1']), error => error.status === 409);
  assert.equal(group.participants.length, 3);
});
