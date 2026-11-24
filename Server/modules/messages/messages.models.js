import { community } from '../community/community.runtime.js';
import { client } from '../../config/db.js';
import { renameGroup } from './group-name.js';
import { promoteGroupAdmin } from './group-admin.js';
import { exitGroup } from './group-exit.js';
import { ConversationControls, visibleConversation } from './conversation-controls.js';
import { recordMessageReads, receivedMessageFilter } from './read-receipts.js';
import { resolveMessageMentions } from './message-mentions.js';
import UserModel from '../users/users.models.js';

const db = client.db('SielAlumni');
const convosCollection = db.collection('conversations');
const messagesCollection = db.collection('messages');

const toObjectId = async (id) => {
  const { ObjectId } = await import('mongodb');
  return id instanceof ObjectId ? id : new ObjectId(id);
};

const key = (id) => String(id);
// Request-scoped metadata stays out of JSON responses and persisted documents.
export const conversationPreference = Symbol('conversationPreference');

export const ConversationModel = {
  exitGroup(id, actorId, targetId, onExited) {
    return exitGroup(convosCollection, id, String(actorId), targetId, onExited);
  },
  promoteAdmin(id, authId, targetId) {
    return promoteGroupAdmin(convosCollection, id, authId, targetId);
  },
  async appendMembers(id, authId, expected, members) {
    return convosCollection.findOneAndUpdate(
      { _id: await toObjectId(id), isGroup: true, 'participants.authId': key(authId), participants: expected },
      { $push: { participants: { $each: members } }, $set: { updatedAt: new Date() } },
      { returnDocument: 'after' },
    );
  },
  renameGroup(id, authId, name, onRenamed) {
    return renameGroup(convosCollection, id, authId, name, onRenamed);
  },
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
    const conversations = await convosCollection
      .find({ 'participants.authId': key(authId) })
      .sort({ updatedAt: -1 })
      .toArray();
    const preferences = await ConversationControls.preferencesFor(conversations.map(conversation => conversation._id), authId);
    return conversations.filter(conversation => {
      const preference = preferences.get(key(conversation._id));
      if (!visibleConversation(conversation, preference)) return false;
      Object.defineProperty(conversation, conversationPreference, { value: preference, configurable: true });
      return true;
    });
  },

  // Group chat (3+ connects): named conversation with many members.
  async createGroup({ name, members }) {
    const now = new Date();
    const doc = {
      pairKey: null,
      isGroup: true,
      createdBy: key(members[0].authId),
      adminAuthIds: [key(members[0].authId)],
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
  async latestIncoming(conversationId, readerAuthId, clearedAt = null) {
    // Group activity belongs to the whole group, including its actor.
    return messagesCollection.findOne({ conversationId: await toObjectId(conversationId),
      ...receivedMessageFilter(readerAuthId), hiddenFor: { $ne: key(readerAuthId) },
      ...(clearedAt ? { createdAt: { $gt: clearedAt } } : {}) },
    { sort: { createdAt: -1, _id: -1 }, projection: { _id: 1, text: 1, createdAt: 1, unsent: 1, 'attachment.kind': 1 } });
  },
  async create({ conversationId, senderAuthId, senderEmail, text, attachment, call, activity, clientMessageId, mentions = [], moderationChecked = false, replyToId }) {
    if (attachment && (!attachment.publicId || attachment.deliveryType !== 'authenticated')) {
      throw new Error('Message attachments must be uploaded to Cloudinary first');
    }
    const conversation = await ConversationModel.findById(conversationId);
    if (!conversation || !conversation.participants.some(member => String(member.authId) === key(senderAuthId))) throw Object.assign(new Error('Conversation not found'), { status: 404 });
    if (replyToId) {
      const preference = await ConversationControls.preference(conversationId, senderAuthId);
      const original = await messagesCollection.findOne({ _id: await toObjectId(replyToId), conversationId: await toObjectId(conversationId),
        unsent: { $ne: true }, hiddenFor: { $ne: key(senderAuthId) }, call: { $exists: false }, activity: { $exists: false },
        ...(preference?.clearedAt ? { createdAt: { $gt: preference.clearedAt } } : {}) });
      if (!original) throw Object.assign(new Error('This message is no longer available to reply to.'), { status: 400 });
    }
    await community.assertRecipients(conversation.participants.filter(member => String(member.authId) !== key(senderAuthId)).map(member => member.authId));
    // check() already enforces sender restrictions before and after analysis.
    if (!call && !activity) {
      if (moderationChecked) await community.assertAllowed({ _id: senderAuthId }, 'messaging');
      else await community.check({ _id: senderAuthId }, { type: 'message', text });
    }
    const now = new Date();
    const doc = {
      conversationId: await toObjectId(conversationId),
      senderAuthId: key(senderAuthId),
      senderEmail,
      ...(clientMessageId ? { clientMessageId } : {}),
      ...(replyToId ? { replyToId: String(replyToId) } : {}),
      ...(call ? { call } : {}),
      ...(activity ? { activity } : {}),
      text: String(text || '').slice(0, 2000),
      mentions,
      attachment: attachment || null,
      read: false,
      readBy: [],
      createdAt: now,
    };
    const result = await messagesCollection.insertOne(doc);
    return { ...doc, _id: result.insertedId };
  },

  async listByConversation(conversationId, limit = 100, clearedAt = null, viewerAuthId = null) {
    try {
      return await messagesCollection
        .find({ conversationId: await toObjectId(conversationId), ...(viewerAuthId ? { hiddenFor: { $ne: key(viewerAuthId) } } : {}), ...(clearedAt ? { createdAt: { $gt: clearedAt } } : {}) })
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit)
        .toArray().then(messages => messages.reverse());
    } catch {
      return [];
    }
  },

  async hiddenMessageIds(conversationId, viewerAuthId) {
    return messagesCollection.find({ conversationId: await toObjectId(conversationId), hiddenFor: key(viewerAuthId) },
      { projection: { _id: 1 } }).toArray().then(rows => rows.map(row => String(row._id)));
  },

  async replySources(conversationId, ids, viewerAuthId, clearedAt) {
    if (!ids.length) return [];
    const valid = ids.filter(id => /^[a-f\d]{24}$/i.test(String(id)));
    return messagesCollection.find({ _id: { $in: await Promise.all(valid.map(toObjectId)) },
      conversationId: await toObjectId(conversationId), hiddenFor: { $ne: key(viewerAuthId) }, unsent: { $ne: true },
      ...(clearedAt ? { createdAt: { $gt: clearedAt } } : {}) },
      { projection: { _id: 1, text: 1, senderAuthId: 1, senderEmail: 1, 'attachment.kind': 1, 'attachment.name': 1 } }).toArray();
  },

  async hideMessage(messageId, authId) {
    const message = await messagesCollection.findOne({ _id: await toObjectId(messageId) });
    if (!message || message.activity) throw Object.assign(new Error('Message not found'), { status: 404 });
    const conversation = await ConversationModel.findById(message.conversationId);
    if (!conversation?.participants.some(member => key(member.authId) === key(authId))) throw Object.assign(new Error('Message not found'), { status: 404 });
    await messagesCollection.updateOne({ _id: message._id }, { $addToSet: { hiddenFor: key(authId) } });
    return { conversationId: String(message.conversationId), messageId: String(message._id) };
  },

  markRead(conversationId, readerAuthId, messageIds, clearedAt) {
    return recordMessageReads(messagesCollection, conversationId, readerAuthId, messageIds, clearedAt);
  },

  async unreadCount(conversationId, readerAuthId, clearedAt = null) {
    try {
      return await messagesCollection.countDocuments({
        conversationId: await toObjectId(conversationId),
        hiddenFor: { $ne: key(readerAuthId) },
        $and: [
          receivedMessageFilter(readerAuthId),
          { $or: [{ readBy: { $exists: true, $ne: key(readerAuthId) } }, { readBy: { $exists: false }, read: false }] },
        ],
        ...(clearedAt ? { createdAt: { $gt: clearedAt } } : {}),
      });
    } catch {
      return 0;
    }
  },

  // Sender-only edit (marks edited:true).
  async editMessage(messageId, senderAuthId, text, mentionAuthIds) {
    try {
      const objectId = await toObjectId(messageId);
      const message = await messagesCollection.findOne({ _id: objectId });
      if (!message || message.call || message.activity || String(message.senderAuthId) !== key(senderAuthId) || message.unsent) {
        return null;
      }
      const conversation = await ConversationModel.findById(message.conversationId);
      if (!conversation?.participants?.some(member => String(member.authId) === key(senderAuthId))) return null;
      const other = conversation.participants.find(member => String(member.authId) !== key(senderAuthId));
      if (!conversation.isGroup && other && await ConversationControls.isBlocked(senderAuthId, other.authId)) return null;
      await community.assertRecipients(conversation.participants.filter(member => String(member.authId) !== key(senderAuthId)).map(member => member.authId));
      await community.check({ _id: senderAuthId }, { type: 'message', targetId: messageId, text });
      const mentions = await resolveMessageMentions(conversation, text, mentionAuthIds ?? [...new Set((message.mentions || []).map(mention => mention.authId))], ids => UserModel.findChatProfilesByAuthIds(ids));
      await messagesCollection.updateOne(
        { _id: objectId },
        { $set: { text: String(text || '').slice(0, 2000), mentions, edited: true } }
      );
      return await messagesCollection.findOne({ _id: objectId });
    } catch (error) {
      if (error.status) throw error;
      return null;
    }
  },

  // Sender-only unsend (tombstone — thread position preserved).
  async unsendMessage(messageId, senderAuthId) {
    try {
      const objectId = await toObjectId(messageId);
      const message = await messagesCollection.findOne({ _id: objectId });
      if (!message || message.call || message.activity || String(message.senderAuthId) !== key(senderAuthId)) {
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
