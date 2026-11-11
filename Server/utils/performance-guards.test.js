import test from 'node:test';
import assert from 'node:assert/strict';
import { mapConcurrent } from './map-concurrent.js';
import { sessionValidation } from '../realtime/session-validation.js';
import { createPendingTask } from '../../Client/src/utils/pendingTask.js';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

test('a burst of refreshes shares one task and a later refresh runs again', async () => {
  const gate = createPendingTask(), wait = deferred();
  let calls = 0;
  const task = () => { calls++; return wait.promise; };
  const requests = Array.from({ length: 100 }, () => gate.run(task));
  await Promise.resolve();
  assert.equal(calls, 1);
  wait.resolve(42);
  assert.deepEqual(await Promise.all(requests), Array(100).fill(42));
  await gate.run(task);
  assert.equal(calls, 2);
});

test('clearing an unmounted lifecycle skips queued work', async () => {
  const gate = createPendingTask();
  let calls = 0;
  const old = gate.run(() => { calls++; });
  gate.clear();
  await old;
  assert.equal(calls, 0);
});

test('an old lifecycle completion cannot release a replacement task', async () => {
  const gate = createPendingTask(), old = deferred(), current = deferred();
  const first = gate.run(() => old.promise);
  await Promise.resolve();
  gate.clear();
  const second = gate.run(() => current.promise);
  old.resolve(); await first;
  assert.equal(gate.run(() => assert.fail('duplicate task')), second);
  current.resolve(); await second;
});

test('failed refreshes release the gate for retry', async () => {
  const gate = createPendingTask();
  await assert.rejects(gate.run(() => { throw new Error('offline'); }));
  assert.equal(await gate.run(() => 7), 7);
});

test('concurrent socket packets share a check, subsequent packets recheck revocation', async () => {
  const wait = deferred();
  let reads = 0, valid = true;
  const validate = sessionValidation(async () => { reads++; await wait.promise; return valid; });
  const requests = Array.from({ length: 100 }, validate);
  await Promise.resolve();
  assert.equal(reads, 1);
  wait.resolve();
  assert.equal((await Promise.all(requests)).every(Boolean), true);
  valid = false;
  assert.equal(await validate(), false);
  assert.equal(reads, 2);
});

test('socket validation errors do not permanently lock validation', async () => {
  let reads = 0;
  const validate = sessionValidation(() => { if (++reads === 1) throw new Error('database unavailable'); return true; });
  await assert.rejects(validate());
  assert.equal(await validate(), true);
});

test('chat list fan-out stays bounded and preserves list order', async () => {
  let active = 0, peak = 0;
  const result = await mapConcurrent(Array.from({ length: 100 }, (_, i) => i), 8, async value => {
    peak = Math.max(peak, ++active);
    await new Promise(resolve => setImmediate(resolve));
    active--;
    return value * 2;
  });
  assert.equal(peak, 8);
  assert.deepEqual(result, Array.from({ length: 100 }, (_, i) => i * 2));
});

test('list failures stop scheduling the remainder; empty lists run no work', async () => {
  let calls = 0;
  await assert.rejects(mapConcurrent(Array(100).fill(0), 2, async () => { calls++; throw new Error('failed'); }));
  assert.equal(calls, 2);
  assert.deepEqual(await mapConcurrent([], 8, () => assert.fail('empty list')), []);
});
