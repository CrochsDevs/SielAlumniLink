import { ObjectId } from 'mongodb';
import { client } from '../../config/db.js';

const db = client.db('SielAlumni');
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function directoryOptions(query) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 10);
  const role = query.role || 'all';
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000 || ![5, 10, 20, 50].includes(limit)) throw new Error('Invalid pagination.');
  if (!['all', 'students', 'alumni'].includes(role)) throw new Error('Invalid role filter.');
  if (query.q !== undefined && (typeof query.q !== 'string' || query.q.length > 120)) throw new Error('Invalid search text.');
  return { page, limit, role, q: (query.q || '').trim() };
}

const profiles = [
  { $set: { profileKeys: ['$_id', { $toString: '$_id' }] } },
  { $lookup: { from: 'users', localField: 'profileKeys', foreignField: 'authId', pipeline: [
    { $sort: { updatedAt: -1, _id: 1 } }, { $limit: 1 },
    { $project: { name: 1, profilePicture: 1 } },
  ], as: 'profile' } },
  { $set: { name: { $ifNull: [{ $arrayElemAt: ['$profile.name', 0] }, '$email'] },
    profileId: { $arrayElemAt: ['$profile._id', 0] }, profilePicture: { $arrayElemAt: ['$profile.profilePicture', 0] },
    role: { $toLower: '$role' },
  } },
];
const personFields = { _id: 1, name: 1, email: 1, role: 1, profileId: 1, profilePicture: 1 };
const facet = ({ page, limit }, itemStages = []) => ({ $facet: {
  count: [{ $count: 'total' }],
  items: [{ $skip: (page - 1) * limit }, { $limit: limit }, ...itemStages],
} });
const resultPage = (result, options) => {
  const total = result?.count[0]?.total || 0;
  return { items: result?.items || [], total, page: options.page, pages: Math.max(1, Math.ceil(total / options.limit)) };
};

// Each edge is symmetric: the person at the other end is selected regardless of requester.
export function peerStages(owner) {
  const ids = [owner._id, String(owner._id)];
  const isRequester = { $or: [
    { $in: ['$requesterAuthId', ids] },
    { $and: [{ $eq: [{ $ifNull: ['$requesterAuthId', null] }, null] }, { $eq: ['$requesterEmail', owner.email] }] },
  ] };
  return [
    { $match: { status: 'accepted', $or: [
      { requesterAuthId: { $in: ids } }, { recipientAuthId: { $in: ids } },
      { requesterAuthId: null, requesterEmail: owner.email }, { recipientAuthId: null, recipientEmail: owner.email },
    ] } },
    { $project: {
      peerId: { $cond: [isRequester, '$recipientAuthId', '$requesterAuthId'] },
      peerEmail: { $cond: [isRequester, '$recipientEmail', '$requesterEmail'] },
    } },
    { $set: { peerObjectId: { $convert: { input: '$peerId', to: 'objectId', onError: null, onNull: null } } } },
    { $lookup: { from: 'auth', let: { id: '$peerObjectId', email: '$peerEmail' }, pipeline: [
      { $match: { $expr: { $or: [
        { $eq: ['$_id', '$$id'] }, { $and: [{ $eq: ['$$id', null] }, { $eq: ['$email', '$$email'] }] },
      ] } } }, { $project: { role: 1, email: 1 } },
    ], as: 'account' } },
    { $unwind: '$account' },
    { $replaceRoot: { newRoot: '$account' } },
    { $match: { _id: { $ne: owner._id }, role: { $in: ['student', 'alumni', 'Student', 'Alumni'] } } },
    { $group: { _id: '$_id', account: { $first: '$$ROOT' } } },
    { $replaceRoot: { newRoot: '$account' } },
  ];
}

export async function listConnectionMembers(options, database = db) {
  const role = options.role === 'students' ? 'student' : options.role === 'alumni' ? 'alumni' : null;
  const pipeline = [
    { $match: { role: role ? new RegExp(`^${role}$`, 'i') : /^(student|alumni)$/i } },
    ...profiles,
    ...(options.q ? [{ $match: { $or: [{ name: { $regex: escapeRegex(options.q), $options: 'i' } }, { email: { $regex: escapeRegex(options.q), $options: 'i' } }] } }] : []),
    { $sort: { name: 1, _id: 1 } },
    facet(options, [{ $project: personFields }]),
  ];
  const [result] = await database.collection('auth').aggregate(pipeline, { maxTimeMS: 5000 }).toArray();
  const data = resultPage(result, options);
  // Count only the displayed members; each query is bounded to one member's network.
  data.items = await Promise.all(data.items.map(async person => {
    const [count] = await database.collection('connections').aggregate([...peerStages(person), { $count: 'total' }], { maxTimeMS: 5000 }).toArray();
    return { ...person, connectionsCount: count?.total || 0 };
  }));
  return data;
}

export async function listMemberConnections(authId, options, database = db) {
  if (!/^[a-f\d]{24}$/i.test(authId)) return null;
  const owner = await database.collection('auth').findOne({ _id: new ObjectId(authId) }, { projection: { email: 1 } });
  if (!owner) return null;
  const [result] = await database.collection('connections').aggregate([
    ...peerStages(owner), ...profiles,
    ...(options.q ? [{ $match: { name: { $regex: escapeRegex(options.q), $options: 'i' } } }] : []),
    { $sort: { name: 1, _id: 1 } }, facet(options, [{ $project: personFields }]),
  ], { maxTimeMS: 5000 }).toArray();
  return resultPage(result, options);
}

export function adminConnectionHandler(detail = false) {
  return async (req, res) => {
    let options;
    try { options = directoryOptions(req.query); }
    catch (error) { return res.status(400).json({ success: false, message: error.message }); }
    try {
      const data = detail ? await listMemberConnections(req.params.authId, options) : await listConnectionMembers(options);
      if (!data) return res.status(404).json({ success: false, message: 'Member not found.' });
      res.json({ success: true, data });
    } catch (error) {
      console.error('Admin connection directory:', error.message);
      res.status(500).json({ success: false, message: 'Unable to load connections. Please try again.' });
    }
  };
}
