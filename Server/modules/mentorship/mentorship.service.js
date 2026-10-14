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
    const [records, student, mentor] = await Promise.all([
      goals.find({ connectionId: String(pair.connection._id) }).toArray(), participant(pair.student), participant(pair.mentor),
    ]);
    return { connectionId: String(pair.connection._id), student, mentor, connectedAt: pair.connection.createdAt || null, ...goalSnapshot(records) };
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
      const actor = await participant(user);
      const now = new Date();
      const update = {
        connectionId: String(pair.connection._id), goalKey: key,
        studentAuthId: String(pair.student._id), mentorAuthId: String(pair.mentor._id),
        status: validated.status, note: validated.note ?? current?.note ?? '',
        startedAt: validated.status === 'not_started' ? null : current?.startedAt || now,
        completedAt: validated.status === 'completed' ? current?.completedAt || now : null,
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
