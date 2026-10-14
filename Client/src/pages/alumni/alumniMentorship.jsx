import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ClipboardList, Users, MessageSquare, Search, ArrowRight, RefreshCw } from 'lucide-react';
import AlumniSidebar from '../../layout/sidebar/alumni/alumniSidebar';
import AlumniTopbar from '../../layout/topbar/alumni/alumniTopbar';
import { useChat } from '../../context/useChat.js';
import ProfileAvatar from '../../components/profile/ProfileAvatar';
import api from '../../utils/axios';
import { useAuth } from '../../context/useAuth';

const card = 'rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900';
const button = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#009639] px-4 text-xs font-semibold text-white hover:bg-[#007a2e] disabled:opacity-50';

export default function AlumniMentorship() {
  const { user } = useAuth();
  const { openChatByEmail } = useChat();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [view, setView] = useState('students');
  const [query, setQuery] = useState('');
  const [messaging, setMessaging] = useState('');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const messagePending = useRef(false);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setStudents((await api.get('/development/mentees')).data.data || []); }
    catch (err) { setError(err.response?.data?.message || 'Unable to load connected students.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { Promise.resolve().then(load); }, [load]);
  const message = async student => {
    if (messagePending.current) return;
    messagePending.current = true; setMessaging(student.email); setError('');
    try { await openChatByEmail(student.email); }
    catch (err) { setError(err.response?.data?.message || 'Unable to open the student conversation. Please try again.'); }
    finally { messagePending.current = false; setMessaging(''); }
  };
  const filtered = students.filter(student => [student.name, student.program, student.email].filter(Boolean).join(' ').toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
    <AlumniSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />
    <div className="lg:pl-64"><AlumniTopbar user={user} title="Mentorship" onMenuClick={() => setSidebarOpen(true)} />
      <main className="mx-auto max-w-6xl space-y-5 p-3 sm:p-6">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-5 dark:border-zinc-800">
          <div><span className="text-[10px] font-semibold uppercase tracking-wider text-[#007a2e] dark:text-emerald-300">Alumni mentor</span><h1 className="mt-2 text-2xl font-semibold tracking-tight">Mentor dashboard</h1><p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">Guide your connected students, review their work, and provide skill evaluations.</p></div>
          <Link to="/alumni/requests" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 text-xs font-semibold dark:border-zinc-700 dark:bg-zinc-900">Connection requests<ArrowRight size={14} /></Link>
        </header>
        {error && <p role="alert" className={`${card} p-4 text-sm text-red-600`}>{error} <button type="button" onClick={load} className="underline">Retry</button></p>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800">
          <nav aria-label="Mentor workspace" className="flex gap-5">{[['students', 'My mentee'], ['evaluations', 'Skill evaluations']].map(([id, label]) => <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)} className={`min-h-11 border-b-2 px-1 text-xs font-semibold ${view === id ? 'border-[#009639] text-[#007a2e] dark:text-emerald-300' : 'border-transparent text-zinc-500'}`}>{label}{id === 'students' && !loading && <span className="ml-2 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] dark:bg-zinc-800">{students.length}</span>}</button>)}</nav>
          <button type="button" disabled={loading} onClick={load} aria-label="Refresh students" className="mb-1 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-zinc-500 disabled:opacity-40"><RefreshCw size={13} />Refresh</button>
        </div>
        {view === 'evaluations' && <div><h2 className="text-sm font-semibold">Choose a student to evaluate</h2><p className="mt-2 text-xs leading-6 text-zinc-500">Each student has a separate evaluation page with their assessment, portfolio evidence, and your feedback.</p></div>}
        {loading ? <p role="status" className="p-5 text-sm text-zinc-500">Loading your students...</p> : !students.length ? !error && <section className={`${card} p-10 text-center`}><Users size={30} className="mx-auto text-zinc-400" /><h2 className="mt-3 text-sm font-semibold">No connected students yet</h2><p className="mx-auto mt-2 max-w-sm text-xs leading-6 text-zinc-500">Once you accept a student's connection request, they appear here. You can then message them and evaluate their skills.</p><Link to="/alumni/requests" className={`${button} mt-5`}>Review connection requests</Link></section> : <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <section className="min-w-0 space-y-4">
            <label className="relative block"><span className="sr-only">Search your students</span><Search size={15} className="absolute left-3 top-3 text-zinc-400" /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search student name or program" className="h-10 w-full rounded-lg border border-zinc-300 bg-white pl-9 pr-3 text-xs outline-none focus:border-[#009639] dark:border-zinc-700 dark:bg-zinc-900" /></label>
            <p className="text-[11px] text-zinc-500">{filtered.length} connected {filtered.length === 1 ? 'student' : 'students'}</p>
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">{filtered.map(student => <article key={student.authId} data-mentee={student.authId} className={`${card} min-w-0 p-3.5`}>
              <div className="flex items-center gap-2.5"><span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-50 text-[#009639] dark:bg-emerald-950"><ProfileAvatar user={student} /></span><div className="min-w-0 flex-1"><h2 title={student.name} className="truncate text-[13px] font-semibold leading-5">{student.name}</h2><p title={student.program} className="truncate text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">{student.program || 'Program not provided'}</p><p title={student.email} className="truncate text-[10px] leading-4 text-zinc-400 dark:text-zinc-500">{student.email}</p></div></div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-2.5 dark:border-zinc-800"><p className="inline-flex items-center gap-1 text-[10px] font-medium text-[#007a2e] dark:text-emerald-300"><Check size={11} />Connected</p>{view === 'evaluations' ? <Link data-evaluate-student={student.authId} to={`/alumni/mentorship/${student.authId}/evaluation`} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-[#009639] px-2.5 text-[11px] font-semibold text-white hover:bg-[#007a2e]"><ClipboardList size={13} />Evaluate student</Link> : <button type="button" disabled={!!messaging} onClick={() => message(student)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-zinc-300 px-2.5 text-[11px] font-semibold transition hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"><MessageSquare size={13} />{messaging === student.email ? 'Opening...' : 'Message Mentee'}</button>}</div>
            </article>)}</div>
            {!filtered.length && <div className={`${card} p-8 text-center`}><p className="text-sm text-zinc-500">No students match your search.</p><button type="button" onClick={() => setQuery('')} className="mt-3 text-xs font-semibold text-[#009639]">Clear search</button></div>}
          </section>
          <aside className="space-y-4"><section className={`${card} p-5`}><h2 className="text-sm font-semibold">{view === 'students' ? 'Mentee conversations' : 'Student evaluations'}</h2><p className="mt-3 text-xs leading-6 text-zinc-500">{view === 'students' ? 'Message your mentees to discuss progress, answer questions, and provide mentoring support.' : "Open a student's page to review their work, evaluate technical, communication, and leadership skills, and recommend their next steps."}</p></section><section className={`${card} p-5`}><h2 className="text-sm font-semibold">Mentee connections</h2><p className="mt-3 text-xs leading-6 text-zinc-500">Your mentees appear here after their connection request is accepted.</p><Link to="/alumni/requests" className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[#009639]">Manage requests<ArrowRight size={13} /></Link></section></aside>
        </div>}
      </main>
    </div>
  </div>;
}
