import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MongoClient, ObjectId } from 'mongodb';
import { createDevelopmentService } from './development.service.js';
import UserModel, { createUserModel } from '../users/users.models.js';
import AuthModel from '../auth/auth.models.js';
import { graduateUser, updateMyExperience, updateMyProfile } from '../users/users.controllers.js';
import { createEmploymentModel, EmploymentModel } from '../employment/employment.models.js';
import { updateEmployment, addPastEmployment, employmentReport, employmentState } from '../employment/employment.policy.js';

import { saveEmployment } from '../employment/employment.controllers.js';

test('career progression persists across graduation, employment changes and fresh sessions', { timeout: 60000 }, async t => {
  const client = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  const databaseName = `SielAlumni_career_test_${randomUUID().replaceAll('-', '')}`;
  const db = client.db(databaseName);
  try {
    await client.connect();
    const users = createUserModel(db);
    const employment = createEmploymentModel(db);
    const development = createDevelopmentService(db);
    const student = { _id: new ObjectId(), role: 'student', email: 'progression@example.test' };
    const other = { _id: new ObjectId(), role: 'alumni', email: 'other@example.test' };
    await db.collection('auth').insertMany([student, other]);
    await users.createUserProfile(String(student._id), { email: student.email, name: 'Progression Student', role: 'student', program: 'BS IT', batch: '2025' });
    await users.createUserProfile(other._id, { email: other.email, name: 'Other Alumni', role: 'alumni' });

    await t.test('profile lookup supports string and ObjectId references in both directions', async () => {
      for (const account of [student, other]) {
        for (const id of [account._id, String(account._id)]) {
          assert.equal((await users.findByAuthId(id))?.email, account.email);
        }
      }
      assert.equal(await users.findByAuthId(new ObjectId()), null);
    });

    await development.saveAcademic(student, { key: 'enrolled', date: '2022-08-01' });
    await development.saveAcademic(student, { key: 'semester', date: '2022-12-01' });
    await development.savePortfolio(student, 'skills', ['JavaScript']);
    await development.saveInternship(student, { company: 'Campus Tech', supervisor: 'Mentor', requiredHours: 100, hoursCompleted: 100, startDate: '2024-01-01', endDate: '2024-04-01' });
    const before = await development.snapshot(student);

    await t.test('admin graduation preserves account identity, saved records and repeat graduation date', async () => {
      t.mock.method(AuthModel, 'findByEmail', email => db.collection('auth').findOne({ email }));
      t.mock.method(AuthModel, 'updateRoleById', (id, role) => db.collection('auth').updateOne({ _id: id }, { $set: { role } }));
      for (const method of ['findByAuthId', 'updateById', 'createUserProfile']) t.mock.method(UserModel, method, (...args) => users[method](...args));
      const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
      await graduateUser({ user: { role: 'admin' }, body: { email: student.email } }, res);
      assert.equal(res.code, 200);
      const graduated = await db.collection('auth').findOne({ _id: student._id });
      assert.equal(graduated.role, 'alumni');
      const firstDate = (await users.findByAuthId(student._id)).graduatedAt;
      await graduateUser({ user: { role: 'admin' }, body: { email: student.email } }, res);
      assert.equal((await users.findByAuthId(student._id)).graduatedAt.getTime(), firstDate.getTime());
      const after = await createDevelopmentService(db).snapshot(graduated);
      assert.deepEqual(after.portfolio, before.portfolio);
      assert.deepEqual(after.internships, before.internships);
      assert.equal(after.readiness.score, before.readiness.score);
      assert.equal(after.timeline.find(item => item.key === 'graduated').state, 'done');
      assert.equal(after.timeline.find(item => item.key === 'alumni').state, 'done');
    });

    await t.test('employment changes, conflicts and admin reports use persisted history', async () => {
      let profile = await users.findByAuthId(student._id);
      const job = { employmentStatus: 'Employed', currentCompany: 'First Company', position: 'Developer', industry: 'Technology', startDate: '2024-05' };
      await employment.updateProfile(profile, updateEmployment(profile, job));
      await assert.rejects(employment.updateProfile(profile, updateEmployment(profile, { ...job, position: 'Stale edit' })), error => error.status === 409);
      profile = await users.findByAuthId(student._id);
      await employment.updateProfile(profile, updateEmployment(profile, { ...job, currentCompany: 'Second Company', position: 'Senior Developer', startDate: '2025-05' }));
      profile = await users.findByAuthId(student._id);
      await employment.updateProfile(profile, addPastEmployment(profile, { company: 'Earlier Company', position: 'Assistant', startDate: '2023-01', endDate: '2023-06' }));
      const report = employmentReport(await employment.alumniProfiles(), { batch: '2025' });
      assert.equal(report.summary.totalAlumni, 1);
      assert.equal(report.summary.employed, 1);
      assert.equal(report.summary.alumniWithCareerChanges, 1);
      assert.deepEqual(report.alumni[0].employmentHistory.map(job => job.company), ['Earlier Company', 'First Company', 'Second Company']);
      assert.equal((await users.findByAuthId(other._id)).employmentHistory, undefined);
    });

    await t.test('journey chooses earliest dated work across unsorted profile and tracer history', async () => {
      await db.collection('tracer_responses').insertOne({ authId: String(student._id), status: 'Studying', responseHistory: [
        { status: 'Employed', employmentDate: new Date('2022-06-01'), recordedAt: new Date('2024-01-01') },
        { status: 'Studying', recordedAt: new Date('2025-01-01') },
      ] });
      const snapshots = await Promise.all(Array.from({ length: 5 }, () => development.snapshot({ ...student, role: 'alumni' })));
      for (const result of snapshots) assert.equal(result.timeline.find(item => item.key === 'employed').date, '2022-06-01');
      await db.collection('tracer_responses').deleteMany({});
      await db.collection('student_development').updateOne({ _id: String(student._id) }, { $unset: { 'milestones.employed': '' } });
      const profileResult = await development.snapshot(student);
      assert.equal(profileResult.timeline.find(item => item.key === 'employed').date, '2023-01-01');
      await db.collection('users').updateOne({ email: student.email }, { $set: { employmentHistory: [] } });
      assert.equal((await development.snapshot(student)).timeline.find(item => item.key === 'employed').date, '2023-01-01');
    });

    await t.test('profile and employment controllers share persistence, reporting, and conflict protection', async t => {
      const account = { _id: new ObjectId(), role: 'alumni', email: 'profile-career@example.test' };
      await db.collection('auth').insertOne(account);
      await users.createUserProfile(account._id, { name: 'Profile Career', email: account.email, employmentStatus: 'Unemployed' });
      t.mock.method(UserModel, 'findByAuthId', id => users.findByAuthId(id));
      t.mock.method(EmploymentModel, 'updateProfile', (profile, patch) => employment.updateProfile(profile, patch));
      const response = () => ({ status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
      let profile = await users.findByAuthId(account._id);
      const firstRevision = employmentState(profile).historyRevision;
      const entry = { company: 'Profile Company', position: 'Developer', industry: 'Technology', startDate: '2025-01', current: true, employmentStatus: 'Employed' };
      let res = response();
      await updateMyExperience({ user: account, body: { action: 'add', revision: firstRevision, entry, authId: other._id } }, res);
      assert.equal(res.code, 200);
      profile = await users.findByAuthId(account._id);
      assert.equal(profile.employmentStatus, 'Employed');
      assert.equal(profile.employmentRevision, 1);
      const report = employmentReport(await employment.alumniProfiles()).alumni.find(row => row.email === account.email);
      assert.equal(report.currentCompany, 'Profile Company');
      assert.equal(report.employmentStatus, 'Employed');
      const journey = await createDevelopmentService(db).snapshot(account);
      assert.equal(journey.timeline.find(item => item.key === 'employed').date, '2025-01-01');
      assert.equal((await users.findByAuthId(other._id)).employmentHistory, undefined);

      res = response();
      await saveEmployment({ user: account, body: { employmentStatus: 'Studying', revision: firstRevision } }, res);
      assert.equal(res.code, 409);
      res = response();
      await updateMyProfile({ user: account, body: { $push: { employmentHistory: { ...entry, startDate: '2099-01' } } } }, res);
      assert.equal(res.code, 400);
      res = response();
      await updateMyExperience({ user: account, body: { action: 'add', revision: employmentState(profile).historyRevision, entry: { ...entry, startDate: '2099-01' } } }, res);
      assert.equal(res.code, 400);
      assert.deepEqual((await users.findByAuthId(account._id)).employmentHistory, profile.employmentHistory);

      // Both screens read the same revision before either write reaches MongoDB.
      t.mock.method(UserModel, 'findByAuthId', async () => profile);
      const request = { user: account, body: { action: 'edit', index: 0, revision: employmentState(profile).historyRevision, entry: { ...entry, position: 'Senior Developer', startDate: '2025-06' } } };
      const profileResponse = response(), employmentResponse = response();
      await Promise.all([
        updateMyExperience(request, profileResponse),
        saveEmployment({ user: account, body: { employmentStatus: 'Studying', revision: employmentState(profile).historyRevision } }, employmentResponse),
      ]);
      assert.deepEqual([profileResponse.code, employmentResponse.code].sort(), [200, 409]);
      profile = await users.findByAuthId(account._id);
      assert.equal(profile.employmentRevision, 2);
      assert.equal(profile.employmentHistory[0].current, false);
      assert.equal(profile.employmentHistory.length, profile.employmentStatus === 'Studying' ? 1 : 2);
    });

    await t.test('simultaneous employment writes cannot overwrite history within the same millisecond', async t => {
      t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-01-15T00:00:00Z') });
      const profile = await users.createUserProfile(new ObjectId(), { email: 'concurrent@example.test', name: 'Concurrent Alumni' });
      const job = { employmentStatus: 'Employed', currentCompany: 'Company', position: 'Developer', industry: 'Technology', startDate: '2025-01' };
      const writes = await Promise.allSettled([
        employment.updateProfile(profile, updateEmployment(profile, job)),
        employment.updateProfile(profile, updateEmployment(profile, { ...job, position: 'Designer' })),
      ]);
      assert.equal(writes.filter(result => result.status === 'fulfilled').length, 1);
      assert.equal(writes.find(result => result.status === 'rejected')?.reason.status, 409);
    });
  } finally {
    if (/^SielAlumni_career_test_[a-f0-9]{32}$/.test(databaseName)) await db.dropDatabase().catch(() => {});
    await client.close();
  }
});
