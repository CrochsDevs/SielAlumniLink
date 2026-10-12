import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { Search, Users, Plus, Check, Clock, MessageSquare, Eye } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { useChat } from '../../context/useChat.js';
import StudentSidebar from '../../layout/sidebar/student/studentSidebar';
import StudentTopbar from '../../layout/topbar/student/studentTopbar';
import api from '../../utils/axios';

// Mentorship discovery: ALUMNI accounts only —
// students cannot connect with fellow students here.
const StudentMentorship = () => {
  const { user } = useAuth();
  const { openChatByEmail } = useChat();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mentors, setMentors] = useState([]);
  const [states, setStates] = useState({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sending, setSending] = useState(null);

  useEffect(() => {
    Promise.all([api.get('/users', { params: { role: 'alumni' } }), api.get('/connections/me')])
      .then(([usersRes, connsRes]) => {
        const list = (usersRes.data.data || []).filter(
          (u) => u.email && u.email !== user?.email
        );
        setMentors(list);
        const map = {};
        (connsRes.data.data || []).forEach((c) => {
          const other = c.requesterEmail === user?.email ? c.recipientEmail : c.requesterEmail;
          map[other] = c.status === 'accepted' ? 'connected' : 'pending';
        });
        setStates(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.email]);

  const handleConnect = async (mentor) => {
    setSending(mentor.email);
    try {
      await api.post('/connections', { email: mentor.email });
      setStates((prev) => ({ ...prev, [mentor.email]: 'pending' }));
      Swal.fire({ title: 'Request sent', text: `${mentor.name || mentor.email} will be notified.`, icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to send request', 'error');
    } finally {
      setSending(null);
    }
  };

  const filtered = mentors.filter((m) =>
    `${m.name} ${m.email} ${m.program || ''}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-zinc-50">
      <StudentSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />

      <div className="lg:pl-64">
        <StudentTopbar user={user} title="Mentorship" onMenuClick={() => setSidebarOpen(true)} />

        <main className="mx-auto max-w-4xl space-y-3 p-4 sm:p-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <h1 className="flex items-center gap-2 text-[16px] font-extrabold text-zinc-900">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-900 text-white">
                <Users className="h-4 w-4" />
              </span>
              Find an Alumni Mentor
            </h1>
            <p className="mt-1 text-[12.5px] text-zinc-500">
              Connect with graduates who can guide your journey. Students only — no fellow students here.
            </p>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, program, or email..."
                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-[12.5px] outline-none focus:border-zinc-900"
              />
            </div>
          </div>

          {loading ? (
            <p className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-[13px] text-zinc-500">
              Loading mentors...
            </p>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center">
              <p className="text-[14px] font-bold text-zinc-800">No mentors found</p>
              <p className="mt-0.5 text-[12px] text-zinc-500">Try a different keyword.</p>
            </div>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {filtered.map((m) => {
                const state = states[m.email] || 'none';
                return (
                  <div key={m._id} className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm font-bold text-white">
                      {m.profilePicture ? <img src={m.profilePicture} alt={`${m.name || 'Alumni'} profile picture`} className="h-full w-full rounded-full object-cover" /> : (m.name || 'A').charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-bold text-zinc-900">{m.name || 'Alumni'}</p>
                      <p className="truncate text-[11px] text-zinc-500">
                        {[m.program, m.email].filter(Boolean).join(' • ')}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => navigate(`/alumni/profile/${m._id}`)}
                        className="flex items-center gap-1 rounded-full border border-zinc-200 px-2.5 py-1.5 text-[11px] font-bold text-zinc-500 transition hover:border-[#009639] hover:text-[#009639]"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </button>
                      {state === 'connected' ? (
                        <span className="flex shrink-0 items-center gap-1.5">
                        <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-[#007a2e]">
                          <Check className="h-3.5 w-3.5" />
                          Connected
                        </span>
                        <button
                          type="button"
                          onClick={() => openChatByEmail(m.email)}
                          className="flex items-center gap-1 rounded-full bg-[#009639] px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-[#007a2e]"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          Message
                        </button>
                      </span>
                    ) : state === 'pending' ? (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1.5 text-[11px] font-bold text-amber-700">
                        <Clock className="h-3.5 w-3.5" />
                        Pending
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={sending === m.email}
                        onClick={() => handleConnect(m)}
                        className="flex shrink-0 items-center gap-1 rounded-full bg-zinc-900 px-3.5 py-1.5 text-[11.5px] font-bold text-white transition hover:bg-zinc-700 disabled:opacity-50"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {sending === m.email ? '...' : 'Connect'}
                      </button>
                    )}
                  </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default StudentMentorship;
