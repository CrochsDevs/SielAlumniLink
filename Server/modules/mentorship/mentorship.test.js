import assert from 'node:assert/strict';
import test from 'node:test';
import { createMentorshipService } from './mentorship.service.js';
import { goalSnapshot, validateGoal } from './mentorship.policy.js';

const student = { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', role: 'student', email: 'student@example.test' };
const mentor = { _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', role: 'alumni', email: 'mentor@example.test' };
const stranger = { _id: 'cccccccccccccccccccccccc', role: 'student', email: 'stranger@example.test' };
const secondMentor = { _id: 'dddddddddddddddddddddddd', role: 'alumni', email: 'second@example.test' };
const connectionId = 'eeeeeeeeeeeeeeeeeeeeeeee';

function fixture(status = 'accepted') {
  const collections = new Map();
  const bucket = name => { if (!collections.has(name)) collections.set(name, new Map()); return collections.get(name); };
  const equal = (left, right) => String(left) === String(right);
  const matches = (doc, query) => Object.entries(query).every(([key, value]) => key === '$or' ? value.some(part => matches(doc, part)) : value?.$in ? value.$in.some(item => equal(doc[key], item)) : equal(doc[key], value));
  const db = { collection(name) {
    const records = bucket(name);
    return {
      async findOne(query) { return structuredClone([...records.values()].find(record => matches(record, query)) || null); },
      find(query) { return { toArray: async () => structuredClone([...records.values()].filter(record => matches(record, query))) }; },
      async updateOne(query, update, options = {}) {
        let record = records.get(String(query._id));
        if (!record || !matches(record, query)) {
          if (!options.upsert) return { matchedCount: 0, upsertedCount: 0 };
          if (record) throw Object.assign(new Error('Duplicate key'), { code: 11000 });
          record = { ...query, ...update.$setOnInsert };
          records.set(String(query._id), record);
          Object.assign(record, structuredClone(update.$set));
          for (const [key, value] of Object.entries(update.$inc || {})) record[key] = (record[key] || 0) + value;
          return { matchedCount: 0, upsertedCount: 1 };
        }
        Object.assign(record, structuredClone(update.$set));
        for (const [key, value] of Object.entries(update.$inc || {})) record[key] = (record[key] || 0) + value;
        return { matchedCount: 1, upsertedCount: 0 };
      },
    };
  } };
  const seed = (name, record) => bucket(name).set(String(record._id), structuredClone(record));
  for (const account of [student, mentor, stranger, secondMentor]) {
    seed('auth', account); seed('users', { _id: account._id, authId: account._id, name: account.email.split('@')[0], email: account.email, program: 'BS IT' });
  }
  seed('connections', { _id: connectionId, requesterAuthId: student._id, recipientAuthId: mentor._id, status });
  return { service: createMentorshipService(db), seed, records: name => [...bucket(name).values()] };
}

test('new trackers have exactly the requested goals and no invented progress', async () => {
  const f = fixture();
  const tracker = await f.service.get(student, connectionId);
  assert.deepEqual(tracker.goals.map(goal => goal.title), ['Resume Building', 'Interview Preparation', 'Career Planning']);
  assert.ok(tracker.goals.every(goal => goal.status === 'not_started' && goal.revision === 0 && goal.updatedAt === null));
  assert.deepEqual(tracker.summary, { total: 3, completed: 0, inProgress: 0, notStarted: 3, percent: 0 });
  assert.equal(f.records('mentorship_goals').length, 0, 'reading must not create goal records');
  assert.equal((await f.service.list(mentor)).length, 1);
});

test('student and mentor share saved goals, notes, editor identity, and completed timestamps', async () => {
  const { service } = fixture();
  let tracker = await service.update(student, connectionId, 'resume_building', { status: 'in_progress', revision: 0, note: ' Drafted my resume. ', mentorAuthId: stranger._id });
  assert.equal(tracker.goals[0].note, 'Drafted my resume.');
  assert.equal(tracker.goals[0].updatedByRole, 'student');
  assert.equal(tracker.summary.inProgress, 1);
  assert.equal(tracker.summary.percent, 0);
  tracker = await service.update(mentor, connectionId, 'resume_building', { status: 'completed', revision: 1, note: 'Reviewed and finalized.' });
  assert.equal(tracker.goals[0].revision, 2);
  assert.equal(tracker.goals[0].updatedByRole, 'alumni');
  assert.ok(tracker.goals[0].completedAt);
  assert.equal(tracker.summary.percent, 33);
  assert.equal((await service.get(student, connectionId)).goals[0].note, 'Reviewed and finalized.');
  tracker = await service.update(student, connectionId, 'interview_preparation', { status: 'completed', revision: 0 });
  assert.equal(tracker.summary.percent, 67);
  tracker = await service.update(mentor, connectionId, 'career_planning', { status: 'completed', revision: 0 });
  assert.equal(tracker.summary.percent, 100);
});

test('reopening or resetting a goal updates completion without affecting other goals', async () => {
  const { service } = fixture();
  await service.update(student, connectionId, 'resume_building', { status: 'completed', revision: 0, note: 'First draft' });
  await service.update(student, connectionId, 'career_planning', { status: 'in_progress', revision: 0 });
  let tracker = await service.update(mentor, connectionId, 'resume_building', { status: 'in_progress', revision: 1 });
  assert.equal(tracker.goals[0].completedAt, null);
  assert.equal(tracker.goals[0].note, 'First draft');
  assert.equal(tracker.goals[2].status, 'in_progress');
  tracker = await service.update(student, connectionId, 'resume_building', { status: 'not_started', revision: 2 });
  assert.equal(tracker.goals[0].startedAt, null);
  assert.equal(tracker.summary.completed, 0);
});

test('progress belongs to an individual accepted connection', async () => {
  const f = fixture();
  const secondId = 'ffffffffffffffffffffffff';
  f.seed('connections', { _id: secondId, requesterAuthId: secondMentor._id, recipientAuthId: student._id, status: 'accepted' });
  await f.service.update(mentor, connectionId, 'resume_building', { status: 'completed', revision: 0 });
  assert.equal((await f.service.get(student, secondId)).goals[0].status, 'not_started');
  assert.equal((await f.service.list(student)).length, 2);
  assert.equal((await f.service.list(secondMentor))[0].summary.completed, 0);
  await assert.rejects(f.service.get(secondMentor, connectionId), error => error.status === 403);
});

test('pending, declined, unrelated and withdrawn connections cannot access progress', async () => {
  for (const status of ['pending', 'declined']) {
    const { service } = fixture(status);
    assert.deepEqual(await service.list(student), []);
    await assert.rejects(service.get(mentor, connectionId), error => error.status === 403);
    await assert.rejects(service.update(student, connectionId, 'resume_building', { status: 'completed', revision: 0 }), error => error.status === 403);
  }
  const f = fixture();
  await assert.rejects(f.service.get(stranger, connectionId), error => error.status === 403);
  await f.service.update(student, connectionId, 'resume_building', { status: 'in_progress', revision: 0 });
  f.seed('connections', { _id: connectionId, requesterAuthId: student._id, recipientAuthId: mentor._id, status: 'declined' });
  await assert.rejects(f.service.get(student, connectionId), error => error.status === 403);
  assert.equal(f.records('mentorship_goals').length, 1);
});

test('general alumni connections and administrators do not become student mentorships', async () => {
  const f = fixture();
  f.seed('connections', { _id: connectionId, requesterAuthId: mentor._id, recipientAuthId: secondMentor._id, status: 'accepted' });
  assert.deepEqual(await f.service.list(mentor), []);
  await assert.rejects(f.service.get(mentor, connectionId), error => error.status === 403);
  await assert.rejects(f.service.list({ ...mentor, role: 'admin' }), error => error.status === 403);
});

test('invalid goals, statuses, notes and revisions are rejected', () => {
  const base = { status: 'completed', revision: 0 };
  assert.throws(() => validateGoal('unknown', base), error => error.status === 400);
  for (const changes of [{ status: 'accepted' }, { revision: -1 }, { revision: '0' }, { revision: undefined }, { note: {} }, { note: 'x'.repeat(1001) }]) {
    assert.throws(() => validateGoal('resume_building', { ...base, ...changes }), error => error.status === 400);
  }
  assert.equal(goalSnapshot([]).summary.percent, 0);
});

test('stale and simultaneous partner edits produce a conflict instead of lost progress', async () => {
  const f = fixture();
  const writes = await Promise.allSettled(Array.from({ length: 12 }, (_, index) => f.service.update(index % 2 ? student : mentor, connectionId, 'resume_building', { status: index % 2 ? 'completed' : 'in_progress', revision: 0 })));
  assert.equal(writes.filter(result => result.status === 'fulfilled').length, 1);
  assert.ok(writes.filter(result => result.status === 'rejected').every(result => result.reason.status === 409));
  assert.equal(f.records('mentorship_goals').length, 1);
  assert.equal((await f.service.get(student, connectionId)).goals[0].revision, 1);
});
