import { ObjectId } from 'mongodb';
import { canViewPost, fail, membershipUpdate, POST_TYPES, validateComment, validatePost } from './feed.policy.js';

const objectId = (value) => {
  if (!ObjectId.isValid(value)) fail(404, 'Post not found');
  return new ObjectId(value);
};

export const createFeedService = (db, changed = () => {}) => {
  const posts = db.collection('feed_posts');
  const comments = db.collection('feed_comments');
  const images = db.collection('feed_images');

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
    if (!canViewPost(post, user._id, connected)) fail(404, 'Post not found or no longer available to you');
    if (post.originalPostId) {
      const original = await posts.findOne({ _id: post.originalPostId, deletedAt: null });
      if (!canViewPost(original, user._id, connected)) fail(404, 'Original post is no longer available to you');
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
    const original = post.originalPostId ? await posts.findOne({ _id: post.originalPostId, deletedAt: null }) : null;
    return {
      _id: post._id, author: await authors.get(id), type: post.type, title: post.title, body: post.body,
      audience: post.audience, details: post.details || {}, createdAt: post.createdAt, updatedAt: post.updatedAt,
      images: (post.images || []).map(image => ({ id: image.id, alt: image.alt || '', width: image.width, height: image.height,
        url: `/api/feed/${post._id}/images/${image.id}` })),
      likesCount: (post.likedBy || []).length, likedByMe: (post.likedBy || []).includes(String(user._id)),
      commentsCount: await comments.countDocuments({ postId: post._id, deletedAt: null }),
      sharesCount: await posts.countDocuments({ originalPostId: post._id, deletedAt: null }),
      attendingCount: (post.attending || []).length, attendingByMe: (post.attending || []).includes(String(user._id)),
      isMine: id === String(user._id), originalPost: original ? await serialize(original, user, authors) : null,
    };
  };

  const list = async (user, query = {}) => {
    const network = await connectedIds(user);
    const accessible = [String(user._id), ...network];
    const visibility = { $or: [{ audience: 'public' }, { authorAuthId: { $in: accessible } }] };
    const filter = { deletedAt: null, ...visibility };
    if (query.type && query.type !== 'all') {
      if (!POST_TYPES.includes(query.type)) fail(400, 'Invalid feed filter');
      filter.type = query.type;
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
        { $or: [{ 'original.0.audience': 'public' }, { 'original.0.authorAuthId': { $in: accessible } }] },
      ] }] } },
      { $limit: limit + 1 }, { $project: { original: 0 } },
    ]).toArray();
    const page = rows.slice(0, limit);
    const authors = new Map();
    return { posts: await Promise.all(page.map(p => serialize(p, user, authors))),
      nextCursor: rows.length > limit ? String(page.at(-1)._id) : null };
  };

  const create = async (user, input) => {
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

  const getImage = async (user, id, imageId) => {
    const post = await readable(id, user);
    if (!(post.images || []).some(image => image.id === String(imageId))) fail(404, 'Image not found');
    const image = await images.findOne({ _id: objectId(imageId) });
    if (!image) fail(404, 'Image not found');
    return image;
  };

  const setMembership = async (user, id, field, enabled) => {
    if (typeof enabled !== 'boolean') fail(400, 'Provide a true or false action');
    const post = await readable(id, user);
    if (field === 'attending' && (post.type !== 'event' || post.originalPostId)) fail(400, 'RSVP on the original event post');
    const updated = await posts.findOneAndUpdate({ _id: post._id, deletedAt: null },
      membershipUpdate(field, user._id, enabled), { returnDocument: 'after' });
    if (!updated) fail(404, 'Post no longer available');
    changed();
    return serialize(updated, user);
  };

  const listComments = async (user, id, before) => {
    const post = await readable(id, user);
    const filter = { postId: post._id, deletedAt: null };
    if (before) filter._id = { $lt: objectId(before) };
    const rows = await comments.find(filter).sort({ _id: -1 }).limit(31).toArray();
    return { comments: await Promise.all(rows.slice(0, 30).map(async c => ({
      _id: c._id, body: c.body, createdAt: c.createdAt, author: await author(c.authorAuthId),
      isMine: String(c.authorAuthId) === String(user._id),
    }))), nextCursor: rows.length > 30 ? String(rows[29]._id) : null };
  };

  const comment = async (user, id, body) => {
    const valid = validateComment(body);
    const post = await readable(id, user);
    const doc = { postId: post._id, authorAuthId: String(user._id), body: valid, createdAt: new Date(), deletedAt: null };
    const result = await comments.insertOne(doc);
    changed();
    return { _id: result.insertedId, body: valid, createdAt: doc.createdAt, author: await author(user._id), isMine: true };
  };

  const removeComment = async (user, id, commentId) => {
    const post = await readable(id, user);
    const result = await comments.updateOne({ _id: objectId(commentId), postId: post._id,
      authorAuthId: String(user._id), deletedAt: null }, { $set: { deletedAt: new Date() } });
    if (!result.matchedCount) fail(404, 'Comment not found');
    changed();
  };

  const share = async (user, id, input) => {
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
    if (post.authorAuthId !== String(user._id) && user.role !== 'admin') fail(403, 'Only the author can delete this post');
    await posts.updateOne({ _id: post._id }, { $set: { deletedAt: new Date() } });
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

  return { list, create, get, getImage, readable, connectedIds, setMembership, listComments, comment, removeComment, share, remove, recipients };
};

export const ensureFeedIndexes = async (db) => {
  await db.collection('feed_posts').createIndex({ authorAuthId: 1, audience: 1, _id: -1 });
  await db.collection('feed_posts').createIndex({ originalPostId: 1, deletedAt: 1 });
  await db.collection('feed_comments').createIndex({ postId: 1, deletedAt: 1, _id: -1 });
  await db.collection('feed_images').createIndex({ ownerAuthId: 1, createdAt: -1 });
};
