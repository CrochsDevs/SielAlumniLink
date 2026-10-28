import assert from 'node:assert/strict';
import test from 'node:test';
import { rankMentors, validateMatchPreferences } from './matching.policy.js';
import { createMatchingService } from './matching.service.js';

const preferences = { interests: ['software'], careerGoals: 'JavaScript engineer' };
const mentors = [
  { _id: 'b', skills: ['Teaching'], program: 'Education', bio: 'Teaching history' },
  { _id: 'a', skills: ['JavaScript'], program: 'BS IT', employmentHistory: [{ position: 'Software engineer', current: true }] },
];
test('relevant skills, interests and goals rank above unrelated experience with factual reasons', () => {
  const matches = rankMentors({ skills: [' javascript '], program: 'BS IT' }, mentors, preferences);
  assert.equal(matches[0].mentor._id, 'a');
  assert.equal(matches.length, 1);
  assert.ok(matches[0].reasons.some(reason => reason.includes('Shared skills')));
  assert.ok(matches[0].reasons.some(reason => reason.includes('software')));
  assert.ok(matches[0].reasons.some(reason => reason.includes('engineer')));
  assert.ok(matches.every(match => match.score > 0 && match.score <= 100));
});
test('empty profiles never get invented scores; skill tokens do not conflate C, C++ and C#', () => {
  assert.deepEqual(rankMentors({}, mentors, { interests: [], careerGoals: '' }), []);
  assert.deepEqual(rankMentors({ skills: ['C++'] }, [{ _id: 'a', skills: ['C', 'C#'] }], { interests: [], careerGoals: '' }), []);
  assert.doesNotThrow(() => rankMentors({ skills: null }, [{ _id: 'a', skills: 'bad', employmentHistory: [null] }], preferences));
});
test('duplicates do not inflate scores; ties are deterministic; no more than 12 results', () => {
  const candidates = Array.from({ length: 20 }, (_, index) => ({ _id: String(index).padStart(2, '0'), skills: ['SQL', 'sql'] }));
  const result = rankMentors({ skills: ['SQL', 'sql'] }, candidates.reverse(), { interests: [], careerGoals: '' });
  assert.equal(result.length, 12); assert.equal(result[0].score, 100); assert.equal(result[0].mentor._id, '00');
});
test('preferences reject oversized or malformed values and normalize duplicate interests', () => {
  for (const input of [null, {}, [], { interests: 'x', careerGoals: '' }, { interests: [5], careerGoals: '' }, { interests: ['x'.repeat(81)], careerGoals: '' }, { interests: [], careerGoals: 'x'.repeat(1001) }, { interests: Array(21).fill('x'), careerGoals: '' }]) {
    assert.throws(() => validateMatchPreferences(input), error => error.status === 400);
  }
  assert.deepEqual(validateMatchPreferences({ interests: [' SQL ', 'sql', ''], careerGoals: ' Analyst ' }), { interests: ['sql'], careerGoals: 'Analyst' });
});

function fixture() {
  const student = { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', role: 'student' };
  const other = { _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', role: 'student' };
  const alumni = { _id: 'cccccccccccccccccccccccc', role: 'alumni', email: 'mentor@example.test', password: 'secret' };
  const records = {
    auth: [student, other, alumni],
    users: [
      { _id: 'student', authId: student._id, skills: ['Teaching'], interests: ['software'] },
      { _id: 'alumnus', authId: alumni._id, ...mentors[1], bannerImage: 'https://res.cloudinary.com/example/image/upload/mentor-banner.jpg', password: 'private', contactNumber: 'private' },
      { _id: 'wrong-role', authId: other._id, role: 'alumni', skills: ['JavaScript'] },
    ],
    student_portfolios: [{ _id: student._id, skills: ['JavaScript'] }],
    mentor_match_preferences: [],
  };
  const equal = (a, b) => String(a) === String(b);
  const matches = (record, query) => Object.entries(query).every(([key, value]) => value === null ? record[key] == null : value?.$in ? value.$in.some(item => equal(record[key], item)) : equal(record[key], value));
  const db = { collection: name => ({
    findOne: async query => records[name].find(record => matches(record, query)) || null,
    find: query => ({ toArray: async () => records[name].filter(record => matches(record, query)) }),
    updateOne: async (query, update) => {
      let record = records[name].find(item => matches(item, query));
      if (!record) { record = { ...query }; records[name].push(record); }
      Object.assign(record, update.$set);
    },
  }) };
  return { service: createMatchingService(db), records, student, other, alumni };
}
test('service uses portfolio skills and authoritative alumni accounts; returns only public match fields', async () => {
  const { service, student } = fixture();
  const result = await service.get(student);
  assert.equal(result.candidateCount, 1); assert.equal(result.matches.length, 1);
  assert.deepEqual(result.profile.skills, ['JavaScript']);
  assert.ok(result.matches[0].reasons.some(reason => reason.includes('JavaScript')));
  assert.equal(result.matches[0].mentor.password, undefined);
  assert.equal(result.matches[0].mentor.contactNumber, undefined);
  assert.equal(result.matches[0].mentor.email, undefined);
  assert.ok(result.matches[0].mentor.authId);
  assert.equal(result.matches[0].mentor.bannerImage, 'https://res.cloudinary.com/example/image/upload/mentor-banner.jpg');
});

test('recommendations preserve uploaded banners after preference updates and return null when no banner exists', async () => {
  const { service, student, records } = fixture();
  const result = await service.save(student, preferences);
  assert.equal(result.matches[0].mentor.bannerImage, records.users[1].bannerImage);
  delete records.users[1].bannerImage;
  assert.equal((await service.get(student)).matches[0].mentor.bannerImage, null);
});

test('disabled alumni cannot appear in mentor recommendations', async () => {
  const { service, student, alumni } = fixture();
  alumni.disabledAt = new Date();
  const result = await service.get(student);
  assert.equal(result.candidateCount, 0);
  assert.deepEqual(result.matches, []);
});
test('saved preferences persist per authenticated student and ignore supplied identity', async () => {
  const { service, student, other, records } = fixture();
  await service.save(student, { ...preferences, authId: other._id });
  assert.deepEqual((await service.get(student)).preferences, preferences);
  assert.deepEqual((await service.get(other)).preferences, { interests: [], careerGoals: '' });
  assert.equal(records.mentor_match_preferences.length, 1);
  await service.save(student, { interests: [], careerGoals: '' });
  assert.deepEqual((await service.get(student)).preferences, { interests: [], careerGoals: '' });
});
test('alumni and administrators cannot read or write student matching preferences', async () => {
  const { service, alumni } = fixture();
  for (const user of [alumni, { ...alumni, role: 'admin' }, null]) {
    await assert.rejects(service.get(user), error => error.status === 403);
    await assert.rejects(service.save(user, preferences), error => error.status === 403);
  }
});
