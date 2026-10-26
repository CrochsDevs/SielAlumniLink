import test from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { ensureNotificationRetention, notificationExpiresAt } from './notifications.retention.js';

process.env.MONGO_URI ||= 'mongodb://127.0.0.1:27017';
const { createNotificationModel } = await import('./notifications.models.js');

const matches = (doc, filter) => Object.entries(filter).every(([field, value]) => {
  if (value && typeof value === 'object' && !(value instanceof ObjectId)) {
    if ('$gt' in value) return doc[field] instanceof Date && doc[field] > value.$gt;
    if ('$ne' in value) return String(doc[field]) !== String(value.$ne);
  }
  return String(doc[field]) === String(value);
});
const fixture = (rows = [], users = []) => {
  const collection = {
    async insertOne(doc) { doc._id = new ObjectId(); rows.push(doc); return { insertedId: doc._id }; },
    async insertMany(docs) { rows.push(...docs); return { insertedCount: docs.length }; },
    find(filter) {
      let found = rows.filter(doc => matches(doc, filter));
      return {
        sort() { found.sort((a, b) => b.createdAt - a.createdAt); return this; },
        limit(count) { found = found.slice(0, count); return this; },
        async toArray() { return found; },
      };
    },
    async countDocuments(filter) { return rows.filter(doc => matches(doc, filter)).length; },
    async updateOne(filter, update) { const doc = rows.find(doc => matches(doc, filter)); if (doc) Object.assign(doc, update.$set); },
    async updateMany(filter, update) { rows.filter(doc => matches(doc, filter)).forEach(doc => Object.assign(doc, update.$set)); },
  };
  return { rows, model: createNotificationModel({ collection: name => name === 'notifications' ? collection : {
    find: filter => ({ toArray: async () => users.filter(user => matches(user, filter)) }),
  } }) };
};

test('expiry is three calendar months, preserves the time and does not mutate creation time', () => {
  const createdAt = new Date('2026-07-21T03:14:15.123Z');
  assert.equal(notificationExpiresAt(createdAt).toISOString(), '2026-10-21T03:14:15.123Z');
  assert.equal(createdAt.toISOString(), '2026-07-21T03:14:15.123Z');
  assert.throws(() => notificationExpiresAt('invalid'), TypeError);
});

test('calendar expiry clamps month ends, handles leap years, and uses Manila calendar dates', () => {
  for (const [createdAt, expiresAt] of [
    ['2026-01-31T02:00:00Z', '2026-04-30T02:00:00.000Z'],
    ['2025-11-30T02:00:00Z', '2026-02-28T02:00:00.000Z'],
    ['2023-11-30T02:00:00Z', '2024-02-29T02:00:00.000Z'],
    ['2026-01-31T18:00:00Z', '2026-04-30T18:00:00.000Z'],
    ['2026-12-21T03:00:00Z', '2027-03-21T03:00:00.000Z'],
  ]) assert.equal(notificationExpiresAt(new Date(createdAt)).toISOString(), expiresAt);
});

test('personal and broadcast notifications both receive expiry without changing audience targeting', async t => {
  const now = new Date('2026-07-21T00:00:00Z');
  t.mock.timers.enable({ apis: ['Date'], now });
  const alumni = { _id: new ObjectId(), role: 'alumni', email: 'alumni@example.test' };
  const student = { _id: new ObjectId(), role: 'student', email: 'student@example.test' };
  const f = fixture([], [alumni, student]);
  const notice = await f.model.notify({ recipientAuthId: alumni._id, title: 'Connection request', kind: 'connection_request' });
  assert.equal(notice.expiresAt.toISOString(), '2026-10-21T00:00:00.000Z');
  assert.equal(await f.model.broadcast({ audience: 'all', title: 'Announcement' }), 2);
  assert.equal(await f.model.broadcast({ audience: 'alumni', title: 'Job' }), 1);
  assert.equal(await f.model.broadcast({ audience: 'all', excludeAuthId: alumni._id, title: 'Event' }), 1);
  assert.ok(f.rows.every(doc => doc.createdAt.getTime() === now.getTime() && doc.expiresAt.toISOString() === '2026-10-21T00:00:00.000Z'));
});

test('lists and unread badges exclude expired documents before TTL deletion, while keeping ownership and limits', async t => {
  const now = new Date('2026-10-21T00:00:00Z');
  t.mock.timers.enable({ apis: ['Date'], now });
  const notice = (overrides = {}) => ({ _id: new ObjectId(), recipientAuthId: 'mine', title: 'Notice',
    createdAt: new Date('2026-10-01T00:00:00Z'), expiresAt: new Date('2027-01-01T00:00:00Z'), read: false, ...overrides });
  const f = fixture([
    notice({ expiresAt: new Date(now.getTime() - 1) }), notice({ expiresAt: now }),
    notice(), notice({ read: true }), notice({ recipientAuthId: 'someone-else' }),
  ]);
  assert.equal((await f.model.findMine('mine')).length, 2);
  assert.equal((await f.model.findMine('mine', 1)).length, 1);
  assert.equal(await f.model.unreadCount('mine'), 1);
  assert.equal(await f.model.unreadCount('someone-else'), 1);
  assert.equal(f.rows.length, 5, 'API filtering works while MongoDB TTL is still pending');
});

test('marking read never extends expiry and cannot modify another recipient', async () => {
  const id = new ObjectId();
  const expiresAt = new Date('2027-01-01T00:00:00Z');
  const f = fixture([{ _id: id, recipientAuthId: 'mine', read: false, expiresAt },
    { _id: new ObjectId(), recipientAuthId: 'other', read: false, expiresAt }]);
  await f.model.markRead('other', String(id));
  assert.equal(f.rows[0].read, false);
  await f.model.markRead('mine', String(id));
  assert.equal(f.rows[0].read, true);
  await f.model.markAllRead('mine');
  assert.equal(f.rows[1].read, false);
  assert.ok(f.rows.every(doc => doc.expiresAt === expiresAt));
});

test('startup backfills expiry, hard-deletes the backlog, and installs a persistent MongoDB TTL index', async () => {
  const calls = [];
  const collection = Object.fromEntries(['updateMany', 'deleteMany', 'createIndex'].map(method => [
    method, async (...args) => calls.push({ method, args }),
  ]));
  const db = { collection(name) { assert.equal(name, 'notifications'); return collection; } };
  const now = new Date('2026-10-21T00:00:00Z');
  await ensureNotificationRetention(db, now);
  assert.deepEqual(calls[0], { method: 'updateMany', args: [
    { createdAt: { $type: 'date' }, expiresAt: { $exists: false } },
    [{ $set: { expiresAt: { $dateAdd: { startDate: '$createdAt', unit: 'month', amount: 3, timezone: 'Asia/Manila' } } } }],
  ] });
  assert.deepEqual(calls[1], { method: 'deleteMany', args: [{ expiresAt: { $lte: now } }] });
  assert.deepEqual(calls[2], { method: 'createIndex', args: [
    { expiresAt: 1 }, { name: 'notifications_expiry_ttl', expireAfterSeconds: 0 },
  ] });
});
