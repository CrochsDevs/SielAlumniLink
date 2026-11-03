import test from 'node:test';
import assert from 'node:assert/strict';
import { createCallService } from './calls.js';

function fixture() {
  const records = [];
  const events = [];
  let clock = 1000;
  let timeout;
  const a = { id: 'socket-a', user: { _id: 'a', email: 'a@example.test' } };
  const b = { id: 'socket-b', user: { _id: 'b', email: 'b@example.test' } };
  const service = createCallService({
    authorize: async (_caller, id) => id === 'b' ? b.user : null,
    record: async record => { records.push(record); },
    emit: (...args) => events.push(args),
    now: () => clock,
    schedule: callback => { timeout = callback; return 1; },
    cancel: () => {},
  });
  const signal = (socket, kind, toAuthId = socket === a ? 'b' : 'a', callId = 'call-1') =>
    service.signal(socket, { toAuthId, kind, data: { callId, callKind: 'video' } });
  return { records, events, a, b, service, signal, advance: () => { clock += 65000; }, expire: async () => { timeout(); await Promise.resolve(); } };
}

test('answered calls record duration once despite both peers hanging up', async () => {
  const f = fixture();
  await f.signal(f.a, 'invite');
  await f.signal(f.b, 'accept');
  f.advance();
  await Promise.all([f.signal(f.a, 'end'), f.signal(f.b, 'end')]);
  await f.signal(f.a, 'invite');
  assert.equal(f.records.length, 1);
  assert.equal(f.records[0].duration, 65);
  assert.equal(f.records[0].status, 'completed');
  assert.equal(f.records[0].kind, 'video');
});
test('unanswered timeout and caller cancellation leave missed call records', async () => {
  for (const timeout of [true, false]) {
    const f = fixture();
    await f.signal(f.a, 'invite');
    if (timeout) await f.expire();
    else await f.signal(f.a, 'end');
    assert.equal(f.records[0].status, 'missed');
    assert.equal(f.records[0].duration, 0);
    assert.equal(f.events.filter(([, , event]) => event.kind === 'end').length, 2);
  }
});
test('declined and disconnected calls leave history', async () => {
  const f = fixture();
  await f.signal(f.a, 'invite');
  await f.signal(f.b, 'decline');
  assert.equal(f.records[0].status, 'declined');
  await f.signal(f.a, 'invite', 'b', 'call-2');
  f.service.disconnect(f.a);
  await Promise.resolve();
  assert.equal(f.records[1].status, 'missed');
});
test('outsiders, stale signals and unauthorized invites cannot write call history', async () => {
  const f = fixture();
  await f.signal(f.a, 'invite', 'unknown');
  assert.equal(f.records.length, 0);
  await f.signal(f.a, 'invite');
  await f.signal({ id: 'intruder', user: { _id: 'c' } }, 'end', 'a');
  await f.signal(f.b, 'end', 'a', 'stale-id');
  await f.signal(f.a, 'accept');
  assert.equal(f.records.length, 0);
  await f.expire();
  assert.equal(f.records[0].status, 'missed');
});

test('blocking ends a direct call once and suppresses late signals', async () => {
  const f = fixture();
  await f.signal(f.a, 'invite');
  await f.signal(f.b, 'accept');
  await f.service.endBetween('b', 'a');
  await f.signal(f.a, 'end');
  await f.service.endBetween('a', 'b');
  assert.equal(f.records.length, 1);
  assert.equal(f.records[0].status, 'completed');
});

test('blocking while authorization is pending prevents a late invite', async () => {
  let resolve;
  const events = [];
  const service = createCallService({ authorize: () => new Promise(done => { resolve = done; }),
    record: async () => assert.fail('Pending invite must not create call history'),
    emit: (...args) => events.push(args) });
  const invite = service.signal({ id: 'socket-a', user: { _id: 'a' } }, { toAuthId: 'b', kind: 'invite', data: { callId: 'pending' } });
  await service.endBetween('a', 'b');
  resolve({ _id: 'b' });
  await invite;
  assert.deepEqual(events.map(([, , payload]) => payload.kind), ['decline']);
});
