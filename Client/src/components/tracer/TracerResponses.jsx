import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import AdminStatCard from "../admin/AdminStatCard";
import { AdminStatGrid } from "../admin/AdminUI";
import { useEffect, useMemo, useState } from "react";
import { gooeyToast as toast } from "goey-toast";
import {
  Search,
  ClipboardCheck,
  ClipboardList,
  Briefcase,
  GraduationCap,
  TrendingUp,
  Download,
} from "lucide-react";
import DataPagination from "../ui/data-pagination";
import ProfileAvatar from "../profile/ProfileAvatar";
import ColumnFilter from "../ui/ColumnFilter";
import { filterOptions, manilaDate, matchesTextFilter } from "../../utils/tableFilters";
import api from "../../utils/axios";
import { useSearchParams } from "react-router-dom";
import {
  TRACER_STATUS_DETAILS,
  normalizeTracerDetails,
  formatTracerStartMonth,
} from "../../utils/tracerStudy";

const STATUS_STYLE = {
  Employed:
    "bg-brand/10 text-brand ring-emerald-200/60 dark:bg-emerald-950 dark:text-brand dark:ring-brand",
  "Self-employed":
    "bg-blue-50 text-blue-600 ring-blue-200/60 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-800",
  Unemployed:
    "bg-red-50 text-red-600 ring-red-200/60 dark:bg-red-950 dark:text-red-300 dark:ring-red-800",
  Studying:
    "bg-amber-50 text-amber-700 ring-amber-200/60 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-800",
};

const FILTERS = ["all", "Employed", "Self-employed", "Unemployed", "Studying"];
const QUARTERS = [['1', 'Q1 · Jan–Mar'], ['2', 'Q2 · Apr–Jun'], ['3', 'Q3 · Jul–Sep'], ['4', 'Q4 · Oct–Dec']];
const responsePeriod = row => {
  if (row.tracingYear && row.tracingQuarter) return { year: Number(row.tracingYear), quarter: Number(row.tracingQuarter) };
  const value = row.updatedAt || row.respondedAt;
  const date = value ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime())) return null;
  const local = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return { year: local.getUTCFullYear(), quarter: Math.floor(local.getUTCMonth() / 3) + 1 };
};

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

const TABLE_COLUMNS = [
  ["Graduate", 280],
  ["Batch", 120],
  ["Tracing Period", 180],
  ["Program", 340],
  ["Status", 150],
  ["Company / Business / School", 260],
  ["Job / Business / Course", 260],
  ["Salary / Income", 180],
  ["Start Month", 180],
  ["Location", 260],
  ["Responded", 190],
  ["Updated", 190],
];
const TABLE_WIDTH = TABLE_COLUMNS.reduce(
  (total, [, width]) => total + width,
  0,
);

function TracerDetailCell({ response, field }) {
  const label = TRACER_STATUS_DETAILS[response.status]?.[field];
  const value =
    field === "employmentDate"
      ? formatTracerStartMonth(response[field])
      : response[field];
  return (
    <td
      title={label || "Not applicable"}
      className="break-words px-4 py-4 leading-relaxed text-zinc-600 dark:text-zinc-300"
    >
      {label ? (
        value || (
          <span className="text-zinc-400 dark:text-zinc-500">Not provided</span>
        )
      ) : (
        <span className="text-zinc-400 dark:text-zinc-500">—</span>
      )}
    </td>
  );
}

const RESPONSE_COLUMNS = TABLE_COLUMNS.map(([header, width], index) => ({
  accessorKey: [
    "email",
    "batch",
    "tracingYear",
    "program",
    "status",
    "company",
    "position",
    "salaryRange",
    "employmentDate",
    "location",
    "respondedAt",
    "updatedAt",
  ][index],
  header,
  size: width,
  meta: {
    headerClassName: `sticky top-0 border-b border-zinc-200 bg-zinc-50 px-4 py-3.5 font-semibold whitespace-nowrap dark:border-zinc-700 dark:bg-zinc-800 ${index === 0 ? "md:left-0 z-30 border-r dark:border-r-zinc-700" : "z-20"}`,
  },
}));

export default function TracerResponses() {
  const [searchParams, setSearchParams] = useSearchParams();
  const yearFilter = searchParams.get('year') || 'all';
  const quarterFilter = searchParams.get('quarter') || 'all';
  const [years, setYears] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [columnFilters, setColumnFilters] = useState({});
  const changeColumn = (key, value) => { setColumnFilters(previous => ({ ...previous, [key]: value })); setPage(1); };
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const changePeriod = (key, value) => {
    // Read the latest URL so rapid year/quarter selections retain both values.
    const next = new URLSearchParams(window.location.search);
    if (value === 'all') next.delete(key); else next.set(key, value);
    setSearchParams(next);
    setPage(1);
    setColumnFilters({});
  };
  const periodLabel = `${yearFilter === 'all' ? 'All tracing years' : yearFilter} · ${quarterFilter === 'all' ? 'All quarters' : `Q${quarterFilter}`}`;

  useEffect(() => {
    let cancelled = false;
    // Clear records from the previous tracing period while its replacement loads.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setResponses([]);
    setLoadError('');
    api
      .get("/tracer", { params: { year: yearFilter, quarter: quarterFilter } })
      .then((tracerRes) => {
        if (cancelled) return;
        const rows = (tracerRes.data.data || []).map(normalizeTracerDetails);
        setResponses(rows);
        setYears(tracerRes.data.periods?.years || [...new Set(rows.map(row => responsePeriod(row)?.year).filter(Boolean))]);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err.response?.data?.message || 'Failed to load tracer responses');
        toast.error("Error", {
          description:
            err.response?.data?.message || "Failed to load tracer responses",
        });
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [yearFilter, quarterFilter]);

  const counts = useMemo(() => {
    const employed = responses.filter(
      (r) => r.status === "Employed" || r.status === "Self-employed",
    ).length;
    return {
      total: responses.length,
      employed,
      rate: responses.length
        ? Math.round((employed / responses.length) * 100)
        : 0,
      batches: new Set(responses.map((r) => r.batch)).size,
    };
  }, [responses]);

  const filtered = responses.filter((r) => {
    const matchesQuery = [
      r.name,
      r.email,
      r.batch,
      r.program,
      r.status,
      r.company,
      r.position,
      r.location,
    ].some((value) =>
      String(value || "")
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    );
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    const period = responsePeriod(r);
    const values = { ...r, email: [r.name, r.email], tracingYear: period ? `${period.year} Q${period.quarter}` : 'Unknown period',
      employmentDate: manilaDate(r.employmentDate).slice(0, 7), respondedAt: manilaDate(r.respondedAt), updatedAt: manilaDate(r.updatedAt) };
    return matchesQuery && matchesStatus && Object.entries(columnFilters).every(([key, value]) =>
      !value || (['batch', 'program', 'status', 'tracingYear', 'employmentDate', 'respondedAt', 'updatedAt'].includes(key)
        ? String(values[key] ?? '') === value : matchesTextFilter(values[key], value)));
  });
  const columnOptions = {
    batch: filterOptions(responses.map(row => row.batch)), program: filterOptions(responses.map(row => row.program)),
    status: FILTERS.filter(value => value !== 'all').map(value => ({ value, label: value })),
    tracingYear: filterOptions(responses.map(row => { const period = responsePeriod(row); return period ? `${period.year} Q${period.quarter}` : 'Unknown period'; })),
  };

  const responsesTable = useReactTable({
    data: filtered,
    columns: RESPONSE_COLUMNS,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => String(row._id ?? row.authId ?? row.email),
    autoResetPageIndex: false,
    state: {
      pagination: {
        pageIndex: Math.min(
          page - 1,
          Math.max(0, Math.ceil(filtered.length / perPage) - 1),
        ),
        pageSize: perPage,
      },
    },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === "function"
          ? updater(responsesTable.getState().pagination)
          : updater;
      setPage(next.pageIndex + 1);
      setPerPage(next.pageSize);
    },
  });
  const totalPages = Math.max(1, responsesTable.getPageCount());
  const paged = responsesTable.getRowModel().rows.map((row) => row.original);

  // Accreditation / institutional reporting export.
  const exportCSV = () => {
    const headers = [
      "Graduate Name",
      "Email",
      "Batch Graduated",
      "Tracing Year",
      "Tracing Quarter",
      "Graduation Program",
      "Employment Status",
      "Company / Business / School",
      "Job Title / Line of Work / Current Course",
      "Salary / Monthly Income Range",
      "Employment / Business Start Month",
      "Work / Business / School Location",
      "Responded",
      "Last Updated",
    ];
    const rows = filtered.map((r) => [
      r.name || "",
      r.email || "",
      r.batch || "",
      responsePeriod(r)?.year || '',
      responsePeriod(r) ? `Q${responsePeriod(r).quarter}` : '',
      r.program || "",
      r.status || "",
      r.company || "",
      r.position || "",
      r.salaryRange || "",
      formatTracerStartMonth(r.employmentDate),
      r.location || "",
      r.respondedAt ? new Date(r.respondedAt).toLocaleDateString("en-US") : "",
      r.updatedAt ? new Date(r.updatedAt).toLocaleDateString("en-US") : "",
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tracer-report-${yearFilter === 'all' ? 'all-years' : yearFilter}-${quarterFilter === 'all' ? 'all-quarters' : `Q${quarterFilter}`}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section aria-label="Tracer survey responses" className="space-y-4">
      <div>
        <h2 className="admin-section-title text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Tracer responses
        </h2>
        <p className="mt-1 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
          Graduate survey submissions and employment outcomes reported in the
          Tracer Study form. Select a tracing year and quarter to review the latest response per user in that period (Philippine time).
        </p>
      </div>


      <AdminStatGrid columns={4}>
        {[
          { label: "Responses", value: counts.total, icon: ClipboardCheck },
          { label: "Employed", value: counts.employed, icon: Briefcase },
          {
            label: "Employment Rate",
            value: `${counts.rate}%`,
            icon: TrendingUp,
          },
          {
            label: "Batches Covered",
            value: counts.batches,
            icon: GraduationCap,
          },
        ].map((item, index) => (
          <AdminStatCard
            key={item.label}
            {...item}
            featured={index === 0}
            loading={loading}
            detail={periodLabel}
          />
        ))}
      </AdminStatGrid>
      <div aria-label="Tracing period filters" className="admin-panel flex flex-wrap items-end gap-3 p-4">
        <label className="min-w-[150px] flex-1 text-xs font-semibold text-zinc-600 dark:text-zinc-300 sm:flex-none">
          Tracing year
          <select aria-label="Tracing year" value={yearFilter} onChange={event => changePeriod('year', event.target.value)}
            className="mt-1.5 block h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
            <option value="all">All years</option>
            {[...new Set([...years, Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Manila' }).format(new Date())),
              ...(yearFilter !== 'all' ? [Number(yearFilter)] : [])])].filter(Number.isFinite).sort((a, b) => b - a)
              .map(year => <option key={year} value={year}>{year}</option>)}
          </select>
        </label>
        <label className="min-w-[180px] flex-1 text-xs font-semibold text-zinc-600 dark:text-zinc-300 sm:flex-none">
          Tracing quarter
          <select aria-label="Tracing quarter" value={quarterFilter} onChange={event => changePeriod('quarter', event.target.value)}
            className="mt-1.5 block h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
            <option value="all">All quarters</option>
            {QUARTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 sm:ml-auto">Tracing period, separate from graduation batch.</p>
      </div>
      {loadError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{loadError}</p>}
      {/* Table card */}
      <div className="admin-panel admin-data-table overflow-hidden">
        <div className="admin-toolbar">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              aria-label="Search tracer responses"
              placeholder="Search email, batch, program, or details..."
              className="h-10 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 pl-9 pr-3 text-[12.5px] outline-none transition focus:border-brand focus:bg-white dark:focus:bg-zinc-800 focus:ring-2 focus:ring-brand/15"
            />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <select
              aria-label="Filter by employment status"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
              className="h-10 min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 outline-none focus:border-brand dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:[color-scheme:dark] sm:flex-none"
            >
              {FILTERS.map((status) => (
                <option key={status} value={status}>
                  {status === "all" ? "All statuses" : status}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={exportCSV}
              disabled={loading || filtered.length === 0}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-zinc-900 px-3.5 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        <p id="tracer-scroll-hint" className="data-table-hint">
          {filtered.length} responses · {periodLabel} · Scroll horizontally to view all columns.
          {Object.values(columnFilters).some(Boolean) && <button type="button" onClick={() => { setColumnFilters({}); setPage(1); }} className="ml-3 font-semibold text-brand underline">Clear column filters</button>}
        </p>
        <div
          data-tracer-table
          role="region"
          aria-label="Tracer study responses"
          aria-describedby="tracer-scroll-hint"
          tabIndex={0}
          className="max-h-[600px] overflow-auto overscroll-contain focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-primary"
        >
          <table
            className="table-fixed text-left text-[12.5px]"
            style={{ width: TABLE_WIDTH }}
          >
            <colgroup>
              {TABLE_COLUMNS.map(([label, width]) => (
                <col key={label} style={{ width }} />
              ))}
            </colgroup>
            <thead>
              {responsesTable.getHeaderGroups().map((group) => (
                <tr
                  key={group.id}
                  className={
                    "text-[10.5px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
                  }
                >
                  {group.headers.map((header) => (
                    <th
                      key={header.id}
                      scope="col"
                      colSpan={header.colSpan}
                      className={header.column.columnDef.meta?.headerClassName}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                      {!header.isPlaceholder && <ColumnFilter label={`Filter ${header.column.columnDef.header}`}
                        value={columnFilters[header.column.id] || ''} onChange={value => changeColumn(header.column.id, value)}
                        options={columnOptions[header.column.id]}
                        type={['respondedAt', 'updatedAt'].includes(header.column.id) ? 'date' : header.column.id === 'employmentDate' ? 'month' : 'search'} />}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={TABLE_COLUMNS.length}
                    className="px-4 py-8 text-zinc-400 dark:text-zinc-500"
                  >
                    Loading responses...
                  </td>
                </tr>
              ) : (
                paged.map((r) => (
                  <tr
                    key={r._id}
                    className="group border-b border-zinc-100 dark:border-zinc-800 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    <td className="md:sticky md:left-0 z-10 border-r border-zinc-200 bg-white px-4 py-4 group-hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:group-hover:bg-zinc-800">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-50 text-[12px] font-bold text-brand ring-1 ring-black/5 dark:bg-emerald-950 dark:text-brand dark:ring-white/10">
                          <ProfileAvatar user={r} fallback={r.email || 'U'} />
                        </span>
                        <span className="min-w-0">
                          <span className="block break-words font-semibold leading-relaxed text-zinc-800 dark:text-zinc-100">
                            {r.name || r.email}
                          </span>
                          {r.name && <span title={r.email} className="mt-0.5 block truncate text-xs text-zinc-500 dark:text-zinc-400">{r.email}</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                      {r.batch}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-zinc-600 dark:text-zinc-300">
                      {responsePeriod(r) ? `${responsePeriod(r).year} Q${responsePeriod(r).quarter}` : 'Unknown period'}
                    </td>
                    <td className="break-words px-4 py-4 leading-relaxed text-zinc-600 dark:text-zinc-300">
                      {r.program || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[10.5px] font-semibold ring-1 ${STATUS_STYLE[r.status] || "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 ring-zinc-200 dark:ring-zinc-700"}`}
                      >
                        {r.status}
                      </span>
                    </td>
                    {[
                      "company",
                      "position",
                      "salaryRange",
                      "employmentDate",
                      "location",
                    ].map((field) => (
                      <TracerDetailCell
                        key={field}
                        response={r}
                        field={field}
                      />
                    ))}
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                      {formatDate(r.respondedAt)}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                      {formatDate(r.updatedAt)}
                    </td>
                  </tr>
                ))
              )}
              {!loading && paged.length === 0 && (
                <tr>
                  <td colSpan={TABLE_COLUMNS.length} className="px-4 py-10">
                    <div className="sticky left-0 w-[min(480px,85vw)] text-center">
                      <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-brand dark:bg-emerald-950 dark:text-brand">
                        <ClipboardList className="h-6 w-6" />
                      </span>
                      <p className="text-[13px] font-bold text-zinc-700 dark:text-zinc-200">
                        {responses.length === 0
                          ? (yearFilter !== 'all' || quarterFilter !== 'all' ? 'No responses for this tracing period' : 'No responses yet')
                          : "No responses found"}
                      </p>
                    </div>
                    <p className="mt-0.5 text-[12px] text-zinc-400 dark:text-zinc-500">
                      {responses.length === 0
                        ? (yearFilter !== 'all' || quarterFilter !== 'all' ? 'Choose another year or quarter.' : 'Alumni answer via the Tracer Study form.')
                        : "Try a different keyword or filter."}
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
          onPageChange={(value) => responsesTable.setPageIndex(value - 1)}
          perPage={perPage}
          onPerPageChange={(pageSize) =>
            responsesTable.setPagination({ pageIndex: 0, pageSize })
          }
          totalItems={filtered.length}
          itemLabel="responses"
        />
      </div>

    </section>
  );
}
