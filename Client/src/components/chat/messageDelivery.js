// Preserve socket receipts and in-flight sends when an older history request resolves.
export function mergeMessageHistory(current, fetched) {
  const previous = new Map(current.filter(message => message._id).map(message => [String(message._id), message]));
  const savedClientIds = new Set(fetched.map(message => message.clientMessageId).filter(Boolean));
  const ids = new Set(fetched.map(message => String(message._id)));
  const newest = Math.max(0, ...fetched.map(message => new Date(message.at || 0).getTime()));
  return [
    ...fetched.map(message => ({ ...message,
      read: !!message.read || !!previous.get(String(message._id))?.read,
      readByMe: !!message.readByMe || !!previous.get(String(message._id))?.readByMe })),
    ...current.filter(message => message.pendingId ? !savedClientIds.has(message.pendingId)
      : !ids.has(String(message._id)) && new Date(message.at || 0).getTime() > newest),
  ];
}

export const messageDeliveryLabel = message => message.pendingId ? 'Sending…' : message.edited ? 'Edited' : message.read ? 'Read' : 'Sent';
