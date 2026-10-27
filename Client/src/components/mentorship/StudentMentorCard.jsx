import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check, Clock, GraduationCap, LoaderCircle, MapPin, MessageSquare, Plus, Sparkles, Target } from "lucide-react";
import ProfileAvatar from "../profile/ProfileAvatar";

export default function StudentMentorCard({ mentor, status, score, reasons, connect, message, onProgress, sending, disabled }) {
  const [failedBanner, setFailedBanner] = useState(null);
  const currentJob = mentor.employmentHistory?.find(job => job.current);
  const headline = mentor.headline || (currentJob
    ? [currentJob.position || currentJob.role, currentJob.company].filter(Boolean).join(" at ")
    : mentor.program || "CLSU alumni");
  const connected = status === "connected";
  const pending = status === "pending";
  const incoming = status === "incoming";
  const profilePath = `/alumni/profile/${mentor._id}`;
  const skills = mentor.skills || [];

  return (
    <article className="mentorship-person-card rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {mentor.bannerImage && mentor.bannerImage !== failedBanner && <img src={mentor.bannerImage} alt="" loading="lazy" onError={() => setFailedBanner(mentor.bannerImage)} className="h-20 w-full object-cover" />}
      <div className="mentorship-person-body">
        <div className="flex items-start gap-3.5">
          <Link to={profilePath} aria-label={`View ${mentor.name || "alumni"} profile`} className="mentorship-avatar flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-emerald-50 text-xl font-semibold text-brand dark:bg-emerald-950">
            <ProfileAvatar user={mentor} fallback="A" />
          </Link>
          <div className="min-w-0 flex-1">
            <h3 className="text-base leading-6"><Link to={profilePath} className="break-words hover:text-brand hover:underline">{mentor.name || "Alumni"}</Link></h3>
            <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{headline}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1.5"><GraduationCap size={15} className="shrink-0 text-brand" />{mentor.batch ? `Batch ${mentor.batch}` : "CLSU alumni"}</span>
          {mentor.location && <span className="inline-flex min-w-0 items-start gap-1.5"><MapPin size={14} className="mt-0.5 shrink-0" /><span className="break-words">{mentor.location}</span></span>}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {score !== undefined && <span title="Similarity between your profile and the mentor’s experience" className="mentorship-tag bg-emerald-50 text-brand dark:bg-emerald-950"><Sparkles size={12} />{score}% profile similarity</span>}
          {(connected || pending || incoming) && <span className={`mentorship-tag ${connected ? "bg-emerald-50 text-brand dark:bg-emerald-950" : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"}`}>
            {connected ? <Check size={12} /> : <Clock size={12} />}{connected ? "Connected" : incoming ? "Wants to connect" : "Request sent"}
          </span>}
          {!reasons && skills.slice(0, 3).map(skill => <span key={skill} className="mentorship-tag max-w-full break-words bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{skill}</span>)}
          {!reasons && skills.length > 3 && <span className="text-xs text-zinc-400">+{skills.length - 3} more</span>}
        </div>

        {reasons?.length > 0 && <details open className="mentorship-match-reasons mt-4 rounded-xl bg-zinc-50 p-3.5 dark:bg-zinc-800/60">
          <summary className="cursor-pointer text-xs font-semibold text-zinc-700 dark:text-zinc-300">Why this mentor?</summary>
          <ul className="mt-2.5 space-y-2">{reasons.map(reason => <li key={reason} className="flex gap-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400"><Check size={13} className="mt-1 shrink-0 text-brand" /><span className="min-w-0 break-words">{reason}</span></li>)}</ul>
        </details>}
      </div>

      <div className="mentorship-person-actions border-t border-zinc-100 dark:border-zinc-800">
        <div className="grid grid-cols-2 gap-2">
          {connected ? <button type="button" className="mentorship-action-primary" onClick={() => message(mentor)}><MessageSquare size={15} />Message</button>
            : incoming ? <Link to="/student/requests" className="mentorship-action-primary">Review request</Link>
            : <button type="button" className={pending ? "mentorship-action-secondary" : "mentorship-action-primary"} disabled={disabled || !!sending || pending} onClick={() => connect(mentor)}>
              {sending === mentor.email ? <LoaderCircle size={15} className="animate-spin" /> : pending ? <Clock size={15} /> : <Plus size={15} />}
              {pending ? "Request sent" : sending === mentor.email ? "Sending…" : "Connect"}
            </button>}
          {connected && onProgress
            ? <button type="button" className="mentorship-action-secondary" onClick={() => onProgress(mentor)}><Target size={15} />View progress</button>
            : <Link to={profilePath} className="mentorship-action-secondary">View profile<ArrowUpRight size={14} /></Link>}
        </div>
        {connected && onProgress && <Link to={profilePath} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-brand dark:text-zinc-400">View profile<ArrowUpRight size={13} /></Link>}
      </div>
    </article>
  );
}
