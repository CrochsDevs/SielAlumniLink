import { ObjectId } from 'mongodb';
import { fail } from '../feed/feed.policy.js';

const profileSections = {
  name: 'name', program: 'program', batch: 'batch', location: 'location', bio: 'about section',
  profilePicture: 'profile photo', bannerImage: 'cover photo', skills: 'skills',
  education: 'education', interests: 'interests', employmentHistory: 'experience',
  profileLinks: 'profile links', projects: 'projects', research: 'research',
  certifications: 'certifications', seminars: 'seminars', awards: 'awards',
};

// Store only section names, never previous values, contact details, or login data.
export async function recordProfileActivity(db, authId, before, after) {
  const sections = Object.entries(profileSections)
    .filter(([field]) => JSON.stringify(before?.[field] ?? null) !== JSON.stringify(after?.[field] ?? null))
    .map(([, label]) => label);
  if (!sections.length) return;
  await db.collection('member_activity').insertOne({
    authorAuthId: String(authId), sections, createdAt: new Date(),
  });
}

export function createMemberActivityService(db, feed) {
  return async (viewer, profileId, query = {}) => {
    const type = query.type || 'all';
    if (!['all', 'posts', 'comments', 'stories', 'profile', 'security', 'admin', 'access'].includes(type)) fail(400, 'Invalid activity filter');
    if (['admin', 'access'].includes(type) && viewer.role !== 'admin') fail(400, 'Invalid activity filter');
    if (query.before && (typeof query.before !== 'string' || !/^[a-f\d]{24}$/i.test(query.before))) fail(400, 'Invalid activity cursor');
    const limit = query.limit === undefined ? 6 : Number(query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 30) fail(400, 'Activity limit must be between 1 and 30');
    const page = query.page === undefined ? null : Number(query.page);
    if (page !== null && (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger((page - 1) * limit))) fail(400, 'Invalid activity page');
    if (page !== null && query.before) fail(400, 'Choose a page or a cursor, not both');
    const users = db.collection('users');
    let profile;
    if (profileId === 'me') {
      profile = await users.findOne({ authId: { $in: [String(viewer._id), new ObjectId(viewer._id)] } });
      // Admin accounts may have no directory profile; identity still comes from the session.
      if (!profile && viewer.role === 'admin') profile = { authId: String(viewer._id) };
    } else {
      if (!/^[a-f\d]{24}$/i.test(profileId)) fail(404, 'Member not found');
      profile = await users.findOne({ _id: new ObjectId(profileId) });
      profile ||= await users.findOne({ authId: { $in: [profileId, new ObjectId(profileId)] } });
    }
    if (!profile?.authId || !ObjectId.isValid(profile.authId)) fail(404, 'Member not found');
    // Ownership is enforced server-side for every filter and page, including admins.
    if (String(profile.authId) !== String(viewer._id)) fail(404, 'Activity logs not found');
    const account = await db.collection('auth').findOne({ _id: new ObjectId(profile.authId) });
    if (!account || account.disabledAt || !['student', 'alumni', 'admin'].includes(account.role)) fail(404, 'Member not found');
    const authorAuthId = String(profile.authId);
    const before = query.before ? { _id: { $lt: new ObjectId(query.before) } } : {};
    const accessible = [String(viewer._id), ...await feed.connectedIds(viewer)];
    // A comment still requires access to its parent post.
    const visiblePost = prefix => ({
      [`${prefix}._id`]: { $exists: true }, [`${prefix}.deletedAt`]: null,
      [`${prefix}.moderation.blocked`]: { $ne: true },
      $or: [{ [`${prefix}.audience`]: 'public' }, { [`${prefix}.authorAuthId`]: { $in: accessible } }],
    });
    const postPipeline = [
      { $match: { authorAuthId, deletedAt: null, ...before,
        ...(type === 'stories' ? { type: 'story', originalPostId: null } : {}),
        ...(['comments', 'profile', 'security', 'admin', 'access'].includes(type) ? { _id: { $in: [] } } : {}) } },
      { $project: { _id: 1, createdAt: 1, kind: { $literal: 'post' }, postId: '$_id' } },
    ];
    const pipeline = [...postPipeline];
    if (['all', 'comments'].includes(type)) pipeline.push({ $unionWith: {
      coll: 'feed_comments', pipeline: [
        { $match: { authorAuthId, deletedAt: null, ...before } },
        { $project: { _id: 1, createdAt: 1, kind: { $literal: 'comment' }, postId: 1, body: 1 } },
      ],
    } });
    // Reuse existing audit records for this admin only; do not create duplicate history.
    if (account.role === 'admin' && ['all', 'admin', 'access'].includes(type)) pipeline.push({ $unionWith: {
      coll: 'activity_logs', pipeline: [
        { $match: { authId: authorAuthId, ...before,
          ...(type === 'admin' ? { action: { $nin: ['login', 'logout'] } }
            : type === 'access' ? { action: { $in: ['login', 'logout'] } } : {}) } },
        { $project: { _id: 1, createdAt: 1, kind: { $literal: 'admin' }, action: 1, target: 1, details: 1 } },
      ],
    } });
    if (['all', 'profile', 'security'].includes(type)) pipeline.push({ $unionWith: {
      coll: 'member_activity', pipeline: [
        { $match: { authorAuthId, ...before,
          ...(type === 'profile' ? { kind: { $ne: 'security' } } : type === 'security' ? { kind: 'security' } : {}) } },
        { $project: { _id: 1, createdAt: 1, kind: { $ifNull: ['$kind', 'profile'] }, sections: 1, action: 1 } },
      ],
    } });
    pipeline.push(
      { $lookup: { from: 'feed_posts', localField: 'postId', foreignField: '_id', as: 'post' } },
      { $unwind: { path: '$post', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'feed_posts', localField: 'post.originalPostId', foreignField: '_id', as: 'original' } },
      { $unwind: { path: '$original', preserveNullAndEmptyArrays: true } },
      { $match: { $or: [{ kind: { $in: ['profile', 'security', 'admin'] } }, { $and: [visiblePost('post'),
        { $or: [{ 'post.originalPostId': null }, visiblePost('original')] },
      ] }] } },
      { $sort: { _id: -1 } },
      { $project: { _id: 1, createdAt: 1, kind: 1, sections: 1, action: 1, body: 1, postId: 1, target: 1, details: 1,
        title: '$post.title',
        postBody: { $substrCP: [{ $ifNull: ['$post.body', ''] }, 0, 500] },
        postType: '$post.type', audience: '$post.audience', originalPostId: '$post.originalPostId',
      } },
    );
    if (page !== null) {
      const [result] = await db.collection('feed_posts').aggregate([...pipeline, { $facet: {
        items: [{ $skip: (page - 1) * limit }, { $limit: limit }],
        count: [{ $count: 'total' }],
      } }]).toArray();
      const total = result?.count[0]?.total || 0;
      return { items: result?.items || [], page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
    }
    pipeline.push({ $limit: limit + 1 });
    const rows = await db.collection('feed_posts').aggregate(pipeline).toArray();
    return { items: rows.slice(0, limit), nextCursor: rows.length > limit ? String(rows[limit - 1]._id) : null };
  };
}
