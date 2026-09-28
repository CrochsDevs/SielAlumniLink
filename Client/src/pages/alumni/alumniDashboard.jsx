import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import AlumniSidebar from '../../layout/sidebar/alumni/alumniSidebar';
import AlumniTopbar from '../../layout/topbar/alumni/alumniTopbar';

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
    text: 'Fellow Sielesyuans! We are hiring management trainees — fresh graduates are welcome. Just send me a message. 🎓',
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
    text: 'Grand Alumni Homecoming 2026 — save the date! Registration opens next week. See you there, Sielesyuans!',
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
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [liked, setLiked] = useState({});
  const [composer, setComposer] = useState('');

  const toggleLike = (id) => setLiked((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="min-h-screen bg-[#f3f6f3]">
      <AlumniSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />

      <div className="lg:pl-64">
        <AlumniTopbar user={user} title="Dashboard" onMenuClick={() => setSidebarOpen(true)} />

        <main className="mx-auto grid max-w-6xl gap-4 p-4 sm:p-6 lg:grid-cols-[250px_minmax(0,1fr)_300px]">
          {/* LEFT: Sielesyuans ID card */}
          <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
            <div className="overflow-hidden rounded-2xl border border-emerald-900/10 bg-white shadow-sm">
              <div className="h-16 bg-gradient-to-r from-[#0F4C3A] via-[#007a2e] to-[#009639]" />
              <div className="px-4 pb-4 text-center">
                <div className="mx-auto -mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-white text-xl font-extrabold text-[#009639] shadow ring-2 ring-emerald-100">
                  {(user?.name || 'A').charAt(0).toUpperCase()}
                </div>
                <p className="mt-2 flex items-center justify-center gap-1 text-[14px] font-bold text-zinc-900">
                  <span className="truncate">{user?.name || 'Alumni'}</span>
                  <BadgeCheck className="h-4 w-4 shrink-0 text-[#009639]" />
                </p>
                <p className="text-[11.5px] text-zinc-500">BS Program • Batch 20XX</p>
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#009639]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#007a2e]">
                  <GraduationCap className="h-3 w-3" />
                  Verified Alumni
                </span>
                <div className="mt-3 space-y-1 border-t border-zinc-100 pt-3 text-left text-[11.5px]">
                  <button type="button" className="flex w-full justify-between py-0.5 text-zinc-500 transition hover:text-[#009639]">
                    <span>Profile viewers</span>
                    <span className="font-bold text-[#009639]">127</span>
                  </button>
                  <button type="button" className="flex w-full justify-between py-0.5 text-zinc-500 transition hover:text-[#009639]">
                    <span>Fellow Sielesyuans</span>
                    <span className="font-bold text-[#009639]">248</span>
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
                className="mt-3 w-full rounded-xl bg-white py-2 text-[12px] font-bold text-[#007a2e] transition hover:bg-emerald-50"
              >
                Answer now
              </button>
            </div>
          </aside>

          {/* CENTER: kamustahan feed */}
          <section className="min-w-0 space-y-3">
            <div className="rounded-2xl border border-emerald-900/10 bg-white p-3 shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#009639]/10 text-sm font-bold text-[#009639]">
                  {(user?.name || 'A').charAt(0).toUpperCase()}
                </div>
                <button
                  type="button"
                  className="h-11 flex-1 rounded-2xl border border-zinc-200 bg-[#f3f6f3] px-4 text-left text-[13px] font-medium text-zinc-500 transition hover:border-emerald-300 hover:bg-emerald-50/50"
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
                    className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[12px] font-semibold text-zinc-500 transition hover:bg-emerald-50 hover:text-[#007a2e]"
                  >
                    <Icon className="h-4 w-4 text-[#009639]" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {POSTS.map((post) => (
              <article key={post.id} className="rounded-2xl border border-emerald-900/10 bg-white shadow-sm">
                <div className="flex gap-2.5 p-4 pb-2">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#009639]/10 text-sm font-bold text-[#009639]">
                    {post.initial}
                  </div>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 truncate text-[13px] font-bold text-zinc-900">
                      {post.name}
                      {post.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#009639]" />}
                    </p>
                    <p className="truncate text-[11px] text-zinc-500">{post.meta}</p>
                    <p className="text-[11px] text-zinc-400">{post.time}</p>
                  </div>
                </div>
                <p className="px-4 pb-3 text-[13px] leading-relaxed text-zinc-800">{post.text}</p>
                <p className="flex items-center gap-1.5 border-t border-zinc-100 px-4 py-2 text-[11.5px] font-medium text-zinc-500">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#009639]">
                    <ThumbsUp className="h-2.5 w-2.5 text-white" />
                  </span>
                  {post.likes + (liked[post.id] ? 1 : 0)} • {post.comments} comments
                </p>
                <div className="flex gap-1 border-t border-zinc-100 px-3 py-1.5">
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
          </section>

          {/* RIGHT: CLSU events + Sielesyuans to meet */}
          <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
            <div className="overflow-hidden rounded-2xl border border-emerald-900/10 bg-white shadow-sm">
              <div className="bg-gradient-to-r from-[#0F4C3A] to-[#009639] px-4 py-2.5">
                <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-white">
                  <MapPin className="h-3.5 w-3.5" />
                  At CLSU Today
                </p>
              </div>
              <ul className="space-y-3 p-4">
                {EVENTS.map((item) => (
                  <li key={item.title} className="cursor-pointer">
                    <p className="text-[12px] font-semibold leading-snug text-zinc-800 transition hover:text-[#009639]">
                      {item.title}
                    </p>
                    <p className="text-[10.5px] text-zinc-400">{item.meta}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-emerald-900/10 bg-white p-4 shadow-sm">
              <p className="text-[13px] font-bold text-zinc-900">Meet fellow Sielesyuans</p>
              <ul className="mt-2 space-y-3">
                {SUGGESTIONS.map((person) => (
                  <li key={person.name} className="flex items-start gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#009639]/10 text-xs font-bold text-[#009639]">
                      {person.initial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-bold text-zinc-800">{person.name}</p>
                      <p className="truncate text-[10.5px] text-zinc-500">{person.meta}</p>
                      <button
                        type="button"
                        className="mt-1.5 rounded-full bg-[#009639]/10 px-3 py-1 text-[11px] font-bold text-[#007a2e] transition hover:bg-[#009639] hover:text-white"
                      >
                        + connect
                      </button>
                    </div>
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
