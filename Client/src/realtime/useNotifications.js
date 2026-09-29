import { useCallback, useEffect, useState } from 'react';
import api from '../utils/axios';
import { getSocket } from './socket';

// Shared notifications feed: list + unread count, real-time via socket + 30s polling fallback.
export const useNotifications = () => {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const [listRes, countRes] = await Promise.all([
        api.get('/notifications', { params: { limit: 20 } }),
        api.get('/notifications/unread-count'),
      ]);
      setItems(listRes.data.data || []);
      setUnread(countRes.data.data?.count || 0);
    } catch {
      // stay silent — notifications are secondary
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30000);

    const socket = getSocket();
    const onNotification = () => { refresh(); };
    socket.on('notification:new', onNotification);

    return () => {
      clearInterval(id);
      socket.off('notification:new', onNotification);
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
