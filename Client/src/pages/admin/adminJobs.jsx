import { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { Search, Plus, Pencil, Trash2, Briefcase, Building2, BriefcaseBusiness, Eye, EyeOff, Activity } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import AdminSidebar from '../../layout/sidebar/admin/adminSidebar';
import AdminTopbar from '../../layout/topbar/alumni/adminTopbar';
import DataPagination from '../../components/ui/data-pagination';
import api from '../../utils/axios';

const EMPTY_FORM = {
  title: '',
  company: '',
  location: '',
  type: 'Full-time',
  mode: 'On-site',
  description: '',
  tags: '',
  isActive: true,
};

export default function AdminJobs() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/jobs', { params: { all: 'true' } });
      setJobs(res.data.data || []);
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to load jobs', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const counts = useMemo(() => ({
    total: jobs.length,
    active: jobs.filter((j) => j.isActive).length,
  }), [jobs]);

  const filtered = jobs.filter((j) =>
    `${j.title} ${j.company}`.toLowerCase().includes(query.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (job) => {
    setEditing(job);
    setForm({
      title: job.title || '',
      company: job.company || '',
      location: job.location || '',
      type: job.type || 'Full-time',
      mode: job.mode || 'On-site',
      description: job.description || '',
      tags: (job.tags || []).join(', '),
      isActive: job.isActive !== false,
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
    };
    try {
      if (editing) {
        await api.put(`/jobs/${editing._id}`, payload);
      } else {
        await api.post('/jobs', payload);
      }
      setModalOpen(false);
      fetchJobs();
      Swal.fire({ title: 'Saved', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to save job', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (job) => {
    const result = await Swal.fire({
      title: 'Delete job post?',
      text: `${job.title} at ${job.company} will be removed.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626',
      reverseButtons: true,
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/jobs/${job._id}`);
      fetchJobs();
      Swal.fire({ title: 'Deleted', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to delete job', 'error');
    }
  };

  const toggleActive = async (job) => {
    try {
      await api.put(`/jobs/${job._id}`, { isActive: !job.isActive });
      fetchJobs();
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to update job', 'error');
    }
  };

  const inputClass =
    'w-full h-10 px-3 rounded-xl border border-zinc-200 bg-white text-[12.5px] outline-none transition focus:border-[#009639] focus:ring-2 focus:ring-[#009639]/15';

  return (
    <div className="min-h-screen bg-zinc-50">
      <AdminSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />

      <div className="lg:pl-64">
        <AdminTopbar user={user} title="Job Posts" onMenuClick={() => setSidebarOpen(true)} />

        <main className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Total Posts', value: counts.total, icon: Briefcase },
              { label: 'Active', value: counts.active, icon: Activity },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-zinc-500">{label}</span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#009639]/10 text-[#009639]">
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <p className="mt-1.5 text-2xl font-extrabold tracking-tight text-zinc-900">{value}</p>
              </div>
            ))}
          </div>

          {/* Table card */}
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-zinc-100 p-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                  placeholder="Search title or company..."
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-[12.5px] outline-none transition focus:border-[#009639] focus:bg-white focus:ring-2 focus:ring-[#009639]/15"
                />
              </div>
              <button
                type="button"
                onClick={openAdd}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#009639] px-4 text-[12.5px] font-bold text-white transition hover:bg-[#007a2e]"
              >
                <Plus className="h-4 w-4" />
                New Job Post
              </button>
            </div>

            {loading ? (
              <p className="p-6 text-[13px] text-zinc-500">Loading jobs...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-[12.5px]">
                  <thead>
                    <tr className="border-b border-zinc-100 text-[10.5px] uppercase tracking-wider text-zinc-400">
                      <th className="px-5 py-3 font-semibold">Job</th>
                      <th className="px-5 py-3 font-semibold">Type</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                      <th className="px-5 py-3 font-semibold">Posted</th>
                      <th className="px-5 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((job) => (
                      <tr key={job._id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/60">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#009639]/10 text-[#009639]">
                              <Building2 className="h-4 w-4" />
                            </span>
                            <span>
                              <span className="block font-semibold text-zinc-800">{job.title}</span>
                              <span className="block text-[11px] text-zinc-500">{job.company} • {job.location || '—'}</span>
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-zinc-500">{job.type} • {job.mode}</td>
                        <td className="px-5 py-3">
                          <button
                            type="button"
                            onClick={() => toggleActive(job)}
                            title={job.isActive ? 'Hide from alumni' : 'Show to alumni'}
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide ring-1 transition ${
                              job.isActive ? 'bg-[#009639]/10 text-[#007a2e] ring-emerald-200/60 hover:bg-[#009639]/20' : 'bg-zinc-100 text-zinc-400 ring-zinc-200 hover:bg-zinc-200'
                            }`}
                          >
                            {job.isActive ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                            {job.isActive ? 'Active' : 'Hidden'}
                          </button>
                        </td>
                        <td className="px-5 py-3 text-zinc-500">
                          {job.createdAt ? new Date(job.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button type="button" onClick={() => openEdit(job)}
                              className="rounded-lg p-2 text-zinc-300 transition hover:bg-emerald-50 hover:text-[#009639]" aria-label="Edit job">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => handleDelete(job)}
                              className="rounded-lg p-2 text-zinc-300 transition hover:bg-red-50 hover:text-red-600" aria-label="Delete job">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {paged.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-5 py-10 text-center">
                          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-[#009639]">
                            <BriefcaseBusiness className="h-6 w-6" />
                          </span>
                          <p className="text-[13px] font-bold text-zinc-700">
                            {jobs.length === 0 ? 'No job posts yet' : 'No jobs found'}
                          </p>
                          <p className="mt-0.5 text-[12px] text-zinc-400">
                            {jobs.length === 0 ? 'Click New Job Post to create one.' : 'Try a different keyword.'}
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <DataPagination
              page={Math.min(page, totalPages)}
              totalPages={totalPages}
              onPageChange={setPage}
              perPage={perPage}
              onPerPageChange={(n) => { setPerPage(n); setPage(1); }}
              totalItems={filtered.length}
              itemLabel="jobs"
            />
          </div>
        </main>
      </div>

      {/* Add/Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModalOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[15px] font-extrabold text-zinc-900">{editing ? 'Edit Job Post' : 'New Job Post'}</h2>
            <form onSubmit={handleSave} className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-zinc-700">Job Title *</label>
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required
                    placeholder="e.g. Software Engineer" className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-zinc-700">Company *</label>
                  <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} required
                    placeholder="e.g. Tech Corp" className={inputClass} />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-zinc-700">Location</label>
                  <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="e.g. Makati" className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-zinc-700">Type</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={inputClass}>
                    {['Full-time', 'Part-time', 'Contract', 'Internship'].map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-zinc-700">Mode</label>
                  <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} className={inputClass}>
                    {['On-site', 'Hybrid', 'Remote'].map((m) => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-zinc-700">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3} placeholder="About the role..." className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-[12.5px] outline-none transition focus:border-[#009639] focus:ring-2 focus:ring-[#009639]/15" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-zinc-700">Skills (comma-separated)</label>
                <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder="e.g. React, SQL" className={inputClass} />
              </div>
              <label className="flex items-center gap-2 text-[12.5px] font-medium text-zinc-600">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="h-4 w-4 accent-[#009639]" />
                Visible to alumni
              </label>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setModalOpen(false)}
                  className="h-10 flex-1 rounded-xl border border-zinc-200 text-[13px] font-bold text-zinc-600 transition hover:bg-zinc-50">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="h-10 flex-1 rounded-xl bg-[#009639] text-[13px] font-bold text-white transition hover:bg-[#007a2e] disabled:opacity-60">
                  {saving ? 'Saving...' : editing ? 'Save changes' : 'Post job'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
