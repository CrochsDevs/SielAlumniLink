function createGroupActivityRecorder({ conversations, messages, emit }) {
  return async ({ group, actor, text, activity }) => {
    const message = await messages.create({
      conversationId: group.conversationId,
      senderAuthId: actor.authId,
      senderEmail: actor.email,
      text,
      activity,
    });
    const lastMessage = { text, at: message.createdAt, by: actor.authId };
    await conversations.touch(group.conversationId, lastMessage);
    for (const member of group.members) {
      emit(member.authId, 'message:new', {
        conversationId: group.conversationId,
        message: { ...message, senderName: actor.name, senderProfilePicture: actor.profilePicture, at: message.createdAt },
        lastMessage,
      });
    }
  };
}

export function createGroupMemberActivityRecorder(dependencies) {
  const record = createGroupActivityRecorder(dependencies);
  return async ({ group, actor, members, type = 'members_added' }) => {
    if (!members.length) return;
    const names = members.map(member => member.name).join(', ');
    const text = type === 'member_removed'
      ? `${actor.name} removed ${names} from the group`
      : `${actor.name} added ${names} to the group`;
    await record({ group, actor, text,
      activity: { type, actorName: actor.name, memberAuthIds: members.map(member => member.authId) },
    });
  };
}

export function createGroupRenameRecorder({ profiles, ...dependencies }) {
  const record = createGroupActivityRecorder(dependencies);
  return async ({ group, actor }) => {
    const profile = await profiles.findByAuthId(String(actor.authId)) || await profiles.findByEmail(actor.email);
    const name = profile?.name || actor.email || 'A member';
    await record({
      group: { conversationId: String(group._id), members: group.participants },
      actor: { ...actor, authId: String(actor.authId), name, profilePicture: profile?.profilePicture || null },
      text: `${name} changed the group name to ${group.name}`,
      activity: { type: 'group_renamed', actorName: name, groupName: group.name },
    });
  };
}

export function createGroupMemberRemovalRecorder({ profiles, ...dependencies }) {
  const record = createGroupMemberActivityRecorder(dependencies);
  const person = async member => {
    const profile = await profiles.findByAuthId(String(member.authId)) || await profiles.findByEmail(member.email);
    return { ...member, authId: String(member.authId), name: profile?.name || member.email || 'A member', profilePicture: profile?.profilePicture || null };
  };
  return async ({ group, actor, member }) => {
    if (String(actor.authId) === String(member.authId)) return;
    const [sender, removed] = await Promise.all([person(actor), person(member)]);
    await record({
      group: { conversationId: String(group._id), members: group.participants },
      actor: sender,
      members: [removed],
      type: 'member_removed',
    });
  };
}
