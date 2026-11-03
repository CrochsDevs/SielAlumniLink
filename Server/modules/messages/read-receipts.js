import { ObjectId } from 'mongodb';

// A receipt applies only to incoming messages actually displayed by this member.
export async function recordMessageReads(collection, conversationId, readerId, messageIds, clearedAt) {
  const filter = {
    _id: { $in: messageIds.map(id => new ObjectId(id)) },
    conversationId: new ObjectId(String(conversationId)),
    senderAuthId: { $ne: String(readerId) },
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
