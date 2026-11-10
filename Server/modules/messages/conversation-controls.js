import { client } from '../../config/db.js';

const key = (...values) => JSON.stringify(values.map(String));
export const visibleConversation = (conversation, preference) => !preference?.hidden ||
  new Date(conversation.lastMessage?.at || 0).getTime() > new Date(preference.clearedAt).getTime();

export function createConversationControls(db) {
  const preferences = db.collection('conversation_preferences');
  const blocks = db.collection('message_blocks');
  return {
    preference(conversationId, authId) {
      return preferences.findOne({ _id: key(conversationId, authId) });
    },
    async preferencesFor(conversationIds, authId) {
      if (!conversationIds.length) return new Map();
      const rows = await preferences.find({ _id: { $in: conversationIds.map(id => key(id, authId)) } }).toArray();
      const byKey = new Map(rows.map(row => [row._id, row]));
      return new Map(conversationIds.map(id => [String(id), byKey.get(key(id, authId)) || null]));
    },
    async clear(conversationId, authId) {
      const clearedAt = new Date();
      const filter = { _id: key(conversationId, authId) };
      const update = { $max: { clearedAt }, $set: { conversationId: String(conversationId), authId: String(authId), hidden: true } };
      let saved;
      try { saved = await preferences.findOneAndUpdate(filter, update, { upsert: true, returnDocument: 'after' }); }
      catch (error) {
        if (error.code !== 11000) throw error;
        saved = await preferences.findOneAndUpdate(filter, update, { returnDocument: 'after' });
      }
      return { conversationId: String(conversationId), clearedAt: saved.clearedAt };
    },
    async show(conversationId, authId) {
      await preferences.updateOne({ _id: key(conversationId, authId) }, { $set: { hidden: false } });
    },
    async blockStatus(authId, otherAuthId) {
      const rows = await blocks.find({ _id: { $in: [key(authId, otherAuthId), key(otherAuthId, authId)] } }).toArray();
      return { blocked: rows.length > 0, blockedByMe: rows.some(row => row._id === key(authId, otherAuthId)) };
    },
    async isBlocked(authId, otherAuthId) {
      return !!(await blocks.findOne({ _id: { $in: [key(authId, otherAuthId), key(otherAuthId, authId)] } }));
    },
    async setBlocked(authId, otherAuthId, blocked) {
      const _id = key(authId, otherAuthId);
      if (blocked) await blocks.updateOne({ _id }, { $set: { authId: String(authId), targetAuthId: String(otherAuthId), createdAt: new Date() } }, { upsert: true });
      else await blocks.deleteOne({ _id });
      return this.blockStatus(authId, otherAuthId);
    },
  };
}

export const ConversationControls = createConversationControls(client.db('SielAlumni'));
