import { useEffect, useState } from 'react';
import { Search, Send, ArrowLeft, MessageSquareOff } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { formatTime } from './messageFormat';

const useInboxPage = () => {
  const { convos, threads, loadThread, sendChat, refreshConvos } = useChat();
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');

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

  return { activeId, setActiveId, draft, setDraft, query, setQuery, active, filtered, threads, send };
};

const ConvoList = ({ filtered, activeId, setActiveId, query, setQuery }) => (
  <div className="flex h-full flex-col">
    <div className="border-b border-zinc-100 p-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search messages..."
          className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-[12.5px] outline-none transition focus:border-[#009639] focus:bg-white focus:ring-2 focus:ring-[#009639]/15"
        />
      </div>
    </div>
    <ul className="flex-1 overflow-y-auto">
      {filtered.map((c) => (
        <li key={c._id}>
          <button
            type="button"
            onClick={() => setActiveId(String(c._id))}
            className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
              String(activeId) === String(c._id) ? 'bg-emerald-50/70' : 'hover:bg-zinc-50'
            }`}
          >
            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#009639]/10 text-sm font-bold text-[#009639]">
              {c.initial}
              {c.unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-white">
                  {c.unread}
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[13px] font-bold text-zinc-900">{c.name}</span>
                <span className="shrink-0 text-[10.5px] text-zinc-400">{formatTime(c.time)}</span>
              </span>
              <span className="block truncate text-[11.5px] text-zinc-500">{c.preview || 'Start chatting...'}</span>
            </span>
          </button>
        </li>
      ))}
      {filtered.length === 0 && (
        <li className="flex flex-col items-center p-8 text-center">
          <MessageSquareOff className="h-8 w-8 text-zinc-300" />
          <p className="mt-2 text-[12.5px] font-semibold text-zinc-500">No conversations yet</p>
          <p className="text-[11.5px] text-zinc-400">Visit someone's profile and press Message.</p>
        </li>
      )}
    </ul>
  </div>
);

const ThreadPane = ({ active, activeId, setActiveId, threads, draft, setDraft, send }) => {
  if (!active) {
    return (
      <div className="hidden flex-1 items-center justify-center bg-zinc-50/50 md:flex">
        <p className="text-[13px] text-zinc-400">Select a conversation to start messaging.</p>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 border-b border-zinc-100 px-4 py-3">
        <button
          type="button"
          onClick={() => setActiveId(null)}
          className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 md:hidden"
          aria-label="Back to conversations"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#009639]/10 text-sm font-bold text-[#009639]">
          {active.initial}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13.5px] font-bold text-zinc-900">{active.name}</span>
          <span className="block truncate text-[11px] text-zinc-500">{active.email}</span>
        </span>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto bg-[#f8faf8] p-4">
        {(threads[activeId] || []).map((m, i) => (
          <div key={i} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
            <p className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${
              m.from === 'me'
                ? 'rounded-br-md bg-[#009639] text-white'
                : 'rounded-bl-md border border-zinc-100 bg-white text-zinc-800 shadow-sm'
            }`}>
              {m.text}
            </p>
          </div>
        ))}
      </div>

      <form onSubmit={send} className="flex items-center gap-2 border-t border-zinc-100 p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Message ${active.name.split(' ')[0]}...`}
          className="h-10 flex-1 rounded-full border border-zinc-200 bg-zinc-50 px-4 text-[13px] outline-none transition focus:border-[#009639] focus:bg-white focus:ring-2 focus:ring-[#009639]/15"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#009639] text-white transition hover:bg-[#007a2e] disabled:opacity-40"
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
