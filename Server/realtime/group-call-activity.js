export function createGroupCallJoinRecorder({ conversations, messages, senders, emit }) {
  return async event => {
    const group = await conversations.findById(event.conversationId);
    if (!group?.isGroup || !group.participants.some(member => String(member.authId) === String(event.member._id))) return;
    const actorName = event.name || 'A member';
    const text = `${actorName} joined the call`;
    const message = await messages.create({
      conversationId: event.conversationId,
      senderAuthId: event.member._id,
      senderEmail: event.member.email,
      text,
      call: { id: event.callId, kind: event.kind, group: true, status: 'joined', event: 'joined', actorName },
    });
    const lastMessage = { text, at: message.createdAt, by: String(event.member._id) };
    await conversations.touch(event.conversationId, lastMessage);
    const sender = (await senders([message])).get(String(message.senderAuthId));
    for (const member of group.participants) {
      emit(member.authId, 'message:new', {
        conversationId: event.conversationId,
        message: { ...message, ...sender, at: message.createdAt },
        lastMessage,
      });
    }
  };
}
