// In-memory presence store: who is online right now.
// Keyed by auth id (string). Survives nothing — restart clears it,
// which is correct (all sockets drop on restart anyway).
// Persistent history (logins/logouts) lives in activity_logs.

const online = new Set(); // auth IDs only; presence never stores login emails.
const lastSeen = new Map(); // authId -> Date (updated on disconnect)

export const PresenceStore = {
  markOnline(authId) {
    online.add(String(authId));
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

  // Administrator directory payload: IDs/status only, never login credentials.
  snapshot() {
    return {
      online: [...online].map(authId => ({ authId })),
      lastSeen: Object.fromEntries(
        [...lastSeen.entries()].map(([authId, date]) => [authId, date.toISOString()])
      ),
    };
  },
};

export default PresenceStore;
