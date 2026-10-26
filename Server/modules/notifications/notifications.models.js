import { client } from '../../config/db.js';
import { ObjectId } from 'mongodb';
import { notificationExpiresAt } from './notifications.retention.js';

export const createNotificationModel = (db) => {
  const notificationsCollection = db.collection('notifications');

  // Personal inbox per account. Broadcasts fan out one doc per recipient
  // (simple, correct at this scale; add cursors/queues if CAIS grows huge).
  return {
    async broadcast({ title, body, link, audience, kind, excludeAuthId, actorAuthId }) {
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

      const authUsers = await db.collection('auth').find(filter, {
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
        actorAuthId: actorAuthId ? String(actorAuthId) : null,
        read: false,
        createdAt: now,
        expiresAt: notificationExpiresAt(now),
      }));
      const result = await notificationsCollection.insertMany(docs);
      return result.insertedCount;
    },

    async notify({ recipientAuthId, recipientEmail, title, body, link, kind, actorAuthId }) {
      const now = new Date();
      const doc = {
        recipientAuthId: String(recipientAuthId),
        recipientEmail: recipientEmail || '',
        title,
        body: body || '',
        link: link || null,
        kind: kind || 'general',
        actorAuthId: actorAuthId ? String(actorAuthId) : null,
        read: false,
        createdAt: now,
        expiresAt: notificationExpiresAt(now),
      };
      const result = await notificationsCollection.insertOne(doc);
      return { ...doc, _id: result.insertedId };
    },

    async findMine(authId, limit = 20) {
      const notifications = await notificationsCollection
        .find({ recipientAuthId: String(authId), expiresAt: { $gt: new Date() } })
        .sort({ createdAt: -1 })
        .limit(Math.min(Math.max(limit, 1), 100))
        .toArray();
      const actorIds = [...new Set(notifications.map((notification) => notification.actorAuthId).filter(Boolean))];
      const legacyNames = new Map();
      notifications.forEach((notification) => {
        if (!notification.actorAuthId && ['connection_request', 'connection_response'].includes(notification.kind)) {
          const match = notification.body?.match(/^(.+) (?:wants to connect with you|accepted your connection request|declined your connection request)\.$/);
          if (match) legacyNames.set(String(notification._id), match[1]);
        }
      });
      const filters = [];
      if (actorIds.length) {
        const keys = actorIds.flatMap((id) => /^[0-9a-fA-F]{24}$/.test(String(id)) ? [String(id), new ObjectId(String(id))] : [String(id)]);
        filters.push({ authId: { $in: keys } });
      }
      if (legacyNames.size) filters.push({ name: { $in: [...new Set(legacyNames.values())] } });
      const profiles = filters.length ? await db.collection('users').find({ $or: filters }, {
        projection: { _id: 1, authId: 1, name: 1, role: 1, profilePicture: 1 },
      }).toArray() : [];
      const byAuthId = new Map(profiles.map((profile) => [String(profile.authId), profile]));
      const byName = new Map();
      profiles.forEach((profile) => byName.set(profile.name, [...(byName.get(profile.name) || []), profile]));
      return notifications.map((notification) => {
        const candidates = byName.get(legacyNames.get(String(notification._id))) || [];
        // Older connection notices have only a name; avoid attributing duplicate names.
        const profile = notification.actorAuthId ? byAuthId.get(String(notification.actorAuthId)) : candidates.length === 1 ? candidates[0] : null;
        return { ...notification, actor: profile ? {
          _id: String(profile._id), authId: String(profile.authId), name: profile.name,
          role: profile.role, profilePicture: profile.profilePicture || null,
        } : null };
      });
    },

    async unreadCount(authId) {
      return await notificationsCollection.countDocuments({
        recipientAuthId: String(authId),
        read: false,
        expiresAt: { $gt: new Date() },
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
};

export const NotificationModel = createNotificationModel(client.db('SielAlumni'));
export default NotificationModel;
