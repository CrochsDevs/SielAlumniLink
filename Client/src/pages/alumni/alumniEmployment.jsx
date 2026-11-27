import ContentSkeleton from "../../components/ui/Skeleton";
import { useCallback, useEffect, useRef, useState } from "react";
import { Building2 } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import AlumniSidebar from "../../layout/sidebar/alumni/alumniSidebar";
import AlumniTopbar from "../../layout/topbar/alumni/alumniTopbar";
import api from "../../utils/axios";
import EmploymentSectorSelect from "../../components/career/EmploymentSectorSelect";
import "./alumniEmployment.css";

const STATUSES = ["Employed", "Self-employed", "Unemployed", "Studying"];
const OTHER_SECTOR = "Other / Not Specified";
const EMPLOYMENT_SECTORS = [
  "Government / Public Sector",
  "Private Sector",
  "Local Government Unit (LGU)",
  "National Government Agency (NGA)",
  "State Universities and Colleges (SUCs)",
  "Private Educational Institutions",
  "Academe / Education",
  "Information Technology (IT) / ICT",
  "Business Process Outsourcing (BPO)",
  "Banking and Finance",
  "Healthcare and Medical Services",
  "Manufacturing and Industrial",
  "Construction and Engineering",
  "Agriculture, Forestry, and Fisheries",
  "Hospitality, Tourism, and Food Services",
  "Retail and Wholesale Trade",
  "Transportation and Logistics",
  "Telecommunications",
  "Media and Communications",
  "Research and Development",
  "Non-Government Organizations (NGOs)",
  "Non-Profit Organizations",
  "Freelancing / Independent Contractor",
  "Self-Employed / Entrepreneurship",
  "Professional and Technical Services",
  "Legal Services",
  "Security and Defense",
  "Energy and Utilities",
  "Real Estate and Property Management",
  "Arts, Design, and Creative Industries",
  "Religious Organizations",
  "International Organizations",
  "Social Services and Community Development",
  "Mining and Quarrying",
  "Environmental and Natural Resources",
  "Education and Training Services",
  "Science and Technology",
  "Automotive and Transportation Services",
  "E-commerce and Digital Services",
  "Other / Not Specified",
];
const emptyForm = {
  employmentStatus: "",
  currentCompany: "",
  position: "",
  industry: "",
  location: "",
  startDate: "",
};
const card =
  "rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6";
const input =
  "alumni-employment-field mt-1 h-9 w-full min-w-0 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:[color-scheme:dark]";
const button =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-xs font-semibold text-white hover:bg-brand disabled:opacity-50";
const fromState = (state) => ({
  ...emptyForm,
  ...Object.fromEntries(
    Object.keys(emptyForm).map((key) => [key, state[key] || ""]),
  ),
  industry: state.industry === "Other" ? OTHER_SECTOR : state.industry || "",
  employmentStatus: STATUSES.includes(state.employmentStatus)
    ? state.employmentStatus
    : "",
});

export default function AlumniEmployment() {
  const { user, refreshUser } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [record, setRecord] = useState(null);
  const [form, setForm] = useState(emptyForm);
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
        className={input}
      />
    </label>
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
              Keep your employment status and current role up to date.
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
                    Manage your work history in the Experience section of your profile.
                  </p>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (working && !form.industry.trim()) {
                        setError("Please select your employment sector.");
                        return;
                      }
                      void mutate(
                        () => api.put("/employment/me", { ...form, industry: form.industry.trim(), revision: record.historyRevision }),
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
                          <EmploymentSectorSelect
                            options={EMPLOYMENT_SECTORS}
                            value={form.industry}
                            disabled={busy}
                            className={input}
                            onChange={(sector) => {
                              setForm((previous) => ({
                                ...previous,
                                industry: sector,
                              }));
                              setMessage("");
                            }}
                          />
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
              </>
            )
          )}
        </main>
      </div>
    </div>
  );
}
