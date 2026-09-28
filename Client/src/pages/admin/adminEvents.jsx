import { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { Search, Plus, Pencil, Trash2, Calendar, CalendarDays, Power, MapPin, Clock, CalendarPlus } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import AdminSidebar from '../../layout/sidebar/admin/adminSidebar';
import AdminTopbar from '../../layout/topbar/alumni/adminTopbar';
import DataPagination from '../../components/ui/data-pagination';
import api from '../../utils/axios';

const toInputValue = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const EMPTY_FORM = { title: '', description: '', location: '', startAt: '', endAt: '', isActive: true };

export default function AdminEvents() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/events', { params: { all: 'true' } });
      setEvents(res.data.data || []);
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to load events', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const counts = useMemo(() => {
    const now = new Date();
    return {
      total: events.length,
      active: events.filter((e) => e.isActive).length,
      upcoming: events.filter((e) => e.startAt && new Date(e.startAt) >= now).length,
    };
  }, [events]);

  const filtered = events.filter((e) =>
    `${e.title} ${e.location || ''}`.toLowerCase().includes(query.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (event) => {
    setEditing(event);
    setForm({
      title: event.title || '',
      description: event.description || '',
      location: event.location || '',
      startAt: toInputValue(event.startAt),
      endAt: toInputValue(event.endAt),
      isActive: event.isActive !== false,
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/events/${editing._id}`, form);
      } else {
        await api.post('/events', form);
      }
      setModalOpen(false);
      fetchEvents();
      Swal.fire({ title: 'Saved', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to save event', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (event) => {
    const result = await Swal.fire({
      title: 'Delete event?',
      text: `${event.title} will be removed.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626',
      reverseButtons: true,
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/events/${event._id}`);
      fetchEvents();
      Swal.fire({ title: 'Deleted', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to delete event', 'error');
    }
  };

  const toggleActive = async (event) => {
    try {
      await api.put(`/events/${event._id}`, { isActive: !event.isActive });
      fetchEvents();
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to update event', 'error');
    }
  };

  const inputClass =
    'w-full h-10 px-3 rounded-xl border border-zinc-200 bg-white text-[12.5px] outline-none transition focus:border-[#009639] focus:ring-2 focus:ring-[#009639]/15';

  const formatDate = (iso) => iso
    ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '—';

  return (
    <div className="min-h-screen bg-zinc-50">
      <AdminSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />

      <div className="lg:pl-64">
        <AdminTopbar user={user} title="Calendar" onMenuClick={() => setSidebarOpen(true)} />

        <main className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Events', value: counts.total, icon: Calendar },
              { label: 'Active', value: counts.active, icon: Power },
              { label: 'Upcoming', value: counts.upcoming, icon: CalendarDays },
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
                  placeholder="Search events..."
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-[12.5px] outline-none transition focus:border-[#009639] focus:bg-white focus:ring-2 focus:ring-[#009639]/15"
                />
              </div>
              <button
                type="button"
                onClick={openAdd}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#009639] px-4 text-[12.5px] font-bold text-white transition hover:bg-[#007a2e]"
              >
                <Plus className="h-4 w-4" />
                New Event
              </button>
            </div>

            {loading ? (
              <p className="p-6 text-[13px] text-zinc-500">Loading events...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-[12.5px]">
                  <thead>
                    <tr className="border-b border-zinc-100 text-[10.5px] uppercase tracking-wider text-zinc-400">
                      <th className="px-5 py-3 font-semibold">Event</th>
                      <th className="px-5 py-3 font-semibold">Schedule</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                      <th className="px-5 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((event) => (
                      <tr key={event._id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/60">
                        <td className="px-5 py-3">
                          <p className="font-semibold text-zinc-800">{event.title}</p>
                          <p className="flex items-center gap-1 text-[11px] text-zinc-500">
                            <MapPin className="h-3 w-3" />
                            {event.location || 'No location'}
                          </p>
                        </td>
                        <td className="px-5 py-3">
                          <p className="flex items-center gap-1.5 text-zinc-600">
                            <Clock className="h-3.5 w-3.5 text-zinc-400" />
                            {formatDate(event.startAt)}
                          </p>
                          {event.endAt && (
                            <p className="mt-0.5 text-[11px] text-zinc-400">until {formatDate(event.endAt)}</p>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <button
                            type="button"
                            onClick={() => toggleActive(event)}
                            title={event.isActive ? 'Hide event' : 'Publish event'}
                            className={`inline-block rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide ring-1 transition ${
                              event.isActive ? 'bg-[#009639]/10 text-[#007a2e] ring-emerald-200/60' : 'bg-zinc-100 text-zinc-400 ring-zinc-200'
                            }`}
                          >
                            {event.isActive ? 'Active' : 'Draft'}
                          </button>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button type="button" onClick={() => openEdit(event)}
                              className="rounded-lg p-2 text-zinc-300 transition hover:bg-emerald-50 hover:text-[#009639]" aria-label="Edit event">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => handleDelete(event)}
                              className="rounded-lg p-2 text-zinc-300 transition hover:bg-red-50 hover:text-red-600" aria-label="Delete event">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {paged.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-5 py-10 text-center">
                          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-[#009639]">
                            <CalendarPlus className="h-6 w-6" />
                          </span>
                          <p className="text-[13px] font-bold text-zinc-700">
                            {events.length === 0 ? 'No events yet' : 'No events found'}
                          </p>
                          <p className="mt-0.5 text-[12px] text-zinc-400">
                            {events.length === 0 ? 'Click New Event to create one.' : 'Try a different keyword.'}
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
              itemLabel="events"
            />
          </div>
        </main>
      </div>

      {/* Add/Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModalOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[15px] font-extrabold text-zinc-900">{editing ? 'Edit Event' : 'New Event'}</h2>
            <form onSubmit={handleSave} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-zinc-700">Title *</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required
                  placeholder="e.g. Grand Alumni Homecoming 2026" className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-zinc-700">Location</label>
                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g. CLSU Campus" className={inputClass} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-zinc-700">Starts At</label>
                  <input type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                    className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-zinc-700">Ends At</label>
                  <input type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })}
                    className={inputClass} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-zinc-700">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3} placeholder="Event details..."
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-[12.5px] outline-none transition focus:border-[#009639] focus:ring-2 focus:ring-[#009639]/15" />
              </div>
              <label className="flex items-center gap-2 text-[12.5px] font-medium text-zinc-600">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="h-4 w-4 accent-[#009639]" />
                Visible to users
              </label>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setModalOpen(false)}
                  className="h-10 flex-1 rounded-xl border border-zinc-200 text-[13px] font-bold text-zinc-600 transition hover:bg-zinc-50">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="h-10 flex-1 rounded-xl bg-[#009639] text-[13px] font-bold text-white transition hover:bg-[#007a2e] disabled:opacity-60">
                  {saving ? 'Saving...' : editing ? 'Save changes' : 'Create event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
