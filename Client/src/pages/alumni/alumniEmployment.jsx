import { useState } from 'react';
import Swal from 'sweetalert2';
import { Building2, MapPin, CalendarDays, Pencil, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import AlumniSidebar from '../../layout/sidebar/alumni/alumniSidebar';
import AlumniTopbar from '../../layout/topbar/alumni/alumniTopbar';

// TEMPORARY content — papalitan ng totoong data mula sa API.
// TODO(alumni): wire employment to backend endpoints.
const HISTORY = [
  {
    id: 1,
    position: 'HR Manager',
    company: 'Tech Corp',
    location: 'Makati City',
    period: '2021 — Present',
    current: true,
  },
  {
    id: 2,
    position: 'HR Assistant',
    company: 'DataHub',
    location: 'Clark, Pampanga',
    period: '2018 — 2021',
    current: false,
  },
];

const AlumniEmployment = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [status, setStatus] = useState('Employed');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ position: '', company: '', location: '' });

  const inputClass =
    'w-full h-10 px-3.5 rounded-xl border border-zinc-200 bg-white text-[13px] outline-none transition focus:border-[#009639] focus:ring-2 focus:ring-[#009639]/15';

  const saveStatus = (e) => {
    e.preventDefault();
    setEditing(false);
    Swal.fire({ title: 'Saved', text: 'Employment status updated.', icon: 'success', timer: 1500, showConfirmButton: false });
  };

  const current = HISTORY.find((h) => h.current);

  return (
    <div className="min-h-screen bg-[#f3f6f3] dark:bg-zinc-950">
      <AlumniSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />

      <div className="lg:pl-64">
        <AlumniTopbar user={user} title="Employment" onMenuClick={() => setSidebarOpen(true)} />

        <main className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
          {/* Status card */}
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F4C3A] via-[#007a2e] to-[#009639] p-6 text-white shadow-lg shadow-emerald-900/10 sm:p-7">
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 85% 20%, rgba(255,255,255,0.25), transparent 40%)',
              }}
            />
            <div className="relative flex flex-wrap items-center gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white dark:bg-zinc-900/15 ring-1 ring-white/30">
                <Building2 className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/60">
                  Current Status
                </p>
                <p className="flex items-center gap-1.5 text-xl font-extrabold tracking-tight">
                  <CheckCircle2 className="h-5 w-5" />
                  {status}
                </p>
                {current && (
                  <p className="mt-0.5 text-[12.5px] text-white/75">
                    {current.position} at {current.company} • {current.location}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setEditing(!editing)}
                className="flex items-center gap-1.5 rounded-xl bg-white dark:bg-zinc-900 px-4 py-2 text-[12.5px] font-bold text-[#007a2e] transition hover:bg-emerald-50"
              >
                <Pencil className="h-3.5 w-3.5" />
                Update
              </button>
            </div>

            {editing && (
              <form onSubmit={saveStatus} className="relative mt-4 grid gap-2.5 rounded-2xl bg-white dark:bg-zinc-900 p-4 sm:grid-cols-2">
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputClass} text-zinc-800 dark:text-zinc-100`}>
                  {['Employed', 'Self-employed', 'Unemployed', 'Studying'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })}
                  placeholder="Position" className={inputClass} />
                <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })}
                  placeholder="Company" className={inputClass} />
                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="Location" className={inputClass} />
                <button type="submit"
                  className="h-10 rounded-xl bg-[#009639] text-[13px] font-bold text-white transition hover:bg-[#007a2e] sm:col-span-2">
                  Save status
                </button>
              </form>
            )}
          </section>

          {/* History */}
          <section className="rounded-3xl border border-emerald-900/10 bg-white dark:bg-zinc-900 p-5 shadow-sm sm:p-6">
            <h2 className="text-[15px] font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">Employment History</h2>
            <p className="text-[12px] text-zinc-500 dark:text-zinc-400">Where fellow Sielesyuans have worked.</p>
            <ol className="mt-4 space-y-0">
              {HISTORY.map((job, i) => (
                <li key={job.id} className="relative flex gap-4 pb-6 last:pb-0">
                  {i < HISTORY.length - 1 && (
                    <span className="absolute left-[19px] top-11 h-[calc(100%-2.5rem)] w-0.5 rounded bg-emerald-100" />
                  )}
                  <span className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                    job.current ? 'bg-[#009639] text-white shadow-sm' : 'bg-emerald-50 text-[#009639]'
                  }`}>
                    <Building2 className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1 rounded-2xl bg-zinc-50 dark:bg-zinc-800/70 p-4 transition hover:bg-emerald-50/50">
                    <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-bold text-zinc-900 dark:text-zinc-100">
                      {job.position}
                      {job.current && (
                        <span className="rounded-full bg-[#009639] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                          Current
                        </span>
                      )}
                    </p>
                    <p className="text-[12px] font-medium text-zinc-600 dark:text-zinc-300">{job.company}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {job.period}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {job.location}
                      </span>
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </main>
      </div>
    </div>
  );
};

export default AlumniEmployment;
