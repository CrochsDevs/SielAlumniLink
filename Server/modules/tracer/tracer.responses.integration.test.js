import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MongoClient, ObjectId } from 'mongodb';
import { createTracerModel } from './tracer.models.js';
import { buildAlignmentReport } from './tracer.alignment.js';

test('tracer lists current accounts once without deleting historical evidence', { timeout: 30000 }, async t => {
  const connection = new MongoClient(process.env.TEST_MONGO_URI || process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  const databaseName = `SielAlumni_tracer_test_${randomUUID().replaceAll('-', '')}`;
  const db = connection.db(databaseName);
  let connected = false;
  try {
    await connection.connect(); connected = true;
    const model = createTracerModel(db), responses = db.collection('tracer_responses');
    const student = new ObjectId(), alumni = new ObjectId(), disabled = new ObjectId(), admin = new ObjectId();
    await db.collection('auth').insertMany([
      { _id: student, role: 'student', email: 'student@example.test', password: 'NEVER_RETURN' },
      { _id: alumni, role: 'alumni', email: 'alumni@example.test' },
      { _id: disabled, role: 'alumni', disabledAt: new Date() },
      { _id: admin, role: 'admin' },
      { _id: 'legacy-account', role: 'student' },
    ]);
    const shared = { email: 'historical-shared@example.test', batch: '2020', program: 'BS Information Technology',
      status: 'Employed', company: 'Example Company', position: 'Developer', jobAlignment: 'directly_related' };
    const record = (authId, updatedAt, extra = {}) => ({ _id: new ObjectId(), ...shared, authId,
      updatedAt: new Date(updatedAt), respondedAt: new Date(updatedAt), ...extra });
    const studentOld = record(String(student), '2026-10-20'), studentLatest = record(student, '2026-10-29', { status: 'Studying' });
    const alumniOld = record(String(alumni), '2023-06-01', { responseHistory: [{ ...shared, recordedAt: new Date('2023-06-01') }] });
    const alumniLatest = record(alumni, '2026-10-28', { responseHistory: [{ ...shared, recordedAt: new Date('2026-10-28') }] });
    const documents = [studentOld, studentLatest, alumniOld, alumniLatest,
      record(disabled, '2026-10-29'), record(new ObjectId(), '2026-10-29'),
      record('legacy-account', '2026-10-26'), record(admin, '2026-10-27'),
      { ...shared, _id: new ObjectId() }, record({ invalid: true }, '2026-10-29')];
    await responses.insertMany(documents);

    await t.test('orphaned, disabled and invalid references cannot enter the response table', async () => {
      const listed = await model.findAll();
      assert.equal(listed.length, 4);
      assert.deepEqual(new Set(listed.map(row => String(row.authId))), new Set([String(student), String(alumni), String(admin), 'legacy-account']));
      for (const row of listed) {
        assert.equal(row._tracerAccount, undefined);
        assert.equal(row.password, undefined);
        assert.equal(row.responseHistory, undefined);
      }
    });
    await t.test('legacy string and ObjectId references use the latest record once', async () => {
      const listed = await model.findAll();
      const latest = listed.find(row => String(row.authId) === String(student));
      assert.equal(String(latest._id), String(studentLatest._id));
      assert.equal(latest.status, 'Studying');
      assert.equal(String(listed[0]._id), String(studentLatest._id));
    });
    await t.test('different active accounts are never merged by historical email text', async () => {
      const listed = await model.findAll();
      assert.ok(listed.some(row => String(row.authId) === String(student)));
      assert.ok(listed.some(row => String(row.authId) === String(alumni)));
    });
    await t.test('own form prefill also chooses the latest legacy/current response', async () => {
      for (const id of [student, String(student)]) {
        const own = await model.findByAuthId(id);
        assert.equal(String(own._id), String(studentLatest._id));
        assert.equal(own.status, 'Studying');
      }
      assert.equal((await model.findByAuthId('legacy-account')).authId, 'legacy-account');
    });
    await t.test('alignment excludes inactive/non-alumni accounts and retains earlier follow-up observations', async () => {
      const alumniResponses = await model.findAlumniResponses();
      assert.equal(alumniResponses.length, 2);
      assert.ok(alumniResponses.every(row => String(row.authId) === String(alumni)));
      const report = buildAlignmentReport(alumniResponses, { followUp: '3-5' });
      assert.equal(report.rows.length, 1);
      assert.equal(report.rows[0].recordedAt.getUTCFullYear(), 2023);
    });
    await t.test('read-time cleanup preserves every stored response and snapshot', async () => {
      assert.equal(await responses.countDocuments(), documents.length);
      assert.equal((await responses.findOne({ _id: alumniOld._id })).responseHistory.length, 1);
      assert.equal((await responses.findOne({ _id: alumniLatest._id })).responseHistory.length, 1);
    });
  } finally {
    // Only this exact, randomly named test database can be removed.
    try {
      if (connected && db.databaseName === databaseName && databaseName.startsWith('SielAlumni_tracer_test_')) await db.dropDatabase();
    } finally { await connection.close(); }
  }
});
