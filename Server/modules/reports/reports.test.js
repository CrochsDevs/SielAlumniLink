import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MongoClient, ObjectId } from 'mongodb';
import { reportPeriod, summarizeEngagement } from './reports.policy.js';
import { createReportService } from './reports.service.js';

test('calendar validation, Manila boundaries, and distinct members across buckets', () => {
  const now = new Date('2024-03-01T15:59:59Z');
  for (const date of ['2024-02-30', '2024-03-02', '', ['2024-03-01']]) assert.throws(() => reportPeriod(date, now), { status: 400 });
  const period = reportPeriod('2024-02-29', now);
  assert.equal(period.days, 29);
  assert.equal(period.start.toISOString(), '2023-12-31T16:00:00.000Z');
  const report = summarizeEngagement([
    { source: 'logins', hour: '2024-02-29T00', count: 2, actors: ['one'] },
    { source: 'posts', hour: '2024-02-29T23', count: 1, actors: ['one'] },
    { source: 'comments', hour: '2024-02-28T23', count: 1, actors: ['two'] },
  ], period);
  assert.equal(report.daily.total, 3);
  assert.equal(report.daily.activeMembers, 1);
  assert.equal(report.monthly.total, 4);
  assert.equal(report.monthly.activeMembers, 2);
  assert.equal(report.daily.buckets.length, 24);
  assert.equal(report.monthly.buckets.length, 29);
  assert.equal(report.yearly.buckets.length, 12);
  assert.equal(JSON.stringify(report).includes('"actors"'), false);
});

test('non-admin requests fail before database access', async () => {
  const service = createReportService({ collection() { throw new Error('Database must not be accessed'); } });
  for (const role of ['student', 'alumni', undefined]) await assert.rejects(service.dashboard({ role }), { status: 403 });
});

test('MongoDB reports count all sources, timezone boundaries and student–alumni statuses', { timeout: 30000 }, async () => {
  assert.ok(process.env.MONGO_URI, 'MONGO_URI required');
  const client = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  const name = 'SielAlumni_reports_test_' + randomUUID().replaceAll('-', '');
  const db = client.db(name);
  const student = new ObjectId(), alumni = new ObjectId(), otherAlumni = new ObjectId(), admin = new ObjectId();
  const at = new Date('2024-02-28T16:00:00Z');
  try {
    await client.connect();
    await db.collection('auth').insertMany([{ _id: student, role: 'student' }, { _id: alumni, role: 'alumni' }, { _id: otherAlumni, role: 'alumni' }, { _id: admin, role: 'admin' }]);
    await db.collection('activity_logs').insertMany([
      { authId: String(student), action: 'login', createdAt: at },
      { authId: String(student), action: 'login', createdAt: new Date('2024-02-28T15:59:59Z') },
      { authId: String(admin), action: 'login', createdAt: at },
      { authId: String(student), action: 'logout', createdAt: at },
    ]);
    await db.collection('feed_posts').insertMany([
      { authorAuthId: alumni, createdAt: at },
      { authorAuthId: alumni, createdAt: at, moderation: { blocked: true } },
      { authorAuthId: alumni, createdAt: at, deletedAt: at },
    ]);
    await db.collection('feed_comments').insertOne({ authorAuthId: String(student), createdAt: at });
    await db.collection('job_applications').insertOne({ applicantAuthId: String(student), createdAt: at });
    await db.collection('referral_applications').insertOne({ applicantAuthId: String(student), createdAt: at });
    await db.collection('event_registrations').insertOne({ authId: String(student), registeredAt: at });
    await db.collection('survey_responses').insertOne({ authId: String(student), createdAt: at, updatedAt: new Date('2024-03-01') });
    await db.collection('connections').insertMany([
      { requesterAuthId: student, recipientAuthId: alumni, status: 'accepted' },
      { requesterAuthId: String(alumni), recipientAuthId: String(student), status: 'pending' },
      { requesterAuthId: student, recipientAuthId: otherAlumni, status: 'declined' },
      { requesterAuthId: alumni, recipientAuthId: otherAlumni, status: 'accepted' },
      { requesterAuthId: student, recipientAuthId: admin, status: 'accepted' },
    ]);
    const service = createReportService(db, { now: () => new Date('2024-03-01T00:00:00Z') });
    const result = await service.dashboard({ role: 'admin' }, { date: '2024-02-29' });
    assert.equal(result.engagement.daily.total, 7);
    assert.equal(result.engagement.daily.activeMembers, 2);
    assert.equal(result.engagement.monthly.total, 8);
    assert.equal(result.engagement.yearly.total, 8);
    assert.deepEqual(result.engagement.daily.breakdown.map(s => s.count), [1, 1, 1, 1, 1, 1, 1]);
    assert.deepEqual(result.mentorship, { accepted: 1, pending: 1, rejected: 1, total: 3 });
    assert.deepEqual(result.members, { students: 1, alumni: 2, total: 3 });
    const empty = await service.dashboard({ role: 'admin' }, { date: '2023-01-01' });
    assert.equal(empty.engagement.yearly.total, 0);
    assert.equal(empty.mentorship.total, 3);
  } finally {
    if (/^SielAlumni_reports_test_[a-f0-9]{32}$/.test(name)) await db.dropDatabase();
    await client.close();
  }
});
