import { client } from '../../config/db.js';
import { recordAdminAudit, listUserAccessAudit } from './admin-audit.js';

const db = client.db('SielAlumni');
const activityCollection = db.collection('activity_logs');

// Persistent audit trail: logins, logouts (and future actions).
// Presence (online NOW) is separate — see realtime/presence.store.js.
export const ActivityModel = {
  logAdmin(actor, action, target, details, ip) {
    return recordAdminAudit(db, actor, action, target, details, ip);
  },
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
  async log({ authId, email, action, ip, role }) {
    try {
      await activityCollection.insertOne({
        authId: authId ? String(authId) : null,
        email,
        action, // 'login' | 'logout'
        role: typeof role === 'string' ? role.toLowerCase() : null,
        ip: ip || null,
        createdAt: new Date(),
      });
    } catch (error) {
      // Never break auth flows because logging failed.
      console.error('Activity log failed:', error.message);
    }
  },

  async listRecent(limit = 50) {
    return listUserAccessAudit(db, limit);
  },

  async lastLoginByEmail(email) {
    return await activityCollection.findOne(
      { email, action: 'login' },
      { sort: { createdAt: -1 } }
    );
  },
};

export default ActivityModel;
