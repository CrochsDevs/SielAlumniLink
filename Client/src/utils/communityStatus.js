import api from './axios';

// Share in-flight status reads for one account; never cache settled responses.
export function createCommunityStatusReader(get) {
  const pending = new Map();
  return owner => {
    if (pending.has(owner)) return pending.get(owner);
    const request = Promise.resolve().then(() => get('/community/me')).finally(() => {
      if (pending.get(owner) === request) pending.delete(owner);
    });
    pending.set(owner, request);
    return request;
  };
}

export const readCommunityStatus = createCommunityStatusReader(url => api.get(url));
