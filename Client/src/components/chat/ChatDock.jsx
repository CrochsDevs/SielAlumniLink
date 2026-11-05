import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { X, Minus, Send, Smile, ImagePlus, Paperclip } from "lucide-react";
import { useMessageComposer } from './useMessageComposer';
import ComposerEditNotice from './ComposerEditNotice';
import ComposerImagePreview from './ComposerImagePreview';
import ChatAvatar from "./ChatAvatar";
import GroupOptions from "./GroupOptions";
import GroupCallButtons from "../call/GroupCallButtons";
import MessageThread from "./MessageThread";
import PresenceBadge from './PresenceBadge';
import { presenceLabel, presenceTextColor } from './presenceStatus';
import EmojiPicker from "emoji-picker-react";
import { Link } from "react-router-dom";
import { profilePath } from "../search/searchLinks";

// Facebook-style floating chat dock — max 2 open windows side by side.
const ChatWindow = ({
  id,
  convo,
  messages,
  minimized,
  onClose,
  onToggleMin,
  onSend,
  onEdit,
  onUnsend,
}) => {
  const composer = useMessageComposer(id, onSend, onEdit);
  const { draft, setDraft, bindInput } = composer;
  const [showEmoji, setShowEmoji] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const profileWrapRef = useRef(null);
  const profileButtonRef = useRef(null);
  const profileUrl =
    !convo.isGroup && convo.profileId
      ? profilePath({ _id: convo.profileId, role: convo.role })
      : null;
  const emojiWrapRef = useRef(null);
  const messageListRef = useRef(null);
  const messageContentRef = useRef(null);
  const followLatestRef = useRef(true);
  const previousMessageCount = useRef(0);

  useEffect(() => {
    if (!showProfile) return;
    const onPointerDown = (event) => {
      if (!profileWrapRef.current?.contains(event.target))
        setShowProfile(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setShowProfile(false);
        profileButtonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showProfile]);

  useLayoutEffect(() => {
    if (minimized) {
      followLatestRef.current = true;
      return;
    }
    const list = messageListRef.current;
    if (!list) return;
    const sentNewMessage =
      messages.length > previousMessageCount.current &&
      messages.at(-1)?.from === "me";
    if (followLatestRef.current || sentNewMessage) {
      followLatestRef.current = true;
      list.scrollTop = list.scrollHeight;
    }
    previousMessageCount.current = messages.length;

    // Images can change the thread height after the messages have rendered.
    const observer = new ResizeObserver(() => {
      if (followLatestRef.current) list.scrollTop = list.scrollHeight;
    });
    if (messageContentRef.current) observer.observe(messageContentRef.current);
    return () => observer.disconnect();
  }, [messages, minimized]);

  useEffect(() => {
    if (!showEmoji) return;
    const onPointerDown = (event) => {
      if (!emojiWrapRef.current?.contains(event.target)) setShowEmoji(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setShowEmoji(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showEmoji]);

  const submit = composer.submit;

  const sendFile = composer.attachFile;

  return (
    <div style={{ '--chat-photo-max-width': '200px', '--chat-photo-max-height': '160px' }} className="relative flex w-[328px] flex-col rounded-t-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-panel">
      {/* Header */}
      <div className="flex w-full items-center gap-2 rounded-t-2xl bg-white dark:bg-zinc-900 px-3 py-2 text-left shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
        <div ref={profileWrapRef} className="relative min-w-0 flex-1">
          <button
            ref={profileButtonRef}
            type="button"
            onClick={() => {
              if (minimized) {
                setShowProfile(false);
                onToggleMin();
              } else if (profileUrl) {
                setShowProfile((open) => !open);
              } else {
                onToggleMin();
              }
            }}
            aria-label={
              minimized
                ? `Restore chat with ${convo.name}`
                : profileUrl
                  ? `Profile options for ${convo.name}`
                  : convo.name
            }
            aria-haspopup={!minimized && profileUrl ? "menu" : undefined}
            aria-expanded={!minimized && profileUrl ? showProfile : undefined}
            className="flex w-full min-w-0 items-center gap-2 rounded-lg bg-transparent text-left"
          >
            <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[11px] font-bold text-brand">
              <ChatAvatar convo={convo} />
              {!convo.isGroup && <PresenceBadge status={convo.presenceStatus} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-bold text-zinc-800 dark:text-zinc-100">
                {convo.name}
              </span>
              <span className={`block text-[10px] ${convo.isGroup ? 'text-zinc-500 dark:text-zinc-400' : presenceTextColor(convo.presenceStatus)}`}>
                {convo.isGroup
                  ? `${convo.memberCount || ""} members`.trim() || "Group"
                  : presenceLabel(convo.presenceStatus)}
              </span>
            </span>
          </button>
          {!minimized && showProfile && profileUrl && (
            <div
              role="menu"
              aria-label="Chat profile options"
              className="absolute left-0 top-full z-50 mt-2 w-44 rounded-xl border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
            >
              <Link
                role="menuitem"
                to={profileUrl}
                onClick={() => setShowProfile(false)}
                className="block rounded-lg px-3 py-2 text-[12px] font-semibold text-zinc-700 hover:bg-emerald-50 hover:text-brand dark:text-zinc-200 dark:hover:bg-emerald-950"
              >
                View profile
              </Link>
            </div>
          )}
        </div>
        {convo.isGroup && <GroupOptions key={convo._id} conversation={convo} />}
        <GroupCallButtons conversation={convo} />
        <button
          type="button"
          onClick={onToggleMin}
          className="rounded-full p-1.5 text-zinc-400 transition hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700"
          aria-label="Minimize chat"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1.5 text-zinc-400 transition hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700"
          aria-label="Close chat"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {!minimized && (
        <>
          <div
            ref={messageListRef}
            role="log"
            aria-label={`Messages with ${convo.name || "User"}`}
            onScroll={(event) => {
              const list = event.currentTarget;
              followLatestRef.current =
                list.scrollHeight - list.scrollTop - list.clientHeight < 40;
            }}
            className="chat-dock-message-list h-[min(340px,calc(100dvh-140px))] overflow-y-auto bg-[#f8faf8] dark:bg-zinc-950 px-2 py-4"
          >
            <div ref={messageContentRef}>
              <MessageThread messages={messages} isGroup={convo.isGroup} conversation={convo} convoId={id} onEdit={composer.startEdit} onUnsend={onUnsend} />
            </div>
          </div>
          {convo.blocked ? <p role="status" className="border-t border-border p-3 text-center text-xs text-muted-foreground">Messaging is unavailable for this conversation.</p> : <>
          {composer.editing && <ComposerEditNotice onCancel={composer.cancelEdit} saving={composer.saving} />}
          {!composer.editing && <ComposerImagePreview attachment={composer.attachment} saving={composer.saving} onRemove={composer.removeImage} />}
          <form
            onSubmit={submit}
            onPaste={composer.onPaste}
            className="relative flex items-center gap-1 border-t border-zinc-100 dark:border-zinc-800 p-2"
          >
            <div ref={emojiWrapRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setShowEmoji((value) => !value)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-brand"
                aria-label="Add emoji"
                aria-expanded={showEmoji}
              >
                <Smile className="h-4 w-4" />
              </button>
              {showEmoji && (
                <div className="absolute bottom-full left-0 z-50 mb-3 overflow-hidden rounded-2xl shadow-xl">
                  <EmojiPicker
                    onEmojiClick={(emojiData) =>
                      setDraft((previous) => previous + emojiData.emoji)
                    }
                    width={272}
                    height="min(360px, calc(100dvh - 100px))"
                    theme="auto"
                    lazyLoadEmojis
                    previewConfig={{ showPreview: false }}
                  />
                </div>
              )}
            </div>
            <label
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-brand"
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
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-brand"
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
              placeholder="Write a message..."
              className="h-9 min-w-0 flex-1 rounded-full bg-zinc-100 dark:bg-zinc-800 px-3.5 text-[12.5px] text-zinc-800 dark:text-zinc-100 outline-none transition focus:bg-zinc-50 dark:focus:bg-zinc-700 focus:ring-2 focus:ring-brand/20"
            />
            <button
              type="submit"
              disabled={!composer.canSubmit}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-brand transition hover:bg-emerald-50 disabled:opacity-40"
              aria-label={composer.editing ? 'Save edit' : 'Send message'}
            >
              <Send className="h-4 w-4" />
            </button>
          </form></>}
        </>
      )}
    </div>
  );
};

const ChatDock = ({
  windows,
  threads,
  onClose,
  onToggleMin,
  onSend,
  onEdit,
  onUnsend,
}) => {
  if (windows.length === 0) return null;
  return (
    <div className="fixed bottom-0 right-4 z-40 hidden items-end gap-3 md:flex">
      {windows.map((w) => (
        <ChatWindow
          key={w.id}
          id={w.id}
          convo={w.convo}
          messages={threads[w.id] || []}
          minimized={w.minimized}
          onClose={() => onClose(w.id)}
          onToggleMin={() => onToggleMin(w.id)}
          onSend={onSend}
          onEdit={onEdit}
          onUnsend={onUnsend}
        />
      ))}
    </div>
  );
};

export default ChatDock;
