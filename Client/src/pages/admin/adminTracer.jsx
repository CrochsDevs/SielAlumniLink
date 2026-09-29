import { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { Search, ClipboardCheck, ClipboardList, Briefcase, GraduationCap, TrendingUp, Download } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import AdminSidebar from '../../layout/sidebar/admin/adminSidebar';
import AdminTopbar from '../../layout/topbar/alumni/adminTopbar';
import DataPagination from '../../components/ui/data-pagination';
import api from '../../utils/axios';

const STATUS_STYLE = {
  Employed: 'bg-[#009639]/10 text-[#007a2e] ring-emerald-200/60',
  'Self-employed': 'bg-blue-50 text-blue-600 ring-blue-200/60',
  Unemployed: 'bg-red-50 text-red-600 ring-red-200/60',
  Studying: 'bg-amber-50 text-amber-700 ring-amber-200/60',
};

const FILTERS = ['all', 'Employed', 'Self-employed', 'Unemployed', 'Studying'];

export default function AdminTracer() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [responses, setResponses] = useState([]);
  const [roleByEmail, setRoleByEmail] = useState({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  useEffect(() => {
    Promise.all([api.get('/tracer'), api.get('/users')])
      .then(([tracerRes, usersRes]) => {
        setResponses(tracerRes.data.data || []);
        const map = {};
        (usersRes.data.data || []).forEach((u) => { map[u.email] = u.role; });
        setRoleByEmail(map);
      })
      .catch((err) => Swal.fire('Error', err.response?.data?.message || 'Failed to load tracer responses', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => {
    const employed = responses.filter((r) => r.status === 'Employed' || r.status === 'Self-employed').length;
    return {
      total: responses.length,
      employed,
      rate: responses.length ? Math.round((employed / responses.length) * 100) : 0,
      batches: new Set(responses.map((r) => r.batch)).size,
    };
  }, [responses]);

  const filtered = responses.filter((r) => {
    const matchesQuery =
      (r.email || '').toLowerCase().includes(query.toLowerCase()) ||
      (r.batch || '').includes(query) ||
      (r.program || '').toLowerCase().includes(query.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  // Graduate a student -> auto-converts Student to Alumni.
  const handleGraduate = async (email) => {
    const result = await Swal.fire({
      title: 'Mark as graduated?',
      text: `${email} will be converted from Student to Alumni.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, graduate',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#009639',
      reverseButtons: true,
    });
    if (!result.isConfirmed) return;
    try {
      const res = await api.post('/users/graduate', { email });
      Swal.fire({ title: 'Graduated!', text: res.data.message, icon: 'success', timer: 1800, showConfirmButton: false });
      setRoleByEmail((prev) => ({ ...prev, [email]: 'alumni' }));
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to graduate', 'error');
    }
  };

  // Accreditation / institutional reporting export.
  const exportCSV = () => {
    const headers = ['Email', 'Batch', 'Program', 'Status', 'Company', 'Position', 'Salary Range', 'Employment Date', 'Location', 'Responded'];
    const rows = filtered.map((r) => [
      r.email || '',
      r.batch || '',
      r.program || '',
      r.status || '',
      r.company || '',
      r.position || '',
      r.salaryRange || '',
      r.employmentDate ? new Date(r.employmentDate).toLocaleDateString('en-US') : '',
      r.location || '',
      r.respondedAt ? new Date(r.respondedAt).toLocaleDateString('en-US') : '',
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tracer-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AdminSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />

      <div className="lg:pl-64">
        <AdminTopbar user={user} title="Tracer Study" onMenuClick={() => setSidebarOpen(true)} />

        <main className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              { label: 'Responses', value: counts.total, icon: ClipboardCheck },
              { label: 'Employed', value: counts.employed, icon: Briefcase },
              { label: 'Employment Rate', value: `${counts.rate}%`, icon: TrendingUp },
              { label: 'Batches Covered', value: counts.batches, icon: GraduationCap },
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
                  placeholder="Search name, batch, or program..."
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
                <button
                  type="button"
                  onClick={exportCSV}
                  disabled={filtered.length === 0}
                  className="flex items-center gap-1.5 rounded-full bg-zinc-900 px-3.5 py-1.5 text-[11.5px] font-bold text-white transition hover:bg-zinc-800 disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export CSV
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1020px] text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800 text-[10.5px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    <th className="px-5 py-3 font-semibold">Graduate</th>
                    <th className="px-5 py-3 font-semibold">Batch</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Company</th>
                    <th className="px-5 py-3 font-semibold">Position</th>
                    <th className="px-5 py-3 font-semibold">Salary Range</th>
                    <th className="px-5 py-3 font-semibold">Responded</th>
                    <th className="px-5 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} className="px-5 py-8 text-center text-zinc-400 dark:text-zinc-500">Loading responses...</td></tr>
                  ) : paged.map((r) => (
                    <tr key={r._id} className="border-b border-zinc-50 dark:border-zinc-800 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800 dark:bg-zinc-800/60">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[12px] font-bold text-[#009639] dark:text-emerald-300">
                            {(r.email || 'U').charAt(0).toUpperCase()}
                          </span>
                          <span>
                            <span className="block font-semibold text-zinc-800 dark:text-zinc-100">{r.email}</span>
                            <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">{r.program}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-zinc-600 dark:text-zinc-300">{r.batch}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-block rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide ring-1 ${STATUS_STYLE[r.status] || 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 ring-zinc-200 dark:ring-zinc-700'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-zinc-500 dark:text-zinc-400">{r.company || '—'}</td>
                      <td className="px-5 py-3 text-zinc-600 dark:text-zinc-300">{r.position || '—'}</td>
                      <td className="px-5 py-3 text-zinc-600 dark:text-zinc-300">{r.salaryRange || '—'}</td>
                      <td className="px-5 py-3 text-zinc-500 dark:text-zinc-400">
                        {r.respondedAt ? new Date(r.respondedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {roleByEmail[r.email] === 'student' ? (
                          <button
                            type="button"
                            onClick={() => handleGraduate(r.email)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#009639]/10 px-2.5 py-1.5 text-[11px] font-bold text-[#007a2e] transition hover:bg-[#009639] hover:text-white"
                          >
                            <GraduationCap className="h-3.5 w-3.5" />
                            Graduate
                          </button>
                        ) : (
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-300 dark:text-zinc-600">
                            {roleByEmail[r.email] || ''}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!loading && paged.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-5 py-10 text-center">
                        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-[#009639] dark:text-emerald-300">
                          <ClipboardList className="h-6 w-6" />
                        </span>
                        <p className="text-[13px] font-bold text-zinc-700 dark:text-zinc-200">
                          {responses.length === 0 ? 'No responses yet' : 'No responses found'}
                        </p>
                        <p className="mt-0.5 text-[12px] text-zinc-400 dark:text-zinc-500">
                          {responses.length === 0
                            ? 'Alumni answer via the Tracer Study form.'
                            : 'Try a different keyword or filter.'}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <DataPagination
              page={Math.min(page, totalPages)}
              totalPages={totalPages}
              onPageChange={setPage}
              perPage={perPage}
              onPerPageChange={(n) => { setPerPage(n); setPage(1); }}
              totalItems={filtered.length}
              itemLabel="responses"
            />
          </div>
        </main>
      </div>
    </div>
  );
}
