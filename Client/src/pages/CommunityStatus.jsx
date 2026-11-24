import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import api from '../utils/axios';
import { readCommunityStatus } from '../utils/communityStatus';
import { CommunityStatusContext } from '../context/CommunityStatusContext';
import { FeedDialog } from '../components/feed/FeedComposer';
import { ArrowRight, CheckCircle2, Clock3, FileText, Flag, Info, RefreshCw, ShieldCheck, ShieldAlert } from 'lucide-react';
import AlumniSidebar from '../layout/sidebar/alumni/alumniSidebar';
import AlumniTopbar from '../layout/topbar/alumni/alumniTopbar';
import StudentSidebar from '../layout/sidebar/student/studentSidebar';
import StudentTopbar from '../layout/topbar/student/studentTopbar';
import AdminSidebar from '../layout/sidebar/admin/adminSidebar';
import AdminTopbar from '../layout/topbar/alumni/adminTopbar';
import './communityStatus.css';
import ContentSkeleton from '../components/ui/Skeleton';

const levelLabel = level => ['Warning', 'Posting restriction', 'Communication restriction', 'Community restriction', 'Account suspension'][level - 1];
const date = value => new Date(value).toLocaleString();
const label = value => String(value || '').replaceAll('_', ' ');
function StatusBadge({ value }) {
  const tone = ['approved', 'dismissed', 'resolved'].includes(value) ? 'positive' : ['rejected', 'confirmed'].includes(value) ? 'negative' : 'pending';
  return <span className={`community-status-badge is-${tone}`}>{label(value) || 'Pending'}</span>;
}
export default function CommunityStatus() {
  const { user } = useAuth();
  const owner = user?.authId || user?._id;
  const sharedStatus = useContext(CommunityStatusContext);
  const initialStatus = useRef(sharedStatus);
  const [data, setData] = useState(sharedStatus);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState(null);
  const [explanation, setExplanation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    setRefreshing(true);
    try { const response = await readCommunityStatus(owner); setData(response.data.data); setError(''); window.dispatchEvent(new CustomEvent('community:refresh', { detail: { owner, data: response.data.data } })); }
    catch (err) { setError(err.response?.data?.message || 'Unable to load account status.'); }
    finally { setRefreshing(false); }
  }, [owner]);
  useEffect(() => { if (!initialStatus.current) void Promise.resolve().then(load); }, [load]);
  const view = async row => {
    setBusy(true); setError(''); setMessage('');
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
  const active = (data?.restrictions || []).filter(row => !row.revokedAt && new Date(row.expiresAt) > new Date());
  const highestLevel = Math.max(0, ...active.map(row => row.level));
  const severe = highestLevel >= 4;
  const pendingAppeals = (data?.appeals || []).filter(row => ['pending', 'under_review'].includes(row.status)).length;
  const accountPath = user?.role === 'admin' ? '/admin/settings' : `/${user?.role === 'student' ? 'student' : 'alumni'}/accounts`;
  const Sidebar = user?.role === 'admin' ? AdminSidebar : user?.role === 'student' ? StudentSidebar : AlumniSidebar;
  const Topbar = user?.role === 'admin' ? AdminTopbar : user?.role === 'student' ? StudentTopbar : AlumniTopbar;
  const existingAppeal = selected && data?.appeals?.find(row => row.caseId === selected._id);
  return <div className="community-status-page min-h-screen text-zinc-900 dark:text-zinc-100">
    <Sidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />
    <div className="lg:pl-64">
      <Topbar user={user} title="Account Status" onMenuClick={() => setSidebarOpen(true)} />
      <main className="community-status-main mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
        <header className="community-status-heading">
          <div><p className="community-status-eyebrow">Your community account</p><h1>Account status</h1><p>Understand your account access, review community decisions, and follow your appeals.</p></div>
          <button type="button" onClick={load} disabled={busy || refreshing} className="community-status-button"><RefreshCw size={16} aria-hidden="true" className={refreshing ? 'animate-spin' : ''} />{refreshing ? 'Refreshing...' : 'Refresh status'}</button>
        </header>
        {error && <div role="alert" className="community-status-notice is-error"><ShieldAlert size={20} aria-hidden="true" /><p>{error} You can use Refresh status to try again.</p></div>}
        {message && <div role="status" className="community-status-notice is-success"><CheckCircle2 size={20} aria-hidden="true" /><p>{message}</p></div>}
        {!data && !error && <div className="community-status-card"><ContentSkeleton variant="list" count={3} label="Loading your account status" /></div>}
        {data && <>
          <section className={`community-status-card community-access-overview ${highestLevel > 1 ? 'has-restriction' : highestLevel === 1 ? 'has-warning' : 'is-clear'}`} aria-labelledby="access-heading">
            <div className="community-access-heading"><span className="community-status-icon">{highestLevel ? <ShieldAlert size={28} aria-hidden="true" /> : <ShieldCheck size={28} aria-hidden="true" />}</span><div><p className="community-status-eyebrow">Current account access</p><h2 id="access-heading">{highestLevel === 5 ? 'Your account is suspended' : highestLevel > 1 ? 'Some features are temporarily restricted' : highestLevel === 1 ? 'You have a community warning' : 'Your community features are available'}</h2><p>{highestLevel > 1 ? 'Review the notice below to see what is affected and when access returns.' : highestLevel === 1 ? 'Your features are still available. Please review the warning below.' : 'You have no active restrictions. You can continue participating in the community.'}</p></div></div>
            <div className="community-access-footer"><p><Clock3 size={16} aria-hidden="true" />Restrictions end automatically at the expiry time. Submitting an appeal does not extend them.</p><div className="flex flex-wrap gap-2">{!severe && <Link to="/feed" className="community-status-button is-primary">Go to community <ArrowRight size={16} aria-hidden="true" /></Link>}<Link to={accountPath} className="community-status-button">Account settings</Link>{user?.role === 'admin' && <Link to="/admin/community" className="community-status-button">Moderation center</Link>}</div></div>
          </section>
          <nav aria-label="Account status sections" className="community-status-shortcuts">
            <a href="#account-notices"><ShieldAlert size={19} aria-hidden="true" /><span>Active notices</span><strong>{active.length}</strong></a>
            <a href="#my-reports"><Flag size={19} aria-hidden="true" /><span>My reports</span><strong>{data.reports?.length || 0}</strong></a>
            <a href="#moderation-history"><FileText size={19} aria-hidden="true" /><span>Account decisions</span><strong>{data.cases.length}</strong></a>
            <a href="#my-appeals"><Clock3 size={19} aria-hidden="true" /><span>Appeals awaiting review</span><strong>{pendingAppeals}</strong></a>
          </nav>
          <section id="account-notices" className="community-status-card" aria-labelledby="notices-heading">
            <div className="community-status-section-heading"><h2 id="notices-heading">Active notices</h2><p>Warnings and restrictions that currently apply to your account.</p></div>
            {!active.length && <div className="community-status-empty"><CheckCircle2 size={23} aria-hidden="true" /><div><strong>No active notices</strong><p>There are no current warnings or restrictions on your account.</p></div></div>}
            {active.map(row => <article key={row._id} className="community-restriction-card">
              <div className="flex flex-wrap items-center justify-between gap-2"><h3>{levelLabel(row.level)}</h3><span className="community-status-badge is-pending">{row.level === 1 ? 'Warning' : 'Active restriction'}</span></div>
              <p className="mt-3 whitespace-pre-wrap break-words">{row.reason || 'Review the case details for the administrator explanation.'}</p>
              <dl className="community-status-facts"><div><dt>Starts</dt><dd>{date(row.startsAt)}</dd></div><div><dt>Access returns</dt><dd>{date(row.expiresAt)}</dd></div></dl>
              <div className="community-feature-notice"><strong>What this means for you</strong><p>{row.level === 1 ? 'Your features remain available. This warning asks you to follow the community guidelines.' : row.level === 2 ? 'You cannot publish or edit posts, comments, or replies. You can still browse and access your account.' : row.level === 3 ? 'Posting, messaging, calls, and new connection requests are restricted. You can still browse.' : 'Community interactions are restricted. You can still view this page, submit an eligible appeal, and open account settings.'}</p></div>
              <button type="button" disabled={busy} onClick={() => view({ _id: row.caseId })} className="community-status-button is-primary mt-4">View details and appeal options <ArrowRight size={16} aria-hidden="true" /></button>
            </article>)}
          </section>
          <div className="community-status-content-grid">
            <div className="space-y-5">
              <section id="moderation-history" className="community-status-card" aria-labelledby="decisions-heading">
                <div className="community-status-section-heading"><h2 id="decisions-heading">Account decisions</h2><p>Moderation cases involving your content or account. Open a case to understand the decision or request a review.</p></div>
                {!data.cases.length && <div className="community-status-empty"><FileText size={23} aria-hidden="true" /><div><strong>No moderation cases</strong><p>Any future decisions about your account will appear here.</p></div></div>}
                {data.cases.map(row => <article key={row._id} className="community-status-record"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="capitalize">{label(row.category)}</h3><StatusBadge value={row.status} /></div><time dateTime={row.createdAt}>{date(row.createdAt)}</time><p className="mt-3 whitespace-pre-wrap break-words">{row.explanation}</p><button type="button" disabled={busy} onClick={() => view(row)} className="community-status-button mt-3">View case details <ArrowRight size={15} aria-hidden="true" /></button></article>)}
              </section>
              <section id="my-reports" className="community-status-card" aria-labelledby="reports-heading">
                <div className="community-status-section-heading"><h2 id="reports-heading">My reports</h2><p>Reports you submitted about other content. These are separate from decisions about your own account.</p></div>
                {!data.reports?.length && <div className="community-status-empty"><Flag size={23} aria-hidden="true" /><div><strong>You have not submitted any reports</strong><p>If you report content, you can follow its review here.</p></div></div>}
                {data.reports?.map(row => <article key={row._id} className="community-status-record"><div className="flex flex-wrap items-center justify-between gap-2"><h3>{row.reason}</h3><StatusBadge value={row.status} /></div><time dateTime={row.createdAt}>{date(row.createdAt)}</time>{row.adminNotes && <div className="community-feature-notice"><strong>Administrator response</strong><p className="whitespace-pre-wrap break-words">{row.adminNotes}</p></div>}</article>)}
              </section>
            </div>
            <div className="space-y-5">
              <section id="my-appeals" className="community-status-card" aria-labelledby="appeals-heading">
                <div className="community-status-section-heading"><h2 id="appeals-heading">Your appeals</h2><p>Requests you submitted to have an account decision reviewed.</p></div>
                {!data.appeals.length && <div className="community-status-empty"><Clock3 size={23} aria-hidden="true" /><div><strong>No appeals submitted</strong><p>To appeal, open a case under Account decisions and explain why you disagree.</p></div></div>}
                {data.appeals.map(row => <article key={row._id} className="community-status-record"><StatusBadge value={row.status} /><time className="mt-2 block" dateTime={row.createdAt}>{date(row.createdAt)}</time><p className="mt-3 whitespace-pre-wrap break-words">{row.explanation}</p>{row.notes && <div className="community-feature-notice"><strong>Administrator response</strong><p className="whitespace-pre-wrap break-words">{row.notes}</p></div>}</article>)}
              </section>
              <aside className="community-status-card community-status-help"><div className="flex items-center gap-2"><Info size={19} aria-hidden="true" /><h2>How appeals work</h2></div><ol><li><strong>Open your case.</strong><p>Select "View case details" to read the decision.</p></li><li><strong>Explain your concern.</strong><p>If appeals are available, tell the administrator why the decision should be reviewed.</p></li><li><strong>Follow the review here.</strong><p>Your appeal status and administrator response appear under Your appeals.</p></li></ol>{!data.appealsEnabled && <p className="community-feature-notice">Appeals are currently unavailable. Contact an administrator if you need a review.</p>}</aside>
            </div>
          </div>
        </>}
      </main>
    </div>
    {selected && <FeedDialog title="Case details & appeal" busy={busy} onClose={() => setSelected(null)} className="community-case-dialog"><div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-2"><StatusBadge value={selected.status} /><span className="capitalize">{label(selected.category)} / {selected.severity} severity</span></div><section className="community-feature-notice"><h3 className="font-semibold">Why this case was opened</h3><p className="mt-2 whitespace-pre-wrap break-words">{selected.explanation}</p></section>
      {selected.evidence ? <section><h3 className="font-semibold">Submitted content</h3><p className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800">{selected.evidence.text || 'Image submission'}</p></section> : <p>The retained evidence has expired or is unavailable.</p>}
      {selected.decision === 'hold' && selected.status === 'dismissed' && <p>This content is cleared for resubmission. Submit it again from the original form; it has not been published automatically.</p>}
      {data && !data.appealsEnabled && <p>Appeals are currently unavailable. Contact an administrator for review.</p>}
      {existingAppeal && <div className="community-feature-notice"><h3 className="font-semibold">You have already appealed this case</h3><div className="mt-2"><StatusBadge value={existingAppeal.status} /></div><p className="mt-2">Follow the outcome under Your appeals on this page.</p></div>}
      {data?.appealsEnabled && selected.status !== 'dismissed' && !existingAppeal && <form onSubmit={submit} className="space-y-3"><label className="block font-semibold">Why are you requesting a review?<textarea required maxLength={5000} rows={5} disabled={busy} placeholder="Explain what happened and why you believe the decision should be reviewed..." value={explanation} onChange={event => setExplanation(event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-300 bg-transparent p-3 font-normal dark:border-zinc-700" /></label><p className="text-xs text-zinc-500">Explain why this decision is incorrect. Do not include passwords or unnecessary personal information.</p><button disabled={busy || !explanation.trim()} className="rounded-xl bg-brand px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? 'Submitting...' : 'Submit Appeal'}</button></form>}
      {error && <p role="alert" className="text-red-600">{error}</p>}
    </div></FeedDialog>}
  </div>;
}
