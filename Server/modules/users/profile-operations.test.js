import test from 'node:test';
import assert from 'node:assert/strict';
import { profileOperations } from './profile-operations.js';

test('profile actions reject raw operators, dotted paths and malformed bodies', () => {
  for (const body of [null, [], 'text', ...['$set', '$push', '$addToSet', '$pull', '$unset', '$inc'].map(operator => ({
    [operator]: { profileLinks: { $each: [{ url: 'javascript:alert(1)' }] } },
  })), { 'profileLinks.0.url': 'javascript:alert(1)' }]) {
    assert.throws(() => profileOperations(body));
  }
});

test('skill actions accept only bounded scalar strings and reject conflicting edits', () => {
  assert.deepEqual(profileOperations({ addSkill: ' JavaScript ' }), { $addToSet: { skills: 'JavaScript' } });
  assert.deepEqual(profileOperations({ removeSkill: ' JavaScript ' }), { $pull: { skills: 'JavaScript' } });
  for (const value of [null, '', ' ', {}, { $ne: null }, ['skill'], 'x'.repeat(101)]) {
    assert.throws(() => profileOperations({ addSkill: value }));
    assert.throws(() => profileOperations({ removeSkill: value }));
  }
  assert.throws(() => profileOperations({ addSkill: 'A', removeSkill: 'B' }));
  assert.throws(() => profileOperations({ skills: [], addSkill: 'A' }));
});

test('education append constructs only validated education fields', () => {
  assert.deepEqual(profileOperations({ addEducation: { school: ' CLSU ', degree: ' BSCS ', year: '2025' } }), {
    $push: { education: { school: 'CLSU', degree: 'BSCS', year: '2025', location: '' } },
  });
  for (const addEducation of [null, [], {}, { school: 'CLSU', degree: { $ne: null } },
    { school: 'CLSU', degree: 'BSCS', authId: 'victim' }, { school: 'CLSU', degree: 'x'.repeat(201) }]) {
    assert.throws(() => profileOperations({ addEducation }));
  }
  assert.throws(() => profileOperations({ education: [], addEducation: { school: 'CLSU', degree: 'BSCS' } }));
});
