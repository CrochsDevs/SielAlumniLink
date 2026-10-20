import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Building2,
  Check,
  CheckCircle2,
  Download,
  FileText,
  LoaderCircle,
  MapPin,
  Send,
  ShieldCheck,
  UploadCloud,
  X,
} from "lucide-react";
import { FeedDialog } from "../feed/FeedComposer";
import api from "../../utils/axios";

const button =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-white transition hover:bg-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-50";
const input =
  "mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-brand focus:ring-2 focus:ring-brand/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export function JobApplicationDialog({
  jobId,
  user,
  application,
  onApplied,
  onClose,
}) {
  const [job, setJob] = useState(null);
  const [step, setStep] = useState("details");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    note: "",
  });
  const [resume, setResume] = useState(null);
  const pending = useRef(false);
  const fileInput = useRef(null);
  const [dragging, setDragging] = useState(false);
  const chooseResume = (file) => {
    if (!file) return;
    if (
      !file.name.toLowerCase().endsWith(".pdf") ||
      file.size > 5 * 1024 * 1024
    ) {
      setError("Choose a PDF resume up to 5 MB.");
      return;
    }
    setResume(file);
    setError("");
  };
  useEffect(() => {
    let active = true;
    api
      .get(`/jobs/${jobId}`)
      .then((response) => {
        if (active) {
          setJob(response.data.data);
          setError("");
        }
      })
      .catch((err) => {
        if (active) {
          if (err.response?.status === 404 && application?.jobSnapshot) {
            setJob({ ...application.jobSnapshot, isActive: false });
            setError("");
          } else
            setError(
              err.response?.data?.message || "Unable to load job details.",
            );
        }
      });
    return () => {
      active = false;
    };
  }, [jobId, attempt, application]);
  const submit = async (event) => {
    event.preventDefault();
    if (pending.current) return;
    if (
      !resume ||
      !resume.name.toLowerCase().endsWith(".pdf") ||
      resume.size > 5 * 1024 * 1024
    ) {
      setError("Choose a PDF resume up to 5 MB.");
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => body.append(key, value));
    body.append("resume", resume);
    try {
      const response = await api.post(`/jobs/${jobId}/apply`, body);
      onApplied(response.data.data);
      setStep("success");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to submit your application. Please try again.",
      );
      if (err.response?.status === 409) {
        try {
          const response = await api.get("/jobs/applications/me");
          const existing = response.data.data.find(
            (item) => item.jobId === jobId,
          );
          if (existing) {
            onApplied(existing);
            setStep("details");
          }
        } catch {
          /* Keep the duplicate message visible if reloading fails. */
        }
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const complete = step === "success" || !!application;
  return (
    <FeedDialog
      wide
      title={
        step === "success" ? "Application submitted" : "Your next opportunity"
      }
      busy={busy}
      onClose={onClose}
    >
      <ol
        aria-label="Application progress"
        className="mb-6 flex items-center gap-2 border-b border-zinc-100 pb-5 dark:border-zinc-800"
      >
        {[
          ["details", "Job details"],
          ["resume", "Your application"],
          ["success", "Submitted"],
        ].map(([id, label], index) => {
          const current = complete ? 2 : step === "resume" ? 1 : 0;
          return (
            <li
              key={id}
              aria-current={current === index ? "step" : undefined}
              className="flex min-w-0 flex-1 items-center gap-2 text-[10px] font-medium sm:text-xs"
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] ${index <= current ? "bg-brand text-white" : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800"}`}
              >
                {index < current ? <Check size={12} /> : index + 1}
              </span>
              <span
                className={
                  index <= current
                    ? "text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-400"
                }
              >
                {label}
              </span>
              {index < 2 && (
                <span
                  aria-hidden="true"
                  className="ml-auto hidden h-px flex-1 bg-zinc-200 sm:block dark:bg-zinc-700"
                />
              )}
            </li>
          );
        })}
      </ol>
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {error}
          {!job && (
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
              className="ml-2 underline"
            >
              Retry
            </button>
          )}
        </p>
      )}
      {!job ? (
        !error && (
          <div
            role="status"
            className="flex items-center justify-center gap-3 py-16 text-sm text-zinc-500"
          >
            <LoaderCircle size={20} className="animate-spin text-brand" />
            Loading job details...
          </div>
        )
      ) : step === "success" ? (
        <div className="px-2 py-5 text-center sm:px-10">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 ring-8 ring-emerald-50/50 dark:bg-emerald-950 dark:ring-emerald-950/40">
            <CheckCircle2
              size={38}
              className="text-brand dark:text-brand"
            />
          </span>
          <p className="mt-7 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand dark:text-brand">
            Application received
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight">
            You have taken the next step.
          </h3>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            Your application for{" "}
            <strong className="font-semibold text-zinc-800 dark:text-zinc-200">
              {job.title}
            </strong>{" "}
            at {job.company} has been sent to the university career team.
          </p>
          <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-left dark:border-zinc-700 dark:bg-zinc-800/50">
            <p className="text-xs font-semibold">What happens next?</p>
            <p className="mt-1.5 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
              The career team can review your details and resume. Your
              application is saved in the Applied tab for your reference.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`${button} mt-6 w-full sm:w-auto`}
          >
            Back to opportunities
            <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        <>
          <div className="relative overflow-hidden rounded-xl border border-brand/10 bg-gradient-to-br from-emerald-50 via-white to-zinc-50 p-5 sm:p-6 dark:border-brand/40 dark:from-emerald-950/50 dark:via-zinc-900 dark:to-zinc-900">
            <div className="relative flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-emerald-200/70 bg-white text-brand shadow-sm dark:border-brand dark:bg-emerald-950">
                <Building2 size={25} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand dark:text-brand">
                  {job.company}
                </p>
                <h3 className="mt-1.5 break-words text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
                  {job.title}
                </h3>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {job.location && (
                    <span className="flex items-center gap-1.5">
                      <MapPin size={13} />
                      {job.location}
                    </span>
                  )}
                  {job.type && (
                    <span className="flex items-center gap-1.5">
                      <Briefcase size={13} />
                      {job.type}
                    </span>
                  )}
                  {job.mode && (
                    <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-medium text-zinc-600 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700">
                      {job.mode}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          {step === "details" ? (
            <>
              <section className="px-1 py-6 sm:px-2">
                <h4 className="text-sm font-semibold">About the role</h4>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                  {job.description || "No additional details provided."}
                </p>
                {(job.tags || []).length > 0 && (
                  <div className="mt-6 border-t border-zinc-100 pt-5 dark:border-zinc-800">
                    <h4 className="mb-3 text-xs font-semibold">
                      Skills &amp; keywords
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {job.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </section>
              <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/50">
                {application ? (
                  <div role="status" className="flex items-center gap-3">
                    <CheckCircle2
                      size={22}
                      className="shrink-0 text-brand dark:text-brand"
                    />
                    <div>
                      <p className="text-sm font-semibold">
                        Application submitted
                      </p>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {application.createdAt
                          ? new Date(application.createdAt).toLocaleDateString(
                              "en-US",
                              {
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                              },
                            )
                          : "Saved in your Applied tab"}
                      </p>
                    </div>
                  </div>
                ) : job.isActive ? (
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold">Ready to apply?</p>
                      <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                        Have your PDF resume ready for the next step.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep("resume")}
                      className={`${button} shrink-0`}
                    >
                      Apply now
                      <ArrowRight size={16} />
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">
                    This job is no longer accepting applications.
                  </p>
                )}
              </div>
            </>
          ) : (
            <form onSubmit={submit} className="mt-6">
              <fieldset disabled={busy} className="space-y-6">
                <section>
                  <h4 className="text-sm font-semibold">Contact details</h4>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Make it easy for the career team to reach you.
                  </p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="block text-xs font-medium">
                      Full name <span className="text-brand">*</span>
                      <input
                        required
                        maxLength={200}
                        value={form.name}
                        onChange={(event) =>
                          setForm({ ...form, name: event.target.value })
                        }
                        className={input}
                        autoComplete="name"
                      />
                    </label>
                    <label className="block text-xs font-medium">
                      Contact email <span className="text-brand">*</span>
                      <input
                        required
                        type="email"
                        maxLength={254}
                        value={form.email}
                        onChange={(event) =>
                          setForm({ ...form, email: event.target.value })
                        }
                        className={input}
                        autoComplete="email"
                      />
                    </label>
                  </div>
                </section>
                <section>
                  <h4 className="text-sm font-semibold">
                    Your resume <span className="text-brand">*</span>
                  </h4>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Upload a PDF, up to 5 MB.
                  </p>
                  <input
                    ref={fileInput}
                    type="file"
                    aria-label="Choose PDF resume"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(event) => {
                      chooseResume(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                  <div
                    onDragOver={(event) => {
                      event.preventDefault();
                      if (!busy) setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragging(false);
                      if (!busy) chooseResume(event.dataTransfer.files?.[0]);
                    }}
                    className={`mt-3 rounded-xl border border-dashed p-5 transition ${dragging ? "border-brand bg-emerald-50 dark:bg-emerald-950/40" : resume ? "border-emerald-300 bg-emerald-50/40 dark:border-brand dark:bg-emerald-950/20" : "border-zinc-300 bg-zinc-50/60 dark:border-zinc-600 dark:bg-zinc-800/30"}`}
                  >
                    {resume ? (
                      <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white text-brand dark:bg-zinc-900">
                          <FileText size={23} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p
                            className="truncate text-sm font-medium"
                            title={resume.name}
                          >
                            {resume.name}
                          </p>
                          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                            {(resume.size / 1024).toFixed(0)} KB{" "}
                            <span className="ml-2 text-brand dark:text-brand">
                              Ready to submit
                            </span>
                          </p>
                        </div>
                        <button
                          type="button"
                          aria-label="Remove resume"
                          onClick={() => setResume(null)}
                          className="rounded-lg p-2 text-zinc-500 hover:bg-white dark:hover:bg-zinc-800"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="text-center">
                        <UploadCloud
                          size={28}
                          className="mx-auto text-brand dark:text-brand"
                        />
                        <p className="mt-3 text-sm font-medium">
                          Drop your resume here
                        </p>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          or choose a file from your device
                        </p>
                        <button
                          type="button"
                          onClick={() => fileInput.current?.click()}
                          className="mt-4 min-h-10 rounded-lg border border-zinc-200 bg-white px-4 text-xs font-semibold transition hover:border-brand hover:text-brand dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        >
                          Browse files
                        </button>
                      </div>
                    )}
                  </div>
                </section>
                <label className="block text-xs font-medium">
                  Cover note{" "}
                  <span className="font-normal text-zinc-400">(optional)</span>
                  <textarea
                    rows={3}
                    maxLength={5000}
                    value={form.note}
                    onChange={(event) =>
                      setForm({ ...form, note: event.target.value })
                    }
                    className={`${input} resize-y`}
                    placeholder="What makes this opportunity a good fit for you?"
                  />
                  <span className="mt-1 block text-right text-[10px] font-normal text-zinc-400">
                    {form.note.length.toLocaleString()} / 5,000
                  </span>
                </label>
                <p className="flex items-start gap-2 rounded-lg bg-zinc-50 p-3 text-[11px] leading-5 text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400">
                  <ShieldCheck
                    size={16}
                    className="mt-0.5 shrink-0 text-brand dark:text-brand"
                  />
                  Your contact details and resume are shared with the university
                  career team for this application.
                </p>
                <div className="flex flex-col-reverse gap-3 border-t border-zinc-100 pt-5 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => {
                      setStep("details");
                      setError("");
                    }}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  >
                    <ArrowLeft size={15} />
                    Back to details
                  </button>
                  <button type="submit" className={button}>
                    {busy ? (
                      <LoaderCircle size={16} className="animate-spin" />
                    ) : (
                      <Send size={15} />
                    )}
                    {busy ? "Submitting..." : "Submit application"}
                  </button>
                </div>
              </fieldset>
            </form>
          )}
        </>
      )}
    </FeedDialog>
  );
}

export function JobApplicantsDialog({ job, onClose }) {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [downloading, setDownloading] = useState(null);
  useEffect(() => {
    let active = true;
    api
      .get(`/jobs/${job._id}/applications`)
      .then((response) => {
        if (active) {
          setApplications(response.data.data);
          setError("");
        }
      })
      .catch(() => {
        if (active) setError("Unable to load applicants.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [job._id, attempt]);
  const download = async (application) => {
    setDownloading(application._id);
    setError("");
    try {
      const response = await api.get(
        `/jobs/applications/${application._id}/resume`,
        { responseType: "blob" },
      );
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = application.resumeName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Unable to download the resume. Please try again.");
    } finally {
      setDownloading(null);
    }
  };
  return (
    <FeedDialog title={`Applicants for ${job.title}`} onClose={onClose}>
      {error && (
        <p role="alert" className="mb-3 text-sm text-red-600">
          {error}{" "}
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
            className="underline"
          >
            Retry
          </button>
        </p>
      )}
      {loading ? (
        <p role="status">Loading applicants...</p>
      ) : !applications.length ? (
        <p className="text-sm text-zinc-500">No applications yet.</p>
      ) : (
        <ul className="space-y-3">
          {applications.map((application) => (
            <li
              key={application._id}
              className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700"
            >
              <h3 className="break-words text-sm font-semibold">
                {application.name}
              </h3>
              <p className="break-all text-xs text-zinc-500">
                {application.email}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Submitted {new Date(application.createdAt).toLocaleDateString()}
              </p>
              {application.note && (
                <p className="mt-3 whitespace-pre-wrap break-words text-sm">
                  {application.note}
                </p>
              )}
              <button
                type="button"
                disabled={downloading !== null}
                onClick={() => download(application)}
                className={`${button} mt-3`}
              >
                <Download size={14} />
                {downloading === application._id
                  ? "Downloading..."
                  : "Download resume"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </FeedDialog>
  );
}
