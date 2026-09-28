import { useState } from 'react';
import { Check } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import StudentSidebar from '../../layout/sidebar/student/studentSidebar';
import StudentTopbar from '../../layout/topbar/student/studentTopbar';

// TEMPORARY content — papalitan ng totoong data mula sa API.
// TODO(student): wire journey to backend endpoints.
const MILESTONES = [
  { title: 'Enrolled', desc: 'Officially admitted to CLSU', date: 'Aug 2023', state: 'done' },
  { title: 'First Semester Completed', desc: 'Finished all first-sem subjects', date: 'Dec 2023', state: 'done' },
  { title: 'Joined Mentorship', desc: 'Paired with an alumni mentor', date: 'Feb 2024', state: 'done' },
  { title: 'Participated in Events', desc: 'Joined 3 university events', date: 'Aug 2024', state: 'current' },
  { title: 'Internship Completed', desc: 'Finished OJT hours', date: null, state: 'upcoming' },
  { title: 'Graduated', desc: 'Degree conferred', date: null, state: 'upcoming' },
  { title: 'Became Alumni', desc: 'Joined the alumni network', date: null, state: 'upcoming' },
  { title: 'Employed', desc: 'First job after graduation', date: null, state: 'upcoming' },
];

const StudentJourney = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const doneCount = MILESTONES.filter((m) => m.state === 'done').length;

  return (
    <div className="min-h-screen bg-zinc-50">
      <StudentSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />

      <div className="lg:pl-64">
        <StudentTopbar user={user} title="Journey" onMenuClick={() => setSidebarOpen(true)} />

        <main className="mx-auto max-w-2xl p-4 sm:p-6">
          {/* Minimal header */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
              Module 2
            </p>
            <h1 className="mt-1 text-xl font-extrabold tracking-tight text-zinc-900">
              Student Journey Timeline
            </h1>
            <p className="mt-1 text-[13px] text-zinc-500">
              A complete developmental history — {doneCount} of {MILESTONES.length} milestones reached.
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-zinc-900"
                style={{ width: `${(doneCount / MILESTONES.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Timeline */}
          <ol className="mt-2">
            {MILESTONES.map((m, i) => (
              <li key={m.title} className="relative flex gap-4 pb-2 last:pb-0">
                {i < MILESTONES.length - 1 && (
                  <span className="absolute left-[19px] top-11 h-[calc(100%-2.5rem)] w-px bg-zinc-200" />
                )}
                <span className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-[13px] font-bold ${
                  m.state === 'done'
                    ? 'border-zinc-900 bg-zinc-900 text-white'
                    : m.state === 'current'
                      ? 'border-zinc-900 bg-white text-zinc-900 ring-4 ring-zinc-100'
                      : 'border-zinc-200 bg-white text-zinc-300'
                }`}>
                  {m.state === 'done' ? <Check className="h-4 w-4" strokeWidth={3} /> : `0${i + 1}`.slice(-2)}
                </span>
                <div className="min-w-0 flex-1 rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-1">
                    <p className="text-[14px] font-bold text-zinc-900">{m.title}</p>
                    {m.date && <p className="text-[11px] font-medium text-zinc-400">{m.date}</p>}
                  </div>
                  <p className="mt-0.5 text-[12.5px] text-zinc-500">{m.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </main>
      </div>
    </div>
  );
};

export default StudentJourney;
