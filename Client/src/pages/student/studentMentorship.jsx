import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Users, Plus, Check, Clock, MessageSquare, ArrowUpRight, GraduationCap, MapPin, ArrowRight, LoaderCircle, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { useChat } from '../../context/useChat.js';
import DevelopmentShell from '../../components/student/DevelopmentShell';
import ProfileAvatar from '../../components/profile/ProfileAvatar';
import DataPagination from '../../components/ui/data-pagination';
import api from '../../utils/axios';

const card = 'rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900';
const primary = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#009639] px-4 text-xs font-semibold text-white transition hover:bg-[#007a2e] disabled:opacity-50';

function MentorBanner({ src }) {
  const [failedUrl, setFailedUrl] = useState(null);
  return <div aria-hidden="true" className="relative h-16 shrink-0 overflow-hidden bg-[#d9e5e1] dark:bg-[#233b35]">
    <div className="absolute -left-12 -top-28 h-56 w-56 rounded-full bg-[#aac5bb]/60 dark:bg-[#35584b]/60" />
    <div className="absolute -bottom-24 right-0 h-52 w-52 rounded-full border-[28px] border-[#c2d5ce] dark:border-[#2c493f]" />
    <div className="absolute inset-x-0 bottom-0 h-7 bg-white/10" />
    {src && src !== failedUrl && <img src={src} alt="" loading="lazy" onError={() => setFailedUrl(src)} className="absolute inset-0 h-full w-full object-cover" />}
  </div>;
}

export default function StudentMentorship() {
  const { user } = useAuth();
  const { openChatByEmail } = useChat();
  const navigate = useNavigate();
  const [mentors, setMentors] = useState([]);
  const [states, setStates] = useState({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [view, setView] = useState('all');
  const [program, setProgram] = useState('');
  const [sending, setSending] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const pending = useRef(false);

  useEffect(() => {
    let active = true;
    Promise.all([api.get('/users', { params: { role: 'alumni' } }), api.get('/connections/me')])
      .then(([usersRes, connsRes]) => {
        if (!active) return;
        setMentors((usersRes.data.data || []).filter(mentor => mentor.email && mentor.email !== user?.email && mentor.role?.toLowerCase() === 'alumni'));
        const map = {};
        (connsRes.data.data || []).forEach(connection => {
          if (!['accepted', 'pending'].includes(connection.status)) return;
          const outgoing = connection.requesterEmail === user?.email;
          map[outgoing ? connection.recipientEmail : connection.requesterEmail] = connection.status === 'accepted' ? 'connected' : outgoing ? 'pending' : 'incoming';
        });
        setStates(map); setError('');
      }).catch(() => { if (active) setError('Unable to load mentors and connection requests. Please try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.email, attempt]);

  const connect = async mentor => {
    if (pending.current) return;
    pending.current = true; setSending(mentor.email); setError(''); setNotice('');
    try {
      await api.post('/connections', { email: mentor.email });
      setStates(previous => ({ ...previous, [mentor.email]: 'pending' }));
      setNotice(`Request sent to ${mentor.name || mentor.email}. You can message them once they accept.`);
    } catch (err) { setError(err.response?.data?.message || 'Unable to send the request. Please try again.'); }
    finally { pending.current = false; setSending(null); }
  };
  const message = async mentor => {
    try { await openChatByEmail(mentor.email); }
    catch { setError('Unable to open the conversation. Please try again.'); }
  };
  const connected = mentors.filter(mentor => states[mentor.email] === 'connected').length;
  const requested = mentors.filter(mentor => ['pending', 'incoming'].includes(states[mentor.email])).length;
  const programs = [...new Set(mentors.map(mentor => mentor.program).filter(Boolean))].sort();
  const filtered = mentors.filter(mentor => (!program || mentor.program === program)
    && (view === 'all' || (view === 'connected' ? states[mentor.email] === 'connected' : ['pending', 'incoming'].includes(states[mentor.email])))
    && [mentor.name, mentor.email, mentor.program, ...(mentor.skills || [])].filter(Boolean).join(' ').toLowerCase().includes(query.trim().toLowerCase()));
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);
  const reset = () => { setQuery(''); setProgram(''); setView('all'); setPage(1); };

  return <DevelopmentShell title="Mentorship"><main className="mx-auto max-w-7xl space-y-5 p-3 sm:p-6">
    <header className="flex flex-col gap-5 border-b border-zinc-200 pb-5 pt-1 sm:flex-row sm:items-end sm:justify-between dark:border-zinc-800">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Mentorship</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">Find alumni to connect with and learn from.</p>
      </div>
      <label className="relative block w-full sm:w-80 sm:shrink-0">
        <span className="sr-only">Search mentors</span>
        <Search size={16} className="pointer-events-none absolute left-3 top-3 text-zinc-400" />
        <input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="Search name, program, or skill" className="h-10 w-full rounded-lg border border-zinc-300 bg-white pl-9 pr-3 text-xs text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[#009639] focus:ring-2 focus:ring-[#009639]/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
      </label>
    </header>
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
      <section className="min-w-0 space-y-4" aria-label="Alumni mentors">
        <div className={`${card} flex flex-wrap items-center justify-between gap-3 px-4 py-3`}><nav aria-label="Mentor views" className="flex max-w-full gap-4 overflow-x-auto">{[['all', 'Discover', mentors.length], ['connected', 'Connected', connected], ['pending', 'Requests', requested]].map(([id, label, count]) => <button key={id} type="button" aria-pressed={view === id} onClick={() => { setView(id); setPage(1); }} className={`flex shrink-0 items-center gap-2 border-b-2 py-2 text-xs font-semibold ${view === id ? 'border-[#009639] text-[#007a2e] dark:text-emerald-300' : 'border-transparent text-zinc-500 dark:text-zinc-400'}`}>{label}<span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">{count}</span></button>)}</nav><label className="flex min-w-0 max-w-full items-center gap-2 text-zinc-400"><SlidersHorizontal size={14} /><span className="sr-only">Filter by program</span><select value={program} onChange={event => { setProgram(event.target.value); setPage(1); }} className="h-9 min-w-0 max-w-[230px] rounded-lg border border-zinc-200 bg-zinc-50 px-2 text-[11px] text-zinc-600 outline-none focus:border-[#009639] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"><option value="">All programs</option>{programs.map(value => <option key={value}>{value}</option>)}</select></label></div>
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">{error} <button type="button" onClick={() => { setLoading(true); setAttempt(value => value + 1); }} className="font-semibold underline">Refresh mentors</button></div>}
        {notice && <p role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs leading-5 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"><Check size={16} className="mt-0.5 shrink-0" />{notice}</p>}
        {loading ? <div role="status" className={`${card} flex items-center justify-center gap-3 p-12 text-sm text-zinc-500`}><LoaderCircle size={20} className="animate-spin text-[#009639]" />Finding alumni...</div> : <>
          <div className="flex items-center justify-between gap-2 px-1"><p className="text-[11px] text-zinc-500 dark:text-zinc-400">{filtered.length} {filtered.length === 1 ? 'alumnus' : 'alumni'}{view === 'connected' ? ' connected with you' : view === 'pending' ? ' with pending requests' : ' to explore'}</p>{(query || program) && <button type="button" onClick={reset} className="text-[11px] font-medium text-[#007a2e] dark:text-emerald-300">Clear filters</button>}</div>
          {!filtered.length && <div className={`${card} p-10 text-center`}><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-[#009639] dark:bg-emerald-950"><Users size={26} /></span><h2 className="mt-4 text-sm font-semibold">{view === 'connected' ? 'Your connections start here' : view === 'pending' ? 'No pending requests' : 'No alumni found'}</h2><p className="mx-auto mt-2 max-w-xs text-xs leading-6 text-zinc-500 dark:text-zinc-400">{query || program ? 'Try a different name, skill, or program.' : 'Explore the alumni community and reach out to someone whose experience interests you.'}</p><button type="button" onClick={reset} className={`${primary} mt-5`}>Explore alumni<ArrowRight size={14} /></button></div>}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{paged.map(mentor => {
            const status = states[mentor.email] || 'none';
            const currentJob = mentor.employmentHistory?.find(job => job.current);
            const headline = currentJob ? [currentJob.position, currentJob.company].filter(Boolean).join(' at ') : mentor.program || 'CLSU alumni';
            const connectButton = 'inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-full border border-[#009639] px-4 text-xs font-semibold text-[#007a2e] transition hover:bg-emerald-50 hover:ring-1 hover:ring-[#009639] disabled:opacity-50 dark:border-emerald-500 dark:text-emerald-300 dark:hover:bg-emerald-950';
            return <article key={mentor._id} className={`${card} flex min-w-0 flex-col overflow-hidden transition hover:border-zinc-300 hover:shadow-md dark:hover:border-zinc-600`}>
              <MentorBanner src={mentor.bannerImage} />
              <div className="relative flex flex-1 flex-col items-center px-3 pb-3 text-center">
                <button type="button" aria-label={`View ${mentor.name || 'alumni'} profile`} onClick={() => navigate(`/alumni/profile/${mentor._id}`)} className="-mt-8 flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-emerald-50 text-xl font-semibold text-[#009639] ring-1 ring-zinc-100 transition hover:ring-emerald-400 focus-visible:outline-none focus-visible:ring-2 dark:border-zinc-900 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-zinc-800"><ProfileAvatar user={mentor} fallback="A" /></button>
                <h2 className="mt-2 w-full break-words text-sm font-semibold tracking-tight"><button type="button" onClick={() => navigate(`/alumni/profile/${mentor._id}`)} className="max-w-full hover:text-[#007a2e] hover:underline dark:hover:text-emerald-300">{mentor.name || 'Alumni'}</button></h2>
                <p className="mt-1.5 line-clamp-2 min-h-9 text-xs leading-5 text-zinc-600 dark:text-zinc-300">{headline}</p>
                {mentor.location && <p className="mt-1 flex items-center justify-center gap-1 text-[11px] text-zinc-400"><MapPin size={12} className="shrink-0" />{mentor.location}</p>}
                <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400"><GraduationCap size={14} className="shrink-0 text-[#009639] dark:text-emerald-400" />CLSU alumni{mentor.batch && ` | Batch ${mentor.batch}`}</p>
                <div className="mt-auto w-full pt-3">
                  {status !== 'none' && <p className={`mb-2 inline-flex items-center justify-center gap-1.5 text-[10px] font-medium ${status === 'connected' ? 'text-[#007a2e] dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>{status === 'connected' ? <Check size={12} /> : <Clock size={12} />}{status === 'connected' ? 'Connected' : status === 'incoming' ? 'Wants to connect' : 'Request sent'}</p>}
                  {status === 'connected' ? <button type="button" onClick={() => message(mentor)} className={connectButton}><MessageSquare size={15} />Message</button> : status === 'incoming' ? <Link to="/student/requests" className={connectButton}>Review request</Link> : status === 'pending' ? <button type="button" disabled className="inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-full border border-zinc-200 text-xs font-medium text-zinc-400 dark:border-zinc-700"><Clock size={14} />Pending</button> : <button type="button" disabled={sending !== null || !!error} onClick={() => connect(mentor)} className={connectButton}>{sending === mentor.email ? <LoaderCircle size={15} className="animate-spin" /> : <Plus size={16} />}{sending === mentor.email ? 'Sending...' : 'Connect'}</button>}
                  <button type="button" onClick={() => navigate(`/alumni/profile/${mentor._id}`)} className="mt-1 inline-flex min-h-7 items-center justify-center gap-1 px-2 text-[11px] font-medium text-zinc-500 hover:text-[#007a2e] dark:text-zinc-400 dark:hover:text-emerald-300">View profile<ArrowUpRight size={12} /></button>
                </div>
              </div>
            </article>;
          })}</div>
          {!!filtered.length && <div className={`${card} overflow-hidden`}><DataPagination page={currentPage} totalPages={totalPages} onPageChange={setPage} perPage={perPage} onPerPageChange={value => { setPerPage(value); setPage(1); }} totalItems={filtered.length} itemLabel="alumni" /></div>}
        </>}
      </section>
      <aside className="space-y-4 lg:sticky lg:top-20">
        <section className={`${card} p-5`}><p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Your network</p><div className="mt-4 flex items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-50 font-semibold text-[#009639] dark:bg-emerald-950"><ProfileAvatar user={user} /></span><div className="min-w-0"><h2 className="break-words text-sm font-semibold">{user?.name || 'Student'}</h2><p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{user?.program || 'Student'}</p></div></div><div className="mt-5 grid grid-cols-2 divide-x divide-zinc-100 border-t border-zinc-100 pt-4 dark:divide-zinc-800 dark:border-zinc-800"><div><p className="text-2xl font-semibold">{connected}</p><p className="mt-1 text-[10px] text-zinc-400">Connected alumni</p></div><div className="pl-4"><p className="text-2xl font-semibold">{requested}</p><p className="mt-1 text-[10px] text-zinc-400">Pending requests</p></div></div></section>
        <section className={`${card} p-5`}><h2 className="text-sm font-semibold">Make the first connection</h2><ol className="mt-5 space-y-5">{[['Find your fit', 'Explore alumni profiles and look for experience that aligns with your goals.'], ['Reach out', 'Send a connection request. Once accepted, introduce yourself in a message.'], ['Start a conversation', 'Share your interests and ask a specific question about their career journey.']].map(([title, description], index) => <li key={title} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[10px] font-semibold text-[#007a2e] dark:bg-emerald-950 dark:text-emerald-300">{index + 1}</span><div><h3 className="text-xs font-semibold">{title}</h3><p className="mt-1 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">{description}</p></div></li>)}</ol></section>
      </aside>
    </div>
  </main></DevelopmentShell>;
}
