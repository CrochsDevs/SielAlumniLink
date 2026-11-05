import test from 'node:test';
import assert from 'node:assert/strict';
import { createRingingTimeout } from './ringingTimeout.js';

function fixture() {
  const scheduled = [];
  const expired = [];
  const cancelled = [];
  const timer = createRingingTimeout({
    now: () => 1000,
    schedule: (callback, delay) => { scheduled.push({ callback, delay }); return scheduled.length; },
    cancel: id => cancelled.push(id),
    onExpire: (...args) => expired.push(args),
  });
  return { timer, scheduled, expired, cancelled };
}

test('an unanswered call closes locally after 30 seconds without a server signal', () => {
  const f = fixture();
  f.timer.start('call-1', 'recipient');
  assert.equal(f.scheduled[0].delay, 30000);
  f.scheduled[0].callback();
  assert.deepEqual(f.expired, [['call-1', 'recipient']]);
  f.scheduled[0].callback();
  assert.equal(f.expired.length, 1);
});

test('answering or ending cancels expiration even if an old callback arrives', () => {
  const f = fixture();
  f.timer.start('answered', 'recipient');
  f.timer.stop();
  f.scheduled[0].callback();
  assert.deepEqual(f.expired, []);
  assert.deepEqual(f.cancelled, [1]);
});

test('a previous call cannot end a new call', () => {
  const f = fixture();
  f.timer.start('old', 'first');
  f.timer.start('new', 'second');
  f.scheduled[0].callback();
  assert.deepEqual(f.expired, []);
  f.scheduled[1].callback();
  assert.deepEqual(f.expired, [['new', 'second']]);
});

test('incoming calls honor the remaining deadline and never ring longer than 30 seconds', () => {
  const f = fixture();
  f.timer.start('incoming', 'caller', 11000);
  assert.equal(f.scheduled[0].delay, 10000);
  f.timer.start('late', 'caller', 500);
  assert.equal(f.scheduled[1].delay, 0);
  f.timer.start('future', 'caller', 999999);
  assert.equal(f.scheduled[2].delay, 30000);
});
