// Notifications carry a nonce only. The server's httpOnly cookie remains the
// source of truth; account details and credentials never go into shared storage.
const channelName = 'alumnilink:session';
const storageKey = 'alumnilink:session-change';
let channel;
let requestAccountId = null;

export const accountId = user => user ? String(user.authId || user._id || '') : '';
export const sessionIdentity = user => user ? `${accountId(user)}:${user.role}:${!!user.passwordSetupRequired}` : 'signed-out';
export const setRequestAccount = user => { requestAccountId = accountId(user) || null; };
export const getRequestAccount = () => requestAccountId;

const getChannel = () => {
  if (channel) return channel;
  try { channel = new BroadcastChannel(channelName); } catch { /* Storage events provide the fallback. */ }
  return channel;
};

export function publishSessionChange() {
  const notice = { type: 'session-changed', id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}` };
  try { getChannel()?.postMessage(notice); } catch { /* Try storage below. */ }
  try { localStorage.setItem(storageKey, JSON.stringify(notice)); } catch { /* Focus revalidation still works. */ }
}

export function subscribeToSessionChanges(onChange) {
  const seen = new Set();
  const receive = notice => {
    if (notice?.type !== 'session-changed' || typeof notice.id !== 'string' || notice.id.length > 128 || seen.has(notice.id)) return;
    seen.add(notice.id);
    if (seen.size > 32) seen.delete(seen.values().next().value);
    onChange();
  };
  const broadcast = event => receive(event.data);
  const storage = event => {
    if (event.key !== storageKey || !event.newValue) return;
    try { receive(JSON.parse(event.newValue)); } catch { /* Ignore malformed notices. */ }
  };
  const activeChannel = getChannel();
  activeChannel?.addEventListener('message', broadcast);
  window.addEventListener('storage', storage);
  return () => {
    activeChannel?.removeEventListener('message', broadcast);
    window.removeEventListener('storage', storage);
  };
}
