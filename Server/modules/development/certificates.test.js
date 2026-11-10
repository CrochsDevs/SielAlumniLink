import test from 'node:test';
import assert from 'node:assert/strict';
import { createCertificateService, validateParticipation } from './certificates.service.js';
import { certificateSvg } from './certificates.template.js';

const admin = { _id: 'cccccccccccccccccccccccc', role: 'admin' };
const student = { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', role: 'student', email: 'student@example.test' };
const stranger = { _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', role: 'student', email: 'other@example.test' };
const participation = { title: 'Career Seminar', date: '2025-02-15', organizer: 'SielAlumni', type: 'seminar', completed: true };
function fixture() {
  const reads = { find: 0, findOne: 0 };
  const buckets = new Map();
  const bucket = name => { if (!buckets.has(name)) buckets.set(name, new Map()); return buckets.get(name); };
  const matches = (record, query) => Object.entries(query).every(([key, value]) => key === '$or' ? value.some(part => matches(record, part)) : value?.$in ? value.$in.some(item => String(record[key]) === String(item)) : value && Object.hasOwn(value, '$exists') ? Object.hasOwn(record, key) === value.$exists : String(record[key]) === String(value));
  const db = { collection(name) {
    const records = bucket(name);
    return {
      findOne: async query => { reads.findOne++; return [...records.values()].find(record => matches(record, query)) || null; },
      find(query) {
        reads.find++;
        let result = [...records.values()].filter(record => matches(record, query));
        const cursor = { sort(order) { const [key, direction] = Object.entries(order)[0]; result.sort((a, b) => (a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0) * direction); return cursor; }, limit(count) { result = result.slice(0, count); return cursor; }, toArray: async () => result };
        return cursor;
      },
      async insertOne(record) { if (records.has(String(record._id))) throw Object.assign(new Error('duplicate'), { code: 11000 }); records.set(String(record._id), { ...record }); return { insertedId: record._id }; },
      async updateOne({ _id }, update, options = {}) { let record = records.get(String(_id)); if (!record && !options.upsert) return { matchedCount: 0 }; if (!record) { record = { _id, ...update.$setOnInsert }; records.set(String(_id), record); } Object.assign(record, update.$set); return { matchedCount: 1 }; },
    };
  } };
  const seed = (name, doc) => bucket(name).set(String(doc._id), { ...doc });
  for (const user of [student, stranger]) { seed('auth', user); seed('users', { _id: user._id, authId: user._id, email: user.email, name: user === student ? 'Alex & Santos' : 'Other Student' }); }
  return { service: createCertificateService(db), seed, bucket, reads };
}

test('large certificate queues use batch lookups and retain legacy profile matching', async () => {
  const { service, seed, reads } = fixture();
  seed('users', { _id: stranger._id, email: stranger.email, name: 'Legacy Email Profile', program: 'BSIT' });
  for (let index = 0; index < 225; index++) seed('student_event_attendance', {
    _id: (index + 1).toString(16).padStart(24, '0'), authId: index % 2 ? student._id : stranger._id, title: `Activity ${index}`, date: participation.date,
  });
  const pending = await service.pending(admin);
  assert.equal(pending.length, 225);
  assert.equal(reads.find, 3, 'One attendance, one account and one profile query');
  assert.equal(reads.findOne, 0, 'No per-record lookups');
  assert.ok(pending.some(record => record.studentName === 'Legacy Email Profile'));
  const before = reads.find;
  const participants = await service.participants(admin);
  assert.equal(reads.find - before, 2, 'Two queries regardless of recipient count');
  assert.equal(participants.find(person => person.authId === stranger._id).program, 'BSIT');
});

test('participation requires confirmation, a supported activity, organizer and past date', () => {
  assert.equal(validateParticipation(participation).type, 'seminar');
  for (const changes of [{ completed: false }, { type: 'job' }, { date: '2099-01-01' }, { date: '2025-02-30' }, { organizer: '' }, { title: ' ' }]) assert.throws(() => validateParticipation({ ...participation, ...changes }), error => error.status === 400);
});
test('self-reported attendance does not automatically issue a certificate', async () => {
  const { service, seed } = fixture();
  seed('student_event_attendance', { _id: 'dddddddddddddddddddddddd', authId: student._id, title: participation.title, date: participation.date });
  assert.equal((await service.listMine(student)).length, 0); assert.equal((await service.pending(admin)).length, 1);
  await assert.rejects(service.confirm(student, 'dddddddddddddddddddddddd', participation), error => error.status === 403);
});

test('admin lists include every record when more than 200 students need certificates', async () => {
  const { service, seed } = fixture();
  for (let index = 0; index < 225; index++) {
    seed('student_event_attendance', { _id: (index + 1).toString(16).padStart(24, '0'), authId: student._id, title: `Activity ${index}`, date: participation.date });
    seed('digital_certificates', { _id: `certificate-${index}`, studentAuthId: student._id, issuedAt: new Date() });
  }
  assert.equal((await service.pending(admin)).length, 225);
  assert.equal((await service.all(admin)).length, 225);
  await assert.rejects(service.all(student), error => error.status === 403);
});
test('admin confirmation issues a certificate and removes attendance from the review queue', async () => {
  const { service, seed } = fixture();
  seed('student_event_attendance', { _id: 'dddddddddddddddddddddddd', authId: student._id, title: participation.title, date: participation.date });
  const certificate = await service.confirm(admin, 'dddddddddddddddddddddddd', { ...participation, title: 'Forged title', studentAuthId: stranger._id });
  assert.equal(certificate.title, participation.title); assert.equal(certificate.studentAuthId, student._id);
  assert.equal(certificate.issuedBy, admin._id); assert.equal((await service.pending(admin)).length, 0);
  assert.equal((await service.listMine(student)).length, 1);
});
test('events, training and seminars all generate certificates only through admin confirmation', async () => {
  const { service } = fixture();
  for (const type of ['event', 'training', 'seminar']) {
    await assert.rejects(service.issue(student, student._id, { ...participation, type }), error => error.status === 403);
    const certificate = await service.issue(admin, student._id, { ...participation, type, title: `${type} activity` });
    assert.equal(certificate.activityType, type);
  }
  assert.equal((await service.listMine(student)).length, 3);
});
test('retries and concurrent confirmations create exactly one immutable certificate', async () => {
  const { service } = fixture();
  const results = await Promise.all(Array.from({ length: 15 }, () => service.issue(admin, student._id, participation)));
  assert.equal(new Set(results.map(record => record._id)).size, 1); assert.equal((await service.listMine(student)).length, 1);
  const again = await service.issue(admin, student._id, { ...participation, organizer: 'Changed organizer' });
  assert.equal(again.organizer, participation.organizer);
});

test('new and legacy certificate IDs use the CLSU prefix across lists, retries and downloads', async () => {
  const { service, seed, bucket } = fixture();
  const created = await service.issue(admin, student._id, participation);
  assert.match(created.certificateNumber, /^CLSU-[A-F0-9]{16}$/);
  assert.equal(bucket('digital_certificates').get(created._id).certificateNumber, created.certificateNumber);
  const suffix = created.certificateNumber.slice(5);
  seed('digital_certificates', { ...created, certificateNumber: `SL-${suffix}` });
  for (const certificate of [
    await service.get(admin, created._id),
    (await service.all(admin))[0],
    (await service.listMine(student))[0],
    await service.issue(admin, student._id, participation),
  ]) {
    assert.equal(certificate.certificateNumber, `CLSU-${suffix}`);
    assert.equal(certificate._id, created._id);
    assert.ok(certificateSvg(certificate).includes(`Certificate ID: CLSU-${suffix}`));
  }
  assert.equal(bucket('digital_certificates').size, 1);
});
test('scheduled activities must have ended and repeated issuance matches existing attendance', async () => {
  const { service, seed } = fixture();
  seed('events', { _id: 'eeeeeeeeeeeeeeeeeeeeeeee', title: participation.title, startAt: '2025-02-15T09:00:00+08:00', endAt: '2025-02-15T12:00:00+08:00' });
  seed('event_registrations', { _id: 'registered', eventId: 'eeeeeeeeeeeeeeeeeeeeeeee', authId: student._id });
  const first = await service.issue(admin, student._id, participation);
  const scheduled = await service.issue(admin, student._id, { ...participation, eventId: 'eeeeeeeeeeeeeeeeeeeeeeee', title: 'Forged' });
  assert.equal(first._id, scheduled._id);
  seed('events', { _id: 'ffffffffffffffffffffffff', title: 'Future event', startAt: '2099-02-15T09:00:00Z' });
  seed('event_registrations', { _id: 'future-registered', eventId: 'ffffffffffffffffffffffff', authId: student._id });
  await assert.rejects(service.issue(admin, student._id, { ...participation, eventId: 'ffffffffffffffffffffffff' }), error => error.status === 400);
});
test('certificate access is limited to its owner and admins', async () => {
  const { service } = fixture();
  const certificate = await service.issue(admin, student._id, participation);
  await assert.rejects(service.get(stranger, certificate._id), error => error.status === 403);
  assert.equal((await service.get(student, certificate._id)).certificateNumber, certificate.certificateNumber);
  assert.equal((await service.get(admin, certificate._id))._id, certificate._id);
  assert.equal((await service.listMine(stranger)).length, 0);
});
test('scheduled certificate type and organizer come from the official activity', async () => {
  const { service, seed } = fixture();
  seed('events', { _id: 'eeeeeeeeeeeeeeeeeeeeeeee', title: 'Official Training', activityType: 'training', organizer: 'CLSU Career Development', startAt: '2025-02-15T09:00:00+08:00', endAt: '2025-02-15T12:00:00+08:00' });
  await assert.rejects(service.issue(admin, student._id, { ...participation, eventId: 'eeeeeeeeeeeeeeeeeeeeeeee' }), error => error.status === 403);
  seed('event_registrations', { _id: 'registered', eventId: 'eeeeeeeeeeeeeeeeeeeeeeee', authId: student._id });
  const certificate = await service.issue(admin, student._id, { ...participation, eventId: 'eeeeeeeeeeeeeeeeeeeeeeee' });
  assert.equal(certificate.activityType, 'training'); assert.equal(certificate.organizer, 'CLSU Career Development');
});
test('generated certificate preserves names and escapes markup in all participant data', async () => {
  const { service } = fixture();
  const certificate = await service.issue(admin, student._id, { ...participation, title: '<script>alert(1)</script> & training', organizer: 'Campus <Team>' });
  const svg = certificateSvg(certificate);
  assert.ok(svg.includes('Alex &amp; Santos')); assert.ok(svg.includes('&lt;script&gt;'));
  assert.equal(svg.includes('<script>'), false); assert.ok(svg.includes(certificate.certificateNumber));
});

test('appreciation template embeds its artwork and uses saved participation and issue dates', async () => {
  const { service } = fixture();
  const certificate = await service.issue(admin, student._id, participation);
  const svg = certificateSvg({ ...certificate, issuedAt: '2025-02-16T17:00:00Z' });
  assert.equal(certificate.templateVersion, 2);
  assert.match(svg, /<title[^>]*>Certificate of Appreciation<\/title>/);
  assert.match(svg, /data:image\/png;base64,iVBOR/);
  assert.match(svg, /width="1148" height="794"/);
  assert.ok(svg.includes('Held on February 15, 2025'));
  assert.ok(svg.includes('Given on February 17, 2025.'));
  assert.ok(svg.includes('Organized by SielAlumni'));
  assert.equal(svg.includes('LEANNE CASTRO'), false);
  assert.equal(svg.includes('October 9-11, 2024'), false);
});
