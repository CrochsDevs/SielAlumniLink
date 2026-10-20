// Current operational snapshot. Deliberately independent of the engagement date.
export async function dashboardOverview(db, user, now, alumni) {
  const count = (name, filter = {}) => db.collection(name).countDocuments(filter);
  const upcoming = { isActive: true, startAt: { $gte: now } };
  const visiblePosts = { deletedAt: { $exists: false }, 'moderation.blocked': { $ne: true } };
  const [entries, events, announcements, tracer, conversations] = await Promise.all([
    Promise.all([
      ['jobs', 'job_posts', { isActive: true }],
      ['applications', 'job_applications', {}],
      ['pendingApplications', 'job_applications', { status: 'submitted' }],
      ['events', 'events', upcoming],
      ['registrations', 'event_registrations', {}],
      ['surveys', 'surveys', { isActive: true }],
      ['surveyResponses', 'survey_responses', {}],
      ['certificates', 'digital_certificates', {}],
      ['pendingCertificates', 'student_event_attendance', { certificateId: { $exists: false } }],
      ['announcements', 'announcements', { isActive: true }],
      ['posts', 'feed_posts', visiblePosts],
      ['blockedPosts', 'feed_posts', { deletedAt: { $exists: false }, 'moderation.blocked': true }],
    ].map(async ([key, collection, filter]) => [key, await count(collection, filter)])),
    db.collection('events').find(upcoming, { projection: { title: 1, startAt: 1, location: 1 } }).sort({ startAt: 1 }).limit(3).toArray(),
    db.collection('announcements').find({ isActive: true }, { projection: { title: 1, createdAt: 1, audience: 1 } }).sort({ createdAt: -1 }).limit(3).toArray(),
    db.collection('tracer_responses').aggregate([
      { $match: { $expr: { $in: [{ $convert: { input: '$authId', to: 'string', onError: '', onNull: '' } }, alumni] } } },
      { $sort: { updatedAt: -1 } },
      { $group: { _id: { $toString: '$authId' }, status: { $first: '$status' } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]).toArray(),
    db.collection('conversations').find({ 'participants.authId': String(user._id) }, { projection: { _id: 1 } }).toArray(),
  ]);
  const unreadMessages = await count('messages', { conversationId: { $in: conversations.map(item => item._id) }, senderAuthId: { $ne: String(user._id) }, read: false, unsent: { $ne: true } });
  return { ...Object.fromEntries(entries), unreadMessages, upcomingEvents: events, recentAnnouncements: announcements,
    tracerResponses: tracer.reduce((sum, row) => sum + row.count, 0),
    employedAlumni: tracer.filter(row => ['Employed', 'Self-employed'].includes(row._id)).reduce((sum, row) => sum + row.count, 0) };
}
