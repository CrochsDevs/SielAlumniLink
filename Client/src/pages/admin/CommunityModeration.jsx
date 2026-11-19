import FeedImages from '../../components/feed/FeedImages';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/useAuth';
import api from '../../utils/axios';
import AdminSidebar from '../../layout/sidebar/admin/adminSidebar';
import AdminTopbar from '../../layout/topbar/alumni/adminTopbar';
import { FeedDialog } from '../../components/feed/FeedComposer';

const field = 'mt-1 w-full rounded-xl border border-zinc-300 bg-transparent p-2 text-sm dark:border-zinc-700 dark:[&>option]:bg-zinc-900';
const button = 'rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold text-brand disabled:opacity-50 dark:border-zinc-700';
const date = value => new Date(value).toLocaleString();
const label = value => String(value || '').replaceAll('_', ' ');
const levels = ['Warning', 'Posting restriction', 'Communication restriction', 'Full community restriction', 'Account suspension'];
const categories = ['spam', 'phishing', 'fraud', 'harassment', 'hate', 'violence', 'sexual', 'impersonation', 'malware', 'unauthorized', 'other'];
function Badge({ value }) { return <span className={`inline-block rounded-full px-2 py-1 text-xs font-semibold capitalize ${['critical', 'confirmed', 'rejected'].includes(value) ? 'bg-red-100 text-red-800' : ['pending', 'under_review', 'medium'].includes(value) ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{label(value)}</span>; }

function PolicySettings({ onError, onSuccess }) {
  const [policy, setPolicy] = useState(null);
  const [provider, setProvider] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    api.get('/community/admin/settings', { signal: controller.signal }).then(({ data }) => { setPolicy(data.data.policy); setProvider(data.data.provider); }).catch(error => { if (!controller.signal.aborted) onError(error.response?.data?.message || 'Unable to load moderation settings.'); });
    return () => controller.abort();
  }, [onError]);
  const save = async event => {
    event.preventDefault(); setBusy(true); onError('');
    try { const { data } = await api.put('/community/admin/settings', policy); setPolicy(data.data); onSuccess('Moderation settings saved.'); }
    catch (error) { onError(error.response?.data?.message || 'Unable to save settings.'); }
    finally { setBusy(false); }
  };
  if (!policy) return <p role="status">Loading policy...</p>;
  const update = (key, value) => setPolicy(previous => ({ ...previous, [key]: value }));
  return <form onSubmit={save} className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
    <h2 className="font-bold">Moderation Settings</h2>
    <p className="text-sm">AI provider: {provider?.provider} / {provider?.model} · {provider?.configured ? 'Key configured; review last successful request below.' : 'Not configured. Only automated rules are operational.'}</p>
    <p className="text-xs text-zinc-500">Last provider success: {provider?.lastSuccessAt ? date(provider.lastSuccessAt) : 'No successful request observed in this server process'}. Last failure: {provider?.lastFailureAt ? date(provider.lastFailureAt) : 'None observed'}. Scores are model signals, not calibrated probabilities.</p>
    <fieldset disabled={busy} className="space-y-5">
      <fieldset><legend className="mb-2 text-sm font-semibold">Enabled violation categories</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{categories.map(category => <label key={category} className="flex items-center gap-2 text-sm capitalize"><input type="checkbox" checked={policy.enabledCategories.includes(category)} onChange={event => update('enabledCategories', event.target.checked ? [...policy.enabledCategories, category] : policy.enabledCategories.filter(item => item !== category))} />{category}</label>)}</div></fieldset>
      <div className="grid gap-3 sm:grid-cols-3">{[['reviewThreshold', 'Review threshold'], ['blockThreshold', 'Block threshold'], ['criticalThreshold', 'Critical threshold']].map(([key, title]) => <label key={key} className="text-sm">{title}<input className={field} type="number" min="0.5" max="1" step="0.001" required value={policy[key]} onChange={event => update(key, Number(event.target.value))} /></label>)}</div>
      <p className="text-xs text-zinc-500">Uncertain content is held without a strike. Disabling automatic blocking sends all detections to review. Automatic restrictions never suspend accounts and never exceed 30 days.</p>
      <div className="space-y-2">{[['automaticBlocking', 'Block high-confidence violations automatically'], ['automaticRestrictions', 'Apply configured automatic strike restrictions'], ['appealsEnabled', 'Allow user appeals'], ['notificationsEnabled', 'Send moderation notifications']].map(([key, title]) => <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={policy[key]} onChange={event => update(key, event.target.checked)} />{title}</label>)}</div>
      <fieldset><legend className="text-sm font-semibold">Strike escalation</legend><div className="mt-2 space-y-3">{policy.durations.map((days, index) => <div key={index} className="grid grid-cols-[1fr_1fr] gap-3 sm:grid-cols-[80px_1fr_120px]"><p className="self-center text-sm">Strike {index + 1}{index === 4 ? '+' : ''}</p><label className="text-xs">Restriction<select className={field} value={policy.strikeLevels[index]} onChange={event => update('strikeLevels', policy.strikeLevels.map((level, i) => i === index ? Number(event.target.value) : level))}>{levels.slice(0, 4).map((name, i) => <option value={i + 1} key={name}>{name}</option>)}</select></label><label className="text-xs">Duration (days)<input type="number" min="1" max="30" required className={field} value={days} onChange={event => update('durations', policy.durations.map((duration, i) => i === index ? Number(event.target.value) : duration))} /></label></div>)}</div></fieldset>
      <label className="block text-sm">Verified malicious domains (one per line)<textarea rows={4} className={field} value={policy.maliciousHosts.join('\n')} onChange={event => update('maliciousHosts', event.target.value.split('\n').map(value => value.trim().toLowerCase()).filter(Boolean))} /><span className="mt-1 block text-xs text-zinc-500">Only add domains verified as malicious. A match can produce a confirmed violation.</span></label>
      <label className="block text-sm">Evidence retention (days)<input type="number" min="7" max="365" required className={field} value={policy.evidenceDays} onChange={event => update('evidenceDays', Number(event.target.value))} /></label>
      <button disabled={busy} className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving...' : 'Save Policy'}</button>
    </fieldset>
  </form>;
}

export default function CommunityModeration() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tab, setTab] = useState('queue');
  const [status, setStatus] = useState('');
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState(null);
  const [appeal, setAppeal] = useState(null);
  const [notes, setNotes] = useState('');
  const [level, setLevel] = useState(1);
  const [days, setDays] = useState(1);
  const [category, setCategory] = useState('other');
  const [severity, setSeverity] = useState('medium');
  const [removeContent, setRemoveContent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(async (before, signal) => {
    setLoading(true);
    try {
      const [metrics, result] = await Promise.all([api.get('/community/admin/stats', { signal }), tab === 'settings' ? Promise.resolve(null)
        : api.get(`/community/admin/${tab === 'queue' ? 'cases' : tab === 'appeals' ? 'appeals' : 'audit'}`, { params: { before, status: tab === 'queue' ? status || undefined : undefined }, signal })]);
      if (signal?.aborted) return;
      setStats(metrics.data.data);
      if (result) { const data = result.data.data, items = data.cases || data.appeals || data.events; setRows(previous => before ? [...previous, ...items] : items); setCursor(data.nextCursor); }
      setError('');
    } catch (err) { if (!signal?.aborted) setError(err.response?.data?.message || 'Unable to load community moderation.'); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [tab, status]);
  useEffect(() => { const controller = new AbortController(); Promise.resolve().then(() => { if (!controller.signal.aborted) void load(undefined, controller.signal); }); return () => controller.abort(); }, [load]);
  const view = async id => {
    setBusy(true); setError(''); setMessage('');
    try { const { data } = await api.get(`/community/admin/cases/${id}`); setSelected(data.data); setNotes(''); setCategory(data.data.category); setSeverity(data.data.severity); setRemoveContent(false); setLevel(1); setDays(1); }
    catch (err) { setError(err.response?.data?.message || 'Unable to load case.'); }
    finally { setBusy(false); }
  };
  const userHistory = async userId => {
    setBusy(true);
    try { const { data } = await api.get(`/community/admin/users/${userId}`); setHistory(data.data); }
    catch (err) { setError(err.response?.data?.message || 'Unable to load account history.'); }
    finally { setBusy(false); }
  };
  const act = async (path, body, method = 'patch') => {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await api[method](`/community/admin/${path}`, body);
      setMessage('Moderation decision recorded.');
      if (selected) { const { data } = await api.get(`/community/admin/cases/${selected._id}`); setSelected(data.data); }
      if (appeal) setAppeal(null);
      await load();
    } catch (err) { setError(err.response?.data?.message || 'Unable to save decision. Reload and try again.'); }
    finally { setBusy(false); }
  };
  const review = next => act(`cases/${selected._id}`, { status: next, notes, category, severity, level, durationDays: days, removeContent });
  return <div className="min-h-screen bg-[#f3f6f3] text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
    <AdminSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />
    <div className="lg:pl-64"><AdminTopbar user={user} title="Community Moderation Center" onMenuClick={() => setSidebarOpen(true)} />
      <main className="workspace-page mx-auto max-w-7xl space-y-5 p-3 sm:p-6">
        <h1 className="text-xl font-bold">Community Moderation Center</h1>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">{[['reports', 'Total Reports'], ['detected', 'Detected Violations'], ['pending', 'Pending Reviews'], ['activeRestrictions', 'Active Restrictions'], ['suspended', 'Suspended Accounts'], ['pendingAppeals', 'Pending Appeals'], ['resolved', 'Resolved Cases']].map(([key, title]) => <section key={key} className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"><h2 className="text-xs">{title}</h2><p className="mt-2 text-2xl font-bold">{stats?.[key] ?? '—'}</p></section>)}</div>
        {stats && <p className="text-sm text-zinc-600 dark:text-zinc-400">AI: {stats.provider.configured ? stats.provider.lastSuccessAt ? `Last successful analysis ${date(stats.provider.lastSuccessAt)}` : 'Key configured; awaiting a successful analysis' : 'Not configured. Deterministic checks and manual review are available.'}</p>}
        <nav aria-label="Moderation views" className="flex flex-wrap gap-2">{[['queue', 'Moderation Queue'], ['appeals', 'Appeals'], ['settings', 'Settings'], ['audit', 'Audit Log']].map(([key, title]) => <button key={key} onClick={() => { setTab(key); setRows([]); setCursor(null); }} aria-pressed={tab === key} className={`${button} ${tab === key ? 'bg-brand/10' : ''}`}>{title}</button>)}<button disabled={loading} onClick={() => load()} className={button}>{loading ? 'Loading...' : 'Refresh'}</button></nav>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}{message && <p role="status" className="text-sm text-brand">{message}</p>}
        {tab === 'settings' ? <PolicySettings onError={setError} onSuccess={setMessage} /> : <>
          {tab === 'queue' && <label className="block max-w-xs text-sm">Case status<select value={status} onChange={event => { setStatus(event.target.value); setRows([]); }} className={field}><option value="">All statuses</option>{['pending', 'under_review', 'confirmed', 'dismissed'].map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label>}
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"><table className="w-full text-left text-sm"><thead><tr>{(tab === 'queue' ? ['User', 'Content', 'Violation', 'Severity', 'Detection', 'Confidence', 'Date', 'Status', 'Action'] : tab === 'appeals' ? ['User', 'Explanation', 'Submitted', 'Status', 'Action'] : ['Actor', 'Action', 'Target', 'Notes', 'Date']).map(title => <th className="whitespace-nowrap p-3" key={title}>{title}</th>)}</tr></thead><tbody>
            {rows.map(row => <tr key={row._id} className="border-t border-zinc-100 dark:border-zinc-800">{tab === 'queue' ? <><td className="p-3"><button disabled={busy} onClick={() => userHistory(row.userId)} className="font-semibold text-brand">{row.user.name}</button></td><td className="min-w-52 max-w-xs p-3"><p className="line-clamp-3 break-words">{row.preview || row.explanation}</p><span className="text-xs capitalize text-zinc-500">{label(row.type)}</span></td><td className="p-3 capitalize">{row.category}</td><td className="p-3"><Badge value={row.severity} /></td><td className="p-3 capitalize">{label(row.detection)}</td><td className="p-3">{row.confidence === null ? '—' : `${(row.confidence * 100).toFixed(1)}%`}</td><td className="whitespace-nowrap p-3">{date(row.createdAt)}</td><td className="p-3"><Badge value={row.status} /></td><td className="p-3"><button disabled={busy} onClick={() => view(row._id)} className="font-semibold text-brand">Review</button></td></> : tab === 'appeals' ? <><td className="p-3">{row.user.name}</td><td className="max-w-xs p-3"><p className="line-clamp-3 break-words">{row.explanation}</p></td><td className="whitespace-nowrap p-3">{date(row.createdAt)}</td><td className="p-3"><Badge value={row.status} /></td><td className="p-3"><button disabled={busy} onClick={() => { setAppeal(row); setNotes(''); setError(''); }} className="font-semibold text-brand">Review Appeal</button></td></> : <><td className="p-3 font-mono text-xs">{row.actorId}</td><td className="p-3 capitalize">{label(row.action)}</td><td className="p-3 font-mono text-xs">{row.targetId}</td><td className="max-w-sm break-words p-3">{row.notes}</td><td className="whitespace-nowrap p-3">{date(row.at)}</td></>}</tr>)}
          </tbody></table>{!loading && !rows.length && <p className="p-5 text-sm">No records in this view.</p>}</div>
          {cursor && <button disabled={loading} className={button} onClick={() => load(cursor)}>Load more</button>}
        </>}
      </main>
    </div>
    {selected && <FeedDialog title="Review Moderation Case" busy={busy} onClose={() => setSelected(null)} wide><div className="space-y-4 text-sm">
      <div className="flex flex-wrap gap-2"><Badge value={selected.status} /><Badge value={selected.severity} /></div>
      <p><strong>Member:</strong> {selected.user.name} · {selected.user.email} <button disabled={busy} onClick={() => userHistory(selected.userId)} className="ml-2 text-brand underline">View moderation history</button></p>
      <p><strong>Detection:</strong> {label(selected.detection)} · Score {selected.confidence ?? 'unavailable'}</p><p className="whitespace-pre-wrap break-words">{selected.explanation}</p>
      {selected.signals?.map((signal, index) => <p className="text-xs text-zinc-500" key={index}>{signal.explanation} ({signal.score})</p>)}
      <section className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700"><h3 className="font-semibold">Submitted evidence</h3>{selected.evidence ? <><p className="mt-2 whitespace-pre-wrap break-words">{selected.evidence.text || 'Image submission'}</p><div className="mt-3 grid grid-cols-2 gap-2">{selected.evidence.imageIndexes.map(index => <img key={index} alt={`Moderation evidence ${index + 1}`} className="max-h-64 w-full rounded-lg object-contain" src={new URL(`/api/community/admin/cases/${selected._id}/images/${index}`, new URL(api.defaults.baseURL, window.location.origin)).href} />)}</div><p className="mt-2 text-xs text-zinc-500">Evidence expires {date(selected.evidence.expiresAt)}.</p></> : <p>Evidence expired or unavailable.</p>}</section>
      {selected.originalContent && <section className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700"><h3 className="font-semibold">Current original content</h3><p className="mt-2 font-semibold">{selected.originalContent.title}</p><p className="whitespace-pre-wrap break-words">{selected.originalContent.text || (selected.originalContent.unavailable ? 'Content has been removed from visibility.' : '')}</p>{selected.originalContent.attachmentName && <p className="mt-2 text-xs">Attachment: {selected.originalContent.attachmentName}</p>}{!selected.originalContent.unavailable && <FeedImages images={selected.originalContent.images} />}</section>}
      {selected.report && <section className="rounded-xl border p-3"><h3 className="font-semibold">Confidential user report</h3><p>Reporter ID: {selected.report.reporterId}</p><p>{selected.report.reason}</p><p className="whitespace-pre-wrap break-words">{selected.report.description}</p>{selected.report.snapshot?.original && <div className="mt-3 rounded-lg border p-3"><p className="font-semibold">{selected.report.snapshot.original.title}</p><p className="whitespace-pre-wrap break-words">{selected.report.snapshot.original.body}</p></div>}<FeedImages images={[...(selected.report.snapshot?.images || []), ...(selected.report.snapshot?.original?.images || [])].map(image => ({ ...image, url: `/api/feed/post-reports/${selected.reportId}/images/${image.id}` }))} /><p className="mt-2 text-xs">A report alone does not prove a violation.</p></section>}
      {selected.status !== 'dismissed' && <fieldset disabled={busy} className="space-y-3">
        <label className="block">Administrator explanation<textarea required maxLength={2000} rows={3} value={notes} onChange={event => setNotes(event.target.value)} className={field} /></label>
        {['under_review', 'confirmed'].includes(selected.status) && <>
          <div className="grid gap-3 sm:grid-cols-2"><label>Violation category<select className={field} value={category} onChange={event => setCategory(event.target.value)}>{categories.map(value => <option key={value}>{value}</option>)}</select></label><label>Severity<select className={field} value={severity} onChange={event => setSeverity(event.target.value)}>{['low', 'medium', 'high', 'critical'].map(value => <option key={value}>{value}</option>)}</select></label><label>Restriction level<select className={field} value={level} onChange={event => setLevel(Number(event.target.value))}>{levels.map((title, index) => <option key={title} value={index + 1}>{index + 1} · {title}</option>)}</select></label><label>Duration (days, up to 365)<input type="number" min="0.0416666667" max="365" step="any" value={days} onChange={event => setDays(Number(event.target.value))} className={field} /><span className="mt-1 flex flex-wrap gap-2">{[1, 3, 7, 14, 30].map(value => <button type="button" key={value} onClick={() => setDays(value)} className="text-xs text-brand underline">{value}d</button>)}</span></label></div>
          {selected.targetId && ['post', 'comment', 'message', 'profile'].includes(selected.type) && <label className="flex items-center gap-2"><input type="checkbox" checked={removeContent} onChange={event => setRemoveContent(event.target.checked)} />Remove the original content when confirming this violation</label>}
        </>}
        <div className="flex flex-wrap gap-2">{selected.status === 'pending' && <button disabled={!notes.trim()} className={button} onClick={() => review('under_review')}>Mark Under Review</button>}{selected.status === 'under_review' && <button disabled={!notes.trim() || days <= 0} className={button} onClick={() => review('confirmed')}>Confirm Violation</button>}{selected.status === 'confirmed' && selected.needsReview && <button disabled={!notes.trim()} className={button} onClick={() => review('confirmed')}>Confirm Existing Decision</button>}{selected.status === 'confirmed' && <button disabled={!notes.trim() || days <= 0} className={button} onClick={() => act(`cases/${selected._id}/restrictions`, { notes, level, durationDays: days }, 'post')}>Apply / Change Restriction</button>}<button disabled={!notes.trim()} className={button} onClick={() => review('dismissed')}>{selected.status === 'confirmed' ? 'Overturn Violation and Restore' : 'Dismiss Detection'}</button></div>
      </fieldset>}
      <section><h3 className="font-semibold">Restrictions</h3>{selected.restrictions.map(row => <div key={row._id} className="mt-2 rounded-lg border p-3"><p>{levels[row.level - 1]} · {row.revokedAt ? 'Revoked' : new Date(row.expiresAt) <= new Date() ? 'Expired' : 'Active'} · Expires {date(row.expiresAt)}</p>{!row.revokedAt && new Date(row.expiresAt) > new Date() && <button disabled={busy || !notes.trim()} onClick={() => act(`restrictions/${row._id}/restore`, { notes })} className="mt-2 font-semibold text-brand">Restore functionality (requires explanation)</button>}</div>)}</section>
      <section><h3 className="font-semibold">Decision history</h3>{selected.history.map((entry, index) => <p key={index} className="mt-2 whitespace-pre-wrap break-words text-xs">{label(entry.action)} · {date(entry.at)} · {entry.by}<br />{entry.notes}</p>)}</section>
      {error && <p role="alert" className="text-red-600">{error}</p>}{message && <p role="status">{message}</p>}
    </div></FeedDialog>}
    {appeal && <FeedDialog title="Review Appeal" busy={busy} onClose={() => setAppeal(null)}><div className="space-y-4 text-sm"><p><strong>{appeal.user.name}</strong></p><Badge value={appeal.status} /><p className="whitespace-pre-wrap break-words">{appeal.explanation}</p><button disabled={busy} className={button} onClick={() => { const id = appeal.caseId; setAppeal(null); void view(id); }}>View original case</button><label className="block">Decision explanation<textarea rows={4} maxLength={2000} value={notes} onChange={event => setNotes(event.target.value)} className={field} /></label><div className="flex flex-wrap gap-2">{(appeal.status === 'pending' ? ['under_review'] : appeal.status === 'under_review' ? ['approved', 'rejected'] : []).map(next => <button key={next} disabled={busy || !notes.trim()} className={button} onClick={() => act(`appeals/${appeal._id}`, { status: next, notes })}>{next === 'under_review' ? 'Mark Under Review' : next === 'approved' ? 'Approve and Restore' : 'Reject Appeal'}</button>)}</div><p className="text-xs text-zinc-500">Approval removes this case's strike and restrictions. Rejection keeps the original expiry.</p>{error && <p role="alert" className="text-red-600">{error}</p>}</div></FeedDialog>}
    {history && <FeedDialog title="User Moderation History" busy={busy} onClose={() => setHistory(null)} wide><div className="space-y-4 text-sm"><p className="font-semibold">{history.user.name} · {history.user.email}</p><div className="grid grid-cols-2 gap-3"><p>Confirmed violations / active strikes: <strong>{history.confirmedViolations}</strong></p><p>Warnings: <strong>{history.restrictions.filter(row => row.level === 1).length}</strong></p><p>Active restrictions: <strong>{history.activeRestrictions.filter(row => row.level > 1).length}</strong></p><p>Suspensions: <strong>{history.restrictions.filter(row => row.level === 5).length}</strong></p></div><h3 className="font-semibold">Violation history</h3>{history.cases.map(row => <p key={row._id}><Badge value={row.status} /> {row.category} · {date(row.createdAt)}<button disabled={busy} onClick={() => { setHistory(null); void view(row._id); }} className="ml-2 text-brand underline">Review case</button></p>)}<h3 className="font-semibold">Appeals</h3>{history.appeals.map(row => <p className="whitespace-pre-wrap break-words" key={row._id}>{label(row.status)} · {date(row.createdAt)} · {row.explanation}</p>)}</div></FeedDialog>}
  </div>;
}
