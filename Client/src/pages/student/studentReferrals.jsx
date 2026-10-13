import { useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { Search, Send, Briefcase, GraduationCap, Award } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import StudentSidebar from '../../layout/sidebar/student/studentSidebar';
import StudentTopbar from '../../layout/topbar/student/studentTopbar';
import api from '../../utils/axios';

const TYPE_META = {
  job: { icon: Briefcase, label: 'Job' },
  internship: { icon: GraduationCap, label: 'Internship' },
  scholarship: { icon: Award, label: 'Scholarship' },
};

const APP_STATUS = {
  pending: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  reviewed: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300',
  accepted: 'bg-[#009639]/10 text-[#007a2e] dark:text-emerald-300',
  declined: 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400',
};

const StudentReferrals = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tab, setTab] = useState('browse');
  const [referrals, setReferrals] = useState([]);
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [applyingId, setApplyingId] = useState(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [allRes, mineRes] = await Promise.all([
        api.get('/referrals'),
        api.get('/referrals/applications/me'),
      ]);
      setReferrals(allRes.data.data || []);
      setMine(mineRes.data.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load referrals and applications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(
    () => {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchAll();
    },
    []
  );

  const appliedIds = new Set(mine.map((a) => String(a.referralId)));

  const handleApply = async (referral) => {
    if (pending.current) return;
    pending.current = true; setSubmitting(true); setError('');
    try {
      await api.post(`/referrals/${referral._id}/apply`, { note });
      setNote('');
      setApplyingId(null);
      await fetchAll();
      Swal.fire({ title: 'Applied!', text: 'The referrer will review your application.', icon: 'success', timer: 1800, showConfirmButton: false });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to apply. Please try again.');
    } finally {
      pending.current = false; setSubmitting(false);
    }
  };

  const filtered = referrals.filter((r) =>
    (typeFilter === 'all' || r.type === typeFilter) &&
    `${r.title} ${r.organization} ${r.description}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="student-page min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <StudentSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />

      <div className="lg:pl-64">
        <StudentTopbar user={user} title="Referrals" onMenuClick={() => setSidebarOpen(true)} />

        <main className="mx-auto max-w-4xl space-y-3 p-4 sm:p-6">
          <header className="border-b border-zinc-200 pb-5 dark:border-zinc-800">
            <h1>Referrals</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">Browse opportunities shared by alumni and track your applications.</p>
          </header>
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-white p-4 text-sm text-red-600 dark:border-red-900 dark:bg-zinc-900 dark:text-red-400">{error} <button type="button" onClick={fetchAll} className="font-semibold underline">Retry</button></p>}
          <div className="flex gap-1.5">
            {[
              { key: 'browse', label: 'Browse' },
              { key: 'applied', label: `Applied (${mine.length})` },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`rounded-full px-4 py-2 text-[12.5px] font-bold transition ${
                  tab === key ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'bg-white text-zinc-500 border border-zinc-200 hover:text-zinc-900 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-700 dark:hover:text-zinc-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'browse' && (
            <>
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search opportunities..."
                    className="h-10 w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 text-[12.5px] outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-emerald-500"
                  />
                </div>
                <div className="flex gap-1.5">
                  {['all', 'job', 'internship', 'scholarship'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTypeFilter(t)}
                      className={`rounded-full px-3 py-1.5 text-[11.5px] font-bold capitalize transition ${
                        typeFilter === t ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'bg-white text-zinc-500 border border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-700'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {loading ? (
                <p className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-[13px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
                  Loading opportunities...
                </p>
              ) : filtered.length === 0 ? (
                <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center dark:border-zinc-700 dark:bg-zinc-900">
                  <p className="text-[14px] font-bold text-zinc-800 dark:text-zinc-100">No opportunities yet</p>
                  <p className="mt-0.5 text-[12px] text-zinc-500 dark:text-zinc-400">Alumni referrals will appear here.</p>
                </div>
              ) : (
                filtered.map((r) => {
                  const meta = TYPE_META[r.type] || TYPE_META.job;
                  const Icon = meta.icon;
                  const applied = appliedIds.has(String(r._id));
                  return (
                    <article key={r._id} className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
                      <div className="flex items-center gap-2">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-[14.5px] font-extrabold text-zinc-900 dark:text-zinc-100">{r.title}</h3>
                          <p className="truncate text-[11.5px] text-zinc-500 dark:text-zinc-400">
                            {r.organization}{r.authorName ? ` • Referred by ${r.authorName}` : ''}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                          {meta.label}
                        </span>
                      </div>
                      {r.description && (
                        <p className="mt-2.5 whitespace-pre-line text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-300">{r.description}</p>
                      )}
                      {applied ? (
                        <p className="mt-3 rounded-xl bg-emerald-50 px-4 py-2.5 text-center text-[12.5px] font-bold text-[#007a2e] dark:bg-emerald-950 dark:text-emerald-300">
                          Application submitted ✓
                        </p>
                      ) : applyingId === String(r._id) ? (
                        <div className="mt-3 space-y-2">
                          <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            rows={2}
                            maxLength={1000}
                            disabled={submitting}
                            placeholder="Short note to the referrer (optional)..."
                            className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-[13px] outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-emerald-500"
                          />
                          <div className="flex gap-2">
                            <button type="button" onClick={() => { setApplyingId(null); setNote(''); }}
                              className="h-10 flex-1 rounded-xl border border-zinc-200 text-[12.5px] font-bold text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                              Cancel
                            </button>
                            <button type="button" disabled={submitting} onClick={() => handleApply(r)}
                              className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-zinc-900 text-[12.5px] font-bold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white">
                              <Send className="h-3.5 w-3.5" />
                              {submitting ? 'Submitting…' : 'Submit application'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setApplyingId(String(r._id))}
                          className="mt-3 h-10 w-full rounded-xl bg-zinc-900 text-[13px] font-bold text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                        >
                          Apply directly
                        </button>
                      )}
                    </article>
                  );
                })
              )}
            </>
          )}

          {tab === 'applied' && (
            <div className="space-y-2.5">
              {mine.length === 0 ? (
                <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center dark:border-zinc-700 dark:bg-zinc-900">
                  <p className="text-[14px] font-bold text-zinc-800 dark:text-zinc-100">No applications yet</p>
                  <p className="mt-0.5 text-[12px] text-zinc-500 dark:text-zinc-400">Browse opportunities and apply directly.</p>
                </div>
              ) : (
                mine.map((a) => (
                  <div key={a._id} className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-zinc-800 dark:text-zinc-100">{a.referralTitle || referrals.find(referral => String(referral._id) === String(a.referralId))?.title || 'Referral application'}</p>
                      {a.organization && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{a.organization}</p>}
                      <p className="text-[11px] text-zinc-400 dark:text-zinc-400">
                        Applied {a.createdAt ? new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide ${APP_STATUS[a.status] || APP_STATUS.pending}`}>
                      {a.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default StudentReferrals;
