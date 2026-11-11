import ContentSkeleton from "../ui/Skeleton";
import StatCard from "../ui/stat-card";
import ProgressBar from "../ui/progress-bar";
import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Compass, FileUser, MessageCircle, RefreshCw, Target, ArrowRight, Plus, Clock3, Circle } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import ProfileAvatar from '../profile/ProfileAvatar';
import api from '../../utils/axios';
import MentorProgressWorkspace from './MentorProgressWorkspace';
import { createPendingTask } from '../../utils/pendingTask';
const STATUSES = [{
  key: 'not_started',
  label: 'Not Started',
  style: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
}, {
  key: 'in_progress',
  label: 'In Progress',
  style: 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200'
}, {
  key: 'completed',
  label: 'Completed',
  style: 'bg-emerald-50 text-brand dark:bg-zinc-800 dark:text-brand'
}];
const icons = {
  resume_building: FileUser,
  interview_preparation: MessageCircle,
  career_planning: Compass
};
const card = 'rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900';
const input = 'mt-2 min-h-11 w-full min-w-0 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100';
const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2';
const date = value => value ? new Date(value).toLocaleDateString('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'Asia/Manila'
}) : '';
function GoalCard({
  goal,
  connectionId,
  onSaved,
  isMentor,
  onDirty,
  onCareerPlanning
}) {
  const [status, setStatus] = useState(goal.status);
  const [note, setNote] = useState(goal.note);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const pending = useRef(false);
  const savedStatus = STATUSES.find(item => item.key === goal.status) || STATUSES[0];
  const changed = status !== goal.status || note.trim() !== goal.note;
  useEffect(() => {
    onDirty(goal.key, changed || busy);
    return () => onDirty(goal.key, false);
  }, [onDirty, goal.key, changed, busy]);
  const save = async event => {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const response = await api.put(`/mentorship/${connectionId}/goals/${goal.key}`, {
        status,
        note: note.trim(),
        revision: goal.revision
      });
      onSaved(response.data.data, goal.title);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save your activity. Please try again.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const guidance = goal.status === 'completed' ? 'Your mentor has confirmed this goal. You can add a follow-up note anytime.' : goal.key === 'resume_building' ? 'Add your summary, skills, or projects to your portfolio. Your progress updates automatically.' : goal.key === 'career_planning' ? 'Save your career interests and goals to give your mentor a clear direction.' : 'Practice an interview, then record what you worked on for your mentor to review.';
  return <article data-mentorship-goal={goal.key} className={`${card} overflow-hidden${isMentor ? "" : " mentorship-student-goal"}`}>
    <div className="mentorship-goal-body p-5 sm:p-6">
      <div className="flex items-start gap-3 sm:gap-4">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${goal.status === 'completed' ? 'bg-emerald-50 text-brand dark:bg-zinc-800 dark:text-brand' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300'}`}>{createElement(goal.status === 'completed' ? CheckCircle2 : icons[goal.key] || Target, {
            size: 21,
            'aria-hidden': true
          })}</span>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">{goal.title}</h3><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${savedStatus.style}`}>{savedStatus.label}</span></div></div>
      </div>
      <p className="mentorship-goal-description mt-3 max-w-2xl text-sm leading-6 text-zinc-500 sm:ml-[60px] dark:text-zinc-400">{isMentor ? goal.description : guidance}</p>
      {(!!goal.activitySources?.length || goal.note) && <details className="mt-4 text-xs sm:ml-[60px]"><summary className="cursor-pointer py-1 font-medium text-zinc-500 hover:text-brand dark:text-zinc-400">View saved activity{goal.activitySources?.length ? ` (${goal.activitySources.length})` : ''}</summary><div className="mt-2 rounded-lg bg-zinc-50 p-3 leading-6 dark:bg-zinc-800/50"><ul className="space-y-1">{goal.activitySources?.map((source, index) => <li key={index} className="flex items-start gap-2"><CheckCircle2 size={13} className="mt-1.5 shrink-0 text-brand" /><span>{source.label}</span></li>)}</ul>{goal.note && <p className="mt-2 whitespace-pre-wrap break-words text-zinc-600 dark:text-zinc-300">{goal.note}</p>}{goal.updatedAt && <p className="mt-2 text-[11px] text-zinc-400">Updated {date(goal.updatedAt)} by {goal.updatedByName || goal.updatedByRole}</p>}</div></details>}
      <div className="mentorship-goal-actions mt-4 flex flex-wrap items-center gap-2 sm:pl-[60px]">
        {!isMentor && goal.status !== 'completed' && goal.key === 'resume_building' && <Link to="/student/portfolio" className={button}>Update portfolio<ArrowRight size={15} /></Link>}
        {!isMentor && goal.status !== 'completed' && goal.key === 'career_planning' && (onCareerPlanning ? <button type="button" onClick={onCareerPlanning} className={button}>Set career goals<ArrowRight size={15} /></button> : <Link to="/student/mentorship" className={button}>Set career goals<ArrowRight size={15} /></Link>)}
        <button type="button" aria-expanded={expanded} aria-controls={`goal-editor-${connectionId}-${goal.key}`} disabled={busy} onClick={() => setExpanded(value => !value)} className={isMentor || goal.key === 'interview_preparation' ? button : 'inline-flex min-h-11 items-center gap-2 rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'}><Plus size={15} />{isMentor ? goal.status === 'completed' ? 'Edit review' : 'Review goal' : goal.key === 'interview_preparation' ? 'Log practice' : goal.note ? 'Edit activity' : 'Add a note'}</button>
        {goal.completedAt && <span className="text-xs text-brand dark:text-brand">Confirmed {date(goal.completedAt)}</span>}
      </div>

    </div>
    {expanded && <form id={`goal-editor-${connectionId}-${goal.key}`} onSubmit={save} className="border-t border-zinc-100 bg-zinc-50/70 p-5 sm:p-6 dark:border-zinc-800 dark:bg-zinc-950/40"><fieldset disabled={busy} className="space-y-4">
      {isMentor && <label className="block max-w-sm text-xs font-semibold">Mentor review<select aria-label={`Status for ${goal.title}`} value={status} onChange={event => {
            setStatus(event.target.value);
            setError('');
          }} className={input}>{STATUSES.map(item => <option key={item.key} value={item.key} disabled={item.key === 'not_started' && !!goal.activitySources?.length}>{item.label}</option>)}</select><span className="mt-2 block text-xs font-normal text-zinc-500">Mark Completed after reviewing your student's work.</span></label>}
      <label className="block text-xs font-semibold">{isMentor ? 'Review notes & feedback' : goal.key === 'interview_preparation' ? 'What did you practice?' : 'What have you worked on?'}<textarea aria-label={`Note for ${goal.title}`} value={note} onChange={event => setNote(event.target.value)} rows={3} maxLength={1000} placeholder={isMentor ? 'Share feedback and next steps for this mentee.' : goal.key === 'interview_preparation' ? 'For example: practiced STAR answers and explaining my latest project.' : 'Share a short update or ask your mentor for feedback.'} className={`${input} py-3 leading-6`} /></label>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex flex-wrap items-center gap-3"><button type="submit" disabled={!changed || busy} className={button}>{busy ? 'Saving…' : isMentor ? 'Save mentor review' : 'Save activity'}</button><button type="button" onClick={() => {
            setNote(goal.note);
            setStatus(goal.status);
            setError('');
            setExpanded(false);
          }} className="min-h-11 px-3 text-sm text-zinc-500">Cancel</button></div>
    </fieldset></form>}
  </article>;
}
export default function MentorshipProgressTracker({
  initialPartnerAuthId = "",
  onFindMentors,
  onCareerPlanning
}) {
  const {
    user
  } = useAuth();
  const [trackers, setTrackers] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const generation = useRef(0);
  const pending = useRef(createPendingTask());
  const dirtyGoals = useRef(new Set());
  const [dirty, setDirty] = useState(false);
  const onDirty = useCallback((key, dirty) => {
    if (dirty) dirtyGoals.current.add(key);else dirtyGoals.current.delete(key);
    setDirty(dirtyGoals.current.size > 0);
  }, []);
  const load = useCallback((silent = false) => pending.current.run(async () => {
    const request = ++generation.current;
    if (!silent) setLoading(true);
    setError("");
    try {
      const response = await api.get("/mentorship/me");
      if (request === generation.current && (!silent || !dirtyGoals.current.size)) setTrackers(response.data.data || []);
    } catch (err) {
      if (request === generation.current) setError(err.response?.data?.message || "Unable to load mentorship progress.");
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }), []);
  useEffect(() => {
    const gate = pending.current;
    void load();
    const refresh = () => {
      if (!document.hidden && !dirtyGoals.current.size) void load(true);
    };
    window.addEventListener('focus', refresh);
    const timer = setInterval(refresh, 30000);
    return () => {
      window.removeEventListener('focus', refresh);
      clearInterval(timer);
      // Request sequence counter, not a DOM reference.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ++generation.current;
      gate.clear();
    };
  }, [load]);
  const partner = tracker => user?.role === "alumni" ? tracker.student : tracker.mentor;
  const selected = trackers.find(tracker => tracker.connectionId === selectedId) || trackers.find(tracker => partner(tracker).authId === initialPartnerAuthId) || trackers[0];
  const onSaved = (tracker, title) => {
    ++generation.current;
    setTrackers(previous => previous.map(item => item.connectionId === tracker.connectionId ? tracker : item));
    setMessage(`${title} progress saved.`);
  };
  const peer = selected ? partner(selected) : null;
  return <section aria-label="Mentorship progress tracker" className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Target size={21} className="text-brand" />
            {user?.role === 'alumni' ? 'Mentee progress' : 'Your mentorship progress'}
          </h2>
          <p className="mt-2 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
            {user?.role === 'alumni' ? 'See every mentee at a glance, review their activity, and guide their next steps.' : 'Work on three goals, share your activity, and get feedback from your mentor.'}
          </p>
        </div>
        <button type="button" disabled={loading || dirty} onClick={() => load()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-600 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          <RefreshCw size={14} />
          Refresh progress
        </button>
      </header>
      {error && <p role="alert" className={`${card} p-4 text-sm text-red-600 dark:text-red-400`}>
          {error}{" "}
          <button type="button" onClick={() => load()} className="underline">
            Retry
          </button>
        </p>}
      {message && !loading && <p role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-brand dark:bg-zinc-800 dark:text-brand">
          <CheckCircle2 size={16} />
          {message}
        </p>}
      {loading ? <ContentSkeleton variant="form" count={1} label="Loading mentorship goals…" /> : !error && !selected ? <div className={`${card} py-12 text-center`}>
          <Target size={32} className="mx-auto text-zinc-300 dark:text-zinc-600" />
          <h3 className="mt-4 text-base font-semibold">
            Start with a mentorship connection
          </h3>
          <p className="mx-auto mt-2 max-w-md px-4 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            {user?.role === "alumni" ? "Your students will appear here once you accept their connection requests." : "Connect with an alumni mentor. Once your request is accepted, you can track resume building, interview preparation, and career planning together."}
          </p>
          {onFindMentors && <button type="button" onClick={onFindMentors} className={`${button} mt-5`}>Find a mentor<ArrowRight size={15} /></button>}
        </div> : !error && selected && user?.role === 'alumni' ? <MentorProgressWorkspace trackers={trackers} initialPartnerAuthId={initialPartnerAuthId} dirty={dirty} onSelect={() => setMessage('')} renderGoals={tracker => tracker.goals.map(goal => <GoalCard key={`${tracker.connectionId}:${goal.key}:${goal.revision}:${goal.status}`} goal={goal} connectionId={tracker.connectionId} onSaved={onSaved} isMentor onDirty={onDirty} />)} /> : !error && selected && <>
            <section className={`${card} mentorship-progress-summary overflow-hidden`} aria-label="Selected mentorship overview">
              <div className="mentorship-progress-mentor p-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-emerald-50 text-brand dark:bg-zinc-800"><ProfileAvatar user={peer} /></span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Your mentor</p>
                    <h3 className="mt-1 break-words text-sm font-semibold">{peer.name}</h3>
                    <p className="mt-1 break-words text-xs text-zinc-500 dark:text-zinc-400">{peer.program || peer.email}</p>
                  </div>
                </div>
                {trackers.length > 1 && <label className="mt-5 block min-w-0 text-xs font-medium">
                  Switch mentor
                  <select aria-label="Select mentorship connection" value={selected.connectionId} onChange={event => {
                    setSelectedId(event.target.value);
                    setMessage("");
                  }} className={input}>
                    {trackers.map(tracker => <option key={tracker.connectionId} value={tracker.connectionId}>{partner(tracker).name}</option>)}
                  </select>
                </label>}
                <p className="mt-4 text-xs leading-5 text-zinc-500 dark:text-zinc-400">Your goals and activity are tracked separately for each mentor.</p>
              </div>
              <div className="mentorship-progress-stats p-5">
                <div className="min-w-0">
                  <div className="flex items-end justify-between gap-4">
                    <div><p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Mentor-confirmed goals</p><h3 className="mt-1 text-base font-semibold">Overall progress</h3></div>
                    <span className="shrink-0 text-3xl font-semibold tabular-nums text-brand">{selected.summary.percent}<span className="text-lg">%</span></span>
                  </div>
                  <ProgressBar label="Mentorship goals completed" value={selected.summary.total ? selected.summary.completed / selected.summary.total * 100 : 0}
                    segments={selected.summary.total} className="mentorship-confirmed-track mt-4"
                    segmentClassName="mentorship-progress-segment" fillClassName="mentorship-confirmed-fill" />
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400"><span className="font-medium tabular-nums text-zinc-700 dark:text-zinc-300">{selected.summary.completed} / {selected.summary.total} confirmed</span><span className="mx-2 text-zinc-300 dark:text-zinc-600">|</span>Target: {selected.summary.total} goals</p>
                </div>
                <dl className="mentorship-progress-counts">
                  {[["Confirmed", selected.summary.completed, CheckCircle2, "positive"], ["In progress", selected.summary.inProgress, Clock3, "warning"], ["Not started", selected.summary.notStarted, Circle, "neutral"]].map(([label, count, icon, tone]) => <StatCard key={label} label={label} value={count} icon={icon} tone={tone} compact />)}
                </dl>
                <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">Only mentor-confirmed goals fill the progress bar.</p>
              </div>
            </section>
            <div className="flex items-center justify-between gap-3">
              <div><h2 className="text-base font-semibold">Your goals</h2><p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Choose a goal to work on and share an update with your mentor.</p></div>
              <span className="shrink-0 rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand">{selected.goals.length} goals</span>
            </div>
            <div className="mentorship-student-goals">
              {selected.goals.map(goal => <GoalCard key={`${selected.connectionId}:${goal.key}:${goal.revision}:${goal.status}`} goal={goal} connectionId={selected.connectionId} onSaved={onSaved} isMentor={user?.role === 'alumni'} onDirty={onDirty} onCareerPlanning={onCareerPlanning} />)}
            </div>
            <aside className={`${card} p-5`} aria-label="How mentorship progress works">
              <h3 className="text-sm font-semibold">How progress works</h3>
              <ol className="mentorship-progress-guide mt-4">
                {[["Work on a goal", "Update your portfolio, set career goals, or practice an interview."], ["Share your activity", "Add a short note so your mentor can review your work."], ["Get mentor feedback", "Your mentor confirms completed goals and guides your next steps."]].map(([title, description], index) => <li key={title} className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">{index + 1}</span>
                  <div><p className="text-xs font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{description}</p></div>
                </li>)}
              </ol>
            </aside>
          </>}
    </section>;
}
