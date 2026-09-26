import React, { createContext, useCallback, useContext, useState } from 'react';
import ChatDock from '../components/chat/ChatDock';

export const ChatContext = createContext(null);

// TEMPORARY chat data — wire to backend threads later.
const CHAT_CONVOS = [
  {
    id: 1,
    name: 'Maria Santos',
    meta: 'HR Manager • Batch 2015',
    initial: 'M',
    preview: 'Send me your resume when ready!',
    time: '2h',
    unread: 2,
  },
  {
    id: 2,
    name: 'Jose Ramos',
    meta: 'Software Engineer • Batch 2019',
    initial: 'J',
    preview: 'Salamat sa referral!',
    time: '1d',
    unread: 0,
  },
  {
    id: 3,
    name: 'CLSU Career Office',
    meta: 'Official • Career Services',
    initial: 'C',
    preview: 'Homecoming registration is open.',
    time: '3d',
    unread: 0,
  },
];

const INITIAL_THREADS = {
  1: [
    { from: 'them', text: 'Hi! I saw your profile — impressive background.' },
    { from: 'them', text: 'We have an opening you might like. Send me your resume when ready!' },
  ],
  2: [
    { from: 'me', text: 'Good luck sa interview bukas!' },
    { from: 'them', text: 'Salamat sa referral!' },
  ],
  3: [{ from: 'them', text: 'Homecoming registration is now open. See you there!' }],
};

// Lives at app root so chat windows survive page navigation —
// they only close when the user presses X.
export const ChatProvider = ({ children }) => {
  const [openChats, setOpenChats] = useState([]);
  const [threads, setThreads] = useState(INITIAL_THREADS);

  // Open a chat window (max 2 — oldest gets replaced).
  const openChat = useCallback((convo) => {
    setOpenChats((prev) => {
      const existing = prev.find((w) => w.id === convo.id);
      if (existing) {
        return prev.map((w) => (w.id === convo.id ? { ...w, minimized: false } : w));
      }
      const next = [...prev, { id: convo.id, convo, minimized: false }];
      return next.length > 2 ? next.slice(next.length - 2) : next;
    });
  }, []);

  const closeChat = useCallback((id) => {
    setOpenChats((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const toggleMinChat = useCallback((id) => {
    setOpenChats((prev) => prev.map((w) => (w.id === id ? { ...w, minimized: !w.minimized } : w)));
  }, []);

  const sendChat = useCallback((id, text) => {
    setThreads((prev) => ({ ...prev, [id]: [...(prev[id] || []), { from: 'me', text }] }));
  }, []);

  return (
    <ChatContext.Provider value={{ convos: CHAT_CONVOS, openChat }}>
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
