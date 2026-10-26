import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { createNotificationModel } from './notifications.models.js';
import { ensureNotificationRetention, notificationExpiresAt } from './notifications.retention.js';

test('real MongoDB: migrates existing notices, permanently deletes expired read/unread records, and installs TTL', { timeout: 30000 }, async () => {
  assert.ok(process.env.MONGO_URI, 'MONGO_URI is required for this integration test');
  const client = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000,
    serverApi: { version: '1', strict: true, deprecationErrors: true } });
  const db = client.db(`SielAlumni_notifications_test_${randomUUID().replaceAll('-', '')}`);
  let connected = false;
  try {
    await client.connect();
    connected = true;
    const collection = db.collection('notifications');
    const now = new Date();
    const current = { title: 'Current legacy notice', recipientAuthId: 'member', read: false, createdAt: now };
    await collection.insertMany([
      { title: 'Expired unread', recipientAuthId: 'member', read: false, createdAt: new Date('2020-01-01') },
      { title: 'Expired read', recipientAuthId: 'other', read: true, createdAt: new Date('2020-01-31T18:00:00Z') },
      { title: 'Expiry boundary', recipientAuthId: 'admin', read: false, createdAt: new Date('2020-01-01'), expiresAt: now },
      current,
    ]);
    await ensureNotificationRetention(db, now);
    assert.equal(await collection.countDocuments({}), 1, 'old notifications must be physically absent from the collection');
    const remaining = await collection.findOne({ _id: current._id });
    assert.equal(remaining.expiresAt.getTime(), notificationExpiresAt(now).getTime());
    const indexes = await collection.listIndexes().toArray();
    const ttl = indexes.find(index => index.name === 'notifications_expiry_ttl');
    assert.deepEqual(ttl.key, { expiresAt: 1 });
    assert.equal(ttl.expireAfterSeconds, 0);
    await ensureNotificationRetention(db, now);
    assert.equal(await collection.countDocuments({}), 1, 'startup can safely run again');

    // Backfill uses the same Manila month-end rule as all new notifications.
    // Future fixtures avoid both startup deletion and the TTL background pass.
    const monthEnd = new Date('2099-11-30T18:00:00Z');
    await collection.insertOne({ title: 'Month end', recipientAuthId: 'member', createdAt: monthEnd });
    await ensureNotificationRetention(db, now);
    assert.equal((await collection.findOne({ title: 'Month end' })).expiresAt.getTime(), notificationExpiresAt(monthEnd).getTime());

    const model = createNotificationModel(db);
    const personal = await model.notify({ recipientAuthId: 'member', title: 'New personal notice' });
    await db.collection('auth').insertMany([{ email: 'one@example.test', role: 'alumni' }, { email: 'two@example.test', role: 'student' }]);
    assert.equal(await model.broadcast({ title: 'New broadcast', audience: 'all' }), 2);
    assert.equal((await collection.findOne({ _id: personal._id })).expiresAt.getTime(), notificationExpiresAt(personal.createdAt).getTime());
    assert.equal(await collection.countDocuments({ expiresAt: { $exists: false } }), 0);
    const expiryBeforeRead = personal.expiresAt.getTime();
    await model.markRead('member', String(personal._id));
    assert.equal((await collection.findOne({ _id: personal._id })).expiresAt.getTime(), expiryBeforeRead);
    await collection.insertOne({ title: 'Waiting for TTL', recipientAuthId: 'member', read: false,
      createdAt: new Date('2020-01-01'), expiresAt: new Date('2020-04-01') });
    assert.ok((await model.findMine('member')).every(doc => doc.title !== 'Waiting for TTL'));
    assert.equal(await model.unreadCount('member'), 1);
  } finally {
    if (connected) await db.dropDatabase();
    await client.close();
  }
});
