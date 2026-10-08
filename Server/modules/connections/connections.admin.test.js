import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { MongoClient, ObjectId } from 'mongodb';
import { directoryOptions, listConnectionMembers, listMemberConnections } from './connections.admin.js';

const client = new MongoClient(process.env.TEST_MONGO_URI || process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
const databaseName = `alumnilink_connections_test_${process.pid}_${Date.now()}`;
const db = client.db(databaseName);
const alumni = new ObjectId();
const students = Array.from({ length: 123 }, () => new ObjectId());
before(async () => {
  await client.connect();
  await db.collection('auth').insertMany([
    { _id: alumni, role: 'alumni', email: 'alumni@example.test' },
    ...students.map((_id, index) => ({ _id, role: 'student', email: `student${index}@example.test` })),
  ]);
  await db.collection('users').insertMany([
    { authId: String(alumni), name: 'Alumni Owner', profilePicture: '/alumni.png' },
    ...students.map((authId, index) => ({ authId, name: `Student ${String(index).padStart(3, '0')}`, profilePicture: '/student.png' })),
  ]);
  await db.collection('connections').insertMany([
    ...students.slice(0, 120).map((student, index) => ({
      requesterAuthId: index % 2 ? String(student) : alumni,
      recipientAuthId: index % 2 ? String(alumni) : student,
      status: 'accepted',
    })),
    { requesterAuthId: students[0], recipientAuthId: alumni, status: 'accepted' },
    { requesterAuthId: students[120], recipientAuthId: alumni, status: 'pending' },
    { requesterAuthId: students[121], recipientAuthId: alumni, status: 'declined' },
    { requesterEmail: 'student122@example.test', recipientEmail: 'alumni@example.test', status: 'accepted' },
  ]);
});
after(async () => {
  if (databaseName.startsWith('alumnilink_connections_test_')) await db.dropDatabase();
  await client.close();
});

test('alumni and student filters choose the owner account, not either end of an edge', async () => {
  const alumniPage = await listConnectionMembers(directoryOptions({ role: 'alumni' }), db);
  assert.equal(alumniPage.total, 1);
  assert.equal(alumniPage.items[0].email, 'alumni@example.test');
  assert.equal(alumniPage.items[0].connectionsCount, 121);
  const studentsPage = await listConnectionMembers(directoryOptions({ role: 'students', q: 'student0@' }), db);
  assert.equal(studentsPage.items[0].role, 'student');
  assert.equal(studentsPage.items[0].connectionsCount, 1);
});

test('connection lists are symmetric for both incoming and outgoing requests', async () => {
  for (const student of students.slice(0, 2)) {
    const result = await listMemberConnections(String(student), directoryOptions({}), db);
    assert.equal(result.total, 1);
    assert.equal(result.items[0].name, 'Alumni Owner');
    assert.equal(result.items[0].role, 'alumni');
    assert.ok(result.items[0].profileId);
    assert.equal(result.items[0].profilePicture, '/alumni.png');
  }
});

test('hundreds of connections have bounded, disjoint pages without duplicates or pending requests', async () => {
  const first = await listMemberConnections(String(alumni), directoryOptions({}), db);
  const second = await listMemberConnections(String(alumni), directoryOptions({ page: 2 }), db);
  const last = await listMemberConnections(String(alumni), directoryOptions({ page: 13 }), db);
  assert.equal(first.total, 121);
  assert.equal(first.pages, 13);
  assert.equal(first.items.length, 10);
  assert.equal(second.items.length, 10);
  assert.equal(new Set([...first.items, ...second.items].map(person => String(person._id))).size, 20);
  assert.equal(last.items.length, 1);
  assert.equal(last.items[0].name, 'Student 122');
  const pendingStudent = await listMemberConnections(String(students[120]), directoryOptions({}), db);
  assert.equal(pendingStudent.total, 0);
});

test('validates pagination and handles missing accounts and literal search', async () => {
  for (const query of [{ page: -1 }, { page: '1.1' }, { limit: 100000 }, { role: 'admin' }, { q: {} }]) assert.throws(() => directoryOptions(query));
  assert.equal(await listMemberConnections('invalid', directoryOptions({}), db), null);
  assert.equal(await listMemberConnections(String(new ObjectId()), directoryOptions({}), db), null);
  assert.equal((await listConnectionMembers(directoryOptions({ q: '.*' }), db)).total, 0);
});
