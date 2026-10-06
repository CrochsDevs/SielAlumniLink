import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { Search, Trash2, Link2, Clock, CheckCircle2, XCircle, Users, Eye, X } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import AdminSidebar from '../../layout/sidebar/admin/adminSidebar';
import AdminTopbar from '../../layout/topbar/alumni/adminTopbar';
import DataPagination from '../../components/ui/data-pagination';
import api from '../../utils/axios';

const STATUS_META = {
  accepted: { icon: CheckCircle2, style: 'bg-[#009639]/10 text-[#007a2e] ring-emerald-200/60' },
  pending: { icon: Clock, style: 'bg-amber-50 text-amber-700 ring-amber-200/60' },
  declined: { icon: XCircle, style: 'bg-red-50 text-red-600 ring-red-200/60' },
};

const FILTERS = ['students', 'alumni'];

export default function AdminConnections() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [showModal, setShowModal] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  const fetchConnections = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/connections');
      setConnections(res.data.data || []);
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to load connections', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const counts = useMemo(() => ({
    total: connections.length,
    accepted: connections.filter((c) => c.status === 'accepted').length,
    pending: connections.filter((c) => c.status === 'pending').length,
  }), [connections]);

  const filtered = connections.filter((c) => {
    const matchesQuery =
      `${c.requesterEmail} ${c.recipientEmail}`.toLowerCase().includes(query.toLowerCase());
    
    if (statusFilter === 'students') {
      return matchesQuery && (c.requesterRole === 'student' || c.recipientRole === 'student');
    }
    if (statusFilter === 'alumni') {
      return matchesQuery && (c.requesterRole === 'alumni' || c.recipientRole === 'alumni');
    }
    return matchesQuery;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const handleDelete = async (connection) => {
    const result = await Swal.fire({
      title: 'Remove connection?',
      text: `${connection.requesterEmail} ↔ ${connection.recipientEmail}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, remove',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626',
      reverseButtons: true,
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/connections/${connection._id}`);
      fetchConnections();
      Swal.fire({ title: 'Removed', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to remove connection', 'error');
    }
  };

  const handleView = (connection) => {
    setSelectedConnection(connection);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedConnection(null);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AdminSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />

      <div className="lg:pl-64">
        <AdminTopbar user={user} title="Connections" onMenuClick={() => setSidebarOpen(true)} />

        <main className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Links', value: counts.total, icon: Link2 },
              { label: 'Accepted', value: counts.accepted, icon: CheckCircle2 },
              { label: 'Pending', value: counts.pending, icon: Clock },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#009639]/10 text-[#009639] dark:text-emerald-300">
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <p className="mt-1.5 text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">{value}</p>
              </div>
            ))}
          </div>

          {/* Table card */}
          <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm">
            <div className="flex flex-col gap-3 border-b border-zinc-100 dark:border-zinc-800 p-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
                <input
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                  placeholder="Search by email..."
                  className="h-10 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 pl-9 pr-3 text-[12.5px] outline-none transition focus:border-[#009639] focus:bg-white focus:ring-2 focus:ring-[#009639]/15"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {FILTERS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => { setStatusFilter(f); setPage(1); }}
                    className={`rounded-full px-3 py-1.5 text-[11.5px] font-bold capitalize transition ${
                      statusFilter === f ? 'bg-[#009639] text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <p className="p-6 text-[13px] text-zinc-500 dark:text-zinc-400">Loading connections...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-[12.5px]">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-zinc-800 text-[10.5px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                      <th className="px-5 py-3 font-semibold">Link</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                      <th className="px-5 py-3 font-semibold">Since</th>
                      <th className="px-5 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((c) => {
                      const meta = STATUS_META[c.status] || STATUS_META.pending;
                      const StatusIcon = meta.icon;
                      return (
                        <tr key={c._id} className="border-b border-zinc-50 dark:border-zinc-800 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800 dark:bg-zinc-800/60">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2 text-zinc-800 dark:text-zinc-100">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[11px] font-bold text-[#009639] dark:text-emerald-300">
                                {(c.requesterEmail || 'U').charAt(0).toUpperCase()}
                              </span>
                              <span className="truncate font-medium">{c.requesterEmail}</span>
                              <Link2 className="h-3.5 w-3.5 shrink-0 text-zinc-300 dark:text-zinc-500" />
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[11px] font-bold text-[#009639] dark:text-emerald-300">
                                {(c.recipientEmail || 'U').charAt(0).toUpperCase()}
                              </span>
                              <span className="truncate font-medium">{c.recipientEmail}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide ring-1 ${meta.style}`}>
                              <StatusIcon className="h-3 w-3" />
                              {c.status}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-zinc-500 dark:text-zinc-400">
                            {c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleView(c)}
                              className="rounded-lg p-2 text-zinc-300 dark:text-zinc-500 transition hover:bg-emerald-50 hover:text-[#009639]"
                              aria-label="View connection details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(c)}
                              className="rounded-lg p-2 text-zinc-300 dark:text-zinc-500 transition hover:bg-red-50 hover:text-red-600"
                              aria-label="Remove connection"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {paged.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-5 py-10 text-center">
                          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-[#009639] dark:text-emerald-300">
                            <Users className="h-6 w-6" />
                          </span>
                          <p className="text-[13px] font-bold text-zinc-700 dark:text-zinc-200">
                            {connections.length === 0 ? 'No connections yet' : 'No connections found'}
                          </p>
                          <p className="mt-0.5 text-[12px] text-zinc-400 dark:text-zinc-500">
                            {connections.length === 0 ? 'Links appear here once users connect.' : 'Try a different keyword or filter.'}
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
              itemLabel="connections"
            />
          </div>
        </main>
      </div>

      {showModal && selectedConnection && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 w-full max-w-lg max-h-[80vh] overflow-y-auto p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {showDetail ? 'Connection Details' : 'Connections'}
              </h3>
              <button
                type="button"
                onClick={handleCloseModal}
                className="rounded-lg p-1 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {showDetail ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[15px] font-bold text-[#009639] dark:text-emerald-300">
                    {(selectedConnection.recipientName || selectedConnection.recipientEmail || 'U').charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <p className="text-[15px] font-bold text-zinc-900 dark:text-zinc-100">
                      {selectedConnection.recipientName || selectedConnection.recipientEmail}
                    </p>
                    <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
                      {selectedConnection.recipientRole === 'alumni' ? 'Alumni' : selectedConnection.recipientRole === 'student' ? 'Student' : '—'}
                    </p>
                  </div>
                </div>
                <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/50 p-4 space-y-2">
                  <div>
                    <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Email</p>
                    <p className="text-[13px] text-zinc-800 dark:text-zinc-200">{selectedConnection.recipientEmail}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Connected Since</p>
                    <p className="text-[13px] text-zinc-800 dark:text-zinc-200">
                      {selectedConnection.createdAt ? new Date(selectedConnection.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Status</p>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide ring-1 ${STATUS_META[selectedConnection.status]?.style || STATUS_META.pending.style}`}>
                      {selectedConnection.status}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDetail(false)}
                    className="flex-1 rounded-lg py-2 bg-zinc-100 text-zinc-700 text-[12px] font-bold hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 transition"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 rounded-lg py-2 bg-[#009639] text-white text-[12px] font-bold hover:bg-[#007a2e] transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {paged.map((c) => (
                    <div key={c._id} className="flex items-center gap-3 rounded-xl border border-zinc-100 dark:border-zinc-800 p-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[13px] font-bold text-[#009639] dark:text-emerald-300">
                        {(c.recipientName || c.recipientEmail || 'U').charAt(0).toUpperCase()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-zinc-900 dark:text-zinc-100 truncate">
                          {c.recipientName || c.recipientEmail}
                        </p>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                          {c.recipientRole === 'alumni' ? 'Alumni' : c.recipientRole === 'student' ? 'Student' : '—'}
                        </p>
                        <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                          Connected on {c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const role = c.recipientRole === 'alumni' ? 'alumni' : 'student';
                          navigate(`/${role}/profile/${c.recipientProfileId || c.recipientAuthId}`);
                        }}
                        className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-bold bg-[#009639] text-white hover:bg-[#007a2e] transition"
                      >
                        View
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="w-full mt-4 rounded-lg py-2 bg-zinc-100 text-zinc-700 text-[12px] font-bold hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 transition"
                >
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}