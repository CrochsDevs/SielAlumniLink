import { fail } from './feed.policy.js';

export function createFeedMessaging({ feed, conversations, messages, senders, emit, origin }) {
  return {
    async recipients(user, postId) {
      const people = await feed.recipients(user, postId);
      const groups = (await conversations.findMine(user._id))
        .filter(group => group.isGroup)
        .map(group => ({ conversationId: String(group._id), isGroup: true,
          name: group.name || 'Group Chat', memberCount: group.participants.length }));
      return [...people, ...groups];
    },
    async send(user, postId, input) {
      const post = await feed.get(user, postId);
      let conversation, recipient;
      if (input.conversationId !== undefined) {
        if (input.recipientAuthId !== undefined || typeof input.conversationId !== 'string' || !/^[a-f\d]{24}$/i.test(input.conversationId)) {
          fail(400, 'Choose a group chat');
        }
        conversation = await conversations.findById(input.conversationId);
        if (!conversation?.isGroup || !conversation.participants.some(member => String(member.authId) === String(user._id))) {
          fail(404, 'Group conversation not found');
        }
      } else {
        recipient = (await feed.recipients(user, postId)).find(person => person.authId === input.recipientAuthId);
        if (!recipient) fail(403, 'Choose a connected alumni who can view this post');
        conversation = await conversations.getOrCreate(user._id, user.email, recipient.authId, recipient.email);
      }
      // Only the link is shared. Opening it still checks each viewer's post access.
      const text = `Shared a post: ${origin}/feed?post=${post._id}`;
      const message = await messages.create({ conversationId: conversation._id, senderAuthId: user._id, senderEmail: user.email, text });
      const lastMessage = { text, at: message.createdAt, by: String(user._id) };
      await conversations.touch(conversation._id, lastMessage);
      const sender = (await senders([message])).get(String(user._id));
      for (const member of conversation.participants) {
        emit(member.authId, 'message:new', {
          conversationId: String(conversation._id),
          message: { ...message, ...sender, at: message.createdAt }, lastMessage,
        });
      }
      return { conversationId: String(conversation._id), ...(recipient ? { recipientEmail: recipient.email } : {}) };
    },
  };
}
