import test from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { createUserDirectory } from './user-directory.js';

test('directory uses two reads for any number of profiles and preserves roles, disabled status and privacy', async () => {
  const accounts = Array.from({ length: 100 }, (_, index) => ({ _id: new ObjectId(), email: `member${index}@example.test`, role: index === 0 ? 'student' : 'alumni', ...(index === 1 ? { disabledAt: new Date() } : {}) }));
  const profiles = accounts.map((account, index) => ({ _id: new ObjectId(), authId: index % 2 ? String(account._id) : account._id, email: account.email, name: `Member ${index}`, role: 'alumni', contactNumber: 'private', profileViews: 9 }));
  profiles.push({ _id: new ObjectId(), email: 'legacy@example.test', name: 'Legacy', role: 'student' });
  accounts.push({ _id: new ObjectId(), email: 'legacy@example.test', role: 'alumni' });
  const calls = [];
  const directory = createUserDirectory({ collection(name) { return { find(query, options) {
    calls.push({ name, query, options });
    return { toArray: async () => name === 'users' ? profiles : accounts };
  } }; } });
  const result = await directory({ _id: 'viewer', role: 'alumni' }, 'alumni');
  assert.equal(calls.length, 2);
  assert.equal(result.length, 99);
  assert.ok(result.every(profile => profile.role === 'alumni' && !Object.hasOwn(profile, 'email') && !Object.hasOwn(profile, 'contactNumber') && !Object.hasOwn(profile, 'profileViews')));
  assert.equal(result.some(profile => profile.name === 'Member 1'), false);
  assert.equal(result.at(-1).name, 'Legacy');
  assert.deepEqual(calls[1].options.projection, { _id: 1, email: 1, role: 1, disabledAt: 1 });
  assert.ok(calls[1].query.$or[0]._id.$in.some(value => value instanceof ObjectId));
});

test('an empty directory does not fetch accounts', async () => {
  const directory = createUserDirectory({ collection(name) { assert.equal(name, 'users'); return { find: () => ({ toArray: async () => [] }) }; } });
  assert.deepEqual(await directory({ role: 'admin' }), []);
});
