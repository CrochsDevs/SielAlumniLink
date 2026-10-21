import test from 'node:test';
import assert from 'node:assert/strict';
import { isDeadlinePassed, validateDeadline } from './jobs.deadline.js';
import { createApplicationHandlers } from './job-applications.controllers.js';

test('deadline closes at the exact Philippine-time boundary, with no deadline remaining open', () => {
  const job = { applicationDeadline: '2026-11-01T17:00:00+08:00' };
  const boundary = Date.parse('2026-11-01T09:00:00Z');
  assert.equal(isDeadlinePassed(job, boundary - 1), false);
  assert.equal(isDeadlinePassed(job, boundary), true);
  assert.equal(isDeadlinePassed(job, boundary + 1), true);
  assert.equal(isDeadlinePassed({}, boundary), false);
  assert.equal(isDeadlinePassed({ applicationDeadline: null }, boundary), false);
});

test('deadline validation permits clearing and rejects malformed or ambiguous dates', () => {
  for (const value of [null, undefined, '2026-11-01T09:00:00.000Z', '2026-11-01T17:00:00+08:00']) assert.equal(validateDeadline(value), null);
  for (const value of ['', 'tomorrow', 123, {}, '2026-11-01T17:00', '2026-99-99T00:00:00Z']) assert.ok(validateDeadline(value));
});

test('server rejects submissions at/after closing even when the job remains visible', async (t) => {
  const boundary = Date.parse('2026-11-01T09:00:00Z');
  const clock = t.mock.method(Date, 'now', () => boundary);
  for (const [deadline, accepted] of [[null, true], [boundary + 1, true], [boundary, false], [boundary - 1, false]]) {
    let saved = null;
    const handlers = createApplicationHandlers({
      jobs: { findById: async () => ({ _id: 'job', isActive: true, applicationDeadline: deadline ? new Date(deadline).toISOString() : null }) },
      applications: { create: async data => { saved = data; return data; } },
    });
    const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await handlers.submit({ user: { _id: 'member', role: 'alumni' }, params: { id: 'job' }, body: { name: 'Member', email: 'member@example.test' }, file: { originalname: 'resume.pdf', buffer: Buffer.from('%PDF-1.7') } }, res);
    assert.equal(res.code, accepted ? 201 : 404);
    assert.equal(Boolean(saved), accepted);
    if (saved) assert.equal(saved.jobSnapshot.applicationDeadline, deadline ? new Date(deadline).toISOString() : null);
  }
  clock.mock.restore();
});
