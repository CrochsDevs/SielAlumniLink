import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { Search, Bookmark, Lightbulb, Map as MapIcon, MessageSquareQuote, Plus, X } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import StudentSidebar from '../../layout/sidebar/student/studentSidebar';
import StudentTopbar from '../../layout/topbar/student/studentTopbar';
import api from '../../utils/axios';

const INTEREST_OPTIONS = [
  'Software Development', 'Data Science', 'Human Resources', 'Marketing',
  'Engineering', 'Education', 'Healthcare', 'Business', 'Design', 'Research',
];

const StudentCareer = () => {
  const { user, refreshUser } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tab, setTab] = useState('explore');
  const [guides, setGuides] = useState([]);
  const [saved, setSaved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [interests, setInterests] = useState([]);
  const [savingInterests, setSavingInterests] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/career-posts'), api.get('/career-posts/saved/me'), api.get('/auth/me')])
      .then(([guidesRes, savedRes, meRes]) => {
        setGuides(guidesRes.data.data || []);
        setSaved(savedRes.data.data || []);
        setInterests(meRes.data.data?.interests || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleSave = async (id, currentlySaved) => {
    try {
      await api.post(`/career-posts/${id}/save`);
      const [guidesRes, savedRes] = await Promise.all([api.get('/career-posts'), api.get('/career-posts/saved/me')]);
      setGuides(guidesRes.data.data || []);
      setSaved(savedRes.data.data || []);
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to save', 'error');
    }
  };

  const toggleInterest = (tag) => {
    setInterests((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const saveInterests = async () => {
    setSavingInterests(true);
    try {
      await api.put('/users/me', { interests });
      await refreshUser();
      Swal.fire({ title: 'Saved', text: 'Career interests updated.', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to save interests', 'error');
    } finally {
      setSavingInterests(false);
    }
  };

  const list = tab === 'saved' ? saved : guides;
  const filtered = list.filter((g) =>
    (typeFilter === 'all' || g.type === typeFilter) &&
    `${g.title} ${g.body}`.toLowerCase().includes(query.toLowerCase())
  );

  const GuideCard = ({ g }) => {
    const TypeIcon = g.type === 'insight' ? Lightbulb : g.type === 'roadmap' ? MapIcon : MessageSquareQuote;
    return (
      <article className="rounded-2xl border border-zinc-200 bg-white p-5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
          <TypeIcon className="h-3 w-3" />
          {g.type}
        </span>
        <h3 className="mt-2 text-[15px] font-extrabold tracking-tight text-zinc-900">{g.title}</h3>
        <p className="mt-0.5 text-[12px] text-zinc-400">by {g.authorName || g.authorEmail}</p>
        <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-zinc-600">{g.body}</p>
        {(g.tags || []).length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {g.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10.5px] font-semibold text-zinc-600">
                {tag}
              </span>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => toggleSave(g._id, g.savedByMe)}
          className={`mt-3 flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-bold transition ${
            g.savedByMe || tab === 'saved' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          <Bookmark className={`h-3.5 w-3.5 ${(g.savedByMe || tab === 'saved') ? 'fill-current' : ''}`} />
          {g.savedByMe || tab === 'saved' ? 'Saved' : 'Save resource'}
          {g.savesCount > 0 && <span>• {g.savesCount}</span>}
        </button>
      </article>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <StudentSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />

      <div className="lg:pl-64">
        <StudentTopbar user={user} title="Career" onMenuClick={() => setSidebarOpen(true)} />

        <main className="mx-auto max-w-4xl space-y-3 p-4 sm:p-6">
          <div className="flex gap-1.5">
            {[
              { key: 'explore', label: 'Explore Guides' },
              { key: 'saved', label: `Saved (${saved.length})` },
              { key: 'interests', label: 'My Interests' },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`rounded-full px-4 py-2 text-[12.5px] font-bold transition ${
                  tab === key ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-500 border border-zinc-200 hover:text-zinc-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'interests' ? (
            <section className="rounded-2xl border border-zinc-200 bg-white p-5">
              <h2 className="text-[15px] font-extrabold text-zinc-900">Track career interests</h2>
              <p className="text-[12px] text-zinc-500">Pick topics you want to follow.</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {INTEREST_OPTIONS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleInterest(tag)}
                    className={`rounded-full px-3.5 py-1.5 text-[12px] font-bold transition ${
                      interests.includes(tag) ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={saveInterests}
                disabled={savingInterests}
                className="mt-4 h-10 rounded-xl bg-zinc-900 px-6 text-[13px] font-bold text-white hover:bg-zinc-800 disabled:opacity-60"
              >
                {savingInterests ? 'Saving...' : 'Save interests'}
              </button>
            </section>
          ) : (
            <>
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search guides..."
                    className="h-10 w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 text-[12.5px] outline-none focus:border-zinc-900"
                  />
                </div>
                <div className="flex gap-1.5">
                  {['all', 'advice', 'insight', 'roadmap'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTypeFilter(t)}
                      className={`rounded-full px-3 py-1.5 text-[11.5px] font-bold capitalize transition ${
                        typeFilter === t ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-500 border border-zinc-200'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {loading ? (
                <p className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-[13px] text-zinc-500">
                  Loading...
                </p>
              ) : filtered.length === 0 ? (
                <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center">
                  <p className="text-[14px] font-bold text-zinc-800">
                    {tab === 'saved' ? 'No saved resources yet' : 'No guides yet'}
                  </p>
                  <p className="mt-0.5 text-[12px] text-zinc-500">
                    {tab === 'saved' ? 'Save guides from Explore to find them here.' : 'Alumni guides will appear here.'}
                  </p>
                </div>
              ) : (
                filtered.map((g) => <GuideCard key={g._id} g={g} />)
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default StudentCareer;
