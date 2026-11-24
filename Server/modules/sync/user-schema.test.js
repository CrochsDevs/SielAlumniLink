import test from 'node:test';
import assert from 'node:assert/strict';
import { mapSyncedUser } from './user-schema.js';
import { activeAccount, sessionMatches } from '../auth/session-token.js';

test('Laravel schema maps names, BIGINT IDs, student number and source metadata', () => {
  const value = mapSyncedUser({
    id: '18446744073709551615', external_id: '9007199254740993',
    first_name: 'Ana', middle_name: 'Maria', last_name: 'Cruz', extension_name: 'Jr.',
    email: ' ANA@example.test ', contact_no: '09123456789', avatar: '/storage/ana.png',
    student_number: '2020-0001', status: 'Graduated', source_user_type: 'alumni',
    is_active: 1, first_time_login: 0, source_version: 'v2',
    source_payload_hash: 'a'.repeat(64), source_deleted_at: null,
    created_at: '2026-01-01 12:00:00', updated_at: '2026-01-02T12:00:00Z',
    email_verified_at: null, last_login_at: '2026-01-03T12:00:00+08:00',
    last_seen_at: null, source_last_seen_at: null, source_status: 'active',
    password: 'source-password', two_factor_secret: 'secret',
    two_factor_recovery_codes: 'codes', remember_token: 'token', two_factor_confirmed_at: '2026-01-01 12:00:00',
  });
  assert.equal(value.name, 'Ana Maria Cruz Jr.');
  assert.equal(value.firstName, 'Ana');
  assert.equal(value.middleName, 'Maria');
  assert.equal(value.extensionName, 'Jr.');
  assert.equal(value.email, 'ana@example.test');
  assert.equal(value.sourceId, '18446744073709551615');
  assert.equal(value.externalId, '9007199254740993');
  assert.equal(value.studentId, '2020-0001');
  assert.equal(value.contactNumber, '09123456789');
  assert.equal(value.profilePicture, '/storage/ana.png');
  assert.equal(value.sourceStatus, 'active');
  assert.equal(value.sourceIsActive, true);
  assert.equal(value.sourceFirstTimeLogin, false);
  assert.equal(value.sourceCreatedAt.toISOString(), '2026-01-01T12:00:00.000Z');
  assert.equal(value.sourceLastLoginAt.toISOString(), '2026-01-03T04:00:00.000Z');
  assert.equal(value.sourceEmailVerifiedAt, null);
  for (const key of ['password', 'two_factor_secret', 'two_factor_recovery_codes', 'remember_token', 'two_factor_confirmed_at', 'passwordSetupRequired', 'isVerified']) {
    assert.equal(Object.hasOwn(value, key), false);
  }
  assert.deepEqual(mapSyncedUser(value), value);
});

test('existing camelCase uploads work and omitted optional metadata stays omitted', () => {
  const value = mapSyncedUser({ name: 'Existing Member', email: 'member@example.test', role: 'student', studentId: '001', contactNumber: '0912' });
  assert.equal(value.studentId, '001');
  assert.equal(value.role, 'student');
  assert.equal(Object.hasOwn(value, 'profilePicture'), false);
  assert.equal(Object.hasOwn(value, 'sourceDeletedAt'), false);
  assert.equal(Object.hasOwn(value, 'firstName'), false);
  assert.equal(mapSyncedUser({ id: '123', name: 'Member' }).studentId, '');
});

test('graduates feed still forces alumni while imported admin roles remain invalid', () => {
  assert.equal(mapSyncedUser({ role: 'student' }, 'alumni').role, 'alumni');
  assert.equal(mapSyncedUser({}, 'student').role, 'student');
  assert.equal(mapSyncedUser({ academic_status: 'Graduated' }, 'student').role, 'alumni');
  assert.equal(mapSyncedUser({ source_user_type: 'admin' }, 'student').role, 'admin');
  assert.equal(mapSyncedUser({ source_user_type: 'graduate' }).role, 'alumni');
});

test('source values cannot inject operators, lose BIGINT precision or import unsafe avatars', () => {
  for (const entry of [null, [], { email: {} }, { id: 9007199254740992 }, { id: '-1' },
    { is_active: 'maybe' }, { source_deleted_at: {} }, { created_at: 'invalid' },
    { source_payload_hash: 'bad' }, { avatar: 'javascript:alert(1)' }, { avatar: '//outside.test/a.png' }]) {
    assert.throws(() => mapSyncedUser(entry));
  }
});

test('source inactivity and deletion block both sign-in and existing sessions', () => {
  const account = { _id: 'member', sessionVersion: 1 };
  assert.equal(activeAccount(account), true);
  for (const state of [{ sourceIsActive: false }, { sourceDeletedAt: new Date() }, { disabledAt: new Date() }]) {
    assert.equal(activeAccount({ ...account, ...state }), false);
    assert.equal(sessionMatches({ sv: 1 }, { ...account, ...state }), false);
  }
  assert.equal(activeAccount({ ...account, sourceIsActive: true, sourceDeletedAt: null }), true);
});
