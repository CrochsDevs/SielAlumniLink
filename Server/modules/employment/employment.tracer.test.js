import assert from 'node:assert/strict';
import test from 'node:test';
import { withTracerEmployment } from './employment.tracer.js';
import { employmentState, employmentReport, updateEmployment, assertEmploymentRevision } from './employment.policy.js';
import { createUserModel } from '../users/users.models.js';
import { createEmploymentModel } from './employment.models.js';

const survey = {
  authId: 'account', status: 'Employed', company: 'Survey Company', position: 'Developer',
  location: 'Manila', employmentDate: new Date('2025-06-01'), updatedAt: new Date('2026-10-01'),
};

test('existing tracer responses populate all four employment statuses without inventing industry or dates', () => {
  for (const status of ['Employed', 'Self-employed', 'Unemployed', 'Studying']) {
    const tracer = { ...survey, status, employmentDate: null };
    const profile = { authId: 'account' };
    const result = withTracerEmployment(profile, tracer);
    const state = employmentState(result);
    assert.equal(state.employmentStatus, status);
    assert.equal(state.currentCompany, ['Employed', 'Self-employed'].includes(status) ? survey.company : '');
    assert.equal(state.industry, '');
    assert.equal(state.startDate, '');
    assert.deepEqual(profile, { authId: 'account' });
    assert.equal(tracer.status, status);
    assert.equal(employmentState(withTracerEmployment(profile, tracer)).historyRevision, state.historyRevision);
  }
});

test('newer direct employment edits win and later surveys become visible again', () => {
  const merged = withTracerEmployment({}, survey);
  const saved = updateEmployment(merged, {
    employmentStatus: 'Self-employed', currentCompany: 'My Business', position: 'Owner',
    industry: 'Retail', startDate: '2026-10',
  }, new Date('2026-10-15'));
  assert.equal(withTracerEmployment(saved, survey), saved);
  const newerSurvey = { ...survey, status: 'Studying', updatedAt: new Date('2026-11-01') };
  const next = withTracerEmployment(saved, newerSurvey);
  assert.equal(employmentState(next).employmentStatus, 'Studying');
  assert.equal(next.employmentHistory.length, 2);
  assert.equal(next.employmentHistory.some(job => job.current), false);
  assert.throws(() => assertEmploymentRevision(next, employmentState(saved).historyRevision), { status: 409 });
});

test('same-role survey retains industry and role ID while company changes preserve career history', () => {
  const profile = { employmentUpdatedAt: new Date('2026-09-01'), employmentHistory: [
    { _id: 'role', company: survey.company, position: survey.position, industry: 'Technology', current: true, startDate: '2025-01' },
  ] };
  const same = withTracerEmployment(profile, survey);
  assert.equal(same.employmentHistory.length, 1);
  assert.equal(same.employmentHistory[0]._id, 'role');
  assert.equal(employmentState(same).industry, 'Technology');
  const changed = withTracerEmployment(profile, { ...survey, company: 'New Company' });
  assert.equal(changed.employmentHistory.length, 2);
  assert.equal(changed.employmentHistory[0].current, false);
  assert.equal(profile.employmentHistory[0].current, true);
  const report = employmentReport([changed]);
  assert.equal(report.summary.employmentRate, 100);
  assert.equal(report.summary.alumniWithCareerChanges, 1);
  assert.equal(report.industryDistribution[0].industry, 'Not specified');
});

test('missing or undated surveys cannot replace a known employment record', () => {
  const profile = { employmentStatus: 'Unemployed' };
  for (const tracer of [null, { status: 'invalid' }, { ...survey, updatedAt: null }]) {
    assert.equal(withTracerEmployment(profile, tracer), profile);
  }
});

test('own profile lookup reads the latest survey for the same account only', async () => {
  const queries = [];
  const model = createUserModel({ collection(name) { return {
    async findOne(query, options) {
      queries.push({ name, query, options });
      return name === 'users' ? { _id: 'profile', authId: 'account' } : survey;
    },
  }; } });
  const profile = await model.findByAuthId('account');
  assert.equal(employmentState(profile).currentCompany, survey.company);
  assert.deepEqual(queries[1].query, { authId: 'account' });
  assert.equal(queries[1].options.sort.updatedAt, -1);
});

test('admin reporting uses tracer employment and removes internal lookup data', async () => {
  const model = createEmploymentModel({ collection() { return {
    aggregate(pipeline) {
      assert.ok(pipeline.some(stage => stage.$lookup?.from === 'tracer_responses'));
      return { async toArray() { return [{ _id: 'profile', authId: 'account', _employmentTracer: [survey] }]; } };
    },
  }; } });
  const profiles = await model.alumniProfiles();
  assert.equal(profiles[0]._employmentTracer, undefined);
  const report = employmentReport(profiles);
  assert.equal(report.summary.employmentRate, 100);
  assert.equal(report.alumni[0].currentCompany, survey.company);
});

test('history-only writes retain a tracer-supplied non-working status', async () => {
  const model = createEmploymentModel({ collection() { return {
    async updateOne(_filter, update) {
      assert.equal(update.$set.employmentStatus, 'Studying');
      return { matchedCount: 1 };
    },
  }; } });
  const profile = withTracerEmployment({ _id: 'profile' }, { ...survey, status: 'Studying' });
  const saved = await model.updateProfile(profile, { employmentHistory: [], employmentUpdatedAt: new Date('2026-11-01') });
  assert.equal(saved.employmentStatus, 'Studying');
  assert.equal(saved.employmentRevision, 1);
});
