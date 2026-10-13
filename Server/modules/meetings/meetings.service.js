import { createHash, randomUUID } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { fail } from '../development/development.policy.js';
import { createCertificateService } from '../development/certificates.service.js';
import { createActivityService, registrationId } from '../events/events.registration.js';
import { meetingAccessWindow, requireMeetingAccess } from './meetings.policy.js';

export const MEETING_LIMIT = 8;
export const recordId = registrationId;
export const attendanceId = (authId, title, date) => new ObjectId(createHash('sha256').update(JSON.stringify([String(authId), title.toLowerCase(), date])).digest('hex').slice(0, 24));
const adminOnly = user => { if (user.role !== 'admin') fail(403, 'Only administrators can host meetings'); };
const manilaDay = value => new Date(value).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

export function createMeetingService(db, { now = () => Date.now() } = {}) {
  const sessions = db.collection('event_meetings');
  const registrations = db.collection('event_registrations');
  const attendance = db.collection('student_event_attendance');
  const certificates = createCertificateService(db);
  const activities = createActivityService(db, { now });
  const eventFor = async (user, id) => {
    if (!ObjectId.isValid(String(id))) fail(404, 'Activity not found');
    const event = await db.collection('events').findOne({ _id: new ObjectId(String(id)) });
    if (!event || (user.role !== 'admin' && !event.isActive)) fail(404, 'Activity not found');
    if (event.deliveryMode !== 'online') fail(400, 'This activity has no online meeting room');
    return event;
  };
  const profileFor = user => db.collection('users').findOne({ $or: [{ authId: String(user._id) }, { authId: user._id }, { email: user.email }] });
  const details = async (user, id) => {
    const event = await eventFor(user, id);
    const meeting = await sessions.findOne({ _id: String(id) });
    const registration = await registrations.findOne({ _id: recordId(id, user._id) });
    if (user.role !== 'admin' && !registration) fail(403, 'Register for this activity from the Events page first');
    requireMeetingAccess(user, event, meeting, now());
    return { event, meeting: meeting ? { state: meeting.state, startedAt: meeting.startedAt, endedAt: meeting.endedAt, sessionId: meeting.sessionId } : null, registration, capacity: MEETING_LIMIT, meetingAccess: meetingAccessWindow(event, meeting, now()) };
  };
  return {
    eventFor, details,
    register: activities.register,
    async start(user, id) {
      adminOnly(user); await eventFor(user, id);
      // Atomic upsert keeps concurrent host starts in the same session.
      await sessions.updateOne({ _id: String(id), state: { $ne: 'active' } }, { $set: { state: 'active', sessionId: randomUUID(), hostAuthId: String(user._id), startedAt: new Date(now()), endedAt: null, blockedAuthIds: [] } }, { upsert: false });
      try { await sessions.updateOne({ _id: String(id) }, { $setOnInsert: { state: 'active', sessionId: randomUUID(), hostAuthId: String(user._id), startedAt: new Date(now()), endedAt: null, blockedAuthIds: [] } }, { upsert: true }); }
      catch (error) { if (error.code !== 11000) throw error; }
      return sessions.findOne({ _id: String(id) });
    },
    async join(user, id) {
      const event = await eventFor(user, id);
      const meeting = await sessions.findOne({ _id: String(id) });
      if (user.role !== 'admin' && !await registrations.findOne({ _id: recordId(id, user._id) })) fail(403, 'Register for the activity before joining');
      requireMeetingAccess(user, event, meeting, now());
      if (meeting?.state !== 'active') fail(409, 'Wait for an administrator to start the meeting');
      if (meeting.blockedAuthIds?.includes(String(user._id))) fail(403, 'You have been removed from this meeting');
      const profile = await profileFor(user);
      return { event, meeting, name: profile?.name || user.email };
    },
    async recordVisit(user, event, sessionId, joinedAt, leftAt = now()) {
      if (!['student', 'alumni'].includes(user.role)) return;
      const elapsed = Math.max(0, Math.floor((leftAt - joinedAt) / 1000));
      const date = manilaDay(event.startAt);
      const record = attendanceId(user._id, event.title, date);
      await registrations.updateOne({ _id: recordId(event._id, user._id) }, { $inc: { attendedSeconds: elapsed }, $set: { attendanceId: String(record), lastJoinedAt: new Date(joinedAt), lastLeftAt: new Date(leftAt), lastSessionId: sessionId } });
      await attendance.updateOne({ _id: record }, { $setOnInsert: { authId: String(user._id), eventId: String(event._id), title: event.title, date, activityType: event.activityType || 'event', organizer: event.organizer || 'SielAlumni', source: 'Online meeting attendance', recordedAt: new Date(now()) }, $inc: { onlineSeconds: elapsed } }, { upsert: true });
    },
    async end(user, id) {
      adminOnly(user);
      if (!ObjectId.isValid(String(id))) fail(404, 'Activity not found');
      await sessions.updateOne({ _id: String(id), state: 'active' }, { $set: { state: 'ended', endedAt: new Date(now()) } });
    },
    async block(user, id, authId) {
      adminOnly(user);
      await sessions.updateOne({ _id: String(id) }, { $addToSet: { blockedAuthIds: String(authId) } });
    },
    async roster(user, id) {
      adminOnly(user); await eventFor(user, id);
      return registrations.find({ eventId: String(id) }).sort({ registeredAt: 1 }).toArray();
    },
    async certify(user, id, authId) {
      adminOnly(user);
      const event = await eventFor(user, id);
      const meeting = await sessions.findOne({ _id: String(id) });
      if (meeting?.state !== 'ended') fail(400, 'End the meeting before confirming participation');
      const registration = await registrations.findOne({ _id: recordId(id, authId) });
      if (!registration || registration.attendedSeconds < 1) fail(400, 'This participant has no recorded meeting attendance');
      const record = registration.attendanceId ? await attendance.findOne({ _id: new ObjectId(registration.attendanceId) }) : null;
      if (!record) fail(404, 'Attendance record not found');
      const certificate = await certificates.confirm(user, String(record._id), { type: record.activityType || event.activityType || 'event', organizer: record.organizer || event.organizer || 'SielAlumni', completed: true });
      await registrations.updateOne({ _id: registration._id }, { $set: { certificateId: certificate._id } });
      return certificate;
    },
  };
}
