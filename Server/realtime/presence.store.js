// Presence is tracked per socket so closing one tab cannot hide another.
export function createPresenceStore({ now = () => new Date() } = {}) {
  const online = new Map();
  const statuses = new Map();
  const lastSeen = new Map();
  return {
    markOnline(authId, socketId = 'default', preference = 'active') {
      const id = String(authId);
      const sessions = online.get(id) || new Set();
      sessions.add(socketId);
      online.set(id, sessions);
      if (!statuses.has(id)) statuses.set(id, preference === 'busy' ? 'busy' : 'active');
      lastSeen.delete(id);
    },
    markOffline(authId, socketId = 'default') {
      const id = String(authId);
      const sessions = online.get(id);
      if (!sessions) return;
      sessions.delete(socketId);
      if (!sessions.size) { online.delete(id); lastSeen.set(id, now()); }
    },
    isOnline(authId) { return online.has(String(authId)); },
    getLastSeen(authId) { return lastSeen.get(String(authId)) || null; },
    getStatus(authId) { return online.has(String(authId)) ? statuses.get(String(authId)) || 'active' : 'offline'; },
    setStatus(authId, status) {
      if (!['active', 'busy'].includes(status)) return false;
      statuses.set(String(authId), status);
      return true;
    },
    contact(authId) {
      const id = String(authId);
      return { authId: id, status: this.getStatus(id), lastSeen: this.getLastSeen(id)?.toISOString() || null };
    },
    snapshot() {
      return {
        online: [...online.keys()].map(authId => ({ authId, status: this.getStatus(authId) })),
        lastSeen: Object.fromEntries([...lastSeen].map(([id, date]) => [id, date.toISOString()])),
      };
    },
  };
}
export const PresenceStore = createPresenceStore();
export default PresenceStore;
