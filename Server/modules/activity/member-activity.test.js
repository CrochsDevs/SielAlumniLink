import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MongoClient, ObjectId } from 'mongodb';
import { createFeedService, ensureFeedIndexes } from '../feed/feed.service.js';
import { createMemberActivityService, recordProfileActivity } from './member-activity.service.js';

test('profile history stores only changed public section labels', async () => {
  const rows = [];
  const db = { collection: () => ({ insertOne: async row => rows.push(row) }) };
  await recordProfileActivity(db, 'member', { bio: 'Old', email: 'private' }, { bio: 'New', email: 'secret' });
  assert.deepEqual(rows[0].sections, ['about section']);
  assert.equal(JSON.stringify(rows).includes('secret'), false);
  assert.equal(JSON.stringify(rows).includes('Old'), false);
  await recordProfileActivity(db, 'member', { bio: 'New' }, { bio: 'New', contactNumber: 'secret' });
  assert.equal(rows.length, 1);
});

test('member activity: visibility, filters, pagination, deletion, disabled accounts, and student comments', { timeout: 30000 }, async () => {
  assert.ok(process.env.MONGO_URI, 'MONGO_URI is required');
  const client = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  const name = `SielAlumni_activity_test_${randomUUID().replaceAll('-', '')}`;
  const db = client.db(name);
  try {
    await client.connect();
    await ensureFeedIndexes(db);
    const alumni = { _id: new ObjectId(), email: 'alumni@example.test', role: 'alumni' };
    const student = { _id: new ObjectId(), email: 'student@example.test', role: 'student' };
    const stranger = { _id: new ObjectId(), email: 'stranger@example.test', role: 'student' };
    await db.collection('auth').insertMany([alumni, student, stranger]);
    const profiles = [alumni, student, stranger].map(user => ({ _id: new ObjectId(), authId: String(user._id), role: user.role }));
    await db.collection('users').insertMany(profiles);
    const feed = createFeedService(db);
    const activity = createMemberActivityService(db, feed);
    const connection = { requesterAuthId: String(alumni._id), recipientAuthId: String(student._id),
      requesterEmail: alumni.email, recipientEmail: student.email, status: 'accepted' };
    await db.collection('connections').insertOne(connection);
    const publicPost = await feed.create(alumni, { body: 'Public update' });
    const privatePost = await feed.create(alumni, { body: 'Private update', audience: 'connections' });
    const story = await feed.create(alumni, { type: 'story', title: 'My career', body: 'A career story' });
    const repost = await feed.share(alumni, privatePost._id, { audience: 'connections' });
    const publicComment = await feed.comment(student, publicPost._id, 'Public reply');
    await feed.comment(student, privatePost._id, 'Private reply');
    await recordProfileActivity(db, alumni._id, {}, { skills: ['Communication'] });
    const admin = { _id: new ObjectId(), role: 'admin' };
    for (const viewer of [stranger, student, admin]) {
      for (const target of [String(profiles[0]._id), String(alumni._id)]) {
        for (const type of ['all', 'posts', 'comments', 'stories', 'profile', 'security']) {
          await assert.rejects(activity(viewer, target, { type }), error => error.status === 404);
          await assert.rejects(activity(viewer, target, { type, before: String(publicPost._id) }), error => error.status === 404);
        }
      }
    }
    assert.equal((await activity(alumni, 'me')).items.length, 5);
    assert.equal((await activity(alumni, String(profiles[0]._id))).items.length, 5);
    assert.equal((await activity(student, 'me', { type: 'comments' })).items.length, 2);
    assert.equal((await activity(alumni, String(alumni._id), { type: 'stories' })).items[0].postId.toString(), story._id.toString());
    assert.deepEqual((await activity(alumni, 'me', { type: 'profile' })).items[0].sections, ['skills']);
    const first = await activity(alumni, 'me', { limit: '2' });
    const second = await activity(alumni, 'me', { limit: '2', before: first.nextCursor });
    const third = await activity(alumni, 'me', { limit: '2', before: second.nextCursor });
    const ids = [...first.items, ...second.items, ...third.items].map(row => String(row._id));
    assert.equal(new Set(ids).size, 5);
    assert.equal(third.nextCursor, null);
    assert.deepEqual(ids, [...ids].sort().reverse());
    await feed.removeComment(student, publicPost._id, publicComment._id);
    assert.equal((await activity(student, 'me')).items.length, 1);
    await db.collection('connections').updateOne({ _id: connection._id }, { $set: { status: 'declined' } });
    assert.equal((await activity(student, 'me')).items.length, 0);
    // Even a legacy public repost cannot expose its private original.
    await db.collection('feed_posts').updateOne({ _id: repost._id }, { $set: { audience: 'public' } });
    await assert.rejects(activity(stranger, String(profiles[0]._id)), error => error.status === 404);
    await db.collection('feed_posts').updateOne({ _id: privatePost._id }, { $set: { 'moderation.blocked': true } });
    assert.equal((await activity(alumni, 'me')).items.length, 3);
    await feed.remove(alumni, publicPost._id);
    assert.equal((await activity(alumni, 'me')).items.length, 2);
    await db.collection('member_activity').insertMany([
      { authorAuthId: String(alumni._id), kind: 'security', action: 'password_changed', createdAt: new Date() },
      { authorAuthId: String(student._id), kind: 'security', action: 'password_reset', createdAt: new Date() },
    ]);
    const security = (await activity(alumni, 'me', { type: 'security' })).items;
    assert.equal(security.length, 1);
    assert.equal(security[0].action, 'password_changed');
    assert.equal((await activity(student, 'me', { type: 'security' })).items[0].action, 'password_reset');
    assert.equal((await activity(alumni, 'me', { type: 'profile' })).items.length, 1);
    assert.equal((await activity(alumni, 'me')).items.length, 3);
    assert.equal((await activity(alumni, 'me', { type: 'security', before: String(security[0]._id) })).items.length, 0);
    for (const query of [{ before: 'bad' }, { type: 'invalid' }, { limit: '-1' }, { limit: '2.5' }, { limit: '31' }]) {
      await assert.rejects(activity(alumni, 'me', query), error => error.status === 400);
    }
    await assert.rejects(activity(alumni, 'bad'), error => error.status === 404);
    await db.collection('auth').updateOne({ _id: alumni._id }, { $set: { disabledAt: new Date() } });
    await assert.rejects(activity(alumni, 'me'), error => error.status === 404);
  } finally {
    if (/^SielAlumni_activity_test_[a-f0-9]{32}$/.test(name)) await db.dropDatabase().catch(() => {});
    await client.close();
  }
});
