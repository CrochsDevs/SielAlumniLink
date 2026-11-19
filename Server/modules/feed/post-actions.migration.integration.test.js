import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MongoClient, ObjectId } from 'mongodb';
import { createFeedService, ensureFeedIndexes } from './feed.service.js';
import { migrateLegacyPostReports } from './post-actions.js';

test('legacy report links retain evidence, permissions and review behavior after an idempotent import', async () => {
  const client = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  const db = client.db(`fmig_${randomUUID().replaceAll('-', '')}`);
  try {
    await client.connect();
    await ensureFeedIndexes(db);
    const owner = { _id: new ObjectId(), role: 'alumni', name: 'Owner' };
    const reporter = { _id: new ObjectId(), role: 'alumni', name: 'Reporter' };
    const admin = { _id: new ObjectId(), role: 'admin', name: 'Admin' };
    await db.collection('auth').insertMany([owner, reporter, admin]);
    const feed = createFeedService(db);
    const post = await feed.create(owner, { body: 'Original community post' });
    const legacy = { _id: new ObjectId(), postId: String(post._id), reporterAuthId: String(reporter._id), authorAuthId: String(owner._id),
      reason: 'Other', details: 'Original report explanation', status: 'open', createdAt: new Date() };
    await db.collection('feed_reports').insertOne(legacy);
    await migrateLegacyPostReports(db);
    await migrateLegacyPostReports(db);
    assert.equal(await db.collection('feed_post_reports').countDocuments(), 1);
    assert.equal(await db.collection('feed_reports').countDocuments(), 1);
    const details = await feed.detail(admin, String(legacy._id));
    assert.equal(String(details._id), String(legacy._id));
    assert.equal(details.description, legacy.details);
    assert.equal(details.status, 'pending');
    assert.equal(details.snapshot.body, 'Original community post');
    assert.equal(details.snapshotSource, 'current_post_at_migration');
    assert.equal((await feed.listReports(admin)).reports.length, 1);
    await assert.rejects(feed.detail(reporter, String(legacy._id)), error => error.status === 403);
    await feed.review(admin, String(legacy._id), { status: 'under_review', adminNotes: 'Review imported report' });
    assert.equal((await feed.detail(admin, String(legacy._id))).status, 'under_review');
    const duplicate = { ...legacy, _id: new ObjectId() };
    await db.collection('feed_reports').insertOne(duplicate);
    await migrateLegacyPostReports(db);
    assert.equal(await db.collection('feed_post_reports').countDocuments(), 1);
    assert.equal(String((await feed.detail(admin, String(duplicate._id)))._id), String(legacy._id));
    await feed.review(admin, String(duplicate._id), { status: 'dismissed', adminNotes: 'Reviewed original and duplicate reports' });
    assert.equal((await feed.detail(admin, String(legacy._id))).status, 'dismissed');
  } finally {
    try { await db.dropDatabase(); } finally { await client.close(); }
  }
});
