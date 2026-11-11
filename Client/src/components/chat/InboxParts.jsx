import ContentSkeleton from "../ui/Skeleton";
import { useChat } from "../../context/useChat";
import { useEffect, useRef, useState } from "react";
import {
  Search,
  Send,
  ArrowLeft,
  MessageSquareOff,
  MessageSquare,
  Users,
  Plus,
  Check,
  Smile,
  Phone,
  Video,
  ImagePlus,
  Paperclip,
} from "lucide-react";
import { useAuth } from "../../context/useAuth";
import api from "../../utils/axios";
import { formatTime } from "./messageFormat";
import MessageThread from "./MessageThread";
import EmojiPicker from "./LazyEmojiPicker";
import ChatAvatar from "./ChatAvatar";
import PresenceBadge from './PresenceBadge';
import { presenceLabel, presenceTextColor } from './presenceStatus';
import ConversationActions from './ConversationActions';
import ComposerEditNotice from './ComposerEditNotice';
import ComposerImagePreview from './ComposerImagePreview';
import GroupOptions from "./GroupOptions";
import GroupCallButtons from "../call/GroupCallButtons";
import { FeedDialog } from "../feed/FeedComposer";

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
          api.get("/connections/me"),
          api.get("/users"),
        ]);
        const byEmail = new Map(
          (usersRes.data.data || []).map((u) => [u.email, u]),
        );
        const seen = new Set();
        const list = (connsRes.data.data || [])
          // only accepted connections (adjust if your status field is named differently)
          .filter((c) => !c.status || c.status === "accepted")
          .map((c) =>
            c.requesterEmail === user?.email
              ? c.recipientEmail
              : c.requesterEmail,
          )
          .filter((email) => email && !seen.has(email) && seen.add(email))
          .map((email) => ({ email, name: byEmail.get(email)?.name || email }));
        if (!cancelled) setPeople(list);
      } catch {
        if (!cancelled) setPeople([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, user?.email]);

  return { people, loading };
};


const GroupModal = ({
  groupName,
  setGroupName,
  groupEmails,
  setGroupEmails,
  groupSaving,
  submitGroup,
  onClose,
}) => {
  const { people, loading } = useConnectedPeople(true);

  const toggle = (email) =>
    setGroupEmails((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email],
    );

  return (
    <FeedDialog
      title="New group chat"
      onClose={onClose}
      busy={groupSaving}
      header={<div className="flex items-center gap-2 text-[15px] font-bold"><Users className="h-4 w-4 text-brand" /><h3>New group chat</h3></div>}
    >
        <p className="mt-0.5 text-[12px] text-zinc-500 dark:text-zinc-400">
          3 or more connects can chat together. Add at least 2 connected Sieles.
        </p>
        <form onSubmit={submitGroup} className="mt-4 space-y-2.5">
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Group name (e.g. Batch 2019)"
            className="h-10 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 text-[13px] text-zinc-800 dark:text-zinc-100 outline-none focus:border-brand"
          />

          <div className="flex items-center justify-between px-1 pt-1">
            <span className="text-[12px] font-bold text-zinc-700 dark:text-zinc-200">
              Your connections
            </span>
            <span className="text-[11px] text-zinc-400">
              {groupEmails.length} selected
            </span>
          </div>

          <ul className="max-h-60 space-y-1 overflow-y-auto overscroll-contain rounded-xl border border-zinc-200 dark:border-zinc-700 p-1.5">
            {loading && (
              <ContentSkeleton variant="list" count={3} label="Loading connections..." as="li" />
            )}
            {!loading && people.length === 0 && (
              <li className="py-6 text-center text-[12px] text-zinc-400">
                No connections yet.
              </li>
            )}
            {people.map((p) => {
              const added = groupEmails.includes(p.email);
              return (
                <li
                  key={p.email}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 dark:bg-brand/20 text-[13px] font-bold text-brand dark:text-brand">
                    {(p.name || "A").charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold text-zinc-900 dark:text-zinc-100">
                      {p.name}
                    </span>
                    <span className="block truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                      {p.email}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => toggle(p.email)}
                    className={`flex shrink-0 items-center gap-1 rounded-full px-3.5 py-1.5 text-[12px] font-bold transition ${
                      added
                        ? "bg-brand text-white hover:bg-brand"
                        : "border border-brand text-brand hover:bg-brand/10 dark:border-brand dark:text-brand"
                    }`}
                  >
                    {added ? (
                      <>
                        <Check className="h-3.5 w-3.5" /> Added
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" /> Add
                      </>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={groupSaving}
              onClick={onClose}
              className="h-10 flex-1 rounded-xl border border-zinc-200 dark:border-zinc-700 text-[13px] font-bold text-zinc-600 dark:text-zinc-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={groupSaving || groupEmails.length < 2}
              className="h-10 flex-1 rounded-xl bg-brand text-[13px] font-bold text-white hover:bg-brand disabled:opacity-50"
            >
              {groupSaving ? "Creating..." : "Create group"}
            </button>
          </div>
        </form>
    </FeedDialog>
  );
};

const ConvoList = ({
  conversationsLoading = false,
  workspace = false,
  chatFilter,
  setChatFilter,
  filtered,
  activeId,
  setActiveId,
  query,
  setQuery,
  groupOpen,
  setGroupOpen,
  groupName,
  setGroupName,
  groupEmails,
  setGroupEmails,
  groupSaving,
  submitGroup,
  closeGroup,
}) => (
  // min-h-0 + overflow-hidden: lets the list below shrink and scroll instead of growing the page
  <div className="inbox-conversations flex h-full min-h-0 flex-col overflow-hidden bg-white dark:bg-zinc-900">
    {workspace && (
      <div className="inbox-titlebar">
        <h1>Messages</h1>
        <button
          type="button"
          onClick={() => setGroupOpen(true)}
          aria-label="New group chat"
          title="New group chat"
        >
          <Plus size={20} />
        </button>
      </div>
    )}
    <div
      className="inbox-filters flex gap-2 px-3 pt-3"
      role="group"
      aria-label="Conversation filters"
    >
      {[
        ["all", "All chats"],
        ["groups", "Groups"],
      ].map(([value, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={chatFilter === value}
          onClick={() => setChatFilter(value)}
          className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold ${chatFilter === value ? "bg-brand text-white" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"}`}
        >
          {workspace &&
            (value === "groups" ? (
              <Users size={16} />
            ) : (
              <MessageSquare size={16} />
            ))}
          {label}
        </button>
      ))}
    </div>
    <div className="inbox-search shrink-0 border-b border-zinc-100 dark:border-zinc-800 p-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search messages..."
          className="h-10 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 pl-9 pr-3 text-[12.5px] text-zinc-800 dark:text-zinc-100 outline-none transition focus:border-brand focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-brand/15"
        />
      </div>
      {!workspace && (
        <button
          type="button"
          onClick={() => setGroupOpen(true)}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-600 py-2 text-[12px] font-bold text-zinc-500 dark:text-zinc-400 transition hover:border-brand hover:text-brand"
        >
          <Plus className="h-3.5 w-3.5" />
          New group chat
        </button>
      )}
    </div>
    {workspace && (
      <div className="inbox-section-label">
        <span>
          {chatFilter === "groups" ? "Group conversations" : "Conversations"}
        </span>
      </div>
    )}
    <ul className="inbox-conversation-list min-h-0 max-h-[calc(100vh-16rem)] flex-1 overflow-y-auto overscroll-contain p-1.5">
      {conversationsLoading && <ContentSkeleton as="li" label="Loading conversations" count={5} />}
      {filtered.map((c) => {
        const isActive = String(activeId) === String(c._id);
        return (
          <li key={c._id}>
            <div className="inbox-conversation-row flex min-w-0 items-center">
            <button
              type="button"
              onClick={() => setActiveId(String(c._id))}
              aria-pressed={isActive}
              className="inbox-conversation-item flex min-w-0 flex-1 items-center gap-3 rounded-xl bg-transparent px-3 py-2.5 text-left transition"
            >
              <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand/10 dark:bg-brand/20 text-sm font-bold text-brand dark:text-brand">
                <ChatAvatar convo={c} />
                {!c.isGroup && <PresenceBadge status={c.presenceStatus} />}
                {c.unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-white dark:ring-zinc-900">
                    {c.unread}
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className={`truncate text-[13px] text-zinc-900 dark:text-zinc-100 ${c.unread > 0 ? "font-bold" : "font-medium"}`}>
                    {c.name}
                  </span>
                  <span className={`shrink-0 text-[10.5px] ${c.unread > 0 ? "font-bold text-zinc-700 dark:text-zinc-200" : "font-normal text-zinc-400 dark:text-zinc-500"}`}>
                    {formatTime(c.previewAt === undefined ? c.time : c.previewAt)}
                  </span>
                </span>
                <span
                  className={`block truncate text-[11.5px] ${c.unread > 0 ? "font-bold text-zinc-900 dark:text-zinc-100" : "font-normal text-zinc-500 dark:text-zinc-400"}`}
                >
                  {c.preview || "No received messages yet"}
                </span>
              </span>
            </button>
            <ConversationActions conversation={c} onDeleted={() => { if (String(activeId) === String(c._id)) setActiveId(null); }} />
            </div>
          </li>
        );
      })}
      {!conversationsLoading && filtered.length === 0 && (
        <li className="flex flex-col items-center p-8 text-center">
          <MessageSquareOff className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
          <p className="mt-2 text-[12.5px] font-semibold text-zinc-500 dark:text-zinc-400">
            {chatFilter === "groups"
              ? "No groups found"
              : "No conversations yet"}
          </p>
          <p className="text-[11.5px] text-zinc-400 dark:text-zinc-500">
            {chatFilter === "groups"
              ? "Groups you join will appear here. You can also create a new group."
              : "Visit someone's profile and press Message."}
          </p>
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
  workspace = false,
  active,
  activeId,
  setActiveId,
  threads,
  draft,
  composer,
  setDraft,
  send,
  showEmoji,
  setShowEmoji,
  unsendChatMessage,
  sendFile,
}) => {
  const { user } = useAuth();
  const { threadLoading } = useChat();
  const messages = threads[activeId] || [];
  const { bindInput } = composer;
  const scrollRef = useRef(null);
  const emojiWrapRef = useRef(null);

  // Keep the newest message in view when switching chats or when a message arrives.
  // (Hooks must stay above the early return below.)
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, activeId]);

  // Close the emoji picker on outside click or Escape (emoji-picker-react has no onClose prop).
  useEffect(() => {
    if (!showEmoji) return undefined;
    const onDown = (e) => {
      if (emojiWrapRef.current && !emojiWrapRef.current.contains(e.target))
        setShowEmoji(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setShowEmoji(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [showEmoji, setShowEmoji]);

  if (!active) {
    return (
      <div className="inbox-empty hidden flex-1 flex-col items-center justify-center gap-2 bg-zinc-50/50 dark:bg-zinc-950/50 p-8 text-center md:flex">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-zinc-800 text-brand dark:text-brand">
          <Send className="h-6 w-6" />
        </span>
        <p className="text-[14px] font-bold text-zinc-700 dark:text-zinc-200">
          Your messages
        </p>
        <p className="max-w-[240px] text-[12px] text-zinc-400 dark:text-zinc-500">
          Select a conversation to start messaging.
        </p>
      </div>
    );
  }

  return (
    // min-h-0 + overflow-hidden: the messages area below becomes the scroll container
    <div className="inbox-thread flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-white dark:bg-zinc-900">
      <div className="inbox-thread-header flex shrink-0 items-center gap-2.5 border-b border-zinc-100 dark:border-zinc-800 px-4 py-3">
        <button
          type="button"
          onClick={() => setActiveId(null)}
          className="rounded-lg p-1.5 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 md:hidden"
          aria-label="Back to conversations"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 dark:bg-brand/20 text-sm font-bold text-brand dark:text-brand">
          <ChatAvatar convo={active} />
          {!active.isGroup && <PresenceBadge status={active.presenceStatus} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-bold text-zinc-900 dark:text-zinc-100">
            {active.name}
          </span>
          <span className={`block text-[11px] font-medium ${active.isGroup ? 'text-zinc-500 dark:text-zinc-400' : presenceTextColor(active.presenceStatus)}`}>
            {active.isGroup ? 'Group conversation' : presenceLabel(active.presenceStatus)}
          </span>
        </span>
        {active.isGroup && <GroupOptions key={active._id} conversation={active} />}
        <GroupCallButtons conversation={active} />
        {!active.isGroup && active.authId && !active.blocked && (
          <span className="flex shrink-0 gap-0.5">
            <button
              type="button"
              onClick={() =>
                window.__startCall?.(active.authId, active.name, "voice")
              }
              className="rounded-full p-2 text-zinc-500 dark:text-zinc-400 transition hover:bg-emerald-50 dark:hover:bg-zinc-800 hover:text-brand"
              aria-label="Voice call"
              title="Voice call"
            >
              <Phone className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                window.__startCall?.(active.authId, active.name, "video")
              }
              className="rounded-full p-2 text-zinc-500 dark:text-zinc-400 transition hover:bg-emerald-50 dark:hover:bg-zinc-800 hover:text-brand"
              aria-label="Video call"
              title="Video call"
            >
              <Video className="h-4 w-4" />
            </button>
          </span>
        )}
      </div>

      <div
        ref={scrollRef}
        className="inbox-message-list min-h-0 max-h-[calc(100vh-21rem)] flex-1 space-y-2 overflow-y-auto overscroll-contain bg-[#f4f6f4] dark:bg-zinc-950 p-4"
      >
        {(threads[activeId] || threadLoading?.[activeId] === false) && messages.length === 0 && (
          <p className="py-8 text-center text-[12px] text-zinc-400 dark:text-zinc-500">
            No messages yet — say hello! 👋
          </p>
        )}
        <MessageThread
          messages={messages}
          isGroup={active.isGroup}
          convoId={activeId}
          onEdit={composer.startEdit}
          onUnsend={unsendChatMessage}
          layout={workspace ? "stream" : "bubbles"}
          user={user}
          conversation={active}
        />
      </div>

      {active.blocked ? <p role="status" className="border-t border-border p-4 text-center text-xs text-muted-foreground">
        {active.blockedByMe ? 'You blocked this account. Use the chat options to unblock it.' : 'Messaging is unavailable for this conversation.'}
      </p> : <>
      {composer.editing && <ComposerEditNotice onCancel={composer.cancelEdit} saving={composer.saving} />}
      {!composer.editing && <ComposerImagePreview attachment={composer.attachment} saving={composer.saving} onRemove={composer.removeImage} />}
      <form
        onSubmit={send}
        onPaste={composer.onPaste}
        className="inbox-composer relative flex shrink-0 items-center gap-1.5 border-t border-zinc-100 dark:border-zinc-800 p-3"
      >
        <div ref={emojiWrapRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setShowEmoji(!showEmoji)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-brand"
            aria-label="Add emoji"
            aria-expanded={showEmoji}
          >
            <Smile className="h-4 w-4" />
          </button>
          {showEmoji && (
            // bottom-full = opens upward from the button, like Messenger/Facebook
            <div className="absolute bottom-full left-0 z-30 mb-3 overflow-hidden rounded-2xl shadow-xl">
              <EmojiPicker
                onEmojiClick={(emojiData) =>
                  setDraft((prev) => prev + emojiData.emoji)
                }
                width={320}
                height={360}
                theme="auto"
                lazyLoadEmojis
                previewConfig={{ showPreview: false }}
              />
            </div>
          )}
        </div>
        <label
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-brand"
          title="Send photo"
        >
          <ImagePlus className="h-4 w-4" />
          <input
            type="file"
            disabled={composer.editing || composer.saving}
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) sendFile(e.target.files[0], "image");
              e.target.value = "";
            }}
          />
        </label>
        <label
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-brand"
          title="Attach file"
        >
          <Paperclip className="h-4 w-4" />
          <input
            type="file"
            disabled={composer.editing || composer.saving}
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) sendFile(e.target.files[0], "file");
              e.target.value = "";
            }}
          />
        </label>
        <input
          ref={bindInput}
          value={draft}
          disabled={composer.saving}
          aria-label={composer.editing ? 'Edit message text' : undefined}
          onKeyDown={event => { if (event.key === 'Escape' && composer.editing) { event.preventDefault(); composer.cancelEdit(); } }}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Message ${active.isGroup ? "group" : active.name.split(" ")[0]}...`}
          className="inbox-message-input h-10 min-w-0 flex-1 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 text-[13px] text-zinc-800 dark:text-zinc-100 outline-none transition focus:border-brand focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-brand/15"
        />
        <button
          type="submit"
          disabled={!composer.canSubmit}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-sm transition hover:bg-brand disabled:opacity-40"
          aria-label={composer.editing ? 'Save edit' : 'Send message'}
        >
          <Send className="h-4 w-4" />
        </button>
      </form></>}
    </div>
  );
};

export { ConvoList, ThreadPane };
