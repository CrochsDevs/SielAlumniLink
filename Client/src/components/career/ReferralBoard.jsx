import { useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { Share2, Search, Plus, Trash2, Users, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import api from '../../utils/axios';
import ProfileAvatar from '../profile/ProfileAvatar';
import DataPagination from '../ui/data-pagination';
import { FeedDialog } from '../feed/FeedComposer';

const TYPES = [
  { key: 'all', label: 'All' },
  { key: 'job', label: 'Jobs' },
  { key: 'internship', label: 'Internships' },
  { key: 'scholarship', label: 'Scholarships' },
];

const TYPE_STYLE = {
  job: 'bg-[#009639] text-white',
  internship: 'bg-blue-600 text-white',
  scholarship: 'bg-amber-600 text-white',
};

const STATUS_STYLE = {
  pending: 'bg-zinc-100 text-zinc-500',
  reviewed: 'bg-blue-50 text-blue-600',
  accepted: 'bg-[#009639]/10 text-[#007a2e]',
  declined: 'bg-red-50 text-red-600',
};

const cardClass = 'rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900';

const ReferralBoard = () => {
  const { user } = useAuth();
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [types, setTypes] = useState(['job', 'internship', 'scholarship']);
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', type: 'job', organization: '', link: '' });
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [applicantsLoading, setApplicantsLoading] = useState(false);
  const [error, setError] = useState('');
  const postPending = useRef(false);

  const canPost = ['admin', 'alumni'].includes(user?.role);

  const fetchReferrals = async () => {
    setLoading(true);
    try {
      const res = await api.get('/referrals');
      setReferrals(res.data.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load referrals.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchReferrals();
  }, []);

  const handlePost = async (e) => {
    e.preventDefault();
    if (postPending.current) return;
    postPending.current = true;
    setSaving(true);
    try {
      await api.post('/referrals', form);
      setForm({ title: '', description: '', type: 'job', organization: '', link: '' });
      setFormOpen(false);
      fetchReferrals();
      Swal.fire({ title: 'Posted!', text: 'Students can now apply.', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to post', 'error');
    } finally {
      postPending.current = false;
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Delete referral?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      confirmButtonColor: '#dc2626',
      reverseButtons: true,
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/referrals/${id}`);
      setReferrals((prev) => prev.filter((r) => r._id !== id));
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to delete', 'error');
    }
  };

  const toggleApplicants = async (referral) => {
    if (String(expandedId) === String(referral._id)) {
      setExpandedId(null);
      return;
    }
    setExpandedId(referral._id);
    setApplicantsLoading(true);
    try {
      const res = await api.get(`/referrals/${referral._id}/applications`);
      setApplicants(res.data.data || []);
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to load applicants', 'error');
      setExpandedId(null);
    } finally {
      setApplicantsLoading(false);
    }
  };

  const setApplicationStatus = async (appId, status) => {
    try {
      await api.put(`/referrals/applications/${appId}`, { status });
      setApplicants((prev) => prev.map((a) => (String(a._id) === String(appId) ? { ...a, status } : a)));
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to update', 'error');
    }
  };

  const inputClass = 'h-10 w-full min-w-0 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-[#009639] focus:ring-2 focus:ring-[#009639]/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:[color-scheme:dark]';
  const filtered = referrals.filter(r => types.includes(r.type) && `${r.title || ''} ${r.organization || ''} ${r.description || ''}`.toLowerCase().includes(term.toLowerCase()));
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);
  const isMine = r => user?.role === 'admin' || String(r.authorAuthId) === String(user?.authId || user?._id);
  const resetFilters = () => { setTypes(['job', 'internship', 'scholarship']); setQuery(''); setTerm(''); setPage(1); };

  return (
    <section aria-label="Referrals" className="grid items-start gap-4 text-zinc-900 md:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[200px_minmax(0,1fr)_220px] dark:text-zinc-100">
      <aside className={`${cardClass} order-2 p-5 md:order-none md:sticky md:top-20`} aria-label="Referral filters">
        <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Filter</h2><button type="button" onClick={resetFilters} className="text-[11px] font-medium text-red-600 dark:text-red-400">Clear all</button></div>
        <h3 className="mb-4 mt-6 text-xs font-semibold">Opportunity Type</h3>
        <div className="space-y-3">{TYPES.filter(type => type.key !== 'all').map(({ key, label }) => <label key={key} className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300"><input type="checkbox" checked={types.includes(key)} onChange={() => { setPage(1); setTypes(previous => previous.includes(key) ? previous.filter(type => type !== key) : [...previous, key]); }} className="h-3.5 w-3.5 accent-[#009639]" />{label}<span className="ml-auto text-[10px] text-zinc-400">{referrals.filter(r => r.type === key).length}</span></label>)}</div>
      </aside>
      <section className="order-1 min-w-0 space-y-3 md:order-none">
        <header className="relative overflow-hidden rounded-lg bg-gradient-to-br from-[#007a2e] to-[#009639] p-5 text-white">
          <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-8 rotate-12 text-white/10"><Share2 size={180} strokeWidth={1} /></div>
          <h2 className="relative text-xl font-semibold">Referral Opportunity Board</h2>
          <p className="relative mt-2 max-w-lg text-xs leading-6 text-white/90">Discover jobs, internships, and scholarships referred by your alumni community.</p>
          <form onSubmit={event => { event.preventDefault(); setTerm(query.trim()); setPage(1); }} className="relative mt-4 flex flex-wrap gap-2">
            <div className="relative min-w-0 flex-1 basis-40"><Search size={15} className="absolute left-3 top-3 text-white/80" /><input type="search" aria-label="Search referrals" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search title, organization or keyword" className="h-10 w-full rounded-lg border border-white/20 bg-white/20 pl-9 pr-3 text-xs text-white outline-none placeholder:text-white/75 focus:bg-white/30" /></div>
            <button type="submit" className="rounded-lg bg-white px-4 text-xs font-semibold text-[#007a2e]">Search</button>
            {canPost && <button type="button" onClick={() => setFormOpen(true)} className="inline-flex h-10 items-center gap-1 rounded-lg border border-white/70 px-3 text-xs font-semibold"><Plus size={15} />Post referral</button>}
          </form>
        </header>
        {error && <p role="alert" className={`${cardClass} p-4 text-xs text-red-600 dark:text-red-400`}>{error} <button type="button" onClick={fetchReferrals} className="font-semibold underline">Retry</button></p>}
        {loading ? <p role="status" className={`${cardClass} p-8 text-center text-sm text-zinc-500 dark:text-zinc-400`}>Loading referrals...</p> : <>
          <p role="status" className="px-1 text-[11px] text-zinc-500 dark:text-zinc-400">{filtered.length} {filtered.length === 1 ? 'result' : 'results'}{term && ` for "${term}"`}</p>
          {!filtered.length && <div className={`${cardClass} p-8 text-center`}><Share2 size={28} className="mx-auto text-zinc-300 dark:text-zinc-600" /><h3 className="mt-3 text-sm font-semibold">No referrals found</h3><p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Try another filter or share a referral with the community.</p></div>}
          {paged.map(r => <article key={r._id} className={`${cardClass} p-4 sm:p-5`}>
            <div className="flex flex-wrap items-start gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${TYPE_STYLE[r.type] || TYPE_STYLE.job}`}>{r.organization ? r.organization.split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase() : <Share2 size={19} />}</span>
              <div className="min-w-0 flex-1 basis-36"><h3 className="break-words text-sm font-semibold leading-5">{r.title}</h3><p className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">{r.organization && <span>{r.organization}</span>}<span>{r.authorName ? `Referred by ${r.authorName}` : 'Community'}</span></p></div>
              {isMine(r) && <button type="button" onClick={() => handleDelete(r._id)} aria-label="Delete referral" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 transition hover:bg-red-50 hover:text-red-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"><Trash2 size={15} /></button>}
            </div>
            {r.description && <p className="mt-4 whitespace-pre-wrap break-words text-xs leading-6 text-zinc-600 dark:text-zinc-300">{r.description}</p>}
            <footer className="mt-4 flex flex-wrap items-center justify-between gap-3"><span className={`rounded-md px-2.5 py-1 text-[10px] font-semibold ${TYPE_STYLE[r.type] || TYPE_STYLE.job}`}>{TYPES.find(type => type.key === r.type)?.label || r.type}</span>{r.createdAt && <time dateTime={r.createdAt} className="text-[10px] text-zinc-500 dark:text-zinc-400">{new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</time>}</footer>
            {isMine(r) && <button type="button" onClick={() => toggleApplicants(r)} aria-expanded={String(expandedId) === String(r._id)} className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-[#007a2e] dark:border-zinc-700 dark:text-emerald-300"><Users size={14} />View applicants<ChevronDown size={14} className={`transition-transform ${String(expandedId) === String(r._id) ? 'rotate-180' : ''}`} /></button>}
                {isMine(r) && String(expandedId) === String(r._id) && (
                  <div className="mt-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 p-3">
                    {applicantsLoading ? (
                      <p className="py-2 text-center text-[12px] text-zinc-400 dark:text-zinc-500">Loading applicants...</p>
                    ) : applicants.length === 0 ? (
                      <p className="py-2 text-center text-[12px] text-zinc-400 dark:text-zinc-500">No applicants yet.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {applicants.map((a) => (
                          <li key={a._id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white dark:bg-zinc-900 px-3 py-2">
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[12.5px] font-semibold text-zinc-800 dark:text-zinc-100">{a.name || a.email}</span>
                              <span className="block truncate text-[11px] text-zinc-500 dark:text-zinc-400">{a.email}</span>
                              {a.note && <span className="mt-1 block whitespace-pre-wrap text-xs text-zinc-500 dark:text-zinc-400">{a.note}</span>}
                            </span>
                            <select
                              value={a.status}
                              onChange={(e) => setApplicationStatus(a._id, e.target.value)}
                              className={`h-8 rounded-lg px-2 text-[11px] font-semibold outline-none ${STATUS_STYLE[a.status] || STATUS_STYLE.pending}`}
                            >
                              {['pending', 'reviewed', 'accepted', 'declined'].map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

          </article>)}
          {filtered.length > 0 && <div className={`${cardClass} overflow-hidden`}><DataPagination page={currentPage} totalPages={totalPages} onPageChange={setPage} perPage={perPage} onPerPageChange={value => { setPerPage(value); setPage(1); }} totalItems={filtered.length} itemLabel="referrals" /></div>}
        </>}
      </section>
      <aside className="order-3 grid min-w-0 gap-3 md:col-span-2 md:grid-cols-2 xl:col-span-1 xl:grid-cols-1 xl:sticky xl:top-20">
        <section className={`${cardClass} p-5 text-center`}><span className="mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-emerald-50 text-[#009639] dark:bg-emerald-950 dark:text-emerald-300"><ProfileAvatar user={user} /></span><h2 className="mt-3 break-words text-sm font-semibold">{user?.name || 'Member'}</h2><p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{[user?.program, user?.batch && `Batch ${user.batch}`].filter(Boolean).join(' | ')}</p><span className="mt-3 inline-block rounded-full bg-zinc-100 px-3 py-1 text-[10px] font-semibold capitalize text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{user?.role}</span></section>
        <section className={`${cardClass} p-5`}><h2 className="mb-4 text-sm font-semibold">Board Summary</h2><dl className="space-y-3">{TYPES.filter(type => type.key !== 'all').map(({ key, label }) => <div key={key} className="flex items-center justify-between gap-3 text-xs"><dt className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400"><span className={`h-2 w-2 rounded-sm ${TYPE_STYLE[key]}`} />{label}</dt><dd className="font-semibold">{referrals.filter(r => r.type === key).length}</dd></div>)}</dl></section>
        <p className={`${cardClass} p-4 text-[11px] leading-6 text-zinc-500 md:col-span-2 xl:col-span-1 dark:text-zinc-400`}>Share jobs, internships, or scholarships through referrals. Students apply directly from their portal.</p>
      </aside>
      {canPost && formOpen && <FeedDialog title="Post a referral" busy={saving} onClose={() => setFormOpen(false)}>
        <form onSubmit={handlePost}><fieldset disabled={saving} className="space-y-4">
          <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">Refer a job, internship, or scholarship to the community.</p>
          <label className="block text-xs font-medium">Title *<input required value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} className={`${inputClass} mt-1.5`} /></label>
          <div className="grid gap-4 sm:grid-cols-2"><label className="block text-xs font-medium">Opportunity type<select value={form.type} onChange={event => setForm({ ...form, type: event.target.value })} className={`${inputClass} mt-1.5`}><option value="job">Job</option><option value="internship">Internship</option><option value="scholarship">Scholarship</option></select></label><label className="block text-xs font-medium">Organization<input value={form.organization} onChange={event => setForm({ ...form, organization: event.target.value })} className={`${inputClass} mt-1.5`} /></label></div>
          <label className="block text-xs font-medium">Link (optional)<input value={form.link} onChange={event => setForm({ ...form, link: event.target.value })} className={`${inputClass} mt-1.5`} /></label>
          <label className="block text-xs font-medium">Description<textarea rows={5} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="Details, requirements, how to apply..." className={`${inputClass} mt-1.5 !h-auto py-3`} /></label>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setFormOpen(false)} className="rounded-lg border border-zinc-200 px-4 py-2 text-xs font-semibold dark:border-zinc-700">Cancel</button><button type="submit" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#009639] px-4 text-xs font-semibold text-white transition hover:bg-[#007a2e] disabled:opacity-50">{saving ? 'Posting...' : 'Post referral'}</button></div>
        </fieldset></form>
      </FeedDialog>}
    </section>
  );
};

export default ReferralBoard;
