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

  // Group chat (3+ connects): named conversation with many members.
  async createGroup({ name, members }) {
    const now = new Date();
    const doc = {
      pairKey: null,
      isGroup: true,
      name: String(name || 'Group Chat').slice(0, 80),
      participants: members.map((m) => ({ authId: key(m.authId), email: m.email })),
      lastMessage: null,
      createdAt: now,
      updatedAt: now,
    };
    const result = await convosCollection.insertOne(doc);
    return { ...doc, _id: result.insertedId };
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
  async create({ conversationId, senderAuthId, senderEmail, text, attachment, call }) {
    const now = new Date();
    const doc = {
      conversationId: await toObjectId(conversationId),
      senderAuthId: key(senderAuthId),
      senderEmail,
      ...(call ? { call } : {}),
      text: String(text || '').slice(0, 2000),
      // Inline attachment (base64 data URL) until Cloudinary lands.
      // Capped client-side; migrate `url` to Cloudinary URLs later.
      attachment: attachment && attachment.url
        ? {
            kind: attachment.kind === 'file' ? 'file' : 'image',
            name: String(attachment.name || 'file').slice(0, 120),
            url: String(attachment.url).slice(0, 2_000_000),
          }
        : null,
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

  async markRead(conversationId, readerAuthId) {    try {
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

  // Sender-only edit (marks edited:true).
  async editMessage(messageId, senderAuthId, text) {
    try {
      const objectId = await toObjectId(messageId);
      const message = await messagesCollection.findOne({ _id: objectId });
      if (!message || message.call || String(message.senderAuthId) !== key(senderAuthId) || message.unsent) {
        return null;
      }
      await messagesCollection.updateOne(
        { _id: objectId },
        { $set: { text: String(text || '').slice(0, 2000), edited: true } }
      );
      return await messagesCollection.findOne({ _id: objectId });
    } catch {
      return null;
    }
  },

  // Sender-only unsend (tombstone — thread position preserved).
  async unsendMessage(messageId, senderAuthId) {
    try {
      const objectId = await toObjectId(messageId);
      const message = await messagesCollection.findOne({ _id: objectId });
      if (!message || message.call || String(message.senderAuthId) !== key(senderAuthId)) {
        return null;
      }
      await messagesCollection.updateOne(
        { _id: objectId },
        { $set: { text: '', unsent: true, edited: false } }
      );
      return { ...message, text: '', unsent: true };
    } catch {
      return null;
    }
  },
};

export default { ConversationModel, MessageModel };
