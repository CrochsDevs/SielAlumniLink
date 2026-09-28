import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import {
  Search,
  MapPin,
  Bookmark,
  Briefcase,
  Building2,
  Clock,
  ArrowLeft,
  ListChecks,
  FileCheck,
  SlidersHorizontal,
  PenLine,
  Trash2,
  Lightbulb,
  Map as MapIcon,
  MessageSquareQuote,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import AlumniSidebar from '../../layout/sidebar/alumni/alumniSidebar';
import AlumniTopbar from '../../layout/topbar/alumni/alumniTopbar';
import api from '../../utils/axios';

const formatPosted = (iso) => {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const AlumniCareer = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [saved, setSaved] = useState({});
  const [applied, setApplied] = useState({});
  const [tab, setTab] = useState('jobs');
  const [guides, setGuides] = useState([]);
  const [guidesLoading, setGuidesLoading] = useState(false);
  const [guideType, setGuideType] = useState('all');
  const [guideForm, setGuideForm] = useState({ title: '', body: '', type: 'advice', tags: '' });
  const [guideSaving, setGuideSaving] = useState(false);
  const [guideFormOpen, setGuideFormOpen] = useState(false);

  const canPost = ['admin', 'alumni'].includes(user?.role);

  useEffect(() => {
    api.get('/jobs')
      .then((res) => {
        const list = res.data.data || [];
        setJobs(list);
        if (list.length > 0) setSelectedId(list[0]._id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleSave = (id) => setSaved((prev) => ({ ...prev, [id]: !prev[id] }));
  const applyJob = (id) => setApplied((prev) => ({ ...prev, [id]: true }));

  const savedCount = Object.values(saved).filter(Boolean).length;
  const appliedCount = Object.values(applied).filter(Boolean).length;

  const filtered = jobs.filter(
    (job) =>
      (job.title || '').toLowerCase().includes(query.toLowerCase()) ||
      (job.company || '').toLowerCase().includes(query.toLowerCase())
  );

  const selected = jobs.find((j) => j._id === selectedId) || filtered[0];

  const fetchGuides = async () => {
    setGuidesLoading(true);
    try {
      const res = await api.get('/career-posts');
      setGuides(res.data.data || []);
    } catch {
      // stay silent — guides are secondary to jobs
    } finally {
      setGuidesLoading(false);
    }
  };

  const switchTab = (t) => {
    setTab(t);
    if (t === 'guides' && guides.length === 0) fetchGuides();
  };

  const handleGuideSave = async (id, savedByMe) => {
    try {
      const res = await api.post(`/career-posts/${id}/save`);
      setGuides((prev) => prev.map((g) =>
        g._id === id
          ? { ...g, savedByMe: res.data.data.saved, savesCount: (g.savesCount || 0) + (res.data.data.saved ? 1 : -1) }
          : g
      ));
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to save', 'error');
    }
  };

  const handleGuideDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Delete guide?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      confirmButtonColor: '#dc2626',
      reverseButtons: true,
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/career-posts/${id}`);
      setGuides((prev) => prev.filter((g) => g._id !== id));
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to delete', 'error');
    }
  };

  const handleGuidePost = async (e) => {
    e.preventDefault();
    setGuideSaving(true);
    try {
      await api.post('/career-posts', guideForm);
      setGuideForm({ title: '', body: '', type: 'advice', tags: '' });
      setGuideFormOpen(false);
      fetchGuides();
      Swal.fire({ title: 'Posted!', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to post', 'error');
    } finally {
      setGuideSaving(false);
    }
  };

  const filteredGuides = guides.filter((g) =>
    (guideType === 'all' || g.type === guideType) &&
    `${g.title} ${g.body}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#f4f2ee]">
      <AlumniSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />

      <div className="lg:pl-64">
        <AlumniTopbar user={user} title="Career" onMenuClick={() => setSidebarOpen(true)} />

        <main className="mx-auto max-w-6xl space-y-3 p-4 sm:p-6">
          {/* Tabs */}
          <div className="flex gap-1.5">
            {[
              { key: 'jobs', label: 'Job Board' },
              { key: 'guides', label: 'Career Guides' },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => switchTab(key)}
                className={`rounded-full px-4 py-2 text-[12.5px] font-bold transition ${
                  tab === key ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-500 border border-zinc-200 hover:text-zinc-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'guides' ? (
          <section className="space-y-3">
            {canPost && (
              <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                {!guideFormOpen ? (
                  <button
                    type="button"
                    onClick={() => setGuideFormOpen(true)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#009639] py-2.5 text-[13px] font-bold text-white transition hover:bg-[#007a2e]"
                  >
                    <PenLine className="h-4 w-4" />
                    Share career advice, insight, or roadmap
                  </button>
                ) : (
                  <form onSubmit={handleGuidePost} className="space-y-2.5">
                    <input
                      value={guideForm.title}
                      onChange={(e) => setGuideForm({ ...guideForm, title: e.target.value })}
                      required
                      placeholder="Title — e.g. How to pass technical interviews"
                      className="h-10 w-full rounded-xl border border-zinc-200 px-3.5 text-[13px] outline-none focus:border-[#009639] focus:ring-2 focus:ring-[#009639]/15"
                    />
                    <div className="flex gap-2">
                      <select
                        value={guideForm.type}
                        onChange={(e) => setGuideForm({ ...guideForm, type: e.target.value })}
                        className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-[12.5px] font-medium outline-none focus:border-[#009639]"
                      >
                        <option value="advice">Career Advice</option>
                        <option value="insight">Industry Insight</option>
                        <option value="roadmap">Career Roadmap</option>
                      </select>
                      <input
                        value={guideForm.tags}
                        onChange={(e) => setGuideForm({ ...guideForm, tags: e.target.value })}
                        placeholder="Tags (comma-separated)"
                        className="h-10 flex-1 rounded-xl border border-zinc-200 px-3.5 text-[13px] outline-none focus:border-[#009639] focus:ring-2 focus:ring-[#009639]/15"
                      />
                    </div>
                    <textarea
                      value={guideForm.body}
                      onChange={(e) => setGuideForm({ ...guideForm, body: e.target.value })}
                      rows={4}
                      placeholder="Write your guide..."
                      className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-[13px] outline-none focus:border-[#009639] focus:ring-2 focus:ring-[#009639]/15"
                    />
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setGuideFormOpen(false)}
                        className="h-9 rounded-xl px-4 text-[12.5px] font-bold text-zinc-500 hover:bg-zinc-100">
                        Cancel
                      </button>
                      <button type="submit" disabled={guideSaving}
                        className="h-9 rounded-xl bg-[#009639] px-5 text-[12.5px] font-bold text-white hover:bg-[#007a2e] disabled:opacity-60">
                        {guideSaving ? 'Posting...' : 'Post guide'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              {['all', 'advice', 'insight', 'roadmap'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setGuideType(t)}
                  className={`rounded-full px-3 py-1.5 text-[11.5px] font-bold capitalize transition ${
                    guideType === t ? 'bg-[#009639] text-white' : 'bg-white text-zinc-500 border border-zinc-200 hover:text-zinc-900'
                  }`}
                >
                  {t === 'all' ? 'All' : t === 'advice' ? 'Career Advice' : t === 'insight' ? 'Industry Insights' : 'Roadmaps'}
                </button>
              ))}
            </div>

            {guidesLoading ? (
              <p className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-[13px] text-zinc-500 shadow-sm">
                Loading guides...
              </p>
            ) : filteredGuides.length === 0 ? (
              <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
                <p className="text-[13px] font-bold text-zinc-800">No guides yet</p>
                <p className="text-[12px] text-zinc-500">Be the first alumni to share one.</p>
              </div>
            ) : (
              filteredGuides.map((g) => {
                const TypeIcon = g.type === 'insight' ? Lightbulb : g.type === 'roadmap' ? MapIcon : MessageSquareQuote;
                const canDelete = user?.role === 'admin' || String(g.authorAuthId) === String(user?._id);
                return (
                  <article key={g._id} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#009639]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide text-[#007a2e]">
                        <TypeIcon className="h-3 w-3" />
                        {g.type}
                      </span>
                      {canDelete && (
                        <button type="button" onClick={() => handleGuideDelete(g._id)}
                          className="rounded-lg p-1.5 text-zinc-300 transition hover:bg-red-50 hover:text-red-600" aria-label="Delete guide">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <h3 className="mt-2 text-[15px] font-extrabold tracking-tight text-zinc-900">{g.title}</h3>
                    <p className="mt-1 text-[12.5px] text-zinc-500">
                      by {g.authorName || g.authorEmail} • {formatPosted(g.createdAt)}
                    </p>
                    <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-zinc-700">{g.body}</p>
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
                      onClick={() => handleGuideSave(g._id, g.savedByMe)}
                      className={`mt-3 flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-bold transition ${
                        g.savedByMe ? 'bg-[#009639] text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}
                    >
                      <Bookmark className={`h-3.5 w-3.5 ${g.savedByMe ? 'fill-current' : ''}`} />
                      {g.savedByMe ? 'Saved' : 'Save'}
                      {g.savesCount > 0 && <span>• {g.savesCount}</span>}
                    </button>
                  </article>
                );
              })
            )}
          </section>
          ) : (
          <>
          {/* Search */}
          <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title or company..."
                className="h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-10 pr-4 text-[13px] outline-none transition focus:border-[#009639] focus:bg-white focus:ring-2 focus:ring-[#009639]/15"
              />
            </div>
          </div>

          <div className="grid items-start gap-3 lg:grid-cols-[220px_minmax(0,1fr)_minmax(0,1.2fr)]">
            {/* LEFT: my jobs */}
            <aside className="hidden rounded-xl border border-zinc-200 bg-white shadow-sm lg:block">
              <p className="border-b border-zinc-100 px-4 py-3 text-[13px] font-bold text-zinc-900">My jobs</p>
              <ul className="p-2">
                {[
                  { icon: Bookmark, label: 'Saved', count: savedCount },
                  { icon: FileCheck, label: 'Applied', count: appliedCount },
                  { icon: ListChecks, label: 'Preferences', count: null },
                  { icon: SlidersHorizontal, label: 'Job alerts', count: null },
                ].map(({ icon: Icon, label, count }) => (
                  <li key={label}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[12.5px] font-medium text-zinc-600 transition hover:bg-zinc-100"
                    >
                      <Icon className="h-4 w-4 text-zinc-400" />
                      <span className="flex-1">{label}</span>
                      {count !== null && (
                        <span className="text-[11.5px] font-bold text-[#009639]">{count}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </aside>

            {/* CENTER: compact list (hidden on mobile when a job is open) */}
            <section className={`space-y-2 ${selected ? 'hidden lg:block' : 'block'}`}>
              {filtered.map((job) => (
                <button
                  key={job._id}
                  type="button"
                  onClick={() => setSelectedId(job._id)}
                  className={`w-full rounded-xl border bg-white p-4 text-left shadow-sm transition hover:shadow-md ${
                    selected?._id === job._id ? 'border-[#009639] ring-1 ring-[#009639]/30' : 'border-zinc-200'
                  }`}
                >
                  <div className="flex gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#009639]/10 text-[#009639]">
                      <Building2 className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-bold text-zinc-900 hover:text-[#009639] hover:underline">
                        {job.title}
                      </span>
                      <span className="block truncate text-[12px] text-zinc-600">{job.company}</span>
                      <span className="block truncate text-[11.5px] text-zinc-400">
                        {job.location}{job.location && job.mode ? ' • ' : ''}{job.mode} • {formatPosted(job.createdAt)}
                      </span>
                      <span className="mt-1 flex items-center gap-2 text-[11px] text-zinc-400">
                        <Clock className="h-3 w-3" />
                        {job.type}
                        {applied[job._id] && (
                          <span className="font-bold text-[#009639]">• Applied</span>
                        )}
                      </span>
                    </span>
                  </div>
                </button>
              ))}
              {loading ? (
                <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
                  <p className="text-[13px] text-zinc-500">Loading jobs...</p>
                </div>
              ) : filtered.length === 0 && (
                <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
                  <p className="text-[13px] font-bold text-zinc-800">
                    {jobs.length === 0 ? 'No job posts yet' : 'No jobs found'}
                  </p>
                  <p className="text-[12px] text-zinc-500">
                    {jobs.length === 0 ? 'Check back soon for openings.' : 'Try a different keyword.'}
                  </p>
                </div>
              )}
            </section>

            {/* RIGHT: detail (mobile: replaces list with back) */}
            {selected && (
              <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm lg:sticky lg:top-20">
                <div className="border-b border-zinc-100 p-5">
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="mb-2 flex items-center gap-1 text-[12px] font-semibold text-zinc-500 hover:text-[#007a2e] lg:hidden"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to jobs
                  </button>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-extrabold tracking-tight text-zinc-900">{selected.title}</h2>
                      <p className="text-[13px] text-zinc-600">{selected.company} • {selected.type}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-[12px] text-zinc-400">
                        <MapPin className="h-3.5 w-3.5" />
                        {selected.location}{selected.location && selected.mode ? ' • ' : ''}{selected.mode} • {formatPosted(selected.createdAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSave(selected._id)}
                      className={`rounded-full p-2.5 transition ${
                        saved[selected._id] ? 'bg-[#009639]/10 text-[#009639]' : 'text-zinc-300 hover:bg-zinc-100'
                      }`}
                      aria-label="Save job"
                    >
                      <Bookmark className={`h-5 w-5 ${saved[selected._id] ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(selected.tags || []).map((tag) => (
                      <span key={tag} className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10.5px] font-semibold text-zinc-600">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => applyJob(selected._id)}
                      disabled={applied[selected._id]}
                      className={`flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-[13px] font-bold transition disabled:cursor-default ${
                        applied[selected._id]
                          ? 'bg-emerald-50 text-[#007a2e]'
                          : 'bg-[#009639] text-white hover:bg-[#007a2e]'
                      }`}
                    >
                      <Briefcase className="h-4 w-4" />
                      {applied[selected._id] ? 'Applied' : 'Easy Apply'}
                    </button>
                  </div>
                </div>
                <div className="max-h-80 overflow-y-auto p-5">
                  <h3 className="text-[13px] font-bold text-zinc-900">About the role</h3>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-600">
                    {selected.description || 'No description provided.'}
                  </p>
                </div>
              </section>
            )}
          </div>
          </>
          )}
        </main>
      </div>
    </div>
  );
};

export default AlumniCareer;
