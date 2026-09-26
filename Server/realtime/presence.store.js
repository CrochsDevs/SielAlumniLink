// In-memory presence store: who is online right now.
// Keyed by auth id (string). Survives nothing — restart clears it,
// which is correct (all sockets drop on restart anyway).
// Persistent history (logins/logouts) lives in activity_logs.

const online = new Map(); // authId -> { email, connectedAt }
const lastSeen = new Map(); // authId -> Date (updated on disconnect)

export const PresenceStore = {
  markOnline(authId, email) {
    online.set(String(authId), { email, connectedAt: new Date() });
    lastSeen.delete(String(authId));
  },

  markOffline(authId) {
    const key = String(authId);
    if (online.delete(key)) {
      lastSeen.set(key, new Date());
    }
  },

  isOnline(authId) {
    return online.has(String(authId));
  },

  getLastSeen(authId) {
    return lastSeen.get(String(authId)) || null;
  },

  // { online: [{ authId, email, connectedAt }], lastSeen: { authId: ISOString } }
  snapshot() {
    return {
      online: [...online.entries()].map(([authId, info]) => ({
        authId,
        email: info.email,
        connectedAt: info.connectedAt,
      })),
      lastSeen: Object.fromEntries(
        [...lastSeen.entries()].map(([authId, date]) => [authId, date.toISOString()])
      ),
    };
  },
};

export default PresenceStore;
