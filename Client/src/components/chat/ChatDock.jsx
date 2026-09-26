import { useState } from 'react';
import { X, Minus, Send } from 'lucide-react';

// Facebook-style floating chat dock — max 2 open windows side by side.
// TEMPORARY data — wire to backend (threads/messages) later.
const ChatWindow = ({ convo, messages, minimized, onClose, onToggleMin, onSend }) => {
  const [draft, setDraft] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    onSend(convo.id, draft.trim());
    setDraft('');
  };

  return (
    <div className="flex w-72 flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl shadow-zinc-900/10">
      {/* Header */}
      <button
        type="button"
        onClick={onToggleMin}
        className="flex w-full items-center gap-2 bg-white px-3 py-2 text-left shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
      >
        <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#009639]/10 text-[11px] font-bold text-[#009639]">
          {convo.initial}
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#009639]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-bold text-zinc-800">{convo.name}</span>
          <span className="block text-[10px] text-[#009639]">Active now</span>
        </span>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onToggleMin(); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onToggleMin(); } }}
          className="rounded-full p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
          aria-label="Minimize chat"
        >
          <Minus className="h-3.5 w-3.5" />
        </span>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onClose(); } }}
          className="rounded-full p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
          aria-label="Close chat"
        >
          <X className="h-3.5 w-3.5" />
        </span>
      </button>

      {!minimized && (
        <>
          <div className="h-64 space-y-2 overflow-y-auto bg-[#f8faf8] p-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
                <p className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-[12.5px] leading-relaxed ${
                  m.from === 'me'
                    ? 'rounded-br-md bg-[#009639] text-white'
                    : 'rounded-bl-md border border-zinc-100 bg-white text-zinc-800 shadow-sm'
                }`}>
                  {m.text}
                </p>
              </div>
            ))}
          </div>
          <form onSubmit={submit} className="flex items-center gap-1.5 border-t border-zinc-100 p-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write a message..."
              className="h-9 flex-1 rounded-full bg-zinc-100 px-3.5 text-[12.5px] outline-none transition focus:bg-zinc-50 focus:ring-2 focus:ring-[#009639]/20"
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

const ChatDock = ({ windows, threads, onClose, onToggleMin, onSend }) => {
  if (windows.length === 0) return null;
  return (
    <div className="fixed bottom-0 right-4 z-40 hidden items-end gap-3 md:flex">
      {windows.map((w) => (
        <ChatWindow
          key={w.id}
          convo={w.convo}
          messages={threads[w.id] || []}
          minimized={w.minimized}
          onClose={() => onClose(w.id)}
          onToggleMin={() => onToggleMin(w.id)}
          onSend={onSend}
        />
      ))}
    </div>
  );
};

export default ChatDock;
