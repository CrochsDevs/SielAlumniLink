// Share simultaneous reads only; settled responses are never cached.
export function createPendingReads(get) {
  const pending = new Map();
  return (url, config) => {
    const key = JSON.stringify([url, config?.params || null]);
    if (pending.has(key)) return pending.get(key);
    const request = Promise.resolve().then(() => get(url, config)).finally(() => {
      if (pending.get(key) === request) pending.delete(key);
    });
    pending.set(key, request);
    return request;
  };
}
