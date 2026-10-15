import { ObjectId } from 'mongodb';
import { createHash } from 'node:crypto';
import { goalSnapshot, validateGoal } from './mentorship.policy.js';

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const ids = value => ObjectId.isValid(String(value)) ? [String(value), new ObjectId(String(value))] : [String(value)];

export function createMentorshipService(db) {
  const goals = db.collection('mentorship_goals');
  const connectionCollection = db.collection('connections');
  const accounts = db.collection('auth');
  const roleCheck = user => { if (!['student', 'alumni'].includes(user.role)) fail(403, 'Only students and alumni can use mentorship progress'); };
  const pairFor = async connection => {
    const [requester, recipient] = await Promise.all([
      accounts.findOne({ _id: { $in: ids(connection.requesterAuthId) } }),
      accounts.findOne({ _id: { $in: ids(connection.recipientAuthId) } }),
    ]);
    const student = [requester, recipient].find(account => account?.role === 'student');
    const mentor = [requester, recipient].find(account => account?.role === 'alumni');
    return student && mentor ? { student, mentor } : null;
  };
  const requireConnection = async (user, connectionId) => {
    roleCheck(user);
    if (!ObjectId.isValid(String(connectionId))) fail(404, 'Mentorship connection not found');
    const connection = await connectionCollection.findOne({ _id: { $in: ids(connectionId) } });
    if (!connection) fail(404, 'Mentorship connection not found');
    if (![connection.requesterAuthId, connection.recipientAuthId].some(id => String(id) === String(user._id)) || connection.status !== 'accepted') {
      fail(403, 'Progress is available only to participants of an accepted mentorship connection');
    }
    const pair = await pairFor(connection);
    if (!pair) fail(403, 'This connection is not a student–alumni mentorship');
    return { connection, ...pair };
  };
  const participant = async account => {
    const profile = await db.collection('users').findOne({ authId: { $in: ids(account._id) } });
    return { authId: String(account._id), name: profile?.name || account.email, email: account.email, program: profile?.program || '', profilePicture: profile?.profilePicture || null };
  };
  const snapshot = async pair => {
    const [records, student, mentor, profile, portfolio, preferences] = await Promise.all([
      goals.find({ connectionId: String(pair.connection._id) }).toArray(), participant(pair.student), participant(pair.mentor),
      db.collection('users').findOne({ authId: { $in: ids(pair.student._id) } }),
      db.collection('student_portfolios').findOne({ _id: String(pair.student._id) }),
      db.collection('mentor_match_preferences').findOne({ _id: String(pair.student._id) }),
    ]);
    const activities = { resume_building: [], career_planning: [] };
    if (profile?.bio?.trim()) activities.resume_building.push({ label: 'Resume summary saved in Portfolio', recordedAt: profile.updatedAt || null, href: '/student/portfolio' });
    if (['skills', 'projects', 'research', 'certifications', 'seminars', 'awards'].some(key => Array.isArray(portfolio?.[key] ?? profile?.[key]) && (portfolio?.[key] ?? profile?.[key]).length)) {
      activities.resume_building.push({ label: 'Skills or experience saved in Portfolio', recordedAt: portfolio?.updatedAt || profile?.updatedAt || null, href: '/student/portfolio' });
    }
    if (preferences?.careerGoals?.trim()) activities.career_planning.push({ label: 'Career goals saved in AI Mentor Matching', recordedAt: preferences.updatedAt || null });
    const interests = preferences?.interests ?? profile?.interests;
    if (Array.isArray(interests) && interests.some(value => typeof value === 'string' && value.trim())) activities.career_planning.push({ label: 'Career interests saved', recordedAt: preferences?.updatedAt || profile?.updatedAt || null });
    return { connectionId: String(pair.connection._id), trackingMode: 'activity-with-mentor-review', student, mentor, connectedAt: pair.connection.createdAt || null, ...goalSnapshot(records, activities) };
  };
  return {
    async list(user) {
      roleCheck(user);
      const connections = await connectionCollection.find({ status: 'accepted', $or: [{ requesterAuthId: { $in: ids(user._id) } }, { recipientAuthId: { $in: ids(user._id) } }] }).toArray();
      const pairs = await Promise.all(connections.map(async connection => {
        const pair = await pairFor(connection);
        return pair ? { connection, ...pair } : null;
      }));
      return Promise.all(pairs.filter(Boolean).map(snapshot));
    },
    async get(user, connectionId) { return snapshot(await requireConnection(user, connectionId)); },
    async update(user, connectionId, key, input) {
      const pair = await requireConnection(user, connectionId);
      const validated = validateGoal(key, input);
      const _id = createHash('sha256').update(JSON.stringify([String(pair.connection._id), key])).digest('hex');
      const current = await goals.findOne({ _id });
      const revision = current?.revision || 0;
      if (validated.revision !== revision) fail(409, 'This goal was updated by your mentorship partner. Refresh and try again.');
      const previouslyConfirmed = current?.status === 'completed' && !!(current.confirmedByAuthId || current.updatedByRole === 'alumni');
      if (user.role === 'student' && validated.status === 'completed' && !previouslyConfirmed) fail(403, 'Only your mentor can confirm a goal as Completed. Save your activity note for review.');
      if (user.role === 'student' && previouslyConfirmed && validated.status !== 'completed') fail(403, 'Only your mentor can reopen a completed goal.');
      const actor = await participant(user);
      const now = new Date();
      // Students log activities; only mentors change review/completion status.
      const status = user.role === 'alumni' ? validated.status : previouslyConfirmed ? 'completed' : current?.status === 'in_progress' ? 'in_progress' : 'not_started';
      const confirmed = status === 'completed' && (user.role === 'alumni' || previouslyConfirmed);
      const update = {
        connectionId: String(pair.connection._id), goalKey: key,
        studentAuthId: String(pair.student._id), mentorAuthId: String(pair.mentor._id),
        status, note: validated.note ?? current?.note ?? '',
        startedAt: status === 'not_started' && !(validated.note ?? current?.note)?.trim() ? null : current?.startedAt || now,
        completedAt: confirmed ? current?.completedAt || now : null,
        confirmedByAuthId: confirmed ? current?.confirmedByAuthId || (previouslyConfirmed ? current.updatedByAuthId : String(user._id)) : null,
        updatedAt: now, updatedByAuthId: String(user._id), updatedByName: actor.name, updatedByRole: user.role,
      };
      try {
        const result = await goals.updateOne({ _id, revision }, { $set: update, $inc: { revision: 1 }, $setOnInsert: { createdAt: now } }, { upsert: revision === 0 });
        if (!result.matchedCount && !result.upsertedCount) fail(409, 'This goal changed. Refresh and try again.');
      } catch (error) {
        if (error.code === 11000) fail(409, 'This goal changed. Refresh and try again.');
        throw error;
      }
      return snapshot(pair);
    },
  };
}
