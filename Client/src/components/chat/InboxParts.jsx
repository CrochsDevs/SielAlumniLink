import { useEffect, useState } from 'react';
import { Search, Send, ArrowLeft, MessageSquareOff, Users, Plus, Check, Smile, Phone, Video, ImagePlus, Paperclip } from 'lucide-react';
import Swal from 'sweetalert2';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/useAuth';
import api from '../../utils/axios';
import { formatTime } from './messageFormat';
import MessageBubble from './MessageBubble';
import EmojiPicker from './EmojiPicker';

// Loads only the people the current user is connected with
const useConnectedPeople = (open) => {
  const { user } = useAuth();
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [connsRes, usersRes] = await Promise.all([
          api.get('/connections/me'),
          api.get('/users'),
        ]);
        const byEmail = new Map((usersRes.data.data || []).map((u) => [u.email, u]));
        const seen = new Set();
        const list = (connsRes.data.data || [])
          // only accepted connections (adjust if your status field is named differently)
          .filter((c) => !c.status || c.status === 'accepted')
          .map((c) => (c.requesterEmail === user?.email ? c.recipientEmail : c.requesterEmail))
          .filter((email) => email && !seen.has(email) && seen.add(email))
          .map((email) => ({ email, name: byEmail.get(email)?.name || email }));
        if (!cancelled) setPeople(list);
      } catch {
        if (!cancelled) setPeople([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, user?.email]);

  return { people, loading };
};

const useInboxPage = () => {
  const {
    convos, threads, loadThread, sendChat, refreshConvos,
    editChatMessage, unsendChatMessage, createGroupChat, openChat,
  } = useChat();
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupEmails, setGroupEmails] = useState([]); // now an array
  const [groupSaving, setGroupSaving] = useState(false);

  useEffect(() => {
    refreshConvos();
  }, [refreshConvos]);

  useEffect(() => {
    if (activeId) loadThread(activeId);
  }, [activeId, loadThread]);

  const active = convos.find((c) => String(c._id) === String(activeId));
  const filtered = convos.filter((c) =>
    `${c.name} ${c.email}`.toLowerCase().includes(query.toLowerCase())
  );

  const send = (e) => {
    e.preventDefault();
    if (!draft.trim() || !activeId) return;
    sendChat(activeId, draft.trim());
    setDraft('');
  };

  // Gallery / files ride as inline data URLs until Cloudinary lands
  // (1.5MB cap enforced server-side too).
  const sendFile = (file, kind) => {
    if (!file || !activeId) return;
    if (file.size > 1_500_000) {
      Swal.fire('Error', 'File too large (max 1.5MB for now — Cloudinary coming soon)', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      sendChat(activeId, '', {
        kind: kind === 'image' ? 'image' : 'file',
        name: file.name,
        url: String(reader.result || ''),
      });
    };
    reader.readAsDataURL(file);
  };

  const closeGroup = () => {
    setGroupOpen(false);
    setGroupEmails([]);
    setGroupName('');
  };

  const submitGroup = async (e) => {
    e.preventDefault();
    const emails = groupEmails;
    if (emails.length < 2) {
      Swal.fire('Error', 'Add at least 2 connected Sieles (3+ people total)', 'error');
      return;
    }
    setGroupSaving(true);
    const created = await createGroupChat(groupName.trim() || 'Group Chat', emails);
    setGroupSaving(false);
    if (created) {
      const full = { _id: created._id, name: groupName.trim() || 'Group Chat', isGroup: true, initial: 'G' };
      closeGroup();
      openChat(full);
      setActiveId(String(created._id));
    }
  };

  return {
    activeId, setActiveId, draft, setDraft, query, setQuery, active, filtered, threads, send,
    showEmoji, setShowEmoji, groupOpen, setGroupOpen, groupName, setGroupName,
    groupEmails, setGroupEmails, groupSaving, submitGroup, closeGroup,
    editChatMessage, unsendChatMessage, sendFile,
  };
};

const GroupModal = ({
  groupName, setGroupName, groupEmails, setGroupEmails,
  groupSaving, submitGroup, onClose,
}) => {
  const { people, loading } = useConnectedPeople(true);

  const toggle = (email) =>
    setGroupEmails((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="flex items-center gap-2 text-[15px] font-extrabold text-zinc-900 dark:text-zinc-100">
          <Users className="h-4 w-4 text-[#009639]" />
          New group chat
        </h2>
        <p className="mt-0.5 text-[12px] text-zinc-500 dark:text-zinc-400">
          3 or more connects can chat together. Add at least 2 connected Sieles.
        </p>
        <form onSubmit={submitGroup} className="mt-4 space-y-2.5">
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Group name (e.g. Batch 2019)"
            className="h-10 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 text-[13px] text-zinc-800 dark:text-zinc-100 outline-none focus:border-[#009639]"
          />

          <div className="flex items-center justify-between px-1 pt-1">
            <span className="text-[12px] font-bold text-zinc-700 dark:text-zinc-200">Your connections</span>
            <span className="text-[11px] text-zinc-400">{groupEmails.length} selected</span>
          </div>

          <ul className="max-h-60 space-y-1 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-700 p-1.5">
            {loading && (
              <li className="py-6 text-center text-[12px] text-zinc-400">Loading connections...</li>
            )}
            {!loading && people.length === 0 && (
              <li className="py-6 text-center text-[12px] text-zinc-400">No connections yet.</li>
            )}
            {people.map((p) => {
              const added = groupEmails.includes(p.email);
              return (
                <li key={p.email} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#009639]/10 dark:bg-[#009639]/20 text-[13px] font-bold text-[#009639] dark:text-emerald-300">
                    {(p.name || 'A').charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold text-zinc-900 dark:text-zinc-100">{p.name}</span>
                    <span className="block truncate text-[11px] text-zinc-500 dark:text-zinc-400">{p.email}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => toggle(p.email)}
                    className={`flex shrink-0 items-center gap-1 rounded-full px-3.5 py-1.5 text-[12px] font-bold transition ${added
                        ? 'bg-[#009639] text-white hover:bg-[#007a2e]'
                        : 'border border-[#009639] text-[#009639] hover:bg-[#009639]/10 dark:border-emerald-400 dark:text-emerald-300'
                      }`}
                  >
                    {added ? <><Check className="h-3.5 w-3.5" /> Added</> : <><Plus className="h-3.5 w-3.5" /> Add</>}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="h-10 flex-1 rounded-xl border border-zinc-200 dark:border-zinc-700 text-[13px] font-bold text-zinc-600 dark:text-zinc-300">
              Cancel
            </button>
            <button type="submit" disabled={groupSaving || groupEmails.length < 2}
              className="h-10 flex-1 rounded-xl bg-[#009639] text-[13px] font-bold text-white hover:bg-[#007a2e] disabled:opacity-50">
              {groupSaving ? 'Creating...' : 'Create group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ConvoList = ({
  filtered, activeId, setActiveId, query, setQuery,
  groupOpen, setGroupOpen, groupName, setGroupName,
  groupEmails, setGroupEmails, groupSaving, submitGroup, closeGroup,
}) => (
  <div className="flex h-full flex-col bg-white dark:bg-zinc-900">
    <div className="border-b border-zinc-100 dark:border-zinc-800 p-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search messages..."
          className="h-10 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 pl-9 pr-3 text-[12.5px] text-zinc-800 dark:text-zinc-100 outline-none transition focus:border-[#009639] focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-[#009639]/15"
        />
      </div>
      <button
        type="button"
        onClick={() => setGroupOpen(true)}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-600 py-2 text-[12px] font-bold text-zinc-500 dark:text-zinc-400 transition hover:border-[#009639] hover:text-[#009639]"
      >
        <Plus className="h-3.5 w-3.5" />
        New group chat
      </button>
    </div>
    <ul className="flex-1 overflow-y-auto p-1.5">
      {filtered.map((c) => {
        const isActive = String(activeId) === String(c._id);
        return (
          <li key={c._id}>
            <button
              type="button"
              onClick={() => setActiveId(String(c._id))}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${isActive ? 'bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-200/60 dark:ring-emerald-900' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
            >
              <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#009639]/10 dark:bg-[#009639]/20 text-sm font-bold text-[#009639] dark:text-emerald-300">
                {c.isGroup ? <Users className="h-4 w-4" /> : c.initial}
                {c.unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-white dark:ring-zinc-900">
                    {c.unread}
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[13px] font-bold text-zinc-900 dark:text-zinc-100">
                    {c.name}
                    {c.isGroup && c.memberCount ? <span className="ml-1 font-medium text-zinc-400">• {c.memberCount}</span> : null}
                  </span>
                  <span className="shrink-0 text-[10.5px] font-medium text-zinc-400 dark:text-zinc-500">{formatTime(c.time)}</span>
                </span>
                <span className={`block truncate text-[11.5px] ${c.unread > 0 ? 'font-semibold text-zinc-700 dark:text-zinc-200' : 'text-zinc-500 dark:text-zinc-400'}`}>
                  {c.preview || 'Start chatting...'}
                </span>
              </span>
            </button>
          </li>
        );
      })}
      {filtered.length === 0 && (
        <li className="flex flex-col items-center p-8 text-center">
          <MessageSquareOff className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
          <p className="mt-2 text-[12.5px] font-semibold text-zinc-500 dark:text-zinc-400">No conversations yet</p>
          <p className="text-[11.5px] text-zinc-400 dark:text-zinc-500">Visit someone's profile and press Message.</p>
        </li>
      )}
    </ul>

    {groupOpen && (
      <GroupModal
        groupName={groupName}
        setGroupName={setGroupName}
        groupEmails={groupEmails}
        setGroupEmails={setGroupEmails}
        groupSaving={groupSaving}
        submitGroup={submitGroup}
        onClose={closeGroup}
      />
    )}
  </div>
);

const ThreadPane = ({
  active, activeId, setActiveId, threads, draft, setDraft, send,
  showEmoji, setShowEmoji, editChatMessage, unsendChatMessage, sendFile,
}) => {
  if (!active) {
    return (
      <div className="hidden flex-1 flex-col items-center justify-center gap-2 bg-zinc-50/50 dark:bg-zinc-950/50 p-8 text-center md:flex">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950 text-[#009639] dark:text-emerald-300">
          <Send className="h-6 w-6" />
        </span>
        <p className="text-[14px] font-bold text-zinc-700 dark:text-zinc-200">Your messages</p>
        <p className="max-w-[240px] text-[12px] text-zinc-400 dark:text-zinc-500">
          Select a conversation to start messaging.
        </p>
      </div>
    );
  }
  const messages = threads[activeId] || [];
  return (
    <div className="flex h-full flex-col bg-white dark:bg-zinc-900">
      <div className="flex items-center gap-2.5 border-b border-zinc-100 dark:border-zinc-800 px-4 py-3">
        <button
          type="button"
          onClick={() => setActiveId(null)}
          className="rounded-lg p-1.5 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 md:hidden"
          aria-label="Back to conversations"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#009639]/10 dark:bg-[#009639]/20 text-sm font-bold text-[#009639] dark:text-emerald-300">
          {active.isGroup ? <Users className="h-4 w-4" /> : active.initial}
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-zinc-900 bg-[#009639]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-bold text-zinc-900 dark:text-zinc-100">
            {active.name}
            {active.isGroup && active.memberCount ? <span className="ml-1 font-medium text-zinc-400">• {active.memberCount}</span> : null}
          </span>
          <span className="block text-[11px] font-medium text-[#009639] dark:text-emerald-300">Active now</span>
        </span>
        {!active.isGroup && active.authId && (
          <span className="flex shrink-0 gap-0.5">
            <button
              type="button"
              onClick={() => window.__startCall?.(active.authId, active.name, 'voice')}
              className="rounded-full p-2 text-zinc-500 dark:text-zinc-400 transition hover:bg-emerald-50 dark:hover:bg-zinc-800 hover:text-[#009639]"
              aria-label="Voice call"
              title="Voice call"
            >
              <Phone className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => window.__startCall?.(active.authId, active.name, 'video')}
              className="rounded-full p-2 text-zinc-500 dark:text-zinc-400 transition hover:bg-emerald-50 dark:hover:bg-zinc-800 hover:text-[#009639]"
              aria-label="Video call"
              title="Video call"
            >
              <Video className="h-4 w-4" />
            </button>
          </span>
        )}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto bg-[#f4f6f4] dark:bg-zinc-950 p-4">
        {messages.length === 0 && (
          <p className="py-8 text-center text-[12px] text-zinc-400 dark:text-zinc-500">
            No messages yet — say hello! 👋
          </p>
        )}
        {messages.map((m) => (
          <MessageBubble
            key={m._id || `${m.from}-${m.text}`}
            msg={m}
            mine={m.from === 'me'}
            convoId={activeId}
            onEdit={editChatMessage}
            onUnsend={unsendChatMessage}
          />
        ))}
      </div>

      <form onSubmit={send} className="relative flex items-center gap-1.5 border-t border-zinc-100 dark:border-zinc-800 p-3">
        <button
          type="button"
          onClick={() => setShowEmoji(!showEmoji)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-[#009639]"
          aria-label="Add emoji"
        >
          <Smile className="h-4 w-4" />
        </button>
        {showEmoji && (
          <EmojiPicker
            onPick={(emoji) => setDraft((prev) => prev + emoji)}
            onClose={() => setShowEmoji(false)}
          />
        )}
        <label
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-[#009639]"
          title="Send photo"
        >
          <ImagePlus className="h-4 w-4" />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) sendFile(e.target.files[0], 'image'); e.target.value = ''; }}
          />
        </label>
        <label
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-[#009639]"
          title="Attach file"
        >
          <Paperclip className="h-4 w-4" />
          <input
            type="file"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) sendFile(e.target.files[0], 'file'); e.target.value = ''; }}
          />
        </label>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Message ${active.isGroup ? 'group' : active.name.split(' ')[0]}...`}
          className="h-10 flex-1 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 text-[13px] text-zinc-800 dark:text-zinc-100 outline-none transition focus:border-[#009639] focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-[#009639]/15"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#009639] text-white shadow-sm transition hover:bg-[#007a2e] disabled:opacity-40"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
};

export const useInbox = useInboxPage;
export { ConvoList, ThreadPane };