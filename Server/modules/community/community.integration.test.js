import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { MongoClient, ObjectId } from 'mongodb';
import { randomUUID } from 'node:crypto';
import { createCommunityService, ensureCommunityIndexes } from './community.service.js';
import { createFeedService } from '../feed/feed.service.js';
import { ensureFeedIndexes } from '../feed/feed.service.js';

test('real database: moderation decisions, strikes, API gates, expiry, appeals, privacy, and audit', { timeout: 180000 }, async t => {
  assert.ok(process.env.MONGO_URI || process.env.TEST_MONGO_URI, 'A test MongoDB connection is required');
  const connection = new MongoClient(process.env.TEST_MONGO_URI || process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  const name = `cm_${randomUUID().replaceAll('-', '')}`;
  const db = connection.db(name);
  let time = new Date('2026-11-18T02:00:00Z');
  const owner = { _id: new ObjectId(), role: 'alumni', email: 'owner@example.test', name: 'Owner' };
  const member = { _id: new ObjectId(), role: 'alumni', email: 'member@example.test', name: 'Member' };
  const admin = { _id: new ObjectId(), role: 'admin', email: 'admin@example.test', name: 'Admin' };
  const notices = [];
  let signals = [], available = true;
  const provider = { status: () => ({ configured: false, provider: 'integration-fixture' }), analyze: async () => ({ available, reason: available ? null : 'provider_unavailable', signals }) };
  const service = createCommunityService(db, { provider, now: () => new Date(time), notify: async notice => notices.push(notice) });
  const rejected = status => error => error.status === status;
  try {
    await connection.connect(); await ensureCommunityIndexes(db); await ensureFeedIndexes(db);
    await db.collection('auth').insertMany([owner, member, admin]);
    const feed = createFeedService(db, () => {}, null, service);
    await t.test('normal publication, edits, and replies are analyzed before persistence', async () => {
      const post = await feed.create(owner, { body: 'Welcome to our alumni announcement.' });
      assert.ok(post._id); assert.equal(await db.collection('community_checks').countDocuments({ decision: 'allow' }), 1);
      await feed.updatePost(owner, post._id, { body: 'Updated alumni announcement.' });
      await feed.comment(member, post._id, 'Thanks for the invitation!');
      signals = [{ category: 'harassment', score: 0.86, severity: 'high', explanation: 'Uncertain contextual detection' }];
      await assert.rejects(feed.updatePost(owner, post._id, { body: 'A candidate held for review' }), rejected(423));
      assert.equal((await feed.get(owner, post._id)).body, 'Updated alumni announcement.');
      await assert.rejects(feed.comment(member, post._id, 'Potentially harmful reply'), rejected(423));
      assert.equal((await feed.listComments(owner, post._id)).comments.length, 1);
      assert.equal(await db.collection('community_cases').countDocuments({ status: 'confirmed' }), 0);
      signals = [{ category: 'violence', score: 0.9999, severity: 'critical', explanation: 'Quoted threat fixture' }];
      await assert.rejects(service.check(member, { type: 'message', text: 'For awareness: someone sent this quoted threat.' }), rejected(423));
      assert.equal(await db.collection('community_cases').countDocuments({ status: 'confirmed' }), 0);
      signals = [];
    });
    await t.test('repeated advertisements and suspicious links hold content without uncertain strikes', async () => {
      const text = 'Visit https://example.test/alumni-offer';
      await service.check(owner, { type: 'post', text }); await service.check(owner, { type: 'post', text });
      await assert.rejects(service.check(owner, { type: 'post', text }), rejected(423));
      await assert.rejects(service.check(owner, { type: 'post', text: 'Verify your password https://login@192.0.2.1/verify' }), rejected(423));
      assert.equal(await db.collection('community_restrictions').countDocuments({}), 0);
    });
    await t.test('outage permits legitimate content and records degraded analysis', async () => {
      available = false;
      assert.equal((await service.check(owner, { type: 'post', text: 'An ordinary alumni celebration' })).allowed, true);
      assert.equal((await db.collection('community_checks').findOne({ providerReason: 'provider_unavailable' })).providerAvailable, false);
      available = true;
    });
    let violation;
    await t.test('high-confidence threats block before persistence and impose a capped protective restriction', async () => {
      signals = [{ category: 'violence', score: 0.9999, severity: 'critical', explanation: 'Provider fixture: explicit targeted threat' }];
      const before = await db.collection('feed_posts').countDocuments({});
      await assert.rejects(feed.create(owner, { body: 'Threat fixture candidate' }), rejected(422));
      assert.equal(await db.collection('feed_posts').countDocuments({}), before);
      violation = await db.collection('community_cases').findOne({ userId: String(owner._id), status: 'confirmed' });
      assert.ok(violation); const restriction = (await service.activeRestrictions(owner._id))[0];
      assert.equal(restriction.level, 3); assert.ok(new Date(restriction.expiresAt) - new Date(restriction.startsAt) <= 30 * 86400000);
      await assert.rejects(service.assertAllowed(owner, 'posting'), rejected(403));
      await assert.rejects(service.assertAllowed(owner, 'messaging'), rejected(403));
      await assert.rejects(service.assertAllowed(owner, 'connections'), rejected(403));
      await service.assertAllowed(owner, 'social');
      assert.equal(String((await service.list(admin)).cases[0]._id), String(violation._id));
      const beforeReview = await db.collection('community_restrictions').countDocuments({ caseId: violation._id });
      await service.review(admin, String(violation._id), { status: 'confirmed', notes: 'Human review confirms the existing decision' });
      assert.equal(await db.collection('community_restrictions').countDocuments({ caseId: violation._id }), beforeReview);
      assert.equal((await db.collection('community_cases').findOne({ _id: violation._id })).needsReview, false);
      signals = [];
    });
    await t.test('direct HTTP and socket gates reject restricted actions; account/appeal access remains', async () => {
      const { enforceCommunityRequest, enforceCommunityPacket } = await import('./community.runtime.js');
      for (const url of ['/api/feed', '/api/conversations/111111111111111111111111/messages', '/api/connections']) {
        await assert.rejects(enforceCommunityRequest({ user: owner, method: 'POST', originalUrl: url, body: {} }, service), rejected(403));
      }
      await enforceCommunityRequest({ user: owner, method: 'GET', originalUrl: '/api/community/me' }, service);
      const emitted = [], acknowledgments = []; let proceeded = false;
      const socket = { user: owner, emit: (...event) => emitted.push(event) };
      await enforceCommunityPacket(socket, ['call:signal', { toAuthId: String(member._id) }, data => acknowledgments.push(data)], () => { proceeded = true; }, service);
      assert.equal(proceeded, false); assert.equal(acknowledgments[0].code, 'COMMUNITY_RESTRICTED'); assert.equal(emitted[0][0], 'community:restricted');
    });
    await t.test('appeal is owner-only, deduplicated, reviewed, and restores only its case restrictions', async () => {
      await assert.rejects(service.appeal(member, String(violation._id), { explanation: 'Not mine' }), rejected(404));
      await service.appeal(owner, String(violation._id), { explanation: 'This is incorrectly classified.' });
      await assert.rejects(service.appeal(owner, String(violation._id), { explanation: 'Duplicate' }), rejected(409));
      await assert.rejects(service.reviewAppeal(member, String(violation._id), { status: 'approved', notes: 'Not authorized' }), rejected(403));
      await service.reviewAppeal(admin, String(violation._id), { status: 'under_review', notes: 'Reviewing context' });
      await service.reviewAppeal(admin, String(violation._id), { status: 'approved', notes: 'Context supports overturning this decision' });
      await service.assertAllowed(owner, 'messaging');
      assert.equal(await db.collection('community_cases').countDocuments({ userId: String(owner._id), status: 'confirmed' }), 0);
      assert.equal((await service.detail(owner, String(violation._id))).status, 'dismissed');
    });
    await t.test('manual confirmation, suspension, incoming restrictions, expiry and dismissed strikes', async () => {
      const pending = await db.collection('community_cases').findOne({ userId: String(member._id), status: 'pending' });
      await service.review(admin, String(pending._id), { status: 'under_review', notes: 'Inspect context' });
      await service.review(admin, String(pending._id), { status: 'confirmed', notes: 'Confirmed after review', level: 2, durationDays: 1 });
      await service.assertAllowed(member, 'messaging'); await assert.rejects(service.assertAllowed(member, 'posting'), rejected(403));
      await service.changeRestriction(admin, String(pending._id), { notes: 'Suspension authorized by administrator', level: 5, durationDays: 3 });
      await assert.rejects(service.assertAllowed(member, 'social'), rejected(403));
      await assert.rejects(service.assertRecipients([member._id]), rejected(403));
      const priorExpiry = (await service.activeRestrictions(member._id))[0].expiresAt;
      await service.appeal(member, String(pending._id), { explanation: 'Please review.' });
      await service.reviewAppeal(admin, String(pending._id), { status: 'under_review', notes: 'Review' });
      await service.reviewAppeal(admin, String(pending._id), { status: 'rejected', notes: 'Evidence supports the original decision' });
      assert.deepEqual((await service.activeRestrictions(member._id))[0].expiresAt, priorExpiry);
      time = new Date(time.getTime() + 4 * 86400000);
      await service.assertAllowed(member, 'social'); await service.assertRecipients([member._id]);
      await service.review(admin, String(pending._id), { status: 'dismissed', notes: 'Overturned after additional evidence' });
      assert.equal((await service.userHistory(admin, String(member._id))).confirmedViolations, 0);
    });
    await t.test('legacy feed controls use finite central restrictions and preserve their restore workflow', async () => {
      const memberPost = await feed.create(member, { body: 'Feed restriction indicator fixture' });
      await db.collection('feed_restrictions').insertOne({ _id: String(member._id), blocked: true, reason: 'Old manual flag' });
      await feed.restrictAuthor(admin, String(member._id), { enabled: true, reason: 'Confirmed spam from feed controls' });
      assert.equal((await feed.status(member)).restricted, true);
      assert.equal((await feed.get(admin, memberPost._id)).moderation.authorRestricted, true);
      assert.equal((await db.collection('feed_restrictions').findOne({ _id: String(member._id) })).blocked, false);
      assert.ok((await feed.listRestrictions(admin)).find(row => row.author.authId === String(member._id)).expiresAt);
      await feed.restrictAuthor(admin, String(member._id), { enabled: true, reason: 'Updated feed restriction' });
      assert.equal(await db.collection('community_cases').countDocuments({ userId: String(member._id), source: 'feed_controls' }), 1);
      await feed.restrictAuthor(admin, String(member._id), { enabled: false });
      assert.equal((await feed.status(member)).restricted, false);
      assert.equal((await feed.get(admin, memberPost._id)).moderation.authorRestricted, false);
    });
    await t.test('reports do not prove violations, private evidence is authorized, and admin actions are audited', async () => {
      const post = await feed.create(owner, { body: 'Report review target' });
      const report = await feed.report(member, post._id, { reason: 'Other', description: 'Please review the context' });
      assert.equal((await db.collection('community_cases').findOne({ _id: report._id })).status, 'pending');
      assert.equal((await service.activeRestrictions(owner._id)).length, 0);
      await assert.rejects(service.list(member), rejected(403)); await assert.rejects(service.stats(member), rejected(403));
      await assert.rejects(service.detail(member, String(report._id)), rejected(404));
      const own = await service.detail(owner, String(report._id)); assert.equal(own.report, undefined); assert.equal(own.reporterId, undefined);
      await feed.review(admin, report._id, { status: 'under_review' });
      await feed.review(admin, report._id, { status: 'dismissed', adminNotes: 'No violation found' });
      assert.equal((await service.detail(admin, String(report._id))).status, 'dismissed');
      assert.equal((await service.stats(admin)).reports, 1);
      assert.ok((await service.auditList(admin)).events.length > 5); assert.ok(notices.length > 0);
      await assert.rejects(service.saveSettings(member, { automaticRestrictions: false }), rejected(403));
      await service.saveSettings(admin, { reviewThreshold: 0.8, blockThreshold: 0.99, maliciousHosts: ['malicious.example'] });
      await assert.rejects(service.check(owner, { type: 'post', text: 'https://malicious.example/steal' }), rejected(422));
    });
  } finally {
    if (/^cm_[a-f0-9]{32}$/.test(name)) await db.dropDatabase().catch(() => {});
    await connection.close();
  }
});
