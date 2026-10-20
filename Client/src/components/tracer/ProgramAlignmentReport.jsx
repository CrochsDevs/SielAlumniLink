import AdminStatCard from "../admin/AdminStatCard";
import { AdminStatGrid } from "../admin/AdminUI";
import { useCallback, useEffect, useRef, useState } from "react";
import { Download, RefreshCw, ClipboardCheck } from "lucide-react";
import api from "../../utils/axios";
import DataPagination from "../ui/data-pagination";
import { JOB_ALIGNMENT_OPTIONS } from "../../utils/tracerStudy";

const card =
  "admin-panel p-4";
const input =
  "h-10 w-full min-w-0 rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none focus:border-brand dark:border-zinc-700 dark:bg-zinc-900";
const button =
  "admin-button admin-button-secondary";
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

export default function ProgramAlignmentReport() {
  const [filters, setFilters] = useState({
    followUp: "3-5",
    program: "",
    batch: "",
    alignment: "",
    query: "",
  });
  const [query, setQuery] = useState("");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
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
  const change = (key, value) => {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setPage(1);
  };
  const totalPages = Math.max(
    1,
    Math.ceil((report?.rows.length || 0) / perPage),
  );
  const currentPage = Math.min(page, totalPages);
  const rows =
    report?.rows.slice((currentPage - 1) * perPage, currentPage * perPage) ||
    [];
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
      ...report.programs.map((item) => [
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
      ...report.rows.map((row) => [
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
            disabled={loading || !!error || !report?.rows.length}
            className={button}
          >
            <Download size={15} />
            Export alignment CSV
          </button>
        </div>
      </header>
      <section aria-label="Alignment filters" className={card}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
        <p role="status" className={card}>
          Loading program-job alignment…
        </p>
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
              ].map(([label, value, detail], index) => <AdminStatCard key={label} label={label} value={value} detail={detail} icon={ClipboardCheck} featured={index === 0} />)}
            </AdminStatGrid>
            <p className="px-1 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
              Alignment is reported by alumni based on their duties. Rates
              exclude Not sure, Not reported, and non-working responses. Years
              after graduation = response year − graduation year (calendar-year
              estimate). Each alumnus/program/batch contributes its latest
              response within the selected period; a past response is not
              treated as their current job.
            </p>
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
                    Alignment by graduation program
                  </h3>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[860px] text-left text-xs">
                      <thead>
                        <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                          {[
                            "Graduation program",
                            "Working",
                            "Directly related",
                            "Partly related",
                            "Unrelated",
                            "Not sure / not reported",
                            "Direct alignment rate",
                          ].map((label) => (
                            <th
                              scope="col"
                              key={label}
                              className="px-3 py-3 font-medium"
                            >
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {report.programs.map((item) => (
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
                <section className={card}>
                  <h3 className="admin-section-title text-base font-semibold">
                    Program and reported work
                  </h3>
                  <p
                    role="status"
                    className="mt-1 text-xs text-zinc-500 dark:text-zinc-400"
                  >
                    {report.rows.length} responses in the selected period
                  </p>
                  <div
                    role="region"
                    aria-label="Alumni program and work alignment"
                    tabIndex={0}
                    className="mt-4 overflow-x-auto"
                  >
                    <table className="w-full min-w-[1100px] text-left text-xs">
                      <thead>
                        <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                          {[
                            "Alumni / graduation program",
                            "Follow-up",
                            "Reported job / business",
                            "Alignment",
                            "Duties and explanation",
                          ].map((label) => (
                            <th
                              scope="col"
                              key={label}
                              className="px-3 py-3 font-medium"
                            >
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr
                            key={`${row.authId}:${row.program}:${row.batch}`}
                            className="border-b border-zinc-100 align-top dark:border-zinc-800"
                          >
                            <td className="max-w-72 break-words px-3 py-4">
                              <p className="font-medium">
                                {row.name || row.email}
                              </p>
                              <p className="mt-2">{row.program}</p>
                              <p className="mt-1 text-zinc-500 dark:text-zinc-400">
                                Graduated {row.batch}
                              </p>
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
                                className={`inline-block rounded-lg px-2 py-1 font-medium ${row.alignment === "directly_related" ? "bg-emerald-50 text-brand dark:bg-emerald-950 dark:text-brand" : row.alignment === "unrelated" ? "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"}`}
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
                    onPageChange={setPage}
                    perPage={perPage}
                    onPerPageChange={(value) => {
                      setPerPage(value);
                      setPage(1);
                    }}
                    totalItems={report.rows.length}
                    itemLabel="responses"
                  />
                </section>
              </>
            )}
          </>
        )
      )}
    </section>
  );
}
