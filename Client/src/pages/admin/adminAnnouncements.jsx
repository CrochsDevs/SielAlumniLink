import { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { Search, Plus, Pencil, Trash2, Megaphone, Eye, EyeOff, Megaphone as EmptyIcon } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import AdminSidebar from '../../layout/sidebar/admin/adminSidebar';
import AdminTopbar from '../../layout/topbar/alumni/adminTopbar';
import DataPagination from '../../components/ui/data-pagination';
import api from '../../utils/axios';

const AUDIENCES = ['all', 'alumni', 'students'];
const EMPTY_FORM = { title: '', body: '', audience: 'all', isActive: true };

export default function AdminAnnouncements() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/announcements', { params: { all: 'true' } });
      setItems(res.data.data || []);
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to load announcements', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const counts = useMemo(() => ({
    total: items.length,
    active: items.filter((a) => a.isActive).length,
  }), [items]);

  const filtered = items.filter((a) =>
    `${a.title} ${a.body || ''}`.toLowerCase().includes(query.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      title: item.title || '',
      body: item.body || '',
      audience: item.audience || 'all',
      isActive: item.isActive !== false,
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/announcements/${editing._id}`, form);
      } else {
        await api.post('/announcements', form);
      }
      setModalOpen(false);
      fetchItems();
      Swal.fire({ title: 'Saved', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to save announcement', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    const result = await Swal.fire({
      title: 'Delete announcement?',
      text: `${item.title} will be removed.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626',
      reverseButtons: true,
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/announcements/${item._id}`);
      fetchItems();
      Swal.fire({ title: 'Deleted', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to delete announcement', 'error');
    }
  };

  const toggleActive = async (item) => {
    try {
      await api.put(`/announcements/${item._id}`, { isActive: !item.isActive });
      fetchItems();
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to update announcement', 'error');
    }
  };

  const inputClass =
    'w-full h-10 px-3 rounded-xl border border-zinc-200 bg-white text-[12.5px] outline-none transition focus:border-[#009639] focus:ring-2 focus:ring-[#009639]/15';

  return (
    <div className="min-h-screen bg-zinc-50">
      <AdminSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />

      <div className="lg:pl-64">
        <AdminTopbar user={user} title="Announcements" onMenuClick={() => setSidebarOpen(true)} />

        <main className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Total', value: counts.total, icon: Megaphone },
              { label: 'Published', value: counts.active, icon: Eye },
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
                  placeholder="Search announcements..."
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-[12.5px] outline-none transition focus:border-[#009639] focus:bg-white focus:ring-2 focus:ring-[#009639]/15"
                />
              </div>
              <button
                type="button"
                onClick={openAdd}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#009639] px-4 text-[12.5px] font-bold text-white transition hover:bg-[#007a2e]"
              >
                <Plus className="h-4 w-4" />
                New Announcement
              </button>
            </div>

            {loading ? (
              <p className="p-6 text-[13px] text-zinc-500">Loading announcements...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-[12.5px]">
                  <thead>
                    <tr className="border-b border-zinc-100 text-[10.5px] uppercase tracking-wider text-zinc-400">
                      <th className="px-5 py-3 font-semibold">Announcement</th>
                      <th className="px-5 py-3 font-semibold">Audience</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                      <th className="px-5 py-3 font-semibold">Posted</th>
                      <th className="px-5 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((item) => (
                      <tr key={item._id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/60">
                        <td className="px-5 py-3">
                          <p className="font-semibold text-zinc-800">{item.title}</p>
                          <p className="max-w-sm truncate text-[11px] text-zinc-500">{item.body || '—'}</p>
                        </td>
                        <td className="px-5 py-3">
                          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide text-zinc-600">
                            {item.audience || 'all'}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <button
                            type="button"
                            onClick={() => toggleActive(item)}
                            title={item.isActive ? 'Unpublish' : 'Publish'}
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide ring-1 transition ${
                              item.isActive ? 'bg-[#009639]/10 text-[#007a2e] ring-emerald-200/60' : 'bg-zinc-100 text-zinc-400 ring-zinc-200'
                            }`}
                          >
                            {item.isActive ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                            {item.isActive ? 'Published' : 'Draft'}
                          </button>
                        </td>
                        <td className="px-5 py-3 text-zinc-500">
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button type="button" onClick={() => openEdit(item)}
                              className="rounded-lg p-2 text-zinc-300 transition hover:bg-emerald-50 hover:text-[#009639]" aria-label="Edit announcement">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => handleDelete(item)}
                              className="rounded-lg p-2 text-zinc-300 transition hover:bg-red-50 hover:text-red-600" aria-label="Delete announcement">
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
                            <EmptyIcon className="h-6 w-6" />
                          </span>
                          <p className="text-[13px] font-bold text-zinc-700">
                            {items.length === 0 ? 'No announcements yet' : 'No announcements found'}
                          </p>
                          <p className="mt-0.5 text-[12px] text-zinc-400">
                            {items.length === 0 ? 'Click New Announcement to create one.' : 'Try a different keyword.'}
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
              itemLabel="announcements"
            />
          </div>
        </main>
      </div>

      {/* Add/Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModalOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[15px] font-extrabold text-zinc-900">{editing ? 'Edit Announcement' : 'New Announcement'}</h2>
            <form onSubmit={handleSave} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-zinc-700">Title *</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required
                  placeholder="e.g. Grand Alumni Homecoming 2026" className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-zinc-700">Body</label>
                <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
                  rows={4} placeholder="Announcement details..."
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-[12.5px] outline-none transition focus:border-[#009639] focus:ring-2 focus:ring-[#009639]/15" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-zinc-700">Audience</label>
                <select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} className={inputClass}>
                  {AUDIENCES.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 text-[12.5px] font-medium text-zinc-600">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="h-4 w-4 accent-[#009639]" />
                Published
              </label>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setModalOpen(false)}
                  className="h-10 flex-1 rounded-xl border border-zinc-200 text-[13px] font-bold text-zinc-600 transition hover:bg-zinc-50">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="h-10 flex-1 rounded-xl bg-[#009639] text-[13px] font-bold text-white transition hover:bg-[#007a2e] disabled:opacity-60">
                  {saving ? 'Saving...' : editing ? 'Save changes' : 'Publish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
