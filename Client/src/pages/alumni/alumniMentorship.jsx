import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ClipboardList, Pencil } from 'lucide-react';
import DevelopmentShell from '../../components/student/DevelopmentShell';
import { FeedDialog } from '../../components/feed/FeedComposer';
import ProfileAvatar from '../../components/profile/ProfileAvatar';
import api from '../../utils/axios';
import { useAuth } from '../../context/useAuth';

const LEVELS = ['Developing', 'Practicing', 'Proficient', 'Advanced'];
const card = 'rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900';
const button = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#009639] px-4 text-xs font-semibold text-white hover:bg-[#007a2e] disabled:opacity-50';
const input = 'mt-2 w-full rounded-lg border border-zinc-200 bg-white p-3 text-sm outline-none focus:border-[#009639] dark:border-zinc-700 dark:bg-zinc-900';

export default function MentorCompetency() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState('');
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState({ rating: 3, feedback: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const pending = useRef(false);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await api.get('/development/mentees');
      setStudents(response.data.data || []);
      setSelected(previous => response.data.data.some(student => student.authId === previous) ? previous : response.data.data[0]?.authId || '');
    } catch (err) { setError(err.response?.data?.message || 'Unable to load connected students.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { Promise.resolve().then(load); }, [load]);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    if (!selected) return;
    Promise.resolve().then(async () => {
      if (!active) return;
      setDetailLoading(true); setDetails(null); setError('');
      try { const response = await api.get(`/development/mentees/${selected}/competencies`); if (active) setDetails(response.data.data); }
      catch (err) { if (active) setError(err.response?.data?.message || 'Unable to load the student assessment.'); }
      finally { if (active) setDetailLoading(false); }
    });
    return () => { active = false; };
  }, [selected, revision]);
  const save = async event => {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true; setSaving(true); setSaveError('');
    try {
      const response = await api.put(`/development/mentees/${editor.studentId}/competencies/${editor.key}`, form);
      setDetails(response.data.data); setEditor(null);
    } catch (err) { setSaveError(err.response?.data?.message || 'Unable to save your evaluation.'); }
    finally { pending.current = false; setSaving(false); }
  };
  const assess = item => {
    const own = details.competencies.mentorEvaluations.find(evaluation => evaluation.competencyKey === item.key && String(evaluation.mentorAuthId) === String(user?.authId || user?._id));
    setForm({ rating: own?.rating || 3, feedback: own?.feedback || '' }); setSaveError(''); setEditor({ ...item, studentId: selected });
  };
  return <DevelopmentShell title="Mentorship"><main className="mx-auto max-w-6xl space-y-5 p-3 sm:p-6"><header className="border-b border-zinc-200 pb-5 dark:border-zinc-800"><h1 className="text-2xl font-semibold tracking-tight">Mentor evaluations</h1><p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">Review connected students' technical, communication, and leadership skills.</p></header>
    {error && <p role="alert" className={`${card} p-4 text-sm text-red-600`}>{error} <button type="button" onClick={() => { load(); setRevision(value => value + 1); }} className="underline">Retry</button></p>}
    {loading ? <p role="status" className="p-5 text-sm text-zinc-500">Loading students...</p> : !students.length ? <section className={`${card} p-10 text-center`}><ClipboardList size={30} className="mx-auto text-zinc-400" /><h2 className="mt-3 text-sm font-semibold">No connected students yet</h2><p className="mt-2 text-xs leading-6 text-zinc-500">An accepted student connection is required before you can provide an evaluation.</p><Link to="/alumni/requests" className={`${button} mt-5`}>Review connection requests</Link></section> : <>
      <label className="block max-w-lg text-xs font-semibold">Student<select value={selected} disabled={saving} onChange={event => setSelected(event.target.value)} className={input}>{students.map(student => <option key={student.authId} value={student.authId}>{student.name} {student.program && `| ${student.program}`}</option>)}</select></label>
      {detailLoading ? <p role="status" className="p-5 text-sm text-zinc-500">Loading assessment...</p> : details && <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]"><section className="min-w-0 space-y-4"><div className={`${card} flex items-center gap-3 p-5`}><span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-50 text-[#009639] dark:bg-emerald-950"><ProfileAvatar user={details.student} /></span><div><h2 className="text-sm font-semibold">{details.student.name}</h2><p className="mt-1 text-xs text-zinc-500">{details.student.program}</p></div></div>
        {details.competencies.framework.map(item => {
          const self = details.competencies.assessments.find(assessment => assessment.key === item.key);
          const gap = details.competencies.gaps.find(assessment => assessment.key === item.key);
          return <article key={item.key} data-mentor-competency={item.key} className={`${card} p-5`}><h2 className="text-sm font-semibold">{item.name}</h2><p className="mt-2 text-xs leading-6 text-zinc-500">{item.description}</p><div className="mt-4 flex flex-wrap gap-3 text-xs"><span className="rounded-md bg-zinc-100 px-2 py-1 dark:bg-zinc-800">Student: {self ? `${LEVELS[self.rating - 1]} (${self.rating}/4)` : 'Not assessed'}</span><span className="rounded-md bg-zinc-100 px-2 py-1 dark:bg-zinc-800">Target: {gap.target}/4</span></div>{self?.evidence && <p className="mt-3 whitespace-pre-wrap break-words text-xs leading-6"><strong>Evidence: </strong>{self.evidence}</p>}{self?.goal && <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-6"><strong>Goal: </strong>{self.goal}</p>}
            {(details.competencies.mentorEvaluations || []).filter(evaluation => evaluation.competencyKey === item.key).map(evaluation => <div key={evaluation._id} className="mt-3 rounded-lg bg-zinc-50 p-3 text-xs dark:bg-zinc-800/50"><div className="flex flex-wrap justify-between gap-2"><strong>{evaluation.mentorName}</strong><span>{LEVELS[evaluation.rating - 1]} ({evaluation.rating}/4)</span></div><p className="mt-2 whitespace-pre-wrap break-words leading-6">{evaluation.feedback}</p></div>)}
            <button type="button" onClick={() => assess(item)} className={`${button} mt-4`}><Pencil size={13} />Evaluate skill</button>
          </article>;
        })}
      </section><aside className="space-y-4"><section className={`${card} p-5`}><h2 className="text-sm font-semibold">Evaluation guide</h2><ol className="mt-4 space-y-3">{LEVELS.map((label, index) => <li key={label} className="text-xs text-zinc-500">{index + 1}. {label}</li>)}</ol><p className="mt-4 text-xs leading-6 text-zinc-500">Give specific feedback based on work you have reviewed. Your evaluation is saved separately from the student's self-assessment.</p></section><section className={`${card} p-5`}><h2 className="text-sm font-semibold">Portfolio evidence</h2>{['projects', 'research', 'certifications'].map(key => <div key={key} className="mt-4"><h3 className="text-xs font-semibold capitalize">{key}</h3>{!details.portfolio[key]?.length ? <p className="mt-1 text-[11px] text-zinc-400">No saved entries</p> : <ul className="mt-2 space-y-3">{details.portfolio[key].map((entry, index) => <li key={index} className="break-words text-xs leading-5 text-zinc-500">{typeof entry === 'string' ? entry : entry.title}{entry.desc && <p className="mt-1 text-[11px]">{entry.desc}</p>}</li>)}</ul>}</div>)}</section></aside></div>}
    </>}
    {editor && <FeedDialog title={`Evaluate ${editor.name.toLowerCase()}`} busy={saving} onClose={() => setEditor(null)}><form onSubmit={save}><fieldset disabled={saving} className="space-y-4"><label className="block text-xs font-medium">Skill level<select value={form.rating} onChange={event => setForm({ ...form, rating: Number(event.target.value) })} className={input}>{LEVELS.map((label, index) => <option key={label} value={index + 1}>{index + 1}. {label}</option>)}</select></label><label className="block text-xs font-medium">Feedback *<textarea required rows={5} maxLength={2000} value={form.feedback} onChange={event => setForm({ ...form, feedback: event.target.value })} placeholder="Describe strengths, areas to improve, and a practical next step." className={input} /></label>{saveError && <p role="alert" className="text-xs text-red-600">{saveError}</p>}<div className="flex justify-end gap-2"><button type="button" onClick={() => setEditor(null)} className="rounded-lg px-4 py-2 text-xs">Cancel</button><button type="submit" className={button}><Check size={14} />{saving ? 'Saving...' : 'Save evaluation'}</button></div></fieldset></form></FeedDialog>}
  </main></DevelopmentShell>;
}
