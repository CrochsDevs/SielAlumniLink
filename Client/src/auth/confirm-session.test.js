import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmSession } from './confirm-session.js';

const expected = { authId: 'account-a', role: 'student' };
const api = data => ({ get: async path => {
  assert.equal(path, '/auth/me');
  return { data };
} });

test('sign-in accepts only a session returned through the browser cookie', async () => {
  const current = { ...expected, name: 'Verified profile' };
  assert.equal(await confirmSession(api({ success: true, data: current }), expected), current);
});

test('missing cookies and another browser account cannot complete sign-in', async () => {
  for (const data of [null, {}, { authId: 'account-b' }]) {
    await assert.rejects(confirmSession(api({ success: true, data }), expected), /session could not be saved/);
  }
  await assert.rejects(confirmSession(api({ success: false, data: expected }), expected), /session could not be saved/);
  await assert.rejects(confirmSession(api({ success: true, data: expected }), null), /session could not be saved/);
});

test('session verification propagates connectivity failures', async () => {
  await assert.rejects(confirmSession({ get: async () => { throw new Error('offline'); } }, expected), /offline/);
});
