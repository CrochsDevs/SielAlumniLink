import test from 'node:test';
import assert from 'node:assert/strict';
import { competencySnapshot, validateCompetency, validateMentorEvaluation } from './competency.policy.js';
import { createCompetencyService } from './competency.service.js';

function fixture() {
  const collections = new Map();
  const equal = (left, right) => String(left) === String(right);
  const matches = (doc, query) => Object.entries(query).every(([key, value]) => key === '$or' ? value.some(part => matches(doc, part)) : value?.$in ? value.$in.some(item => equal(doc[key], item)) : equal(doc[key], value));
  const bucket = name => { if (!collections.has(name)) collections.set(name, new Map()); return collections.get(name); };
  const db = { collection(name) {
    const records = bucket(name);
    return {
      async findOne(query) { return structuredClone([...records.values()].find(record => matches(record, query)) || null); },
      find(query) { return { toArray: async () => structuredClone([...records.values()].filter(record => matches(record, query))) }; },
      async updateOne({ _id }, update, options = {}) {
        let record = records.get(String(_id));
        if (!record && !options.upsert) return { matchedCount: 0 };
        if (!record) { record = { _id, ...update.$setOnInsert }; records.set(String(_id), record); }
        for (const [key, value] of Object.entries(update.$set || {})) {
          if (key.startsWith('assessments.')) { record.assessments ||= {}; record.assessments[key.slice(12)] = value; }
          else record[key] = value;
        }
        for (const key of Object.keys(update.$unset || {})) if (key.startsWith('assessments.')) delete record.assessments?.[key.slice(12)];
        return { matchedCount: 1 };
      },
    };
  } };
  return { service: createCompetencyService(db), seed: (name, record) => bucket(name).set(String(record._id), structuredClone(record)) };
}
const student = { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', email: 'student@example.test', role: 'student' };
const other = { _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', email: 'other@example.test', role: 'student' };
const mentor = { _id: 'cccccccccccccccccccccccc', email: 'mentor@example.test', role: 'alumni' };
const assessment = { rating: 2, target: 3, evidence: 'Presented a class project.', goal: 'Practice presenting independently.' };
function mentorship(status = 'accepted') {
  const f = fixture();
  for (const user of [student, other, mentor]) { f.seed('auth', user); f.seed('users', { _id: user._id, authId: user._id, email: user.email, name: user === mentor ? 'Alumni Mentor' : 'Student' }); }
  f.seed('connections', { _id: 'connection', requesterAuthId: student._id, recipientAuthId: mentor._id, status });
  return f;
}

test('framework has exactly the three Module 11 skill areas without invented scores', () => {
  const result = competencySnapshot(null);
  assert.deepEqual(result.framework.map(item => item.name), ['Technical Skills', 'Communication Skills', 'Leadership Skills']);
  assert.equal(result.assessedCount, 0); assert.equal(result.averageLevel, null);
  assert.equal(result.gaps.every(gap => gap.currentLevel === null && gap.gap === null), true);
});
test('validation rejects invalid levels, lower targets, unknown keys and oversized notes', () => {
  assert.deepEqual(validateCompetency('communication', { ...assessment, evidence: ' example ' }), { ...assessment, evidence: 'example' });
  for (const changes of [{ rating: 0 }, { rating: 5 }, { rating: '3' }, { rating: 2.5 }, { target: 1 }, { target: 5 }, { evidence: 'x'.repeat(2001) }, { goal: 'x'.repeat(1001) }]) assert.throws(() => validateCompetency('communication', { ...assessment, ...changes }), error => error.status === 400);
  assert.throws(() => validateCompetency('__proto__', assessment), error => error.status === 400);
  for (const changes of [{ rating: 5 }, { feedback: ' ' }, { feedback: 'x'.repeat(2001) }]) assert.throws(() => validateMentorEvaluation('technical', { rating: 3, feedback: 'Good work', ...changes }), error => error.status === 400);
});
test('self-assessments belong to the authenticated student and ignore body ownership fields', async () => {
  const { service } = fixture();
  await service.save(student, 'communication', { ...assessment, authId: other._id, _id: other._id });
  const own = await service.get(student), stranger = await service.get(other);
  assert.equal(own.assessments[0].evidence, assessment.evidence); assert.equal(own.assessedCount, 1);
  assert.equal(own.averageLevel, 2); assert.equal(own.focusCount, 1); assert.equal(stranger.assessedCount, 0);
});
test('updating one assessment preserves others and recalculates progress', async () => {
  const { service } = fixture();
  await service.save(student, 'communication', assessment);
  await service.save(student, 'leadership', { rating: 4, target: 4, evidence: 'Led a team.', goal: '' });
  const result = await service.save(student, 'communication', { ...assessment, rating: 3 });
  assert.equal(result.assessedCount, 2); assert.equal(result.averageLevel, 3.5); assert.equal(result.focusCount, 0);
});
test('reset removes only the authenticated student self-assessment', async () => {
  const { service } = fixture();
  await service.save(student, 'communication', assessment); await service.save(other, 'communication', assessment);
  await service.reset(other, 'communication'); assert.equal((await service.get(student)).assessedCount, 1);
  assert.equal((await service.reset(student, 'communication')).averageLevel, null);
});
test('only accepted alumni mentors can read and evaluate connected students', async () => {
  for (const status of ['pending', 'declined']) {
    const { service } = mentorship(status);
    await assert.rejects(service.details(mentor, student._id), error => error.status === 403);
    await assert.rejects(service.evaluate(mentor, student._id, 'technical', { rating: 2, feedback: 'Feedback' }), error => error.status === 403);
  }
  const { service } = mentorship();
  await assert.rejects(service.details(mentor, other._id), error => error.status === 403);
  await assert.rejects(service.evaluate(student, student._id, 'technical', { rating: 2, feedback: 'Feedback' }), error => error.status === 403);
  assert.deepEqual((await service.mentees(mentor)).map(item => item.authId), [student._id]);
});
test('mentor evaluations persist separately, expose feedback, and identify gaps', async () => {
  const { service } = mentorship();
  await service.save(student, 'technical', { ...assessment, rating: 4, target: 4 });
  await service.evaluate(mentor, student._id, 'technical', { rating: 2, feedback: 'Practice debugging independently.', mentorAuthId: other._id });
  const result = await service.get(student);
  assert.equal(result.assessments[0].rating, 4); assert.equal(result.mentorEvaluations[0].mentorAuthId, mentor._id);
  assert.equal(result.mentorEvaluations[0].feedback, 'Practice debugging independently.');
  assert.deepEqual(result.gaps[0], { key: 'technical', currentLevel: 2, target: 4, gap: 2, basis: 'mentor' });
  assert.equal(result.focusCount, 1);
  await service.evaluate(mentor, student._id, 'technical', { rating: 3, feedback: 'Improved independence.' });
  assert.equal((await service.get(student)).mentorEvaluations.length, 1);
  await service.reset(student, 'technical'); assert.equal((await service.get(student)).mentorEvaluations.length, 1);
});
test('most recent mentor evaluation determines the gap; legacy self records are retained but excluded', () => {
  const result = competencySnapshot({ assessments: { communication: assessment, teamwork: { rating: 4, target: 4 } } }, [
    { competencyKey: 'communication', rating: 1, updatedAt: '2026-01-01' },
    { competencyKey: 'communication', rating: 3, updatedAt: '2026-02-01' },
  ]);
  assert.equal(result.assessedCount, 1); assert.equal(result.gaps[1].gap, 0); assert.equal(result.gaps[1].currentLevel, 3);
});
