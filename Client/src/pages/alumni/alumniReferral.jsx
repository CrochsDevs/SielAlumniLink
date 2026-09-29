import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { Share2, Send, Trash2, Users, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import AlumniSidebar from '../../layout/sidebar/alumni/alumniSidebar';
import AlumniTopbar from '../../layout/topbar/alumni/alumniTopbar';
import api from '../../utils/axios';

const TYPES = [
  { key: 'all', label: 'All' },
  { key: 'job', label: 'Jobs' },
  { key: 'internship', label: 'Internships' },
  { key: 'scholarship', label: 'Scholarships' },
];

const TYPE_STYLE = {
  job: 'bg-[#009639]/10 text-[#007a2e]',
  internship: 'bg-blue-50 text-blue-600',
  scholarship: 'bg-amber-50 text-amber-700',
};

const STATUS_STYLE = {
  pending: 'bg-zinc-100 text-zinc-500',
  reviewed: 'bg-blue-50 text-blue-600',
  accepted: 'bg-[#009639]/10 text-[#007a2e]',
  declined: 'bg-red-50 text-red-600',
};

const AlumniReferral = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', type: 'job', organization: '', link: '' });
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [applicantsLoading, setApplicantsLoading] = useState(false);

  const canPost = ['admin', 'alumni'].includes(user?.role);

  const fetchReferrals = async () => {
    setLoading(true);
    try {
      const res = await api.get('/referrals');
      setReferrals(res.data.data || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReferrals();
  }, []);

  const handlePost = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/referrals', form);
      setForm({ title: '', description: '', type: 'job', organization: '', link: '' });
      setFormOpen(false);
      fetchReferrals();
      Swal.fire({ title: 'Posted!', text: 'Students can now apply.', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to post', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Delete referral?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      confirmButtonColor: '#dc2626',
      reverseButtons: true,
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/referrals/${id}`);
      setReferrals((prev) => prev.filter((r) => r._id !== id));
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to delete', 'error');
    }
  };

  const toggleApplicants = async (referral) => {
    if (String(expandedId) === String(referral._id)) {
      setExpandedId(null);
      return;
    }
    setExpandedId(referral._id);
    setApplicantsLoading(true);
    try {
      const res = await api.get(`/referrals/${referral._id}/applications`);
      setApplicants(res.data.data || []);
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to load applicants', 'error');
      setExpandedId(null);
    } finally {
      setApplicantsLoading(false);
    }
  };

  const setApplicationStatus = async (appId, status) => {
    try {
      await api.put(`/referrals/applications/${appId}`, { status });
      setApplicants((prev) => prev.map((a) => (String(a._id) === String(appId) ? { ...a, status } : a)));
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to update', 'error');
    }
  };

  const inputClass =
    'w-full h-11 px-3.5 rounded-xl border border-zinc-200 bg-zinc-50/60 text-[13px] outline-none transition focus:border-[#009639] focus:bg-white focus:ring-2 focus:ring-[#009639]/15';

  const filtered = referrals.filter((r) => typeFilter === 'all' || r.type === typeFilter);
  const isMine = (r) => user?.role === 'admin' || String(r.authorAuthId) === String(user?._id);

  return (
    <div className="min-h-screen bg-[#f3f6f3] dark:bg-zinc-950">
      <AlumniSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />

      <div className="lg:pl-64">
        <AlumniTopbar user={user} title="Referral" onMenuClick={() => setSidebarOpen(true)} />

        <main className="mx-auto max-w-4xl space-y-3 p-4 sm:p-6">
          {canPost && (
            <div className="rounded-3xl border border-emerald-900/10 bg-white dark:bg-zinc-900 p-5 shadow-sm">
              {!formOpen ? (
                <button
                  type="button"
                  onClick={() => setFormOpen(true)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#009639] py-2.5 text-[13px] font-bold text-white transition hover:bg-[#007a2e]"
                >
                  <Share2 className="h-4 w-4" />
                  Refer a job, internship, or scholarship
                </button>
              ) : (
                <form onSubmit={handlePost} className="space-y-2.5">
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                    required placeholder="Title — e.g. OJT Slot at Tech Corp" className={inputClass} />
                  <div className="grid gap-2.5 sm:grid-cols-3">
                    <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                      className={`${inputClass} bg-white dark:bg-zinc-900`}>
                      <option value="job">Job</option>
                      <option value="internship">Internship</option>
                      <option value="scholarship">Scholarship</option>
                    </select>
                    <input value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })}
                      placeholder="Organization" className={inputClass} />
                    <input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })}
                      placeholder="Link (optional)" className={inputClass} />
                  </div>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={3} placeholder="Details, requirements, how to apply..."
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 px-3.5 py-2.5 text-[13px] text-zinc-800 dark:text-zinc-100 outline-none focus:border-[#009639] focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-[#009639]/15" />
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setFormOpen(false)}
                      className="h-10 rounded-xl px-4 text-[12.5px] font-bold text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:bg-zinc-800">
                      Cancel
                    </button>
                    <button type="submit" disabled={saving}
                      className="h-10 rounded-xl bg-[#009639] px-5 text-[12.5px] font-bold text-white hover:bg-[#007a2e] disabled:opacity-60">
                      {saving ? 'Posting...' : 'Post referral'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {TYPES.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTypeFilter(key)}
                className={`rounded-full px-3.5 py-1.5 text-[11.5px] font-bold transition ${
                  typeFilter === key ? 'bg-[#009639] text-white' : 'bg-white text-zinc-500 border border-zinc-200 hover:text-zinc-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="rounded-3xl border border-emerald-900/10 bg-white dark:bg-zinc-900 p-8 text-center text-[13px] text-zinc-500 dark:text-zinc-400 shadow-sm">
              Loading referrals...
            </p>
          ) : filtered.length === 0 ? (
            <div className="rounded-3xl border border-emerald-900/10 bg-white dark:bg-zinc-900 p-10 text-center shadow-sm">
              <p className="text-[14px] font-bold text-zinc-800 dark:text-zinc-100">No referrals yet</p>
              <p className="mt-0.5 text-[12px] text-zinc-500 dark:text-zinc-400">Be the first alumni to refer an opportunity.</p>
            </div>
          ) : (
            filtered.map((r) => (
              <article key={r._id} className="rounded-3xl border border-emerald-900/10 bg-white dark:bg-zinc-900 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${TYPE_STYLE[r.type] || TYPE_STYLE.job}`}>
                    {r.type}
                  </span>
                  {isMine(r) && (
                    <button type="button" onClick={() => handleDelete(r._id)}
                      className="rounded-lg p-1.5 text-zinc-300 dark:text-zinc-500 transition hover:bg-red-50 hover:text-red-600" aria-label="Delete referral">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <h3 className="mt-2 text-[15px] font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">{r.title}</h3>
                <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
                  {r.organization}{r.organization && r.authorName ? ' • ' : ''}{r.authorName ? `Referred by ${r.authorName}` : ''}
                </p>
                {r.description && (
                  <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-200">{r.description}</p>
                )}
                {isMine(r) && (
                  <button
                    type="button"
                    onClick={() => toggleApplicants(r)}
                    className="mt-3 flex items-center gap-1.5 text-[12px] font-bold text-[#009639] dark:text-emerald-300 hover:underline"
                  >
                    <Users className="h-3.5 w-3.5" />
                    View applicants
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${String(expandedId) === String(r._id) ? 'rotate-180' : ''}`} />
                  </button>
                )}
                {isMine(r) && String(expandedId) === String(r._id) && (
                  <div className="mt-2 rounded-2xl bg-zinc-50 dark:bg-zinc-800 p-3">
                    {applicantsLoading ? (
                      <p className="py-2 text-center text-[12px] text-zinc-400 dark:text-zinc-500">Loading applicants...</p>
                    ) : applicants.length === 0 ? (
                      <p className="py-2 text-center text-[12px] text-zinc-400 dark:text-zinc-500">No applicants yet.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {applicants.map((a) => (
                          <li key={a._id} className="flex flex-wrap items-center gap-2 rounded-xl bg-white dark:bg-zinc-900 px-3 py-2">
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[12.5px] font-bold text-zinc-800 dark:text-zinc-100">{a.name || a.email}</span>
                              <span className="block truncate text-[11px] text-zinc-500 dark:text-zinc-400">{a.email}</span>
                            </span>
                            <select
                              value={a.status}
                              onChange={(e) => setApplicationStatus(a._id, e.target.value)}
                              className={`h-8 rounded-lg px-2 text-[11px] font-bold outline-none ${STATUS_STYLE[a.status] || STATUS_STYLE.pending}`}
                            >
                              {['pending', 'reviewed', 'accepted', 'declined'].map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </article>
            ))
          )}

          <p className="flex items-center justify-center gap-1.5 text-[11.5px] text-zinc-400 dark:text-zinc-500">
            <Send className="h-3.5 w-3.5 text-[#009639] dark:text-emerald-300" />
            Students apply directly from their portal.
          </p>
        </main>
      </div>
    </div>
  );
};

export default AlumniReferral;
