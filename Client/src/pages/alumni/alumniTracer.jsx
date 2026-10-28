import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardCheck,
  LoaderCircle,
  X,
} from "lucide-react";
import { useAuth } from "../../context/useAuth";
import { TracerQuarterContext } from "../../context/TracerQuarterContext";
import AlumniSidebar from "../../layout/sidebar/alumni/alumniSidebar";
import AlumniTopbar from "../../layout/topbar/alumni/alumniTopbar";
import api from "../../utils/axios";
import { CLSU_PROGRAM_GROUPS, CLSU_PROGRAMS } from "../../data/clsuPrograms";
import {
  TRACER_STATUS_DETAILS as STATUS_DETAILS,
  normalizeTracerDetails as normalizeDetails,
  JOB_ALIGNMENT_OPTIONS,
  jobAlignmentLabel,
} from "../../utils/tracerStudy";

const STATUSES = ["Employed", "Self-employed", "Unemployed", "Studying"];
const CURRENT_YEAR = new Date().getFullYear();
const GRADUATION_YEARS = Array.from({ length: 100 }, (_, index) =>
  String(CURRENT_YEAR - index),
);
const SALARY_RANGES = [
  "Prefer not to say",
  "Below ₱15,000",
  "₱15,000 – ₱25,000",
  "₱25,001 – ₱40,000",
  "₱40,001 – ₱60,000",
  "Above ₱60,000",
];
const EMPTY_FORM = {
  batch: "",
  program: "",
  status: "Employed",
  company: "",
  position: "",
  salaryRange: "Prefer not to say",
  employmentDate: "",
  location: "",
  jobAlignment: "",
  alignmentExplanation: "",
};
const STEPS = [
  ["Basic Information", "Tell us about your graduation"],
  ["Employment", "Tell us what you are doing now"],
  ["Job Details", "A few more details about your work"],
  ["Review", "Check your answers before submitting"],
];
const REVIEW_FIELDS = [
  ["Batch Graduated", "batch"],
  ["Program", "program"],
  ["Employment Status", "status"],
  ["Company / School", "company"],
  ["Position", "position"],
  ["Salary Range", "salaryRange"],
  ["Employment Date", "employmentDate"],
  ["Location", "location"],
  ["Program-job alignment", "jobAlignment"],
  ["How your work relates to your program", "alignmentExplanation"],
];
const inputClass =
  "h-12 w-full rounded-xl border border-solid border-zinc-400 bg-zinc-50 px-3 text-[13px] text-zinc-900 placeholder:text-zinc-500 outline-none transition hover:border-zinc-500 focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:opacity-60 [color-scheme:light] dark:border-zinc-500 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:hover:border-zinc-400 dark:focus:border-brand dark:[color-scheme:dark] [&>option]:bg-white dark:[&>option]:bg-zinc-800";
const secondaryButton =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 sm:px-5 sm:text-sm";
const primaryButton =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-brand bg-brand px-4 text-sm font-bold text-black transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-55  sm:px-5";

function Field({ name, label, optional = false, error, children }) {
  return (
    <div className="min-w-0">
      <label
        htmlFor={`tracer-${name}`}
        className="mb-2 block text-[13px] font-semibold text-zinc-900 dark:text-zinc-100"
      >
        {label}
        {optional ? (
          <span className="ml-1.5 text-xs font-normal text-zinc-500 dark:text-zinc-400">
            (optional)
          </span>
        ) : (
          <span
            className="ml-1 text-red-700 dark:text-red-400"
            aria-hidden="true"
          >
            *
          </span>
        )}
      </label>
      {children}
      {error && (
        <p
          id={`tracer-${name}-error`}
          role="alert"
          className="mt-1.5 text-sm text-red-700 dark:text-red-400"
        >
          {error}
        </p>
      )}
    </div>
  );
}

const toForm = (data) => ({
  ...EMPTY_FORM,
  ...Object.fromEntries(
    Object.keys(EMPTY_FORM).map((key) => [
      key,
      typeof data?.[key] === "string" ? data[key] : EMPTY_FORM[key],
    ]),
  ),
  status: STATUSES.includes(data?.status) ? data.status : "Employed",
  salaryRange: data?.salaryRange || "Prefer not to say",
  employmentDate: data?.employmentDate
    ? String(data.employmentDate).slice(0, 7)
    : "",
});

export default function AlumniTracer() {
  const { user } = useAuth();
  const quarterlyStatus = useContext(TracerQuarterContext);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [savedForm, setSavedForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [errors, setErrors] = useState({});
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const updateRequired = !!quarterlyStatus?.updateRequired && !done;
  const showModal = modalOpen || updateRequired;
  const dialogRef = useRef(null);
  const headingRef = useRef(null);
  const pending = useRef(false);
  const loadVersion = useRef(0);
  const answered = !!savedForm;

  const loadResponse = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    setLoadError("");
    try {
      const res = await api.get("/tracer/me");
      if (version !== loadVersion.current) return;
      const data = res.data.data;
      const response = data
        ? normalizeDetails(toForm(data))
        : { ...EMPTY_FORM };
      setForm(response);
      setSavedForm(data ? response : null);
    } catch (err) {
      if (version === loadVersion.current)
        setLoadError(
          err.response?.data?.message ||
            "Unable to load your response. Please try again.",
        );
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) loadResponse();
    });
    return () => {
      active = false;
    };
  }, [loadResponse]);

  useLayoutEffect(() => {
    if (!showModal) return;
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [showModal]);
  useEffect(() => {
    if (!showModal || loading || loadError) return;
    headingRef.current?.focus({ preventScroll: true });
    dialogRef.current?.scrollTo({ top: 0 });
  }, [step, done, showModal, loading, loadError]);

  const change = (name, value) => {
    setForm((prev) =>
      name === "status" && value !== prev.status
        ? normalizeDetails({
            ...prev,
            status: value,
            company: "",
            position: "",
            salaryRange: "Prefer not to say",
            employmentDate: "",
            location: "",
            jobAlignment: "",
            alignmentExplanation: "",
          })
        : {
            ...prev,
            [name]: value,
            ...(["program", "company", "position"].includes(name) &&
            value !== prev[name]
              ? { jobAlignment: "", alignmentExplanation: "" }
              : {}),
          },
    );
    setErrors((prev) => (name === "status" ? {} : { ...prev, [name]: "" }));
    setSaveError("");
  };
  const validationErrors = () => {
    const invalid = {};
    if (!form.batch.trim())
      invalid.batch = "Please select your graduation year.";
    if (
      form.batch &&
      (!/^\d{4}$/.test(form.batch) ||
        Number(form.batch) > CURRENT_YEAR ||
        Number(form.batch) < 1900)
    )
      invalid.batch = "Please select a valid graduation year.";
    if (!form.program.trim()) invalid.program = "Please select your program.";
    if (!STATUSES.includes(form.status))
      invalid.status = "Please choose your employment status.";
    if (
      STATUS_DETAILS[form.status]?.employmentDate &&
      form.employmentDate &&
      !Number.isFinite(new Date(`${form.employmentDate}-01`).getTime())
    )
      invalid.employmentDate = "Please choose a valid start month.";
    if (["Employed", "Self-employed"].includes(form.status)) {
      if (!form.company.trim())
        invalid.company = "Please provide your employer or business name.";
      if (!form.position.trim())
        invalid.position = "Please provide your job title or line of work.";
      if (
        !JOB_ALIGNMENT_OPTIONS.some(
          (option) => option.value === form.jobAlignment,
        )
      )
        invalid.jobAlignment =
          "Please choose how your work relates to your program.";
      if (!form.alignmentExplanation.trim())
        invalid.alignmentExplanation =
          "Describe your main duties and how they relate to your program.";
    }
    return invalid;
  };
  const advance = async (e) => {
    e.preventDefault();
    if (pending.current || loading || loadError) return;
    const invalid = validationErrors();
    const requiredStep =
      step === 0
        ? ["batch", "program"]
        : step === 1
          ? ["status", "company", "position"]
          : step === 2
            ? ["employmentDate", "jobAlignment", "alignmentExplanation"]
            : Object.keys(invalid);
    const invalidField = requiredStep.find((key) => invalid[key]);
    if (invalidField) {
      setErrors(invalid);
      if (step === 3)
        setStep(
          ["batch", "program"].includes(invalidField)
            ? 0
            : ["status", "company", "position"].includes(invalidField)
              ? 1
              : 2,
        );
      requestAnimationFrame(() =>
        document.getElementById(`tracer-${invalidField}`)?.focus(),
      );
      return;
    }
    if (step < 3) {
      setStep(visibleSteps[visibleSteps.indexOf(step) + 1]);
      return;
    }
    pending.current = true;
    setSaving(true);
    setSaveError("");
    const payload = Object.fromEntries(
      Object.entries(normalizeDetails(form)).map(([key, value]) => [
        key,
        value.trim(),
      ]),
    );
    try {
      await api.post("/tracer", payload);
      setForm(payload);
      setSavedForm(payload);
      setDone(true);
      window.dispatchEvent(new Event("tracer-updated"));
    } catch (err) {
      setSaveError(
        err.response?.data?.message ||
          "Your response could not be saved. Please try again.",
      );
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };
  const openStudy = () => {
    setStep(0);
    setDone(false);
    setErrors({});
    setSaveError("");
    setModalOpen(true);
  };
  const controlProps = (name) => ({
    id: `tracer-${name}`,
    name,
    value: form[name],
    onChange: (e) => change(name, e.target.value),
    "aria-invalid": !!errors[name],
    "aria-describedby": errors[name] ? `tracer-${name}-error` : undefined,
    className: `${inputClass} ${errors[name] ? "!border-red-600 dark:!border-red-400" : ""}`,
  });
  const details = STATUS_DETAILS[form.status] || {};
  const hasWorkDetails =
    form.status === "Employed" || form.status === "Self-employed";
  const visibleSteps = hasWorkDetails ? [0, 1, 2, 3] : [0, 1, 3];
  const reviewFields = REVIEW_FIELDS.filter(
    ([, key]) =>
      ["batch", "program", "status"].includes(key) ||
      details[key] ||
      (hasWorkDetails &&
        ["jobAlignment", "alignmentExplanation"].includes(key)),
  ).map(([label, key]) => [details[key] || label, key]);
  const stepTitle =
    step === 2 && form.status === "Self-employed"
      ? "Business Details"
      : STEPS[step][0];
  const stepDescription =
    step === 2 && form.status === "Self-employed"
      ? "A few more details about your business or freelance work"
      : STEPS[step][1];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AlumniSidebar
        user={user}
        mobileOpen={sidebarOpen}
        setMobileOpen={setSidebarOpen}
      />
      <div className="lg:pl-64">
        <AlumniTopbar
          user={user}
          title="Tracer Study"
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="mx-auto max-w-3xl p-4 sm:p-6 workspace-page">
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 workspace-page-header">
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand dark:text-brand">
              <ClipboardCheck size={26} />
            </span>
            <h1 className="text-2xl font-bold tracking-tight">
              Tracer Study {CURRENT_YEAR}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Help CLSU track graduate outcomes. Takes about 3 minutes.
            </p>
            {answered && (
              <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand dark:text-brand">
                <CheckCircle2 size={14} />
                You already answered — update anytime
              </p>
            )}
            {savedForm && (
              <dl className="mt-5 grid gap-4 border-t border-zinc-200 pt-5 text-sm sm:grid-cols-3 dark:border-zinc-800">
                {[
                  ["Batch", savedForm.batch],
                  ["Program", savedForm.program],
                  ["Employment", savedForm.status],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-zinc-500 dark:text-zinc-400">
                      {label}
                    </dt>
                    <dd className="mt-1 break-words font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            )}
            <button
              type="button"
              onClick={openStudy}
              className={`${primaryButton} mt-6`}
            >
              {answered ? "Update my response" : "Start tracer study"}
              <ArrowRight size={18} />
            </button>
          </section>
        </main>
      </div>
      {showModal && (
        <dialog
          ref={dialogRef}
          data-tracer-modal
          closedby={updateRequired || saving ? "none" : "closerequest"}
          aria-labelledby="tracer-modal-title"
          aria-describedby="tracer-modal-description"
          onKeyDown={(e) => {
            if (e.key === "Escape" && (saving || updateRequired))
              e.preventDefault();
          }}
          onCancel={(e) => {
            e.preventDefault();
            if (!saving && !updateRequired) setModalOpen(false);
          }}
          className="m-auto max-h-[94dvh] w-[calc(100%-1rem)] max-w-3xl overflow-y-auto overscroll-contain rounded-2xl border border-zinc-200 bg-zinc-50 p-0 text-zinc-900 shadow-2xl backdrop:bg-black/60 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:w-[calc(100%-2rem)] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          style={{
            fontFamily:
              "'Libre Franklin', ui-sans-serif, system-ui, sans-serif",
          }}
        >
          <header className="sticky top-0 z-10 flex items-start justify-between gap-3 bg-zinc-50 px-5 pb-4 pt-6 sm:px-7 dark:bg-zinc-950">
            <div className="min-w-0">
              <h2
                id="tracer-modal-title"
                className="text-xl font-bold tracking-tight sm:text-2xl"
              >
                Tracer Study {CURRENT_YEAR}
              </h2>
              <p
                id="tracer-modal-description"
                className="mt-2 text-sm leading-relaxed text-zinc-600 sm:text-sm dark:text-zinc-400"
              >
                {updateRequired
                  ? `Your ${quarterlyStatus.quarter} update is required. Review and submit your details to continue, even if nothing has changed.`
                  : "Help CLSU track graduate outcomes. Takes about 3 minutes."}
              </p>
              {answered && !updateRequired && (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand dark:text-brand">
                  <CheckCircle2 size={14} />
                  You already answered — update anytime
                </p>
              )}
            </div>
            {updateRequired ? (
              <Link to="/logout" className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:underline dark:text-zinc-300">
                Logout
              </Link>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={() => setModalOpen(false)}
                aria-label="Close tracer study"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <X size={22} />
              </button>
            )}
          </header>
          {loading ? (
            <div
              role="status"
              className="flex min-h-52 items-center justify-center gap-2 p-6 text-sm text-zinc-500 dark:text-zinc-400"
            >
              <LoaderCircle
                size={20}
                className="animate-spin motion-reduce:animate-none"
              />
              Loading your response…
            </div>
          ) : loadError ? (
            <div role="alert" className="space-y-4 p-6">
              <p className="text-sm text-red-700 dark:text-red-400">
                {loadError}
              </p>
              <button
                type="button"
                onClick={loadResponse}
                className={secondaryButton}
              >
                Retry
              </button>
            </div>
          ) : done ? (
            <section
              role="status"
              className="mx-5 mb-6 rounded-xl border border-zinc-200 bg-white px-5 py-10 text-center sm:mx-7 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-brand text-black ">
                <Check size={32} />
              </span>
              <h3
                ref={headingRef}
                tabIndex={-1}
                className="text-2xl font-semibold outline-none"
              >
                Thank you!
              </h3>
              <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                Your tracer response has been saved.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={openStudy}
                  className={secondaryButton}
                >
                  Update my response
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className={primaryButton}
                >
                  Done
                </button>
              </div>
            </section>
          ) : (
            <form onSubmit={advance} noValidate>
              <fieldset disabled={saving} className="min-w-0">
                <ol
                  aria-label="Tracer study progress"
                  className="mx-5 mb-7 mt-3 flex items-center gap-1.5 sm:mx-7"
                >
                  {visibleSteps.map((stepId, index) => (
                    <li
                      key={stepId}
                      className={`flex min-w-0 items-center gap-1.5 ${index < visibleSteps.length - 1 ? "flex-1" : ""}`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setStep(stepId);
                          setSaveError("");
                        }}
                        disabled={stepId > step || saving}
                        aria-current={stepId === step ? "step" : undefined}
                        aria-label={`Step ${index + 1}: ${stepId === 2 && form.status === "Self-employed" ? "Business Details" : STEPS[stepId][0]}`}
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-base font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-default sm:h-12 sm:w-12 sm:text-xl ${stepId <= step ? "border-brand bg-brand text-black " : "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"}`}
                      >
                        {index + 1}
                      </button>
                      {index < visibleSteps.length - 1 && (
                        <span
                          aria-hidden="true"
                          className={`h-[3px] min-w-3 flex-1 rounded-full ${stepId < step ? "bg-brand" : "bg-[#dedede] dark:bg-[#3a3a3a]"}`}
                        />
                      )}
                    </li>
                  ))}
                </ol>
                <section className="mx-5 rounded-xl border border-zinc-200 bg-white p-5 sm:mx-7 sm:p-6 dark:border-zinc-700 dark:bg-zinc-900">
                  <h3
                    ref={headingRef}
                    tabIndex={-1}
                    className="text-lg font-bold tracking-tight outline-none"
                  >
                    {stepTitle}
                  </h3>
                  <p className="mb-7 mt-2 text-sm text-zinc-600 sm:text-sm dark:text-zinc-400">
                    {stepDescription}
                  </p>
                  {step === 0 && (
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field
                        name="batch"
                        label="Batch Graduated"
                        error={errors.batch}
                      >
                        <select {...controlProps("batch")} required disabled={Boolean(savedForm?.batch)} aria-describedby="graduation-year-help">
                          <option value="" disabled>
                            Select graduation year
                          </option>
                          {form.batch &&
                            !GRADUATION_YEARS.includes(form.batch) && (
                              <option value={form.batch}>{form.batch}</option>
                            )}
                          {GRADUATION_YEARS.map((year) => (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          ))}
                        </select>
                        <p id="graduation-year-help" className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                          {savedForm?.batch
                            ? "Your graduation year is saved and cannot be changed."
                            : "Check your graduation year carefully. It cannot be changed after saving."}
                        </p>
                      </Field>
                      <Field
                        name="program"
                        label="Program"
                        error={errors.program}
                      >
                        <select {...controlProps("program")} required disabled={Boolean(savedForm?.program)} aria-describedby="program-lock-help">
                          <option value="" disabled>
                            Select your program
                          </option>
                          {form.program &&
                            !CLSU_PROGRAMS.includes(form.program) && (
                              <optgroup label="Previously saved program">
                                <option value={form.program}>
                                  {form.program}
                                </option>
                              </optgroup>
                            )}
                          {CLSU_PROGRAM_GROUPS.map(({ college, programs }) => (
                            <optgroup key={college} label={college}>
                              {programs.map((program) => (
                                <option key={program} value={program}>
                                  {program}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        <p id="program-lock-help" className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                          {savedForm?.program
                            ? "Your program is saved and cannot be changed."
                            : "Check your program carefully. It cannot be changed after saving."}
                        </p>
                      </Field>
                    </div>
                  )}
                  {step === 1 && (
                    <div className="space-y-5">
                      <Field
                        name="status"
                        label="Employment Status"
                        error={errors.status}
                      >
                        <select {...controlProps("status")} required>
                          {STATUSES.map((status) => (
                            <option key={status}>{status}</option>
                          ))}
                        </select>
                      </Field>
                      {form.status === "Unemployed" ? (
                        <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                          No work details needed. Continue to review and submit
                          your response.
                        </p>
                      ) : (
                        <>
                          <div className="grid gap-5 sm:grid-cols-2">
                            <Field
                              name="company"
                              label={details.company}
                              optional={!hasWorkDetails}
                              error={errors.company}
                            >
                              <input
                                {...controlProps("company")}
                                placeholder={
                                  form.status === "Studying"
                                    ? "e.g. CLSU Graduate School"
                                    : form.status === "Self-employed"
                                      ? "Your business or freelance name"
                                      : "Your employer"
                                }
                              />
                            </Field>
                            <Field
                              name="position"
                              label={details.position}
                              optional={!hasWorkDetails}
                              error={errors.position}
                            >
                              <input
                                {...controlProps("position")}
                                placeholder={
                                  form.status === "Studying"
                                    ? "e.g. Master of Science"
                                    : form.status === "Self-employed"
                                      ? "e.g. Freelance Web Developer"
                                      : "e.g. HR Manager"
                                }
                              />
                            </Field>
                          </div>
                          {form.status === "Studying" && (
                            <Field
                              name="location"
                              label={details.location}
                              optional
                            >
                              <input
                                {...controlProps("location")}
                                placeholder="e.g. Science City of Muñoz"
                              />
                            </Field>
                          )}
                        </>
                      )}
                    </div>
                  )}
                  {step === 2 && (
                    <div className="space-y-5">
                      <div className="grid gap-5 sm:grid-cols-2">
                        <Field
                          name="salaryRange"
                          label={details.salaryRange}
                          optional
                        >
                          <select {...controlProps("salaryRange")}>
                            {!SALARY_RANGES.includes(form.salaryRange) && (
                              <option>{form.salaryRange}</option>
                            )}
                            {SALARY_RANGES.map((range) => (
                              <option key={range}>{range}</option>
                            ))}
                          </select>
                        </Field>
                        <Field
                          name="employmentDate"
                          label={details.employmentDate}
                          optional
                          error={errors.employmentDate}
                        >
                          <input
                            {...controlProps("employmentDate")}
                            type="month"
                          />
                        </Field>
                      </div>
                      <Field name="location" label={details.location} optional>
                        <input
                          {...controlProps("location")}
                          placeholder="e.g. Makati City"
                        />
                      </Field>
                      <div className="rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-brand dark:bg-emerald-950/40 dark:text-emerald-200">
                        How does your current work relate to{" "}
                        <strong>{form.program}</strong>? Consider the knowledge
                        and skills you use in your work.
                      </div>
                      <Field
                        name="jobAlignment"
                        label="Program-job alignment"
                        error={errors.jobAlignment}
                      >
                        <select {...controlProps("jobAlignment")} required>
                          <option value="">
                            Select relationship to your program
                          </option>
                          {JOB_ALIGNMENT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <p className="text-xs leading-6 text-zinc-500 dark:text-zinc-400">
                        Directly related: your main duties use your program's
                        core skills. Partly related: you use some of those
                        skills. Unrelated: your main duties are in another
                        field. Choose Not sure if you cannot assess the
                        relationship.
                      </p>
                      <Field
                        name="alignmentExplanation"
                        label="Main duties and relationship to your program"
                        error={errors.alignmentExplanation}
                      >
                        <textarea
                          {...controlProps("alignmentExplanation")}
                          required
                          maxLength={1000}
                          rows={4}
                          className={`${inputClass} !h-auto py-3`}
                          placeholder="Describe what you do and which skills from your program you use, or explain why your work is unrelated."
                        />
                      </Field>
                    </div>
                  )}
                  {step === 3 && (
                    <dl>
                      {reviewFields.map(([label, key]) => (
                        <div
                          key={key}
                          className="flex flex-col gap-1 border-t border-zinc-200 py-3 first:border-0 first:pt-0 last:pb-0 sm:flex-row sm:justify-between sm:gap-6 dark:border-zinc-800"
                        >
                          <dt className="text-sm text-zinc-500 dark:text-zinc-400">
                            {label}
                          </dt>
                          <dd className="min-w-0 break-words text-[13px] font-semibold sm:max-w-[65%] sm:text-right">
                            {(key === "jobAlignment"
                              ? jobAlignmentLabel(form[key])
                              : form[key].trim()) || "—"}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </section>
                {saveError && (
                  <p
                    role="alert"
                    className="mx-5 mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 sm:mx-7 dark:bg-red-950/30 dark:text-red-400"
                  >
                    {saveError}
                  </p>
                )}
                <footer className="sticky bottom-0 mt-5 flex items-center justify-between gap-3 bg-zinc-50 px-5 pb-6 pt-3 sm:px-7 dark:bg-zinc-950">
                  <button
                    type="button"
                    disabled={step === 0 || saving}
                    onClick={() => {
                      setStep(visibleSteps[visibleSteps.indexOf(step) - 1]);
                      setSaveError("");
                    }}
                    className={secondaryButton}
                  >
                    <ArrowLeft size={18} />
                    Previous
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className={primaryButton}
                  >
                    {saving ? (
                      <>
                        <LoaderCircle
                          size={18}
                          className="animate-spin motion-reduce:animate-none"
                        />
                        Saving…
                      </>
                    ) : step === 3 ? (
                      <>
                        {answered ? "Update response" : "Submit response"}
                        <Check size={18} />
                      </>
                    ) : (
                      <>
                        Next
                        <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                </footer>
              </fieldset>
            </form>
          )}
        </dialog>
      )}
    </div>
  );
}
