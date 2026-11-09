import ContentSkeleton from "../ui/Skeleton";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import AdminStatCard from "../admin/AdminStatCard";
import { AdminStatGrid } from "../admin/AdminUI";
import { useCallback, useEffect, useRef, useState } from "react";
import { Download, RefreshCw, ClipboardCheck } from "lucide-react";
import api from "../../utils/axios";
import DataPagination from "../ui/data-pagination";
import GraduateIdentity from "../profile/GraduateIdentity";
import ColumnFilter from "../ui/ColumnFilter";
import { matchesTextFilter, matchesNumberFilter } from "../../utils/tableFilters";
import { JOB_ALIGNMENT_OPTIONS } from "../../utils/tracerStudy";

const PROGRAM_COLUMNS = [
  {
    accessorKey: "program",
    header: "Graduation program",
    meta: { headerClassName: "px-3 py-3 font-medium" },
  },
  {
    accessorKey: "working",
    header: "Working",
    meta: { headerClassName: "px-3 py-3 font-medium" },
  },
  {
    accessorKey: "directlyRelated",
    header: "Directly related",
    meta: { headerClassName: "px-3 py-3 font-medium" },
  },
  {
    accessorKey: "partlyRelated",
    header: "Partly related",
    meta: { headerClassName: "px-3 py-3 font-medium" },
  },
  {
    accessorKey: "unrelated",
    header: "Unrelated",
    meta: { headerClassName: "px-3 py-3 font-medium" },
  },
  {
    accessorKey: "unassessed",
    header: "Not sure / not reported",
    meta: { headerClassName: "px-3 py-3 font-medium" },
  },
  {
    accessorKey: "directAlignmentRate",
    header: "Direct alignment rate",
    meta: { headerClassName: "px-3 py-3 font-medium" },
  },
];

const ALIGNMENT_COLUMNS = [
  {
    accessorKey: "name",
    header: "Alumni / graduation program",
    meta: { headerClassName: "px-3 py-3 font-medium" },
  },
  {
    accessorKey: "yearsAfterGraduation",
    header: "Follow-up",
    meta: { headerClassName: "px-3 py-3 font-medium" },
  },
  {
    accessorKey: "position",
    header: "Reported job / business",
    meta: { headerClassName: "px-3 py-3 font-medium" },
  },
  {
    accessorKey: "alignment",
    header: "Alignment",
    meta: { headerClassName: "px-3 py-3 font-medium" },
  },
  {
    accessorKey: "explanation",
    header: "Duties and explanation",
    meta: { headerClassName: "px-3 py-3 font-medium" },
  },
];

const card = "admin-panel p-4";
const input =
  "h-10 w-full min-w-0 rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none focus:border-brand dark:border-zinc-700 dark:bg-zinc-900";
const button = "admin-button admin-button-secondary";
const periods = [
  ["3-5", "3–5 years after graduation"],
  ["0-2", "0–2 years after graduation"],
  ["6+", "6+ years after graduation"],
  ["all", "All follow-up periods"],
];
const alignments = [
  ...JOB_ALIGNMENT_OPTIONS,
  { value: "not_reported", label: "Not reported" },
  { value: "not_applicable", label: "Not working / not applicable" },
];
const percentage = (value) =>
  value === null ? "No assessed responses" : `${value}%`;
const responseDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "Asia/Manila",
      })
    : "Date not recorded";
const csvCell = (value) => {
  const text = String(value ?? "");
  return `"${(/^[\s]*[=+@-]/.test(text) ? "'" : "") + text.replace(/"/g, '""')}"`;
};
const EMPTY_COLUMN_FILTERS = { name: '', yearsAfterGraduation: '', position: '', alignment: '', explanation: '' };
const COLUMN_LABELS = {
  name: 'Filter alumni or program', yearsAfterGraduation: 'Filter follow-up years',
  position: 'Filter reported job or business', alignment: 'Filter table alignment', explanation: 'Filter duties and explanation',
};
const columnInput = 'mt-2 block h-9 w-full min-w-[150px] rounded-lg border border-zinc-300 bg-white px-2.5 text-xs font-normal normal-case tracking-normal text-zinc-700 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200';

export default function ProgramAlignmentReport() {
  const [filters, setFilters] = useState({
    followUp: "3-5",
    program: "",
    batch: "",
    alignment: "",
    query: "",
  });
  const [query, setQuery] = useState("");
  const [columnFilters, setColumnFilters] = useState(EMPTY_COLUMN_FILTERS);
  const [programColumnFilters, setProgramColumnFilters] = useState({});
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const generation = useRef(0);
  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/tracer/alignment", { params: filters });
      if (request === generation.current) setReport(response.data.data);
    } catch (err) {
      if (request === generation.current)
        setError(
          err.response?.data?.message ||
            "Unable to load program alignment. Please retry.",
        );
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [filters]);
  useEffect(() => {
    void load();
    return () => {
      ++generation.current;
    };
  }, [load]);
  const filteredPrograms = (report?.programs || []).filter(program => Object.entries(programColumnFilters).every(([key, value]) =>
    key === 'program' ? matchesTextFilter(program.program, value)
      : matchesNumberFilter(key === 'unassessed' ? program.unsure + program.notReported : program[key], value)));
  const programsTable = useReactTable({
    data: filteredPrograms,
    columns: PROGRAM_COLUMNS,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row.program),
    autoResetPageIndex: false,
  });
  const change = (key, value) => {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setPage(1);
    setColumnFilters(EMPTY_COLUMN_FILTERS);
    setProgramColumnFilters({});
  };
  const hasColumnFilters = Object.values(columnFilters).some(Boolean);
  const changeColumnFilter = (key, value) => {
    setColumnFilters(previous => ({ ...previous, [key]: value }));
    setPage(1);
  };
  const contains = (values, search) => values.some(value => String(value || '').toLowerCase().includes(search.trim().toLowerCase()));
  const alignmentRows = (report?.rows || []).filter(row =>
    contains([row.name, row.email, row.program, row.batch], columnFilters.name) &&
    (!columnFilters.yearsAfterGraduation || (columnFilters.yearsAfterGraduation === 'unknown'
      ? row.yearsAfterGraduation === null : String(row.yearsAfterGraduation) === columnFilters.yearsAfterGraduation)) &&
    contains([row.position, row.company, row.status], columnFilters.position) &&
    (!columnFilters.alignment || row.alignment === columnFilters.alignment) &&
    contains([row.explanation], columnFilters.explanation));
  const followUpYears = [...new Set((report?.rows || []).map(row => row.yearsAfterGraduation).filter(value => value !== null))].sort((a, b) => a - b);
  const alignmentTable = useReactTable({
    data: alignmentRows,
    columns: ALIGNMENT_COLUMNS,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => `${row.authId}:${row.program}:${row.batch}`,
    autoResetPageIndex: false,
    state: {
      pagination: {
        pageIndex: Math.min(
          page - 1,
          Math.max(0, Math.ceil(alignmentRows.length / perPage) - 1),
        ),
        pageSize: perPage,
      },
    },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === "function"
          ? updater(alignmentTable.getState().pagination)
          : updater;
      setPage(next.pageIndex + 1);
      setPerPage(next.pageSize);
    },
  });
  const totalPages = Math.max(1, alignmentTable.getPageCount());
  const currentPage = alignmentTable.getState().pagination.pageIndex + 1;
  const rows = alignmentTable.getRowModel().rows.map((row) => row.original);
  const exportCSV = () => {
    const data = [
      ["Program-job alignment — alumni self-reported"],
      [
        "Follow-up period",
        periods.find(([id]) => id === filters.followUp)?.[1],
      ],
      ["Program", filters.program || "All programs"],
      ["Batch", filters.batch || "All batches"],
      ["Alignment filter", filters.alignment || "All"],
      ["Search", filters.query],
      ["Table column filters", "Summary totals use report filters. Each exported table also applies its own column filters."],
      ...Object.entries(columnFilters).map(([key, value]) => [COLUMN_LABELS[key], value || 'All']),
      ...PROGRAM_COLUMNS.map(column => [`Program column filter: ${column.header}`, programColumnFilters[column.accessorKey] || 'All']),
      [
        "Direct alignment rate (%)",
        report.summary.directAlignmentRate ?? "N/A",
      ],
      [
        "Directly or partly related rate (%)",
        report.summary.relatedWorkRate ?? "N/A",
      ],
      [
        "Denominator",
        "Working alumni with directly related, partly related, or unrelated answers; latest observation per alumnus/program/batch within the selected period",
      ],
      [],
      [
        "Program",
        "Working",
        "Directly related",
        "Partly related",
        "Unrelated",
        "Not sure",
        "Not reported",
        "Not working",
        "Direct alignment (%)",
      ],
      ...filteredPrograms.map((item) => [
        item.program,
        item.working,
        item.directlyRelated,
        item.partlyRelated,
        item.unrelated,
        item.unsure,
        item.notReported,
        item.notWorking,
        item.directAlignmentRate ?? "N/A",
      ]),
      [],
      [
        "Alumni email",
        "Graduation program",
        "Graduation year",
        "Years after graduation at response",
        "Response date",
        "Employment status",
        "Employer / business",
        "Job / line of work",
        "Alignment",
        "Duties and explanation",
      ],
      ...alignmentRows.map((row) => [
        row.email,
        row.program,
        row.batch,
        row.yearsAfterGraduation ?? "Unknown",
        responseDate(row.recordedAt),
        row.status,
        row.company,
        row.position,
        row.alignmentLabel,
        row.explanation,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(
        ["\uFEFF" + data.map((row) => row.map(csvCell).join(",")).join("\r\n")],
        { type: "text/csv;charset=utf-8;" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "tracer-program-job-alignment.csv";
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section aria-label="Program-job alignment report" className="space-y-4">
      <header
        className={`${card} flex flex-wrap items-start justify-between gap-4`}
      >
        <div className="max-w-2xl">
          <h2 className="admin-section-title text-xl font-semibold">
            Are alumni working in their field of study?
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            Compare graduation programs with the work alumni reported 3–5 years
            later, or choose another follow-up period.
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
            onClick={exportCSV}
            disabled={loading || !!error || !alignmentRows.length}
            className={button}
          >
            <Download size={15} />
            Export alignment CSV
          </button>
        </div>
      </header>
      <section aria-label="Alignment filters" className={card}>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            ["followUp", "Follow-up period", periods],
            [
              "program",
              "Graduation program",
              [
                ["", "All programs"],
                ...(report?.options.programs || []).map((value) => [
                  value,
                  value,
                ]),
              ],
            ],
            [
              "batch",
              "Graduation year",
              [
                ["", "All graduation years"],
                ...(report?.options.batches || []).map((value) => [
                  value,
                  value,
                ]),
              ],
            ],
            [
              "alignment",
              "Work alignment",
              [
                ["", "All alignment answers"],
                ...alignments.map((item) => [item.value, item.label]),
              ],
            ],
          ].map(([key, label, options]) => (
            <label key={key} className="min-w-0 text-xs font-medium">
              {label}
              <select
                aria-label={label}
                value={filters[key]}
                onChange={(event) => change(key, event.target.value)}
                className={`${input} mt-2`}
              >
                {options.map(([value, title]) => (
                  <option key={value} value={value}>
                    {title}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            change("query", query.trim());
          }}
          className="mt-4 flex gap-2"
        >
          <input
            type="search"
            aria-label="Search alignment report"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search alumni, employer, job or program"
            maxLength={200}
            className={input}
          />
          <button type="submit" className={button}>
            Search
          </button>
        </form>
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
        <ContentSkeleton variant="table" count={5} label="Loading program-job alignment…" />
      ) : (
        !error &&
        report && (
          <>
            <AdminStatGrid columns={4}>
              {[
                [
                  "Direct alignment rate",
                  percentage(report.summary.directAlignmentRate),
                  `${report.summary.directlyRelated} directly related / ${report.summary.assessed} assessed working responses`,
                ],
                [
                  "Directly or partly related",
                  percentage(report.summary.relatedWorkRate),
                  `${report.summary.partlyRelated} partly related; ${report.summary.unrelated} unrelated`,
                ],
                [
                  "Awaiting clear alignment",
                  report.summary.unsure + report.summary.notReported,
                  `${report.summary.unsure} not sure; ${report.summary.notReported} not reported`,
                ],
                [
                  "Alumni responses in period",
                  report.summary.respondents,
                  `${report.summary.working} working; ${report.summary.notWorking} not working / studying`,
                ],
              ].map(([label, value, detail], index) => (
                <AdminStatCard
                  key={label}
                  label={label}
                  value={value}
                  detail={detail}
                  icon={ClipboardCheck}
                  featured={index === 0}
                />
              ))}
            </AdminStatGrid>
            {!report.rows.length ? (
              <div className={`${card} py-10 text-center`}>
                <h3 className="admin-section-title font-semibold">
                  No responses in this follow-up period
                </h3>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  Try another program or period. Alumni need to submit the
                  Tracer Study at the relevant time; older responses cannot
                  establish what their job was 3–5 years after graduation.
                </p>
              </div>
            ) : (
              <>
                <section className={card}>
                  <h3 className="admin-section-title text-base font-semibold">
                    Program and reported work
                  </h3>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <p role="status" className="text-xs text-zinc-500 dark:text-zinc-400">{alignmentRows.length} of {report.rows.length} responses in the selected period</p>
                    {hasColumnFilters && <button type="button" onClick={() => { setColumnFilters(EMPTY_COLUMN_FILTERS); setPage(1); }}
                      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:border-brand hover:text-brand dark:border-zinc-700 dark:text-zinc-300">Clear column filters</button>}
                  </div>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Column filters apply to this table and exported details. Summary totals follow the report filters above.</p>
                  <div
                    role="region"
                    aria-label="Alumni program and work alignment"
                    tabIndex={0}
                    className="mt-4 overflow-x-auto"
                  >
                    <table className="w-full min-w-[1100px] text-left text-xs">
                      <thead>
                        {alignmentTable.getHeaderGroups().map((group) => (
                          <tr
                            key={group.id}
                            className={
                              "border-b border-zinc-200 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
                            }
                          >
                            {group.headers.map((header) => (
                              <th
                                key={header.id}
                                scope="col"
                                colSpan={header.colSpan}
                                className={
                                  header.column.columnDef.meta?.headerClassName
                                }
                              >
                                {header.isPlaceholder
                                  ? null
                                  : flexRender(
                                      header.column.columnDef.header,
                                      header.getContext(),
                                    )}
                                {!header.isPlaceholder && (header.column.id === 'yearsAfterGraduation' ?
                                  <select aria-label={COLUMN_LABELS[header.column.id]} value={columnFilters[header.column.id]}
                                    onChange={event => changeColumnFilter(header.column.id, event.target.value)} className={columnInput}>
                                    <option value="">All follow-up years</option>
                                    {followUpYears.map(year => <option key={year} value={year}>{year} {year === 1 ? 'year' : 'years'} after graduation</option>)}
                                    {(report.rows.some(row => row.yearsAfterGraduation === null)) && <option value="unknown">Years unknown</option>}
                                  </select>
                                  : header.column.id === 'alignment' ?
                                    <select aria-label={COLUMN_LABELS[header.column.id]} value={columnFilters.alignment}
                                      onChange={event => changeColumnFilter('alignment', event.target.value)} className={columnInput}>
                                      <option value="">All alignments</option>
                                      {alignments.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                    </select>
                                    : <input type="search" maxLength={200} aria-label={COLUMN_LABELS[header.column.id]}
                                      placeholder={header.column.id === 'name' ? 'Name, email, program…' : header.column.id === 'position' ? 'Job, business, employer…' : 'Search explanation…'}
                                      value={columnFilters[header.column.id]}
                                      onChange={event => changeColumnFilter(header.column.id, event.target.value)} className={columnInput} />)}
                              </th>
                            ))}
                          </tr>
                        ))}
                      </thead>
                      <tbody>
                        {!rows.length && <tr><td colSpan={ALIGNMENT_COLUMNS.length} className="px-3 py-8 text-sm text-zinc-500 dark:text-zinc-400">No responses match these column filters. Clear or adjust the filters above.</td></tr>}
                        {rows.map((row) => (
                          <tr
                            key={`${row.authId}:${row.program}:${row.batch}`}
                            className="border-b border-zinc-100 align-top dark:border-zinc-800"
                          >
                            <td className="min-w-[320px] max-w-[380px] px-3 py-4">
                              <GraduateIdentity user={row} />
                            </td>
                            <td className="px-3 py-4">
                              <p>
                                {row.yearsAfterGraduation === null
                                  ? "Years unknown"
                                  : `${row.yearsAfterGraduation} years after graduation`}
                              </p>
                              <p className="mt-2 text-zinc-500 dark:text-zinc-400">
                                {responseDate(row.recordedAt)}
                              </p>
                            </td>
                            <td className="max-w-56 break-words px-3 py-4">
                              <p className="font-medium">
                                {row.position || "No job reported"}
                              </p>
                              <p className="mt-1">{row.company}</p>
                              <p className="mt-2 text-zinc-500 dark:text-zinc-400">
                                {row.status}
                              </p>
                            </td>
                            <td className="px-3 py-4">
                              <span
                                className={`inline-block rounded-lg px-2 py-1 font-medium ${row.alignment === "directly_related" ? "bg-emerald-50 text-brand dark:bg-zinc-800 dark:text-brand" : row.alignment === "unrelated" ? "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"}`}
                              >
                                {row.alignmentLabel}
                              </span>
                            </td>
                            <td className="max-w-80 whitespace-pre-wrap break-words px-3 py-4 leading-6">
                              {row.explanation ||
                                (row.alignment === "not_reported"
                                  ? "Alumnus has not answered the alignment question yet."
                                  : "No explanation provided.")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <DataPagination
                    page={currentPage}
                    totalPages={totalPages}
                    onPageChange={(value) =>
                      alignmentTable.setPageIndex(value - 1)
                    }
                    perPage={perPage}
                    onPerPageChange={(pageSize) =>
                      alignmentTable.setPagination({ pageIndex: 0, pageSize })
                    }
                    totalItems={alignmentRows.length}
                    itemLabel="responses"
                  />
                </section>
                <section className={card}>
                  <h3 className="admin-section-title text-base font-semibold">
                    Alignment by graduation program
                  </h3>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <p>{filteredPrograms.length} of {report.programs.length} programs · Numeric filters accept =, &gt;, &lt;, &gt;=, &lt;= (for example, &gt;=5).</p>
                    {Object.values(programColumnFilters).some(Boolean) && <button type="button" onClick={() => setProgramColumnFilters({})} className="font-semibold text-brand underline">Clear program column filters</button>}
                  </div>
                  <div role="region" aria-label="Alignment totals by program" tabIndex={0} className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[860px] text-left text-xs">
                      <thead>
                        {programsTable.getHeaderGroups().map((group) => (
                          <tr
                            key={group.id}
                            className={
                              "border-b border-zinc-200 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
                            }
                          >
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
                                {!header.isPlaceholder && <ColumnFilter label={`Filter program summary ${header.column.columnDef.header}`}
                                  value={programColumnFilters[header.column.id] || ''}
                                  onChange={value => setProgramColumnFilters(previous => ({ ...previous, [header.column.id]: value }))}
                                  placeholder={header.column.id === 'program' ? 'Search program…' : 'e.g. >=5'} />}
                              </th>
                            ))}
                          </tr>
                        ))}
                      </thead>
                      <tbody>
                        {!filteredPrograms.length && <tr><td colSpan={PROGRAM_COLUMNS.length} className="px-3 py-8 text-zinc-500 dark:text-zinc-400">No programs match these column filters.</td></tr>}
                        {programsTable
                          .getRowModel()
                          .rows.map(({ original: item }) => (
                            <tr
                              key={item.program}
                              className="border-b border-zinc-100 dark:border-zinc-800"
                            >
                              <th
                                scope="row"
                                className="max-w-72 whitespace-normal px-3 py-4 font-medium"
                              >
                                {item.program}
                              </th>
                              {[
                                item.working,
                                item.directlyRelated,
                                item.partlyRelated,
                                item.unrelated,
                                item.unsure + item.notReported,
                                percentage(item.directAlignmentRate),
                              ].map((value, index) => (
                                <td key={index} className="px-3 py-4">
                                  {value}
                                </td>
                              ))}
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}

            <p className="px-1 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
              Alignment is reported by alumni based on their duties. Rates
              exclude Not sure, Not reported, and non-working responses. Years
              after graduation = response year − graduation year (calendar-year
              estimate). Each alumnus/program/batch contributes its latest
              response within the selected period; a past response is not
              treated as their current job.
            </p>
          </>
        )
      )}
    </section>
  );
}
