import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import api from '../utils/axios';
import { FeedDialog } from '../components/feed/FeedComposer';

const levelLabel = level => ['Warning', 'Posting restriction', 'Communication restriction', 'Community restriction', 'Account suspension'][level - 1];
const date = value => new Date(value).toLocaleString();
export default function CommunityStatus() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [explanation, setExplanation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    try { const response = await api.get('/community/me'); setData(response.data.data); setError(''); window.dispatchEvent(new Event('community:refresh')); }
    catch (err) { setError(err.response?.data?.message || 'Unable to load account status.'); }
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  const view = async row => {
    setBusy(true); setError('');
    try { const response = await api.get(`/community/cases/${row._id}`); setSelected(response.data.data); setExplanation(''); }
    catch (err) { setError(err.response?.data?.message || 'Unable to load violation details.'); }
    finally { setBusy(false); }
  };
  const submit = async event => {
    event.preventDefault(); if (busy || !explanation.trim()) return;
    setBusy(true); setError('');
    try { await api.post(`/community/cases/${selected._id}/appeals`, { explanation }); setSelected(null); setMessage('Your appeal has been submitted for administrator review.'); await load(); }
    catch (err) { setError(err.response?.data?.message || 'Unable to submit appeal. Your explanation is saved here.'); }
    finally { setBusy(false); }
  };
  const active = (data?.restrictions || []).filter(row => new Date(row.expiresAt) > new Date());
  const severe = active.some(row => row.level >= 4);
  const accountPath = user?.role === 'admin' ? '/admin/settings' : `/${user?.role === 'student' ? 'student' : 'alumni'}/accounts`;
  return <main className="min-h-screen bg-zinc-50 px-3 py-8 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
    <div className="mx-auto max-w-4xl space-y-5">
      <nav className="flex flex-wrap gap-4 text-sm font-semibold text-brand">{!severe && <Link to="/feed">Back to feed</Link>}<Link to={accountPath}>Account settings</Link>{user?.role === 'admin' && <Link to="/admin/community">Community Moderation Center</Link>}</nav>
      <h1 className="text-2xl font-bold">Account Status</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">View community decisions, permitted features, and appeal status. Expired restrictions stop blocking automatically. Appeals do not extend a restriction.</p>
      <button onClick={load} disabled={busy} className="rounded-lg border px-3 py-2 text-sm">Refresh status</button>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}{message && <p role="status" className="text-sm text-brand">{message}</p>}
      {!data && !error && <p role="status">Loading account status...</p>}
      {active.map(row => <section key={row._id} className="rounded-2xl border border-amber-300 bg-white p-5 dark:border-amber-800 dark:bg-zinc-900">
        <h2 className="font-bold">{row.level === 5 ? 'Your Account Has Been Suspended' : row.level > 1 ? 'Your Account Has Been Temporarily Restricted' : 'Community Guidelines Warning'}</h2>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm">{row.reason}</p>
        <dl className="mt-3 space-y-2 text-sm"><div><dt className="font-semibold">Restriction</dt><dd>{levelLabel(row.level)}</dd></div><div><dt className="font-semibold">Expires</dt><dd>{date(row.expiresAt)}</dd></div><div><dt className="font-semibold">Duration</dt><dd>{Math.round((new Date(row.expiresAt) - new Date(row.startsAt)) / 3600000)} hours</dd></div></dl>
        <p className="mt-3 text-sm">{row.level === 1 ? 'Your features remain available.' : row.level === 2 ? 'Posting, editing posts, comments, and replies are restricted. Browsing and account access remain available.' : row.level === 3 ? 'Posting, messaging, calls, and new connection requests are restricted. You can still browse.' : 'Community interactions are restricted. You can access this notice, appeals, and account settings.'}</p>
        <button disabled={busy} onClick={() => view({ _id: row.caseId })} className="mt-4 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white">View Violation Details / Appeal Decision</button>
      </section>)}
      {data && !active.length && <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">You have no active community restrictions.</p>}
      <section id="my-reports" className="scroll-mt-5 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="font-bold">My reports</h2>
        {data?.reports?.map(row => <div key={row._id} className="mt-4 border-t border-zinc-100 pt-4 text-sm dark:border-zinc-800">
          <div className="flex flex-wrap justify-between gap-2"><strong>{row.reason}</strong><time>{date(row.createdAt)}</time></div>
          <p className="mt-2 capitalize">Status: {row.status.replaceAll('_', ' ')}</p>
          {row.adminNotes && <p className="mt-2 whitespace-pre-wrap break-words"><strong>Admin response: </strong>{row.adminNotes}</p>}
        </div>)}
        {data && !data.reports?.length && <p className="mt-3 text-sm text-zinc-500">You have not submitted any reports.</p>}
      </section>
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900"><h2 className="font-bold">Moderation history</h2>
        {data?.cases.map(row => <div key={row._id} className="mt-4 border-t border-zinc-100 pt-4 text-sm dark:border-zinc-800"><div className="flex flex-wrap justify-between gap-2"><strong className="capitalize">{row.category.replaceAll('_', ' ')} · {row.status.replaceAll('_', ' ')}</strong><time>{date(row.createdAt)}</time></div><p className="mt-2 whitespace-pre-wrap break-words">{row.explanation}</p><button disabled={busy} onClick={() => view(row)} className="mt-2 font-semibold text-brand">View details</button></div>)}
        {data && !data.cases.length && <p className="mt-3 text-sm text-zinc-500">No moderation cases.</p>}
      </section>
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900"><h2 className="font-bold">Your appeals</h2>{data?.appeals.map(row => <div key={row._id} className="mt-3 border-t pt-3 text-sm"><p className="capitalize">{row.status.replaceAll('_', ' ')} · {date(row.createdAt)}</p><p className="whitespace-pre-wrap break-words">{row.explanation}</p>{row.notes && <p className="mt-2">Administrator: {row.notes}</p>}</div>)}{data && !data.appeals.length && <p className="mt-3 text-sm text-zinc-500">No appeals submitted.</p>}</section>
    </div>
    {selected && <FeedDialog title="Violation Details" busy={busy} onClose={() => setSelected(null)}><div className="space-y-4 text-sm">
      <p className="capitalize font-semibold">{selected.category} · {selected.severity} · {selected.status.replaceAll('_', ' ')}</p><p>{selected.explanation}</p>
      {selected.evidence ? <section><h3 className="font-semibold">Submitted content</h3><p className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800">{selected.evidence.text || 'Image submission'}</p></section> : <p>The retained evidence has expired or is unavailable.</p>}
      {selected.decision === 'hold' && selected.status === 'dismissed' && <p>This content is cleared for resubmission. Submit it again from the original form; it has not been published automatically.</p>}
      {data && !data.appealsEnabled && <p>Appeals are currently unavailable. Contact an administrator for review.</p>}
      {data?.appealsEnabled && selected.status !== 'dismissed' && !data.appeals.some(row => row.caseId === selected._id) && <form onSubmit={submit} className="space-y-3"><label className="block font-semibold">Appeal explanation<textarea required maxLength={5000} rows={5} disabled={busy} value={explanation} onChange={event => setExplanation(event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-300 bg-transparent p-3 font-normal dark:border-zinc-700" /></label><p className="text-xs text-zinc-500">Explain why this decision is incorrect. Do not include passwords or unnecessary personal information.</p><button disabled={busy || !explanation.trim()} className="rounded-xl bg-brand px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? 'Submitting...' : 'Submit Appeal'}</button></form>}
      {error && <p role="alert" className="text-red-600">{error}</p>}
    </div></FeedDialog>}
  </main>;
}
