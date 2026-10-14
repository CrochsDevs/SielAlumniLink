import { createElement, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
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
import api from "../../utils/axios";
import {
  TRACER_STATUS_DETAILS,
  normalizeTracerDetails,
  formatTracerStartMonth,
} from "../../utils/tracerStudy";

const STATUS_STYLE = {
  Employed:
    "bg-[#009639]/10 text-[#007a2e] ring-emerald-200/60 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-800",
  "Self-employed":
    "bg-blue-50 text-blue-600 ring-blue-200/60 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-800",
  Unemployed:
    "bg-red-50 text-red-600 ring-red-200/60 dark:bg-red-950 dark:text-red-300 dark:ring-red-800",
  Studying:
    "bg-amber-50 text-amber-700 ring-amber-200/60 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-800",
};

const FILTERS = ["all", "Employed", "Self-employed", "Unemployed", "Studying"];

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
  ["Batch", 90],
  ["Program", 340],
  ["Status", 150],
  ["Company / Business / School", 260],
  ["Job / Business / Course", 260],
  ["Salary / Income", 180],
  ["Start Month", 150],
  ["Location", 260],
  ["Responded", 145],
  ["Updated", 145],
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

export default function TracerResponses() {
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  useEffect(() => {
    api
      .get("/tracer")
      .then((tracerRes) => {
        setResponses((tracerRes.data.data || []).map(normalizeTracerDetails));
      })
      .catch((err) =>
        Swal.fire(
          "Error",
          err.response?.data?.message || "Failed to load tracer responses",
          "error",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

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
    return matchesQuery && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  // Accreditation / institutional reporting export.
  const exportCSV = () => {
    const headers = [
      "Email",
      "Batch Graduated",
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
      r.email || "",
      r.batch || "",
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
    a.download = `tracer-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section aria-label="Tracer survey responses" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Tracer responses
        </h2>
        <p className="mt-1 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
          Graduate survey submissions and employment outcomes reported in the
          Tracer Study form.
        </p>
      </div>
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
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
        ].map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                {label}
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#009639]/10 text-[#009639] dark:text-emerald-300">
                {createElement(Icon, { className: "h-4 w-4" })}
              </span>
            </div>
            <p className="mt-1.5 text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
              {value}
            </p>
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
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              aria-label="Search tracer responses"
              placeholder="Search email, batch, program, or details..."
              className="h-10 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 pl-9 pr-3 text-[12.5px] outline-none transition focus:border-[#009639] focus:bg-white dark:focus:bg-zinc-800 focus:ring-2 focus:ring-[#009639]/15"
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
              className="h-10 min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 outline-none focus:border-[#009639] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:[color-scheme:dark] sm:flex-none"
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
              disabled={filtered.length === 0}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-zinc-900 px-3.5 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        <div
          data-tracer-table
          role="region"
          aria-label="Tracer study responses"
          aria-describedby="tracer-scroll-hint"
          tabIndex={0}
          className="max-h-[600px] overflow-auto overscroll-contain focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#009639]"
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
              <tr className="text-[10.5px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {TABLE_COLUMNS.map(([label], index) => (
                  <th
                    key={label}
                    scope="col"
                    className={`sticky top-0 border-b border-zinc-200 bg-zinc-50 px-4 py-3.5 font-semibold whitespace-nowrap dark:border-zinc-700 dark:bg-zinc-800 ${index === 0 ? "md:left-0 z-30 border-r dark:border-r-zinc-700" : "z-20"}`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
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
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[12px] font-bold text-[#009639] dark:bg-emerald-950 dark:text-emerald-300">
                          {(r.email || "U").charAt(0).toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="block break-all font-semibold leading-relaxed text-zinc-800 dark:text-zinc-100">
                            {r.email}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                      {r.batch}
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
                      <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-[#009639] dark:bg-emerald-950 dark:text-emerald-300">
                        <ClipboardList className="h-6 w-6" />
                      </span>
                      <p className="text-[13px] font-bold text-zinc-700 dark:text-zinc-200">
                        {responses.length === 0
                          ? "No responses yet"
                          : "No responses found"}
                      </p>
                    </div>
                    <p className="mt-0.5 text-[12px] text-zinc-400 dark:text-zinc-500">
                      {responses.length === 0
                        ? "Alumni answer via the Tracer Study form."
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
          onPageChange={setPage}
          perPage={perPage}
          onPerPageChange={(n) => {
            setPerPage(n);
            setPage(1);
          }}
          totalItems={filtered.length}
          itemLabel="responses"
        />
      </div>
    </section>
  );
}
