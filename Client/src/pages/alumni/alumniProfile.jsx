import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
  BadgeCheck,
  MapPin,
  Mail,
  Briefcase,
  GraduationCap,
  Plus,
  Check,
  Clock,
  Pencil,
  Sparkles,
  Award,
  Users,
  ArrowLeft,
  Share2,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { useChat } from '../../context/ChatContext';
import AlumniSidebar from '../../layout/sidebar/alumni/alumniSidebar';
import AlumniTopbar from '../../layout/topbar/alumni/alumniTopbar';
import StudentSidebar from '../../layout/sidebar/student/studentSidebar';
import StudentTopbar from '../../layout/topbar/student/studentTopbar';
import api from '../../utils/axios';

// TEMPORARY content — papalitan ng totoong data mula sa API.
// TODO(alumni): wire profile to backend endpoints.
const EXPERIENCE = [
  {
    role: 'HR Manager',
    company: 'Tech Corp • Full-time',
    period: '2021 — Present • 4 yrs',
    location: 'Manila, Philippines',
    current: true,
  },
  {
    role: 'HR Assistant',
    company: 'DataHub • Full-time',
    period: '2018 — 2021 • 3 yrs',
    location: 'Clark, Pampanga',
    current: false,
  },
];

const SKILLS = ['Talent Acquisition', 'Employee Relations', 'HR Analytics', 'Mentoring', 'Public Speaking'];

const STATS = [
  { icon: Users, value: '248', label: 'Connections' },
  { icon: Briefcase, value: '12', label: 'Posts' },
  { icon: Award, value: '5', label: 'Recognitions' },
];

const AlumniProfile = () => {
  const { user } = useAuth();
  const { openChatByEmail } = useChat();
  const { id } = useParams();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [connectState, setConnectState] = useState('none'); // none | pending | connected
  const [connectLoading, setConnectLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [loadingOther, setLoadingOther] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // Own profile when no :id, or :id matches your own profile id.
  const isOwn = !id || String(id) === String(user?._id);

  useEffect(() => {
    if (isOwn) return;
    setLoadingOther(true);
    setNotFound(false);
    api.get(`/users/${id}`)
      .then((res) => setProfile(res.data.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoadingOther(false));
  }, [id, isOwn]);

  // Check existing connection with this person.
  useEffect(() => {
    if (isOwn || !profile?.email) return;
    api.get('/connections/me')
      .then((res) => {
        const found = (res.data.data || []).find(
          (c) => c.requesterEmail === profile.email || c.recipientEmail === profile.email
        );
        if (found) setConnectState(found.status === 'accepted' ? 'connected' : 'pending');
        else setConnectState('none');
      })
      .catch(() => {});
  }, [isOwn, profile?.email]);

  const handleConnect = async () => {
    if (connectState !== 'none' || !profile?.email) return;
    setConnectLoading(true);
    try {
      await api.post('/connections', { email: profile.email });
      setConnectState('pending');
      Swal.fire({ title: 'Request sent', text: 'They will be notified.', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to send request', 'error');
    } finally {
      setConnectLoading(false);
    }
  };

  const person = isOwn ? user : profile;
  const isStudent = user?.role === 'student';
  const Sidebar = isStudent ? StudentSidebar : AlumniSidebar;
  const Topbar = isStudent ? StudentTopbar : AlumniTopbar;

  return (
    <div className="min-h-screen bg-[#f3f6f3] dark:bg-zinc-950">
      <Sidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />

      <div className="lg:pl-64">
        <Topbar user={user} title="Profile" onMenuClick={() => setSidebarOpen(true)} />

        <main className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
          {!isOwn && (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-[12.5px] font-semibold text-zinc-500 dark:text-zinc-400 transition hover:text-[#007a2e]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          )}

          {loadingOther ? (
            <div className="rounded-3xl border border-emerald-900/10 bg-white dark:bg-zinc-900 p-10 text-center shadow-sm">
              <svg className="mx-auto h-8 w-8 animate-spin text-[#009639] dark:text-emerald-300" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="mt-3 text-[13px] font-medium text-zinc-500 dark:text-zinc-400">Loading profile...</p>
            </div>
          ) : notFound || (!isOwn && !profile) ? (
            <div className="rounded-3xl border border-emerald-900/10 bg-white dark:bg-zinc-900 p-10 text-center shadow-sm">
              <p className="text-[15px] font-bold text-zinc-800 dark:text-zinc-100">Profile not found</p>
              <p className="mt-1 text-[12.5px] text-zinc-500 dark:text-zinc-400">This alumni profile does not exist.</p>
            </div>
          ) : (
            <>
              {/* Profile header */}
              <section className="overflow-hidden rounded-3xl border border-emerald-900/10 bg-white dark:bg-zinc-900 shadow-sm">
                <div
                  className="relative h-32 bg-gradient-to-br from-[#0F4C3A] via-[#007a2e] to-[#009639] sm:h-40"
                  style={{
                    backgroundImage:
                      'radial-gradient(circle at 15% 30%, rgba(255,255,255,0.18) 0 2px, transparent 3px), radial-gradient(circle at 30% 70%, rgba(255,255,255,0.12) 0 2px, transparent 3px), radial-gradient(circle at 70% 20%, rgba(255,255,255,0.15) 0 2px, transparent 3px), radial-gradient(circle at 85% 65%, rgba(255,255,255,0.18) 0 2px, transparent 3px), linear-gradient(to bottom right, #0F4C3A, #007a2e, #009639)',
                  }}
                />
                <div className="px-5 pb-5 sm:px-7">
                  <div className="-mt-10 flex flex-wrap items-end justify-between gap-3">
                    <div className="relative">
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white dark:bg-zinc-900 text-3xl font-extrabold text-[#009639] dark:text-emerald-300 shadow-lg ring-4 ring-white">
                        {(person?.name || 'A').charAt(0).toUpperCase()}
                      </div>
                      <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-white bg-[#009639]" title="Active" />
                    </div>
                    {isOwn && (
                      <button
                        type="button"
                        className="flex items-center gap-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 px-3.5 py-1.5 text-[12px] font-semibold text-zinc-600 dark:text-zinc-300 transition hover:border-emerald-300 hover:text-[#007a2e]"
                        aria-label="Edit profile"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit profile
                      </button>
                    )}
                  </div>

                  <h2 className="mt-3 flex items-center gap-1.5 text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
                    {person?.name || 'Alumni'}
                    <BadgeCheck className="h-5 w-5 shrink-0 text-[#009639] dark:text-emerald-300" />
                  </h2>
                  <p className="text-[13.5px] font-medium text-zinc-600 dark:text-zinc-300">
                    HR Manager at Tech Corp • CLSU Batch 2015 • BS Psychology
                  </p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-zinc-400 dark:text-zinc-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      Manila, Philippines
                    </span>
                    <span className="flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" />
                      {person?.email || 'alumni@clsu.edu.ph'}
                    </span>
                  </p>

                  {isOwn ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-full border border-zinc-300 px-5 py-2 text-[13px] font-bold text-zinc-600 dark:text-zinc-300 transition hover:border-[#009639] hover:text-[#007a2e]"
                      >
                        Edit profile
                      </button>
                      <button
                        type="button"
                        className="flex items-center gap-1.5 rounded-full border border-zinc-300 px-5 py-2 text-[13px] font-bold text-zinc-600 dark:text-zinc-300 transition hover:border-[#009639] hover:text-[#007a2e]"
                      >
                        <Share2 className="h-4 w-4" />
                        Share profile
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleConnect}
                        disabled={connectState !== 'none' || connectLoading}
                        className={`flex items-center gap-1.5 rounded-full px-5 py-2 text-[13px] font-bold shadow-sm transition disabled:cursor-default ${
                          connectState === 'connected'
                            ? 'border border-[#009639] text-[#007a2e]'
                            : connectState === 'pending'
                              ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                              : 'bg-[#009639] text-white shadow-emerald-900/20 hover:bg-[#007a2e]'
                        }`}
                      >
                        {connectState === 'connected' ? (
                          <><Check className="h-4 w-4" /> Connected</>
                        ) : connectState === 'pending' ? (
                          <><Clock className="h-4 w-4" /> Pending</>
                        ) : (
                          <><Plus className="h-4 w-4" /> {connectLoading ? 'Sending...' : 'Connect'}</>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => profile?.email && openChatByEmail(profile.email)}
                        className="rounded-full border border-zinc-300 px-5 py-2 text-[13px] font-bold text-zinc-600 dark:text-zinc-300 transition hover:border-[#009639] hover:text-[#007a2e]"
                      >
                        Message
                      </button>
                    </div>
                  )}
                </div>

                {/* Stats strip */}
                <div className="grid grid-cols-3 divide-x divide-zinc-100 dark:divide-zinc-800 border-t border-zinc-100 dark:border-zinc-800 bg-emerald-50/40">
                  {STATS.map(({ icon: Icon, value, label }) => (
                    <div key={label} className="flex items-center justify-center gap-2.5 px-2 py-3.5">
                      <span className="hidden h-9 w-9 items-center justify-center rounded-xl bg-white dark:bg-zinc-900 text-[#009639] dark:text-emerald-300 shadow-sm sm:flex">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="text-center sm:text-left">
                        <span className="block text-[16px] font-extrabold leading-none text-zinc-900 dark:text-zinc-100">{value}</span>
                        <span className="block text-[10.5px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{label}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              {/* About */}
              <section className="rounded-3xl border border-emerald-900/10 bg-white dark:bg-zinc-900 p-5 shadow-sm sm:p-6">
                <h3 className="flex items-center gap-2 text-[14px] font-bold text-zinc-900 dark:text-zinc-100">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#009639]/10 text-[#009639] dark:text-emerald-300">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  About
                </h3>
                <p className="mt-2.5 text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-300">
                  Proud CLSU graduate passionate about people, community, and lifelong learning.
                  Open to mentoring fellow Sielesyuans and collaborating on alumni initiatives that
                  give back to the university.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {SKILLS.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-[#007a2e] ring-1 ring-emerald-100 dark:ring-emerald-900"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </section>

              {/* Experience timeline */}
              <section className="rounded-3xl border border-emerald-900/10 bg-white dark:bg-zinc-900 p-5 shadow-sm sm:p-6">
                <h3 className="flex items-center gap-2 text-[14px] font-bold text-zinc-900 dark:text-zinc-100">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#009639]/10 text-[#009639] dark:text-emerald-300">
                    <Briefcase className="h-3.5 w-3.5" />
                  </span>
                  Experience
                </h3>
                <ol className="mt-3 space-y-0">
                  {EXPERIENCE.map((job, i) => (
                    <li key={job.role} className="relative flex gap-4 pb-6 last:pb-0">
                      {i < EXPERIENCE.length - 1 && (
                        <span className="absolute left-[15px] top-9 h-[calc(100%-2rem)] w-0.5 rounded bg-emerald-100" />
                      )}
                      <span className={`relative z-10 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white ${
                        job.current ? 'bg-[#009639] text-white' : 'bg-emerald-50 text-[#009639]'
                      }`}>
                        <Briefcase className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1 rounded-2xl bg-zinc-50 dark:bg-zinc-800/70 p-3.5 transition hover:bg-emerald-50/50">
                        <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-bold text-zinc-900 dark:text-zinc-100">
                          {job.role}
                          {job.current && (
                            <span className="rounded-full bg-[#009639] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                              Current
                            </span>
                          )}
                        </p>
                        <p className="text-[12px] font-medium text-zinc-600 dark:text-zinc-300">{job.company}</p>
                        <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">{job.period} • {job.location}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>

              {/* Education */}
              <section className="rounded-3xl border border-emerald-900/10 bg-white dark:bg-zinc-900 p-5 shadow-sm sm:p-6">
                <h3 className="flex items-center gap-2 text-[14px] font-bold text-zinc-900 dark:text-zinc-100">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#009639]/10 text-[#009639] dark:text-emerald-300">
                    <GraduationCap className="h-3.5 w-3.5" />
                  </span>
                  Education
                </h3>
                <div className="mt-3 flex items-center gap-3.5 rounded-2xl bg-gradient-to-r from-emerald-50 to-white p-4 ring-1 ring-emerald-100 dark:ring-emerald-900">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#009639] text-white shadow-sm">
                    <GraduationCap className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-bold text-zinc-900 dark:text-zinc-100">Central Luzon State University</p>
                    <p className="text-[12px] text-zinc-600 dark:text-zinc-300">BS Psychology</p>
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500">2011 — 2015 • Muñoz, Nueva Ecija</p>
                  </div>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default AlumniProfile;
