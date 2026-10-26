import { groupRoles } from './group-admin.js';
export const MAX_GROUP_MEMBERS = 20;
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };

export function createGroupMembersService({ conversations, connections, accounts, profiles }) {
  const getGroup = async (id, authId) => {
    const group = await conversations.findById(id);
    if (!group?.isGroup || !group.participants.some(p => String(p.authId) === String(authId))) {
      fail(404, 'Group conversation not found');
    }
    return group;
  };
  const person = async member => {
    const profile = await profiles.findByAuthId(String(member.authId)) || await profiles.findByEmail(member.email);
    return { authId: String(member.authId), email: member.email, name: profile?.name || member.email, profilePicture: profile?.profilePicture || null };
  };
  const details = async group => ({
    conversationId: String(group._id), name: group.name, memberCount: group.participants.length,
    ...groupRoles(group),
    maxMembers: MAX_GROUP_MEMBERS, members: await Promise.all(group.participants.map(async member => ({ ...await person(member), isAdmin: groupRoles(group).adminAuthIds.includes(String(member.authId)) }))),
  });
  const connectedIds = async authId => new Set((await connections.findMine(authId))
    .filter(c => c.status === 'accepted')
    .map(c => String(c.requesterAuthId) === String(authId) ? String(c.recipientAuthId) : String(c.requesterAuthId)));
  return {
    async list(id, authId) { return details(await getGroup(id, authId)); },
    async candidates(id, authId) {
      const group = await getGroup(id, authId);
      const existing = new Set(group.participants.map(p => String(p.authId)));
      const ids = [...await connectedIds(authId)].filter(id => !existing.has(id));
      const people = await Promise.all(ids.map(async id => {
        const account = await accounts.findById(id);
        return account ? person({ authId: account._id, email: account.email }) : null;
      }));
      return people.filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
    },
    async add(id, authId, input) {
      let group = await getGroup(id, authId);
      if (!Array.isArray(input) || !input.length || input.length > MAX_GROUP_MEMBERS || input.some(id => typeof id !== 'string' || !id.trim())) {
        fail(400, 'Choose between 1 and 20 people to add');
      }
      const requested = [...new Set(input.map(id => id.trim()))];
      const connected = await connectedIds(authId);
      // Compare the full membership snapshot in the atomic write. Concurrent
      // additions retry against the latest group, preventing duplicates/lost updates.
      for (let attempt = 0; attempt < 5; attempt++) {
        const existing = new Set(group.participants.map(p => String(p.authId)));
        const ids = requested.filter(id => !existing.has(id));
        if (!ids.length) return details(group);
        if (ids.some(id => !connected.has(id))) fail(403, 'You can only add your accepted connections');
        if (group.participants.length + ids.length > MAX_GROUP_MEMBERS) fail(400, 'Maximum 20 members per group');
        const members = await Promise.all(ids.map(async id => {
          const account = await accounts.findById(id);
          if (!account) fail(404, 'A selected account is no longer available');
          return { authId: String(account._id), email: account.email };
        }));
        const updated = await conversations.appendMembers(id, authId, group.participants, members);
        if (updated) return details(updated);
        group = await getGroup(id, authId);
      }
      fail(409, 'The group changed while saving. Please try again.');
    },
  };
}
