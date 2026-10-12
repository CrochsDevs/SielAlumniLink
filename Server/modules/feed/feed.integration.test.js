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
  const scratchDbName = `SielAlumni_feed_test_${randomUUID().replaceAll('-', '')}`;
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
    await Promise.all(Array.from({ length: 25 }, () => feed.setMembership(friend, publicPost._id, 'likedBy', true)));
    assert.equal((await feed.get(friend, publicPost._id)).likesCount, 1);
    await feed.setMembership(stranger, publicPost._id, 'likedBy', true);
    assert.equal((await feed.get(author, publicPost._id)).likesCount, 2);
    await feed.setMembership(friend, publicPost._id, 'likedBy', false);
    assert.equal((await feed.get(friend, publicPost._id)).likesCount, 1);
    assert.equal((await feed.get(friend, publicPost._id)).likedByMe, false);
    const repost = await feed.share(friend, privatePost._id, { audience: 'connections', body: 'Great news!' });
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
  } finally {
    // Only the exact isolated database created above is ever removed.
    if (/^SielAlumni_feed_test_[a-f0-9]{32}$/.test(scratchDbName)) {
      await db.dropDatabase().catch(() => {});
    }
    await client.close();
  }
});

test('real image provider: upload, persist, protected download, and repost photos', {
  timeout: 60000,
  skip: !['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'].every(key => process.env[key]),
}, async () => {
  const client = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  const scratchDbName = `SielAlumni_feed_test_${randomUUID().replaceAll('-', '')}`;
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
    if (/^SielAlumni_feed_test_[a-f0-9]{32}$/.test(scratchDbName)) await db.dropDatabase();
    await client.close();
  }
});
