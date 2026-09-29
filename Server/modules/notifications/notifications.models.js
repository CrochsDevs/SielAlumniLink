import { client } from '../../config/db.js';

const db = client.db('SielAlumni');
const notificationsCollection = db.collection('notifications');

// Personal inbox per account. Broadcasts fan out one doc per recipient
// (simple, correct at this scale; add cursors/queues if CAIS grows huge).
export const NotificationModel = {
  async broadcast({ title, body, link, audience, kind, excludeAuthId }) {
    const filter = {};
    if (audience && audience !== 'all') {
      filter.role = audience === 'alumni' ? 'alumni' : audience === 'students' ? 'student' : audience;
    }
    if (excludeAuthId) {
      try {
        const { ObjectId } = await import('mongodb');
        const exclude = excludeAuthId instanceof ObjectId ? excludeAuthId : new ObjectId(excludeAuthId);
        filter._id = { $ne: exclude };
      } catch {
        filter._id = { $ne: excludeAuthId };
      }
    }

    const authUsers = await client.db('SielAlumni').collection('auth').find(filter, {
      projection: { _id: 1, email: 1 },
    }).toArray();

    if (authUsers.length === 0) return 0;

    const now = new Date();
    const docs = authUsers.map((u) => ({
      recipientAuthId: String(u._id),
      recipientEmail: u.email,
      title,
      body: body || '',
      link: link || null,
      kind: kind || 'general',
      read: false,
      createdAt: now,
    }));
    const result = await notificationsCollection.insertMany(docs);
    return result.insertedCount;
  },

  async notify({ recipientAuthId, recipientEmail, title, body, link, kind }) {
    const doc = {
      recipientAuthId: String(recipientAuthId),
      recipientEmail: recipientEmail || '',
      title,
      body: body || '',
      link: link || null,
      kind: kind || 'general',
      read: false,
      createdAt: new Date(),
    };
    const result = await notificationsCollection.insertOne(doc);
    return { ...doc, _id: result.insertedId };
  },

  async findMine(authId, limit = 20) {
    return await notificationsCollection
      .find({ recipientAuthId: String(authId) })
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 100))
      .toArray();
  },

  async unreadCount(authId) {
    return await notificationsCollection.countDocuments({
      recipientAuthId: String(authId),
      read: false,
    });
  },

  async markRead(authId, id) {
    try {
      const { ObjectId } = await import('mongodb');
      await notificationsCollection.updateOne(
        { _id: new ObjectId(id), recipientAuthId: String(authId) },
        { $set: { read: true } }
      );
    } catch {
      // ignore
    }
  },

  async markAllRead(authId) {
    await notificationsCollection.updateMany(
      { recipientAuthId: String(authId), read: false },
      { $set: { read: true } }
    );
  },
};

export default NotificationModel;
