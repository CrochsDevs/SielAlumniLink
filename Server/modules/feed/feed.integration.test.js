import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MongoClient, ObjectId } from 'mongodb';
import { createFeedService, ensureFeedIndexes } from './feed.service.js';
import { createFeedImageDelete, createFeedImageDownload, createFeedImageUpload } from './feed.images.js';
import cloudUpload, { cloudinary } from '../../config/cloudinary.js';
import { readFile } from 'node:fs/promises';

test('real MongoDB: atomic likes, protected reposts, pagination, comments, and send recipients', { timeout: 30000 }, async () => {
  assert.ok(process.env.MONGO_URI, 'MONGO_URI is required for the integration test');
  const client = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  // All documents and indexes belong to an isolated, randomly named test DB.
  const scratchDbName = `feed_${randomUUID().replaceAll('-', '')}`;
  const db = client.db(scratchDbName);
  try {
    await client.connect();
    await ensureFeedIndexes(db);
    const author = { _id: new ObjectId(), email: 'author@example.test', role: 'alumni', name: 'Author' };
    const friend = { _id: new ObjectId(), email: 'friend@example.test', role: 'alumni', name: 'Friend' };
    const stranger = { _id: new ObjectId(), email: 'stranger@example.test', role: 'student', name: 'Student' };
    await db.collection('auth').insertMany([author, friend, stranger]);
    await db.collection('users').insertMany([author, friend, stranger].map(p => ({ ...p, _id: new ObjectId(), authId: String(p._id) })));
    const connection = { requesterAuthId: author._id, recipientAuthId: friend._id,
      requesterEmail: author.email, recipientEmail: friend.email, status: 'accepted' };
    await db.collection('connections').insertOne(connection);
    let invalidations = 0;
    const feed = createFeedService(db, () => invalidations++);
    const publicPost = await feed.create(author, { body: 'Public milestone' });
    const privatePost = await feed.create(author, { body: 'Network update', audience: 'connections' });
    assert.equal((await feed.list(stranger, { q: 'network' })).posts.length, 0);
    assert.equal((await feed.list(stranger, { q: 'milestone' })).posts.length, 1);
    await Promise.all(Array.from({ length: 25 }, () => feed.setMembership(friend, publicPost._id, 'likedBy', true)));
    assert.equal((await feed.get(friend, publicPost._id)).likesCount, 1);
    await feed.setMembership(stranger, publicPost._id, 'likedBy', true);
    assert.equal((await feed.get(author, publicPost._id)).likesCount, 2);
    await feed.setMembership(friend, publicPost._id, 'likedBy', false);
    assert.equal((await feed.get(friend, publicPost._id)).likesCount, 1);
    assert.equal((await feed.get(friend, publicPost._id)).likedByMe, false);
    const repost = await feed.share(friend, privatePost._id, { audience: 'connections', body: 'Great news!' });
    assert.equal((await feed.list(friend, { q: 'Network update' })).posts.length, 2);
    assert.equal((await feed.get(author, repost._id)).originalPost.body, privatePost.body);
    assert.equal((await feed.list(stranger)).posts.length, 1);
    await assert.rejects(feed.get(stranger, repost._id), error => error.status === 404);
    await assert.rejects(feed.share(friend, privatePost._id, { audience: 'public' }), error => error.status === 403);
    const comment = await feed.comment(friend, privatePost._id, 'Congratulations!');
    assert.equal((await feed.get(author, privatePost._id)).commentsCount, 1);
    assert.equal((await feed.listComments(author, privatePost._id)).comments[0].body, comment.body);
    await feed.removeComment(friend, privatePost._id, comment._id);
    assert.equal((await feed.get(author, privatePost._id)).commentsCount, 0);
    assert.deepEqual((await feed.recipients(author, publicPost._id)).map(p => p.authId), [String(friend._id)]);
    const first = await feed.list(author, { limit: 2 });
    assert.equal(first.posts.length, 2); assert.ok(first.nextCursor);
    const next = await feed.list(author, { limit: 2, before: first.nextCursor });
    assert.equal(next.posts.length, 1); assert.equal(next.nextCursor, null);
    await db.collection('connections').updateOne({ _id: connection._id }, { $set: { status: 'declined' } });
    await assert.rejects(feed.get(friend, privatePost._id), error => error.status === 404);
    assert.equal((await feed.list(friend)).posts.length, 1);
    await feed.remove(author, privatePost._id);
    assert.equal((await feed.list(author)).posts.length, 1);
    assert.ok(invalidations >= 32);
    const admin = { _id: new ObjectId(), email: 'moderator@example.test', role: 'admin', name: 'Moderator' };
    await db.collection('auth').insertOne(admin);
    const moderated = await feed.create(author, { body: 'Moderation test', audience: 'connections' });
    const moderatedRepost = await feed.share(author, moderated._id, { audience: 'connections' });
    assert.equal((await feed.get(admin, moderated._id)).body, 'Moderation test');
    await Promise.all([
      feed.moderate(admin, moderated._id, { action: 'block', enabled: true, reason: 'Spam' }),
      feed.moderate(admin, moderated._id, { action: 'comments', enabled: true, reason: 'Review discussion' }),
    ]);
    const review = await feed.get(admin, moderated._id);
    assert.equal(review.moderation.blocked, true);
    assert.equal(review.commentsDisabled, true);
    await assert.rejects(feed.get(author, moderatedRepost._id), error => error.status === 404);
    assert.equal((await feed.list(admin, { moderation: 'blocked' })).posts.length, 1);
    await feed.moderate(admin, moderated._id, { action: 'block', enabled: false });
    assert.equal((await feed.get(author, moderated._id)).audience, 'connections');
    await assert.rejects(feed.comment(author, moderated._id, 'Disabled'), error => error.status === 403);
    await feed.moderate(admin, moderated._id, { action: 'comments', enabled: false });
    const moderatedComment = await feed.comment(author, moderated._id, 'Allowed again');
    await feed.removeComment(admin, moderated._id, moderatedComment._id);
    assert.equal((await feed.listComments(author, moderated._id)).comments.length, 0);
    await feed.restrictAuthor(admin, author._id, { enabled: true, reason: 'Repeated spam' });
    assert.equal((await feed.status(author)).restricted, true);
    await assert.rejects(feed.create(author, { body: 'Forbidden' }), error => error.status === 403);
    assert.equal((await feed.listRestrictions(admin)).length, 1);
    await feed.restrictAuthor(admin, author._id, { enabled: false });
    assert.equal((await feed.status(author)).restricted, false);
    await feed.remove(admin, moderated._id);
    await assert.rejects(feed.get(admin, moderatedRepost._id), error => error.status === 404);
  } finally {
    // Only the exact isolated database created above is ever removed.
    if (/^feed_[a-f0-9]{32}$/.test(scratchDbName)) {
      await db.dropDatabase().catch(() => {});
    }
    await client.close();
  }
});

test('post actions: private collections, ownership, concurrent deduplication, reports, moderation, and trash', { timeout: 60000 }, async () => {
  assert.ok(process.env.MONGO_URI, 'MONGO_URI is required');
  const connection = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  const name = `feed_${randomUUID().replaceAll('-', '')}`;
  const db = connection.db(name);
  const owner = { _id: new ObjectId(), name: 'Owner', email: 'owner@example.test', role: 'alumni' };
  const viewer = { _id: new ObjectId(), name: 'Viewer', email: 'viewer@example.test', role: 'alumni' };
  const admin = { _id: new ObjectId(), name: 'Admin', email: 'admin@example.test', role: 'admin' };
  const denied = status => error => error.status === status;
  try {
    await connection.connect();
    await ensureFeedIndexes(db);
    await db.collection('auth').insertMany([owner, viewer, admin]);
    const feed = createFeedService(db);
    const image = { _id: new ObjectId(), ownerAuthId: String(owner._id), width: 10, height: 10 };
    await db.collection('feed_images').insertOne(image);
    const post = await feed.create(owner, { body: 'Post to save and review', images: [{ id: String(image._id) }] });
    const other = await feed.create(owner, { body: 'Another post' });
    await Promise.all(Array.from({ length: 15 }, () => feed.setState(viewer, post._id, { saved: true, preference: 'interested' })));
    assert.equal(await db.collection('feed_post_states').countDocuments({ userId: String(viewer._id) }), 1);
    assert.equal((await feed.get(viewer, post._id)).viewerState.preference, 'interested');
    assert.equal((await feed.list(viewer, { collection: 'saved' })).posts.length, 1);
    assert.equal((await feed.list(owner, { collection: 'saved' })).posts.length, 0);
    await feed.setState(viewer, post._id, { preference: 'not_interested' });
    assert.equal((await feed.list(viewer)).posts.length, 1);
    await feed.setState(admin, post._id, { preference: 'not_interested' });
    assert.equal((await feed.list(admin, { moderation: 'published' })).posts.length, 1);
    await feed.setState(admin, post._id, { preference: null });
    assert.equal((await feed.list(owner)).posts.length, 2);
    assert.equal((await feed.list(viewer, { collection: 'hidden' })).posts.length, 1);
    await feed.setState(viewer, post._id, { preference: null, saved: false });
    assert.equal((await feed.list(viewer)).posts.length, 2);
    assert.equal((await feed.list(viewer, { collection: 'saved' })).posts.length, 0);
    await assert.rejects(feed.setState(owner, post._id, { preference: 'interested' }), denied(400));
    await assert.rejects(feed.pin(viewer, post._id, { pinned: true }), denied(403));
    await assert.rejects(feed.updatePost(viewer, post._id, { body: 'Unauthorized' }), denied(403));
    await assert.rejects(feed.remove(viewer, post._id), denied(403));
    await feed.pin(owner, post._id, { pinned: true });
    await assert.rejects(feed.pin(owner, other._id, { pinned: true }), denied(409));
    const profilePage = await feed.list(viewer, { author: String(owner._id), limit: 1 });
    assert.equal(String(profilePage.posts[0]._id), String(post._id));
    assert.equal((await feed.list(viewer, { author: String(owner._id), before: profilePage.nextCursor })).posts.length, 1);
    await feed.pin(owner, post._id, { pinned: false });
    const edited = await feed.updatePost(owner, post._id, { body: 'Updated post' });
    assert.equal(edited.body, 'Updated post');
    await feed.setState(owner, post._id, { saved: true });
    assert.equal((await feed.list(owner, { collection: 'saved' })).posts.length, 1);
    await feed.setState(owner, post._id, { saved: false });
    const reason = 'Spam or misleading content';
    await assert.rejects(feed.report(owner, post._id, { reason }), denied(400));
    await assert.rejects(feed.report(viewer, 'invalid', { reason }), denied(404));
    await assert.rejects(feed.report(viewer, post._id, { reason: 'invalid' }), denied(400));
    const submitted = await Promise.allSettled(Array.from({ length: 8 }, () => feed.report(viewer, post._id, { reason, description: '<b>Review this</b>' })));
    assert.equal(submitted.filter(result => result.status === 'fulfilled').length, 1);
    const report = submitted.find(result => result.status === 'fulfilled').value;
    assert.equal((await feed.get(viewer, post._id)).body, 'Updated post');
    await assert.rejects(feed.listReports(viewer), denied(403));
    await assert.rejects(feed.detail(owner, report._id), denied(403));
    await assert.rejects(feed.review(viewer, report._id, { status: 'dismissed' }), denied(403));
    assert.equal((await feed.listReports(admin)).counts.pending, 1);
    assert.equal((await feed.detail(admin, report._id)).description, 'Review this');
    assert.equal((await feed.detail(admin, report._id)).reporter.name, viewer.name);
    await assert.rejects(feed.getReportImage(viewer, report._id, String(image._id)), denied(403));
    await assert.rejects(feed.detail(admin, 'invalid'), denied(404));
    await assert.rejects(feed.review(admin, report._id, { status: 'resolved' }), denied(409));
    await feed.review(admin, report._id, { status: 'under_review', adminNotes: 'Investigating' });
    await feed.review(admin, report._id, { status: 'resolved', adminNotes: 'Confirmed spam', removePost: true });
    await assert.rejects(feed.get(viewer, post._id), denied(404));
    assert.equal((await feed.detail(admin, report._id)).history.length, 2);
    assert.equal(await db.collection('activity_logs').countDocuments({ action: 'post_report_reviewed' }), 2);
    await feed.moderate(admin, post._id, { action: 'block', enabled: false });
    const repeated = await feed.report(viewer, post._id, { reason });
    await feed.review(admin, repeated._id, { status: 'dismissed' });
    assert.equal((await feed.listReports(admin)).counts.dismissed, 1);
    await feed.remove(owner, post._id);
    assert.ok((await db.collection('feed_posts').findOne({ _id: new ObjectId(post._id) })).deletedAt);
    assert.equal((await feed.list(viewer)).posts.length, 1);
    assert.equal((await feed.detail(admin, report._id)).snapshot.body, 'Updated post');
    assert.equal(String((await feed.getReportImage(admin, report._id, String(image._id)))._id), String(image._id));
    const removal = { status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
    await createFeedImageDelete(db, async () => assert.fail('Retained report image must not be destroyed'))({ user: owner, params: { id: String(image._id) } }, removal);
    assert.equal(removal.code, 409);
  } finally {
    if (/^feed_[a-f0-9]{32}$/.test(name)) await db.dropDatabase().catch(() => {});
    await connection.close();
  }
});

test('real image provider: upload, persist, protected download, and repost photos', {
  timeout: 60000,
  skip: !['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'].every(key => process.env[key]),
}, async () => {
  const client = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  const scratchDbName = `feed_${randomUUID().replaceAll('-', '')}`;
  const db = client.db(scratchDbName);
  const response = () => ({ statusCode: 200,
    status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; },
    set(headers) { this.headers = headers; }, send(body) { this.body = body; },
  });
  try {
    await client.connect();
    const author = { _id: new ObjectId(), email: 'photo-author@example.test', role: 'alumni', name: 'Photo Test' };
    await db.collection('auth').insertOne(author);
    const buffer = await readFile(new URL('../../../Client/src/assets/logo/clsu_logo.png', import.meta.url));
    const uploaded = response();
    await createFeedImageUpload(db, cloudUpload)({ user: author, file: { buffer } }, uploaded);
    assert.equal(uploaded.statusCode, 201, uploaded.body?.message);
    assert.equal(uploaded.body.data.url, undefined);
    const feed = createFeedService(db);
    const post = await feed.create(author, { audience: 'connections', images: [{ id: uploaded.body.data.id, alt: 'University logo upload test' }] });
    assert.equal((await feed.get(author, post._id)).images[0].alt, 'University logo upload test');
    const forbiddenDelete = response();
    let deletedPublishedAsset = false;
    await createFeedImageDelete(db, async () => { deletedPublishedAsset = true; })(
      { user: author, params: { id: uploaded.body.data.id } }, forbiddenDelete);
    assert.equal(forbiddenDelete.statusCode, 409); assert.equal(deletedPublishedAsset, false);
    const loaded = response();
    await createFeedImageDownload(feed)({ user: author, params: { id: post._id, imageId: uploaded.body.data.id } }, loaded);
    assert.equal(loaded.statusCode, 200, loaded.body?.message);
    assert.ok(Buffer.isBuffer(loaded.body)); assert.ok(loaded.body.length > 100);
    assert.equal(loaded.headers['Content-Type'], 'image/png');
    const share = await feed.share(author, post._id, { audience: 'connections' });
    assert.equal(share.originalPost.images[0].url, post.images[0].url);
  } finally {
    const assets = await db.collection('feed_images').find({}).toArray();
    for (const asset of assets) {
      assert.ok(asset.publicId.startsWith('alumnilink/feed/'));
      await cloudinary.uploader.destroy(asset.publicId);
    }
    if (/^feed_[a-f0-9]{32}$/.test(scratchDbName)) await db.dropDatabase();
    await client.close();
  }
});
