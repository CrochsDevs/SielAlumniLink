import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MongoClient, ObjectId } from 'mongodb';
import { createFeedService, ensureFeedIndexes } from '../feed/feed.service.js';
import { createMemberActivityService, recordProfileActivity } from './member-activity.service.js';
import { listUserAccessAudit } from './admin-audit.js';

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
    const numbered = await activity(alumni, 'me', { page: '1', limit: '2' });
    assert.equal(numbered.total, 5);
    assert.equal(numbered.totalPages, 3);
    assert.equal(numbered.page, 1);
    const numberedSecond = await activity(alumni, 'me', { page: '2', limit: '2' });
    const numberedLast = await activity(alumni, 'me', { page: '3', limit: '2' });
    assert.deepEqual([...numbered.items, ...numberedSecond.items, ...numberedLast.items].map(row => String(row._id)), ids);
    assert.equal(numberedLast.items.length, 1);
    const studentComments = await activity(student, 'me', { type: 'comments', page: 1, limit: 1 });
    assert.equal(studentComments.total, 2);
    assert.equal(studentComments.items.length, 1);
    await feed.removeComment(student, publicPost._id, publicComment._id);
    assert.equal((await activity(student, 'me')).items.length, 1);
    await db.collection('connections').updateOne({ _id: connection._id }, { $set: { status: 'declined' } });
    assert.equal((await activity(student, 'me')).items.length, 0);
    assert.equal((await activity(student, 'me', { page: 1 })).total, 0);
    assert.equal((await activity(student, 'me', { page: 1 })).totalPages, 1);
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
    const adminOne = { _id: new ObjectId(), role: 'admin', email: 'admin-one@example.test' };
    const adminTwo = { _id: new ObjectId(), role: 'admin', email: 'admin-two@example.test' };
    await db.collection('auth').insertMany([adminOne, adminTwo]);
    await db.collection('activity_logs').insertMany([
      ...['login', 'role_changed', 'logout'].map(action => ({ authId: String(adminOne._id), action, createdAt: new Date(), target: { label: 'Member account' } })),
      { authId: String(adminTwo._id), action: 'post_blocked', createdAt: new Date(), target: { label: 'Other admin target' } },
    ]);
    await db.collection('member_activity').insertMany([
      { authorAuthId: String(adminOne._id), kind: 'security', action: 'password_changed', createdAt: new Date() },
      { authorAuthId: String(adminTwo._id), kind: 'security', action: 'password_reset', createdAt: new Date() },
    ]);
    await feed.create(adminOne, { body: 'Own admin post' });
    const ownAdmin = await activity(adminOne, 'me');
    assert.equal(ownAdmin.items.length, 5); // Works even without a directory profile.
    assert.equal((await activity(adminOne, 'me', { page: 1, limit: 2 })).total, 5);
    assert.equal((await activity(adminOne, 'me', { type: 'admin', page: 1 })).total, 1);
    assert.equal((await activity(adminOne, 'me', { type: 'admin' })).items[0].action, 'role_changed');
    assert.equal((await activity(adminOne, 'me', { type: 'admin' })).items.length, 1);
    assert.equal((await activity(adminOne, 'me', { type: 'access' })).items.length, 2);
    assert.equal((await activity(adminOne, 'me', { type: 'security' })).items.length, 1);
    assert.equal((await activity(adminOne, 'me', { type: 'posts' })).items.length, 1);
    const adminPage = await activity(adminOne, 'me', { limit: 2 });
    const adminNext = await activity(adminOne, 'me', { limit: 2, before: adminPage.nextCursor });
    assert.equal(new Set([...adminPage.items, ...adminNext.items].map(row => String(row._id))).size, 4);
    assert.equal(JSON.stringify(ownAdmin.items).includes('Other admin target'), false);
    assert.equal((await activity(adminTwo, 'me', { type: 'admin' })).items[0].action, 'post_blocked');
    await assert.rejects(activity(adminOne, String(profiles[0]._id)), error => error.status === 404);
    await assert.rejects(activity(student, 'me', { type: 'admin' }), error => error.status === 400);
    await assert.rejects(activity(alumni, 'me', { type: 'access' }), error => error.status === 400);
    const accessRows = [
      { _id: new ObjectId(), authId: String(alumni._id), email: alumni.email, action: 'login' },
      { _id: new ObjectId(), authId: String(student._id), email: student.email, action: 'logout' },
      { _id: new ObjectId(), email: stranger.email, action: 'login' }, // Legacy email-only record.
      { _id: new ObjectId(), authId: String(new ObjectId()), role: 'alumni', action: 'logout' }, // Snapshot survives removal.
    ];
    await db.collection('activity_logs').insertMany([...accessRows,
      { authId: String(adminOne._id), role: 'student', action: 'login' }, // Current admin excluded.
      { authId: String(new ObjectId()), role: 'ADMIN', action: 'login' },
      { email: adminTwo.email, action: 'logout' }, // Legacy admin excluded by email.
      { authId: String(alumni._id), role: 'alumni', action: 'user_updated' },
    ].map((row, index) => ({ ...row, createdAt: new Date(Date.now() + index * 1000) })));
    const userAudit = await listUserAccessAudit(db, 200);
    assert.equal(userAudit.length, 4);
    assert.deepEqual(new Set(userAudit.map(row => String(row._id))), new Set(accessRows.map(row => String(row._id))));
    assert.equal((await listUserAccessAudit(db, 1)).length, 1); // Limit applies after excluding admins.
    assert.equal(String((await listUserAccessAudit(db, 1))[0]._id), String(userAudit[0]._id));
    assert.equal(userAudit.some(row => Object.hasOwn(row, 'account') || Object.hasOwn(row, 'roles')), false);
    for (const query of [{ before: 'bad' }, { type: 'invalid' }, { limit: '-1' }, { limit: '2.5' }, { limit: '31' },
      { page: 0 }, { page: -1 }, { page: 1.5 }, { page: 'invalid' }, { page: 1, before: String(publicPost._id) }]) {
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
