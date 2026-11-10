import test from 'node:test';
import assert from 'node:assert/strict';
import { createDevelopmentService } from './development.service.js';
import { createMemoryDb, student, stranger } from '../meetings/meetings.fixture.js';

test('development snapshot resolves 100 mentorship connections with one account query', async () => {
  const { db, seed } = createMemoryDb();
  const mentorId = 'dddddddddddddddddddddddd';
  seed('auth', { _id: mentorId, email: 'mentor@example.test', role: 'Alumni' });
  seed('student_development', { _id: String(student._id), milestones: { mentorship: { date: '2025-01-01' } } });
  for (let index = 0; index < 100; index++) seed('connections', {
    _id: `connection-${index}`, status: 'accepted', requesterAuthId: String(student._id), recipientAuthId: index % 2 ? mentorId : undefined,
    requesterEmail: student.email, recipientEmail: 'mentor@example.test', createdAt: new Date('2025-01-01'),
  });
  seed('connections', { _id: 'student-peer', status: 'accepted', requesterAuthId: String(student._id), recipientAuthId: String(stranger._id) });
  seed('connections', { _id: 'missing-peer', status: 'accepted', requesterAuthId: String(student._id), recipientAuthId: 'ffffffffffffffffffffffff' });
  let reads = 0;
  const observed = { collection(name) {
    const collection = db.collection(name);
    if (name !== 'auth') return collection;
    return { ...collection, find(...args) { reads++; return collection.find(...args); }, findOne(...args) { reads++; return collection.findOne(...args); } };
  } };
  const result = await createDevelopmentService(observed).snapshot(student);
  assert.equal(result.mentorCount, 100);
  assert.equal(reads, 1);
  assert.equal(result.timeline.find(item => item.key === 'mentorship').state, 'done');
});
