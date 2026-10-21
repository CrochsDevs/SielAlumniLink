import { createElement, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, Briefcase, Building2, CheckCircle2, Clock3, GraduationCap, LoaderCircle, MapPin, Monitor } from "lucide-react";
import { useAuth } from "../context/useAuth";
import api from "../utils/axios";
import AdminSidebar from "../layout/sidebar/admin/adminSidebar";
import AlumniSidebar from "../layout/sidebar/alumni/alumniSidebar";
import StudentSidebar from "../layout/sidebar/student/studentSidebar";
import AdminTopbar from "../layout/topbar/alumni/adminTopbar";
import AlumniTopbar from "../layout/topbar/alumni/alumniTopbar";
import StudentTopbar from "../layout/topbar/student/studentTopbar";
import JobDescription from "../components/career/JobDescription";
import { JobApplicationDialog, JobApplicantsDialog } from "../components/career/JobApplicationDialog";
import useJobDeadline, { deadlineLabel, deadlinePassed } from "../components/career/useJobDeadline";
import "./CareerOpportunityPage.css";

const shells = {
  admin: { sidebar: AdminSidebar, topbar: AdminTopbar, board: "/admin/jobs" },
  alumni: { sidebar: AlumniSidebar, topbar: AlumniTopbar, board: "/alumni/career" },
  student: { sidebar: StudentSidebar, topbar: StudentTopbar, board: "/student/career" },
};
const dateLabel = value => new Date(value).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "long", day: "numeric", year: "numeric" });

export default function CareerOpportunityPage() {
  const { jobId } = useParams();
  const { user } = useAuth();
  const shell = shells[user?.role] || shells.student;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(false);
  const now = useJobDeadline();
  const isAdmin = user?.role === "admin";
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    Promise.all([
      api.get(`/jobs/${jobId}`, { signal: controller.signal }),
      isAdmin ? Promise.resolve(null) : api.get("/jobs/applications/me", { signal: controller.signal }),
    ]).then(([job, applications]) => {
      if (!active) return;
      setResult({ id: jobId, job: job.data.data, application: applications?.data.data.find(item => item.jobId === jobId) || null });
      setError("");
    }).catch(err => {
      if (!active) return;
      setError(err.response?.status === 404 ? "This opportunity is unavailable or is not shared with your account." : "Unable to load this opportunity. Please try again.");
    });
    return () => { active = false; controller.abort(); };
  }, [jobId, isAdmin, attempt]);
  const job = result?.id === jobId ? result.job : null;
  const application = result?.id === jobId ? result.application : null;
  const closed = !job?.isActive || deadlinePassed(job, now);
  const metadata = job ? [[MapPin, "Location", job.location || "Not specified"], [Briefcase, "Employment type", job.type], [Monitor, "Work mode", job.mode], [GraduationCap, "Experience level", job.experienceLevel || "Not specified"]] : [];
  return <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950">
    {createElement(shell.sidebar, { user, mobileOpen: sidebarOpen, setMobileOpen: setSidebarOpen })}
    <div className="lg:pl-64">
      {createElement(shell.topbar, { user, title: "Opportunity details", onMenuClick: () => setSidebarOpen(true) })}
      <main className="workspace-page opportunity-detail-page">
        <Link to={shell.board} className="opportunity-back"><ArrowLeft size={16} />Back to opportunities</Link>
        {error ? <div role="alert" className="opportunity-detail-panel p-6"><p>{error}</p><button type="button" className="mt-4 text-sm font-semibold text-brand underline" onClick={() => { setError(""); setResult(null); setAttempt(value => value + 1); }}>Try again</button></div> : !job ? <div role="status" className="opportunity-detail-panel flex items-center justify-center gap-3 p-16 text-sm"><LoaderCircle size={20} className="animate-spin text-brand" />Loading opportunity...</div> : <>
          <header className="opportunity-detail-panel opportunity-detail-header">
            <span className="opportunity-detail-company"><Building2 size={28} aria-hidden="true" /></span>
            <div className="min-w-0 flex-1"><p className="opportunity-detail-kicker">UNIVERSITY OPPORTUNITY</p><h1>{job.title}</h1><p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{job.company}</p><p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">{job.createdAt && `Posted ${dateLabel(job.createdAt)} · `}{job.audience === "alumni" ? "Alumni only" : "Alumni & Students"}</p></div>
            <span className={`opportunity-status ${closed ? "opportunity-status-closed" : ""}`}>{closed ? "Applications closed" : "Open for applications"}</span>
          </header>
          <div className="opportunity-detail-grid">
            <article className="opportunity-detail-panel opportunity-detail-description"><h2>About the opportunity</h2><JobDescription value={job.description || "No additional details provided."} format={job.descriptionFormat} className="mt-5 text-zinc-600 dark:text-zinc-300" /></article>
            <aside className="space-y-4">
              <section className="opportunity-detail-panel p-5"><h2 className="text-sm font-semibold">Opportunity overview</h2><dl className="mt-5 space-y-5">{metadata.map(([Icon, label, value]) => <div key={label} className="flex gap-3">{createElement(Icon, { size: 18, className: "mt-0.5 shrink-0 text-brand", "aria-hidden": true })}<div className="min-w-0"><dt className="text-xs text-zinc-500 dark:text-zinc-400">{label}</dt><dd className="mt-1 break-words text-sm font-medium">{value}</dd></div></div>)}</dl></section>
              <section className="opportunity-detail-panel p-5"><div className="flex gap-2"><Clock3 size={18} className="shrink-0 text-brand" /><h2 className="text-sm font-semibold">Application deadline</h2></div><p className="mt-3 text-xs leading-6 text-zinc-500 dark:text-zinc-400">{job.applicationDeadline ? deadlineLabel(job.applicationDeadline) : "No deadline specified."}</p>
                {application && <p className="mt-4 flex items-center gap-2 text-sm font-medium text-brand"><CheckCircle2 size={16} />You have applied</p>}
                {isAdmin ? <button type="button" className="opportunity-detail-apply" onClick={() => setDialog(true)}>View applicants</button> : <button type="button" disabled={closed && !application} className="opportunity-detail-apply" onClick={() => setDialog(true)}>{application ? "View application" : closed ? "Applications closed" : "Apply now"}{!closed && !application && <ArrowUpRight size={16} />}</button>}
              </section>
            </aside>
          </div>
        </>}
      </main>
    </div>
    {dialog && job && (isAdmin ? <JobApplicantsDialog job={job} onClose={() => setDialog(false)} /> : <JobApplicationDialog key={jobId} jobId={jobId} user={user} application={application} onApplied={saved => setResult(previous => ({ ...previous, application: saved }))} onClose={() => setDialog(false)} />)}
  </div>;
}
