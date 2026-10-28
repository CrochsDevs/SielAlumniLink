const email = value => typeof value === "string" ? value.trim().toLowerCase() : "";
export const mentorKey = mentor => String(mentor?.authId || email(mentor?.email) || mentor?._id || '');

export function mentorConnectionStates(connections, user) {
  const accountId = String(user?.authId || user?._id || "");
  const accountEmail = email(user?.email);
  const isMine = (id, address) => id
    ? !!accountId && String(id) === accountId
    : !!accountEmail && email(address) === accountEmail;
  const newest = [...connections].sort((a, b) =>
    (Date.parse(b.updatedAt || b.createdAt) || 0) - (Date.parse(a.updatedAt || a.createdAt) || 0));
  const states = {};
  const seen = new Set();
  for (const connection of newest) {
    const outgoing = isMine(connection.requesterAuthId, connection.requesterEmail);
    const incoming = isMine(connection.recipientAuthId, connection.recipientEmail);
    if (outgoing === incoming) continue;
    const peer = email(outgoing ? connection.recipientEmail : connection.requesterEmail);
    const peerId = outgoing ? connection.recipientAuthId : connection.requesterAuthId;
    const key = peerId ? String(peerId) : peer;
    if (!key || seen.has(key)) continue;
    // A newer pending/declined record must not be replaced by an old acceptance.
    seen.add(key);
    const state = connection.status === 'accepted' ? 'connected' : connection.status === 'pending' ? outgoing ? 'pending' : 'incoming' : null;
    if (state) { states[key] = state; if (peer) states[peer] = state; }
  }
  return states;
}
