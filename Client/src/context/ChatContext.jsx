import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import api from '../utils/axios';
import { getSocket } from '../realtime/socket';
import { useAuth } from './useAuth';
import ChatDock from '../components/chat/ChatDock';

export const ChatContext = createContext(null);

const toInitial = (name, email) => (name || email || 'U').charAt(0).toUpperCase();

// Real messaging lives here at app root so chat windows survive
// page navigation — they only close when the user presses X.
export const ChatProvider = ({ children }) => {
  const { user } = useAuth();
  const myAuthId = user?._id ? String(user._id) : null;
  const myAuthIdRef = useRef(myAuthId);
  myAuthIdRef.current = myAuthId;

  const [convos, setConvos] = useState([]);
  const [openChats, setOpenChats] = useState([]);
  const [threads, setThreads] = useState({});

  const refreshConvos = useCallback(async () => {
    if (!myAuthIdRef.current) return;
    try {
      const res = await api.get('/conversations');
      setConvos(
        (res.data.data || []).map((c) => ({
          ...c,
          initial: toInitial(c.name, c.email),
        }))
      );
    } catch {
      // stay silent — chat is secondary
    }
  }, []);

  useEffect(() => {
    if (myAuthId) {
      refreshConvos();
    } else {
      setConvos([]);
      setOpenChats([]);
      setThreads({});
    }
  }, [myAuthId, refreshConvos]);

  // Live incoming messages (both participants get pushed).
  useEffect(() => {
    const socket = getSocket();
    const onNew = ({ conversationId, message }) => {
      const from = String(message.senderAuthId) === String(myAuthIdRef.current) ? 'me' : 'them';
      setThreads((prev) => ({
        ...prev,
        [conversationId]: [...(prev[conversationId] || []), { from, text: message.text }],
      }));
      setConvos((prev) =>
        prev.map((c) =>
          c._id === conversationId || String(c._id) === String(conversationId)
            ? {
                ...c,
                preview: message.text,
                time: message.at,
                unread: from === 'me' ? c.unread : (c.unread || 0) + 1,
              }
            : c
        )
      );
    };
    socket.on('message:new', onNew);
    return () => {
      socket.off('message:new', onNew);
    };
  }, []);

  const loadThread = useCallback(async (convoId) => {
    try {
      const res = await api.get(`/conversations/${convoId}/messages`);
      setThreads((prev) => ({ ...prev, [convoId]: res.data.data || [] }));
      // Incoming now read — clear badge locally.
      setConvos((prev) => prev.map((c) => (String(c._id) === String(convoId) ? { ...c, unread: 0 } : c)));
    } catch {
      // ignore
    }
  }, []);

  // Open a chat window (max 2 — oldest gets replaced).
  const openChat = useCallback(
    (convo) => {
      const id = String(convo._id);
      loadThread(id);
      setOpenChats((prev) => {
        const existing = prev.find((w) => String(w.id) === id);
        if (existing) {
          return prev.map((w) => (String(w.id) === id ? { ...w, minimized: false } : w));
        }
        const next = [...prev, { id, convo: { ...convo, initial: convo.initial || toInitial(convo.name, convo.email) }, minimized: false }];
        return next.length > 2 ? next.slice(next.length - 2) : next;
      });
    },
    [loadThread]
  );

  // Start (or reopen) a chat with someone by email — used by
  // profile Message buttons.
  const openChatByEmail = useCallback(
    async (email) => {
      try {
        const res = await api.post('/conversations', { email });
        const convo = { ...res.data.data, initial: toInitial(res.data.data.name, res.data.data.email) };
        setConvos((prev) => {
          const exists = prev.some((c) => String(c._id) === String(convo._id));
          return exists ? prev.map((c) => (String(c._id) === String(convo._id) ? convo : c)) : [convo, ...prev];
        });
        openChat(convo);
        return true;
      } catch (err) {
        Swal.fire('Error', err.response?.data?.message || 'Cannot open chat', 'error');
        return false;
      }
    },
    [openChat]
  );

  const closeChat = useCallback((id) => {
    setOpenChats((prev) => prev.filter((w) => String(w.id) !== String(id)));
  }, []);

  const toggleMinChat = useCallback((id) => {
    setOpenChats((prev) => prev.map((w) => (String(w.id) === String(id) ? { ...w, minimized: !w.minimized } : w)));
  }, []);

  const sendChat = useCallback(async (id, text) => {
    // Optimistic bubble; server push confirms to all tabs.
    setThreads((prev) => ({ ...prev, [id]: [...(prev[id] || []), { from: 'me', text }] }));
    try {
      await api.post(`/conversations/${id}/messages`, { text });
      setConvos((prev) =>
        prev.map((c) => (String(c._id) === String(id) ? { ...c, preview: text, time: new Date().toISOString() } : c))
      );
    } catch {
      // keep optimistic bubble; refresh on next load
    }
  }, []);

  const unreadTotal = convos.reduce((sum, c) => sum + (c.unread || 0), 0);

  return (
    <ChatContext.Provider
      value={{ convos, threads, openChat, openChatByEmail, refreshConvos, loadThread, sendChat, unreadTotal }}
    >
      {children}
      <ChatDock
        windows={openChats}
        threads={threads}
        onClose={closeChat}
        onToggleMin={toggleMinChat}
        onSend={sendChat}
      />
    </ChatContext.Provider>
  );
};

export const useChat = () => useContext(ChatContext);
