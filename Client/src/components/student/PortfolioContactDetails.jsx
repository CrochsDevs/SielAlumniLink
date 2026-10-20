import { useState } from 'react';
import { Plus, Pencil, Trash2, Mail, Phone, MapPin, ArrowUpRight } from 'lucide-react';
import { gooeyToast as toast } from 'goey-toast';
import api from '../../utils/axios';
import { FeedDialog } from '../feed/FeedComposer';
import { LINK_LABELS, resumeLinks, websiteUrl } from '../../utils/resumeContact';

const inputClass = 'mt-2 w-full min-w-0 rounded-lg border border-zinc-200 bg-white p-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 dark:border-zinc-700 dark:bg-zinc-900';
const buttonClass = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-zinc-200 px-3 text-xs font-semibold hover:border-brand hover:text-brand disabled:opacity-50 dark:border-zinc-700 dark:hover:text-brand';

export default function PortfolioContactDetails({ user, disabled, onSaved, refreshUser }) {
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const links = resumeLinks(user);
  const contactEmail = user?.contactEmail ?? user?.email ?? '';
  const open = () => {
    setDraft({ contactEmail, contactNumber: user?.contactNumber || '', location: user?.location || '', profileLinks: links.map(link => ({ ...link, id: crypto.randomUUID() })) });
    setError('');
  };
  const update = (key, value) => { setDraft(previous => ({ ...previous, [key]: value })); setError(''); };
  const save = async event => {
    event.preventDefault();
    if (busy) return;
    const profileLinks = [];
    for (const link of draft.profileLinks) {
      const url = websiteUrl(link.url);
      if (!url) { setError(`Enter a valid ${LINK_LABELS[link.type]} URL, or remove the empty link.`); return; }
      profileLinks.push({ type: link.type, url });
    }
    setBusy(true);
    setError('');
    try {
      const details = { contactEmail: draft.contactEmail.trim(), contactNumber: draft.contactNumber.trim(), location: draft.location.trim(), profileLinks };
      await api.put('/users/me', details);
      onSaved(details);
      await refreshUser();
      setDraft(null);
      toast.success('Contact details saved', { description: 'Your resume and portfolio links are updated.' });
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save contact details. Please try again.');
    } finally { setBusy(false); }
  };

  return (
    <section id="contact-details" className="scroll-mt-24 rounded-xl border border-zinc-200 bg-white p-5 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="text-sm font-semibold">Contact &amp; links</h2><p className="mt-1 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">Choose how employers can reach you and explore your work.</p></div>
        <button type="button" disabled={disabled} onClick={open} className={buttonClass}><Pencil size={13} /> Edit contact details</button>
      </div>
      <div className="mt-4 space-y-3 text-xs text-zinc-600 dark:text-zinc-300">
        {[[Mail, contactEmail], [Phone, user?.contactNumber], [MapPin, user?.location]].filter(([, value]) => value).map(([Icon, value]) => <p key={value} className="flex items-start gap-2 break-words"><Icon size={14} className="mt-0.5 shrink-0" /><span className="min-w-0 break-all">{value}</span></p>)}
        {links.map((link, index) => <p key={index} className="flex min-w-0 items-start gap-2"><ArrowUpRight size={14} className="mt-0.5 shrink-0" /><span className="min-w-0"><span className="block text-[10px] text-zinc-500">{LINK_LABELS[link.type]}</span>{websiteUrl(link.url) ? <a href={websiteUrl(link.url)} target="_blank" rel="noopener noreferrer" className="break-all text-brand underline-offset-2 hover:underline dark:text-brand">{link.url}</a> : <span className="break-all">{link.url}</span>}</span></p>)}
      </div>
      <button type="button" disabled={disabled} onClick={open} className={`${buttonClass} mt-4`}><Plus size={14} /> Add details or links</button>
      {draft && <FeedDialog title="Edit contact details" busy={busy} onClose={() => setDraft(null)}>
        <form onSubmit={save}>
          <fieldset disabled={busy} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-semibold">Contact email<input type="email" autoComplete="email" maxLength={254} value={draft.contactEmail} onChange={event => update('contactEmail', event.target.value)} className={inputClass} /><span className="mt-1 block text-[10px] font-normal text-zinc-500">Email shown on your resume.</span></label>
              <label className="text-xs font-semibold">Phone number<input type="tel" autoComplete="tel" maxLength={60} value={draft.contactNumber} onChange={event => update('contactNumber', event.target.value)} placeholder="e.g. +63 912 345 6789" className={inputClass} /></label>
            </div>
            <label className="block text-xs font-semibold">Location<input type="text" maxLength={200} value={draft.location} onChange={event => update('location', event.target.value)} placeholder="City, province" className={inputClass} /></label>
            <div>
              <h3 className="text-xs font-semibold">Portfolio &amp; profile links</h3>
              <p className="mt-1 text-[11px] text-zinc-500">Add more than one website or GitHub link.</p>
              <div className="mt-3 space-y-3">
                {draft.profileLinks.map((link, index) => <div key={link.id} className="flex items-end gap-2">
                  <label className="min-w-0 flex-1 text-xs font-medium">{LINK_LABELS[link.type]} {draft.profileLinks.slice(0, index + 1).filter(item => item.type === link.type).length}<input type="text" inputMode="url" autoCapitalize="none" spellCheck={false} maxLength={2048} required value={link.url} onChange={event => update('profileLinks', draft.profileLinks.map(item => item.id === link.id ? { ...item, url: event.target.value } : item))} placeholder={link.type === 'github' ? 'https://github.com/yourname' : link.type === 'linkedin' ? 'https://linkedin.com/in/yourname' : 'https://yourportfolio.com'} className={inputClass} /></label>
                  <button type="button" aria-label={`Remove ${LINK_LABELS[link.type]} ${draft.profileLinks.slice(0, index + 1).filter(item => item.type === link.type).length}`} onClick={() => update('profileLinks', draft.profileLinks.filter(item => item.id !== link.id))} className="mb-1 rounded-lg p-3 text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"><Trash2 size={16} /></button>
                </div>)}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">{Object.entries(LINK_LABELS).map(([type, label]) => <button key={type} type="button" disabled={draft.profileLinks.length >= 20} onClick={() => update('profileLinks', [...draft.profileLinks, { id: crypto.randomUUID(), type, url: '' }])} className={buttonClass}><Plus size={14} /> Add {label}</button>)}</div>
            </div>
            {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setDraft(null)} className="rounded-lg px-4 py-2 text-xs text-zinc-500">Cancel</button><button type="submit" className="min-h-11 rounded-lg bg-brand px-4 text-xs font-semibold text-white hover:bg-brand">{busy ? 'Saving…' : 'Save contact details'}</button></div>
          </fieldset>
        </form>
      </FeedDialog>}
    </section>
  );
}
