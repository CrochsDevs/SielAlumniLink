// Non-unique indexes for the lists and per-account lookups used most often.
export async function ensurePerformanceIndexes(db) {
  const indexes = [
    ['events', { isActive: 1, createdAt: -1, _id: -1 }],
    ['events', { createdAt: -1, _id: -1 }],
    ['events', { isActive: 1, startAt: 1 }],
    ['conversations', { 'participants.authId': 1, updatedAt: -1 }],
    ['messages', { conversationId: 1, createdAt: -1, _id: -1 }],
    ['activity_logs', { action: 1, createdAt: 1 }],
    ['event_registrations', { authId: 1 }],
    ['event_registrations', { eventId: 1, registeredAt: 1 }],
    ['digital_certificates', { studentAuthId: 1, issuedAt: -1 }],
    ['digital_certificates', { issuedAt: -1 }],
    ['student_event_attendance', { certificateId: 1, date: -1 }],
    ['student_event_attendance', { authId: 1, date: -1 }],
    ['auth', { role: 1 }],
    ['users', { email: 1 }],
  ];
  // Build sequentially to avoid competing index builds during startup.
  for (const [collection, keys] of indexes) await db.collection(collection).createIndex(keys);
}
