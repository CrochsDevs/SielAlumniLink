import { createCertificateService } from './certificates.service.js';
import { createCompetencyService } from './competency.service.js';
import { ObjectId } from 'mongodb';
import { createHash } from 'node:crypto';
import { calculateReadiness, fail, pastDate, PORTFOLIO_SECTIONS, text, validateInternship, validatePortfolio } from './development.policy.js';

const idValues = value => ObjectId.isValid(String(value)) ? [String(value), new ObjectId(String(value))] : [String(value)];
const objectId = value => { if (!ObjectId.isValid(String(value))) fail(404, 'Record not found'); return new ObjectId(String(value)); };
const dateString = value => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toISOString().slice(0, 10) : null;
const MILESTONES = [['enrolled', 'Enrolled', 'Officially admitted to CLSU'], ['semester', 'First Semester Completed', 'Completed the first semester'], ['mentorship', 'Joined Mentorship', 'Connected with an alumni mentor'], ['events', 'Participated in Events', 'Recorded university event attendance'], ['internship', 'Internship Completed', 'Completed required internship hours'], ['graduated', 'Graduated', 'Degree conferred'], ['alumni', 'Became Alumni', 'Joined the alumni network'], ['employed', 'Employed', 'Recorded employment']];

export const createDevelopmentService = db => {
  const certificates = createCertificateService(db);
  const competencies = createCompetencyService(db);
  const records = db.collection('student_development');
  const portfolios = db.collection('student_portfolios');
  const internships = db.collection('internship_records');
  const attendance = db.collection('student_event_attendance');
  const snapshot = async user => {
    const authId = String(user._id);
    const [profile, record, storedPortfolio, placements, connections, tracer, events, competency, digitalCertificates] = await Promise.all([
      db.collection('users').findOne({ $or: [{ authId: { $in: idValues(authId) } }, { email: user.email }] }),
      records.findOne({ _id: authId }), portfolios.findOne({ _id: authId }),
      internships.find({ authId }).sort({ startDate: -1 }).toArray(),
      db.collection('connections').find({ status: 'accepted', $or: [{ requesterAuthId: { $in: idValues(authId) } }, { recipientAuthId: { $in: idValues(authId) } }, { requesterEmail: user.email }, { recipientEmail: user.email }] }).toArray(),
      db.collection('tracer_responses').findOne({ authId: { $in: idValues(authId) } }),
      attendance.find({ authId }).sort({ date: -1 }).toArray(),
      competencies.get(user),
      certificates.listMine(user),
    ]);
    const mentors = [];
    for (const connection of connections) {
      const isFrom = String(connection.requesterAuthId) === authId || connection.requesterEmail === user.email;
      const other = isFrom ? connection.recipientAuthId : connection.requesterAuthId;
      const email = isFrom ? connection.recipientEmail : connection.requesterEmail;
      const account = await db.collection('auth').findOne({ $or: [{ _id: { $in: idValues(other) } }, { email }] });
      if (String(account?.role).toLowerCase() === 'alumni') mentors.push(connection);
    }
    const portfolio = Object.fromEntries(PORTFOLIO_SECTIONS.map(section => {
      const entries = storedPortfolio?.[section] ?? profile?.[section];
      return [section, Array.isArray(entries) ? entries : []];
    }));
    const milestones = { ...record?.milestones };
    const auto = {};
    const setAuto = (key, value, source) => {
      if (milestones[key] || !dateString(value)) return;
      auto[`milestones.${key}`] = { date: dateString(value), source };
      milestones[key] = auto[`milestones.${key}`];
    };
    if (mentors.length) setAuto('mentorship', mentors.map(item => item.updatedAt || item.createdAt).filter(Boolean).sort((a, b) => new Date(a) - new Date(b))[0], 'Accepted alumni connection');
    if (events.length) setAuto('events', `${events.map(event => event.date).sort()[0]}T00:00:00Z`, 'Self-reported event attendance');
    const completed = placements.filter(item => item.completed);
    if (completed.length) setAuto('internship', completed.map(item => item.endDate ? `${item.endDate}T00:00:00Z` : item.updatedAt).sort((a, b) => new Date(a) - new Date(b))[0], 'Self-reported internship');
    const graduatedAt = profile?.graduatedAt || user.graduatedAt;
    if (graduatedAt) { setAuto('graduated', graduatedAt, 'University graduation record'); setAuto('alumni', graduatedAt, 'Account graduation'); }
    const employmentDates = [
      ...[tracer, ...(Array.isArray(tracer?.responseHistory) ? tracer.responseHistory : [])]
        .filter(item => ['Employed', 'Self-employed'].includes(item?.status))
        .map(item => ({ date: dateString(item.employmentDate || item.recordedAt || item.updatedAt || item.respondedAt), source: 'Tracer response' })),
      ...(Array.isArray(profile?.employmentHistory) ? profile.employmentHistory : [])
        .filter(item => item?.company)
        .map(item => ({ date: dateString(item.startDate || item.start), source: 'Profile employment record' })),
    ].filter(item => item.date && item.date <= new Date().toISOString().slice(0, 10))
      .sort((a, b) => a.date.localeCompare(b.date));
    if (employmentDates.length) setAuto('employed', employmentDates[0].date, employmentDates[0].source);
    if (Object.keys(auto).length) {
      // A simultaneous snapshot must not overwrite an already recorded milestone.
      const saved = await records.findOneAndUpdate({ _id: authId }, [{ $set: {
        ...Object.fromEntries(Object.entries(auto).map(([key, value]) => [key, { $ifNull: [`$${key}`, { $literal: value }] }])),
        createdAt: { $ifNull: ['$createdAt', new Date()] },
      } }], { upsert: true, returnDocument: 'after' });
      Object.assign(milestones, saved.milestones);
    }
    let currentAssigned = false;
    const timeline = MILESTONES.map(([key, title, desc]) => {
      const entry = milestones[key];
      const state = entry ? 'done' : !currentAssigned ? 'current' : 'upcoming';
      if (state === 'current') currentAssigned = true;
      return { key, title, desc, date: entry?.date || null, source: entry?.source || '', state };
    });
    // Historic milestones remain after connections end or internship entries change.
    const readiness = calculateReadiness({ mentorCount: mentors.length || (milestones.mentorship ? 1 : 0), eventCount: events.length, portfolio, internships: placements });
    return { timeline, portfolio, internships: placements, events, readiness, mentorCount: mentors.length, competencies: competency, digitalCertificates };
  };
  const saveAcademic = async (user, input) => {
    if (!['enrolled', 'semester'].includes(input.key)) fail(400, 'Only enrollment and semester completion can be recorded here');
    const date = pastDate(input.date);
    const own = await records.findOne({ _id: String(user._id) });
    const enrolled = input.key === 'enrolled' ? date : own?.milestones?.enrolled?.date;
    const semester = input.key === 'semester' ? date : own?.milestones?.semester?.date;
    if (semester && enrolled && semester < enrolled) fail(400, 'Semester completion cannot precede enrollment');
    await records.updateOne({ _id: String(user._id) }, { $set: { [`milestones.${input.key}`]: { date, source: 'Self-reported academic record' }, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
    return snapshot(user);
  };
  const addEvent = async (user, input) => {
    const title = text(input.title, 'Event name', 200, true), date = pastDate(input.date);
    const authId = String(user._id);
    const id = createHash('sha256').update(JSON.stringify([authId, title.toLowerCase(), date])).digest('hex').slice(0, 24);
    try { await attendance.insertOne({ _id: new ObjectId(id), authId, title, date, source: 'Self-reported', recordedAt: new Date() }); }
    catch (error) { if (error.code === 11000) fail(409, 'This event attendance is already recorded'); throw error; }
    return snapshot(user);
  };
  const removeEvent = async (user, id) => {
    const result = await attendance.deleteOne({ _id: objectId(id), authId: String(user._id), certificateId: { $exists: false } });
    if (!result.deletedCount) fail(404, 'Attendance record not found or already confirmed');
    return snapshot(user);
  };
  const saveInternship = async (user, input, id) => {
    const data = validateInternship(input);
    if (id) {
      const result = await internships.updateOne({ _id: objectId(id), authId: String(user._id) }, { $set: { ...data, updatedAt: new Date() } });
      if (!result.matchedCount) fail(404, 'Internship not found');
    } else await internships.insertOne({ ...data, authId: String(user._id), createdAt: new Date(), updatedAt: new Date() });
    return snapshot(user);
  };
  const removeInternship = async (user, id) => {
    const result = await internships.deleteOne({ _id: objectId(id), authId: String(user._id) });
    if (!result.deletedCount) fail(404, 'Internship not found');
    return snapshot(user);
  };
  const savePortfolio = async (user, section, entries) => {
    const valid = validatePortfolio(section, entries);
    await portfolios.updateOne({ _id: String(user._id) }, { $set: { [section]: valid, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
    return snapshot(user);
  };
  const saveCompetency = async (user, key, input) => { await competencies.save(user, key, input); return snapshot(user); };
  const resetCompetency = async (user, key) => { await competencies.reset(user, key); return snapshot(user); };
  return { listMentees: competencies.mentees, menteeCompetencies: competencies.details, evaluateCompetency: competencies.evaluate, saveCompetency, resetCompetency, snapshot, saveAcademic, addEvent, removeEvent, saveInternship, removeInternship, savePortfolio };
};
