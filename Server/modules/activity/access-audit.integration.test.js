import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MongoClient, ObjectId } from 'mongodb';
import { listUserAccessAudit } from './admin-audit.js';

test('access audit resolves names and photos for ID and legacy email records without exposing credentials or admins', async () => {
  const client = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  const db = client.db(`audit_${randomUUID().replaceAll('-', '')}`);
  try {
    await client.connect();
    const student = { _id: new ObjectId(), role: 'student', name: 'Auth Name', email: 'student@example.test', password: 'PRIVATE_PASSWORD' };
    const alumni = { _id: new ObjectId(), role: 'alumni', name: 'Alumni Name', email: 'alumni@example.test' };
    const admin = { _id: new ObjectId(), role: 'admin', name: 'Admin Name', email: 'admin@example.test' };
    await db.collection('auth').insertMany([student, alumni, admin]);
    await db.collection('users').insertMany([
      { authId: String(student._id), name: 'Student Full Name', profilePicture: 'https://example.test/student.png', contactNumber: 'PRIVATE_CONTACT' },
      { authId: alumni._id, name: alumni.name, profilePicture: 'https://example.test/alumni.png' },
    ]);
    await db.collection('activity_logs').insertMany([
      { authId: String(student._id), email: student.email, action: 'login', createdAt: new Date() },
      { email: alumni.email, action: 'logout', createdAt: new Date() },
      { email: admin.email, action: 'login', createdAt: new Date() },
      { authId: String(new ObjectId()), role: 'alumni', actor: { name: 'Former Member' }, action: 'logout', createdAt: new Date() },
    ]);
    const rows = await listUserAccessAudit(db, 200);
    assert.equal(rows.length, 3);
    const studentLog = rows.find(row => row.email === student.email);
    assert.equal(studentLog.actor.name, 'Student Full Name');
    assert.equal(studentLog.actor.profilePicture, 'https://example.test/student.png');
    const legacyLog = rows.find(row => row.email === alumni.email);
    assert.equal(legacyLog.actor.name, alumni.name);
    assert.equal(legacyLog.actor.authId, String(alumni._id));
    assert.equal(legacyLog.actor.profilePicture, 'https://example.test/alumni.png');
    assert.ok(rows.some(row => row.actor.name === 'Former Member'));
    assert.ok(!rows.some(row => row.email === admin.email));
    assert.ok(!rows.some(row => 'account' in row || 'actorProfiles' in row || 'roles' in row));
    assert.ok(!JSON.stringify(rows).includes('PRIVATE_'));
  } finally {
    try { await db.dropDatabase(); } finally { await client.close(); }
  }
});
