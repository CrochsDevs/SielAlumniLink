import { nameGrams } from './search.names.js';

// Non-unique indexes preserve existing records, including legacy duplicate profiles.
export async function ensureSearchIndexes(db) {
  // One-time backfill; compare the original name to avoid racing concurrent profile edits.
  const profiles = db.collection('users');
  let batch = [];
  for await (const profile of profiles.find({ searchNameGrams: { $exists: false } }, { projection: { name: 1 } })) {
    batch.push({ updateOne: { filter: { _id: profile._id, name: profile.name ?? null }, update: { $set: { searchNameGrams: nameGrams(profile.name) } } } });
    if (batch.length === 500) { await profiles.bulkWrite(batch, { ordered: false }); batch = []; }
  }
  if (batch.length) await profiles.bulkWrite(batch, { ordered: false });
  await Promise.all([
    profiles.createIndex({ searchNameGrams: 1 }),
    db.collection('users').createIndex({ authId: 1, updatedAt: -1 }),
    db.collection('career_posts').createIndex({ isActive: 1, createdAt: -1 }),
    db.collection('connections').createIndex({ requesterAuthId: 1, updatedAt: -1 }),
    db.collection('connections').createIndex({ recipientAuthId: 1, updatedAt: -1 }),
    db.collection('activity_logs').createIndex({ authId: 1, action: 1, createdAt: -1 }),
  ]);
}
