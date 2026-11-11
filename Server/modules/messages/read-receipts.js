import { ObjectId } from 'mongodb';

// Group activity must be seen by each member, including the person who triggered it.
export const receivedMessageFilter = readerId => ({
  $or: [
    { senderAuthId: { $ne: String(readerId) } },
    { 'activity.type': { $in: ['members_added', 'member_removed', 'group_renamed'] } },
  ],
});

// A receipt applies only to eligible messages actually displayed by this member.
export async function recordMessageReads(collection, conversationId, readerId, messageIds, clearedAt) {
  const filter = {
    _id: { $in: messageIds.map(id => new ObjectId(id)) },
    conversationId: new ObjectId(String(conversationId)),
    ...receivedMessageFilter(readerId),
    readBy: { $ne: String(readerId) },
    ...(clearedAt ? { createdAt: { $gt: clearedAt } } : {}),
  };
  const messages = await collection.find(filter).toArray();
  if (!messages.length) return [];
  await collection.updateMany({ ...filter, _id: { $in: messages.map(message => message._id) } },
    { $set: { read: true }, $addToSet: { readBy: String(readerId) } });
  return messages;
}

export const messageWasRead = (message, isGroup) => Array.isArray(message.readBy)
  ? message.readBy.some(id => String(id) !== String(message.senderAuthId))
  : !isGroup && message.read === true;
