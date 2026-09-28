import { client } from '../../config/db.js';

const db = client.db('SielAlumni');
const convosCollection = db.collection('conversations');
const messagesCollection = db.collection('messages');

const toObjectId = async (id) => {
  const { ObjectId } = await import('mongodb');
  return id instanceof ObjectId ? id : new ObjectId(id);
};

const key = (id) => String(id);

export const ConversationModel = {
  // One conversation per pair of accounts (order-independent).
  async getOrCreate(aId, aEmail, bId, bEmail) {
    const pair = [key(aId), key(bId)].sort();
    let convo = await convosCollection.findOne({ pairKey: pair.join('|') });
    if (!convo) {
      const now = new Date();
      const doc = {
        pairKey: pair.join('|'),
        participants: [
          { authId: key(aId), email: aEmail },
          { authId: key(bId), email: bEmail },
        ],
        lastMessage: null,
        createdAt: now,
        updatedAt: now,
      };
      const result = await convosCollection.insertOne(doc);
      convo = { ...doc, _id: result.insertedId };
    }
    return convo;
  },

  async findMine(authId) {
    return await convosCollection
      .find({ 'participants.authId': key(authId) })
      .sort({ updatedAt: -1 })
      .toArray();
  },

  async findById(id) {
    try {
      return await convosCollection.findOne({ _id: await toObjectId(id) });
    } catch {
      return null;
    }
  },

  async touch(id, lastMessage) {
    try {
      await convosCollection.updateOne(
        { _id: await toObjectId(id) },
        { $set: { lastMessage, updatedAt: new Date() } }
      );
    } catch {
      // ignore
    }
  },
};

export const MessageModel = {
  async create({ conversationId, senderAuthId, senderEmail, text }) {
    const now = new Date();
    const doc = {
      conversationId: await toObjectId(conversationId),
      senderAuthId: key(senderAuthId),
      senderEmail,
      text: String(text || '').slice(0, 2000),
      read: false,
      createdAt: now,
    };
    const result = await messagesCollection.insertOne(doc);
    return { ...doc, _id: result.insertedId };
  },

  async listByConversation(conversationId, limit = 100) {
    try {
      return await messagesCollection
        .find({ conversationId: await toObjectId(conversationId) })
        .sort({ createdAt: 1 })
        .limit(limit)
        .toArray();
    } catch {
      return [];
    }
  },

  async markRead(conversationId, readerAuthId) {
    try {
      await messagesCollection.updateMany(
        {
          conversationId: await toObjectId(conversationId),
          senderAuthId: { $ne: key(readerAuthId) },
          read: false,
        },
        { $set: { read: true } }
      );
    } catch {
      // ignore
    }
  },

  async unreadCount(conversationId, readerAuthId) {
    try {
      return await messagesCollection.countDocuments({
        conversationId: await toObjectId(conversationId),
        senderAuthId: { $ne: key(readerAuthId) },
        read: false,
      });
    } catch {
      return 0;
    }
  },
};

export default { ConversationModel, MessageModel };
