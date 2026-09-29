import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
  ThumbsUp,
  MessageSquare,
  Repeat2,
  Send,
  ClipboardCheck,
  HandHeart,
  CalendarDays,
  Sparkles,
  Briefcase,
  MapPin,
  BadgeCheck,
  GraduationCap,
  Users,
  UserPlus,
  Check,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { useChat } from '../../context/ChatContext';
import AlumniSidebar from '../../layout/sidebar/alumni/alumniSidebar';
import AlumniTopbar from '../../layout/topbar/alumni/alumniTopbar';
import api from '../../utils/axios';

// TEMPORARY content — papalitan ng totoong data mula sa API.
// TODO(alumni): wire profile/feed/events to backend endpoints.
const POSTS = [
  {
    id: 1,
    name: 'Maria Santos',
    meta: 'HR Manager • Batch 2015 • BS Psychology',
    time: '2h',
    initial: 'M',
    verified: true,
    text: 'Fellow Sieles! We are hiring management trainees — fresh graduates are welcome. Just send me a message. 🎓',
    likes: 48,
    comments: 12,
  },
  {
    id: 2,
    name: 'Jose Ramos',
    meta: 'Software Engineer • Batch 2019 • BS IT',
    time: '5h',
    initial: 'J',
    verified: false,
    text: 'Passed my AWS certification! Thank you to my mentors in this network who guided me along the way.',
    likes: 112,
    comments: 28,
  },
  {
    id: 3,
    name: 'CLSU Career Office',
    meta: 'Official • Career Services',
    time: '1d',
    initial: 'C',
    verified: true,
    text: 'Grand Alumni Homecoming 2026 — save the date! Registration opens next week. See you there, Sieles!',
    likes: 230,
    comments: 45,
  },
];

const EVENTS = [
  { title: 'Grand Alumni Homecoming 2026', meta: 'CLSU Campus • Soon' },
  { title: 'Career Fair: Tech & Agri', meta: 'Jobs • Next month' },
  { title: 'Tracer Study 2026 is open', meta: 'Survey • Answer now' },
];

const SUGGESTIONS = [
  { name: 'Ana Cruz', meta: 'Data Analyst • Batch 2020', initial: 'A' },
  { name: 'Mark Dela Peña', meta: 'Engineer • Batch 2017', initial: 'M' },
];

const AlumniDashboard = () => {
  const { user } = useAuth();
  const { openChatByEmail } = useChat();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [liked, setLiked] = useState({});
  const [composer, setComposer] = useState('');
  const [dashTab, setDashTab] = useState('feed');
  const [mentees, setMentees] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [menteesLoading, setMenteesLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [connecting, setConnecting] = useState(null);

  const toggleLike = (id) => setLiked((prev) => ({ ...prev, [id]: !prev[id] }));

  // Connected students (mentees) + pending request count.
  const loadMentees = async () => {
    setMenteesLoading(true);
    try {
      const [connsRes, usersRes] = await Promise.all([
        api.get('/connections/me'),
        api.get('/users'),
      ]);
      const roleByEmail = {};
      (usersRes.data.data || []).forEach((u) => { roleByEmail[u.email] = u; });
      const mine = String(user?.email);
      const accepted = (connsRes.data.data || []).filter((c) => c.status === 'accepted');
      setMentees(
        accepted
          .map((c) => (c.requesterEmail === mine ? c.recipientEmail : c.requesterEmail))
          .filter((email) => roleByEmail[email]?.role === 'student')
          .map((email) => ({ email, name: roleByEmail[email]?.name || email }))
      );
      const pending = await api.get('/connections/requests').catch(() => ({ data: { data: [] } }));
      setPendingCount((pending.data.data || []).length);
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to load mentees', 'error');
    } finally {
      setMenteesLoading(false);
    }
  };

  const loadRequests = async () => {
    setRequestsLoading(true);
    try {
      const res = await api.get('/connections/requests');
      setRequests(res.data.data || []);
    } catch {
      // ignore
    } finally {
      setRequestsLoading(false);
    }
  };

  const loadSuggestions = async () => {
    setSuggestionsLoading(true);
    try {
      const [usersRes, connsRes] = await Promise.all([
        api.get('/users', { params: { role: 'alumni' } }),
        api.get('/connections/me'),
      ]);
      const connectedEmails = new Set(
        (connsRes.data.data || []).map((c) =>
          c.requesterEmail === user?.email ? c.recipientEmail : c.requesterEmail
        )
      );
      const list = (usersRes.data.data || [])
        .filter((u) => u.email && u.email !== user?.email && !connectedEmails.has(u.email))
        .slice(0, 5);
      setSuggestions(list);
    } catch {
      // ignore
    } finally {
      setSuggestionsLoading(false);
    }
  };

  useEffect(() => {
    if (dashTab === 'mentorship' && mentees.length === 0 && !menteesLoading) {
      loadMentees();
    }
    loadRequests();
    loadSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashTab]);

  const handleRespond = async (id, status) => {
    try {
      await api.put(`/connections/${id}`, { status });
      setRequests((prev) => prev.filter((r) => String(r._id) !== String(id)));
      setPendingCount((prev) => Math.max(0, prev - 1));
      Swal.fire({
        title: status === 'accepted' ? 'Connected!' : 'Declined',
        text: status === 'accepted' ? 'You can now chat with each other.' : undefined,
        icon: status === 'accepted' ? 'success' : 'info',
        timer: 1500,
        showConfirmButton: false,
      });
      loadSuggestions();
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to respond', 'error');
    }
  };

  const handleConnect = async (email) => {
    setConnecting(email);
    try {
      await api.post('/connections', { email });
      setSuggestions((prev) => prev.filter((s) => s.email !== email));
      Swal.fire({ title: 'Request sent', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to send request', 'error');
    } finally {
      setConnecting(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f6f3] dark:bg-zinc-950">
      <AlumniSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />

      <div className="lg:pl-64">
        <AlumniTopbar user={user} title="Dashboard" onMenuClick={() => setSidebarOpen(true)} />

        <main className="mx-auto grid max-w-6xl gap-4 p-4 sm:p-6 lg:grid-cols-[250px_minmax(0,1fr)_300px]">
          {/* LEFT: Sieles ID card */}
          <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
            <div className="overflow-hidden rounded-2xl border border-emerald-900/10 bg-white dark:bg-zinc-900 shadow-sm">
              <div className="h-16 bg-gradient-to-r from-[#0F4C3A] via-[#007a2e] to-[#009639]" />
              <div className="px-4 pb-4 text-center">
                <div className="mx-auto -mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-white dark:bg-zinc-900 text-xl font-extrabold text-[#009639] dark:text-emerald-300 shadow ring-2 ring-emerald-100 dark:ring-emerald-900">
                  {(user?.name || 'A').charAt(0).toUpperCase()}
                </div>
                <p className="mt-2 flex items-center justify-center gap-1 text-[14px] font-bold text-zinc-900 dark:text-zinc-100">
                  <span className="truncate">{user?.name || 'Alumni'}</span>
                  <BadgeCheck className="h-4 w-4 shrink-0 text-[#009639] dark:text-emerald-300" />
                </p>
                <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400">BS Program • Batch 20XX</p>
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#009639]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#007a2e]">
                  <GraduationCap className="h-3 w-3" />
                  Verified Alumni
                </span>
                <div className="mt-3 space-y-1 border-t border-zinc-100 dark:border-zinc-800 pt-3 text-left text-[11.5px]">
                  <button type="button" className="flex w-full justify-between py-0.5 text-zinc-500 dark:text-zinc-400 transition hover:text-[#009639] dark:text-emerald-300">
                    <span>Profile viewers</span>
                    <span className="font-bold text-[#009639] dark:text-emerald-300">127</span>
                  </button>
                  <button type="button" className="flex w-full justify-between py-0.5 text-zinc-500 dark:text-zinc-400 transition hover:text-[#009639] dark:text-emerald-300">
                    <span>Fellow Sieles</span>
                    <span className="font-bold text-[#009639] dark:text-emerald-300">248</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/alumni/profile')}
                  className="mt-3 w-full rounded-xl bg-[#009639] py-2 text-[12px] font-bold text-white transition hover:bg-[#007a2e]"
                >
                  View Profile
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-900/10 bg-gradient-to-br from-[#0F4C3A] to-[#007a2e] p-4 text-white shadow-sm">
              <p className="flex items-center gap-1.5 text-[12.5px] font-bold">
                <ClipboardCheck className="h-4 w-4" />
                Tracer Study 2026
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-white/70">
                Only 3 minutes — help us keep university records updated.
              </p>
              <button
                type="button"
                onClick={() => navigate('/alumni/tracer')}
                className="mt-3 w-full rounded-xl bg-white dark:bg-zinc-900 py-2 text-[12px] font-bold text-[#007a2e] transition hover:bg-emerald-50"
              >
                Answer now
              </button>
            </div>
          </aside>

          {/* CENTER */}
          <section className="min-w-0 space-y-3">
            {/* Feed / Mentorship tabs */}
            <div className="flex gap-1.5">
              {[
                { key: 'feed', label: 'Feed' },
                { key: 'mentorship', label: 'Mentorship' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDashTab(key)}
                  className={`rounded-full px-4 py-2 text-[12.5px] font-bold transition ${
                    dashTab === key
                      ? 'bg-[#009639] text-white shadow-sm'
                      : 'bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {dashTab === 'mentorship' ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-emerald-900/10 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5 shadow-sm">
                  <h3 className="flex items-center gap-2 text-[14px] font-extrabold text-zinc-900 dark:text-zinc-100">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#009639]/10 dark:bg-[#009639]/20 text-[#009639] dark:text-emerald-300">
                      <Users className="h-3.5 w-3.5" />
                    </span>
                    My Mentees
                    <span className="rounded-full bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 text-[10.5px] font-bold text-[#007a2e] dark:text-emerald-300">
                      {mentees.length} connected students
                    </span>
                  </h3>
                  {menteesLoading ? (
                    <p className="py-4 text-center text-[12.5px] text-zinc-400">Loading mentees...</p>
                  ) : mentees.length === 0 ? (
                    <p className="py-4 text-center text-[12.5px] text-zinc-400">
                      No connected students yet. Accept requests to mentor them here.
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {mentees.map((m) => (
                        <li key={m.email} className="flex items-center gap-3 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#009639]/10 dark:bg-[#009639]/20 text-sm font-bold text-[#009639] dark:text-emerald-300">
                            {(m.name || 'S').charAt(0).toUpperCase()}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-bold text-zinc-900 dark:text-zinc-100">{m.name}</span>
                            <span className="block truncate text-[11px] text-zinc-500 dark:text-zinc-400">{m.email}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => openChatByEmail(m.email)}
                            className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#009639] px-3.5 py-1.5 text-[11.5px] font-bold text-white transition hover:bg-[#007a2e]"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            Chat
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate('/alumni/requests')}
                    className="mt-3 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 py-2.5 text-[12.5px] font-bold text-zinc-600 dark:text-zinc-300 transition hover:border-[#009639] hover:text-[#007a2e] dark:hover:text-emerald-300"
                  >
                    View invitations{pendingCount > 0 ? ` (${pendingCount} pending)` : ''}
                  </button>
                </div>
              </div>
            ) : (
              <>
            <div className="rounded-2xl border border-emerald-900/10 bg-white dark:bg-zinc-900 p-3 shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#009639]/10 text-sm font-bold text-[#009639] dark:text-emerald-300">
                  {(user?.name || 'A').charAt(0).toUpperCase()}
                </div>
                <button
                  type="button"
                  className="h-11 flex-1 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-[#f3f6f3] dark:bg-zinc-950 px-4 text-left text-[13px] font-medium text-zinc-500 dark:text-zinc-400 transition hover:border-emerald-300 hover:bg-emerald-50/50"
                >
                  {composer || 'Hello, fellow Sielesyuans! Share an update...'}
                </button>
              </div>
              <div className="mt-1 flex justify-between px-1">
                {[
                  { icon: HandHeart, label: 'Referral' },
                  { icon: Briefcase, label: 'Hiring' },
                  { icon: CalendarDays, label: 'Event' },
                  { icon: Sparkles, label: 'Story' },
                ].map(({ icon: Icon, label }) => (
                  <button
                    key={label}
                    type="button"
                    className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[12px] font-semibold text-zinc-500 dark:text-zinc-400 transition hover:bg-emerald-50 hover:text-[#007a2e]"
                  >
                    <Icon className="h-4 w-4 text-[#009639] dark:text-emerald-300" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {POSTS.map((post) => (
              <article key={post.id} className="rounded-2xl border border-emerald-900/10 bg-white dark:bg-zinc-900 shadow-sm">
                <div className="flex gap-2.5 p-4 pb-2">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#009639]/10 text-sm font-bold text-[#009639] dark:text-emerald-300">
                    {post.initial}
                  </div>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 truncate text-[13px] font-bold text-zinc-900 dark:text-zinc-100">
                      {post.name}
                      {post.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#009639] dark:text-emerald-300" />}
                    </p>
                    <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">{post.meta}</p>
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500">{post.time}</p>
                  </div>
                </div>
                <p className="px-4 pb-3 text-[13px] leading-relaxed text-zinc-800 dark:text-zinc-100">{post.text}</p>
                <p className="flex items-center gap-1.5 border-t border-zinc-100 dark:border-zinc-800 px-4 py-2 text-[11.5px] font-medium text-zinc-500 dark:text-zinc-400">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#009639]">
                    <ThumbsUp className="h-2.5 w-2.5 text-white" />
                  </span>
                  {post.likes + (liked[post.id] ? 1 : 0)} • {post.comments} comments
                </p>
                <div className="flex gap-1 border-t border-zinc-100 dark:border-zinc-800 px-3 py-1.5">
                  {[
                    { icon: ThumbsUp, label: 'Like', active: liked[post.id], onClick: () => toggleLike(post.id) },
                    { icon: MessageSquare, label: 'Comment' },
                    { icon: Repeat2, label: 'Share' },
                    { icon: Send, label: 'Send' },
                  ].map(({ icon: Icon, label, active, onClick }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={onClick}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-semibold transition hover:bg-emerald-50 ${
                        active ? 'text-[#009639]' : 'text-zinc-500'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </article>
            ))}
            </>
            )}
          </section>

          {/* RIGHT: Connection requests + Suggested connects */}
          <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
            <div className="overflow-hidden rounded-2xl border border-emerald-900/10 bg-white dark:bg-zinc-900 shadow-sm">
              <div className="bg-gradient-to-r from-[#0F4C3A] to-[#009639] px-4 py-2.5">
                <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-white">
                  <UserPlus className="h-3.5 w-3.5" />
                  Connection Requests
                  {pendingCount > 0 && (
                    <span className="ml-auto rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold">
                      {pendingCount}
                    </span>
                  )}
                </p>
              </div>
              <div className="p-3">
                {requestsLoading ? (
                  <p className="py-3 text-center text-[11.5px] text-zinc-400">Loading...</p>
                ) : requests.length === 0 ? (
                  <p className="py-3 text-center text-[11.5px] text-zinc-400">No pending requests</p>
                ) : (
                  <ul className="space-y-2.5">
                    {requests.slice(0, 3).map((r) => (
                      <li key={r._id} className="rounded-xl border border-zinc-100 dark:border-zinc-800 p-2.5">
                        <div className="flex items-center gap-2">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#009639]/10 dark:bg-[#009639]/20 text-[11px] font-bold text-[#009639] dark:text-emerald-300">
                            {(r.name || 'U').charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] font-bold text-zinc-900 dark:text-zinc-100">{r.name}</p>
                            <p className="truncate text-[10px] text-zinc-500 dark:text-zinc-400">{r.program || r.email}</p>
                          </div>
                        </div>
                        <div className="mt-2 flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleRespond(r._id, 'accepted')}
                            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#009639] py-1.5 text-[10.5px] font-bold text-white transition hover:bg-[#007a2e]"
                          >
                            <Check className="h-3 w-3" />
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRespond(r._id, 'declined')}
                            className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 py-1.5 text-[10.5px] font-bold text-zinc-500 dark:text-zinc-400 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          >
                            <X className="h-3 w-3" />
                            Decline
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={() => navigate('/alumni/requests')}
                  className="mt-2.5 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 py-1.5 text-[11px] font-bold text-zinc-500 dark:text-zinc-400 transition hover:border-[#009639] hover:text-[#007a2e] dark:hover:text-emerald-300"
                >
                  View more
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-900/10 bg-white dark:bg-zinc-900 p-4 shadow-sm">
              <p className="text-[13px] font-bold text-zinc-900 dark:text-zinc-100">Suggested Connects</p>
              {suggestionsLoading ? (
                <p className="py-3 text-center text-[11.5px] text-zinc-400">Loading...</p>
              ) : suggestions.length === 0 ? (
                <p className="py-3 text-center text-[11.5px] text-zinc-400">No suggestions</p>
              ) : (
                <ul className="mt-2 space-y-3">
                  {suggestions.slice(0, 3).map((person) => (
                    <li key={person._id} className="flex items-start gap-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#009639]/10 text-xs font-bold text-[#009639] dark:text-emerald-300">
                        {(person.name || 'A').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-bold text-zinc-800 dark:text-zinc-100">{person.name || 'Alumni'}</p>
                        <p className="truncate text-[10.5px] text-zinc-500 dark:text-zinc-400">
                          {person.program || person.email}
                        </p>
                        <button
                          type="button"
                          disabled={connecting === person.email}
                          onClick={() => handleConnect(person.email)}
                          className="mt-1.5 rounded-full bg-[#009639]/10 px-3 py-1 text-[11px] font-bold text-[#007a2e] transition hover:bg-[#009639] hover:text-white disabled:opacity-50"
                        >
                          {connecting === person.email ? '...' : '+ connect'}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={() => navigate('/alumni/accounts')}
                className="mt-3 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 py-1.5 text-[11px] font-bold text-zinc-500 dark:text-zinc-400 transition hover:border-[#009639] hover:text-[#007a2e] dark:hover:text-emerald-300"
              >
                View more
              </button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-emerald-900/10 bg-white dark:bg-zinc-900 shadow-sm">
              <div className="bg-gradient-to-r from-[#0F4C3A] to-[#009639] px-4 py-2.5">
                <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-white">
                  <MapPin className="h-3.5 w-3.5" />
                  At CLSU Today
                </p>
              </div>
              <ul className="space-y-3 p-4">
                {EVENTS.map((item) => (
                  <li key={item.title} className="cursor-pointer">
                    <p className="text-[12px] font-semibold leading-snug text-zinc-800 dark:text-zinc-100 transition hover:text-[#009639] dark:text-emerald-300">
                      {item.title}
                    </p>
                    <p className="text-[10.5px] text-zinc-400 dark:text-zinc-500">{item.meta}</p>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
};

export default AlumniDashboard;
