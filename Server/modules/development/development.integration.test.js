import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MongoClient, ObjectId } from 'mongodb';
import { createDevelopmentService } from './development.service.js';
import { createReferralModels } from '../referrals/referrals.models.js';

test('real database: saved development history, ownership, readiness, and race-safe referral applications', { timeout: 60000 }, async () => {
  const client = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  const databaseName = `SielAlumni_development_test_${randomUUID().replaceAll('-', '')}`;
  const db = client.db(databaseName);
  try {
    await client.connect();
    const student = { _id: new ObjectId(), role: 'student', email: 'student@example.test' };
    const stranger = { _id: new ObjectId(), role: 'student', email: 'stranger@example.test' };
    const mentor = { _id: new ObjectId(), role: 'alumni', email: 'mentor@example.test' };
    await db.collection('auth').insertMany([student, stranger, mentor]);
    await db.collection('users').insertOne({ authId: student._id, email: student.email, program: 'BS IT', skills: [] });
    const service = createDevelopmentService(db);
    let result = await service.snapshot(student);
    assert.equal(result.readiness.score, 0); assert.equal(result.timeline.length, 8);
    assert.equal(result.timeline.filter(item => item.state === 'done').length, 0);
    await service.saveAcademic(student, { key: 'enrolled', date: '2023-08-01' });
    await service.saveAcademic(student, { key: 'semester', date: '2023-12-15' });
    await assert.rejects(service.saveAcademic(student, { key: 'graduated', date: '2025-01-01' }), error => error.status === 400);
    await assert.rejects(service.saveAcademic(student, { key: 'semester', date: '2022-01-01' }), error => error.status === 400);
    const eventResults = await Promise.allSettled(Array.from({ length: 10 }, () => service.addEvent(student, { title: 'Career Fair', date: '2025-01-15' })));
    assert.equal(eventResults.filter(item => item.status === 'fulfilled').length, 1);
    assert.ok(eventResults.filter(item => item.status === 'rejected').every(item => item.reason.status === 409));
    await service.addEvent(student, { title: 'Research Congress', date: '2025-02-15' });
    await service.addEvent(student, { title: 'Alumni Seminar', date: '2025-03-15' });
    result = await service.snapshot(student);
    await assert.rejects(service.removeEvent(stranger, result.events[0]._id), error => error.status === 404);
    for (const section of ['skills', 'seminars', 'awards']) await service.savePortfolio(student, section, ['One entry']);
    await service.savePortfolio(student, 'certifications', ['Certificate A', 'Certificate B', 'Certificate C']);
    for (const section of ['projects', 'research']) await service.savePortfolio(student, section, [{ title: 'One record', desc: 'Details' }]);
    const connection = { requesterAuthId: student._id, recipientAuthId: mentor._id, requesterEmail: student.email, recipientEmail: mentor.email, status: 'accepted', updatedAt: new Date('2025-01-01') };
    await db.collection('connections').insertOne(connection);
    result = await service.saveInternship(student, { company: 'Campus Tech', supervisor: 'Dr. Mentor', requiredHours: 100, hoursCompleted: 95, startDate: '2025-04-01', evaluation: 'Good progress', authId: String(stranger._id) });
    const record = result.internships[0];
    assert.equal(record.authId, String(student._id)); assert.equal(result.readiness.score, 99);
    await assert.rejects(service.saveInternship(stranger, { ...record, hoursCompleted: 100 }, record._id), error => error.status === 404);
    await assert.rejects(service.removeInternship(stranger, record._id), error => error.status === 404);
    result = await service.saveInternship(student, { ...record, hoursCompleted: 100, endDate: '2025-06-01', evaluation: 'Completed successfully' }, record._id);
    assert.equal(result.readiness.score, 100); assert.equal(result.timeline.find(item => item.key === 'internship').state, 'done');
    await db.collection('users').updateOne({ email: student.email }, { $set: { role: 'alumni', graduatedAt: new Date('2025-07-01') } });
    await db.collection('tracer_responses').insertOne({ authId: String(student._id), status: 'Employed', employmentDate: new Date('2025-08-01') });
    result = await createDevelopmentService(db).snapshot(student);
    assert.equal(result.timeline.filter(item => item.state === 'done').length, 8);
    assert.equal(result.internships[0].evaluation, 'Completed successfully');
    assert.equal((await service.snapshot(stranger)).readiness.score, 0);
    assert.equal((await service.snapshot(stranger)).internships.length, 0);
    await db.collection('connections').updateOne({ _id: connection._id }, { $set: { status: 'declined' } });
    assert.equal((await service.snapshot(student)).timeline.find(item => item.key === 'mentorship').state, 'done');
    const { ReferralModel, ReferralApplicationModel } = createReferralModels(db);
    for (const type of ['job', 'internship', 'scholarship']) {
      const referral = await ReferralModel.create({ title: `${type} referral`, type, organization: 'Campus', authorAuthId: mentor._id });
      const applications = await Promise.allSettled(Array.from({ length: 20 }, () => ReferralApplicationModel.apply({ referralId: referral._id, applicantAuthId: student._id, email: student.email, name: 'Student', note: 'Interested' })));
      assert.equal(applications.filter(item => item.status === 'fulfilled').length, 1);
      const list = await ReferralApplicationModel.findByReferral(referral._id);
      assert.equal(list.length, 1); assert.equal(list[0].note, 'Interested');
      await ReferralApplicationModel.updateStatus(list[0]._id, 'accepted');
      assert.equal((await ReferralApplicationModel.findById(list[0]._id)).status, 'accepted');
    }
    assert.equal((await ReferralApplicationModel.findMine(student._id)).length, 3);
    assert.equal((await ReferralApplicationModel.findMine(stranger._id)).length, 0);
    await service.removeInternship(student, record._id);
    assert.equal((await service.snapshot(student)).readiness.score, 80);
  } finally {
    if (/^SielAlumni_development_test_[a-f0-9]{32}$/.test(databaseName)) await db.dropDatabase().catch(() => {});
    await client.close();
  }
});
