import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { Building2, MapPin, CalendarDays, Plus, CheckCircle2, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import AlumniSidebar from '../../layout/sidebar/alumni/alumniSidebar';
import AlumniTopbar from '../../layout/topbar/alumni/alumniTopbar';
import api from '../../utils/axios';

const AlumniEmployment = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [status, setStatus] = useState('Employed');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ position: '', company: '', location: '', startDate: '', endDate: '', current: false });

  const inputClass =
    'w-full h-10 px-3.5 rounded-xl border border-zinc-200 bg-white text-[13px] outline-none transition focus:border-[#009639] focus:ring-2 focus:ring-[#009639]/15';

  const loadEmployment = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/users/${user?._id || user?.authId}`);
      const profile = res.data.data || {};
      setStatus(profile.employmentStatus || 'Employed');
      const jobs = profile.employmentHistory || [];
      setHistory(jobs.map((job, i) => ({
        id: job._id || i,
        position: job.position || job.role || '',
        company: job.company || '',
        location: job.location || '',
        period: job.period || (job.startDate ? `${job.startDate} — ${job.endDate || 'Present'}` : ''),
        current: job.current || false,
      })));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveStatus = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/users/${user?._id || user?.authId}`, { employmentStatus: status });
      Swal.fire({ title: 'Saved', text: 'Employment status updated.', icon: 'success', timer: 1500, showConfirmButton: false });
      loadEmployment();
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const addExperience = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const newJob = {
        position: form.position,
        company: form.company,
        location: form.location,
        startDate: form.startDate,
        endDate: form.endDate,
        current: form.current,
      };
      await api.put(`/users/${user?._id || user?.authId}`, {
        $push: { employmentHistory: newJob },
      });
      setShowAdd(false);
      setForm({ position: '', company: '', location: '', startDate: '', endDate: '', current: false });
      Swal.fire({ title: 'Added', text: 'Experience added.', icon: 'success', timer: 1500, showConfirmButton: false });
      loadEmployment();
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to add experience', 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeExperience = async (id) => {
    try {
      await api.put(`/users/${user?._id || user?.authId}`, {
        $pull: { employmentHistory: { _id: id } },
      });
      Swal.fire({ title: 'Removed', icon: 'success', timer: 1500, showConfirmButton: false });
      loadEmployment();
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to remove', 'error');
    }
  };

  const current = history.find((h) => h.current);

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
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  disabled={saving}
                  className="mt-1 h-9 rounded-lg bg-white/10 px-3 text-[14px] font-bold text-white ring-1 ring-white/20 outline-none transition focus:ring-white/40 disabled:opacity-50 [&>option]:text-zinc-900"
                >
                  {['Employed', 'Self-employed', 'Unemployed', 'Studying'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                {current && (
                  <p className="mt-0.5 text-[12.5px] text-white/75">
                    {current.position} at {current.company} • {current.location}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={saveStatus}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-xl bg-white dark:bg-zinc-900 px-4 py-2 text-[12.5px] font-bold text-[#007a2e] transition hover:bg-emerald-50 disabled:opacity-50"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>


          </section>

          {/* History */}
          <section className="rounded-3xl border border-emerald-900/10 bg-white dark:bg-zinc-900 p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[15px] font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">Employment History</h2>
                <p className="text-[12px] text-zinc-500 dark:text-zinc-400">Your work experience</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAdd(!showAdd)}
                className="flex items-center gap-1.5 rounded-xl bg-[#009639] px-4 py-2 text-[12.5px] font-bold text-white transition hover:bg-[#007a2e]"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Experience
              </button>
            </div>

            {showAdd && (
              <form onSubmit={addExperience} className="mt-4 grid gap-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-4 sm:grid-cols-2">
                <input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })}
                  placeholder="Position (e.g. HR Manager)" className={inputClass} required />
                <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })}
                  placeholder="Company" className={inputClass} required />
                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="Location" className={inputClass} />
                <div className="flex items-center gap-2">
                  <input type="month" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className={inputClass} />
                  <input type="month" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    disabled={form.current} className={inputClass} />
                </div>
                <label className="flex items-center gap-2 text-[12.5px] font-medium text-zinc-600 dark:text-zinc-300 sm:col-span-2">
                  <input type="checkbox" checked={form.current} onChange={(e) => setForm({ ...form, current: e.target.checked })}
                    className="h-4 w-4 rounded border-zinc-300 text-[#009639] focus:ring-[#009639]/30" />
                  I currently work here
                </label>
                <button type="submit" disabled={saving}
                  className="h-10 rounded-xl bg-[#009639] text-[13px] font-bold text-white transition hover:bg-[#007a2e] disabled:opacity-50 sm:col-span-2">
                  {saving ? 'Adding...' : 'Add Experience'}
                </button>
              </form>
            )}

            <ol className="mt-4 space-y-0">
              {loading ? (
                <li className="py-6 text-center text-[12.5px] text-zinc-400">Loading employment history...</li>
              ) : history.length === 0 ? (
                <li className="py-6 text-center text-[12.5px] text-zinc-400">No employment history yet. Click "Add Experience" to add one.</li>
              ) : (
                history.map((job, i) => (
                  <li key={job.id} className="group relative flex gap-4 pb-6 last:pb-0">
                    {i < history.length - 1 && (
                      <span className="absolute left-[19px] top-11 h-[calc(100%-2.5rem)] w-0.5 rounded bg-emerald-100" />
                    )}
                    <span className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                      job.current ? 'bg-[#009639] text-white shadow-sm' : 'bg-emerald-50 text-[#009639]'
                    }`}>
                      <Building2 className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1 rounded-2xl bg-zinc-50 dark:bg-zinc-800/70 p-4 transition hover:bg-emerald-50/50">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
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
                        <button
                          type="button"
                          onClick={() => removeExperience(job.id)}
                          className="rounded-lg p-1.5 text-zinc-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                          aria-label="Remove experience"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ol>
          </section>
        </main>
      </div>
    </div>
  );
};

export default AlumniEmployment;
