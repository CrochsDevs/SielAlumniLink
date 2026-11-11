// Only persisted, validated mentions can notify current group members.
export async function notifyMessageMentions({ conversation, message, senderName, notifications, emit }) {
  if (!conversation.isGroup) return [];
  const senderId = String(message.senderAuthId);
  const members = new Map(conversation.participants.map(member => [String(member.authId), member]));
  const recipients = [...new Set((message.mentions || []).map(mention => String(mention.authId)))]
    .filter(id => id !== senderId && members.has(id));
  return Promise.allSettled(recipients.map(async id => {
    const notification = await notifications.notify({
      recipientAuthId: id,
      recipientEmail: members.get(id).email,
      actorAuthId: senderId,
      kind: 'message_mention',
      title: 'You were mentioned in a group chat',
      body: `${senderName || 'A member'} mentioned you in ${conversation.name || 'a group conversation'}.`,
      link: `/message?conversation=${encodeURIComponent(String(conversation._id))}`,
    });
    emit(id, 'notification:new', notification);
  }));
}
