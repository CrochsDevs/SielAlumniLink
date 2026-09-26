import { useState } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import AlumniSidebar from '../../layout/sidebar/alumni/alumniSidebar';
import AlumniTopbar from '../../layout/topbar/alumni/alumniTopbar';

// TEMPORARY content — papalitan ng totoong data mula sa API.
// TODO(alumni): wire jobs to backend endpoints.
const JOBS = [
  {
    id: 1,
    role: 'Software Engineer',
    company: 'Tech Corp',
    location: 'Makati City • Hybrid',
    type: 'Full-time',
    posted: '2d ago',
    applicants: 48,
    tags: ['React', 'Node.js'],
    about:
      'We are looking for a passionate Software Engineer to join our growing team. You will build products used by thousands of Filipinos every day.',
    responsibilities: ['Build and ship web features', 'Collaborate with designers', 'Write clean, tested code'],
  },
  {
    id: 2,
    role: 'Data Analyst',
    company: 'DataHub',
    location: 'Remote',
    type: 'Full-time',
    posted: '5h ago',
    applicants: 112,
    tags: ['SQL', 'Python'],
    about:
      'Turn raw data into decisions. Join our analytics team and help shape product strategy with insights.',
    responsibilities: ['Build dashboards', 'Run ad-hoc analyses', 'Present findings to stakeholders'],
  },
  {
    id: 3,
    role: 'HR Associate',
    company: 'CLSU Partner Org',
    location: 'Muñoz, Nueva Ecija • On-site',
    type: 'Full-time',
    posted: '1w ago',
    applicants: 23,
    tags: ['Recruitment'],
    about:
      'Support hiring and employee engagement for a CLSU partner organization. Fresh graduates are welcome.',
    responsibilities: ['Screen applicants', 'Coordinate interviews', 'Assist onboarding'],
  },
  {
    id: 4,
    role: 'Marketing Specialist',
    company: 'Innovate Inc',
    location: 'Clark, Pampanga • On-site',
    type: 'Contract',
    posted: '3d ago',
    applicants: 67,
    tags: ['SEO', 'Content'],
    about:
      'Drive content and campaigns for a fast-growing startup. Contract role with possible regularization.',
    responsibilities: ['Manage social channels', 'Write SEO content', 'Track campaign metrics'],
  },
];

const AlumniCareer = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(JOBS[0].id);
  const [saved, setSaved] = useState({});
  const [applied, setApplied] = useState({});

  const toggleSave = (id) => setSaved((prev) => ({ ...prev, [id]: !prev[id] }));
  const applyJob = (id) => setApplied((prev) => ({ ...prev, [id]: true }));

  const savedCount = Object.values(saved).filter(Boolean).length;
  const appliedCount = Object.values(applied).filter(Boolean).length;

  const filtered = JOBS.filter(
    (job) =>
      job.role.toLowerCase().includes(query.toLowerCase()) ||
      job.company.toLowerCase().includes(query.toLowerCase())
  );

  const selected = JOBS.find((j) => j.id === selectedId) || filtered[0];

  return (
    <div className="min-h-screen bg-[#f4f2ee]">
      <AlumniSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />

      <div className="lg:pl-64">
        <AlumniTopbar user={user} title="Career" onMenuClick={() => setSidebarOpen(true)} />

        <main className="mx-auto max-w-6xl space-y-3 p-4 sm:p-6">
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
                  key={job.id}
                  type="button"
                  onClick={() => setSelectedId(job.id)}
                  className={`w-full rounded-xl border bg-white p-4 text-left shadow-sm transition hover:shadow-md ${
                    selected?.id === job.id ? 'border-[#009639] ring-1 ring-[#009639]/30' : 'border-zinc-200'
                  }`}
                >
                  <div className="flex gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#009639]/10 text-[#009639]">
                      <Building2 className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-bold text-zinc-900 hover:text-[#009639] hover:underline">
                        {job.role}
                      </span>
                      <span className="block truncate text-[12px] text-zinc-600">{job.company}</span>
                      <span className="block truncate text-[11.5px] text-zinc-400">
                        {job.location} • {job.posted}
                      </span>
                      <span className="mt-1 flex items-center gap-2 text-[11px] text-zinc-400">
                        <Clock className="h-3 w-3" />
                        {job.applicants} applicants
                        {applied[job.id] && (
                          <span className="font-bold text-[#009639]">• Applied</span>
                        )}
                      </span>
                    </span>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
                  <p className="text-[13px] font-bold text-zinc-800">No jobs found</p>
                  <p className="text-[12px] text-zinc-500">Try a different keyword.</p>
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
                      <h2 className="text-lg font-extrabold tracking-tight text-zinc-900">{selected.role}</h2>
                      <p className="text-[13px] text-zinc-600">{selected.company} • {selected.type}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-[12px] text-zinc-400">
                        <MapPin className="h-3.5 w-3.5" />
                        {selected.location} • {selected.posted}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSave(selected.id)}
                      className={`rounded-full p-2.5 transition ${
                        saved[selected.id] ? 'bg-[#009639]/10 text-[#009639]' : 'text-zinc-300 hover:bg-zinc-100'
                      }`}
                      aria-label="Save job"
                    >
                      <Bookmark className={`h-5 w-5 ${saved[selected.id] ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selected.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10.5px] font-semibold text-zinc-600">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => applyJob(selected.id)}
                      disabled={applied[selected.id]}
                      className={`flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-[13px] font-bold transition disabled:cursor-default ${
                        applied[selected.id]
                          ? 'bg-emerald-50 text-[#007a2e]'
                          : 'bg-[#009639] text-white hover:bg-[#007a2e]'
                      }`}
                    >
                      <Briefcase className="h-4 w-4" />
                      {applied[selected.id] ? 'Applied' : 'Click Apply'}
                    </button>
                  </div>
                </div>
                <div className="max-h-80 overflow-y-auto p-5">
                  <h3 className="text-[13px] font-bold text-zinc-900">About the role</h3>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-600">{selected.about}</p>
                  <h3 className="mt-4 text-[13px] font-bold text-zinc-900">What you'll do</h3>
                  <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[12.5px] text-zinc-600">
                    {selected.responsibilities.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AlumniCareer;
