import { useEffect, useRef, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import api from '../../utils/axios';
import { FeedDialog } from '../feed/FeedComposer';

const input = 'mt-2 w-full rounded-lg border border-zinc-200 bg-white p-3 text-sm leading-6 outline-none focus:border-brand disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950';
const button = 'min-h-11 rounded-lg bg-brand px-4 text-sm font-semibold text-white disabled:opacity-50';
const labels = { not_started: 'Not Started', draft: 'Draft · In Progress', submitted: 'Awaiting mentor review', revision_requested: 'Revisions requested', completed: 'Completed' };

export default function InterviewPractice(props) {
  return props.goal.interview ? <InterviewPracticeForm {...props} /> : <UnavailableInterview {...props} />;
}

function UnavailableInterview({ connectionId, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const reload = async () => {
    setBusy(true);
    setError('');
    try {
      const { data } = await api.get(`/mentorship/${connectionId}`);
      if (!data.data.goals.find(goal => goal.key === 'interview_preparation')?.interview) {
        setError('Interview practice is not available from the service yet. Please try again later.');
      } else onSaved(data.data, 'Interview Preparation');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load interview practice. Please try again.');
    } finally { setBusy(false); }
  };
  return <article data-mentorship-goal="interview_preparation" className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
    <h3 className="flex items-center gap-2 text-sm font-semibold"><MessageCircle size={20} className="text-brand" />Interview Preparation</h3>
    <p className="mt-3 text-sm leading-6 text-zinc-500">Practice questions could not be loaded. Reload interview practice to try again.</p>
    <button type="button" disabled={busy} onClick={reload} className={`${button} mt-4`}>{busy ? 'Loading…' : 'Reload interview practice'}</button>
    {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
  </article>;
}

function InterviewPracticeForm({ goal, connectionId, isMentor, onDirty, onSaved }) {
  const work = goal.interview;
  const [expanded, setExpanded] = useState(false);
  const [answers, setAnswers] = useState(work.draft || {});
  const [feedback, setFeedback] = useState(work.feedback || {});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const changed = JSON.stringify(isMentor ? feedback : answers) !== JSON.stringify(isMentor ? work.feedback || {} : work.draft || {});
  const editable = !isMentor && !['submitted', 'completed'].includes(work.state);
  const reviewable = isMentor && ['submitted', 'completed'].includes(work.state);
  const questions = isMentor || !editable ? work.submission?.questions || work.questions : work.questions;
  const allAnswered = questions.every(q => answers[q.id]?.trim());
  const allReviewed = questions.every(q => feedback[q.id]?.trim());
  useEffect(() => {
    onDirty(goal.key, changed || busy);
    return () => onDirty(goal.key, false);
  }, [onDirty, goal.key, changed, busy]);
  useEffect(() => {
    if (!changed) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [changed]);
  const save = async action => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const { data } = await api.put(`/mentorship/${connectionId}/interview`, {
        action, revision: goal.revision, ...(isMentor ? { feedback } : { answers }),
      });
      onSaved(data.data, 'Interview Preparation');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save interview practice. Please try again.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const discard = () => {
    setAnswers(work.draft || {});
    setFeedback(work.feedback || {});
    setError('');
  };
  const reload = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      const { data } = await api.get(`/mentorship/${connectionId}`);
      onSaved(data.data, 'Interview Preparation');
      setAnswers(data.data.goals.find(item => item.key === goal.key).interview.draft || {});
      setFeedback(data.data.goals.find(item => item.key === goal.key).interview.feedback || {});
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to reload. Please try again.');
    } finally { pending.current = false; setBusy(false); }
  };
  return <article data-mentorship-goal="interview_preparation" className={`min-w-0 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900${isMentor ? '' : ' mentorship-student-goal'}`}>
    <div className="mentorship-goal-body p-5 sm:p-6">
    <div className="flex items-start gap-3 sm:gap-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300"><MessageCircle size={21} aria-hidden="true" /></span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Interview Preparation</h3>
          <span className="rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-semibold text-brand">{labels[work.state]}</span>
        </div>
      </div>
    </div>
    <p className="mentorship-goal-description mt-3 max-w-2xl text-sm leading-6 text-zinc-500 sm:ml-[60px] dark:text-zinc-400">{isMentor ? 'Review submitted answers, give suggestions for each question, and confirm readiness or request revisions.' : 'Practice six common interview questions. Save a private draft, then submit all answers to your mentor.'}</p>
    {goal.note && <details className="mt-4 text-xs sm:ml-[60px]"><summary className="cursor-pointer">Previous practice note</summary><p className="mt-2 whitespace-pre-wrap break-words">{goal.note}</p></details>}
    <div className="mentorship-goal-actions mt-4 flex flex-wrap items-center gap-2 sm:pl-[60px]">
      <button type="button" className={button} aria-haspopup="dialog" aria-expanded={expanded} aria-controls={`interview-${connectionId}`} onClick={() => setExpanded(true)}>{isMentor ? 'View interview answers' : 'Open interview practice'}</button>
    </div>
    </div>
    {expanded && <FeedDialog
      title={isMentor ? 'Review interview answers' : 'Interview practice'}
      onClose={() => setExpanded(false)}
      busy={busy}
      wide
    ><div id={`interview-${connectionId}`} className="space-y-5">
      <p className="text-xs font-medium text-brand">{labels[work.state]}</p>
      {work.submission && <p className="text-xs text-zinc-500">Submission {work.submission.version} · {new Date(work.submission.submittedAt).toLocaleDateString('en-PH')}</p>}
      {isMentor && !work.submission ? <p className="rounded-lg bg-zinc-50 p-4 text-sm dark:bg-zinc-800">The student has not submitted answers yet. Draft answers stay private until submitted.</p> : <>
        {work.state === 'submitted' && !isMentor && <p role="status" className="text-sm text-zinc-500">Your answers are submitted. Your mentor can request revisions or confirm completion.</p>}
        {work.state === 'revision_requested' && <p role="status" className="text-sm text-amber-700 dark:text-amber-300">{isMentor ? 'Waiting for the student to revise and resubmit.' : 'Read the feedback below, update your answers, then submit again.'}</p>}
        <fieldset disabled={busy} className="space-y-5">
          {questions.map((question, index) => <section key={question.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
            <h4 className="text-sm font-semibold">{index + 1}. {question.question}</h4>
            <p className="mt-1 text-xs leading-5 text-zinc-500">{question.hint}</p>
            {editable ? <label className="mt-3 block text-xs font-medium">Your answer
              <textarea aria-label={`Answer: ${question.question}`} rows={4} maxLength={3000} value={answers[question.id] || ''} onChange={event => setAnswers(previous => ({ ...previous, [question.id]: event.target.value }))} className={input} />
              <span className="text-xs text-zinc-500">{(answers[question.id] || '').length}/3,000</span>
            </label> : <div className="mt-3"><p className="text-xs font-medium">Submitted answer</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{work.submission?.answers[question.id] || 'No answer submitted.'}</p></div>}
            {reviewable ? <label className="mt-3 block text-xs font-medium">Mentor feedback *
              <textarea aria-label={`Feedback: ${question.question}`} rows={3} maxLength={3000} value={feedback[question.id] || ''} onChange={event => setFeedback(previous => ({ ...previous, [question.id]: event.target.value }))} className={input} />
            </label> : work.feedback[question.id] && <div className="mt-3 rounded-lg bg-emerald-50 p-3 dark:bg-zinc-800"><p className="text-xs font-semibold text-brand">Mentor feedback</p><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{work.feedback[question.id]}</p></div>}
          </section>)}
          <div className="flex flex-wrap gap-3">
            {editable && <><button type="button" disabled={busy || !changed} onClick={() => save('draft')} className={button}>Save draft</button><button type="button" disabled={busy || !allAnswered} onClick={() => save('submit')} className={button}>Submit answers</button></>}
            {reviewable && <><button type="button" disabled={busy || !allReviewed} onClick={() => save('request_revision')} className={button}>Request revisions</button>{work.state !== 'completed' && <button type="button" disabled={busy || !allReviewed} onClick={() => save('complete')} className={button}>Confirm Completed</button>}</>}
            {changed && <button type="button" disabled={busy} onClick={discard} className="min-h-11 px-3 text-sm underline">Discard unsaved changes</button>}
          </div>
          {reviewable && <p className="text-xs text-zinc-500">Give feedback for all six answers before sending your review.</p>}
          {editable && <p className="text-xs text-zinc-500">Answer all six questions before submitting. Your draft is visible only to you.</p>}
        </fieldset>
      </>}
      {busy && <p role="status" className="text-sm">Saving…</p>}
      {error && <div role="alert" className="text-sm text-red-600"><p>{error}</p><button type="button" disabled={busy} onClick={reload} className="mt-2 underline">Discard edits and reload latest version</button></div>}
    </div></FeedDialog>}
  </article>;
}
