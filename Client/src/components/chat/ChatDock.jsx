import { useState } from 'react';
import Swal from 'sweetalert2';
import { X, Minus, Send, Smile, Users, ImagePlus, Paperclip } from 'lucide-react';
import MessageBubble from './MessageBubble';
import EmojiPicker from './EmojiPicker';

// Facebook-style floating chat dock — max 2 open windows side by side.
const ChatWindow = ({ id, convo, messages, minimized, onClose, onToggleMin, onSend, onEdit, onUnsend }) => {
  const [draft, setDraft] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    onSend(id, draft.trim());
    setDraft('');
  };

  const sendFile = (file, kind) => {
    if (!file) return;
    if (file.size > 1_500_000) {
      Swal.fire('Error', 'File too large (max 1.5MB for now — Cloudinary coming soon)', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onSend(id, '', { kind: kind === 'image' ? 'image' : 'file', name: file.name, url: String(reader.result || '') });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex w-72 flex-col overflow-hidden rounded-t-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl shadow-zinc-900/10">
      {/* Header */}
      <button
        type="button"
        onClick={onToggleMin}
        className="flex w-full items-center gap-2 bg-white dark:bg-zinc-900 px-3 py-2 text-left shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
      >
        <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#009639]/10 text-[11px] font-bold text-[#009639]">
          {convo.isGroup ? <Users className="h-3.5 w-3.5" /> : convo.initial}
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-zinc-900 bg-[#009639]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-bold text-zinc-800 dark:text-zinc-100">{convo.name}</span>
          <span className="block text-[10px] text-[#009639] dark:text-emerald-300">
            {convo.isGroup ? `${convo.memberCount || ''} members`.trim() || 'Group' : 'Active now'}
          </span>
        </span>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onToggleMin(); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onToggleMin(); } }}
          className="rounded-full p-1.5 text-zinc-400 transition hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700"
          aria-label="Minimize chat"
        >
          <Minus className="h-3.5 w-3.5" />
        </span>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onClose(); } }}
          className="rounded-full p-1.5 text-zinc-400 transition hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700"
          aria-label="Close chat"
        >
          <X className="h-3.5 w-3.5" />
        </span>
      </button>

      {!minimized && (
        <>
          <div className="h-64 space-y-2 overflow-y-auto bg-[#f8faf8] dark:bg-zinc-950 p-3">
            {messages.map((m, i) => (
              <MessageBubble
                key={m._id || i}
                msg={m}
                mine={m.from === 'me'}
                convoId={id}
                onEdit={onEdit}
                onUnsend={onUnsend}
              />
            ))}
          </div>
          <form onSubmit={submit} className="relative flex items-center gap-1 border-t border-zinc-100 dark:border-zinc-800 p-2">
            <button
              type="button"
              onClick={() => setShowEmoji(!showEmoji)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-[#009639]"
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
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-[#009639]"
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
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-[#009639]"
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
              placeholder="Write a message..."
              className="h-9 flex-1 rounded-full bg-zinc-100 dark:bg-zinc-800 px-3.5 text-[12.5px] text-zinc-800 dark:text-zinc-100 outline-none transition focus:bg-zinc-50 dark:focus:bg-zinc-700 focus:ring-2 focus:ring-[#009639]/20"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#009639] transition hover:bg-emerald-50 disabled:opacity-40"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </>
      )}
    </div>
  );
};

const ChatDock = ({ windows, threads, onClose, onToggleMin, onSend, onEdit, onUnsend }) => {
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
