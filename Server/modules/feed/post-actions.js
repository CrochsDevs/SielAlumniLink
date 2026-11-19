import { recordAdminAudit } from '../activity/admin-audit.js';
import { ObjectId } from 'mongodb';
import { fail, isFeedAdmin } from './feed.policy.js';

export const REPORT_REASONS = ['Spam or misleading content', 'Harassment or bullying', 'Hate speech or discrimination',
  'Inappropriate or offensive content', 'Fake information or impersonation', 'Violence or threats', 'Scam or fraudulent activity', 'Other'];
const id = value => {
  if (!ObjectId.isValid(value)) fail(404, 'Record not found');
  return new ObjectId(value);
};
const plainText = (value = '', max = 2000) => {
  if (typeof value !== 'string' || value.length > max) fail(400, `Provide text of at most ${max} characters`);
  return value.replace(/<[^>]*>/g, '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim();
};
export function createPostActions(db, { readable, serialize, author, moderate, changed, community }) {
  const states = db.collection('feed_post_states');
  const reports = db.collection('feed_post_reports');
  const posts = db.collection('feed_posts');
  const reportQuery = reportId => ({ $or: [{ _id: id(reportId) }, { legacyReportIds: id(reportId) }] });
  const admin = user => { if (!isFeedAdmin(user)) fail(403, 'Only administrators can review reports'); };
  const setState = async (user, postId, input) => {
    const post = await readable(postId, user);
    const patch = {};
    if (Object.hasOwn(input, 'saved')) {
      if (typeof input.saved !== 'boolean') fail(400, 'Provide a true or false saved state');
      patch.saved = input.saved;
    }
    if (Object.hasOwn(input, 'preference')) {
      if (post.authorAuthId === String(user._id)) fail(400, 'Preferences apply to other members’ posts');
      if (![null, 'interested', 'not_interested'].includes(input.preference)) fail(400, 'Invalid preference');
      patch.preference = input.preference;
    }
    if (!Object.keys(patch).length) fail(400, 'Provide a saved state or preference');
    const now = new Date();
    const key = `${user._id}:${post._id}`;
    // A deterministic primary key prevents duplicates even during concurrent upserts.
    try {
      await states.updateOne({ _id: key }, { $set: { ...patch, updatedAt: now },
        $setOnInsert: { userId: String(user._id), postId: post._id, createdAt: now } }, { upsert: true });
    } catch (error) {
      if (error.code !== 11000) throw error;
      await states.updateOne({ _id: key }, { $set: { ...patch, updatedAt: now } });
    }
    return serialize(post, user);
  };
  const pin = async (user, postId, input) => {
    const post = await readable(postId, user);
    if (post.authorAuthId !== String(user._id)) fail(403, 'Only the author can pin this post');
    if (typeof input.pinned !== 'boolean') fail(400, 'Provide a true or false pinned state');
    try {
      await posts.updateOne({ _id: post._id, deletedAt: null }, { $set: { isPinned: input.pinned, updatedAt: new Date() } });
    } catch (error) {
      if (error.code === 11000) fail(409, 'You can pin one post. Unpin your current post first.');
      throw error;
    }
    changed();
    return serialize(await readable(postId, user), user);
  };
  const report = async (user, postId, input) => {
    const post = await readable(postId, user);
    if (post.authorAuthId === String(user._id)) fail(400, 'You cannot report your own post');
    if (!REPORT_REASONS.includes(input.reason)) fail(400, 'Choose a report reason');
    const description = plainText(input.description);
    if (input.reason === 'Other' && !description) fail(400, 'Please provide an explanation when selecting Other.');
    const reporterId = String(user._id);
    if (await reports.countDocuments({ reporterId, createdAt: { $gte: new Date(Date.now() - 3600000) } }) >= 20)
      fail(429, 'Report limit reached. Please try again later.');
    const original = post.originalPostId ? await readable(post.originalPostId, user) : null;
    const now = new Date();
    try {
      const result = await reports.insertOne({ postId: post._id, postOwnerId: post.authorAuthId, reporterId,
        reason: input.reason, description, status: 'pending', active: true, adminNotes: '', reviewedBy: null,
        reviewedAt: null, createdAt: now, updatedAt: now, history: [],
        snapshot: { title: post.title, body: post.body, images: post.images || [], details: post.details, originalPostId: post.originalPostId, original: original ? { title: original.title, body: original.body, images: original.images || [] } : null } });
      if (community) await community.queueReport(result.insertedId, post, { ...input, createdAt: now });
      return { _id: result.insertedId, status: 'pending' };
    } catch (error) {
      if (error.code === 11000) fail(409, 'You already have an active report for this post');
      throw error;
    }
  };
  const detail = async (user, reportId) => {
    admin(user);
    const row = await reports.findOne(reportQuery(reportId));
    if (!row) fail(404, 'Report not found');
    const post = await posts.findOne({ _id: row.postId });
    return { ...row, owner: await author(row.postOwnerId), reporter: await author(row.reporterId),
      snapshot: { ...row.snapshot, images: reportImages(row, row.snapshot?.images), original: row.snapshot?.original ? { ...row.snapshot.original, images: reportImages(row, row.snapshot.original.images) } : null },
      post: post ? await serialize(post, user) : null };
  };
  const listReports = async (user, query = {}) => {
    admin(user);
    const filter = {};
    if (query.status) {
      if (!['pending', 'under_review', 'resolved', 'dismissed'].includes(query.status)) fail(400, 'Invalid report status');
      filter.status = query.status;
    }
    if (query.before) filter._id = { $lt: id(query.before) };
    const [rows, counts] = await Promise.all([
      reports.find(filter).sort({ _id: -1 }).limit(31).toArray(),
      reports.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]).toArray(),
    ]);
    return { reports: await Promise.all(rows.slice(0, 30).map(async row => ({ ...row,
      owner: await author(row.postOwnerId), reporter: await author(row.reporterId) }))),
      counts: Object.fromEntries(counts.map(row => [row._id, row.count])), nextCursor: rows.length > 30 ? String(rows[29]._id) : null };
  };
  const review = async (user, reportId, input) => {
    admin(user);
    const row = await reports.findOne(reportQuery(reportId));
    if (!row) fail(404, 'Report not found');
    const allowed = row.status === 'pending' ? ['under_review', 'dismissed'] : row.status === 'under_review' ? ['resolved', 'dismissed'] : [];
    if (!allowed.includes(input.status)) fail(409, 'Invalid report status transition');
    if (input.removePost !== undefined && typeof input.removePost !== 'boolean') fail(400, 'Provide a true or false removal state');
    const notes = plainText(input.adminNotes);
    if (input.status === 'resolved' && !notes) fail(400, 'Explain the confirmed violation');
    if (community) {
      const post = await posts.findOne({ _id: row.postId });
      if (!post) fail(404, 'Reported post not found');
      await community.queueReport(row._id, post, row);
      await community.review(user, String(row._id), { status: input.status === 'resolved' ? 'confirmed' : input.status, notes: notes || (input.status === 'dismissed' ? 'Report dismissed after administrator review.' : 'Report marked under review.'), level: 1, durationDays: 1, removeContent: input.status === 'resolved' && input.removePost === true });
      await recordAdminAudit(db, user, 'post_report_reviewed', { type: 'post_report', id: row._id, label: row.reason }, `${row.status} -> ${input.status}: ${notes}`);
      return detail(user, reportId);
    }
    const lock = new ObjectId().toString();
    const claimed = await reports.findOneAndUpdate({ _id: row._id, status: row.status, $or: [{ reviewLock: null }, { lockAt: { $lt: new Date(Date.now() - 60000) } }] },
      { $set: { reviewLock: lock, lockAt: new Date() } }, { returnDocument: 'after' });
    if (!claimed) fail(409, 'Another administrator is reviewing this report. Reload it.');
    try {
      if (input.status === 'resolved' && input.removePost === true) {
        const post = await posts.findOne({ _id: row.postId });
        if (post && !post.deletedAt) await moderate(user, String(row.postId), { action: 'block', enabled: true, reason: notes.slice(0, 500) });
      }
      const now = new Date();
      const updated = await reports.findOneAndUpdate({ _id: row._id, status: row.status, reviewLock: lock }, {
        $set: { status: input.status, active: !['resolved', 'dismissed'].includes(input.status), adminNotes: notes,
          reviewedBy: String(user._id), reviewedAt: now, updatedAt: now },
        $push: { history: { from: row.status, status: input.status, notes, removePost: input.status === 'resolved' && input.removePost === true,
          by: String(user._id), at: now } },
      }, { returnDocument: 'after' });
      if (!updated) fail(409, 'Another administrator updated this report. Reload it.');
      await recordAdminAudit(db, user, 'post_report_reviewed', { type: 'post_report', id: row._id, label: row.reason }, `${row.status} -> ${input.status}: ${notes}`);
    } finally {
      await reports.updateOne({ _id: row._id, reviewLock: lock }, { $unset: { reviewLock: '', lockAt: '' } });
    }
    return detail(user, reportId);
  };
  const reportImages = (row, images = []) => images.map(image => ({ ...image, url: `/api/feed/post-reports/${row._id}/images/${image.id}` }));
  const getReportImage = async (user, reportId, imageId) => {
    admin(user);
    const row = await reports.findOne({ _id: id(reportId) });
    if (!row || ![...(row.snapshot?.images || []), ...(row.snapshot?.original?.images || [])].some(image => image.id === String(imageId))) fail(404, 'Image not found');
    const image = await db.collection('feed_images').findOne({ _id: id(imageId) });
    if (!image) fail(404, 'Image not found');
    return image;
  };
  return { setState, pin, report, detail, listReports, review, getReportImage };
}

// Older notifications link to IDs in feed_reports. Retain the source records
// and IDs while importing them into the current administrator workflow.
export async function migrateLegacyPostReports(db) {
  const reports = db.collection('feed_post_reports');
  for await (const legacy of db.collection('feed_reports').find({})) {
    if (await reports.findOne({ $or: [{ _id: legacy._id }, { legacyReportIds: legacy._id }] }, { projection: { _id: 1 } })) continue;
    if (!ObjectId.isValid(legacy.postId)) continue;
    const postId = new ObjectId(legacy.postId);
    const post = await db.collection('feed_posts').findOne({ _id: postId });
    const status = ({ open: 'pending', pending: 'pending', under_review: 'under_review', resolved: 'resolved', dismissed: 'dismissed' })[legacy.status];
    if (!status) continue;
    const reporterId = String(legacy.reporterAuthId);
    const active = ['pending', 'under_review'].includes(status);
    const duplicate = active ? await reports.findOne({ reporterId, postId, active: true }) : null;
    if (duplicate) {
      await reports.updateOne({ _id: duplicate._id }, { $addToSet: { legacyReportIds: legacy._id } });
      continue;
    }
    const original = post?.originalPostId && ObjectId.isValid(post.originalPostId)
      ? await db.collection('feed_posts').findOne({ _id: new ObjectId(post.originalPostId) }) : null;
    const row = { _id: legacy._id, postId, postOwnerId: String(legacy.authorAuthId || post?.authorAuthId || ''), reporterId,
      reason: legacy.reason || 'Other', description: legacy.details || '', status, active,
      adminNotes: legacy.adminNotes || '', reviewedBy: legacy.reviewedBy || null, reviewedAt: legacy.reviewedAt || null,
      createdAt: legacy.createdAt, updatedAt: legacy.updatedAt || legacy.createdAt, history: legacy.history || [],
      snapshot: legacy.snapshot || { title: post?.title || '', body: post?.body || '', images: post?.images || [], details: post?.details,
        originalPostId: post?.originalPostId || null, original: original ? { title: original.title, body: original.body, images: original.images || [] } : null },
      snapshotSource: legacy.snapshot ? 'legacy_snapshot' : 'current_post_at_migration', migratedFrom: 'feed_reports' };
    await reports.updateOne({ _id: row._id }, { $setOnInsert: row }, { upsert: true });
  }
}

export async function ensurePostActionIndexes(db) {
  await db.collection('feed_post_states').createIndex({ userId: 1, saved: 1, postId: 1 });
  await db.collection('feed_post_states').createIndex({ userId: 1, preference: 1, postId: 1 });
  await db.collection('feed_posts').createIndex({ authorAuthId: 1 }, { unique: true, name: 'one_pinned_post_per_author', partialFilterExpression: { isPinned: true, deletedAt: null } });
  await db.collection('feed_post_reports').createIndex({ reporterId: 1, postId: 1 }, { unique: true, partialFilterExpression: { active: true } });
  await db.collection('feed_post_reports').createIndex({ status: 1, _id: -1 });
  await db.collection('feed_post_reports').createIndex({ reporterId: 1, createdAt: -1 });
  await db.collection('feed_post_reports').createIndex({ 'snapshot.images.id': 1 });
  await db.collection('feed_post_reports').createIndex({ 'snapshot.original.images.id': 1 });
}
