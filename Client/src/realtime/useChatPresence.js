import { useCallback, useEffect, useState } from 'react';
import { gooeyToast as toast } from 'goey-toast';
import { getSocket } from './socket';

export function useChatPresence(authId, conversations) {
  const [state, setState] = useState({ owner: null, status: 'offline', contacts: {} });
  const [saving, setSaving] = useState(false);
  const ids = JSON.stringify([...new Set(conversations.filter(c => !c.isGroup && c.authId).map(c => String(c.authId)))].sort().slice(0, 200));

  useEffect(() => {
    if (!authId) return;
    const socket = getSocket();
    const initial = { owner: authId, status: 'offline', contacts: {} };
    const self = ({ status }) => setState(previous => ({ ...(previous.owner === authId ? previous : initial), status }));
    const contacts = entries => setState(previous => ({
      ...(previous.owner === authId ? previous : initial),
      contacts: Object.fromEntries(entries.map(entry => [entry.authId, entry])),
    }));
    const changed = entry => setState(previous => {
      const current = previous.owner === authId ? previous : initial;
      return { ...current, contacts: { ...current.contacts, [entry.authId]: entry } };
    });
    const offline = () => setState(initial);
    socket.on('presence:self', self);
    socket.on('presence:contacts', contacts);
    socket.on('presence:changed', changed);
    socket.on('disconnect', offline);
    return () => {
      socket.off('presence:self', self);
      socket.off('presence:contacts', contacts);
      socket.off('presence:changed', changed);
      socket.off('disconnect', offline);
    };
  }, [authId]);

  useEffect(() => {
    if (!authId) return;
    const socket = getSocket();
    const watch = () => socket.emit('presence:watch', JSON.parse(ids));
    socket.on('connect', watch);
    if (socket.connected) watch();
    return () => socket.off('connect', watch);
  }, [authId, ids]);

  const setStatus = useCallback(status => {
    const socket = getSocket();
    if (!socket.connected) { toast.error('Reconnect before changing your status.'); return; }
    if (!['active', 'busy'].includes(status)) return;
    setSaving(true);
    socket.timeout(8000).emit('presence:set', { status }, (error, result) => {
      setSaving(false);
      if (error || !result?.success) toast.error(result?.message || 'Unable to update your status. Please try again.');
    });
  }, []);

  return { presenceStatus: state.owner === authId ? state.status : 'offline',
    contacts: state.owner === authId ? state.contacts : {}, presenceSaving: saving, setPresenceStatus: setStatus };
}
