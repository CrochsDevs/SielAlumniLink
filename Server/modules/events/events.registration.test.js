import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryDb, event, host, student, stranger } from '../meetings/meetings.fixture.js';
import { createActivityService, registrationId } from './events.registration.js';
import { createMeetingService } from '../meetings/meetings.service.js';
import { validateEvent, validateRegistrationWindow } from './events.policy.js';
const id = String(event._id);
const activity = { ...event, startAt: new Date('2025-02-15T09:00:00+08:00'), endAt: new Date('2025-02-15T12:00:00+08:00'), registrationLimited: true, registrationOpensAt: new Date('2025-02-14T08:00:00+08:00'), registrationClosesAt: new Date('2025-02-15T08:00:00+08:00') };

test('registration settings validate optional opening, required deadline, chronology, and activity end', () => {
  const input = { ...activity, startAt: activity.startAt.toISOString(), endAt: activity.endAt.toISOString(), registrationOpensAt: activity.registrationOpensAt.toISOString(), registrationClosesAt: activity.registrationClosesAt.toISOString() };
  assert.equal(validateEvent(input).registrationLimited, true);
  assert.equal(validateEvent({ ...input, registrationOpensAt: '' }).registrationOpensAt, null);
  for (const changes of [{ registrationLimited: 'yes' }, { registrationClosesAt: '' }, { registrationClosesAt: 'bad' }, { registrationClosesAt: '2025-02-16T00:00:00Z' }, { registrationOpensAt: input.registrationClosesAt }]) assert.throws(() => validateEvent({ ...input, ...changes }), error => error.status === 400);
  assert.deepEqual(validateEvent({ registrationLimited: false }, true), { registrationLimited: false, registrationOpensAt: null, registrationClosesAt: null });
  assert.throws(() => validateRegistrationWindow({ ...activity, registrationClosesAt: null }), error => error.status === 400);
});
test('only the registration period admits new registrations; exact cutoff and active meeting cannot bypass it', async () => {
  const { db, seed } = createMemoryDb(); seed('events', activity);
  let clock = new Date(activity.registrationOpensAt).getTime() - 1;
  const service = createActivityService(db, { now: () => clock });
  await assert.rejects(service.register(student, id), error => error.status === 400 && /not opened/.test(error.message));
  clock++;
  await service.register(student, id);
  clock = new Date(activity.registrationClosesAt).getTime();
  seed('event_meetings', { _id: id, state: 'active' });
  await assert.rejects(service.register(stranger, id), error => error.status === 400 && /closed/.test(error.message));
  assert.equal((await service.list(stranger))[0].registrationWindow.state, 'closed');
  assert.equal((await service.register(student, id)).authId, String(student._id));
  // Closing registration does not revoke an earlier eligible registration.
  const meetings = createMeetingService(db, { now: () => clock });
  await assert.rejects(meetings.join(student, id), error => error.status === 403);
  clock = new Date(activity.startAt).getTime() - 15 * 60000;
  assert.equal((await meetings.join(student, id)).name, student.name);
});
test('public listings show own registration only; meeting and venue details require registration; draft activities remain private', async () => {
  const { db, seed } = createMemoryDb(); seed('events', { ...event, location: 'Auditorium 2' });
  const service = createActivityService(db);
  assert.equal((await service.list(student))[0].location, '');
  await assert.rejects(service.details(student, id), error => error.status === 403);
  await assert.rejects(createMeetingService(db).details(student, id), error => error.status === 403);
  const docs = await Promise.all(Array.from({ length: 10 }, () => service.register(student, id.toUpperCase())));
  assert.equal(new Set(docs.map(doc => doc._id)).size, 1);
  assert.equal((await service.details(student, id)).location, 'Auditorium 2');
  assert.equal((await service.list(stranger))[0].registered, false);
  assert.equal((await service.list(stranger))[0].registration, null);
  seed('events', { ...event, isActive: false });
  assert.equal((await service.list(student, { all: true })).length, 0);
  assert.equal((await service.list(host, { all: true })).length, 1);
});
test('on-site check-in requires a registered participant and an admin, and preserves the first check-in', async () => {
  const { db, seed } = createMemoryDb(); seed('events', { ...activity, deliveryMode: 'onsite' });
  let clock = new Date(activity.registrationOpensAt).getTime();
  const service = createActivityService(db, { now: () => clock });
  await service.register(student, id);
  await assert.rejects(service.checkIn(host, id, student._id), error => error.status === 400);
  clock = new Date(activity.startAt).getTime();
  await assert.rejects(service.checkIn(student, id, student._id), error => error.status === 403);
  await assert.rejects(service.checkIn(host, id, stranger._id), error => error.status === 403);
  const first = await service.checkIn(host, id, student._id); const checkedAt = first.onsiteCheckedInAt.getTime();
  clock += 50000;
  assert.equal((await service.checkIn(host, id, student._id)).onsiteCheckedInAt.getTime(), checkedAt);
  assert.equal((await service.roster(host, id)).length, 1);
  await assert.rejects(service.certifyOnsite(host, id, student._id), error => error.status === 400);
  clock = new Date(activity.endAt).getTime();
  const certificate = await service.certifyOnsite(host, id, student._id);
  assert.equal(certificate.studentAuthId, String(student._id));
  assert.equal((await service.certifyOnsite(host, id, student._id))._id, certificate._id);
  await assert.rejects(service.certifyOnsite(host, id, stranger._id), error => error.status === 400);
});
test('disabling the custom period admits both activity modes until the activity ends', async () => {
  for (const deliveryMode of ['online', 'onsite']) {
    const { db, seed } = createMemoryDb(); seed('events', { ...activity, deliveryMode, registrationLimited: false });
    let clock = new Date(activity.startAt).getTime();
    const service = createActivityService(db, { now: () => clock });
    assert.equal((await service.register(student, id))._id, registrationId(id, student._id));
    clock = new Date(activity.endAt).getTime();
    await assert.rejects(service.register(stranger, id), error => error.status === 400);
  }
});
