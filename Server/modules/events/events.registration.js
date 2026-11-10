import { createHash } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { fail } from '../development/development.policy.js';
import { createCertificateService } from '../development/certificates.service.js';
import { meetingAccessWindow } from '../meetings/meetings.policy.js';

export const registrationId = (eventId, authId) => createHash('sha256').update(JSON.stringify([String(eventId).toLowerCase(), String(authId)])).digest('hex');
const participationId = (authId, title, date) => new ObjectId(createHash('sha256').update(JSON.stringify([String(authId), title.toLowerCase(), date])).digest('hex').slice(0, 24));
const adminOnly = user => { if (user.role !== 'admin') fail(403, 'Only administrators can manage attendance'); };

export function registrationWindow(event, meeting, now = Date.now()) {
  const limited = event.registrationLimited === true;
  const opensAt = limited ? event.registrationOpensAt || null : null;
  const explicitClose = limited ? event.registrationClosesAt : null;
  const activityEnd = event.endAt || event.startAt;
  const closesAt = explicitClose && new Date(explicitClose) < new Date(activityEnd) ? explicitClose : activityEnd;
  const state = meeting?.state === 'ended' || now >= new Date(closesAt).getTime() ? 'closed' : opensAt && now < new Date(opensAt).getTime() ? 'upcoming' : 'open';
  return { state, limited, opensAt, closesAt };
}

export function createActivityService(db, { now = () => Date.now() } = {}) {
  const events = db.collection('events'), registrations = db.collection('event_registrations'), sessions = db.collection('event_meetings');
  const certificates = createCertificateService(db);
  const eventFor = async (user, id) => {
    if (!ObjectId.isValid(String(id))) fail(404, 'Activity not found');
    const event = await events.findOne({ _id: new ObjectId(String(id)) });
    if (!event || (user.role !== 'admin' && !event.isActive)) fail(404, 'Activity not found');
    return event;
  };
  const registrationFor = (user, id) => registrations.findOne({ _id: registrationId(id, user._id) });
  const present = (user, event, registration, meeting) => ({ ...event, location: registration || user.role === 'admin' ? event.location || '' : '', registered: !!registration, registration, registrationWindow: registrationWindow(event, meeting, now()), meetingState: meeting?.state || null, meetingAccess: event.deliveryMode === 'online' ? meetingAccessWindow(event, meeting, now()) : null, hasStarted: now() >= new Date(event.startAt).getTime(), hasEnded: now() >= new Date(event.endAt || event.startAt).getTime() });
  const details = async (user, id) => {
    const event = await eventFor(user, id), registration = await registrationFor(user, id);
    if (user.role !== 'admin' && !registration) fail(403, 'Register for this activity from the Events page first');
    return present(user, event, registration, await sessions.findOne({ _id: String(id) }));
  };
  return {
    eventFor, registrationFor, details,
    async list(user, { all = false } = {}) {
      const list = await events.find(user.role === 'admin' && all ? {} : { isActive: true }).sort({ createdAt: -1, _id: -1 }).toArray();
      const [mine, meetings] = await Promise.all([
        registrations.find({ authId: String(user._id) }).toArray(),
        sessions.find({ _id: { $in: list.map(event => String(event._id)) } }).toArray(),
      ]);
      const byEvent = new Map(mine.map(registration => [registration.eventId, registration]));
      const byMeeting = new Map(meetings.map(meeting => [meeting._id, meeting]));
      return list.map(event => present(user, event, byEvent.get(String(event._id)) || null, byMeeting.get(String(event._id))));
    },
    async register(user, id) {
      if (!['student', 'alumni'].includes(user.role)) fail(403, 'Only students and alumni can register');
      const event = await eventFor(user, id);
      const existing = await registrationFor(user, id);
      // A retry after the deadline still returns the original registration.
      if (existing) return existing;
      const window = registrationWindow(event, await sessions.findOne({ _id: String(id) }), now());
      if (window.state === 'upcoming') fail(400, 'Registration has not opened yet');
      if (window.state === 'closed') fail(400, 'Registration has closed for this activity');
      const profile = await db.collection('users').findOne({ $or: [{ authId: String(user._id) }, { authId: user._id }, { email: user.email }] });
      const doc = { _id: registrationId(id, user._id), eventId: String(event._id), authId: String(user._id), name: profile?.name || user.email, email: user.email, registeredAt: new Date(now()), attendedSeconds: 0 };
      try { await registrations.insertOne(doc); } catch (error) { if (error.code !== 11000) throw error; }
      return registrationFor(user, id);
    },
    async roster(user, id) {
      adminOnly(user); await eventFor(user, id);
      return registrations.find({ eventId: String(id) }).sort({ registeredAt: 1 }).toArray();
    },
    async checkIn(user, id, authId) {
      adminOnly(user);
      const event = await eventFor(user, id);
      if (event.deliveryMode === 'online') fail(400, 'Online attendance is tracked by the meeting room');
      if (new Date(event.startAt).getTime() > now()) fail(400, 'This activity has not started yet');
      const registration = await registrations.findOne({ _id: registrationId(id, authId) });
      if (!registration) fail(403, 'Only registered participants can be checked in');
      const date = new Date(event.startAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
      const record = participationId(authId, event.title, date);
      await db.collection('student_event_attendance').updateOne({ _id: record }, { $setOnInsert: { authId: String(authId), eventId: String(id), title: event.title, date, activityType: event.activityType || 'event', organizer: event.organizer || 'SielAlumni', source: 'On-site attendance check-in', recordedAt: new Date(now()) } }, { upsert: true });
      await registrations.updateOne({ _id: registration._id, onsiteCheckedInAt: { $exists: false } }, { $set: { onsiteCheckedInAt: new Date(now()), checkedInBy: String(user._id), attendanceId: String(record) } });
      return registrations.findOne({ _id: registration._id });
    },
    async certifyOnsite(user, id, authId) {
      adminOnly(user);
      const event = await eventFor(user, id);
      if (event.deliveryMode === 'online') fail(400, 'Confirm online participation from the meeting attendance');
      if (now() < new Date(event.endAt || event.startAt).getTime()) fail(400, 'Wait for this activity to end before confirming participation');
      const registration = await registrations.findOne({ _id: registrationId(id, authId) });
      if (!registration?.onsiteCheckedInAt || !registration.attendanceId) fail(400, 'Check in a registered participant before confirming participation');
      const record = await db.collection('student_event_attendance').findOne({ _id: new ObjectId(registration.attendanceId) });
      if (!record) fail(404, 'Attendance record not found');
      const certificate = await certificates.confirm(user, String(record._id), { type: record.activityType || 'event', organizer: record.organizer || 'SielAlumni', completed: true });
      await registrations.updateOne({ _id: registration._id }, { $set: { certificateId: certificate._id } });
      return certificate;
    },
  };
}
