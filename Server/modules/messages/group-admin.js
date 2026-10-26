import { ObjectId } from 'mongodb';

// Older groups stored the creator first; members have only ever been appended.
export function groupRoles(group) {
  const createdBy = String(group.createdBy || group.participants?.[0]?.authId || '');
  const members = new Set((group.participants || []).map(p => String(p.authId)));
  const adminAuthIds = [...new Set((group.adminAuthIds ?? [createdBy]).map(String))].filter(id => members.has(id));
  return { createdBy, adminAuthIds };
}

export const groupAdminFilter = authId => ({ $or: [
  { adminAuthIds: { $exists: false }, createdBy: String(authId) },
  { adminAuthIds: { $exists: false }, createdBy: { $exists: false }, 'participants.0.authId': String(authId) },
  { adminAuthIds: String(authId) },
] });

export async function promoteGroupAdmin(collection, id, authId, targetId) {
  const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
  if (!ObjectId.isValid(String(id))) fail(404, 'Group conversation not found');
  const membership = { _id: new ObjectId(String(id)), isGroup: true, 'participants.authId': String(authId) };
  const group = await collection.findOne(membership);
  if (!group) fail(404, 'Group conversation not found');
  if (!groupRoles(group).adminAuthIds.includes(String(authId))) fail(403, 'Only group admins can appoint another admin');
  if (typeof targetId !== 'string' || !group.participants.some(p => String(p.authId) === targetId)) fail(400, 'Choose an existing group member');
  const updated = await collection.findOneAndUpdate(
    { ...membership, ...groupAdminFilter(authId), participants: { $elemMatch: { authId: targetId } } },
    { $addToSet: { adminAuthIds: { $each: [String(authId), targetId] } }, $set: { updatedAt: new Date() } },
    { returnDocument: 'after' },
  );
  if (!updated) fail(409, 'Group permissions changed. Please try again.');
  return updated;
}
