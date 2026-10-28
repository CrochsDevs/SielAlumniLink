import ProgressBar from "../ui/progress-bar";
import useJobDeadline, { deadlinePassed, deadlineLabel } from "./useJobDeadline";
import JobDescription from "./JobDescription";
import { useChat } from "../../context/useChat";
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
  GraduationCap,
  LoaderCircle,
  MapPin,
  Mail,
  MessageCircle,
  Phone,
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
  "mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-3 text-sm text-zinc-900 shadow-sm shadow-zinc-900/10 outline-none transition placeholder:text-zinc-400 focus:border-brand focus:shadow-md focus:shadow-brand/10 focus:ring-2 focus:ring-brand/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:shadow-black/25 dark:focus:shadow-brand/10";

export function JobApplicationDialog({
  jobId,
  user,
  application,
  onApplied,
  onClose,
}) {
  const [job, setJob] = useState(null);
  const now = useJobDeadline();
  const closed = !job?.isActive || deadlinePassed(job, now);
  const [step, setStep] = useState("details");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    note: "",
    phone: "",
  });
  const [resume, setResume] = useState(null);
  const [coverMode, setCoverMode] = useState("text");
  const [coverPdf, setCoverPdf] = useState(null);
  const coverInput = useRef(null);
  const coverSelection = useRef(0);
  const chooseCoverPdf = async (file) => {
    const selection = ++coverSelection.current;
    if (!file) return;
    setCoverPdf(null);
    try {
      if (!file.name.toLowerCase().endsWith(".pdf") || file.size > 5 * 1024 * 1024 || (file.type && !["application/pdf", "application/octet-stream"].includes(file.type)) || await file.slice(0, 5).text() !== "%PDF-") throw new Error();
      if (selection !== coverSelection.current) return;
      setCoverPdf(file);
      setError("");
    } catch { if (selection === coverSelection.current) setError("Choose a PDF cover note up to 5 MB."); }
  };
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
    if (!job?.isActive || deadlinePassed(job)) { setError("This job is no longer accepting applications."); return; }
    if (
      !resume ||
      !resume.name.toLowerCase().endsWith(".pdf") ||
      resume.size > 5 * 1024 * 1024
    ) {
      setError("Choose a PDF resume up to 5 MB.");
      return;
    }
    if (form.phone && (!/^\+?[0-9() -]+$/.test(form.phone.trim()) || form.phone.replace(/\D/g, "").length < 7 || form.phone.replace(/\D/g, "").length > 15)) { setError("Enter a valid contact number (7 to 15 digits)."); return; }
    pending.current = true;
    setBusy(true);
    setError("");
    const body = new FormData();
    Object.entries({ ...form, note: coverMode === "text" ? form.note : "" }).forEach(([key, value]) => body.append(key, value));
    if (coverMode === "pdf" && coverPdf) body.append("coverNote", coverPdf);
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
  const currentStep = complete ? 2 : step === "resume" ? 1 : 0;
  const stepLabels = ["Job details", "Your application", "Submitted"];
  return (
    <FeedDialog
      scrollKey={step}
      wide
      title={
        step === "success" ? "Application submitted" : "Your next opportunity"
      }
      busy={busy}
      onClose={onClose}
    >
      <div className="relative mb-6 border-b border-zinc-100 pb-5 dark:border-zinc-800">
        <div className="absolute left-[16.6667%] right-[16.6667%] top-[15px]">
          <ProgressBar label="Application progress" value={currentStep * 50} segments={2}
            valueText={`Step ${currentStep + 1} of 3: ${stepLabels[currentStep]}`} />
        </div>
        <ol aria-label="Application steps" className="relative grid grid-cols-3 gap-2">
          {stepLabels.map((label, index) => (
            <li key={label} aria-current={currentStep === index ? "step" : undefined} className="flex min-w-0 flex-col items-center gap-2 text-center text-[10px] font-medium sm:text-xs">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs ring-4 ring-white dark:ring-zinc-900 ${index <= currentStep ? "bg-brand text-white" : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800"}`}>
                {index < currentStep || (complete && index === currentStep) ? <Check size={15} aria-hidden="true" /> : index + 1}
              </span>
              <span className={index <= currentStep ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400"}>{label}</span>
            </li>
          ))}
        </ol>
      </div>
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
                  {job.experienceLevel && (
                    <span className="flex items-center gap-1.5">
                      <GraduationCap size={13} aria-hidden="true" />
                      <span>Experience level: {job.experienceLevel}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          {job.applicationDeadline && <p role="status" className="mt-4 rounded-lg border border-zinc-300 p-3 text-sm dark:border-zinc-600">{closed ? "Applications closed" : "Apply until"}: {deadlineLabel(job.applicationDeadline)}</p>}
          {step === "details" ? (
            <>
              <section className="px-1 py-6 sm:px-2">
                <h4 className="text-sm font-semibold">About the role</h4>
                <JobDescription value={job.description || "No additional details provided."} format={job.descriptionFormat} className="mt-3 text-zinc-600 dark:text-zinc-300" />
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
                      {application.coverNoteName && <ApplicationPdfDownload application={application} kind="coverNote" />}
                    </div>
                  </div>
                ) : !closed ? (
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
              {closed && <p role="alert" className="mb-4 text-sm text-red-600">This job is no longer accepting applications.</p>}
              <fieldset disabled={busy || closed} className="space-y-6">
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
                  <label className="mt-4 block text-xs font-medium">Contact number <span className="font-normal text-zinc-400">(optional)</span>
                    <input type="tel" autoComplete="tel" maxLength={32} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className={input} placeholder="e.g. 0917 123 4567" />
                  </label>
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
                <section aria-label="Cover note">
                  <h4 className="text-sm font-semibold">Cover note <span className="text-xs font-normal text-zinc-400">(optional)</span></h4>
                  <div role="group" aria-label="Cover note format" className="mt-3 inline-flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
                    {[["text", "Type a note"], ["pdf", "Upload PDF"]].map(([mode, label]) => <button key={mode} type="button" aria-pressed={coverMode === mode} onClick={() => { setCoverMode(mode); setError(""); }} className={`rounded-md px-3 py-2 text-xs font-semibold transition ${coverMode === mode ? "bg-brand text-white shadow-sm" : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"}`}>{label}</button>)}
                  </div>
                  {coverMode === "text" ? <label className="mt-2 block text-xs font-medium">
                    <span className="sr-only">Cover note text</span>
                    <textarea rows={3} maxLength={5000} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} className={`${input} resize-y`} placeholder="What makes this opportunity a good fit for you?" />
                    <span className="mt-1 block text-right text-[10px] font-normal text-zinc-400">{form.note.length.toLocaleString()} / 5,000</span>
                  </label> : <div className="mt-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 dark:border-zinc-600 dark:bg-zinc-800/30">
                    <input ref={coverInput} type="file" aria-label="Choose PDF cover note" accept=".pdf,application/pdf" className="hidden" onChange={(event) => { chooseCoverPdf(event.target.files?.[0]); event.target.value = ""; }} />
                    {coverPdf ? <div className="flex items-center gap-3"><FileText size={24} className="shrink-0 text-brand" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium" title={coverPdf.name}>{coverPdf.name}</p><p className="mt-1 text-xs text-zinc-500">{Math.ceil(coverPdf.size / 1024)} KB ? PDF</p></div><button type="button" aria-label="Remove PDF cover note" onClick={() => { ++coverSelection.current; setCoverPdf(null); }} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"><X size={16} /></button></div> : <p className="text-xs text-zinc-500 dark:text-zinc-400">Attach a PDF cover note, up to 5 MB. Other file types are not accepted.</p>}
                    <button type="button" onClick={() => coverInput.current?.click()} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold shadow-sm dark:border-zinc-600 dark:bg-zinc-900"><UploadCloud size={15} />{coverPdf ? "Change PDF" : "Choose PDF"}</button>
                  </div>}
                </section>
                <p className="flex items-start gap-2 rounded-lg bg-zinc-50 p-3 text-[11px] leading-5 text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400">
                  <ShieldCheck
                    size={16}
                    className="mt-0.5 shrink-0 text-brand dark:text-brand"
                  />
                  Your contact details and attached documents are shared with the university
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
  const { openChatByEmail } = useChat();
  const [contactBusy, setContactBusy] = useState(false);
  const [contactError, setContactError] = useState("");
  const contactPending = useRef(false);
  const messageApplicant = async () => {
    if (contactPending.current || !selectedApplication?.messageEmail) return;
    contactPending.current = true;
    setContactBusy(true);
    setContactError("");
    try {
      const opened = await openChatByEmail(selectedApplication.messageEmail);
      if (opened) onClose();
      else setContactError("Unable to open the conversation. You can still contact the applicant by email.");
    } catch { setContactError("Unable to open the conversation. Please try again."); }
    finally { contactPending.current = false; setContactBusy(false); }
  };
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const lastViewButton = useRef(null);
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
  return (
    <FeedDialog scrollKey={selectedApplication?._id || "list"} title={selectedApplication ? "Application details" : `Applicants for ${job.title}`} onClose={onClose}>
      {selectedApplication ? <>
        <button type="button" onClick={() => { setSelectedApplication(null); setContactError(""); requestAnimationFrame(() => document.getElementById(`view-application-${lastViewButton.current}`)?.focus()); }} className="mb-5 inline-flex items-center gap-2 text-xs font-medium text-zinc-500 hover:text-brand dark:text-zinc-400"><ArrowLeft size={15} />Back to applicants</button>
        <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/40">
          <p className="text-xs font-medium text-brand">{job.title}</p>
          <h3 className="mt-2 break-words text-lg font-semibold">{selectedApplication.name}</h3>
          <p className="mt-1 break-all text-sm text-zinc-500 dark:text-zinc-400">{selectedApplication.email}</p>
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">Submitted {new Date(selectedApplication.createdAt).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })} (PH time)</p>
        </section>
        <section className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900 dark:bg-emerald-950/20" aria-label="Contact applicant">
          <h3 className="text-sm font-semibold">Contact applicant</h3>
          <a href={`mailto:${encodeURIComponent(selectedApplication.email)}`} className="mt-3 flex items-start gap-2 text-sm text-brand"><Mail size={16} className="mt-0.5 shrink-0" /><span className="min-w-0 break-all">{selectedApplication.email}</span></a>
          {selectedApplication.phone && <a href={`tel:${selectedApplication.phone.replace(/[^+0-9]/g, "")}`} className="mt-2 flex items-center gap-2 text-sm text-brand"><Phone size={16} className="shrink-0" />{selectedApplication.phone}</a>}
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={`mailto:${encodeURIComponent(selectedApplication.email)}?subject=${encodeURIComponent(`Regarding your application: ${job.title}`)}`} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white"><Mail size={14} />Email applicant</a>
            {selectedApplication.messageEmail && <button type="button" disabled={contactBusy} onClick={messageApplicant} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-brand disabled:opacity-50 dark:border-emerald-800 dark:bg-zinc-900">{contactBusy ? <LoaderCircle size={14} className="animate-spin" /> : <MessageCircle size={14} />}{contactBusy ? "Opening..." : "Message applicant"}</button>}
          </div>
          {!selectedApplication.messageEmail && <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">In-system messaging is unavailable for this account. Use the contact email above.</p>}
          {contactError && <p role="alert" className="mt-3 text-xs text-red-600 dark:text-red-400">{contactError}</p>}
        </section>
        <section className="mt-5 border-t border-zinc-200 pt-5 dark:border-zinc-700">
          <h3 className="text-sm font-semibold">Resume</h3>
          {selectedApplication.resumeName ? <><p className="mt-2 break-all text-xs text-zinc-500 dark:text-zinc-400">{selectedApplication.resumeName}</p><ApplicationPdfDownload application={selectedApplication} kind="resume" /></> : <p className="mt-2 text-xs text-zinc-500">No resume attached.</p>}
        </section>
        <section className="mt-5 border-t border-zinc-200 pt-5 dark:border-zinc-700">
          <h3 className="text-sm font-semibold">Cover note</h3>
          {selectedApplication.note && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{selectedApplication.note}</p>}
          {selectedApplication.coverNoteName && <><p className="mt-2 break-all text-xs text-zinc-500 dark:text-zinc-400">{selectedApplication.coverNoteName}</p><ApplicationPdfDownload application={selectedApplication} kind="coverNote" /></>}
          {!selectedApplication.note && !selectedApplication.coverNoteName && <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">No cover note provided.</p>}
        </section>
      </> : <>

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
              <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="break-words text-sm font-semibold">{application.name}</h3>
                  <p className="mt-1 break-all text-xs text-zinc-500 dark:text-zinc-400">{application.email}</p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Submitted {new Date(application.createdAt).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })}</p>
                </div>
                <button id={`view-application-${application._id}`} type="button" onClick={() => { lastViewButton.current = application._id; setContactError(""); setSelectedApplication(application); }} className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">View application</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      </>}
    </FeedDialog>
  );
}

function ApplicationPdfDownload({ application, kind }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const label = kind === "coverNote" ? "cover note PDF" : "resume";
  const download = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await api.get(`/jobs/applications/${application._id}/${kind === "coverNote" ? "cover-note" : "resume"}`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = application[`${kind}Name`];
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError(`Unable to download the ${label}. Please try again.`); }
    finally { setBusy(false); }
  };
  return <div><button type="button" disabled={busy} onClick={download} className={`${button} mt-2`}><Download size={14} />{busy ? "Downloading..." : `Download ${label}`}</button>{error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}</div>;
}
