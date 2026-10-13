import { ObjectId } from 'mongodb';
import { createHash } from 'node:crypto';
import { COMPETENCY_FRAMEWORK, competencySnapshot, validateCompetency, validateMentorEvaluation } from './competency.policy.js';
import { fail } from './development.policy.js';

export function createCompetencyService(db) {
  const collection = db.collection('student_competencies');
  const evaluations = db.collection('student_competency_evaluations');
  const ids = value => ObjectId.isValid(String(value)) ? [String(value), new ObjectId(String(value))] : [String(value)];
  const profileFor = user => db.collection('users').findOne({ $or: [{ authId: { $in: ids(user._id) } }, { email: user.email }] });
  const get = async user => {
    const [record, feedback] = await Promise.all([collection.findOne({ _id: String(user._id) }), evaluations.find({ studentAuthId: String(user._id) }).toArray()]);
    return competencySnapshot(record, feedback);
  };
  const requireMentee = async (mentor, studentId) => {
    if (mentor.role !== 'alumni') fail(403, 'Only alumni mentors can provide evaluations');
    if (!ObjectId.isValid(String(studentId))) fail(404, 'Student not found');
    const student = await db.collection('auth').findOne({ _id: { $in: ids(studentId) }, role: 'student' });
    if (!student) fail(404, 'Student not found');
    const connection = await db.collection('connections').findOne({ status: 'accepted', $or: [
      { requesterAuthId: { $in: ids(mentor._id) }, recipientAuthId: { $in: ids(student._id) } },
      { requesterAuthId: { $in: ids(student._id) }, recipientAuthId: { $in: ids(mentor._id) } },
    ] });
    if (!connection) fail(403, 'You can only evaluate students with an accepted mentorship connection');
    return student;
  };
  const details = async (mentor, studentId) => {
    const student = await requireMentee(mentor, studentId);
    const [profile, competencies, portfolio] = await Promise.all([profileFor(student), get(student), db.collection('student_portfolios').findOne({ _id: String(student._id) })]);
    const sections = ['skills', 'projects', 'research', 'certifications', 'seminars', 'awards'];
    return { student: { authId: String(student._id), name: profile?.name || student.email, email: student.email, program: profile?.program || '', profilePicture: profile?.profilePicture || null }, competencies,
      portfolio: Object.fromEntries(sections.map(key => [key, Array.isArray(portfolio?.[key] ?? profile?.[key]) ? (portfolio?.[key] ?? profile?.[key]) : []])) };
  };
  return {
    get,
    details,
    async mentees(mentor) {
      if (mentor.role !== 'alumni') fail(403, 'Only alumni mentors can access student evaluations');
      const connections = await db.collection('connections').find({ status: 'accepted', $or: [{ requesterAuthId: { $in: ids(mentor._id) } }, { recipientAuthId: { $in: ids(mentor._id) } }] }).toArray();
      const others = [...new Set(connections.map(connection => String(connection.requesterAuthId) === String(mentor._id) ? String(connection.recipientAuthId) : String(connection.requesterAuthId)))];
      const students = [];
      for (const id of others) {
        const account = await db.collection('auth').findOne({ _id: { $in: ids(id) }, role: 'student' });
        if (!account) continue;
        const profile = await profileFor(account);
        students.push({ authId: String(account._id), name: profile?.name || account.email, email: account.email, program: profile?.program || '', profilePicture: profile?.profilePicture || null });
      }
      return students.sort((a, b) => a.name.localeCompare(b.name));
    },
    async evaluate(mentor, studentId, key, input) {
      const student = await requireMentee(mentor, studentId);
      const validated = validateMentorEvaluation(key, input);
      const profile = await profileFor(mentor);
      const now = new Date();
      const _id = createHash('sha256').update(JSON.stringify([String(student._id), String(mentor._id), key])).digest('hex');
      await evaluations.updateOne({ _id }, { $set: { ...validated, studentAuthId: String(student._id), mentorAuthId: String(mentor._id), mentorName: profile?.name || mentor.email, competencyKey: key, updatedAt: now }, $setOnInsert: { createdAt: now } }, { upsert: true });
      return details(mentor, studentId);
    },
    async save(user, key, input) {
      const validated = validateCompetency(key, input);
      const now = new Date();
      await collection.updateOne({ _id: String(user._id) }, {
        $set: { [`assessments.${key}`]: { ...validated, updatedAt: now }, updatedAt: now },
        $setOnInsert: { createdAt: now },
      }, { upsert: true });
      return get(user);
    },
    async reset(user, key) {
      if (!COMPETENCY_FRAMEWORK.some(item => item.key === key)) fail(400, 'Unknown competency');
      await collection.updateOne({ _id: String(user._id) }, { $unset: { [`assessments.${key}`]: '' }, $set: { updatedAt: new Date() } });
      return get(user);
    },
  };
}
