import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, MapPin } from 'lucide-react';
import ActivityAccess from '../../components/student/ActivityAccess';
import { useAuth } from '../../context/useAuth';
import AlumniSidebar from '../../layout/sidebar/alumni/alumniSidebar';
import AlumniTopbar from '../../layout/topbar/alumni/alumniTopbar';
import AlumniFeed from '../../components/feed/AlumniFeed';
import api from '../../utils/axios';

const formatDate = value => new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

export default function AlumniEvents() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('upcoming');
  const [asOf] = useState(() => Date.now());
  const loadEvents = useCallback(async () => {
    setLoading(true); setError('');
    try { const res = await api.get('/events'); setEvents(res.data.data || []); }
    catch (err) { setError(err.response?.data?.message || 'Unable to load university events. Please try again.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { Promise.resolve().then(loadEvents); }, [loadEvents]);
  useEffect(() => {
    const timer = setInterval(() => { api.get('/events').then(response => setEvents(response.data.data || [])).catch(() => {}); }, 15000);
    return () => clearInterval(timer);
  }, []);
  const visible = events.filter(event => {
    const end = new Date(event.endAt || event.startAt).getTime();
    return Number.isFinite(end) && (tab === 'upcoming' ? end >= asOf : end < asOf);
  }).sort((a, b) => (new Date(a.startAt) - new Date(b.startAt)) * (tab === 'past' ? -1 : 1));

  return <div className="min-h-screen bg-[#f3f6f3] dark:bg-zinc-950">
    <AlumniSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />
    <div className="lg:pl-64">
      <AlumniTopbar user={user} title="Events" onMenuClick={() => setSidebarOpen(true)} />
      <main className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
        <section className="rounded-2xl border border-emerald-900/10 bg-white p-5 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
          <h1 className="flex items-center gap-2 text-lg font-bold"><CalendarDays className="text-emerald-600" />University events</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Stay connected through university and alumni gatherings.</p>
          <div className="my-4 flex gap-2" aria-label="Filter university events">
            {['upcoming', 'past'].map(value => <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)} className={`min-h-10 rounded-full px-4 text-sm font-semibold capitalize ${tab === value ? 'bg-emerald-600 text-white' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}>{value}</button>)}
          </div>
          {error && <p role="alert" className="text-sm text-red-600">{error} <button onClick={loadEvents} className="font-semibold underline">Retry</button></p>}
          {loading ? <p role="status" className="py-5 text-center text-sm text-zinc-500">Loading events…</p> : !error && !visible.length ? <p className="py-5 text-center text-sm text-zinc-500">No {tab} university events.</p> : <div className="space-y-3">
            {visible.map(event => <article key={event._id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
              <h2 className="font-bold">{event.title}</h2>
              <p className="mt-2 flex items-start gap-2 text-sm text-zinc-500"><CalendarDays size={16} className="mt-0.5 shrink-0" />{formatDate(event.startAt)}{event.endAt && ` – ${formatDate(event.endAt)}`}</p>
              {event.location && <p className="mt-1 flex items-start gap-2 text-sm text-zinc-500"><MapPin size={16} className="mt-0.5 shrink-0" />{event.location}</p>}
              {event.description && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">{event.description}</p>}
              <ActivityAccess event={event} onRegistered={updated => setEvents(list => list.map(item => item._id === updated._id ? updated : item))} />
            </article>)}
          </div>}
        </section>
        <section className="space-y-3"><h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Alumni events</h2><AlumniFeed onlyType="event" /></section>
      </main>
    </div>
  </div>;
}
