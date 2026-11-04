import ProgressBar from "../ui/progress-bar";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import AdminStatCard from "../admin/AdminStatCard";
import { AdminStatGrid } from "../admin/AdminUI";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Download, RefreshCw, Briefcase, ChevronRight, X } from "lucide-react";
import DataPagination from "../ui/data-pagination";
import ProfileAvatar from "../profile/ProfileAvatar";
import GraduateIdentity from "../profile/GraduateIdentity";
import ColumnFilter from "../ui/ColumnFilter";
import { filterOptions, matchesTextFilter } from "../../utils/tableFilters";
import api from "../../utils/axios";

const EMPLOYMENT_COLUMNS = [
  {
    accessorKey: "name",
    header: "Alumni",
    meta: { headerClassName: "px-3 py-3 font-medium" },
  },
  {
    accessorKey: "employmentStatus",
    header: "Status",
    meta: { headerClassName: "px-3 py-3 font-medium" },
  },
  {
    accessorKey: "currentCompany",
    header: "Company / position",
    meta: { headerClassName: "px-3 py-3 font-medium" },
  },
  {
    accessorKey: "industry",
    header: "Industry",
    meta: { headerClassName: "px-3 py-3 font-medium" },
  },
  {
    accessorKey: "history",
    header: "Employment History",
    meta: { headerClassName: "px-3 py-3 font-medium" },
  },
];

const card = "admin-panel p-4";
const input =
  "h-10 min-w-0 rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none focus:border-brand dark:border-zinc-700 dark:bg-zinc-900";
const button = "admin-button admin-button-secondary";
const labelMonth = (value) => (value ? value.slice(0, 7) : "Date not provided");
const csvCell = (value) => {
  const text = String(value ?? "");
  return `"${(/^[=+@\-\t\r]/.test(text) ? "'" : "") + text.replace(/"/g, '""')}"`;
};

const displayMonth = value => {
  const month = typeof value === 'string' ? value.slice(0, 7) : '';
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return 'Date not provided';
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
};

function EmploymentHistoryDetails({ person, onClose }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [person._id]);
  const jobs = [...person.employmentHistory].reverse();
  return <dialog ref={dialogRef} id={`employment-history-${person._id}`} aria-label={`${person.name} employment history`}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const controls = event.currentTarget.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]');
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    className="m-auto max-h-[85dvh] w-[min(560px,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-zinc-200 bg-zinc-50 p-0 text-zinc-900 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
    <div className="p-5 sm:p-6">
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand/10 text-sm font-semibold text-brand ring-1 ring-black/5 dark:ring-white/10"><ProfileAvatar user={person} fallback={person.email || 'U'} /></span>
        <div><h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Employment history</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{person.name}</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{jobs.length} recorded {jobs.length === 1 ? 'position' : 'positions'}</p>
        </div>
      </div>
      <button ref={closeRef} type="button" onClick={onClose} aria-label={`Close employment history for ${person.name}`}
        className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-200 focus-visible:outline-brand dark:text-zinc-400 dark:hover:bg-zinc-800"><X size={16} /></button>
    </div>
    <ol className="ml-4 mt-5 space-y-5 border-l border-zinc-300 pl-5 dark:border-zinc-700">
      {jobs.map((job, index) => <li key={job._id || index} className="relative">
        <span aria-hidden="true" className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-brand ring-4 ring-zinc-50 dark:ring-zinc-900" />
        <div className="flex flex-wrap items-center gap-2">
          <p className="break-words text-sm font-semibold text-zinc-900 dark:text-zinc-100">{job.position || job.role || 'Position not specified'}</p>
          {job.current && <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">Current</span>}
        </div>
        <p className="mt-1 break-words text-sm text-zinc-600 dark:text-zinc-300">{job.company || 'Company not specified'}</p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{displayMonth(job.startDate)} – {job.current ? 'Present' : displayMonth(job.endDate)}{job.industry ? ` · ${job.industry}` : ''}</p>
      </li>)}
    </ol>
    </div>
  </dialog>;
}

export default function EmploymentReports() {
  const [report, setReport] = useState(null);
  const [batch, setBatch] = useState("");
  const [program, setProgram] = useState("");
  const [query, setQuery] = useState("");
  const [columnFilters, setColumnFilters] = useState({});
  const changeColumn = (key, value) => {
    setColumnFilters(previous => ({ ...previous, [key]: value })); setPage(1); setExpanded(null);
  };
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [expanded, setExpanded] = useState(null);
  const generation = useRef(0);
  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/employment/reports", {
        params: {
          ...(batch ? { batch } : {}),
          ...(program ? { program } : {}),
        },
      });
      if (request === generation.current) setReport(response.data.data);
    } catch (err) {
      if (request === generation.current)
        setError(
          err.response?.data?.message || "Unable to load employment reports.",
        );
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [batch, program]);
  useEffect(() => {
    void load();
    return () => {
      ++generation.current;
    };
  }, [load]);
  const filtered = (report?.alumni || []).filter(
    (person) =>
      (!status || person.employmentStatus === status) &&
      [
        person.name,
        person.email,
        person.currentCompany,
        person.position,
        person.industry,
      ].some((value) =>
        value.toLowerCase().includes(query.trim().toLowerCase()),
      ) && Object.entries(columnFilters).every(([key, value]) => {
        if (!value) return true;
        if (key === 'name') return matchesTextFilter([person.name, person.email, person.program, person.batch], value);
        if (key === 'currentCompany') return matchesTextFilter([person.currentCompany, person.position], value);
        if (key === 'industry') return value === '__none__' ? !person.industry : person.industry === value;
        if (key === 'history') return value === 'none' ? !person.employmentHistory.length
          : value === 'current' ? person.employmentHistory.some(job => job.current) : person.employmentHistory.length > 0;
        return person[key] === value;
      }),
  );
  const columnOptions = {
    employmentStatus: (report?.statusDistribution || []).map(item => ({ value: item.status, label: item.status })),
    industry: [...filterOptions((report?.alumni || []).map(person => person.industry)), { value: '__none__', label: 'No industry reported' }],
    history: [{ value: 'none', label: 'No history' }, { value: 'recorded', label: 'With history' }, { value: 'current', label: 'Has current role' }],
  };
  const employmentTable = useReactTable({
    data: filtered,
    columns: EMPLOYMENT_COLUMNS,
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
          ? updater(employmentTable.getState().pagination)
          : updater;
      setPage(next.pageIndex + 1);
      setPerPage(next.pageSize);
      setExpanded(null);
    },
  });
  const totalPages = Math.max(1, employmentTable.getPageCount());
  const currentPage = employmentTable.getState().pagination.pageIndex + 1;
  const paged = employmentTable.getRowModel().rows.map((row) => row.original);
  const exportReport = () => {
    const rows = [
      ["Employment report", "Value"],
      ["Batch", batch || "All"],
      ["Program", program || "All"],
      ...EMPLOYMENT_COLUMNS.map(column => {
        const value = columnFilters[column.accessorKey];
        return [`Column filter: ${column.header}`, columnOptions[column.accessorKey]?.find(option => option.value === value)?.label || value || 'All'];
      }),
      ["Total alumni", report.summary.totalAlumni],
      ["Reported status", report.summary.reported],
      ["Not reported", report.summary.notReported],
      [
        "Employment rate (%) among reported alumni",
        report.summary.employmentRate,
      ],
      ["Reporting rate (%)", report.summary.reportingRate],
      [],
      ["Industry", "Employed alumni", "Share of employed (%)"],
      ...report.industryDistribution.map((item) => [
        item.industry,
        item.count,
        item.percentage,
      ]),
      [],
      [
        "Name",
        "Email",
        "Batch",
        "Program",
        "Status",
        "Company",
        "Position",
        "Industry",
        "Start month",
        "Recorded role changes",
      ],
      ...filtered.map((person) => [
        person.name,
        person.email,
        person.batch,
        person.program,
        person.employmentStatus,
        person.currentCompany,
        person.position,
        person.industry,
        person.startDate,
        person.transitions.filter(
          (step) => step.companyChanged || step.positionChanged,
        ).length,
      ]),
      [],
      [
        "Career progression",
        "Company",
        "Position",
        "Industry",
        "Start",
        "End",
        "Current",
      ],
      ...filtered.flatMap((person) =>
        person.employmentHistory.map((job) => [
          person.name,
          job.company,
          job.position || job.role,
          job.industry,
          job.startDate,
          job.endDate,
          job.current ? "Yes" : "No",
        ]),
      ),
    ];
    const url = URL.createObjectURL(
      new Blob(
        ["\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n")],
        { type: "text/csv;charset=utf-8;" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "alumni-employment-report.csv";
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section aria-label="Alumni employment reports" className="space-y-4">
      <header
        className={`${card} flex flex-wrap items-center justify-between gap-4`}
      >
        <div>
          <h2 className="admin-section-title text-xl font-semibold">
            Alumni employment tracking
          </h2>
          <p className="mt-1 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
            Employment outcomes and career history from alumni profiles.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className={button}
          >
            <RefreshCw size={15} />
            Refresh
          </button>
          <button
            type="button"
            onClick={exportReport}
            disabled={loading || !!error || !report}
            className={button}
          >
            <Download size={15} />
            Export CSV
          </button>
        </div>
      </header>
      <section
        className={`${card} flex flex-wrap gap-3`}
        aria-label="Report filters"
      >
        <label className="flex min-w-0 flex-col gap-2 text-xs font-medium">
          Batch
          <select
            aria-label="Filter batch"
            value={batch}
            onChange={(event) => {
              setBatch(event.target.value);
              setPage(1);
            }}
            className={input}
          >
            <option value="">All batches</option>
            {report?.filters.batches.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-2 text-xs font-medium">
          Program
          <select
            aria-label="Filter program"
            value={program}
            onChange={(event) => {
              setProgram(event.target.value);
              setPage(1);
            }}
            className={`${input} max-w-full`}
          >
            <option value="">All programs</option>
            {report?.filters.programs.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </section>
      {error && (
        <p
          role="alert"
          className={`${card} text-sm text-red-600 dark:text-red-400`}
        >
          {error}{" "}
          <button type="button" onClick={load} className="underline">
            Retry
          </button>
        </p>
      )}
      {loading ? (
        <p role="status" className={card}>
          Loading employment reports…
        </p>
      ) : (
        !error &&
        report && (
          <>
            <AdminStatGrid columns={4}>
              {[
                [
                  "Employment rate",
                  `${report.summary.employmentRate}%`,
                  `${report.summary.employed} employed / ${report.summary.reported} reported`,
                ],
                [
                  "Reporting coverage",
                  `${report.summary.reportingRate}%`,
                  `${report.summary.reported} of ${report.summary.totalAlumni} alumni`,
                ],
                [
                  "Not reported",
                  report.summary.notReported,
                  "No status or current role reported",
                ],
                [
                  "Career changes",
                  report.summary.alumniWithCareerChanges,
                  "Alumni with recorded company or position changes",
                ],
              ].map(([label, value, detail], index) => (
                <AdminStatCard
                  key={label}
                  label={label}
                  value={value}
                  detail={detail}
                  icon={Briefcase}
                  featured={index === 0}
                />
              ))}
            </AdminStatGrid>
            <section className={card}>
              <h2 className="admin-section-title text-base font-semibold">
                Career progression
              </h2>
              <p className="mt-1 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
                View recorded roles over time. Position changes are shown as
                history; seniority is not inferred.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <input
                  type="search"
                  aria-label="Search alumni employment"
                  placeholder="Search name, company, position or industry"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                    setExpanded(null);
                  }}
                  className={`${input} flex-1 basis-64`}
                />
                <select
                  aria-label="Filter employment status"
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value);
                    setPage(1);
                    setExpanded(null);
                  }}
                  className={input}
                >
                  <option value="">All statuses</option>
                  {report.statusDistribution.map((item) => (
                    <option key={item.status}>{item.status}</option>
                  ))}
                </select>
              </div>
              <p
                role="status"
                className="mt-4 text-xs text-zinc-500 dark:text-zinc-400"
              >
                {filtered.length} alumni
                {Object.values(columnFilters).some(Boolean) && <button type="button" onClick={() => { setColumnFilters({}); setPage(1); setExpanded(null); }} className="ml-3 font-semibold text-brand underline">Clear column filters</button>}
              </p>
              <div role="region" aria-label="Alumni employment records" tabIndex={0} className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[750px] text-left text-xs">
                  <thead>
                    {employmentTable.getHeaderGroups().map((group) => (
                      <tr key={group.id}>
                        {group.headers.map((header) => (
                          <th
                            key={header.id}
                            scope="col"
                            colSpan={header.colSpan}
                            className={`${header.column.columnDef.meta?.headerClassName} min-w-[160px]`}
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext(),
                                )}
                            {!header.isPlaceholder && <ColumnFilter label={`Filter employment ${header.column.columnDef.header}`}
                              value={columnFilters[header.column.id] || ''} onChange={value => changeColumn(header.column.id, value)}
                              options={columnOptions[header.column.id]} />}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {paged.map((person) => (
                      <tr
                        key={person._id}
                        className="border-b border-zinc-100 dark:border-zinc-800"
                      >
                        <td className="min-w-[320px] max-w-[380px] px-3 py-4">
                          <GraduateIdentity user={person} />
                        </td>
                        <td className="px-3 py-4">{person.employmentStatus}</td>
                        <td className="max-w-64 break-words px-3 py-4">
                          <p>{person.currentCompany || "—"}</p>
                          <p className="mt-1 text-zinc-500 dark:text-zinc-400">
                            {person.position}
                          </p>
                        </td>
                        <td className="px-3 py-4">{person.industry || "—"}</td>
                        <td className="px-3 py-4">
                          {person.employmentHistory.length > 0 ? <div className="space-y-1.5">
                          <button
                            type="button"
                            aria-label={`View employment history for ${person.name}`}
                            aria-haspopup="dialog"
                            onClick={() => setExpanded(person._id)}
                            className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:border-brand hover:text-brand focus-visible:outline-brand dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
                          >
                            View details <ChevronRight size={14} />
                          </button>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{person.employmentHistory.length} {person.employmentHistory.length === 1 ? 'entry' : 'entries'}</p>
                          </div> : <span className="text-xs text-zinc-500 dark:text-zinc-400">No history</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!filtered.length && (
                <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  No alumni match this selection.
                </p>
              )}
              <DataPagination
                page={currentPage}
                totalPages={totalPages}
                onPageChange={(value) =>
                  employmentTable.setPageIndex(value - 1)
                }
                perPage={perPage}
                onPerPageChange={(pageSize) =>
                  employmentTable.setPagination({ pageIndex: 0, pageSize })
                }
                totalItems={filtered.length}
                itemLabel="alumni"
              />
              {paged.filter(person => person._id === expanded && person.employmentHistory.length > 0).map(person =>
                <EmploymentHistoryDetails key={person._id} person={person} onClose={() => setExpanded(null)} />)}
            </section>

            <p className="px-1 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
              Employment rate = employed and self-employed alumni ÷ alumni with
              a reported status. Studying and unemployed are included in the
              denominator. Missing reports are excluded. Batch and program
              filters apply to all summaries; search, status, and column filters narrow the
              alumni list and its export.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              <section className={card}>
                <h2 className="admin-section-title text-base font-semibold">
                  Industry distribution
                </h2>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Share of employed and self-employed alumni
                </p>
                <div className="mt-5 space-y-4">
                  {!report.industryDistribution.length && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      No employed alumni in this selection.
                    </p>
                  )}
                  {report.industryDistribution.map((item) => (
                    <div key={item.industry}>
                      <div className="mb-2 flex justify-between gap-3 text-xs">
                        <span className="break-words">{item.industry}</span>
                        <span className="shrink-0 text-zinc-500 dark:text-zinc-400">
                          {item.count} · {item.percentage}%
                        </span>
                      </div>
                      <ProgressBar role="meter" label={item.industry} value={item.percentage} />
                    </div>
                  ))}
                </div>
              </section>
              <section className={card}>
                <h2 className="admin-section-title text-base font-semibold">
                  Employment status
                </h2>
                <dl className="mt-4 space-y-3">
                  {report.statusDistribution.map((item) => (
                    <div
                      key={item.status}
                      className="flex justify-between gap-3 border-b border-zinc-100 pb-3 text-sm last:border-0 dark:border-zinc-800"
                    >
                      <dt className="text-zinc-500 dark:text-zinc-400">
                        {item.status}
                      </dt>
                      <dd className="font-semibold">{item.count}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            </div>
          </>
        )
      )}
    </section>
  );
}
