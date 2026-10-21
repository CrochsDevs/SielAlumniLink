import assert from 'node:assert/strict';
import test from 'node:test';
import { tracerQuarterStatus } from './tracer.quarter.js';

test('quarterly updates follow Philippine calendar boundaries', () => {
  const before = new Date('2026-03-31T15:59:59Z');
  const after = new Date('2026-03-31T16:00:00Z');
  const response = { updatedAt: '2026-01-01T00:00:00Z' };
  assert.equal(tracerQuarterStatus(response, before).updateRequired, false);
  assert.equal(tracerQuarterStatus(response, after).updateRequired, true);
  assert.equal(tracerQuarterStatus(response, after).quarter, '2026 Q2');
  assert.equal(tracerQuarterStatus({ updatedAt: after }, after).updateRequired, false);
  assert.equal(tracerQuarterStatus(null, after).updateRequired, true);
});

test('year rollover, legacy timestamps and invalid timestamps', () => {
  const now = new Date('2026-12-31T16:00:00Z');
  assert.equal(tracerQuarterStatus(null, now).quarter, '2027 Q1');
  assert.equal(tracerQuarterStatus({ respondedAt: now }, now).updateRequired, false);
  for (const updatedAt of ['invalid', '2026-12-31T15:59:59Z', '2027-02-01T00:00:00Z'])
    assert.equal(tracerQuarterStatus({ updatedAt }, now).updateRequired, true);
  assert.equal(tracerQuarterStatus(null, now).nextUpdateAt, '2027-03-31T16:00:00.000Z');
});
