import test from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { buildTracerPeriodReport, tracerPeriod, validateTracerPeriod } from './tracer.period-report.js';

test('tracing periods use Manila quarter and year boundaries', () => {
  assert.deepEqual(tracerPeriod('2026-03-31T15:59:59Z'), { year: 2026, quarter: 1 });
  assert.deepEqual(tracerPeriod('2026-03-31T16:00:00Z'), { year: 2026, quarter: 2 });
  assert.deepEqual(tracerPeriod('2025-12-31T16:00:00Z'), { year: 2026, quarter: 1 });
  assert.equal(tracerPeriod('invalid'), null);
  assert.equal(tracerPeriod(null), null);
});

test('period filters choose the latest observation within the period and preserve earlier outcomes', () => {
  const authId = new ObjectId();
  const document = { _id: new ObjectId(), authId, email: 'alumni@example.test', batch: '2020', program: 'BS IT',
    status: 'Employed', company: 'Current company', salaryRange: 'Current salary',
    respondedAt: '2025-02-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z',
    responseHistory: [
      { status: 'Unemployed', recordedAt: '2025-02-01T00:00:00Z' },
      { status: 'Studying', company: 'Graduate school', recordedAt: '2026-01-20T00:00:00Z' },
      { status: 'Self-employed', company: 'Quarter one business', recordedAt: '2026-03-25T00:00:00Z' },
      { status: 'Employed', company: 'Quarter two employer', recordedAt: '2026-04-10T00:00:00Z' },
    ] };
  const q1 = buildTracerPeriodReport([document], { year: '2026', quarter: '1' });
  assert.equal(q1.responses.length, 1);
  assert.equal(q1.responses[0].company, 'Quarter one business');
  assert.equal(q1.responses[0].status, 'Self-employed');
  assert.equal(q1.responses[0].salaryRange, ''); // Never copy newer data into an old observation.
  assert.equal(q1.responses[0].batch, '2020');
  assert.equal(q1.responses[0].tracingYear, 2026);
  assert.equal(q1.responses[0].tracingQuarter, 1);
  assert.deepEqual(q1.periods.years, [2026, 2025]);
  assert.equal(q1.responses[0].responseHistory, undefined);
  assert.equal(buildTracerPeriodReport([document], { year: '2025' }).responses[0].status, 'Unemployed');
  assert.equal(buildTracerPeriodReport([document], { quarter: '2' }).responses[0].company, 'Quarter two employer');
  assert.equal(buildTracerPeriodReport([document]).responses[0].company, 'Current company');
  const empty = buildTracerPeriodReport([document], { year: '2024', quarter: '4' });
  assert.equal(empty.responses.length, 0);
  assert.deepEqual(empty.periods.years, [2026, 2025]);
});

test('legacy ID variants are deduplicated per account while distinct accounts remain separate', () => {
  const id = new ObjectId(), other = new ObjectId();
  const records = [
    { _id: 'a', authId: id, status: 'Employed', updatedAt: '2026-01-02' },
    { _id: 'b', authId: String(id), status: 'Studying', updatedAt: '2026-02-02' },
    { _id: 'c', authId: other, status: 'Unemployed', updatedAt: '2026-03-02' },
  ];
  const result = buildTracerPeriodReport(records, { year: '2026', quarter: '1' });
  assert.equal(result.responses.length, 2);
  assert.equal(result.responses.find(row => String(row.authId) === String(id)).status, 'Studying');
  assert.equal(buildTracerPeriodReport([{ _id: 'unknown', authId: 'unknown' }], { year: '2026' }).responses.length, 0);
  assert.equal(buildTracerPeriodReport([{ _id: 'unknown', authId: 'unknown' }]).responses[0].tracingYear, null);
});

test('year and quarter validation rejects malformed filters', () => {
  for (const filters of [{ year: '26' }, { year: '1899' }, { year: [] }, { year: {} },
    { quarter: '0' }, { quarter: '5' }, { quarter: ['1'] }, { quarter: {} }]) {
    assert.throws(() => validateTracerPeriod(filters), error => error.status === 400);
  }
});
