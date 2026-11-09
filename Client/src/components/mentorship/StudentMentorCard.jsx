import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, BadgeCheck, Check, Clock, GraduationCap, LoaderCircle, MapPin, MessageSquare, Plus, Sparkles, Target } from "lucide-react";
import ProfileAvatar from "../profile/ProfileAvatar";
import { mentorKey } from './connectionStates';

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
      <div aria-hidden="true" className="h-16 shrink-0 overflow-hidden bg-gradient-to-r from-emerald-100 via-emerald-50 to-teal-100 dark:from-zinc-800 dark:via-zinc-800 dark:to-zinc-800">
        {mentor.bannerImage && mentor.bannerImage !== failedBanner && <img src={mentor.bannerImage} alt="" loading="lazy" onError={() => setFailedBanner(mentor.bannerImage)} className="h-full w-full object-cover" />}
      </div>
      <div className="mentorship-person-body">
        <div className="flex items-start gap-3">
          <Link to={profilePath} aria-label={`View ${mentor.name || "alumni"} profile`} className="mentorship-avatar flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-emerald-50 text-lg font-semibold text-brand dark:bg-zinc-800">
            <ProfileAvatar user={mentor} fallback="A" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="min-w-0 text-sm leading-5"><Link to={profilePath} title="View profile" className="break-words hover:text-brand hover:underline">{mentor.name || "Alumni"}</Link></h3>
              {connected && <span aria-label="Connection status: Connected" className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold leading-4 text-emerald-700 dark:border-emerald-800 dark:bg-zinc-800 dark:text-emerald-300"><BadgeCheck size={12} aria-hidden="true" />Connected</span>}
              {pending && <span aria-label="Connection status: Request sent" className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold leading-4 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300"><Clock size={12} aria-hidden="true" />Request sent</span>}
            </div>
            <p title={headline} className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{headline}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1.5"><GraduationCap size={15} className="shrink-0 text-brand" />{mentor.batch ? `Batch ${mentor.batch}` : "CLSU alumni"}</span>
          {mentor.location && <span className="inline-flex min-w-0 items-start gap-1.5"><MapPin size={14} className="mt-0.5 shrink-0" /><span className="break-words">{mentor.location}</span></span>}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {score !== undefined && <span title="Similarity between your profile and the mentor’s experience" className="mentorship-tag bg-emerald-50 text-brand dark:bg-zinc-800"><Sparkles size={12} />{score}% profile similarity</span>}
          {incoming && <span className="mentorship-tag bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
            <Clock size={12} />Wants to connect
          </span>}
          {!reasons && skills.slice(0, 3).map(skill => <span key={skill} className="mentorship-tag max-w-full break-words bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{skill}</span>)}
          {!reasons && skills.length > 3 && <span className="text-xs text-zinc-400">+{skills.length - 3} more</span>}
        </div>

        {reasons?.length > 0 && <details open className="mentorship-match-reasons mt-3 rounded-lg bg-zinc-50 p-2.5 dark:bg-zinc-800/60">
          <summary className="cursor-pointer text-xs font-semibold text-zinc-700 dark:text-zinc-300">Why this mentor?</summary>
          <ul className="mt-2 space-y-1.5">{reasons.map(reason => <li key={reason} className="flex gap-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400"><Check size={13} className="mt-1 shrink-0 text-brand" /><span className="min-w-0 break-words">{reason}</span></li>)}</ul>
        </details>}
      </div>

      <div className="mentorship-person-actions border-t border-zinc-100 dark:border-zinc-800">
        <div className={`grid gap-2 ${pending ? "grid-cols-1" : "grid-cols-2"}`}>
          {connected ? <button type="button" className="mentorship-action-primary" onClick={() => message(mentor)}><MessageSquare size={15} />Message</button>
            : incoming ? <Link to="/student/requests" className="mentorship-action-primary">Review request</Link>
            : !pending && <button type="button" className="mentorship-action-primary" disabled={disabled || !!sending} onClick={() => connect(mentor)}>
              {sending === mentorKey(mentor) ? <LoaderCircle size={15} className="animate-spin" /> : <Plus size={15} />}
              {sending === mentorKey(mentor) ? "Sending…" : "Connect"}
            </button>}
          {connected && onProgress
            ? <button type="button" className="mentorship-action-secondary" onClick={() => onProgress(mentor)}><Target size={15} />View progress</button>
            : <Link to={profilePath} className="mentorship-action-secondary">View profile<ArrowUpRight size={14} /></Link>}
        </div>
        {connected && onProgress && <Link to={profilePath} className="mentorship-profile-shortcut" aria-label={`View ${mentor.name || "alumni"} profile`} title="View profile"><ArrowUpRight size={14} /></Link>}
      </div>
    </article>
  );
}
