import assert from 'node:assert/strict';
import test from 'node:test';
import { createMentorshipService } from './mentorship.service.js';
import { goalSnapshot, validateGoal } from './mentorship.policy.js';
import { INTERVIEW_QUESTIONS } from './interview.policy.js';

const student = { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', role: 'student', email: 'student@example.test' };
const mentor = { _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', role: 'alumni', email: 'mentor@example.test' };
const stranger = { _id: 'cccccccccccccccccccccccc', role: 'student', email: 'stranger@example.test' };
const secondMentor = { _id: 'dddddddddddddddddddddddd', role: 'alumni', email: 'second@example.test' };
const connectionId = 'eeeeeeeeeeeeeeeeeeeeeeee';
const interviewAnswers = text => Object.fromEntries(INTERVIEW_QUESTIONS.map(q => [q.id, `${text} ${q.id}`]));

test('interview drafts, submission, revisions, and completion persist with private drafts and exact submitted answers', async () => {
  const { service } = fixture();
  const work = tracker => tracker.goals[1].interview;
  let result = await service.interview(student, connectionId, { action: 'draft', revision: 0, answers: { introduction: 'Private draft' } });
  assert.equal(result.goals[1].status, 'in_progress');
  assert.equal(work(result).draft.introduction, 'Private draft');
  assert.equal(work(await service.get(mentor, connectionId)).draft, undefined);
  assert.equal(work(await service.get(mentor, connectionId)).submission, null);
  const answers = interviewAnswers('Initial answer');
  result = await service.interview(student, connectionId, { action: 'submit', revision: 1, answers });
  assert.equal(work(result).state, 'submitted');
  assert.deepEqual(work(await service.get(mentor, connectionId)).submission.answers, answers);
  await assert.rejects(service.interview(student, connectionId, { action: 'draft', revision: 2, answers }), { status: 409 });
  const feedback = interviewAnswers('Use a specific example');
  result = await service.interview(mentor, connectionId, { action: 'request_revision', revision: 2, feedback });
  assert.equal(work(result).state, 'revision_requested');
  result = await service.interview(student, connectionId, { action: 'draft', revision: 3, answers: interviewAnswers('Revised') });
  assert.deepEqual(work(result).submission.answers, answers, 'draft edits do not alter submitted evidence');
  assert.deepEqual(work(result).feedback, feedback);
  result = await service.interview(student, connectionId, { action: 'submit', revision: 4, answers: interviewAnswers('Revised') });
  assert.equal(work(result).submission.version, 2);
  assert.deepEqual(work(result).feedback, {});
  result = await service.interview(mentor, connectionId, { action: 'complete', revision: 5, feedback: interviewAnswers('Good example') });
  assert.equal(result.goals[1].status, 'completed');
  assert.equal(result.summary.percent, 33);
  assert.equal(work(result).reviewedBy, mentor._id);
  assert.ok(result.goals[1].completedAt);
  assert.equal(work(await service.get(student, connectionId)).state, 'completed');
  await assert.rejects(service.update(mentor, connectionId, 'interview_preparation', { status: 'completed', revision: 6 }), { status: 409 });
  result = await service.interview(mentor, connectionId, { action: 'request_revision', revision: 6, feedback });
  assert.equal(result.summary.completed, 0);
  assert.equal(result.goals[1].completedAt, null);
});

test('interview access and mutations enforce accepted connection and participant roles', async () => {
  const f = fixture();
  const request = { action: 'submit', revision: 0, answers: interviewAnswers('Answer') };
  for (const actor of [stranger, secondMentor, { ...mentor, role: 'admin' }]) {
    await assert.rejects(f.service.interview(actor, connectionId, request), { status: 403 });
  }
  await assert.rejects(f.service.interview(mentor, connectionId, request), { status: 403 });
  await assert.rejects(f.service.interview(student, connectionId, { action: 'complete', revision: 0, feedback: interviewAnswers('Feedback') }), { status: 403 });
  await f.service.interview(student, connectionId, request);
  const otherConnection = 'ffffffffffffffffffffffff';
  f.seed('connections', { _id: otherConnection, requesterAuthId: student._id, recipientAuthId: secondMentor._id, status: 'accepted' });
  assert.equal((await f.service.get(secondMentor, otherConnection)).goals[1].interview.submission, null);
  f.seed('connections', { _id: connectionId, requesterAuthId: student._id, recipientAuthId: mentor._id, status: 'declined' });
  await assert.rejects(f.service.interview(mentor, connectionId, { action: 'complete', revision: 1, feedback: interviewAnswers('Feedback') }), { status: 403 });
  await assert.rejects(f.service.get(student, connectionId), { status: 403 });
});

test('interview rejects incomplete submissions, malformed answers, and reviews without feedback', async () => {
  const { service } = fixture();
  for (const answers of [{}, { introduction: 'Only one answer' }, { ...interviewAnswers('Answer'), extra: 'spoofed' }, { ...interviewAnswers('Answer'), introduction: {} }, { ...interviewAnswers('Answer'), introduction: 'x'.repeat(3001) }]) {
    await assert.rejects(service.interview(student, connectionId, { action: 'submit', revision: 0, answers }), { status: 400 });
  }
  await assert.rejects(service.interview(mentor, connectionId, { action: 'complete', revision: 0, feedback: interviewAnswers('Feedback') }), { status: 409 });
  await service.interview(student, connectionId, { action: 'submit', revision: 0, answers: interviewAnswers('Answer') });
  await assert.rejects(service.interview(mentor, connectionId, { action: 'complete', revision: 1, feedback: {} }), { status: 400 });
  await assert.rejects(service.interview(student, connectionId, { action: 'unknown', revision: 1 }), { status: 400 });
});

test('concurrent interview saves conflict without overwriting answers', async () => {
  const { service } = fixture();
  const results = await Promise.allSettled(['First', 'Second'].map(answer => service.interview(student, connectionId, { action: 'draft', revision: 0, answers: { introduction: answer } })));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.status, 409);
  await assert.rejects(service.interview(student, connectionId, { action: 'draft', revision: 0, answers: {} }), { status: 409 });
  assert.equal((await service.get(student, connectionId)).goals[1].revision, 1);
});

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
  tracker = await service.update(mentor, connectionId, 'interview_preparation', { status: 'completed', revision: 0 });
  assert.equal(tracker.summary.percent, 67);
  tracker = await service.update(mentor, connectionId, 'career_planning', { status: 'completed', revision: 0 });
  assert.equal(tracker.summary.percent, 100);
});

test('reopening or resetting a goal updates completion without affecting other goals', async () => {
  const { service } = fixture();
  await service.update(mentor, connectionId, 'resume_building', { status: 'completed', revision: 0, note: 'First draft' });
  await service.update(mentor, connectionId, 'career_planning', { status: 'in_progress', revision: 0 });
  let tracker = await service.update(mentor, connectionId, 'resume_building', { status: 'in_progress', revision: 1 });
  assert.equal(tracker.goals[0].completedAt, null);
  assert.equal(tracker.goals[0].note, 'First draft');
  assert.equal(tracker.goals[2].status, 'in_progress');
  tracker = await service.update(mentor, connectionId, 'resume_building', { status: 'not_started', note: '', revision: 2 });
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
  const writes = await Promise.allSettled(Array.from({ length: 12 }, (_, index) => f.service.update(index % 2 ? student : mentor, connectionId, 'resume_building', { status: 'in_progress', note: 'Working on my resume', revision: 0 })));
  assert.equal(writes.filter(result => result.status === 'fulfilled').length, 1);
  assert.ok(writes.filter(result => result.status === 'rejected').every(result => result.reason.status === 409));
  assert.equal(f.records('mentorship_goals').length, 1);
  assert.equal((await f.service.get(student, connectionId)).goals[0].revision, 1);
});

test('saved portfolio and career preferences start progress automatically without writing goal records', async () => {
  const f = fixture();
  f.seed('student_portfolios', { _id: student._id, skills: ['React'], updatedAt: new Date() });
  f.seed('mentor_match_preferences', { _id: student._id, interests: ['Software engineering'], careerGoals: 'Become a frontend developer', updatedAt: new Date() });
  const tracker = await f.service.get(student, connectionId);
  assert.deepEqual(tracker.goals.map(goal => goal.status), ['in_progress', 'not_started', 'in_progress']);
  assert.equal(tracker.summary.percent, 0);
  assert.equal(tracker.summary.inProgress, 2);
  assert.ok(tracker.goals[0].activitySources[0].label.includes('Portfolio'));
  assert.equal(tracker.goals[2].activitySources.length, 2);
  assert.equal(f.records('mentorship_goals').length, 0);
  assert.deepEqual((await f.service.get(mentor, connectionId)).summary, tracker.summary);
});

test('resume checklist exposes each saved section to the student and connected mentor', async () => {
  const f = fixture();
  f.seed('users', { _id: student._id, authId: student._id, bio: 'My summary', contactNumber: 'PRIVATE_PHONE', profileLinks: [{ type: 'github', url: 'https://github.com/example' }] });
  f.seed('student_portfolios', { _id: student._id, skills: ['React'], projects: [{ title: 'Alumni app' }], research: [{ title: 'My paper' }], certifications: ['Certificate'], seminars: ['Workshop'], awards: ['Award'] });
  const tracker = await f.service.get(mentor, connectionId);
  const goal = tracker.goals[0];
  assert.deepEqual(goal.resumeChecklist.map(section => section.label), ['About', 'Contact & links', 'Skills', 'Projects', 'Research Papers', 'Certifications', 'Seminars Attended', 'Awards']);
  assert.ok(goal.resumeChecklist.every(section => section.filled));
  assert.equal(goal.activitySources.length, 8);
  assert.equal(goal.status, 'in_progress', 'filled sections still require mentor confirmation');
  assert.equal(JSON.stringify(goal.resumeChecklist).includes('PRIVATE_PHONE'), false);
  assert.deepEqual((await f.service.get(student, connectionId)).goals[0].resumeChecklist, goal.resumeChecklist);
  assert.equal(f.records('mentorship_goals').length, 0);
});

test('resume checklist reflects cleared fields without counting empty entries or login email as filled', async () => {
  const f = fixture();
  f.seed('users', { _id: student._id, authId: student._id, email: student.email, bio: ' ', contactEmail: ' ', skills: ['Legacy skill'], profileLinks: [], github: 'https://github.com/old' });
  f.seed('student_portfolios', { _id: student._id, skills: [], projects: [{ title: ' ' }], research: [], certifications: [' '], seminars: [], awards: [] });
  let goal = (await f.service.get(mentor, connectionId)).goals[0];
  assert.ok(goal.resumeChecklist.every(section => !section.filled));
  assert.equal(goal.status, 'not_started');
  f.seed('users', { _id: student._id, authId: student._id, profileLinks: [{ type: 'website', url: 'https://example.test' }] });
  goal = (await f.service.get(mentor, connectionId)).goals[0];
  assert.equal(goal.resumeChecklist.find(section => section.key === 'contact').filled, true);
  assert.equal(goal.status, 'in_progress');
});

test('unrelated students and cleared preferences do not invent automatic progress', async () => {
  const f = fixture();
  f.seed('student_portfolios', { _id: stranger._id, skills: ['React'] });
  f.seed('mentor_match_preferences', { _id: stranger._id, careerGoals: 'Find a job' });
  f.seed('users', { _id: student._id, authId: student._id, interests: ['Engineering'] });
  f.seed('mentor_match_preferences', { _id: student._id, interests: [], careerGoals: '' });
  assert.equal((await f.service.get(student, connectionId)).summary.inProgress, 0);
});

test('mentor career review includes actual goals and interests with explicit clearing respected', async () => {
  const f = fixture();
  const updatedAt = new Date('2026-11-01');
  f.seed('users', { _id: student._id, authId: student._id, interests: ['Engineering'], privateField: 'DO_NOT_EXPOSE' });
  let plan = (await f.service.get(mentor, connectionId)).goals[2].careerPlan;
  assert.deepEqual(plan.interests, ['Engineering']);
  assert.equal(plan.careerGoals, '');
  f.seed('mentor_match_preferences', { _id: student._id, interests: ['Software development'], careerGoals: 'Become a frontend developer\nBuild three projects.', updatedAt, privateField: 'DO_NOT_EXPOSE' });
  plan = (await f.service.get(mentor, connectionId)).goals[2].careerPlan;
  assert.deepEqual(plan.interests, ['Software development']);
  assert.equal(plan.careerGoals, 'Become a frontend developer\nBuild three projects.');
  assert.deepEqual(plan.goalsUpdatedAt, updatedAt);
  assert.equal(JSON.stringify(plan).includes('DO_NOT_EXPOSE'), false);
  f.seed('mentor_match_preferences', { _id: student._id, interests: [], careerGoals: '', updatedAt });
  plan = (await f.service.get(mentor, connectionId)).goals[2].careerPlan;
  assert.deepEqual(plan.interests, []);
  assert.equal(plan.careerGoals, '');
  await assert.rejects(f.service.get(secondMentor, connectionId), { status: 403 });
});

test('logging interview practice starts only that connection and only its mentor can complete it', async () => {
  const f = fixture();
  const secondId = 'ffffffffffffffffffffffff';
  f.seed('connections', { _id: secondId, requesterAuthId: student._id, recipientAuthId: secondMentor._id, status: 'accepted' });
  let tracker = await f.service.update(student, connectionId, 'interview_preparation', { status: 'not_started', note: 'Practiced STAR answers and described my projects.', revision: 0 });
  assert.equal(tracker.goals[1].status, 'in_progress');
  assert.equal(tracker.summary.percent, 0);
  assert.equal((await f.service.get(student, secondId)).goals[1].status, 'not_started');
  await assert.rejects(f.service.update(student, connectionId, 'interview_preparation', { status: 'completed', revision: 1, confirmedByAuthId: mentor._id }), error => error.status === 403);
  await assert.rejects(f.service.update(secondMentor, connectionId, 'interview_preparation', { status: 'completed', revision: 1 }), error => error.status === 403);
  tracker = await f.service.update(mentor, connectionId, 'interview_preparation', { status: 'completed', revision: 1 });
  assert.equal(tracker.goals[1].mentorConfirmed, true);
  assert.equal(tracker.summary.percent, 33);
  const completedAt = tracker.goals[1].completedAt;
  tracker = await f.service.update(student, connectionId, 'interview_preparation', { status: 'completed', note: 'Added a follow-up reflection.', revision: 2 });
  assert.equal(tracker.goals[1].mentorConfirmed, true);
  assert.deepEqual(tracker.goals[1].completedAt, completedAt);
  assert.equal(tracker.summary.percent, 33);
  await assert.rejects(f.service.update(student, connectionId, 'interview_preparation', { status: 'not_started', revision: 3 }), error => error.status === 403);
});

test('self-reported historical completion still needs mentor confirmation', () => {
  const result = goalSnapshot([{ goalKey: 'resume_building', status: 'completed', updatedByRole: 'student', note: 'Finished draft' }]);
  assert.equal(result.goals[0].status, 'in_progress');
  assert.equal(result.goals[0].completedAt, null);
  assert.equal(result.summary.percent, 0);
});
