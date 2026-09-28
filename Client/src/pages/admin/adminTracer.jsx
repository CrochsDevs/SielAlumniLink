import { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { Search, ClipboardCheck, ClipboardList, Briefcase, GraduationCap, TrendingUp } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  useEffect(() => {
    api.get('/tracer')
      .then((res) => setResponses(res.data.data || []))
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

  return (
    <div className="min-h-screen bg-zinc-50">
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
                  placeholder="Search name, batch, or program..."
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-[12.5px] outline-none transition focus:border-[#009639] focus:bg-white focus:ring-2 focus:ring-[#009639]/15"
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

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-zinc-100 text-[10.5px] uppercase tracking-wider text-zinc-400">
                    <th className="px-5 py-3 font-semibold">Graduate</th>
                    <th className="px-5 py-3 font-semibold">Batch</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Current</th>
                    <th className="px-5 py-3 font-semibold">Responded</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5} className="px-5 py-8 text-center text-zinc-400">Loading responses...</td></tr>
                  ) : paged.map((r) => (
                    <tr key={r._id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/60">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[12px] font-bold text-[#009639]">
                            {(r.email || 'U').charAt(0).toUpperCase()}
                          </span>
                          <span>
                            <span className="block font-semibold text-zinc-800">{r.email}</span>
                            <span className="block text-[11px] text-zinc-500">{r.program}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-zinc-600">{r.batch}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-block rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide ring-1 ${STATUS_STYLE[r.status] || 'bg-zinc-100 text-zinc-500 ring-zinc-200'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-zinc-500">{r.company || '—'}</td>
                      <td className="px-5 py-3 text-zinc-500">
                        {r.respondedAt ? new Date(r.respondedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>
                    </tr>
                  ))}
                  {!loading && paged.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center">
                        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-[#009639]">
                          <ClipboardList className="h-6 w-6" />
                        </span>
                        <p className="text-[13px] font-bold text-zinc-700">
                          {responses.length === 0 ? 'No responses yet' : 'No responses found'}
                        </p>
                        <p className="mt-0.5 text-[12px] text-zinc-400">
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
