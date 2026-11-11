import test from 'node:test';
import assert from 'node:assert/strict';
import { createPendingReads } from './pendingRequests.js';

test('simultaneous dashboard reads share one request and the next refresh gets fresh data', async () => {
  let calls = 0, resolve;
  const read = createPendingReads(() => { calls++; return new Promise(done => { resolve = done; }); });
  const first = read('/connections/me');
  const second = read('/connections/me');
  assert.equal(first, second);
  await Promise.resolve();
  assert.equal(calls, 1);
  resolve('initial');
  assert.equal(await second, 'initial');
  const refreshed = read('/connections/me');
  await Promise.resolve();
  assert.equal(calls, 2);
  resolve('updated');
  assert.equal(await refreshed, 'updated');
});

test('role filters stay separate and failures can be retried', async () => {
  let calls = 0;
  const read = createPendingReads(async () => { calls++; if (calls === 1) throw new Error('offline'); return 'ok'; });
  await assert.rejects(read('/users'), /offline/);
  assert.equal(await read('/users'), 'ok');
  const plain = read('/users');
  const alumni = read('/users', { params: { role: 'alumni' } });
  assert.notEqual(plain, alumni);
  await Promise.all([plain, alumni]);
  assert.equal(calls, 4);
});
