import { useState } from 'react';
import Swal from 'sweetalert2';
import { Trophy, ThumbsUp, MessageSquare, PenLine, BadgeCheck, Quote } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import AlumniSidebar from '../../layout/sidebar/alumni/alumniSidebar';
import AlumniTopbar from '../../layout/topbar/alumni/alumniTopbar';

// TEMPORARY content — papalitan ng totoong data mula sa API.
// TODO(alumni): wire stories to backend endpoints.
const INITIAL_STORIES = [
  {
    id: 1,
    name: 'Jose Ramos',
    meta: 'Software Engineer • Batch 2019',
    initial: 'J',
    title: 'From scholar to senior engineer in 5 years',
    text: 'I entered CLSU as a scholar with nothing but grit. Today I lead a team of six. To every Sielesyuans reading this: your batch, your professors, and this network will carry you far.',
    likes: 214,
    comments: 36,
    featured: true,
  },
  {
    id: 2,
    name: 'Maria Santos',
    meta: 'HR Manager • Batch 2015',
    initial: 'M',
    title: 'Hired 20+ fellow Sielesyuans and counting',
    text: 'Every time I open a role, I look at CLSU graduates first. Our work ethic speaks for itself — 20 hires later, I have zero regrets.',
    likes: 156,
    comments: 24,
    featured: false,
  },
  {
    id: 3,
    name: 'Ana Cruz',
    meta: 'Data Analyst • Batch 2020',
    initial: 'A',
    title: 'Career shift at 28 — it is never too late',
    text: 'I was a teacher for 4 years before pivoting to data. The alumni mentorship circle helped me build my portfolio. Now I analyze data for a living.',
    likes: 98,
    comments: 17,
    featured: false,
  },
];

const StoryCard = ({ story, liked, onLike }) => (
  <article className="flex flex-col rounded-3xl border border-emerald-900/10 bg-white p-5 shadow-sm transition hover:shadow-md">
    <div className="flex items-center gap-2.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#009639]/10 text-sm font-bold text-[#009639]">
        {story.initial}
      </span>
      <div className="min-w-0">
        <p className="flex items-center gap-1 truncate text-[13px] font-bold text-zinc-900">
          {story.name}
          <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#009639]" />
        </p>
        <p className="truncate text-[11px] text-zinc-500">{story.meta}</p>
      </div>
    </div>
    <h3 className="mt-3 text-[14.5px] font-extrabold leading-snug tracking-tight text-zinc-900">
      {story.title}
    </h3>
    <p className="mt-1.5 flex-1 text-[12.5px] leading-relaxed text-zinc-600">{story.text}</p>
    <div className="mt-3 flex items-center gap-1 border-t border-zinc-100 pt-2.5">
      <button
        type="button"
        onClick={onLike}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition hover:bg-emerald-50 ${
          liked ? 'text-[#009639]' : 'text-zinc-500'
        }`}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
        {story.likes + (liked ? 1 : 0)}
      </button>
      <span className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-semibold text-zinc-500">
        <MessageSquare className="h-3.5 w-3.5" />
        {story.comments}
      </span>
    </div>
  </article>
);

const AlumniSuccess = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stories, setStories] = useState(INITIAL_STORIES);
  const [liked, setLiked] = useState({});
  const [form, setForm] = useState({ title: '', text: '' });
  const [sharing, setSharing] = useState(false);

  const toggleLike = (id) => setLiked((prev) => ({ ...prev, [id]: !prev[id] }));

  const inputClass =
    'w-full rounded-xl border border-zinc-200 bg-zinc-50/60 px-3.5 py-2.5 text-[13px] outline-none transition focus:border-[#009639] focus:bg-white focus:ring-2 focus:ring-[#009639]/15';

  const handleShare = (e) => {
    e.preventDefault();
    setSharing(true);
    setTimeout(() => {
      setStories((prev) => [
        {
          id: Date.now(),
          name: user?.name || 'Alumni',
          meta: `${user?.role === 'student' ? 'Student' : 'Alumni'} • CLSU`,
          initial: (user?.name || 'A').charAt(0).toUpperCase(),
          title: form.title,
          text: form.text,
          likes: 0,
          comments: 0,
          featured: false,
        },
        ...prev,
      ]);
      setForm({ title: '', text: '' });
      setSharing(false);
      Swal.fire({ title: 'Shared!', text: 'Your story inspires fellow Sielesyuans.', icon: 'success', timer: 1500, showConfirmButton: false });
    }, 600);
  };

  const featured = stories.find((s) => s.featured);
  const rest = stories.filter((s) => !s.featured);

  return (
    <div className="min-h-screen bg-[#f3f6f3]">
      <AlumniSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />

      <div className="lg:pl-64">
        <AlumniTopbar user={user} title="Success Stories" onMenuClick={() => setSidebarOpen(true)} />

        <main className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
          {/* Featured story */}
          {featured && (
            <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F4C3A] via-[#007a2e] to-[#009639] p-6 text-white shadow-lg shadow-emerald-900/10 sm:p-8">
              <Quote className="absolute -right-4 -top-4 h-32 w-32 text-white/10" />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider">
                <Trophy className="h-3 w-3" />
                Featured Story
              </span>
              <h2 className="mt-3 max-w-2xl text-xl font-extrabold leading-tight tracking-tight sm:text-2xl">
                {featured.title}
              </h2>
              <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-white/80">{featured.text}</p>
              <p className="mt-3 text-[12px] font-semibold text-white/90">
                — {featured.name}, {featured.meta}
              </p>
            </section>
          )}

          {/* Share form */}
          <section className="rounded-3xl border border-emerald-900/10 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-[14px] font-extrabold text-zinc-900">
              <PenLine className="h-4 w-4 text-[#009639]" />
              Share your story
            </h2>
            <form onSubmit={handleShare} className="mt-3 space-y-2.5">
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                required placeholder="Story title — e.g. From scholar to CEO" className={inputClass} />
              <textarea value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })}
                required rows={3} placeholder="Tell fellow Sielesyuans your journey..."
                className={inputClass} />
              <div className="flex justify-end">
                <button type="submit" disabled={sharing}
                  className="h-10 rounded-xl bg-[#009639] px-6 text-[13px] font-bold text-white transition hover:bg-[#007a2e] disabled:opacity-60">
                  {sharing ? 'Sharing...' : 'Share story'}
                </button>
              </div>
            </form>
          </section>

          {/* Story grid */}
          <div className="grid gap-4 md:grid-cols-2">
            {rest.map((story) => (
              <StoryCard key={story.id} story={story} liked={liked[story.id]} onLike={() => toggleLike(story.id)} />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AlumniSuccess;
