import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../utils/axios';
import { getSocket } from './socket';
import { useAuth } from '../context/useAuth';

// Refresh on socket events and reconnects without background polling.
export const useNotifications = () => {
  const { user } = useAuth();
  const authId = String(user?.authId || user?._id || '');
  const pending = useRef(null);
  const generation = useRef(0);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(() => {
    if (!authId) return Promise.resolve();
    if (pending.current?.authId === authId) return pending.current.request;
    const version = generation.current;
    const request = Promise.all([
      api.get('/notifications', { params: { limit: 20 } }),
      api.get('/notifications/unread-count'),
    ]).then(([listRes, countRes]) => {
      if (generation.current !== version) return;
      setItems(listRes.data.data || []);
      setUnread(countRes.data.data?.count || 0);
    }).catch(() => {
      // Retry on the next event or explicit refresh, not in a request loop.
    }).finally(() => {
      if (pending.current?.request === request) pending.current = null;
    });
    pending.current = { authId, request };
    return request;
  }, [authId]);
  useEffect(() => {
    const socket = getSocket();
    let timer;
    const scheduleRefresh = () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 200);
    };
    scheduleRefresh();
    socket.on('notification:new', scheduleRefresh);
    socket.on('connect', scheduleRefresh);
    return () => {
      generation.current += 1;
      clearTimeout(timer);
      pending.current = null;
      socket.off('notification:new', scheduleRefresh);
      socket.off('connect', scheduleRefresh);
    };
  }, [refresh]);

  const markRead = useCallback(async (id) => {
    setItems((prev) => prev.map((n) => (String(n._id) === String(id) ? { ...n, read: true } : n)));
    setUnread((prev) => Math.max(0, prev - 1));
    try {
      await api.put(`/notifications/${id}/read`);
    } catch {
      refresh();
    }
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    try {
      await api.put('/notifications/read-all');
    } catch {
      refresh();
    }
  }, [refresh]);

  return { items, unread, refresh, markRead, markAllRead };
};
