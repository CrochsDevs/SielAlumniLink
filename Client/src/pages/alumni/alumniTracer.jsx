import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { ClipboardCheck, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import AlumniSidebar from '../../layout/sidebar/alumni/alumniSidebar';
import AlumniTopbar from '../../layout/topbar/alumni/alumniTopbar';
import api from '../../utils/axios';

const STATUSES = ['Employed', 'Self-employed', 'Unemployed', 'Studying'];

const AlumniTracer = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [form, setForm] = useState({ batch: '', program: '', status: 'Employed', company: '', location: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [answered, setAnswered] = useState(false);

  useEffect(() => {
    api.get('/tracer/me')
      .then((res) => {
        if (res.data.data) {
          const { batch, program, status, company, location } = res.data.data;
          setForm({ batch: batch || '', program: program || '', status: status || 'Employed', company: company || '', location: location || '' });
          setAnswered(true);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const inputClass =
    'w-full h-11 px-3.5 rounded-xl border border-zinc-200 bg-zinc-50/60 text-[13px] outline-none transition focus:border-[#009639] focus:bg-white focus:ring-2 focus:ring-[#009639]/15';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/tracer', form);
      setAnswered(true);
      Swal.fire({ title: 'Thank you!', text: 'Your tracer response has been saved.', icon: 'success', timer: 1800, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to save response', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f6f3]">
      <AlumniSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />

      <div className="lg:pl-64">
        <AlumniTopbar user={user} title="Tracer Study" onMenuClick={() => setSidebarOpen(true)} />

        <main className="mx-auto max-w-2xl p-4 sm:p-6">
          <section className="overflow-hidden rounded-3xl border border-emerald-900/10 bg-white shadow-sm">
            <div className="bg-gradient-to-r from-[#0F4C3A] to-[#009639] px-5 py-5 sm:px-6">
              <h1 className="flex items-center gap-2 text-[16px] font-extrabold text-white">
                <ClipboardCheck className="h-5 w-5" />
                Tracer Study 2026
              </h1>
              <p className="mt-0.5 text-[12px] text-white/70">
                Help CLSU track graduate outcomes. Takes about 3 minutes.
              </p>
              {answered && (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold text-white">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  You already answered — update anytime
                </p>
              )}
            </div>

            {loading ? (
              <p className="p-6 text-[13px] text-zinc-500">Loading...</p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 p-5 sm:p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                      Batch Graduated
                    </label>
                    <input value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })}
                      required placeholder="e.g. 2019" className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                      Program
                    </label>
                    <input value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value })}
                      required placeholder="e.g. BS Information Technology" className={inputClass} />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                    Employment Status
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {STATUSES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setForm({ ...form, status: s })}
                        className={`h-11 rounded-xl text-[12.5px] font-bold transition ${
                          form.status === s
                            ? 'bg-[#009639] text-white shadow-sm'
                            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                      Company / School <span className="font-medium normal-case text-zinc-400">(optional)</span>
                    </label>
                    <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })}
                      placeholder="Where do you work now?" className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                      Location <span className="font-medium normal-case text-zinc-400">(optional)</span>
                    </label>
                    <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                      placeholder="e.g. Makati City" className={inputClass} />
                  </div>
                </div>

                <button type="submit" disabled={saving}
                  className="h-11 w-full rounded-xl bg-[#009639] text-[13px] font-bold text-white transition hover:bg-[#007a2e] disabled:opacity-60">
                  {saving ? 'Saving...' : answered ? 'Update response' : 'Submit response'}
                </button>
              </form>
            )}
          </section>
        </main>
      </div>
    </div>
  );
};

export default AlumniTracer;
