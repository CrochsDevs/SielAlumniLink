import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Pencil, MessageSquare } from 'lucide-react';
import AlumniSidebar from '../../layout/sidebar/alumni/alumniSidebar';
import AlumniTopbar from '../../layout/topbar/alumni/alumniTopbar';
import ProfileAvatar from '../../components/profile/ProfileAvatar';
import { FeedDialog } from '../../components/feed/FeedComposer';
import { useAuth } from '../../context/useAuth';
import { useChat } from '../../context/useChat.js';
import api from '../../utils/axios';

const LEVELS = ['Developing', 'Practicing', 'Proficient', 'Advanced'];
const REVIEW_PROMPTS = {
  technical: 'Review how this student uses tools, solves problems in their field, and completes technical tasks.',
  communication: 'Review how this student explains ideas, listens, and adapts their message to an audience.',
  leadership: 'Review how this student takes initiative, supports teammates, and coordinates work.',
};
const card = 'rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900';
const button = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#009639] px-4 text-xs font-semibold text-white disabled:opacity-50';
const input = 'mt-2 w-full rounded-lg border border-zinc-200 bg-white p-3 text-sm outline-none focus:border-[#009639] dark:border-zinc-700 dark:bg-zinc-900';
const level = value => value ? `${LEVELS[value - 1]} (${value}/4)` : 'Not evaluated';
const date = value => new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

function StudentEvaluationWorkspace({ studentId }) {
  const { user } = useAuth(), { openChatByEmail } = useChat();
  const [sidebarOpen, setSidebarOpen] = useState(false), [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [editor, setEditor] = useState(null), [saving, setSaving] = useState(false), [saveError, setSaveError] = useState('');
  const [form, setForm] = useState({ rating: '', feedback: '', observedEvidence: '', nextStep: '' });
  const [notice, setNotice] = useState(''), [messaging, setMessaging] = useState(false);
  const posting = useRef(false), active = useRef(false);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await api.get(`/development/mentees/${studentId}/competencies`);
      if (response.data.data?.student?.authId !== studentId) throw new Error('The student evaluation could not be verified.');
      if (active.current) setDetails(response.data.data);
    } catch (err) { if (active.current) { setDetails(null); setError(err.response?.data?.message || err.message || 'Unable to load this student.'); } }
    finally { if (active.current) setLoading(false); }
  }, [studentId]);
  useEffect(() => { active.current = true; Promise.resolve().then(load); return () => { active.current = false; }; }, [load]);
  const mentorId = String(user?.authId || user?._id);
  const ownEvaluations = details?.competencies.mentorEvaluations.filter(item => String(item.mentorAuthId) === mentorId) || [];
  const assess = item => {
    const own = ownEvaluations.find(evaluation => evaluation.competencyKey === item.key);
    setForm({ rating: own?.rating || '', feedback: own?.feedback || '', observedEvidence: own?.observedEvidence || '', nextStep: own?.nextStep || '' });
    setSaveError(''); setNotice('');
    setEditor({ ...item, studentId, studentName: details.student.name, studentEmail: details.student.email });
  };
  const save = async event => {
    event.preventDefault(); if (posting.current) return;
    posting.current = true; setSaving(true); setSaveError('');
    const recipient = editor;
    try {
      const response = await api.put(`/development/mentees/${recipient.studentId}/competencies/${recipient.key}`, form);
      if (response.data.data?.student?.authId !== recipient.studentId) throw new Error('The saved evaluation belongs to a different student. Please reload.');
      if (active.current) { setDetails(response.data.data); setEditor(null); setNotice(`${recipient.name} evaluation saved for ${recipient.studentName}.`); }
    } catch (err) { if (active.current) setSaveError(err.response?.data?.message || err.message || 'Unable to save your evaluation.'); }
    finally { posting.current = false; if (active.current) setSaving(false); }
  };
  const message = async () => {
    if (messaging) return;
    setMessaging(true);
    try { await openChatByEmail(details.student.email); }
    catch { if (active.current) setError('Unable to open the student conversation. Please try again.'); }
    finally { if (active.current) setMessaging(false); }
  };
  return <div className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
    <AlumniSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} /><div className="lg:pl-64"><AlumniTopbar user={user} title="Student evaluation" onMenuClick={() => setSidebarOpen(true)} />
      <main className="mx-auto max-w-6xl space-y-5 p-3 sm:p-6">
        <Link to="/alumni/mentorship" className="inline-flex items-center gap-2 text-xs text-zinc-500"><ArrowLeft size={14} />Back to my students</Link>
        <header className="border-b border-zinc-200 pb-5 dark:border-zinc-800"><p className="text-[10px] font-semibold uppercase tracking-wider text-[#007a2e] dark:text-emerald-300">Student evaluation</p><h1 className="mt-2 break-words text-2xl font-semibold tracking-tight">{details ? `Evaluate ${details.student.name}` : 'Student evaluation'}</h1><p className="mt-2 text-sm leading-6 text-zinc-500">Review this student's evidence and record your evaluation for each skill area.</p></header>
        {error && <p role="alert" className={`${card} p-4 text-sm text-red-600`}>{error} <button type="button" onClick={load} className="underline">Retry</button></p>}
        {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">{notice}</p>}
        {loading ? <p role="status" className="p-8 text-sm text-zinc-500">Loading this student's assessment...</p> : details && <>
          <section data-evaluation-student={studentId} className={`${card} flex flex-wrap items-center gap-4 p-5`}><span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-50 text-[#009639] dark:bg-emerald-950"><ProfileAvatar user={details.student} /></span><div className="min-w-0 flex-1"><h2 className="break-words text-sm font-semibold">{details.student.name}</h2><p className="mt-1 text-xs text-zinc-500">{details.student.program || 'Program not provided'}</p><p className="mt-1 break-words text-[11px] text-zinc-500">{details.student.email}</p></div><div className="text-xs text-zinc-500">Your evaluations: <strong className="text-zinc-900 dark:text-zinc-100">{ownEvaluations.length}/{details.competencies.framework.length}</strong></div><button type="button" disabled={messaging} onClick={message} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-zinc-300 px-3 text-xs font-semibold disabled:opacity-40 dark:border-zinc-700"><MessageSquare size={14} />Message student</button></section>
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]"><section className="min-w-0 space-y-4">{details.competencies.framework.map(item => {
            const self = details.competencies.assessments.find(assessment => assessment.key === item.key);
            const own = ownEvaluations.find(evaluation => evaluation.competencyKey === item.key);
            const gap = details.competencies.gaps.find(assessment => assessment.key === item.key);
            return <article key={item.key} data-mentor-competency={item.key} className={`${card} p-5`}><h2 className="text-sm font-semibold">{item.name}</h2><p className="mt-2 text-xs leading-6 text-zinc-500">{item.description}</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/50"><p className="text-[10px] text-zinc-500">Student self-assessment</p><p className="mt-1 text-xs font-semibold">{self ? level(self.rating) : 'Not assessed'}</p></div><div className="rounded-lg bg-emerald-50/70 p-3 dark:bg-emerald-950/30"><p className="text-[10px] text-zinc-500">Your mentor evaluation</p><p className="mt-1 text-xs font-semibold">{level(own?.rating)}</p>{own && <p className="mt-1 text-[10px] text-zinc-500">Updated {date(own.updatedAt)}</p>}</div></div><p className="mt-3 text-[11px] text-zinc-500">Student target: {gap.target}/4{gap.gap !== null && ` · Current skill gap: ${gap.gap} ${gap.gap === 1 ? 'level' : 'levels'}`}</p>
              {self?.evidence && <div className="mt-4 text-xs leading-6"><h3 className="font-semibold">{details.student.name}'s evidence</h3><p className="mt-1 whitespace-pre-wrap break-words text-zinc-500">{self.evidence}</p></div>}{self?.goal && <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-6"><strong>Student's goal: </strong>{self.goal}</p>}
              {details.competencies.mentorEvaluations.filter(evaluation => evaluation.competencyKey === item.key).map(evaluation => <div key={evaluation._id} className="mt-4 space-y-2 rounded-lg border border-zinc-100 p-3 text-xs dark:border-zinc-800"><div className="flex flex-wrap justify-between gap-2"><strong>{String(evaluation.mentorAuthId) === mentorId ? 'Your feedback' : evaluation.mentorName}</strong><span className="text-zinc-500">{level(evaluation.rating)}</span></div><p className="whitespace-pre-wrap break-words leading-6">{evaluation.feedback}</p>{evaluation.observedEvidence && <p className="whitespace-pre-wrap break-words leading-6"><strong>Work reviewed: </strong>{evaluation.observedEvidence}</p>}{evaluation.nextStep && <p className="whitespace-pre-wrap break-words leading-6"><strong>Next step: </strong>{evaluation.nextStep}</p>}</div>)}
              <button type="button" onClick={() => assess(item)} className={`${button} mt-4`}><Pencil size={13} />Evaluate skill</button></article>;
          })}</section><aside className="space-y-4"><section className={`${card} p-5`}><h2 className="text-sm font-semibold">Evaluation guide</h2><ol className="mt-4 space-y-3">{LEVELS.map((label, index) => <li key={label} className="text-xs text-zinc-500">{index + 1}. {label}</li>)}</ol><p className="mt-4 text-xs leading-6 text-zinc-500">Base your rating on this student's work or mentoring sessions. Include observations and a practical next step. Skill gaps use the latest mentor evaluation and the student's target.</p></section><section className={`${card} p-5`}><h2 className="text-sm font-semibold">{details.student.name}'s portfolio evidence</h2>{['projects', 'research', 'certifications'].map(key => <div key={key} className="mt-4"><h3 className="text-xs font-semibold capitalize">{key}</h3>{!details.portfolio[key]?.length ? <p className="mt-1 text-[11px] text-zinc-400">No saved entries</p> : <ul className="mt-2 space-y-3">{details.portfolio[key].map((entry, index) => <li key={index} className="break-words text-xs leading-5 text-zinc-500">{typeof entry === 'string' ? entry : entry.title}{entry.desc && <p className="mt-1 text-[11px]">{entry.desc}</p>}</li>)}</ul>}</div>)}</section></aside></div>
        </>}
        {editor && <FeedDialog title={`Evaluate ${editor.studentName}`} busy={saving} onClose={() => setEditor(null)}><form onSubmit={save}><fieldset disabled={saving} className="space-y-4"><div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800"><p className="text-sm font-semibold">{editor.name}</p><p className="mt-1 break-words text-xs text-zinc-500">{editor.studentName} · {editor.studentEmail}</p><p className="mt-2 text-xs leading-6 text-zinc-500">{REVIEW_PROMPTS[editor.key]}</p></div><label className="block text-xs font-medium">Observed skill level *<select required value={form.rating} onChange={event => setForm({ ...form, rating: event.target.value ? Number(event.target.value) : '' })} className={input}><option value="">Select an observed level</option>{LEVELS.map((label, index) => <option key={label} value={index + 1}>{index + 1}. {label}</option>)}</select></label><label className="block text-xs font-medium">Feedback for {editor.studentName} *<textarea name="feedback" required rows={4} maxLength={2000} value={form.feedback} onChange={event => setForm({ ...form, feedback: event.target.value })} placeholder="Describe this student's strengths and areas to improve." className={input} /></label><label className="block text-xs font-medium">Work reviewed / observation<textarea name="observedEvidence" rows={3} maxLength={2000} value={form.observedEvidence} onChange={event => setForm({ ...form, observedEvidence: event.target.value })} placeholder="Name the project, presentation, or mentoring task you reviewed." className={input} /></label><label className="block text-xs font-medium">Recommended next step<textarea name="nextStep" rows={3} maxLength={1000} value={form.nextStep} onChange={event => setForm({ ...form, nextStep: event.target.value })} placeholder="Give this student a specific task or learning goal." className={input} /></label>{saveError && <p role="alert" className="text-xs text-red-600">{saveError}</p>}<div className="flex justify-end gap-2"><button type="button" onClick={() => setEditor(null)} className="rounded-lg px-4 py-2 text-xs">Cancel</button><button type="submit" className={button}><Check size={14} />{saving ? 'Saving...' : 'Save evaluation'}</button></div></fieldset></form></FeedDialog>}
      </main>
    </div>
  </div>;
}

export default function StudentEvaluation() {
  const { studentId } = useParams();
  const id = studentId.toLowerCase();
  return <StudentEvaluationWorkspace key={id} studentId={id} />;
}
