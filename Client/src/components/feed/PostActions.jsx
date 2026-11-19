import { gooeyToast as toast } from 'goey-toast';
import { createElement, useEffect, useRef, useState } from 'react';
import { Bookmark, Flag, MoreHorizontal, Pencil, Pin, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react';
import api from '../../utils/axios';
import FeedComposer, { FeedDialog } from './FeedComposer';

const reasons = ['Spam or misleading content', 'Harassment or bullying', 'Hate speech or discrimination',
  'Inappropriate or offensive content', 'Fake information or impersonation', 'Violence or threats', 'Scam or fraudulent activity', 'Other'];
export default function PostActions({ post, user, onChanged, onReplace }) {
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const root = useRef(null);
  const trigger = useRef(null);
  const pending = useRef(false);
  useEffect(() => {
    if (!open) return;
    const close = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    const escape = event => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, [open]);
  const act = async (action, data) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true); setError(''); setMessage(''); setOpen(false);
    try {
      const path = `/feed/${post._id}`;
      const response = action === 'report' ? await api.post(`${path}/report`, data)
        : action === 'trash' ? await api.delete(path) : await api.put(`${path}/${action}`, data);
      if (['report', 'trash'].includes(action)) {
        setDialog(null);
        setMessage(action === 'report' ? 'Report submitted to administrators for review.' : 'Post moved to trash.');
        if (action === 'trash') onChanged();
      } else {
        onReplace(response.data.data);
        setMessage(data.preference === 'not_interested' ? 'This post will be hidden from your feed. You can reverse this in Not interested posts.' : 'Post preference updated.');
        toast.success(data.preference === 'not_interested' ? 'Post hidden from your feed' : 'Post updated', { description: data.preference === 'not_interested' ? 'Reverse this from Not interested posts.' : undefined });
        onChanged();
      }
    } catch (err) { setError(err.response?.data?.message || 'Unable to complete this action. Please try again.'); }
    finally { pending.current = false; setBusy(false); }
  };
  const state = post.viewerState || {};
  const options = post.isMine ? [
    [Pin, post.isPinned ? 'Unpin post' : 'Pin post', 'pin', { pinned: !post.isPinned }],
    [Bookmark, state.saved ? 'Unsave post' : 'Save post', 'state', { saved: !state.saved }],
    [Pencil, 'Edit post', 'edit'],
    [Trash2, 'Move to trash', 'trash'],
  ] : [
    [ThumbsUp, state.preference === 'interested' ? 'Remove interest' : 'Interested', 'state', { preference: state.preference === 'interested' ? null : 'interested' }],
    [ThumbsDown, state.preference === 'not_interested' ? 'Remove preference' : 'Not interested', 'state', { preference: state.preference === 'not_interested' ? null : 'not_interested' }],
    [Bookmark, state.saved ? 'Unsave post' : 'Save post', 'state', { saved: !state.saved }],
    [Flag, 'Report post', 'report'],
  ];
  return <div ref={root} className="relative shrink-0">
    <button ref={trigger} type="button" aria-label="Post options" aria-expanded={open} disabled={busy} onClick={() => setOpen(value => !value)} className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800"><MoreHorizontal size={20} /></button>
    {open && <div aria-label="Post options" className="absolute right-0 z-30 w-56 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
      {options.map(([icon, label, action, data]) => <button key={label} type="button" onClick={() => { setOpen(false); setError(''); if (['edit', 'trash', 'report'].includes(action)) setDialog(action); else void act(action, data); }} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">{createElement(icon, { size: 16 })}{label}</button>)}
    </div>}
    {(message || error) && <p role={error ? 'alert' : 'status'} className="absolute right-0 top-11 z-20 w-64 rounded-xl border border-zinc-200 bg-white p-3 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900">{error || message}<button aria-label="Dismiss notification" className="ml-2 underline" onClick={() => { setMessage(''); setError(''); }}>Close</button></p>}
    {dialog === 'edit' && <FeedComposer user={user} initialPost={post.originalPost ? { ...post, type: "update" } : post} onClose={() => setDialog(null)} onPublished={updated => { onReplace(updated); onChanged(); setDialog(null); }} />}
    {dialog === 'trash' && <FeedDialog title="Move to trash?" busy={busy} onClose={() => setDialog(null)}>
      <p className="text-sm">Are you sure you want to move this post to trash? You can no longer see it in your feed.</p>
      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex justify-end gap-3"><button disabled={busy} onClick={() => setDialog(null)}>Cancel</button><button disabled={busy} onClick={() => act('trash')} className="rounded-xl bg-red-600 px-4 py-2 text-white">{busy ? 'Moving...' : 'Move to trash'}</button></div>
    </FeedDialog>}
    {dialog === 'report' && <FeedDialog title="Report Post" busy={busy} onClose={() => setDialog(null)}>
      <form onSubmit={event => { event.preventDefault(); if (reason === 'Other' && !description.trim()) { setError('Please provide an explanation when selecting Other.'); return; } act('report', { reason, description }); }} className="space-y-4">
        <p className="text-sm">Help us understand what's wrong with this post. Your report will be submitted to the administrators for review.</p>
        <fieldset disabled={busy} className="space-y-1"><legend className="mb-2 text-sm font-semibold">Report reason</legend>{reasons.map(item => <label key={item} className="flex min-h-10 items-center gap-2 text-sm"><input type="radio" required name="reason" value={item} checked={reason === item} onChange={() => setReason(item)} />{item}</label>)}</fieldset>
        <label className="block text-sm">Additional explanation ({reason === 'Other' ? 'required' : 'optional'})<textarea rows={3} required={reason === 'Other'} maxLength={2000} value={description} disabled={busy} onChange={event => setDescription(event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-300 bg-transparent p-3 dark:border-zinc-700" /></label>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3"><button type="button" disabled={busy} onClick={() => setDialog(null)}>Cancel</button><button disabled={busy || !reason || (reason === 'Other' && !description.trim())} className="rounded-xl bg-brand px-4 py-2 text-white disabled:opacity-50">{busy ? 'Submitting...' : 'Submit Report'}</button></div>
      </form>
    </FeedDialog>}
  </div>;
}
