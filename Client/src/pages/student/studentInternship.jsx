import { useState } from 'react';
import { Briefcase, Building2, Clock, CheckCircle2, MapPin } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import StudentSidebar from '../../layout/sidebar/student/studentSidebar';
import StudentTopbar from '../../layout/topbar/student/studentTopbar';

// TEMPORARY content — papalitan ng totoong data mula sa API.
// TODO(student): wire internship to backend endpoints.
const PLACEMENTS = [
  {
    id: 1,
    company: 'Tech Corp',
    role: 'IT Intern',
    location: 'Makati City • Hybrid',
    slots: 5,
    status: 'Open',
  },
  {
    id: 2,
    company: 'DataHub',
    role: 'Data Intern',
    location: 'Remote',
    slots: 3,
    status: 'Open',
  },
  {
    id: 3,
    company: 'CLSU ICTC',
    role: 'Support Intern',
    location: 'Muñoz, Nueva Ecija • On-site',
    slots: 0,
    status: 'Full',
  },
];

const REQUIRED_HOURS = 486;
const RENDERED_HOURS = 120;

const StudentInternship = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [applied, setApplied] = useState({});
  const pct = Math.round((RENDERED_HOURS / REQUIRED_HOURS) * 100);

  return (
    <div className="min-h-screen bg-zinc-50">
      <StudentSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />

      <div className="lg:pl-64">
        <StudentTopbar user={user} title="Internship" onMenuClick={() => setSidebarOpen(true)} />

        <main className="mx-auto max-w-4xl space-y-3 p-4 sm:p-6">
          {/* Hours tracker */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h1 className="flex items-center gap-2 text-[15px] font-extrabold text-zinc-900">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-900 text-white">
                  <Clock className="h-4 w-4" />
                </span>
                OJT Hours
              </h1>
              <p className="text-[13px] font-bold text-zinc-900">
                {RENDERED_HOURS} <span className="font-medium text-zinc-400">/ {REQUIRED_HOURS} hrs</span>
              </p>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-zinc-100">
              <div className="h-full rounded-full bg-zinc-900" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-[11.5px] text-zinc-500">{pct}% completed — keep going!</p>
          </section>

          {/* Partner placements */}
          <section className="space-y-2.5">
            <h2 className="flex items-center gap-2 px-1 text-[14px] font-extrabold text-zinc-900">
              <Briefcase className="h-4 w-4" />
              Partner Placements
            </h2>
            {PLACEMENTS.map((p) => (
              <article key={p.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white">
                  <Building2 className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-bold text-zinc-900">{p.role}</p>
                  <p className="truncate text-[12px] text-zinc-500">{p.company}</p>
                  <p className="flex items-center gap-1 text-[11px] text-zinc-400">
                    <MapPin className="h-3 w-3" />
                    {p.location} • {p.slots > 0 ? `${p.slots} slots` : 'No slots'}
                  </p>
                </div>
                {applied[p.id] ? (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-[#007a2e]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Applied
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={p.slots === 0}
                    onClick={() => setApplied((prev) => ({ ...prev, [p.id]: true }))}
                    className="h-9 shrink-0 rounded-xl bg-zinc-900 px-4 text-[12px] font-bold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {p.slots === 0 ? 'Full' : 'Apply'}
                  </button>
                )}
              </article>
            ))}
          </section>
        </main>
      </div>
    </div>
  );
};

export default StudentInternship;
