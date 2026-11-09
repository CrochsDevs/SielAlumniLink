import ContentSkeleton from "../../components/ui/Skeleton";
import { useCallback, useEffect, useRef, useState } from "react";
import { Building2, Briefcase, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import AlumniSidebar from "../../layout/sidebar/alumni/alumniSidebar";
import AlumniTopbar from "../../layout/topbar/alumni/alumniTopbar";
import { FeedDialog } from "../../components/feed/FeedComposer";
import api from "../../utils/axios";
import "./alumniEmployment.css";

const STATUSES = ["Employed", "Self-employed", "Unemployed", "Studying"];
const INDUSTRIES = [
  "Agriculture",
  "Business Services",
  "Construction",
  "Education",
  "Engineering",
  "Finance",
  "Government",
  "Healthcare",
  "Hospitality",
  "Information Technology",
  "Manufacturing",
  "Marketing",
  "Retail",
  "Transportation",
];
const emptyForm = {
  employmentStatus: "",
  currentCompany: "",
  position: "",
  industry: "",
  location: "",
  startDate: "",
};
const emptyPast = {
  company: "",
  position: "",
  industry: "",
  location: "",
  startDate: "",
  endDate: "",
};
const card =
  "rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6";
const input =
  "alumni-employment-field mt-1 h-9 w-full min-w-0 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:[color-scheme:dark]";
const button =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-xs font-semibold text-white hover:bg-brand disabled:opacity-50";
const monthLabel = (value) =>
  /^\d{4}-\d{2}/.test(value || "")
    ? new Date(`${value.slice(0, 7)}-01T00:00:00`).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
    : "Date not provided";
const fromState = (state) => ({
  ...emptyForm,
  ...Object.fromEntries(
    Object.keys(emptyForm).map((key) => [key, state[key] || ""]),
  ),
  employmentStatus: STATUSES.includes(state.employmentStatus)
    ? state.employmentStatus
    : "",
});

export default function AlumniEmployment() {
  const { user, refreshUser } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [record, setRecord] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [past, setPast] = useState(emptyPast);
  const [showAdd, setShowAdd] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const pending = useRef(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/employment/me");
      setRecord(data.data);
      setForm(fromState(data.data));
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load employment. Please retry.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => { if (active) void load(); });
    return () => { active = false; };
  }, [load]);
  const mutate = async (task, success) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await task();
      setRecord(response.data.data);
      setForm(fromState(response.data.data));
      setShowAdd(false);
      setDeleting(null);
      setPast(emptyPast);
      setMessage(success);
      await refreshUser();
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to save. Please try again.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const working =
    form.employmentStatus === "Employed" ||
    form.employmentStatus === "Self-employed";
  const field = (
    name,
    label,
    values,
    setter,
    required = false,
    type = "text",
  ) => (
    <label className="block text-xs font-medium">
      {label}
      {required && " *"}
      <input
        aria-label={label}
        type={type}
        value={values[name]}
        onChange={(event) => {
          setter((previous) => ({ ...previous, [name]: event.target.value }));
          setMessage("");
        }}
        required={required}
        maxLength={200}
        list={name === "industry" ? "employment-industries" : undefined}
        className={input}
      />
    </label>
  );
  const history = (record?.employmentHistory || [])
    .map((job, index) => ({ ...job, index }))
    .sort(
      (a, b) =>
        Number(b.current) - Number(a.current) ||
        (b.startDate || "").localeCompare(a.startDate || ""),
    );

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <AlumniSidebar
        user={user}
        mobileOpen={sidebarOpen}
        setMobileOpen={setSidebarOpen}
      />
      <div className="lg:pl-64">
        <AlumniTopbar
          user={user}
          title="Employment"
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6 workspace-page">
          <header className="rounded-2xl bg-gradient-to-br from-brand to-brand p-6 text-white workspace-page-header dark:from-zinc-900 dark:to-zinc-900">
            <div className="flex items-center gap-3">
              <Building2 size={25} />
              <h1 className="text-xl font-semibold">My employment</h1>
            </div>
            <p className="mt-2 text-sm leading-6 text-white/85">
              Keep your current role up to date and track your career journey.
            </p>
            {record && (
              <p className="mt-4 text-sm font-semibold">
                {record.employmentStatus}
                {record.currentCompany &&
                  ` · ${record.position} at ${record.currentCompany}`}
              </p>
            )}
          </header>
          {error && (
            <div
              role="alert"
              className={`${card} text-sm text-red-600 dark:text-red-400`}
            >
              {error}{" "}
              <button
                type="button"
                disabled={busy}
                onClick={load}
                className="font-semibold underline"
              >
                Refresh
              </button>
            </div>
          )}
          {message && (
            <p
              role="status"
              className="rounded-lg bg-emerald-50 p-3 text-sm text-brand dark:bg-zinc-800 dark:text-brand"
            >
              {message}
            </p>
          )}
          {loading ? (
            <ContentSkeleton variant="table" count={5} label="Loading employment…" />
          ) : (
            record && (
              <>
                <section className={card}>
                  <h2 className="text-base font-semibold">
                    Current employment
                  </h2>
                  <p className="mt-1 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
                    A new company or position adds a step to your history.
                    Previous roles remain available below.
                  </p>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void mutate(
                        () => api.put("/employment/me", { ...form, revision: record.historyRevision }),
                        "Employment updated.",
                      );
                    }}
                    className="mt-4"
                  >
                    <fieldset
                      disabled={busy}
                      className="grid gap-4 sm:grid-cols-2"
                    >
                      <label className="block text-xs font-medium">
                        Employment status *
                        <select
                          aria-label="Employment status"
                          required
                          value={form.employmentStatus}
                          onChange={(event) => {
                            setForm((previous) => ({
                              ...previous,
                              employmentStatus: event.target.value,
                            }));
                            setMessage("");
                          }}
                          className={`${input} block`}
                        >
                          <option value="">Select your status</option>
                          {STATUSES.map((status) => (
                            <option key={status}>{status}</option>
                          ))}
                        </select>
                      </label>
                      {working && (
                        <>
                          {field(
                            "currentCompany",
                            form.employmentStatus === "Self-employed"
                              ? "Current company / business"
                              : "Current company",
                            form,
                            setForm,
                            true,
                          )}
                          {field("position", "Position", form, setForm, true)}
                          {field("industry", "Industry", form, setForm, true)}
                          {field("location", "Location", form, setForm)}
                          {field(
                            "startDate",
                            "Start month",
                            form,
                            setForm,
                            true,
                            "month",
                          )}
                        </>
                      )}
                      {!working && form.employmentStatus && (
                        <p className="text-xs leading-6 text-zinc-500 sm:col-span-2 dark:text-zinc-400">
                          Saving this status ends any current role and preserves
                          your work history.
                        </p>
                      )}
                      <div className="sm:col-span-2">
                        <button type="submit" className={button}>
                          {busy ? "Saving…" : "Save employment"}
                        </button>
                        {record.employmentUpdatedAt && (
                          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                            Last updated{" "}
                            {new Date(
                              record.employmentUpdatedAt,
                            ).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                        )}
                      </div>
                    </fieldset>
                  </form>
                </section>
                <section className={card}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold">
                        Career progression
                      </h2>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        Your current and previous roles
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setShowAdd(true)}
                      className={button}
                    >
                      <Plus size={15} />
                      Add past experience
                    </button>
                  </div>
                  <ol className="mt-5 space-y-3">
                    {!history.length && (
                      <li className="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                        No employment history yet.
                      </li>
                    )}
                    {history.map((job) => (
                      <li
                        key={job._id || job.index}
                        className="flex gap-3 rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/60"
                      >
                        <Briefcase
                          size={20}
                          className="mt-1 shrink-0 text-brand"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap gap-2">
                            <h3 className="break-words text-sm font-semibold">
                              {job.position || job.role}
                            </h3>
                            {job.current && (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-brand dark:bg-zinc-800 dark:text-brand">
                                Current
                              </span>
                            )}
                          </div>
                          <p className="mt-1 break-words text-xs text-zinc-600 dark:text-zinc-300">
                            {job.company}
                            {job.industry && ` · ${job.industry}`}
                          </p>
                          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                            {job.startDate
                              ? `${monthLabel(job.startDate)} – ${job.current ? "Present" : job.endDate ? monthLabel(job.endDate) : "End date not provided"}`
                              : job.period || "Dates not provided"}
                            {job.location && ` · ${job.location}`}
                          </p>
                        </div>
                        {!job.current && (
                          <button
                            type="button"
                            aria-label={`Remove ${job.position || job.role} at ${job.company}`}
                            onClick={() => setDeleting(job)}
                            disabled={busy}
                            className="h-9 rounded-lg p-2 text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </li>
                    ))}
                  </ol>
                </section>
              </>
            )
          )}
          <datalist id="employment-industries">
            {INDUSTRIES.map((industry) => (
              <option key={industry} value={industry} />
            ))}
          </datalist>
        </main>
      </div>
      {showAdd && (
        <FeedDialog
          title="Add past experience"
          busy={busy}
          onClose={() => setShowAdd(false)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void mutate(
                () => api.post("/employment/history", { ...past, revision: record.historyRevision }),
                "Past experience added.",
              );
            }}
          >
            <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
              {field("company", "Company", past, setPast, true)}
              {field("position", "Past position", past, setPast, true)}
              {field("industry", "Past industry", past, setPast)}
              {field("location", "Past location", past, setPast)}
              {field(
                "startDate",
                "Past start month",
                past,
                setPast,
                true,
                "month",
              )}
              {field("endDate", "Past end month", past, setPast, true, "month")}
              {error && (
                <p
                  role="alert"
                  className="text-sm text-red-600 sm:col-span-2 dark:text-red-400"
                >
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-2 sm:col-span-2">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="rounded-lg border border-zinc-200 px-4 text-xs dark:border-zinc-700"
                >
                  Cancel
                </button>
                <button type="submit" className={button}>
                  {busy ? "Saving…" : "Add experience"}
                </button>
              </div>
            </fieldset>
          </form>
        </FeedDialog>
      )}
      {deleting && (
        <FeedDialog
          title="Remove past experience?"
          busy={busy}
          onClose={() => setDeleting(null)}
        >
          <p className="text-sm">
            Remove {deleting.position || deleting.role} at {deleting.company}{" "}
            from your career history?
          </p>
          {error && (
            <p
              role="alert"
              className="mt-3 text-sm text-red-600 dark:text-red-400"
            >
              {error}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setDeleting(null)}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-xs dark:border-zinc-700"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                mutate(
                  () =>
                    api.delete(`/employment/history/${deleting.index}`, {
                      data: { revision: record.historyRevision },
                    }),
                  "Experience removed.",
                )
              }
              className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white"
            >
              {busy ? "Removing…" : "Remove"}
            </button>
          </div>
        </FeedDialog>
      )}
    </div>
  );
}
