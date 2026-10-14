import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, CheckCircle2, Send, Users } from 'lucide-react';
import api from '../../utils/axios';
import { FeedDialog } from '../feed/FeedComposer';
import { APPLICATION_STATUSES, REFERRAL_TYPES, applicationStatus, fieldStyle, primaryButton, referralDate, referralLink, referralType, secondaryButton } from './referralUi';

export function ReferralEditor({ item, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({ title: item?.title || '', organization: item?.organization || '', type: item?.type || 'job', description: item?.description || '', link: item?.link || '' }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const change = (key, value) => setForm(previous => ({ ...previous, [key]: value }));
  const submit = async event => {
    event.preventDefault();
    if (pending.current) return;
    if (!form.title.trim()) { setError('Please enter an opportunity title.'); return; }
    if (form.link && !referralLink(form.link)) { setError('Use a valid link starting with https:// or http://.'); return; }
    pending.current = true; setBusy(true); setError('');
    try {
      const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()]));
      const response = item ? await api.put(`/referrals/${item._id}`, payload) : await api.post('/referrals', payload);
      onSaved(response.data.data, !!item); onClose();
    } catch (err) { setError(err.response?.data?.message || 'Unable to publish your referral. Please try again.'); }
    finally { pending.current = false; setBusy(false); }
  };
  return <FeedDialog title={item ? 'Edit referral' : 'Share an opportunity'} busy={busy} onClose={onClose} wide>
    <p className="mb-5 text-sm leading-6 text-zinc-500 dark:text-zinc-400">Help someone take their next step. Share a job, internship, or scholarship with the university community.</p>
    <form onSubmit={submit}><fieldset disabled={busy} className="space-y-5">
      <div><p className="mb-2 text-xs font-semibold">Opportunity type</p><div className="grid grid-cols-3 gap-2">{REFERRAL_TYPES.map(type => <button key={type.key} type="button" aria-pressed={form.type === type.key} onClick={() => change('type', type.key)} className={`flex min-w-0 flex-col items-center gap-2 rounded-xl border p-3 text-xs font-semibold ${form.type === type.key ? `border-[#009639] ${type.style}` : 'border-zinc-200 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400'}`}>{createElement(type.icon, { size: 20 })}{type.singular}</button>)}</div></div>
      <label className="block text-xs font-semibold">Opportunity title *<input aria-label="Opportunity title" required maxLength={200} value={form.title} onChange={event => change('title', event.target.value)} placeholder="e.g. Junior Software Developer" className={fieldStyle} /></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className="block text-xs font-semibold">Organization<input aria-label="Organization" maxLength={200} value={form.organization} onChange={event => change('organization', event.target.value)} placeholder="Company, university, or foundation" className={fieldStyle} /></label><label className="block text-xs font-semibold">Official opportunity link <span className="font-normal text-zinc-400">(optional)</span><input aria-label="Official opportunity link" type="url" maxLength={2000} value={form.link} onChange={event => change('link', event.target.value)} placeholder="https://" className={fieldStyle} /></label></div>
      <label className="block text-xs font-semibold">Opportunity details<textarea aria-label="Opportunity details" rows={5} maxLength={10000} value={form.description} onChange={event => change('description', event.target.value)} placeholder="Describe the opportunity, requirements, eligibility, and any application deadline." className={`${fieldStyle} !h-auto py-3 leading-6`} /></label>
      <p className="rounded-xl bg-emerald-50 px-4 py-3 text-xs leading-6 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">Students can apply here in the portal. You can review their notes and update their application status.</p>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800"><button type="button" onClick={onClose} className={secondaryButton}>Cancel</button><button type="submit" className={primaryButton}>{busy ? 'Publishing…' : item ? 'Save changes' : 'Publish referral'}</button></div>
    </fieldset></form>
  </FeedDialog>;
}

export function ReferralDetails({ referral, application, canApply, initialApply = false, onClose, onApplied }) {
  const [applying, setApplying] = useState(initialApply);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const pending = useRef(false);
  const type = referralType(referral.type);
  const link = referralLink(referral.link);
  const submit = async event => {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const response = await api.post(`/referrals/${referral._id}/apply`, { note: note.trim() });
      onApplied({ ...response.data.data, referralTitle: referral.title, organization: referral.organization, type: referral.type });
      setSubmitted(true);
    } catch (err) { setError(err.response?.data?.message || 'Unable to submit your application. Please try again.'); }
    finally { pending.current = false; setBusy(false); }
  };
  return <FeedDialog title={submitted ? 'Application submitted' : applying ? 'Apply to this opportunity' : 'Opportunity details'} busy={busy} onClose={onClose} wide>
    {submitted ? <div className="py-5 text-center"><CheckCircle2 size={48} className="mx-auto text-[#009639]" /><h3 className="mt-4 text-xl font-semibold">Your next step is underway.</h3><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-500 dark:text-zinc-400">Your application for <strong className="text-zinc-800 dark:text-zinc-100">{referral.title}</strong> has been sent to the referrer. Track its status in My applications.</p><button type="button" onClick={onClose} className={`${primaryButton} mt-6`}>Done</button></div> : <>
      <div className={`mb-4 flex items-start gap-3 rounded-xl p-4 ${type.style}`}><span className="mt-1 shrink-0">{createElement(type.icon, { size: 24 })}</span><div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-wider">{type.singular}</p><h3 className="mt-1 break-words text-lg font-semibold">{referral.title}</h3><p className="mt-1 text-xs">{referral.organization || 'Alumni community'}</p></div></div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">Referred by {referral.authorName || 'an alumni community member'}{referral.createdAt && ` · ${referralDate(referral.createdAt)}`}</p>
      <h4 className="mb-2 mt-5 text-sm font-semibold">About this opportunity</h4><p className="whitespace-pre-wrap break-words text-sm leading-7 text-zinc-600 dark:text-zinc-300">{referral.description || 'The referrer has not provided further details.'}</p>
      {link && <a href={link} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#009639] dark:text-emerald-300">View official opportunity<ArrowUpRight size={15} /><span className="sr-only"> (opens in a new tab)</span></a>}
      {application ? <div className="mt-5 rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800"><p className="text-sm font-semibold">Application already submitted</p><p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{applicationStatus(application.status).label} · {referralDate(application.createdAt)}</p></div> : canApply && (applying ? <form onSubmit={submit} className="mt-6 border-t border-zinc-100 pt-5 dark:border-zinc-800"><fieldset disabled={busy}><label className="block text-sm font-semibold">A note to the referrer <span className="text-xs font-normal text-zinc-500">(optional)</span><textarea aria-label="Application note" value={note} onChange={event => setNote(event.target.value)} rows={3} maxLength={1000} placeholder="Introduce yourself and share why you are interested." className={`${fieldStyle} !h-auto py-3 leading-6`} /></label><p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Your profile name and email will be shared with the referrer.</p>{error && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}<div className="mt-5 flex flex-wrap justify-end gap-2"><button type="button" onClick={onClose} className={secondaryButton}>Cancel</button><button type="submit" className={primaryButton}><Send size={15} />{busy ? 'Submitting…' : 'Submit application'}</button></div></fieldset></form> : <div className="mt-6 flex justify-end"><button type="button" onClick={() => setApplying(true)} className={primaryButton}>Apply directly<ArrowUpRight size={15} /></button></div>)}
    </>}
  </FeedDialog>;
}

export function ReferralApplicants({ referral, onClose }) {
  const [applicants, setApplicants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const pending = useRef(false);
  const generation = useRef(0);
  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true); setError('');
    try { const response = await api.get(`/referrals/${referral._id}/applications`); if (request === generation.current) setApplicants(response.data.data || []); }
    catch (err) { if (request === generation.current) setError(err.response?.data?.message || 'Unable to load applicants.'); }
    finally { if (request === generation.current) setLoading(false); }
  }, [referral._id]);
  useEffect(() => { void load(); return () => { ++generation.current; }; }, [load]);
  const update = async (application, status) => {
    if (pending.current) return;
    pending.current = true; setBusy(application._id); setError(''); setMessage('');
    try {
      const response = await api.put(`/referrals/applications/${application._id}`, { status });
      setApplicants(previous => previous.map(item => item._id === application._id ? { ...item, ...response.data.data } : item));
      setMessage('Application status updated.');
    } catch (err) { setError(err.response?.data?.message || 'Unable to update application status.'); }
    finally { pending.current = false; setBusy(null); }
  };
  return <FeedDialog title="Review applicants" busy={busy !== null} onClose={onClose} wide>
    <p className="break-words text-sm font-semibold">{referral.title}</p><p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Read each applicant's note and keep them informed of their progress.</p>
    {error && <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">{error} <button type="button" onClick={load} disabled={busy !== null} className="underline">Retry</button></p>}{message && <p role="status" className="mt-4 text-xs text-[#009639] dark:text-emerald-300">{message}</p>}
    {loading ? <p role="status" className="py-10 text-center text-sm text-zinc-500">Loading applicants…</p> : !applicants.length && !error ? <div className="py-10 text-center"><Users size={28} className="mx-auto text-zinc-400" /><h3 className="mt-3 text-sm font-semibold">No applicants yet</h3><p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Applications will appear here when someone applies.</p></div> : <ul className="mt-5 space-y-3">{applicants.map(application => <li key={application._id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words text-sm font-semibold">{application.name || application.email}</h3><p className="mt-1 break-all text-xs text-zinc-500 dark:text-zinc-400">{application.email}</p><p className="mt-2 text-[11px] text-zinc-400">Applied {referralDate(application.createdAt)}</p></div><label className="text-[11px] font-medium">Application status<select aria-label={`Status for ${application.name || application.email}`} value={application.status} disabled={busy !== null} onChange={event => update(application, event.target.value)} className={`${fieldStyle} !mt-1 !h-9 !text-xs`}>{APPLICATION_STATUSES.map(status => <option value={status.key} key={status.key}>{status.label}</option>)}</select></label></div>{application.note && <p className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-zinc-50 p-3 text-xs leading-6 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{application.note}</p>}</li>)}</ul>}
  </FeedDialog>;
}
