import { useState } from 'react';
import { Search, Send, ArrowLeft, BadgeCheck } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import AlumniSidebar from '../../layout/sidebar/alumni/alumniSidebar';
import AlumniTopbar from '../../layout/topbar/alumni/alumniTopbar';

// TEMPORARY content — papalitan ng totoong data mula sa API.
// TODO(alumni): wire conversations/messages to backend endpoints.
const CONVERSATIONS = [
  {
    id: 1,
    name: 'Maria Santos',
    meta: 'HR Manager • Batch 2015',
    initial: 'M',
    preview: 'Send me your resume when ready!',
    time: '2h',
    unread: 2,
    messages: [
      { from: 'them', text: 'Hi! I saw your profile — impressive background.' },
      { from: 'them', text: 'We have an opening you might like. Send me your resume when ready!' },
    ],
  },
  {
    id: 2,
    name: 'Jose Ramos',
    meta: 'Software Engineer • Batch 2019',
    initial: 'J',
    preview: 'Salamat sa referral!',
    time: '1d',
    unread: 0,
    messages: [
      { from: 'me', text: 'Good luck sa interview bukas!' },
      { from: 'them', text: 'Salamat sa referral!' },
    ],
  },
  {
    id: 3,
    name: 'CLSU Career Office',
    meta: 'Official • Career Services',
    initial: 'C',
    preview: 'Homecoming registration is open.',
    time: '3d',
    unread: 0,
    messages: [
      { from: 'them', text: 'Homecoming registration is now open. See you there!' },
    ],
  },
];

const AlumniMessage = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeId, setActiveId] = useState(CONVERSATIONS[0].id);
  const [draft, setDraft] = useState('');
  const [threads, setThreads] = useState(
    Object.fromEntries(CONVERSATIONS.map((c) => [c.id, c.messages]))
  );
  const [query, setQuery] = useState('');

  const active = CONVERSATIONS.find((c) => c.id === activeId);
  const filtered = CONVERSATIONS.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase())
  );

  const sendMessage = (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setThreads((prev) => ({ ...prev, [activeId]: [...prev[activeId], { from: 'me', text: draft.trim() }] }));
    setDraft('');
  };

  return (
    <div className="min-h-screen bg-[#f3f6f3]">
      <AlumniSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />

      <div className="lg:pl-64">
        <AlumniTopbar user={user} title="Message" onMenuClick={() => setSidebarOpen(true)} />

        <main className="mx-auto max-w-6xl p-4 sm:p-6">
          <div className="grid overflow-hidden rounded-3xl border border-emerald-900/10 bg-white shadow-sm md:grid-cols-[300px_minmax(0,1fr)]" style={{ height: 'calc(100vh - 12rem)', minHeight: '480px' }}>
            {/* Conversation list */}
            <div className={`flex-col border-r border-zinc-100 ${activeId ? 'hidden md:flex' : 'flex'}`}>
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
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setActiveId(c.id)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                        c.id === activeId ? 'bg-emerald-50/70' : 'hover:bg-zinc-50'
                      }`}
                    >
                      <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#009639]/10 text-sm font-bold text-[#009639]">
                        {c.initial}
                        {c.unread > 0 && (
                          <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-[#009639] px-1 text-[9px] font-bold text-white ring-2 ring-white">
                            {c.unread}
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[13px] font-bold text-zinc-900">{c.name}</span>
                          <span className="shrink-0 text-[10.5px] text-zinc-400">{c.time}</span>
                        </span>
                        <span className="block truncate text-[11.5px] text-zinc-500">{c.preview}</span>
                      </span>
                    </button>
                  </li>
                ))}
                {filtered.length === 0 && (
                  <li className="p-6 text-center text-[12.5px] text-zinc-400">No conversations found.</li>
                )}
              </ul>
            </div>

            {/* Thread */}
            <div className={`flex-col ${activeId ? 'flex' : 'hidden md:flex'}`}>
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
                  {active?.initial}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1 text-[13.5px] font-bold text-zinc-900">
                    <span className="truncate">{active?.name}</span>
                    <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#009639]" />
                  </span>
                  <span className="block truncate text-[11px] text-zinc-500">{active?.meta}</span>
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

              <form onSubmit={sendMessage} className="flex items-center gap-2 border-t border-zinc-100 p-3">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={`Message ${active?.name?.split(' ')[0] || ''}...`}
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
          </div>
        </main>
      </div>
    </div>
  );
};

export default AlumniMessage;
