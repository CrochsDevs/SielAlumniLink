import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import api from '../utils/axios';
import { getSocket } from '../realtime/socket';
import { useAuth } from './useAuth';
import ChatDock from '../components/chat/ChatDock';
import CallManager from '../components/call/CallManager';

export const ChatContext = createContext(null);

const toInitial = (name, email) => (name || email || 'U').charAt(0).toUpperCase();

// Real messaging lives here at app root so chat windows survive
// page navigation — they only close when the user presses X.
export const ChatProvider = ({ children }) => {
  const { user } = useAuth();
  // Compare against the AUTH id (senderAuthId from the server is the
  // auth-record id, while user._id is the profile id — they differ!).
  const myAuthId = user?.authId ? String(user.authId) : user?._id ? String(user._id) : null;
  const myAuthIdRef = useRef(myAuthId);
  myAuthIdRef.current = myAuthId;

  const [convos, setConvos] = useState([]);
  const [openChats, setOpenChats] = useState([]);
  const [threads, setThreads] = useState({});

  const storageKey = myAuthId ? `chatdock:${myAuthId}` : null;

  // Restore open windows + recent threads (survives refresh),
  // then re-sync threads so nothing sent while away is missed.
  useEffect(() => {
    if (!myAuthId || !storageKey) return;
    let ids = [];
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (saved?.openChats?.length) {
        ids = saved.openChats.slice(0, 2).map((w) => String(w.id));
        setOpenChats(saved.openChats.slice(0, 2));
      }
      if (saved?.threads) {
        const trimmed = {};
        Object.entries(saved.threads).forEach(([id, msgs]) => {
          trimmed[id] = (msgs || []).slice(-50);
        });
        setThreads(trimmed);
      }
    } catch {
      // corrupted cache — start fresh
    }
    ids.forEach(async (id) => {
      try {
        const res = await api.get(`/conversations/${id}/messages`);
        setThreads((prev) => ({ ...prev, [id]: res.data.data || [] }));
      } catch {
        // ignore
      }
    });
  }, [myAuthId, storageKey]);

  // Persist on every change.
  useEffect(() => {
    if (!myAuthId || !storageKey) return;
    try {
      const trimmed = {};
      Object.entries(threads).forEach(([id, msgs]) => {
        trimmed[id] = (msgs || []).slice(-50);
      });
      localStorage.setItem(storageKey, JSON.stringify({ openChats: openChats.slice(0, 2), threads: trimmed }));
    } catch {
      // storage full — ignore
    }
  }, [openChats, threads, myAuthId, storageKey]);

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
      setThreads((prev) => {
        const current = prev[conversationId] || [];
        // Skip socket echo of our own optimistic bubble.
        const last = current[current.length - 1];
        if (from === 'me' && last?.from === 'me' && last?.text === message.text) {
          // Backfill the real id so edit/unsend works on it.
          if (!last._id && message._id) {
            return { ...prev, [conversationId]: [...current.slice(0, -1), { ...last, _id: message._id }] };
          }
          return prev;
        }
        return { ...prev, [conversationId]: [...current, { _id: message._id, from, text: message.text, attachment: message.attachment || null }] };
      });
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
    const onEdited = ({ conversationId, message }) => {
      setThreads((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] || []).map((m) =>
          String(m._id) === String(message._id) ? { ...m, text: message.text, edited: true } : m
        ),
      }));
    };
    const onUnsent = ({ conversationId, messageId }) => {
      setThreads((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] || []).map((m) =>
          String(m._id) === String(messageId) ? { ...m, text: '', unsent: true } : m
        ),
      }));
    };
    socket.on('message:new', onNew);
    socket.on('message:edited', onEdited);
    socket.on('message:unsent', onUnsent);
    return () => {
      socket.off('message:new', onNew);
      socket.off('message:edited', onEdited);
      socket.off('message:unsent', onUnsent);
    };
  }, []);

  const loadThread = useCallback(async (convoId) => {
    if (!convoId || convoId === 'undefined') return;
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

  const sendChat = useCallback(async (id, text, attachment = null) => {
    // Optimistic bubble; server push confirms to all tabs.
    setThreads((prev) => ({ ...prev, [id]: [...(prev[id] || []), { from: 'me', text, attachment }] }));
    try {
      await api.post(`/conversations/${id}/messages`, { text, attachment });
      setConvos((prev) =>
        prev.map((c) =>
          String(c._id) === String(id)
            ? { ...c, preview: text || (attachment?.kind === 'image' ? '📷 Photo' : '📎 File'), time: new Date().toISOString() }
            : c
        )
      );
    } catch {
      // keep optimistic bubble; refresh on next load
    }
  }, []);

  const editChatMessage = useCallback(async (convoId, msgId, text) => {
    setThreads((prev) => ({
      ...prev,
      [convoId]: (prev[convoId] || []).map((m) =>
        String(m._id) === String(msgId) ? { ...m, text, edited: true } : m
      ),
    }));
    try {
      await api.put(`/conversations/messages/${msgId}`, { text });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Cannot edit message', 'error');
      loadThread(convoId);
    }
  }, [loadThread]);

  const unsendChatMessage = useCallback(async (convoId, msgId) => {
    setThreads((prev) => ({
      ...prev,
      [convoId]: (prev[convoId] || []).map((m) =>
        String(m._id) === String(msgId) ? { ...m, text: '', unsent: true } : m
      ),
    }));
    try {
      await api.delete(`/conversations/messages/${msgId}`);
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Cannot unsend message', 'error');
      loadThread(convoId);
    }
  }, [loadThread]);

  const createGroupChat = useCallback(async (name, emails) => {
    try {
      const res = await api.post('/conversations/group', { name, emails });
      await refreshConvos();
      return res.data.data;
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Cannot create group', 'error');
      return null;
    }
  }, [refreshConvos]);

  const unreadTotal = convos.reduce((sum, c) => sum + (c.unread || 0), 0);

  return (
    <ChatContext.Provider
      value={{
        convos, threads, openChat, openChatByEmail, refreshConvos, loadThread,
        sendChat, editChatMessage, unsendChatMessage, createGroupChat, unreadTotal,
      }}
    >
      {children}
      <ChatDock
        windows={openChats}
        threads={threads}
        onClose={closeChat}
        onToggleMin={toggleMinChat}
        onSend={sendChat}
        onEdit={editChatMessage}
        onUnsend={unsendChatMessage}
      />
      <CallManager
        getDisplayName={(authId, email) => {
          const found = convos.find((c) =>
            !c.isGroup && (String(c.authId) === String(authId) || c.email === email)
          );
          return found?.name || email;
        }}
      />
    </ChatContext.Provider>
  );
};

export const useChat = () => useContext(ChatContext);
