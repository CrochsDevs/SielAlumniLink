import assert from 'node:assert/strict';
import test from 'node:test';
import { employmentState, updateEmployment, addPastEmployment, employmentReport, changeExperience } from './employment.policy.js';

const now = new Date('2026-10-14T08:00:00Z');
const job = { currentCompany: 'Example Ltd', position: 'Engineer', industry: 'Engineering', location: 'Manila', startDate: '2025-01', employmentStatus: 'Employed' };

test('new employment creates a current role and preserves existing profile history', () => {
  const old = { company: 'Past Ltd', position: 'Intern', startDate: '2024-01', endDate: '2024-05', current: false };
  const update = updateEmployment({ employmentHistory: [old] }, job, now);
  assert.equal(update.employmentHistory.length, 2);
  assert.deepEqual(update.employmentHistory[0], old);
  assert.equal(update.employmentHistory[1].current, true);
  assert.equal(employmentState(update).industry, 'Engineering');
});

test('changing company or position preserves the old role and records a career step', () => {
  const first = updateEmployment({}, job, now);
  const next = updateEmployment(first, { ...job, position: 'Senior Engineer', startDate: '2026-08' }, now);
  assert.equal(next.employmentHistory.length, 2);
  assert.equal(next.employmentHistory[0].current, false);
  assert.equal(next.employmentHistory[0].endDate, '2026-08');
  assert.equal(next.employmentHistory[1].position, 'Senior Engineer');
  const report = employmentReport([{ _id: 'a', ...next }]);
  assert.equal(report.summary.alumniWithCareerChanges, 1);
  assert.equal(report.alumni[0].transitions[0].positionChanged, true);
});

test('correcting industry or start month does not duplicate the same role', () => {
  const first = updateEmployment({}, job, now);
  const next = updateEmployment(first, { ...job, industry: 'Manufacturing', startDate: '2024-12' }, now);
  assert.equal(next.employmentHistory.length, 1);
  assert.equal(next.employmentHistory[0]._id, first.employmentHistory[0]._id);
  assert.equal(next.employmentHistory[0].industry, 'Manufacturing');
});

test('unemployment ends current roles without losing career history', () => {
  const next = updateEmployment(updateEmployment({}, job, now), { employmentStatus: 'Unemployed' }, now);
  assert.equal(next.employmentHistory[0].current, false);
  assert.equal(next.employmentHistory[0].endDate, '2026-10');
  assert.equal(employmentState(next).currentCompany, '');
  assert.equal(employmentState(next).employmentStatus, 'Unemployed');
});

test('validates statuses, required job details, types, and dates', () => {
  for (const change of [{ employmentStatus: 'invalid' }, { currentCompany: ' ' }, { industry: {} }, { position: '' }, { startDate: '2026-13' }, { startDate: '2027-01' }]) {
    assert.throws(() => updateEmployment({}, { ...job, ...change }, now), error => error.status === 400);
  }
  const first = updateEmployment({}, job, now);
  assert.throws(() => updateEmployment(first, { ...job, position: 'Other', startDate: '2024-01' }, now), /previous current role/);
});

test('past roles require ordered dates and cannot change the current role', () => {
  const first = updateEmployment({}, job, now);
  const data = { company: 'Past', position: 'Intern', startDate: '2023-01', endDate: '2023-06', current: true };
  const next = { ...first, ...addPastEmployment(first, data, now) };
  assert.equal(next.employmentHistory[1].current, false);
  assert.equal(employmentState(next).currentCompany, 'Example Ltd');
  assert.throws(() => addPastEmployment(first, { ...data, endDate: '2022-01' }, now), /on or after/);
  assert.throws(() => addPastEmployment(first, { ...data, endDate: '2027-01' }, now), /future/);
});

test('reports handle unknown status, self-employment, industry grouping, and the rate denominator', () => {
  const profiles = [
    { _id: 'a', batch: '2025', program: 'Engineering', ...updateEmployment({}, job, now) },
    { _id: 'b', batch: '2025', ...updateEmployment({}, { ...job, industry: 'engineering', employmentStatus: 'Self-employed' }, now) },
    { _id: 'c', employmentStatus: 'Unemployed' },
    { _id: 'd', employmentStatus: 'Studying' },
    { _id: 'e' },
  ];
  const report = employmentReport(profiles);
  assert.deepEqual(report.summary, { totalAlumni: 5, reported: 4, notReported: 1, employed: 2, employmentRate: 50, reportingRate: 80, alumniWithCareerChanges: 0 });
  assert.equal(report.industryDistribution.length, 1);
  assert.equal(report.industryDistribution[0].count, 2);
  assert.equal(report.industryDistribution[0].percentage, 100);
  assert.equal(employmentReport(profiles, { batch: '2025' }).summary.employmentRate, 100);
  assert.equal(employmentReport(profiles, { program: 'Engineering' }).summary.totalAlumni, 1);
  assert.equal(employmentReport([]).summary.employmentRate, 0);
});

test('legacy current roles populate employment; stale roles are hidden for non-working statuses', () => {
  const profile = { employmentHistory: [{ company: 'Legacy', role: 'Developer', current: true }] };
  assert.equal(employmentState(profile).employmentStatus, 'Employed');
  assert.equal(employmentState(profile).position, 'Developer');
  assert.equal(employmentState({ ...profile, employmentStatus: 'Studying' }).currentCompany, '');
  assert.equal(employmentReport([profile]).industryDistribution[0].industry, 'Not specified');
});

process.env.MONGO_URI ||= 'mongodb://127.0.0.1:27017';
const { default: routes } = await import('./employment.routes.js');
const { default: UserModel } = await import('../users/users.models.js');
const { EmploymentModel } = await import('./employment.models.js');
const { saveEmployment, getEmployment, addExperience, removeExperience, getReport } = await import('./employment.controllers.js');
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test('employment endpoints require login, own updates require alumni/admin, reports require admin', () => {
  assert.equal(routes.stack[0].handle.name, 'protect');
  const reportGuard = routes.stack.find(layer => layer.route?.path === '/reports').route.stack[0].handle;
  const ownGuard = routes.stack.find(layer => !layer.route && layer !== routes.stack[0]).handle;
  for (const role of ['student', 'alumni', 'admin']) {
    for (const [guard, expected] of [[reportGuard, role === 'admin'], [ownGuard, role !== 'student']]) {
      const res = response(); let allowed = false;
      guard({ user: { role } }, res, () => { allowed = true; });
      assert.equal(allowed, expected);
      assert.equal(res.statusCode, expected ? 200 : 403);
    }
  }
});

test('own employment workflow persists across reads and cannot target another account', async t => {
  let profile = { _id: 'profile-a', authId: 'auth-a', employmentHistory: [] };
  t.mock.method(UserModel, 'findByAuthId', async id => { assert.equal(id, 'auth-a'); return profile; });
  t.mock.method(EmploymentModel, 'updateProfile', async (old, update) => { assert.equal(old._id, 'profile-a'); profile = { ...old, ...update }; return profile; });
  const req = { user: { _id: 'auth-a', role: 'alumni' }, body: { ...job, revision: employmentState(profile).historyRevision, authId: 'victim', _id: 'victim', role: 'admin' } };
  let res = response(); await saveEmployment(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(profile.authId, 'auth-a');
  res = response(); await getEmployment(req, res);
  assert.equal(res.body.data.currentCompany, 'Example Ltd');
  req.body = { company: 'Past', position: 'Intern', startDate: '2023-01', endDate: '2023-06', revision: employmentState(profile).historyRevision };
  res = response(); await addExperience(req, res);
  assert.equal(res.body.data.employmentHistory.length, 2);
  req.params = { index: '1' }; req.body = { revision: employmentState(profile).historyRevision };
  res = response(); await removeExperience(req, res);
  assert.equal(res.body.data.employmentHistory.length, 1);
});

test('deletion rejects stale revisions and removing the active role', async t => {
  const profile = { ...updateEmployment({}, job, now), _id: 'profile-a' };
  t.mock.method(UserModel, 'findByAuthId', async () => profile);
  const write = t.mock.method(EmploymentModel, 'updateProfile', async () => assert.fail('must not write'));
  for (const [index, revision, expected] of [['0', '', 409], ['0', employmentState(profile).historyRevision, 400], ['99', employmentState(profile).historyRevision, 404]]) {
    const res = response();
    await removeExperience({ user: { _id: 'a' }, params: { index }, body: { revision } }, res);
    assert.equal(res.statusCode, expected);
  }
  assert.equal(write.mock.callCount(), 0);
});

test('report controller filters reports and rejects object filters', async t => {
  t.mock.method(EmploymentModel, 'alumniProfiles', async () => [{ _id: 'a', batch: '2025', employmentStatus: 'Unemployed' }, { _id: 'b', batch: '2024' }]);
  let res = response(); await getReport({ query: { batch: '2025' } }, res);
  assert.equal(res.body.data.summary.totalAlumni, 1);
  res = response(); await getReport({ query: { batch: { $ne: '' } } }, res);
  assert.equal(res.statusCode, 400);
});

const { updateMyProfile, updateMyExperience, getMyProfile } = await import('../users/users.controllers.js');
const experience = { ...job, company: job.currentCompany, current: true };
const edit = (profile, action, entry, index) => changeExperience(profile, {
  action, entry, index, revision: employmentState(profile).historyRevision,
}, now);

test('profile experience keeps status, role transitions and reports consistent', () => {
  const first = { employmentStatus: 'Unemployed', ...edit({ employmentStatus: 'Unemployed' }, 'add', experience) };
  assert.equal(employmentState(first).employmentStatus, 'Employed');
  assert.equal(employmentState(first).currentCompany, job.currentCompany);
  assert.equal(employmentReport([first]).summary.employed, 1);
  const second = { ...first, ...edit(first, 'edit', { ...experience, position: 'Senior Engineer', startDate: '2026-01' }, 0) };
  assert.equal(second.employmentHistory.length, 2);
  assert.equal(second.employmentHistory[0].position, 'Engineer');
  assert.equal(second.employmentHistory[0].endDate, '2026-01');
  assert.equal(second.employmentHistory[1].current, true);
  const ended = { ...second, ...edit(second, 'edit', { ...experience, position: 'Senior Engineer', startDate: '2026-01', endDate: '2026-09', current: false }, 1) };
  assert.equal(ended.employmentStatus, 'Unemployed');
  assert.equal(ended.employmentHistory[1].endDate, '2026-09');
  assert.equal(employmentReport([ended]).summary.employed, 0);
  assert.equal(employmentState(ended).currentCompany, '');
});

test('profile edits validate current and past roles and preserve existing role IDs', () => {
  for (const change of [{ startDate: '2099-01' }, { industry: '' }, { company: '' }, { current: 'true' }, { employmentStatus: 'Unemployed' }]) {
    assert.throws(() => edit({}, 'add', { ...experience, ...change }), error => error.status === 400);
  }
  const first = edit({}, 'add', { ...experience, employmentStatus: 'Self-employed' });
  const corrected = edit(first, 'edit', { ...experience, industry: 'Technology', employmentStatus: 'Self-employed' }, 0);
  assert.equal(corrected.employmentHistory.length, 1);
  assert.equal(corrected.employmentHistory[0]._id, first.employmentHistory[0]._id);
  assert.equal(corrected.employmentStatus, 'Self-employed');
  assert.throws(() => edit(first, 'remove', undefined, 0), error => error.status === 400);
  assert.throws(() => edit(first, 'edit', { ...experience, current: false, endDate: '2020-01' }, 0), error => error.status === 400);
  assert.throws(() => edit(first, 'add', { ...experience, current: false, endDate: '2099-01' }), error => error.status === 400);
  const added = { ...first, ...edit(first, 'add', { ...experience, company: 'Previous', current: false, startDate: '2022-01', endDate: '2022-06' }) };
  const past = edit(added, 'edit', { ...experience, company: 'Corrected previous', current: false, startDate: '2022-01', endDate: '2022-07' }, 1);
  assert.equal(past.employmentHistory[1]._id, added.employmentHistory[1]._id);
  assert.equal(past.employmentHistory[0].current, true);
  assert.equal(edit({ ...added, ...past }, 'remove', undefined, 1).employmentHistory.length, 1);
});

test('general profile writes cannot bypass employment validation through arrays or Mongo operators', async t => {
  const write = t.mock.method(UserModel, 'updateById', async () => assert.fail('must not write'));
  const fields = ['employmentHistory', 'employmentHistory.0.current', 'employmentStatus', 'employmentRevision', 'employmentUpdatedAt', 'historyRevision'];
  for (const field of fields) {
    for (const operator of [null, '$set', '$push', '$pull', '$addToSet', '$inc', '$unset']) {
      const body = operator ? { [operator]: { [field]: [] } } : { [field]: [] };
      const res = response();
      await updateMyProfile({ user: { _id: 'own', role: 'alumni' }, body }, res);
      assert.equal(res.statusCode, 400, JSON.stringify(body));
    }
  }
  assert.equal(write.mock.callCount(), 0);
});

test('profile experience endpoint owns its records and returns the shared revision for students and alumni', async t => {
  let profile = { _id: 'own-profile', authId: 'own-account', employmentStatus: 'Unemployed', employmentHistory: [] };
  t.mock.method(UserModel, 'findByAuthId', async id => { assert.equal(id, 'own-account'); return profile; });
  t.mock.method(EmploymentModel, 'updateProfile', async (old, patch) => { assert.equal(old._id, 'own-profile'); profile = { ...old, ...patch }; return profile; });
  for (const role of ['student', 'alumni']) {
    const req = { user: { _id: 'own-account', role }, body: {
      action: 'add', entry: experience, revision: employmentState(profile).historyRevision,
      authId: 'victim', _id: 'victim', role: 'admin',
    } };
    const res = response();
    await updateMyExperience(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.role, role);
    assert.equal(res.body.data.authId, 'own-account');
    assert.equal(res.body.data.employmentStatus, 'Employed');
    assert.equal(res.body.data.historyRevision, employmentState(profile).historyRevision);
    const read = response();
    await getMyProfile(req, read);
    assert.equal(read.body.data.historyRevision, res.body.data.historyRevision);
  }
});

test('both editing screens reject stale or missing revisions including status-only changes', async t => {
  const old = { _id: 'profile', employmentStatus: 'Unemployed', employmentHistory: [] };
  const current = { ...old, employmentStatus: 'Studying' };
  assert.notEqual(employmentState(old).historyRevision, employmentState(current).historyRevision);
  t.mock.method(UserModel, 'findByAuthId', async () => current);
  const write = t.mock.method(EmploymentModel, 'updateProfile', async () => assert.fail('must not write'));
  for (const revision of [undefined, employmentState(old).historyRevision]) {
    for (const [controller, body] of [
      [saveEmployment, job], [addExperience, { company: 'Past', position: 'Intern', startDate: '2022-01', endDate: '2022-06' }],
      [updateMyExperience, { action: 'add', entry: experience }],
      [updateMyExperience, { action: 'edit', index: 0, entry: experience }],
      [updateMyExperience, { action: 'remove', index: 0 }],
    ]) {
      const res = response();
      await controller({ user: { _id: 'own', role: 'alumni' }, body: { ...body, revision } }, res);
      assert.equal(res.statusCode, 409);
    }
  }
  assert.equal(write.mock.callCount(), 0);
});
