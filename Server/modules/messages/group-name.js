import { ObjectId } from 'mongodb';
import { groupAdminFilter, groupRoles } from './group-admin.js';

export async function renameGroup(collection, id, authId, value, onRenamed = async () => {}) {
  const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 80) {
    fail(400, 'Group name must be between 1 and 80 characters');
  }
  if (!ObjectId.isValid(String(id))) fail(404, 'Group conversation not found');
  // Membership and group type are checked in the write itself.
  const group = await collection.findOneAndUpdate(
    { _id: new ObjectId(String(id)), isGroup: true, 'participants.authId': String(authId), ...groupAdminFilter(authId), name: { $ne: value.trim() } },
    { $set: { name: value.trim(), updatedAt: new Date() } },
    { returnDocument: 'after' },
  );
  if (!group) {
    const memberGroup = await collection.findOne({ _id: new ObjectId(String(id)), isGroup: true, 'participants.authId': String(authId) });
    if (memberGroup) {
      if (!groupRoles(memberGroup).adminAuthIds.includes(String(authId))) fail(403, 'Only group admins can edit the group name');
      if (memberGroup.name === value.trim()) return memberGroup;
      fail(409, 'The group changed while saving. Please try again.');
    }
    fail(404, 'Group conversation not found');
  }
  await onRenamed({ group, actor: group.participants.find(member => String(member.authId) === String(authId)) });
  return group;
}
