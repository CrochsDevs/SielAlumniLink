import { ObjectId } from 'mongodb';
import { recordAdminAudit } from '../activity/admin-audit.js';
import { canViewPost, ensureFeedParticipation, fail, isFeedAdmin, membershipUpdate, POST_TYPES, STORY_TOPICS, validateComment, validateModeration, validatePost } from './feed.policy.js';

const objectId = (value) => {
  if (!ObjectId.isValid(value)) fail(404, 'Post not found');
  return new ObjectId(value);
};

export const createFeedService = (db, changed = () => {}) => {
  const posts = db.collection('feed_posts');
  const comments = db.collection('feed_comments');
  const images = db.collection('feed_images');
  const restrictions = db.collection('feed_restrictions');
  const assertAdmin = user => { if (!isFeedAdmin(user)) fail(403, 'Only administrators can moderate the feed'); };
  const canRead = (post, user, network) => isFeedAdmin(user) ? !!post && !post.deletedAt : canViewPost(post, user._id, network);
  const status = async user => {
    const restriction = await restrictions.findOne({ _id: String(user._id), blocked: true });
    return { restricted: !isFeedAdmin(user) && !!restriction, reason: !isFeedAdmin(user) ? restriction?.reason || '' : '' };
  };

  const connectedIds = async (user) => {
    const id = String(user._id);
    const ids = ObjectId.isValid(id) ? [id, new ObjectId(id)] : [id];
    const connections = await db.collection('connections').find({
      status: 'accepted',
      $or: [{ requesterAuthId: { $in: ids } }, { recipientAuthId: { $in: ids } },
        { requesterEmail: user.email }, { recipientEmail: user.email }],
    }).toArray();
    return [...new Set(connections.map(c =>
      String(c.requesterAuthId) === id || c.requesterEmail === user.email
        ? String(c.recipientAuthId) : String(c.requesterAuthId)
    ))];
  };

  const readable = async (id, user, network) => {
    const post = await posts.findOne({ _id: objectId(id), deletedAt: null });
    const connected = network ?? await connectedIds(user);
    if (!canRead(post, user, connected)) fail(404, 'Post not found or no longer available to you');
    if (post.originalPostId) {
      const original = await posts.findOne({ _id: post.originalPostId, deletedAt: null });
      if (!canRead(original, user, connected)) fail(404, 'Original post is no longer available to you');
    }
    return post;
  };

  const author = async (id) => {
    const ids = ObjectId.isValid(id) ? [String(id), new ObjectId(id)] : [String(id)];
    const profile = await db.collection('users').findOne({ authId: { $in: ids } });
    const account = profile ? null : await db.collection('auth').findOne({ _id: { $in: ids } });
    return { authId: String(id), _id: profile?._id || null, name: profile?.name || account?.name || 'Member',
      email: profile?.email || account?.email || '', profilePicture: profile?.profilePicture || null,
      program: profile?.program || '', batch: profile?.batch || '', role: profile?.role || account?.role || 'alumni' };
  };

  const serialize = async (post, user, authors = new Map()) => {
    const id = String(post.authorAuthId);
    if (!authors.has(id)) authors.set(id, author(id));
    const originalRequest = post.originalPostId
      ? Object.hasOwn(post, 'original') ? Promise.resolve(post.original[0] || null) : posts.findOne({ _id: post.originalPostId, deletedAt: null })
      : Promise.resolve(null);
    const [person, commentsCount, sharesCount, restriction, originalPost] = await Promise.all([
      authors.get(id),
      comments.countDocuments({ postId: post._id, deletedAt: null }),
      posts.countDocuments({ originalPostId: post._id, deletedAt: null, 'moderation.blocked': { $ne: true } }),
      isFeedAdmin(user) ? restrictions.findOne({ _id: id, blocked: true }) : null,
      originalRequest.then(original => original ? serialize(original, user, authors) : null),
    ]);
    return {
      _id: post._id, author: person, type: post.type, title: post.title, body: post.body,
      audience: post.audience, details: post.details || {}, createdAt: post.createdAt, updatedAt: post.updatedAt,
      images: (post.images || []).map(image => ({ id: image.id, alt: image.alt || '', width: image.width, height: image.height,
        url: `/api/feed/${post._id}/images/${image.id}` })),
      likesCount: (post.likedBy || []).length, likedByMe: (post.likedBy || []).includes(String(user._id)),
      commentsCount, sharesCount,
      attendingCount: (post.attending || []).length, attendingByMe: (post.attending || []).includes(String(user._id)),
      isMine: id === String(user._id), originalPost,
      commentsDisabled: !!post.moderation?.commentsDisabled,
      ...(isFeedAdmin(user) ? { moderation: {
        blocked: !!post.moderation?.blocked, reason: post.moderation?.reason || '',
        commentsDisabled: !!post.moderation?.commentsDisabled,
        authorRestricted: !!restriction, authorRestrictionReason: restriction?.reason || '',
      } } : {}),
    };
  };

  const list = async (user, query = {}, storyBoard = false) => {
    const network = await connectedIds(user);
    const accessible = [String(user._id), ...network];
    const visibility = { $or: [{ audience: 'public' }, { authorAuthId: { $in: accessible } }] };
    if (query.moderation !== undefined && !isFeedAdmin(user)) fail(403, 'Only administrators can view moderated posts');
    const mode = query.moderation || 'published';
    if (!['published', 'blocked', 'all'].includes(mode)) fail(400, 'Invalid moderation filter');
    const filter = { deletedAt: null, ...(isFeedAdmin(user) ? {} : visibility) };
    if (mode !== 'all') filter['moderation.blocked'] = mode === 'blocked' ? true : { $ne: true };
    if (query.type && query.type !== 'all') {
      if (!POST_TYPES.includes(query.type)) fail(400, 'Invalid feed filter');
      filter.type = query.type;
    }
    let searchFilter = null;
    if (query.q !== undefined) {
      if (typeof query.q !== 'string' || query.q.length > 200) fail(400, 'Search must be text of up to 200 characters');
      const search = query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (search) searchFilter = { $or: ['title', 'body', 'details.organization', 'details.location', 'original.0.title', 'original.0.body', 'original.0.details.organization', 'original.0.details.location'].map(field => ({ [field]: { $regex: search, $options: 'i' } })) };
    }
    if (storyBoard) {
      filter.originalPostId = null;
      if (query.topic && query.topic !== 'all') {
        if (!STORY_TOPICS.includes(query.topic)) fail(400, 'Invalid story topic');
        filter['details.story.topic'] = query.topic;
      }
      if (query.mine === 'true') filter.authorAuthId = String(user._id);
    }
    if (query.before) filter._id = { $lt: objectId(query.before) };
    const limit = Math.min(30, Math.max(1, Number(query.limit) || 15));
    // Both the repost and its original must be visible. This prevents reposts
    // from widening a private audience, including after a connection is removed.
    const rows = await posts.aggregate([
      { $match: filter }, { $sort: { _id: -1 } },
      { $lookup: { from: 'feed_posts', localField: 'originalPostId', foreignField: '_id', as: 'original' } },
      { $match: { $or: [{ originalPostId: null }, { $and: [
        { 'original.0.deletedAt': null }, { 'original.0._id': { $exists: true } },
        ...(isFeedAdmin(user) ? [] : [{ 'original.0.moderation.blocked': { $ne: true } },
          { $or: [{ 'original.0.audience': 'public' }, { 'original.0.authorAuthId': { $in: accessible } }] }]),
      ] }] } },
      ...(searchFilter ? [{ $match: searchFilter }] : []),
      { $limit: limit + 1 },
    ]).toArray();
    const page = rows.slice(0, limit);
    const authors = new Map();
    return { posts: await Promise.all(page.map(p => serialize(p, user, authors))),
      nextCursor: rows.length > limit ? String(page.at(-1)._id) : null };
  };

  const create = async (user, input) => {
    await ensureFeedParticipation(db, user);
    if (!['alumni', 'admin'].includes(String(user.role).toLowerCase())) fail(403, 'Only alumni can publish feed posts');
    const data = validatePost(input);
    data.images = await Promise.all(data.images.map(async image => {
      const asset = await images.findOne({ _id: objectId(image.id), ownerAuthId: String(user._id) });
      if (!asset) fail(400, 'An attached image is unavailable or belongs to another user. Upload it again.');
      return { ...image, width: asset.width, height: asset.height };
    }));
    const post = { ...data, authorAuthId: String(user._id), likedBy: [], attending: [],
      originalPostId: null, createdAt: new Date(), updatedAt: new Date(), deletedAt: null };
    const result = await posts.insertOne(post);
    post._id = result.insertedId;
    changed();
    return serialize(post, user);
  };

  const get = async (user, id) => serialize(await readable(id, user), user);

  const updateStory = async (user, id, input) => {
    await ensureFeedParticipation(db, user);
    if (!['alumni', 'admin'].includes(String(user.role).toLowerCase())) fail(403, 'Only alumni can edit success stories');
    const post = await readable(id, user);
    if (String(post.authorAuthId) !== String(user._id)) fail(403, 'Only the author can edit this story');
    if (post.type !== 'story' || post.originalPostId) fail(400, 'Only original success stories can be edited');
    if (input.type !== undefined && input.type !== 'story') fail(400, 'A success story must remain a story');
    const data = validatePost({
      type: 'story', title: post.title, body: post.body, audience: post.audience,
      details: post.details, images: post.images, ...input,
    });
    data.images = await Promise.all(data.images.map(async image => {
      const asset = await images.findOne({ _id: objectId(image.id), ownerAuthId: String(user._id) });
      if (!asset) fail(400, 'An attached image is unavailable or belongs to another user. Upload it again.');
      return { ...image, width: asset.width, height: asset.height };
    }));
    const updated = await posts.findOneAndUpdate({ _id: post._id, authorAuthId: String(user._id), deletedAt: null },
      { $set: { ...data, updatedAt: new Date() } }, { returnDocument: 'after' });
    if (!updated) fail(404, 'Story no longer available');
    changed();
    return serialize(updated, user);
  };

  const getImage = async (user, id, imageId) => {
    const post = await readable(id, user);
    if (!(post.images || []).some(image => image.id === String(imageId))) fail(404, 'Image not found');
    const image = await images.findOne({ _id: objectId(imageId) });
    if (!image) fail(404, 'Image not found');
    return image;
  };

  const setMembership = async (user, id, field, enabled) => {
    await ensureFeedParticipation(db, user);
    if (typeof enabled !== 'boolean') fail(400, 'Provide a true or false action');
    const post = await readable(id, user);
    if (field === 'attending' && (post.type !== 'event' || post.originalPostId)) fail(400, 'RSVP on the original event post');
    const updated = await posts.findOneAndUpdate({ _id: post._id, deletedAt: null },
      membershipUpdate(field, user._id, enabled), { returnDocument: 'after' });
    if (!updated) fail(404, 'Post no longer available');
    changed();
    return serialize(updated, user);
  };

  const listComments = async (user, id, before, parentCommentId = null) => {
    const post = await readable(id, user);
    const parentId = parentCommentId ? objectId(parentCommentId) : null;
    if (parentId && !await comments.findOne({ _id: parentId, postId: post._id, parentCommentId: null, deletedAt: null })) fail(404, 'Comment not found');
    const filter = { postId: post._id, parentCommentId: parentId, deletedAt: null };
    if (before) filter._id = { $lt: objectId(before) };
    const rows = await comments.find(filter).sort({ _id: -1 }).limit(31).toArray();
    const page = rows.slice(0, 30);
    const counts = !parentId && page.length ? await comments.aggregate([
      { $match: { postId: post._id, parentCommentId: { $in: page.map(c => c._id) }, deletedAt: null } },
      { $group: { _id: '$parentCommentId', count: { $sum: 1 } } },
    ]).toArray() : [];
    const replyCounts = new Map(counts.map(row => [String(row._id), row.count]));
    const authors = new Map();
    const person = id => { const key = String(id); if (!authors.has(key)) authors.set(key, author(id)); return authors.get(key); };
    return { comments: await Promise.all(page.map(async c => ({
      _id: c._id, body: c.body, createdAt: c.createdAt, author: await person(c.authorAuthId),
      parentCommentId: c.parentCommentId || null, repliesCount: replyCounts.get(String(c._id)) || 0,
      replyTo: c.replyToAuthId && String(c.replyToAuthId) !== String(c.authorAuthId) ? await person(c.replyToAuthId) : null,
      isMine: String(c.authorAuthId) === String(user._id), canDelete: isFeedAdmin(user) || String(c.authorAuthId) === String(user._id),
    }))), nextCursor: rows.length > 30 ? String(rows[29]._id) : null };
  };

  const comment = async (user, id, body, parentCommentId = null) => {
    await ensureFeedParticipation(db, user);
    const valid = validateComment(body);
    const post = await readable(id, user);
    if (post.moderation?.commentsDisabled) fail(403, 'Comments are turned off for this post');
    let parentId = null;
    let replyToAuthId = null;
    if (parentCommentId !== null && parentCommentId !== undefined) {
      if (typeof parentCommentId !== 'string' || !/^[a-f\d]{24}$/i.test(parentCommentId)) fail(400, 'Invalid reply target');
      const parent = await comments.findOne({ _id: objectId(parentCommentId), postId: post._id, deletedAt: null });
      if (!parent) fail(404, 'Comment not found');
      if (String(parent.authorAuthId) !== String(user._id)) replyToAuthId = String(parent.authorAuthId);
      parentId = parent.parentCommentId || parent._id;
      if (parent.parentCommentId && !await comments.findOne({ _id: parentId, postId: post._id, parentCommentId: null, deletedAt: null })) fail(404, 'Comment not found');
    }
    const doc = { postId: post._id, parentCommentId: parentId, replyToAuthId, authorAuthId: String(user._id), body: valid, createdAt: new Date(), deletedAt: null };
    const result = await comments.insertOne(doc);
    changed();
    return { _id: result.insertedId, parentCommentId: parentId, repliesCount: 0, replyTo: replyToAuthId ? await author(replyToAuthId) : null, body: valid, createdAt: doc.createdAt, author: await author(user._id), isMine: true, canDelete: true };
  };

  const removeComment = async (user, id, commentId) => {
    const post = await readable(id, user);
    const result = await comments.updateOne({ _id: objectId(commentId), postId: post._id,
      ...(isFeedAdmin(user) ? {} : { authorAuthId: String(user._id) }), deletedAt: null },
    { $set: { deletedAt: new Date(), deletedBy: String(user._id) } });
    if (!result.matchedCount) fail(404, 'Comment not found');
    await comments.updateMany({ postId: post._id, parentCommentId: objectId(commentId), deletedAt: null },
      { $set: { deletedAt: new Date(), deletedBy: String(user._id) } });
    await recordAdminAudit(db, user, 'comment_deleted', { type: 'comment', id: commentId, label: post.title || 'Post comment' },
      `Removed comment from post ${post._id}.`);
    changed();
  };

  const share = async (user, id, input) => {
    await ensureFeedParticipation(db, user);
    if (!['alumni', 'admin'].includes(String(user.role).toLowerCase())) fail(403, 'Only alumni can repost');
    const source = await readable(id, user);
    const original = source.originalPostId ? await readable(source.originalPostId, user) : source;
    const audience = input.audience || 'public';
    if (original.audience === 'connections' && audience !== 'connections') fail(403, 'Connections-only posts can only be reposted to connections');
    if (input.body !== undefined && typeof input.body !== 'string') fail(400, 'Post must be text');
    const data = validatePost({ type: 'update', audience, body: input.body?.trim() || 'Shared a post' });
    const doc = { ...data, type: original.type, authorAuthId: String(user._id), originalPostId: original._id,
      likedBy: [], attending: [], createdAt: new Date(), updatedAt: new Date(), deletedAt: null };
    const result = await posts.insertOne(doc);
    doc._id = result.insertedId;
    changed();
    return serialize(doc, user);
  };

  const remove = async (user, id) => {
    const post = await readable(id, user);
    if (post.authorAuthId !== String(user._id) && !isFeedAdmin(user)) fail(403, 'Only the author or an administrator can delete this post');
    await posts.updateOne({ _id: post._id }, { $set: { deletedAt: new Date(), deletedBy: String(user._id) } });
    await recordAdminAudit(db, user, 'post_deleted', { type: 'post', id: post._id, label: post.title || 'Community post' }, 'Removed post from the feed.');
    changed();
  };

  const recipients = async (user, id) => {
    const post = await readable(id, user);
    const original = post.originalPostId ? await readable(post.originalPostId, user) : post;
    const ids = await connectedIds(user);
    const people = await Promise.all(ids.map(async authId => {
      const person = await author(authId);
      if (person.role !== 'alumni' || !person.email) return null;
      const network = await connectedIds({ _id: authId, email: person.email });
      return canViewPost(post, authId, network) && canViewPost(original, authId, network) ? person : null;
    }));
    return people.filter(Boolean);
  };

  const moderate = async (user, id, input) => {
    assertAdmin(user);
    if (!['block', 'comments'].includes(input.action)) fail(400, 'Invalid moderation action');
    const { enabled, reason } = validateModeration(input);
    const post = await posts.findOne({ _id: objectId(id), deletedAt: null });
    if (!post) fail(404, 'Post not found');
    const now = new Date();
    const field = input.action === 'block' ? 'blocked' : 'commentsDisabled';
    const updated = await posts.findOneAndUpdate({ _id: post._id, deletedAt: null }, {
      $set: { [`moderation.${field}`]: enabled,
        ...(input.action === 'block' ? { 'moderation.reason': enabled ? reason : '' } : {}),
        'moderation.updatedAt': now, 'moderation.updatedBy': String(user._id), updatedAt: now },
      $push: { moderationHistory: { action: input.action, enabled, reason, by: String(user._id), at: now } },
    }, { returnDocument: 'after' });
    if (!updated) fail(404, 'Post no longer available');
    await recordAdminAudit(db, user, input.action === 'block' ? (enabled ? 'post_blocked' : 'post_restored')
      : (enabled ? 'comments_disabled' : 'comments_enabled'),
    { type: 'post', id: post._id, label: post.title || 'Community post' }, reason || 'Moderation setting updated.');
    changed();
    return serialize(updated, user);
  };

  const restrictAuthor = async (user, authId, input) => {
    assertAdmin(user);
    const { enabled, reason } = validateModeration(input);
    const target = await db.collection('auth').findOne({ _id: objectId(authId) });
    if (!target) fail(404, 'Member not found');
    if (isFeedAdmin(target)) fail(403, 'Administrators cannot be restricted from the feed');
    const now = new Date();
    await restrictions.updateOne({ _id: String(target._id) }, {
      $set: { blocked: enabled, reason: enabled ? reason : '', updatedBy: String(user._id), updatedAt: now },
      $push: { history: { enabled, reason, by: String(user._id), at: now } },
    }, { upsert: true });
    changed();
    await recordAdminAudit(db, user, enabled ? 'author_restricted' : 'author_unrestricted',
      { type: 'user', id: target._id, label: target.name || target.email }, reason || 'Feed participation restored.');
    return { authId: String(target._id), restricted: enabled };
  };

  const listRestrictions = async user => {
    assertAdmin(user);
    const rows = await restrictions.find({ blocked: true }).sort({ updatedAt: -1 }).limit(100).toArray();
    return Promise.all(rows.map(async row => ({ author: await author(row._id), reason: row.reason, updatedAt: row.updatedAt })));
  };

  return { list, listStories: (user, query = {}) => list(user, { ...query, type: 'story' }, true), create, updateStory, get, getImage, readable, connectedIds, status, moderate, restrictAuthor, listRestrictions,
    setMembership, listComments, comment, removeComment, share, remove, recipients };
};

export const ensureFeedIndexes = async (db) => {
  await db.collection('feed_posts').createIndex({ authorAuthId: 1, audience: 1, _id: -1 });
  await db.collection('feed_posts').createIndex({ originalPostId: 1, deletedAt: 1 });
  await db.collection('feed_comments').createIndex({ postId: 1, deletedAt: 1, _id: -1 });
  await db.collection('feed_comments').createIndex({ postId: 1, parentCommentId: 1, deletedAt: 1, _id: -1 });
  await db.collection('feed_comments').createIndex({ authorAuthId: 1, _id: -1 });
  await db.collection('member_activity').createIndex({ authorAuthId: 1, _id: -1 });
  await db.collection('feed_images').createIndex({ ownerAuthId: 1, createdAt: -1 });
};
