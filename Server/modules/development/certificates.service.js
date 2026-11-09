import { createHash } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { fail, pastDate, text } from '../development/development.policy.js';

const types = ['event', 'training', 'seminar'];
const ids = value => ObjectId.isValid(String(value)) ? [String(value), new ObjectId(String(value))] : [String(value)];
const dayInManila = value => new Date(value).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
// Keep legacy certificates consistent with the current CLSU numbering format.
const formatCertificate = certificate => ({ ...certificate, certificateNumber: certificate.certificateNumber?.replace(/^SL-/, 'CLSU-') });
export function validateParticipation(input) {
  if (!types.includes(input.type)) fail(400, 'Choose event, training, or seminar');
  if (input.completed !== true) fail(400, 'Confirm completed participation before issuing a certificate');
  return { type: input.type, title: text(input.title, 'Activity title', 300, true), date: pastDate(input.date, 'Participation date'), organizer: text(input.organizer, 'Organizer', 200, true) };
}

export function createCertificateService(db) {
  const certificates = db.collection('digital_certificates');
  const attendance = db.collection('student_event_attendance');
  const adminOnly = user => { if (user.role !== 'admin') fail(403, 'Only administrators can confirm participation'); };
  const accountFor = id => db.collection('auth').findOne({ _id: { $in: ids(id) }, role: { $in: ['student', 'alumni'] } });
  const profileFor = account => db.collection('users').findOne({ $or: [{ authId: { $in: ids(account._id) } }, { email: account.email }] });
  const listMine = async user => (await certificates.find({ studentAuthId: String(user._id) }).sort({ issuedAt: -1 }).toArray()).map(formatCertificate);
  const issue = async (admin, studentId, input, existingAttendance = null) => {
    adminOnly(admin);
    if (!ObjectId.isValid(String(studentId))) fail(400, 'Choose a valid student');
    const account = await accountFor(studentId);
    if (!account) fail(404, 'Student account not found');
    const profile = await profileFor(account);
    const recipientName = text(profile?.name, 'Student profile name', 200, true);
    let source = '';
    let draft = input;
    if (input.eventId) {
      if (!ObjectId.isValid(String(input.eventId))) fail(400, 'Choose a valid scheduled activity');
      const event = await db.collection('events').findOne({ _id: { $in: ids(input.eventId) } });
      if (!event) fail(404, 'Scheduled activity not found');
      if (!await db.collection('event_registrations').findOne({ eventId: String(event._id), authId: String(account._id) })) fail(403, 'Only registered participants can receive a certificate for this activity');
      const completedAt = new Date(event.endAt || event.startAt).getTime();
      if (!Number.isFinite(completedAt) || completedAt > Date.now()) fail(400, 'The scheduled activity has not ended');
      draft = { ...input, title: event.title, date: dayInManila(event.startAt), type: event.activityType || input.type, organizer: event.organizer || input.organizer };
      source = `event:${String(event._id)}`;
    }
    const data = validateParticipation(draft);
    const authId = String(account._id);
    const attendanceId = existingAttendance?._id || new ObjectId(createHash('sha256').update(JSON.stringify([authId, data.title.toLowerCase(), data.date])).digest('hex').slice(0, 24));
    const sourceKey = source || `attendance:${String(attendanceId)}`;
    const _id = createHash('sha256').update(JSON.stringify([authId, String(attendanceId)])).digest('hex');
    const now = new Date();
    const doc = { _id, studentAuthId: authId, recipientName, title: data.title, activityType: data.type, participationDate: data.date, organizer: data.organizer, sourceKey, attendanceId: String(attendanceId), issuedBy: String(admin._id), issuedAt: now, certificateNumber: `CLSU-${_id.slice(0, 16).toUpperCase()}`, templateVersion: 2 };
    try { await certificates.insertOne(doc); }
    catch (error) { if (error.code !== 11000) throw error; }
    const certificate = await certificates.findOne({ _id });
    await attendance.updateOne({ _id: attendanceId }, { $set: { authId, title: certificate.title, date: certificate.participationDate, activityType: certificate.activityType, source: 'Admin-confirmed participation', certificateId: certificate._id, confirmedBy: certificate.issuedBy, confirmedAt: certificate.issuedAt }, $setOnInsert: { recordedAt: now } }, { upsert: true });
    return formatCertificate(certificate);
  };
  return {
    listMine,
    issue,
    async get(user, id) {
      const certificate = await certificates.findOne({ _id: String(id) });
      if (!certificate) fail(404, 'Certificate not found');
      if (user.role !== 'admin' && certificate.studentAuthId !== String(user._id)) fail(403, 'You cannot access another student certificate');
      return formatCertificate(certificate);
    },
    async participants(user) {
      adminOnly(user);
      const accounts = await db.collection('auth').find({ role: { $in: ['student', 'alumni'] } }).toArray();
      return Promise.all(accounts.map(async account => {
        const profile = await profileFor(account);
        return { authId: String(account._id), name: profile?.name || account.email, email: account.email, program: profile?.program || '', role: account.role };
      }));
    },
    async pending(user) {
      adminOnly(user);
      const records = await attendance.find({ certificateId: { $exists: false } }).sort({ date: -1 }).toArray();
      const result = [];
      for (const record of records) {
        const account = await accountFor(record.authId);
        if (!account) continue;
        const profile = await profileFor(account);
        result.push({ ...record, studentName: profile?.name || account.email, studentEmail: account.email });
      }
      return result;
    },
    async all(user) { adminOnly(user); return (await certificates.find({}).sort({ issuedAt: -1 }).toArray()).map(formatCertificate); },
    async confirm(user, id, input) {
      adminOnly(user);
      if (!ObjectId.isValid(String(id))) fail(404, 'Attendance record not found');
      const record = await attendance.findOne({ _id: { $in: ids(id) } });
      if (!record) fail(404, 'Attendance record not found');
      if (record.eventId && !await db.collection('event_registrations').findOne({ eventId: String(record.eventId), authId: String(record.authId) })) fail(403, 'Only registered participants can receive a certificate for this activity');
      return issue(user, record.authId, { type: input.type, organizer: input.organizer, completed: input.completed, title: record.title, date: record.date }, record);
    },
  };
}
