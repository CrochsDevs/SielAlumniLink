import { client } from '../../config/db.js';

const db = client.db('SielAlumni');
const activityCollection = db.collection('activity_logs');

// Persistent audit trail: logins, logouts (and future actions).
// Presence (online NOW) is separate — see realtime/presence.store.js.
export const ActivityModel = {
  async logPasswordChange({ authId, action = 'password_changed' }) {
    if (!['password_changed', 'password_reset'].includes(action)) return;
    try {
      await db.collection('member_activity').insertOne({
        authorAuthId: String(authId), kind: 'security', action, createdAt: new Date(),
      });
    } catch (error) {
      console.error('Password activity log failed:', error.message);
    }
  },
  async log({ authId, email, action, ip }) {
    try {
      await activityCollection.insertOne({
        authId: authId ? String(authId) : null,
        email,
        action, // 'login' | 'logout'
        ip: ip || null,
        createdAt: new Date(),
      });
    } catch (error) {
      // Never break auth flows because logging failed.
      console.error('Activity log failed:', error.message);
    }
  },

  async listRecent(limit = 50) {
    return await activityCollection
      .find({})
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 200))
      .toArray();
  },

  async lastLoginByEmail(email) {
    return await activityCollection.findOne(
      { email, action: 'login' },
      { sort: { createdAt: -1 } }
    );
  },
};

export default ActivityModel;
