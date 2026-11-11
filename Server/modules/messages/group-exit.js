import { ObjectId } from 'mongodb';
import { groupRoles } from './group-admin.js';

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };

export async function exitGroup(collection, id, actorId, targetId = actorId, onExited = async () => {}) {
  if (!ObjectId.isValid(String(id))) fail(404, 'Group conversation not found');
  const actor = String(actorId);
  if (typeof targetId !== 'string' || !targetId) fail(400, 'Choose a group member');
  const membership = { _id: new ObjectId(String(id)), isGroup: true, 'participants.authId': actor };
  for (let attempt = 0; attempt < 5; attempt++) {
    const group = await collection.findOne(membership);
    if (!group) fail(404, 'Group conversation not found');
    const roles = groupRoles(group);
    if (targetId !== actor && !roles.adminAuthIds.includes(actor)) fail(403, 'Only group admins can remove members');
    if (!group.participants.some(p => String(p.authId) === targetId)) fail(404, 'Group member not found');
    const participants = group.participants.filter(p => String(p.authId) !== targetId);
    const adminAuthIds = roles.adminAuthIds.filter(id => id !== targetId);
    if (participants.length && !adminAuthIds.length) adminAuthIds.push(String(participants[0].authId));
    // Compare membership and roles together so concurrent promotions, additions,
    // removals and departures cannot overwrite each other or leave no admin.
    const updated = await collection.findOneAndUpdate({
      ...membership, participants: group.participants,
      adminAuthIds: group.adminAuthIds ?? { $exists: false },
      createdBy: group.createdBy ?? { $exists: false },
    }, { $set: { participants, adminAuthIds, createdBy: roles.createdBy, updatedAt: new Date() } }, { returnDocument: 'after' });
    if (updated) {
      await onExited({
        group: updated,
        actor: group.participants.find(member => String(member.authId) === actor),
        member: group.participants.find(member => String(member.authId) === targetId),
      });
      return updated;
    }
  }
  fail(409, 'The group changed while saving. Please try again.');
}
