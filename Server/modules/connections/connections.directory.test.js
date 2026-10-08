import test from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { enrichConnections } from './connections.directory.js';

test('resolves both directions by account ID despite changed emails and missing profile roles', () => {
  const student = new ObjectId();
  const alumni = new ObjectId();
  const accounts = [{ _id: student, email: 'new@student.test', role: 'Student' }, { _id: alumni, email: 'alumni@test.test', role: 'ALUMNI', password: 'secret' }];
  const profiles = [{ _id: 's-profile', authId: String(student), name: 'Student Member' }, { _id: 'a-profile', authId: alumni, name: 'Alumni Member', role: 'student' }];
  const result = enrichConnections([
    { requesterAuthId: student, requesterEmail: 'old@student.test', recipientAuthId: String(alumni), status: 'accepted' },
    { requesterAuthId: String(alumni), recipientAuthId: student, status: 'pending' },
  ], accounts, profiles);
  assert.equal(result[0].requesterRole, 'student');
  assert.equal(result[0].recipientRole, 'alumni');
  assert.equal(result[0].requesterEmail, 'new@student.test');
  assert.equal(result[0].requesterProfileId, 's-profile');
  assert.equal(result[1].recipientName, 'Student Member');
  assert.equal(result[1].requesterName, 'Alumni Member');
  assert.equal(result[1].status, 'pending');
  assert.equal(JSON.stringify(result).includes('secret'), false);
});

test('supports legacy email-only connections and does not collapse alumni-alumni links', () => {
  const result = enrichConnections([{ requesterEmail: 'one@test.test', recipientEmail: 'two@test.test' }], [], [
    { _id: 'one', name: 'One', email: 'one@test.test', role: 'alumni', authId: 'a' },
    { _id: 'two', name: 'Two', email: 'two@test.test', role: 'alumni', authId: 'b' },
  ]);
  assert.equal(result[0].requesterRole, 'alumni');
  assert.equal(result[0].recipientRole, 'alumni');
  assert.equal(result[0].recipientProfileId, 'two');
});

test('preserves unresolved account IDs and historical links without fabricating profile links', () => {
  const result = enrichConnections([{ requesterAuthId: 'deleted', recipientAuthId: 'missing', requesterEmail: 'old@test.test' }], [], []);
  assert.equal(result.length, 1);
  assert.equal(result[0].requesterAuthId, 'deleted');
  assert.equal(result[0].recipientAuthId, 'missing');
  assert.equal(result[0].requesterEmail, 'old@test.test');
  assert.equal(result[0].requesterProfileId, null);
  assert.equal(result[0].recipientRole, null);
});

test('keeps the newest canonical profile when legacy duplicates exist', () => {
  const result = enrichConnections([{ requesterAuthId: 'a' }], [], [
    { _id: 'new', authId: 'a', name: 'Current', role: 'alumni' },
    { _id: 'old', authId: 'a', name: 'Old', role: 'student' },
  ]);
  assert.equal(result[0].requesterProfileId, 'new');
  assert.equal(result[0].requesterName, 'Current');
});
