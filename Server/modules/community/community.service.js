import { createHash } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { CATEGORIES, DEFAULT_SETTINGS, adminOnly, blockedFeatures, clean, fail, restrictionError, ruleSignals, validateSettings } from './community.policy.js';
import { createModerationProvider } from './community.provider.js';

export const asId = value => {
  if (typeof value !== 'string' && !(value instanceof ObjectId)) fail(400, 'Invalid record identifier');
  if (!ObjectId.isValid(value)) fail(400, 'Invalid record identifier');
  return new ObjectId(value);
};
const hash = text => createHash('sha256').update(text).digest('hex');
const day = 86400000;
export function createCommunityService(db, { provider = createModerationProvider(), notify = async () => {}, changed = () => {}, now = () => new Date() } = {}) {
  const cases = db.collection('community_cases'), restrictions = db.collection('community_restrictions');
  const evidence = db.collection('community_evidence'), appeals = db.collection('community_appeals');
  const audit = async (actor, action, targetId, notes = '') => {
    await db.collection('community_audit').insertOne({ actorId: String(actor._id), action, targetId: String(targetId), notes, at: now() });
  };
  const settings = async () => ({ ...DEFAULT_SETTINGS, ...(await db.collection('community_settings').findOne({ _id: 'policy' }))?.value });
  const saveSettings = async (user, input) => {
    adminOnly(user);
    const current = await settings(), patch = validateSettings(input), value = { ...current, ...patch };
    if (value.reviewThreshold > value.blockThreshold || value.blockThreshold > value.criticalThreshold) fail(400, 'Review threshold must be at most block threshold, which must be at most critical threshold');
    await db.collection('community_settings').updateOne({ _id: 'policy' }, { $set: { value, updatedBy: String(user._id), updatedAt: now() }, $push: { history: { by: String(user._id), at: now(), patch } } }, { upsert: true });
    await audit(user, 'settings_updated', 'policy', JSON.stringify(patch));
    return value;
  };
  const activeRestrictions = async userId => restrictions.aggregate([
    { $match: { userId: String(userId), revokedAt: null, startsAt: { $lte: now() }, expiresAt: { $gt: now() } } },
    { $lookup: { from: 'community_cases', localField: 'caseId', foreignField: '_id', as: 'case' } },
    { $match: { 'case.0.status': 'confirmed' } }, { $set: { source: { $arrayElemAt: ['$case.source', 0] } } }, { $project: { case: 0 } },
  ]).toArray();
  const assertAllowed = async (user, feature) => {
    const error = restrictionError(await activeRestrictions(user._id), feature);
    if (error) throw error;
  };
  const assertRecipients = async ids => {
    for (const userId of [...new Set(ids.map(String))]) {
      if ((await activeRestrictions(userId)).some(row => blockedFeatures(row.level).includes('receiving_messages'))) fail(403, 'A recipient is temporarily unavailable for new messages.');
    }
  };
  const lockUser = async (userId, work) => {
    const locks = db.collection('community_locks'), token = new ObjectId().toString(), time = now();
    let claimed;
    try { claimed = await locks.findOneAndUpdate({ _id: String(userId), $or: [{ token: null }, { expiresAt: { $lte: time } }] },
      { $set: { token, expiresAt: new Date(time.getTime() + 120000) } }, { upsert: true, returnDocument: 'after' }); }
    catch (error) { if (error.code !== 11000) throw error; }
    if (!claimed) fail(409, 'Another moderation action is in progress for this account. Please retry.');
    try { return await work(); } finally { await locks.updateOne({ _id: String(userId), token }, { $set: { token: null } }); }
  };
  const sendNotice = async (userId, title, body, policy, key, link = '/community-status') => {
    if (!policy.notificationsEnabled) return;
    try { await notify({ userId: String(userId), title, body, link, key }); } catch { /* Durable case history remains accessible if notification delivery fails. */ }
  };
  const issueRestriction = async (row, actor, level, days, reason, policy) => {
    if (!Number.isInteger(level) || level < 1 || level > 5 || !Number.isFinite(days) || days <= 0 || days > 365) fail(400, 'Choose level 1–5 and a duration of up to 365 days');
    const startsAt = now(), expiresAt = new Date(startsAt.getTime() + days * day), _id = new ObjectId();
    await restrictions.insertOne({ _id, caseId: row._id, userId: row.userId, level, reason, startsAt, expiresAt, revokedAt: null, issuedBy: String(actor._id), automatic: actor._id === 'system' });
    await sendNotice(row.userId, level === 1 ? 'Community guidelines warning' : level === 5 ? 'Account suspended' : 'Your account has been temporarily restricted',
      `${reason} ${level === 1 ? 'This is a warning; your features remain available.' : `Restricted features: ${blockedFeatures(level).join(', ')}. Expires ${expiresAt.toISOString()}.`} View details or appeal in Account Status.`, policy, String(_id));
    return { _id, level, startsAt, expiresAt };
  };
  const autoEnforce = async (row, policy) => lockUser(row.userId, async () => {
    const stored = await cases.findOne({ _id: row._id });
    if (!stored || stored.status !== 'confirmed' || stored.enforcedAt) return;
    const strikes = await cases.countDocuments({ userId: row.userId, status: 'confirmed' });
    const index = Math.min(4, Math.max(0, strikes - 1));
    const level = row.severity === 'critical' ? Math.max(3, policy.strikeLevels[index]) : policy.strikeLevels[index];
    const restriction = await issueRestriction(row, { _id: 'system' }, Math.min(4, level), Math.min(30, policy.durations[index]), row.explanation, policy);
    await cases.updateOne({ _id: row._id, status: 'confirmed' }, { $set: { strikeNumber: strikes, enforcedAt: now(), automaticRestrictionId: restriction._id },
      $push: { history: { action: 'automatic_restriction', level: restriction.level, by: 'system', at: now() } } });
    await audit({ _id: 'system' }, 'automatic_restriction', row._id, `Level ${restriction.level}`);
  });
  const counter = async (key, expiresAt) => {
    const update = { $inc: { count: 1 }, $setOnInsert: { expiresAt } };
    try { return (await db.collection('community_activity').findOneAndUpdate({ _id: key }, update, { upsert: true, returnDocument: 'after' })).count; }
    catch (error) { if (error.code !== 11000) throw error; return (await db.collection('community_activity').findOneAndUpdate({ _id: key }, update, { returnDocument: 'after' })).count; }
  };
  const recordEvidence = async (caseId, input, text, policy) => {
    const expiresAt = new Date(now().getTime() + policy.evidenceDays * day);
    const imageIndexes = [];
    for (const [index, image] of (input.images || []).entries()) {
      const match = /^data:(image\/(?:jpeg|png|gif|webp));base64,([a-zA-Z0-9+/=]+)$/.exec(image);
      const asset = match ? { bytes: Buffer.from(match[2], 'base64'), contentType: match[1] } : { url: image };
      await db.collection('community_assets').updateOne({ _id: `${caseId}:${index}` }, { $setOnInsert: { ...asset, caseId, expiresAt } }, { upsert: true });
      imageIndexes.push(index);
    }
    await evidence.updateOne({ _id: caseId }, { $setOnInsert: { text, imageIndexes, expiresAt, createdAt: now() } }, { upsert: true });
  };
  const check = async (user, input) => {
    const feature = input.type === 'message' ? 'messaging' : input.type === 'profile' ? 'profile' : input.type === 'connection' ? 'connections' : 'posting';
    await assertAllowed(user, feature);
    const policy = await settings(), text = String(input.text || '');
    if (text.length > 20000) fail(400, 'Content exceeds the moderation limit of 20,000 characters');
    const fingerprint = hash(JSON.stringify([input.type, text.toLowerCase().replace(/\s+/g, ' ').trim(), input.images || [], input.fileName || '', input.fileHash || '']));
    // Dismissed or overturned candidates may be retried unchanged for 30 days.
    if (await cases.findOne({ userId: String(user._id), fingerprint, status: 'dismissed', updatedAt: { $gt: new Date(now().getTime() - 30 * day) } })) { await assertAllowed(user, feature); return { allowed: true }; }
    const bucket = Math.floor(now().getTime() / 600000), expiresAt = new Date((bucket + 2) * 600000);
    // Independent counters and provider analysis can share the same wait.
    // All three must finish before deciding whether content may be delivered.
    const [attempts, frequency, analysis] = await Promise.all([
      text.trim() || input.type === 'connection' ? counter(`same:${user._id}:${input.type}:${fingerprint}:${bucket}`, expiresAt) : 1,
      counter(`rate:${user._id}:${input.type}:${Math.floor(now().getTime() / 60000)}`, expiresAt),
      input.type === 'connection' ? { available: true, signals: [] } : provider.analyze({ text, images: input.images || [], hash: fingerprint }),
    ]);
    const rules = ruleSignals(text, attempts, frequency, policy);
    if (input.fileName && /\.(?:exe|scr|bat|cmd|ps1|msi|vbs|js|jar)$/i.test(input.fileName) && policy.enabledCategories.includes('malware')) rules.push({ category: 'malware', score: 0.9, severity: 'medium', explanation: 'Executable attachment requires administrator review; no malware verdict or automatic strike.' });
    const contextual = /\b(?:for awareness|educational|research|prevention|quoted|quoting|someone (?:said|sent|threatened)|i (?:received|was threatened)|fiction|movie|novel|case study)\b/i.test(text);
    const aiSignals = analysis.signals.map(signal => contextual ? { ...signal, severity: 'medium', explanation: signal.explanation + ' Quotation, reporting, or educational context requires human review; no automatic strike.' } : signal);
    const signals = [...rules.map(signal => ({ ...signal, ...(contextual ? { severity: 'medium', explanation: signal.explanation + ' Educational/reporting context requires human review.' } : {}), detection: 'automated_rule' })), ...aiSignals.map(signal => ({ ...signal, detection: 'ai' }))]
      .filter(signal => policy.enabledCategories.includes(signal.category)).sort((a, b) => b.score - a.score);
    const strongest = signals[0];
    const log = { userId: String(user._id), type: input.type, fingerprint, providerAvailable: analysis.available, providerReason: analysis.reason || null,
      signals, decision: 'allow', createdAt: now(), expiresAt: new Date(now().getTime() + 14 * day) };
    if (!strongest || strongest.score < policy.reviewThreshold) { await db.collection('community_checks').insertOne(log); await assertAllowed(user, feature); return { allowed: true, providerAvailable: analysis.available }; }
    const severe = strongest.score >= policy.blockThreshold && strongest.severity !== 'medium';
    const critical = severe && strongest.severity === 'critical' && strongest.score >= policy.criticalThreshold;
    const decision = policy.automaticBlocking ? severe ? 'reject' : 'hold' : 'hold';
    // Same candidate in the same window creates one case/strike, even concurrently.
    const caseId = new ObjectId(hash(`${user._id}:${fingerprint}:${bucket}`).slice(0, 24));
    const row = { _id: caseId, userId: String(user._id), type: input.type, targetId: input.targetId ? String(input.targetId) : null,
      fingerprint, category: strongest.category, severity: critical ? 'critical' : severe ? 'high' : 'medium', detection: strongest.detection,
      confidence: strongest.score, explanation: strongest.explanation, signals, decision, status: severe && policy.automaticBlocking ? 'confirmed' : 'pending',
      needsReview: true, priority: critical ? 1 : 0, createdAt: now(), updatedAt: now(), history: [{ action: decision, by: 'system', at: now() }] };
    await recordEvidence(caseId, input, input.fileName ? `${text}\n[Attachment: ${String(input.fileName).slice(0, 200)}]` : text, policy);
    await cases.updateOne({ _id: caseId }, { $setOnInsert: row }, { upsert: true });
    await db.collection('community_checks').insertOne({ ...log, decision, caseId });
    if (row.status === 'confirmed' && policy.automaticRestrictions) await autoEnforce(row, policy);
    else await sendNotice(row.userId, 'Content held for community review', 'Your submission was not published or delivered. An administrator will review it. You may appeal or view details in Account Status.', policy, String(caseId));
    // Critical incidents are visible at the top of the admin queue without
    // broadcasting private submission contents over sockets or notifications.
    changed();
    fail(decision === 'hold' ? 423 : 422, decision === 'hold' ? 'Your submission is held for administrator review and has not been published or delivered. View Account Status for details.'
      : 'This submission was blocked under the community guidelines. View Account Status to see the decision or appeal.',
    { code: 'COMMUNITY_MODERATED', caseId, decision, appealUrl: '/community-status' });
  };
  const queueReport = async (reportId, post, report) => {
    const _id = asId(reportId), time = now();
    const queued = await cases.updateOne({ _id }, { $setOnInsert: { _id, userId: String(post.authorAuthId), type: 'post', targetId: String(post._id), reportId: _id,
      category: 'other', severity: 'medium', detection: 'user_report', confidence: null, explanation: report.reason, status: report.status === 'under_review' ? 'under_review' : 'pending',
      decision: 'review', needsReview: true, priority: 0, createdAt: report.createdAt || time, updatedAt: time, history: [] } }, { upsert: true });
    await recordEvidence(_id, {}, [post.title, post.body, post.originalPost?.body].filter(Boolean).join('\n\n'), await settings());
    if (queued.upsertedCount) {
      const policy = await settings();
      const submitted = await db.collection('feed_post_reports').findOne({ _id }, { projection: { reporterId: 1 } });
      if (submitted?.reporterId) await sendNotice(submitted.reporterId, 'Report submitted',
        'Your post report has been submitted for administrator review. You can follow its status in My reports.', policy, `report:${_id}:submitted`, '/community-status#my-reports');
      if (policy.notificationsEnabled) {
        const admins = await db.collection('auth').find({ role: 'admin', disabledAt: null }, { projection: { _id: 1 } }).toArray();
        await Promise.all(admins.map(account => sendNotice(account._id, 'New post report',
          'A member submitted a post report. Review it in the Community Moderation Center.', policy, `report:${_id}:received`, '/admin/community')));
      }
      changed();
    }
  };
  const syncReports = async () => {
    const rows = await db.collection('feed_post_reports').aggregate([{ $match: { active: true } }, { $lookup: { from: 'community_cases', localField: '_id', foreignField: '_id', as: 'existing' } }, { $match: { 'existing.0': { $exists: false } } }, { $sort: { _id: -1 } }, { $limit: 100 }]).toArray();
    for (const report of rows) {
      if (await cases.findOne({ _id: report._id })) continue;
      const post = await db.collection('feed_posts').findOne({ _id: report.postId });
      if (post) await queueReport(report._id, post, report);
    }
  };
  const userDto = row => ({ _id: row._id, category: row.category, severity: row.severity, type: row.type, status: row.status,
    explanation: row.explanation, decision: row.decision, createdAt: row.createdAt, updatedAt: row.updatedAt,
    history: (row.history || []).map(({ action, at, level, notes }) => ({ action, at, level, notes })) });
  const person = async userId => {
    const keys = ObjectId.isValid(userId) ? [userId, new ObjectId(userId)] : [userId];
    const account = await db.collection('auth').findOne({ _id: { $in: keys } }, { projection: { name: 1, email: 1, role: 1 } });
    const profile = await db.collection('users').findOne({ authId: { $in: keys } }, { projection: { name: 1 } });
    return { authId: userId, name: profile?.name || account?.name || 'Member', email: account?.email || '', role: account?.role || '' };
  };
  const ownStatus = async user => {
    const userId = String(user._id);
    const [active, reports, ownCases, ownAppeals, policy] = await Promise.all([
      activeRestrictions(user._id),
      db.collection('feed_post_reports').find({ reporterId: userId },
        { projection: { _id: 1, reason: 1, status: 1, adminNotes: 1, createdAt: 1, updatedAt: 1, reviewedAt: 1 } }).sort({ createdAt: -1, _id: -1 }).limit(100).toArray(),
      cases.find({ userId }).sort({ createdAt: -1, _id: -1 }).limit(100).toArray(),
      appeals.find({ userId }).sort({ createdAt: -1, _id: -1 }).limit(100).toArray(),
      settings(),
    ]);
    return { restrictions: active, reports, cases: ownCases.map(userDto), appeals: ownAppeals, appealsEnabled: policy.appealsEnabled };
  };
  const originalContent = async row => {
    if (!row.targetId || !ObjectId.isValid(row.targetId)) return null;
    const collection = { post: 'feed_posts', comment: 'feed_comments', message: 'messages', profile: 'users' }[row.type];
    if (!collection) return null;
    const source = await db.collection(collection).findOne({ _id: asId(row.targetId) });
    if (!source) return null;
    const ownerId = source.authorAuthId || source.senderAuthId || source.authId;
    if (String(ownerId) !== row.userId) return null;
    return { title: source.title || source.name || '', text: source.body || source.text || source.bio || '', createdAt: source.createdAt,
      unavailable: !!source.deletedAt || !!source.unsent || !!source.moderation?.blocked,
      images: (source.images || []).map(image => ({ id: image.id, alt: image.alt || '', url: `/api/feed/${source._id}/images/${image.id}` })),
      attachmentName: source.attachment?.name || null };
  };
  const detail = async (user, caseId) => {
    const row = await cases.findOne({ _id: asId(caseId) });
    if (!row || (String(user.role).toLowerCase() !== 'admin' && row.userId !== String(user._id))) fail(404, 'Moderation case not found');
    const content = await evidence.findOne({ _id: row._id, expiresAt: { $gt: now() } });
    if (String(user.role).toLowerCase() !== 'admin') return { ...userDto(row), evidence: content ? { text: content.text, expiresAt: content.expiresAt } : null };
    await audit(user, 'case_viewed', row._id, row.type === 'message' ? 'Accessed private message evidence for this case only.' : 'Accessed moderation evidence.');
    return { ...row, user: await person(row.userId), originalContent: await originalContent(row), evidence: content ? { text: content.text, imageIndexes: content.imageIndexes, expiresAt: content.expiresAt } : null,
      restrictions: await restrictions.find({ caseId: row._id }).toArray(), appeals: await appeals.find({ caseId: row._id }).toArray(),
      report: row.reportId ? await db.collection('feed_post_reports').findOne({ _id: row.reportId }, { projection: { reporterId: 1, reason: 1, description: 1, createdAt: 1, snapshot: 1 } }) : null };
  };
  const removeContent = async row => {
    if (!row.targetId) return;
    const _id = asId(row.targetId);
    if (row.type === 'post') await db.collection('feed_posts').updateOne({ _id, authorAuthId: row.userId }, { $set: { 'moderation.blocked': true, 'moderation.reason': row.explanation, 'moderation.communityCaseId': row._id } });
    if (row.type === 'comment') await db.collection('feed_comments').updateOne({ _id, authorAuthId: row.userId }, { $set: { deletedAt: now(), communityCaseId: row._id } });
    if (row.type === 'message') await db.collection('messages').updateOne({ _id, senderAuthId: row.userId }, { $set: { text: '', attachment: null, mentions: [], unsent: true, communityCaseId: row._id } });
    if (row.type === 'profile') await db.collection('users').updateOne({ authId: row.userId }, { $set: { bio: '', communityCaseId: row._id } });
    changed();
  };
  const review = async (user, caseId, input) => {
    adminOnly(user);
    const row = await cases.findOne({ _id: asId(caseId) });
    if (!row) fail(404, 'Moderation case not found');
    const notes = clean(input.notes || '', 2000, true);
    const policy = await settings();
    if (input.category !== undefined && !CATEGORIES.includes(input.category)) fail(400, 'Invalid violation category');
    if (input.severity !== undefined && !['low', 'medium', 'high', 'critical'].includes(input.severity)) fail(400, 'Invalid severity');
    const result = await lockUser(row.userId, async () => {
      const current = await cases.findOne({ _id: row._id });
      const allowed = current.status === 'pending' ? ['under_review', 'dismissed'] : current.status === 'under_review' ? ['confirmed', 'dismissed'] : current.status === 'confirmed' ? current.needsReview ? ['confirmed', 'dismissed'] : ['dismissed'] : [];
      if (!allowed.includes(input.status)) fail(409, 'Invalid or stale case transition. Reload the case.');
      const level = input.level === undefined ? 1 : input.level, duration = input.durationDays === undefined ? 1 : input.durationDays;
      if (input.status === 'confirmed' && (!Number.isInteger(level) || level < 1 || level > 5 || !Number.isFinite(duration) || duration <= 0 || duration > 365)) fail(400, 'Invalid restriction level or duration');
      if (input.removeContent !== undefined && typeof input.removeContent !== 'boolean') fail(400, 'Invalid content removal option');
      if (input.status === 'confirmed' && input.removeContent) await removeContent({ ...row, explanation: notes });
      const updated = await cases.findOneAndUpdate({ _id: row._id, status: current.status }, { $set: { status: input.status, needsReview: input.status === 'under_review', priority: 0, category: input.category || current.category, severity: input.severity || current.severity, reviewedBy: String(user._id), reviewedAt: now(), updatedAt: now(),
        ...(input.status === 'confirmed' && current.status !== 'confirmed' ? { strikeNumber: await cases.countDocuments({ userId: row.userId, status: 'confirmed' }) + 1 } : {}) },
        $push: { history: { action: input.status, notes, by: String(user._id), at: now(), removeContent: input.removeContent === true } } }, { returnDocument: 'after' });
      if (!updated) fail(409, 'Case changed. Reload it.');
      if (input.status === 'confirmed' && current.status !== 'confirmed') await issueRestriction(row, user, level, duration, notes, policy);
      if (input.status === 'dismissed') await restrictions.updateMany({ caseId: row._id, revokedAt: null }, { $set: { revokedAt: now(), revokedBy: String(user._id), revokeReason: notes } });
      if (row.reportId) await db.collection('feed_post_reports').updateOne({ _id: row.reportId }, {
        $set: { status: input.status === 'confirmed' ? 'resolved' : input.status, active: input.status === 'under_review', adminNotes: notes, reviewedBy: String(user._id), reviewedAt: now(), updatedAt: now() },
        $push: { history: { status: input.status === 'confirmed' ? 'resolved' : input.status, notes, by: String(user._id), at: now() } } });
      await audit(user, `case_${input.status}`, row._id, notes);
      if (row.reportId) {
        const report = await db.collection('feed_post_reports').findOne({ _id: row.reportId }, { projection: { reporterId: 1 } });
        if (report?.reporterId) await sendNotice(report.reporterId, 'Your report has an update',
          `Status: ${input.status === 'confirmed' ? 'resolved' : input.status.replaceAll('_', ' ')}. ${notes}`,
          policy, `report:${row.reportId}:${input.status}:${updated.history.length}`, '/community-status#my-reports');
      }
      await sendNotice(row.userId, 'Community moderation decision updated', `${notes} Status: ${input.status}. ${input.status === 'dismissed' ? 'Associated restrictions and strikes are removed. Held content can be resubmitted.' : 'View Account Status for details and appeals.'}`, policy, `${row._id}:${input.status}`);
      return updated;
    });
    changed();
    return result;
  };
  const appeal = async (user, caseId, input) => {
    if (!(await settings()).appealsEnabled) fail(403, 'Appeals are currently unavailable. Contact an administrator for review.');
    const row = await cases.findOne({ _id: asId(caseId), userId: String(user._id) });
    if (!row || row.status === 'dismissed') fail(404, 'Appealable case not found');
    const explanation = clean(input.explanation, 5000, true);
    // One appeal per case avoids duplicate submissions, including concurrent retries.
    try { await appeals.insertOne({ _id: row._id, caseId: row._id, userId: String(user._id), explanation, status: 'pending', createdAt: now(), updatedAt: now(), history: [] }); }
    catch (error) { if (error.code === 11000) fail(409, 'An appeal already exists for this case'); throw error; }
    changed();
    return { status: 'pending' };
  };
  const reviewAppeal = async (user, appealId, input) => {
    adminOnly(user);
    const row = await appeals.findOne({ _id: asId(appealId) });
    if (!row) fail(404, 'Appeal not found');
    const notes = clean(input.notes || '', 2000, true), policy = await settings();
    return lockUser(row.userId, async () => {
      const current = await appeals.findOne({ _id: row._id });
      const allowed = current.status === 'pending' ? ['under_review'] : current.status === 'under_review' ? ['approved', 'rejected'] : [];
      if (!allowed.includes(input.status)) fail(409, 'Invalid or stale appeal transition');
      if (input.status === 'approved') {
        const originalCase = await cases.findOne({ _id: row.caseId });
        if (originalCase?.reportId) await db.collection('feed_post_reports').updateOne({ _id: originalCase.reportId }, { $set: { status: 'dismissed', active: false, adminNotes: notes, reviewedBy: String(user._id), reviewedAt: now(), updatedAt: now() }, $push: { history: { status: 'dismissed', action: 'appeal_approved', notes, by: String(user._id), at: now() } } });
        await restrictions.updateMany({ caseId: row.caseId, revokedAt: null }, { $set: { revokedAt: now(), revokedBy: String(user._id), revokeReason: notes } });
        await cases.updateOne({ _id: row.caseId }, { $set: { status: 'dismissed', needsReview: false, priority: 0, updatedAt: now(), reviewedBy: String(user._id), reviewedAt: now() },
          $push: { history: { action: 'appeal_approved', notes, by: String(user._id), at: now() } } });
      }
      const updated = await appeals.findOneAndUpdate({ _id: row._id, status: current.status }, { $set: { status: input.status, updatedAt: now(), reviewedBy: String(user._id), notes },
        $push: { history: { status: input.status, notes, by: String(user._id), at: now() } } }, { returnDocument: 'after' });
      if (!updated) fail(409, 'Appeal changed. Reload it.');
      await audit(user, `appeal_${input.status}`, row._id, notes);
      await sendNotice(row.userId, 'Community appeal updated', `Your appeal is ${input.status}. ${notes}`, policy, `${row._id}:${input.status}`);
      changed(); return updated;
    });
  };
  const legacyFeedRestriction = async (user, targetId, input) => {
    adminOnly(user); const userId = String(asId(targetId));
    const reason = clean(input.reason || '', 500, input.enabled === true);
    return lockUser(userId, async () => {
      const policy = await settings();
      const legacyCases = await cases.find({ userId, source: 'feed_controls', status: 'confirmed' }).toArray();
      if (!input.enabled) {
        await restrictions.updateMany({ userId, caseId: { $in: legacyCases.map(row => row._id) }, level: 2, revokedAt: null }, { $set: { revokedAt: now(), revokedBy: String(user._id), revokeReason: reason || 'Feed participation restored by administrator' } });
      } else {
        const active = await activeRestrictions(userId);
        let row = legacyCases.find(candidate => active.some(restriction => String(restriction.caseId) === String(candidate._id) && restriction.level === 2));
        if (!row) {
          row = { _id: new ObjectId(), userId, source: 'feed_controls', type: 'account', targetId: null, category: 'other', severity: 'medium', detection: 'admin', confidence: null,
            explanation: reason, status: 'confirmed', needsReview: false, priority: 0, decision: 'restrict', createdAt: now(), updatedAt: now(),
            strikeNumber: await cases.countDocuments({ userId, status: 'confirmed' }) + 1, history: [] };
          await cases.insertOne(row);
        }
        const added = await issueRestriction(row, user, 2, policy.durations[3], reason, policy);
        await restrictions.updateMany({ userId, caseId: row._id, level: 2, revokedAt: null, _id: { $ne: added._id } }, { $set: { revokedAt: now(), revokedBy: String(user._id), revokeReason: 'Replaced by updated feed restriction' } });
        await cases.updateOne({ _id: row._id }, { $set: { explanation: reason, updatedAt: now(), reviewedBy: String(user._id), reviewedAt: now() }, $push: { history: { action: 'feed_restriction', by: String(user._id), at: now(), notes: reason, level: 2 } } });
      }
      // Explicit administrator changes convert this author's old indefinite
      // feed-only flag to the central finite restriction policy.
      await db.collection('feed_restrictions').updateOne({ _id: userId }, { $set: { blocked: false, updatedBy: String(user._id), updatedAt: now() } });
      await audit(user, input.enabled ? 'feed_restriction_applied' : 'feed_restriction_restored', userId, reason);
      changed(); return { authId: userId, restricted: input.enabled };
    });
  };
  const legacyFeedRestrictions = async user => {
    adminOnly(user);
    const rows = await restrictions.aggregate([{ $match: { level: 2, revokedAt: null, startsAt: { $lte: now() }, expiresAt: { $gt: now() } } },
      { $lookup: { from: 'community_cases', localField: 'caseId', foreignField: '_id', as: 'case' } },
      { $match: { 'case.0.source': 'feed_controls', 'case.0.status': 'confirmed' } }, { $limit: 100 }, { $project: { case: 0 } }]).toArray();
    return rows;
  };
  const changeRestriction = async (user, caseId, input) => {
    adminOnly(user);
    const row = await cases.findOne({ _id: asId(caseId), status: 'confirmed' });
    if (!row) fail(404, 'Confirmed case not found');
    const notes = clean(input.notes || '', 2000, true);
    if (!Number.isInteger(input.level) || input.level < 1 || input.level > 5 || !Number.isFinite(input.durationDays) || input.durationDays <= 0 || input.durationDays > 365) fail(400, 'Invalid restriction level or duration');
    return lockUser(row.userId, async () => {
      if (!(await cases.findOne({ _id: row._id, status: 'confirmed' }))) fail(409, 'Case changed. Reload it.');
      const added = await issueRestriction(row, user, input.level, input.durationDays, notes, await settings());
      await restrictions.updateMany({ caseId: row._id, revokedAt: null, _id: { $ne: added._id } }, { $set: { revokedAt: now(), revokedBy: String(user._id), revokeReason: 'Replaced by a new administrator decision' } });
      await cases.updateOne({ _id: row._id }, { $push: { history: { action: 'restriction_changed', level: input.level, notes, by: String(user._id), at: now() } } });
      await audit(user, 'restriction_changed', row._id, notes); changed(); return added;
    });
  };
  const restore = async (user, restrictionId, input) => {
    adminOnly(user);
    const notes = clean(input.notes || '', 2000, true);
    const row = await restrictions.findOne({ _id: asId(restrictionId) });
    if (!row) fail(404, 'Restriction not found');
    return lockUser(row.userId, async () => {
      await restrictions.updateOne({ _id: row._id, revokedAt: null }, { $set: { revokedAt: now(), revokedBy: String(user._id), revokeReason: notes } });
      await audit(user, 'restriction_revoked', row._id, notes);
      await sendNotice(row.userId, 'Account restriction lifted', notes, await settings(), `${row._id}:revoked`);
      changed(); return { restored: true };
    });
  };
  const list = async (user, query = {}) => {
    adminOnly(user); await syncReports();
    const filter = {};
    if (query.status) { if (!['pending', 'under_review', 'confirmed', 'dismissed'].includes(query.status)) fail(400, 'Invalid status'); filter.status = query.status; }
    if (query.userId) filter.userId = String(asId(query.userId));
    if (query.before) {
      const pivot = await cases.findOne({ _id: asId(query.before) });
      if (!pivot) fail(400, 'Invalid case cursor');
      const priority = pivot.priority || 0;
      filter.$or = [{ priority: { $lt: priority } }, { priority, createdAt: { $lt: pivot.createdAt } }, { priority, createdAt: pivot.createdAt, _id: { $lt: pivot._id } }];
    }
    const rows = await cases.find(filter).sort({ priority: -1, createdAt: -1, _id: -1 }).limit(31).toArray();
    await audit(user, 'queue_viewed', 'queue');
    return { cases: await Promise.all(rows.slice(0, 30).map(async row => ({ ...row, user: await person(row.userId), preview: (await evidence.findOne({ _id: row._id, expiresAt: { $gt: now() } }))?.text?.slice(0, 300) || '' }))), nextCursor: rows.length > 30 ? String(rows[29]._id) : null };
  };
  const stats = async user => {
    adminOnly(user); await syncReports();
    const active = { revokedAt: null, startsAt: { $lte: now() }, expiresAt: { $gt: now() } };
    const [reports, detected, pending, activeUsers, pendingAppeals, resolved] = await Promise.all([
      db.collection('feed_post_reports').countDocuments({}), cases.countDocuments({ detection: { $ne: 'user_report' } }), cases.countDocuments({ $or: [{ status: { $in: ['pending', 'under_review'] } }, { needsReview: true }] }),
      restrictions.aggregate([{ $match: { ...active, level: { $gte: 2 } } }, { $lookup: { from: 'community_cases', localField: 'caseId', foreignField: '_id', as: 'case' } }, { $match: { 'case.0.status': 'confirmed' } }, { $group: { _id: '$userId', level: { $max: '$level' } } }]).toArray(), appeals.countDocuments({ status: { $in: ['pending', 'under_review'] } }),
      cases.countDocuments({ status: { $in: ['confirmed', 'dismissed'] }, needsReview: { $ne: true } }),
    ]);
    return { reports, detected, pending, activeRestrictions: activeUsers.length, suspended: activeUsers.filter(row => row.level === 5).length, pendingAppeals, resolved, provider: provider.status() };
  };
  const userHistory = async (user, userId) => {
    adminOnly(user); const id = String(asId(userId));
    await audit(user, 'user_history_viewed', id);
    return { user: await person(id), confirmedViolations: await cases.countDocuments({ userId: id, status: 'confirmed' }),
      cases: await cases.find({ userId: id }).sort({ createdAt: -1, _id: -1 }).limit(100).toArray(), restrictions: await restrictions.find({ userId: id }).sort({ _id: -1 }).limit(100).toArray(),
      activeRestrictions: await activeRestrictions(id), appeals: await appeals.find({ userId: id }).sort({ createdAt: -1, _id: -1 }).limit(100).toArray() };
  };
  const listAppeals = async (user, query = {}) => {
    adminOnly(user); const filter = {};
    if (query.before) {
      const pivot = await appeals.findOne({ _id: asId(query.before) });
      if (!pivot) fail(400, 'Invalid appeal cursor');
      filter.$or = [{ createdAt: { $lt: pivot.createdAt } }, { createdAt: pivot.createdAt, _id: { $lt: pivot._id } }];
    }
    const rows = await appeals.find(filter).sort({ createdAt: -1, _id: -1 }).limit(31).toArray();
    return { appeals: await Promise.all(rows.slice(0, 30).map(async row => ({ ...row, user: await person(row.userId) }))), nextCursor: rows.length > 30 ? String(rows[29]._id) : null };
  };
  const auditList = async (user, query = {}) => {
    adminOnly(user); const filter = query.before ? { _id: { $lt: asId(query.before) } } : {};
    const rows = await db.collection('community_audit').find(filter).sort({ _id: -1 }).limit(51).toArray();
    return { events: rows.slice(0, 50), nextCursor: rows.length > 50 ? String(rows[49]._id) : null };
  };
  const image = async (user, caseId, index) => {
    adminOnly(user);
    if (!/^\d{1,2}$/.test(String(index))) fail(404, 'Evidence image not found');
    const row = await db.collection('community_assets').findOne({ _id: `${asId(caseId)}:${index}`, expiresAt: { $gt: now() } });
    if (!row) fail(404, 'Evidence image expired or unavailable');
    await audit(user, 'evidence_image_viewed', caseId);
    return row;
  };
  return { settings, saveSettings, check, queueReport, assertAllowed, assertRecipients, activeRestrictions, ownStatus, detail, review, appeal, reviewAppeal, restore, changeRestriction, legacyFeedRestriction, legacyFeedRestrictions,
    list, stats, userHistory, listAppeals, auditList, image, providerStatus: provider.status };
}

export async function ensureCommunityIndexes(db) {
  for (const name of ['community_checks', 'community_activity', 'community_evidence', 'community_assets']) await db.collection(name).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection('community_cases').createIndex({ userId: 1, status: 1, _id: -1 });
  await db.collection('community_cases').createIndex({ userId: 1, fingerprint: 1, status: 1, updatedAt: -1 });
  await db.collection('community_cases').createIndex({ status: 1, severity: 1, _id: -1 });
  await db.collection('community_cases').createIndex({ priority: -1, createdAt: -1, _id: -1 });
  await db.collection('community_restrictions').createIndex({ userId: 1, revokedAt: 1, expiresAt: 1 });
  await db.collection('community_restrictions').createIndex({ caseId: 1 });
  await db.collection('community_restrictions').createIndex({ revokedAt: 1, expiresAt: 1, level: 1 });
  await db.collection('community_appeals').createIndex({ userId: 1, _id: -1 });
  await db.collection('community_appeals').createIndex({ status: 1, _id: -1 });
  await db.collection('community_appeals').createIndex({ createdAt: -1, _id: -1 });
  await db.collection('community_audit').createIndex({ targetId: 1, at: -1 });
}
