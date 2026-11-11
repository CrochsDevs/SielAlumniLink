import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from 'react-router-dom';
import { ChatContext } from "./chat-context.js";
import { gooeyToast as toast } from 'goey-toast';
import api from "../utils/axios";
import { getSocket } from "../realtime/socket";
import { useAuth } from "./useAuth";
import CallManager from "../components/call/CallManager";
import GroupCallProvider from "../components/call/GroupCallProvider";
import { mergeMessageHistory } from '../components/chat/messageDelivery';
import { messageUploadBody } from '../utils/chatAttachments';
import { useChatPresence } from '../realtime/useChatPresence';

const ChatDock = lazy(() => import("../components/chat/ChatDock"));

const toInitial = (name, email) =>
  (name || email || "U").charAt(0).toUpperCase();
const unreadCount = (value) => Math.max(0, Number(value) || 0);

// Real messaging lives here at app root so chat windows survive
// page navigation. Logging out clears the windows and their saved cache.
export const ChatProvider = ({ children }) => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const inMessages = /^\/(?:alumni|student|admin)\/message\/*$/i.test(pathname);
  // Compare against the AUTH id (senderAuthId from the server is the
  // auth-record id, while user._id is the profile id — they differ!).
  const myAuthId = user?.authId
    ? String(user.authId)
    : user?._id
      ? String(user._id)
      : null;
  const myAuthIdRef = useRef(myAuthId);
  myAuthIdRef.current = myAuthId;

  const [convos, setConvos] = useState([]);
  const [convosSettledFor, setConvosSettledFor] = useState(null);
  const [threadLoading, setThreadLoading] = useState({});
  const { contacts, presenceStatus, presenceSaving, setPresenceStatus } = useChatPresence(myAuthId, convos);
  const visibleConvos = convos.map(conversation => conversation.isGroup ? conversation : {
    ...conversation, presenceStatus: contacts[String(conversation.authId)]?.status || 'offline',
  });
  const convosRef = useRef([]);
  useEffect(() => {
    convosRef.current = convos;
  }, [convos]);
  const [openChats, setOpenChats] = useState([]);
  const [threads, setThreads] = useState({});
  const threadsRef = useRef(threads);
  useEffect(() => { threadsRef.current = threads; }, [threads]);
  const clearedThreads = useRef(new Map());
  const threadEpochs = useRef(new Map());
  const listEpoch = useRef(0);
  const pendingRequests = useRef(new Map());
  const receivedReads = useRef(new Set());
  const applyReadReceipt = useCallback(({ conversationId, readerAuthId, messageIds, unread }) => {
    const ids = new Set(messageIds.map(String));
    const mine = String(readerAuthId) === myAuthIdRef.current;
    if (!mine) for (const id of ids) receivedReads.current.add(id);
    while (receivedReads.current.size > 5000) receivedReads.current.delete(receivedReads.current.values().next().value);
    setThreads(previous => previous[conversationId] ? ({ ...previous, [conversationId]: previous[conversationId].map(message => ids.has(String(message._id))
      ? { ...message, ...(mine ? { readByMe: true } : message.from === 'me' ? { read: true } : {}) } : message) }) : previous);
    if (mine && Number.isFinite(unread)) {
      setConvos(previous => previous.map(conversation => String(conversation._id) === String(conversationId)
        ? { ...conversation, unread: unreadCount(unread) } : conversation));
    }
  }, []);
  const markMessagesRead = useCallback(async (id, messageIds) => {
    const response = await api.post(`/conversations/${id}/read`, { messageIds });
    applyReadReceipt(response.data.data);
  }, [applyReadReceipt]);
  const removeGroupLocally = useCallback(({ conversationId }) => {
    const id = String(conversationId);
    setConvos(prev => prev.filter(convo => String(convo._id) !== id));
    setOpenChats(prev => prev.filter(window => String(window.id) !== id));
    setThreads(prev => Object.fromEntries(Object.entries(prev).filter(([key]) => key !== id)));
  }, []);
  const applyConversationDeleted = useCallback(({ conversationId, clearedAt }) => {
    const id = String(conversationId);
    clearedThreads.current.set(id, new Date(clearedAt).getTime());
    threadEpochs.current.set(id, (threadEpochs.current.get(id) || 0) + 1);
    removeGroupLocally({ conversationId: id });
    const owner = myAuthIdRef.current;
    listEpoch.current++;
    pendingRequests.current.delete(`${owner}:/conversations`);
    pendingRequests.current.delete(`${owner}:/conversations/${id}/messages`);
    try {
      if (localStorage.getItem(`messages:last-conversation:${owner}`) === id) localStorage.removeItem(`messages:last-conversation:${owner}`);
    } catch { /* The server remains authoritative when browser storage is blocked. */ }
  }, [removeGroupLocally]);
  const applyConversationUpdated = useCallback(data => {
    listEpoch.current++;
    pendingRequests.current.delete(`${myAuthIdRef.current}:/conversations`);
    setConvos(previous => previous.map(conversation => String(conversation._id) === String(data._id) ? { ...conversation, ...data } : conversation));
  }, []);
  const deleteConversation = useCallback(async id => {
    const response = await api.delete(`/conversations/${id}`);
    applyConversationDeleted(response.data.data);
  }, [applyConversationDeleted]);
  const blockConversation = useCallback(async (id, blocked) => {
    const response = blocked ? await api.post(`/conversations/${id}/block`) : await api.delete(`/conversations/${id}/block`);
    applyConversationUpdated(response.data.data);
  }, [applyConversationUpdated]);
  const getChatData = useCallback((url) => {
    const key = `${myAuthIdRef.current}:${url}`;
    if (pendingRequests.current.has(key))
      return pendingRequests.current.get(key);
    const request = api
      .get(url)
      .finally(() => { if (pendingRequests.current.get(key) === request) pendingRequests.current.delete(key); });
    pendingRequests.current.set(key, request);
    return request;
  }, []);

  const storageKey = myAuthId ? `chatdock:${myAuthId}` : null;

  // Restore open windows + recent threads (survives refresh),
  // then re-sync threads so nothing sent while away is missed.
  useEffect(() => {
    if (!myAuthId || !storageKey) return;
    let ids = [];
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved?.openChats?.length) {
        ids = saved.openChats.slice(0, 2).map((w) => String(w.id));
        setOpenChats(saved.openChats.slice(0, 2));
      }
      if (saved?.threads) {
        const trimmed = {};
        Object.entries(saved.threads).forEach(([id, msgs]) => {
          trimmed[id] = (msgs || []).filter(message => !message.pendingId).slice(-50);
        });
        setThreads(trimmed);
      }
    } catch {
      // corrupted cache — start fresh
    }
    ids.forEach(async (id) => {
      const epoch = threadEpochs.current.get(String(id)) || 0;
      try {
        const res = await getChatData(`/conversations/${id}/messages`);
        if (myAuthIdRef.current !== myAuthId || (threadEpochs.current.get(String(id)) || 0) !== epoch) return;
        setThreads((prev) => ({ ...prev, [id]: mergeMessageHistory(prev[id] || [], res.data.data || []) }));
      } catch (error) {
        if (myAuthIdRef.current === myAuthId && error.response?.status === 404) removeGroupLocally({ conversationId: id });
      }
    });
  }, [myAuthId, storageKey, getChatData, removeGroupLocally]);

  // Persist on every change.
  useEffect(() => {
    if (!myAuthId || !storageKey) return;
    try {
      const trimmed = {};
      Object.entries(threads).forEach(([id, msgs]) => {
        trimmed[id] = (msgs || []).filter(message => !message.pendingId).slice(-50);
      });
      localStorage.setItem(
        storageKey,
        JSON.stringify({ openChats: openChats.slice(0, 2), threads: trimmed }),
      );
    } catch {
      // storage full — ignore
    }
  }, [openChats, threads, myAuthId, storageKey]);

  const refreshConvos = useCallback(async () => {
    const authId = myAuthIdRef.current;
    if (!authId) return;
    const epoch = listEpoch.current;
    try {
      const res = await getChatData("/conversations");
      if (myAuthIdRef.current !== authId || listEpoch.current !== epoch) return;
      const accessible = new Set((res.data.data || []).map(convo => String(convo._id)));
      const removed = new Set(convosRef.current.filter(convo => convo.isGroup && !accessible.has(String(convo._id))).map(convo => String(convo._id)));
      setOpenChats(prev => prev.filter(window => !window.convo?.isGroup || accessible.has(String(window.id))));
      if (removed.size) setThreads(prev => Object.fromEntries(Object.entries(prev).filter(([id]) => !removed.has(id))));
      setConvos(
        (res.data.data || []).map((c) => ({
          ...c,
          unread: unreadCount(c.unread),
          initial: toInitial(c.name, c.email),
        })),
      );
    } catch {
      // stay silent — chat is secondary
    } finally {
      if (myAuthIdRef.current === authId) setConvosSettledFor(authId);
    }
  }, [getChatData]);

  useEffect(() => {
    if (myAuthId) {
      refreshConvos();
    } else {
      setConvos([]);
      setOpenChats([]);
      setThreads({});
    }
  }, [myAuthId, refreshConvos]);

  const applyGroupName = useCallback(({ conversationId, name }) => {
    const update = convo => String(convo._id) === String(conversationId) && convo.isGroup
      ? { ...convo, name, initial: toInitial(name) } : convo;
    setConvos(prev => prev.map(update));
    setOpenChats(prev => prev.map(window => ({ ...window, convo: update(window.convo) })));
  }, []);

  const renameGroupChat = useCallback(async (id, name) => {
    const authId = myAuthIdRef.current;
    const response = await api.patch(`/conversations/${id}/name`, { name });
    if (myAuthIdRef.current === authId) applyGroupName(response.data.data);
  }, [applyGroupName]);

  const applyGroupMembers = useCallback(({ conversationId, memberCount, adminAuthIds, createdBy }) => {
    if (!myAuthIdRef.current) return;
    const update = convo => String(convo._id) === String(conversationId) && convo.isGroup
      ? { ...convo, memberCount, ...(adminAuthIds ? { adminAuthIds, createdBy } : {}) } : convo;
    setConvos(prev => prev.map(update));
    setOpenChats(prev => prev.map(window => ({ ...window, convo: update(window.convo) })));
    // Newly invited members may not have this group in their conversation list.
    void refreshConvos();
  }, [refreshConvos]);

  const addGroupMembers = useCallback(async (id, authIds) => {
    const authId = myAuthIdRef.current;
    const response = await api.post(`/conversations/${id}/members`, { authIds });
    if (myAuthIdRef.current === authId) applyGroupMembers(response.data.data);
    return response.data.data;
  }, [applyGroupMembers]);

  const promoteGroupAdmin = useCallback(async (id, targetId) => {
    const authId = myAuthIdRef.current;
    const response = await api.post(`/conversations/${id}/admins`, { authId: targetId });
    if (myAuthIdRef.current === authId) applyGroupMembers(response.data.data);
    return response.data.data;
  }, [applyGroupMembers]);

  const leaveGroup = useCallback(async id => {
    const authId = myAuthIdRef.current;
    await api.post(`/conversations/${id}/leave`);
    if (myAuthIdRef.current === authId) removeGroupLocally({ conversationId: id });
  }, [removeGroupLocally]);

  const removeGroupMember = useCallback(async (id, targetId) => {
    const authId = myAuthIdRef.current;
    const response = await api.delete(`/conversations/${id}/members/${encodeURIComponent(targetId)}`);
    if (myAuthIdRef.current === authId) applyGroupMembers(response.data.data);
    return response.data.data;
  }, [applyGroupMembers]);

  // Live incoming messages (both participants get pushed).
  useEffect(() => {
    const socket = getSocket();
    const onNew = ({ conversationId, message }) => {
      if (!myAuthIdRef.current) return;
      if (new Date(message.at || message.createdAt).getTime() <= (clearedThreads.current.get(String(conversationId)) || 0)) return;
      const from =
        String(message.senderAuthId) === String(myAuthIdRef.current)
          ? "me"
          : "them";
      // A first message can arrive before this conversation is in our list.
      // Fetch its name and server unread count so it also appears in the badge.
      if (
        !convosRef.current.some((c) => String(c._id) === String(conversationId))
      ) {
        refreshConvos();
      }
      setThreads((prev) => {
        const current = prev[conversationId] || [];
        if (message._id && current.some(item => String(item._id) === String(message._id))) return prev;
        const pending = from === 'me' && message.clientMessageId && current.find(item => item.pendingId === message.clientMessageId);
        if (pending) return { ...prev, [conversationId]: current.map(item => item === pending
          ? { ...item, ...message, from, pendingId: undefined, read: receivedReads.current.has(String(message._id)) || !!item.read } : item) };
        return {
          ...prev,
          [conversationId]: [
            ...current,
            {
              _id: message._id,
              from,
              senderAuthId: message.senderAuthId,
              senderEmail: message.senderEmail,
              senderName: message.senderName,
              senderProfilePicture: message.senderProfilePicture,
              text: message.text,
              at: message.at,
              call: message.call || null,
              activity: message.activity || null,
              attachment: message.attachment || null,
              read: receivedReads.current.has(String(message._id)) || !!message.read,
            },
          ],
        };
      });
      setConvos((prev) =>
        prev.map((c) =>
          c._id === conversationId || String(c._id) === String(conversationId)
            ? {
                ...c,
                ...((from !== 'me' || message.activity) && (!c.previewAt || new Date(message.at) >= new Date(c.previewAt)) ? {
                  preview: message.unsent ? 'Message deleted' : message.text || (message.attachment?.kind === 'image' ? '📷 Photo' : message.attachment?.kind === 'file' ? '📎 File' : ''),
                  previewMessageId: String(message._id), previewAt: message.at,
                } : {}),
                time: message.at,
                unread:
                  from === "me" && !message.activity
                    ? unreadCount(c.unread)
                    : unreadCount(c.unread) + 1,
              }
            : c,
        ),
      );
    };
    const onEdited = ({ conversationId, message }) => {
      setConvos(previous => previous.map(conversation => String(conversation._id) === String(conversationId) && String(conversation.previewMessageId) === String(message._id)
        ? { ...conversation, preview: message.text } : conversation));
      setThreads((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] || []).map((m) =>
          String(m._id) === String(message._id)
            ? { ...m, text: message.text, edited: true }
            : m,
        ),
      }));
    };
    const onUnsent = ({ conversationId, messageId }) => {
      setConvos(previous => previous.map(conversation => String(conversation._id) === String(conversationId) && String(conversation.previewMessageId) === String(messageId)
        ? { ...conversation, preview: 'Message deleted' } : conversation));
      setThreads((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] || []).map((m) =>
          String(m._id) === String(messageId)
            ? { ...m, text: "", unsent: true }
            : m,
        ),
      }));
    };
    const onProfileUpdated = ({ authId, name, profilePicture }) => {
      if (!myAuthIdRef.current || !authId) return;
      setThreads(previous => Object.fromEntries(Object.entries(previous).map(([id, messages]) => [id,
        messages.map(message => String(message.senderAuthId) === String(authId)
          ? { ...message, senderName: name || 'Member', senderProfilePicture: profilePicture || null } : message),
      ])));
      setConvos((prev) =>
        prev.map((convo) =>
          !convo.isGroup && String(convo.authId) === String(authId)
            ? {
                ...convo,
                name,
                profilePicture,
                initial: toInitial(name, convo.email),
              }
            : convo,
        ),
      );
    };
    socket.on("profile:updated", onProfileUpdated);
    socket.on("conversation:renamed", applyGroupName);
    socket.on("conversation:members", applyGroupMembers);
    socket.on("conversation:removed", removeGroupLocally);
    socket.on("conversation:deleted", applyConversationDeleted);
    socket.on("conversation:updated", applyConversationUpdated);
    socket.on("message:new", onNew);
    socket.on("message:read", applyReadReceipt);
    socket.on("message:edited", onEdited);
    socket.on("message:unsent", onUnsent);
    return () => {
      socket.off("profile:updated", onProfileUpdated);
      socket.off("conversation:renamed", applyGroupName);
      socket.off("conversation:members", applyGroupMembers);
      socket.off("conversation:removed", removeGroupLocally);
      socket.off("conversation:deleted", applyConversationDeleted);
      socket.off("conversation:updated", applyConversationUpdated);
      socket.off("message:new", onNew);
      socket.off("message:read", applyReadReceipt);
      socket.off("message:edited", onEdited);
      socket.off("message:unsent", onUnsent);
    };
  }, [refreshConvos, applyGroupName, applyGroupMembers, removeGroupLocally, applyConversationDeleted, applyConversationUpdated, applyReadReceipt]);

  const loadThread = useCallback(
    async (convoId) => {
      if (!convoId || convoId === "undefined") return;
      const authId = myAuthIdRef.current;
      if (!authId) return;
      const epoch = threadEpochs.current.get(String(convoId)) || 0;
      setThreadLoading(previous => ({ ...previous, [convoId]: true }));
      try {
        const res = await getChatData(`/conversations/${convoId}/messages`);
        if (myAuthIdRef.current !== authId || (threadEpochs.current.get(String(convoId)) || 0) !== epoch) return;
        setThreads((prev) => ({ ...prev, [convoId]: mergeMessageHistory(prev[convoId] || [], res.data.data || []) }));
      } catch {
        // ignore
      } finally {
        if (myAuthIdRef.current === authId) setThreadLoading(previous => ({ ...previous, [convoId]: false }));
      }
    },
    [getChatData],
  );

  useEffect(() => {
    const socket = getSocket();
    const reconnect = () => {
      void refreshConvos();
      // Reconcile receipts missed while offline without marking cached chats read.
      for (const id of Object.keys(threadsRef.current)) void loadThread(id);
    };
    socket.on('connect', reconnect);
    return () => socket.off('connect', reconnect);
  }, [refreshConvos, loadThread]);

  // Open a chat window (max 2 — oldest gets replaced).
  const openChat = useCallback(
    (convo) => {
      const id = String(convo._id);
      loadThread(id);
      setOpenChats((prev) => {
        const existing = prev.find((w) => String(w.id) === id);
        if (existing) {
          return prev.map((w) =>
            String(w.id) === id ? { ...w, minimized: false } : w,
          );
        }
        const next = [
          ...prev,
          {
            id,
            convo: {
              ...convo,
              initial: convo.initial || toInitial(convo.name, convo.email),
            },
            minimized: false,
          },
        ];
        return next.length > 2 ? next.slice(next.length - 2) : next;
      });
    },
    [loadThread],
  );

  // Start (or reopen) a chat with someone by email — used by
  // profile Message buttons.
  const openChatByEmail = useCallback(
    async (email) => {
      try {
        const res = await api.post("/conversations", typeof email === 'string' ? { email } : email);
        const convo = {
          ...res.data.data,
          initial: toInitial(res.data.data.name, res.data.data.email),
        };
        listEpoch.current++;
        pendingRequests.current.delete(`${myAuthIdRef.current}:/conversations`);
        setConvos((prev) => {
          const exists = prev.some((c) => String(c._id) === String(convo._id));
          return exists
            ? prev.map((c) => (String(c._id) === String(convo._id) ? convo : c))
            : [convo, ...prev];
        });
        openChat(convo);
        return true;
      } catch (err) {
        toast.error("Error", { description: err.response?.data?.message || "Cannot open chat" });
        return false;
      }
    },
    [openChat],
  );

  const openChatByAuthId = useCallback(authId => openChatByEmail({ recipientAuthId: String(authId) }), [openChatByEmail]);

  const closeChat = useCallback((id) => {
    setOpenChats((prev) => prev.filter((w) => String(w.id) !== String(id)));
  }, []);

  const toggleMinChat = useCallback((id) => {
    setOpenChats((prev) =>
      prev.map((w) =>
        String(w.id) === String(id) ? { ...w, minimized: !w.minimized } : w,
      ),
    );
  }, []);

  const sendChat = useCallback(async (id, text, attachment = null) => {
    if (convosRef.current.find(conversation => String(conversation._id) === String(id))?.blocked) {
      toast.error('Messaging unavailable', { description: 'This conversation is blocked.' });
      return false;
    }
    const pendingId = crypto.randomUUID();
    const owner = myAuthIdRef.current;
    const epoch = threadEpochs.current.get(String(id)) || 0;
    // Optimistic bubble; server push confirms to all tabs.
    setThreads((prev) => ({
      ...prev,
      [id]: [...(prev[id] || []), { from: "me", text,
        attachment: attachment ? { kind: attachment.kind, name: attachment.name, url: attachment.url } : null, pendingId }],
    }));
    try {
      const response = await api.post(`/conversations/${id}/messages`, messageUploadBody(text, pendingId, attachment), { timeout: attachment ? 90000 : 30000 });
      const saved = response.data.data;
      if (myAuthIdRef.current !== owner || (threadEpochs.current.get(String(id)) || 0) !== epoch) return true;
      setThreads(previous => {
        const current = previous[id] || [];
        const exists = current.some(message => String(message._id) === String(saved._id));
        return { ...previous, [id]: current.flatMap(message => message.pendingId === pendingId
          ? exists ? [] : [{ ...message, ...saved, pendingId: undefined, read: receivedReads.current.has(String(saved._id)) || !!saved.read }]
          : message) };
      });
      setConvos((prev) =>
        prev.map((c) =>
          String(c._id) === String(id)
            ? {
                ...c,
                time: new Date().toISOString(),
              }
            : c,
        ),
      );
      return true;
    } catch (error) {
      setThreads(previous => ({ ...previous, [id]: (previous[id] || []).filter(message => message.pendingId !== pendingId) }));
      toast.error('Message not sent', { description: error.response?.data?.message || 'Unable to send this message.' });
      return false;
    }
  }, []);

  const editChatMessage = useCallback(
    async (convoId, msgId, text) => {
      setThreads((prev) => ({
        ...prev,
        [convoId]: (prev[convoId] || []).map((m) =>
          String(m._id) === String(msgId) ? { ...m, text, edited: true } : m,
        ),
      }));
      try {
        await api.put(`/conversations/messages/${msgId}`, { text });
        return true;
      } catch (err) {
        toast.error("Error", { description: err.response?.data?.message || "Cannot edit message" });
        loadThread(convoId);
        return false;
      }
    },
    [loadThread],
  );

  const unsendChatMessage = useCallback(
    async (convoId, msgId) => {
      setThreads((prev) => ({
        ...prev,
        [convoId]: (prev[convoId] || []).map((m) =>
          String(m._id) === String(msgId)
            ? { ...m, text: "", unsent: true }
            : m,
        ),
      }));
      try {
        await api.delete(`/conversations/messages/${msgId}`);
      } catch (err) {
        toast.error("Error", { description: err.response?.data?.message || "Cannot unsend message" });
        loadThread(convoId);
      }
    },
    [loadThread],
  );

  const createGroupChat = useCallback(
    async (name, emails) => {
      try {
        const res = await api.post("/conversations/group", { name, emails });
        await refreshConvos();
        return res.data.data;
      } catch (err) {
        toast.error("Error", { description: err.response?.data?.message || "Cannot create group" });
        return null;
      }
    },
    [refreshConvos],
  );

  const unreadTotal = convos.reduce((sum, c) => sum + unreadCount(c.unread), 0);

  return (
    <ChatContext.Provider
      value={{
        convos: visibleConvos,
        conversationsLoading: !!myAuthId && convosSettledFor !== myAuthId,
        threadLoading,
        presenceStatus,
        presenceSaving,
        setPresenceStatus,
        threads,
        openChat,
        openChatByEmail,
        openChatByAuthId,
        refreshConvos,
        loadThread,
        markMessagesRead,
        sendChat,
        editChatMessage,
        unsendChatMessage,
        createGroupChat,
        blockConversation,
        deleteConversation,
        renameGroupChat,
        addGroupMembers,
        promoteGroupAdmin,
        leaveGroup,
        removeGroupMember,
        unreadTotal,
      }}
    >
      <GroupCallProvider key={myAuthId || "signed-out"} user={user}>
      {children}
      {!inMessages && openChats.length > 0 && <Suspense fallback={null}><ChatDock
        windows={openChats.map((window) => ({
          ...window,
          convo:
            visibleConvos.find((convo) => String(convo._id) === String(window.id)) ||
            window.convo,
        }))}
        threads={threads}
        onClose={closeChat}
        onToggleMin={toggleMinChat}
        onSend={sendChat}
        onEdit={editChatMessage}
        onUnsend={unsendChatMessage}
      /></Suspense>}
      <CallManager
        getProfilePicture={(authId, email) => {
          const found = convos.find(conversation => !conversation.isGroup && (
            String(conversation.authId) === String(authId) ||
            (email && conversation.email === email)
          ));
          return found?.profilePicture || null;
        }}
        getDisplayName={(authId, email) => {
          const found = convos.find(
            (c) =>
              !c.isGroup &&
              (String(c.authId) === String(authId) || c.email === email),
          );
          return found?.name || email;
        }}
      />
      </GroupCallProvider>
    </ChatContext.Provider>
  );
};
