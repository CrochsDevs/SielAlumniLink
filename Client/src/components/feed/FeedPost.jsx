import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ThumbsUp, MessageSquare, Repeat2, Send, Globe, Users, Trash2, CalendarDays } from 'lucide-react';
import api from '../../utils/axios';
import { useChat } from '../../context/useChat';
import ProfileAvatar from '../profile/ProfileAvatar';
import { profilePath } from '../search/searchLinks';
import { AudienceSelect, FeedDialog } from './FeedComposer';
import FeedImages from './FeedImages';

const buttonClass = 'rounded-lg px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-300 dark:hover:bg-zinc-800';
const formatDate = value => new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

function Author({ person, createdAt, audience }) {
  const content = <><span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-50 text-emerald-700"><ProfileAvatar user={person} /></span><span className="min-w-0"><span className="block truncate text-sm font-bold">{person.name}</span><span className="block truncate text-xs text-zinc-500">{[person.program, person.batch && `Batch ${person.batch}`].filter(Boolean).join(' · ')}</span></span></>;
  return <div className="flex-1 min-w-0">
    {person._id ? <Link to={profilePath(person)} className="flex items-center gap-2 hover:underline">{content}</Link> : <div className="flex items-center gap-2">{content}</div>}
    <span className="mt-1 flex flex-wrap items-center gap-1 text-xs text-zinc-500">{formatDate(createdAt)}{audience && <> · {audience === 'public' ? <Globe size={12} /> : <Users size={12} />} {audience === 'public' ? 'Public' : 'Connections only'}</>}</span>
  </div>;
}

function PostContent({ post, onRsvp, busy = false }) {
  const details = post.details || {};
  return <>
    <span className="inline-block rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold capitalize text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{post.type === 'story' ? 'Success story' : post.type}</span>
    {post.title && <h3 className="mt-2 text-base font-bold">{post.title}</h3>}
    {post.body && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]">{post.body}</p>}
    <FeedImages images={post.images} />
    {(details.organization || details.location) && <p className="mt-2 text-xs text-zinc-500">{[details.organization, details.location].filter(Boolean).join(' · ')}</p>}
    {post.type === 'event' && details.startAt && <div className="mt-3 space-y-2 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800">
      <p className="flex items-center gap-2 text-sm"><CalendarDays size={16} />{formatDate(details.startAt)}{details.endAt && ` – ${formatDate(details.endAt)}`}</p>
      <p className="text-xs text-zinc-500">{post.attendingCount} attending</p>
      {onRsvp && <button type="button" disabled={busy} onClick={onRsvp} className={buttonClass}>{post.attendingByMe ? 'Cancel RSVP' : 'Attend event'}</button>}
    </div>}
    {details.link && <a href={details.link} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-bold text-emerald-700 underline dark:text-emerald-300">{post.type === 'event' ? 'Register for this event' : 'View opportunity / apply'}</a>}
  </>;
}

function Comments({ postId, revision, onChanged }) {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const load = useCallback(async () => {
    try {
      const res = await api.get(`/feed/${postId}/comments`);
      setItems(res.data.data.comments); setCursor(res.data.data.nextCursor); setError('');
    } catch (err) { setError(err.response?.data?.message || 'Unable to load comments'); }
    finally { setLoading(false); }
  }, [postId]);
  useEffect(() => { Promise.resolve().then(load); }, [load, revision]);
  const more = async () => {
    setBusy(true);
    try {
      const res = await api.get(`/feed/${postId}/comments`, { params: { before: cursor } });
      setItems(prev => [...prev, ...res.data.data.comments.filter(c => !prev.some(p => p._id === c._id))]);
      setCursor(res.data.data.nextCursor);
    } catch { setError('Unable to load more comments'); }
    finally { setBusy(false); }
  };
  const submit = async e => {
    e.preventDefault();
    if (pending.current || !body.trim()) return;
    pending.current = true; setBusy(true); setError('');
    try {
      await api.post(`/feed/${postId}/comments`, { body });
      setBody(''); await load(); onChanged();
    } catch (err) { setError(err.response?.data?.message || 'Unable to add comment'); }
    finally { setBusy(false); pending.current = false; }
  };
  const remove = async id => {
    setBusy(true);
    try { await api.delete(`/feed/${postId}/comments/${id}`); await load(); onChanged(); }
    catch { setError('Unable to delete comment'); }
    finally { setBusy(false); }
  };
  return <div className="space-y-3 border-t border-zinc-100 p-4 dark:border-zinc-800">
    <form onSubmit={submit} className="flex items-start gap-2">
      <textarea aria-label="Write a comment" autoFocus rows={2} required maxLength={2000} value={body} onChange={e => setBody(e.target.value)} placeholder="Write a comment…" className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-transparent p-2 text-sm dark:border-zinc-700" />
      <button disabled={busy || !body.trim()} className={buttonClass}>Post</button>
    </form>
    {error && <p role="alert" className="text-sm text-red-600">{error} <button onClick={load} className="underline">Retry</button></p>}
    {loading ? <p className="text-sm text-zinc-500">Loading comments…</p> : items.length === 0 && <p className="text-sm text-zinc-500">Start the conversation.</p>}
    {items.map(c => <div key={c._id} className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800">
      <div className="flex items-start justify-between gap-2"><Author person={c.author} createdAt={c.createdAt} />
        {c.isMine && <button type="button" disabled={busy} aria-label="Delete comment" onClick={() => remove(c._id)} className="p-1 text-zinc-500 hover:text-red-600"><Trash2 size={14} /></button>}</div>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm">{c.body}</p>
    </div>)}
    {cursor && <button type="button" disabled={busy} onClick={more} className={buttonClass}>Older comments</button>}
  </div>;
}

function ShareDialog({ post, onClose, onChanged }) {
  const [audience, setAudience] = useState(post.audience);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const original = post.originalPost || post;
  const share = async e => {
    e.preventDefault();
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { await api.post(`/feed/${post._id}/share`, { body, audience }); onChanged(); onClose(); }
    catch (err) { setError(err.response?.data?.message || 'Unable to share post'); }
    finally { setBusy(false); pending.current = false; }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/feed?post=${post._id}`); setError('Link copied. Viewing the post still requires access.'); }
    catch { setError('Unable to copy. Use the post link in your address bar.'); }
  };
  return <FeedDialog title="Share this post" onClose={onClose} busy={busy}>
    <form onSubmit={share} className="space-y-3">
      <AudienceSelect value={audience} onChange={setAudience} privateOnly={original.audience === 'connections'} />
      {original.audience === 'connections' && <p className="text-xs text-zinc-500">Only connections who can also see the original post can see this repost.</p>}
      <textarea aria-label="Add your thoughts" maxLength={10000} rows={3} value={body} onChange={e => setBody(e.target.value)} placeholder="Add your thoughts (optional)…" className="w-full rounded-xl border border-zinc-300 bg-transparent p-3 text-sm dark:border-zinc-700" />
      {error && <p role="status" className="text-sm">{error}</p>}
      <div className="flex justify-between"><button type="button" onClick={copy} className={buttonClass}>Copy link</button><button disabled={busy} className={buttonClass}>{busy ? 'Sharing…' : 'Repost to feed'}</button></div>
    </form>
  </FeedDialog>;
}

function SendDialog({ post, onClose }) {
  const { openChatByEmail } = useChat();
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  useEffect(() => {
    let cancelled = false;
    api.get(`/feed/${post._id}/recipients`).then(res => { if (!cancelled) setPeople(res.data.data); })
      .catch(() => { if (!cancelled) setError('Unable to load connected alumni. Please close and try again.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [post._id]);
  const send = async person => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      await api.post(`/feed/${post._id}/send`, { recipientAuthId: person.authId });
      await openChatByEmail(person.email); onClose();
    } catch (err) { setError(err.response?.data?.message || 'Unable to send post'); }
    finally { setBusy(false); pending.current = false; }
  };
  const filtered = people.filter(p => `${p.name} ${p.email}`.toLowerCase().includes(query.toLowerCase()));
  return <FeedDialog title="Send to a connected alumni" onClose={onClose} busy={busy}>
    <p className="mb-3 text-xs text-zinc-500">Send a post link and open your conversation. Recipients must have permission to view this post.</p>
    <input aria-label="Search connected alumni" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search connections…" className="mb-3 w-full rounded-xl border border-zinc-300 bg-transparent p-3 text-sm dark:border-zinc-700" />
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {loading ? <p>Loading connections…</p> : filtered.length === 0 ? <p className="text-sm text-zinc-500">No connected alumni can receive this post. Connect with alumni first.</p> :
      <ul className="space-y-2">{filtered.map(person => <li key={person.authId} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
        <span className="min-w-0 truncate text-sm font-semibold">{person.name}</span><button type="button" disabled={busy} onClick={() => send(person)} className={buttonClass}>{busy ? 'Sending…' : 'Send'}</button>
      </li>)}</ul>}
  </FeedDialog>;
}

export default function FeedPost({ post, user, revision, onChanged, onReplace }) {
  const { openChatByEmail } = useChat();
  const [showComments, setShowComments] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const canPublish = ['alumni', 'admin'].includes(user?.role);
  const act = async (path, data) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { const res = await api.put(`/feed/${path}`, data); onReplace(res.data.data); }
    catch (err) { setError(err.response?.data?.message || 'Unable to update post. Please try again.'); }
    finally { setBusy(false); pending.current = false; }
  };
  const remove = async () => {
    if (pending.current) return;
    pending.current = true; setBusy(true);
    try { await api.delete(`/feed/${post._id}`); onChanged(); setDialog(null); }
    catch (err) { setError(err.response?.data?.message || 'Unable to delete post'); }
    finally { setBusy(false); pending.current = false; }
  };
  return <article id={`post-${post._id}`} className="overflow-hidden rounded-2xl border border-emerald-900/10 bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100">
    <div className="flex gap-2 p-4"><Author person={post.author} audience={post.audience} createdAt={post.createdAt} />
      {post.isMine && <button type="button" onClick={() => setDialog('delete')} aria-label="Delete post" className="self-start rounded-lg p-2 text-zinc-500 hover:text-red-600"><Trash2 size={16} /></button>}</div>
    <div className="px-4 pb-4"><PostContent post={post} busy={busy} onRsvp={!post.originalPost && post.type === 'event' ? () => act(`${post._id}/rsvp`, { attending: !post.attendingByMe }) : null} />
      {['referral', 'hiring'].includes(post.type) && !post.originalPost && !post.details.link && !post.isMine && <button type="button" onClick={() => openChatByEmail(post.author.email)} className={buttonClass}>Message author about this opportunity</button>}
      {post.originalPost && <div className="mt-3 space-y-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700"><Author person={post.originalPost.author} audience={post.originalPost.audience} createdAt={post.originalPost.createdAt} />
        <PostContent post={post.originalPost} busy={busy} onRsvp={post.originalPost.type === 'event' ? () => act(`${post.originalPost._id}/rsvp`, { attending: !post.originalPost.attendingByMe }) : null} />
        <Link to={`/feed?post=${post.originalPost._id}`} className="inline-block text-xs font-bold text-emerald-700 underline">View original post</Link></div>}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 px-4 py-2 text-xs text-zinc-500 dark:border-zinc-800">
      <span>{post.likesCount} {post.likesCount === 1 ? 'like' : 'likes'}</span><button onClick={() => setShowComments(prev => !prev)} className="hover:underline">{post.commentsCount} comments · {post.sharesCount} reposts</button>
    </div>
    <div className="grid grid-cols-4 border-t border-zinc-100 px-1 py-1 sm:px-2 dark:border-zinc-800">
      <button type="button" disabled={busy} aria-pressed={post.likedByMe} onClick={() => act(`${post._id}/like`, { liked: !post.likedByMe })} className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-0 py-3 text-xs sm:flex-row sm:px-1 font-semibold hover:bg-emerald-50 disabled:opacity-50 dark:hover:bg-zinc-800 ${post.likedByMe ? 'text-emerald-600' : 'text-zinc-500'}`}><ThumbsUp size={16} />{post.likedByMe ? 'Liked' : 'Like'}</button>
      <button type="button" disabled={busy} onClick={() => setShowComments(prev => !prev)} className="flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-0 py-3 text-xs sm:flex-row sm:px-1 font-semibold text-zinc-500 hover:bg-emerald-50 dark:hover:bg-zinc-800"><MessageSquare size={16} />Comment</button>
      <button type="button" disabled={busy} onClick={() => setDialog('share')} className="flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-0 py-3 text-xs sm:flex-row sm:px-1 font-semibold text-zinc-500 hover:bg-emerald-50 dark:hover:bg-zinc-800"><Repeat2 size={16} />Share</button>
      <button type="button" disabled={busy} onClick={() => setDialog('send')} className="flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-0 py-3 text-xs sm:flex-row sm:px-1 font-semibold text-zinc-500 hover:bg-emerald-50 dark:hover:bg-zinc-800"><Send size={16} />Send</button>
    </div>
    {error && <p role="alert" className="px-4 pb-3 text-sm text-red-600">{error}</p>}
    {showComments && <Comments postId={post._id} revision={revision} onChanged={onChanged} />}
    {dialog === 'share' && (canPublish ? <ShareDialog post={post} onChanged={onChanged} onClose={() => setDialog(null)} /> : <FeedDialog title="Share post link" onClose={() => setDialog(null)}><p className="mb-3 text-sm">Copy this link to share the post. Viewing it requires permission.</p><input readOnly aria-label="Post link" value={`${window.location.origin}/feed?post=${post._id}`} onFocus={e => e.target.select()} className="w-full rounded-lg border p-3 text-sm dark:bg-zinc-950" /></FeedDialog>)}
    {dialog === 'send' && <SendDialog post={post} onClose={() => setDialog(null)} />}
    {dialog === 'delete' && <FeedDialog title="Delete this post?" busy={busy} onClose={() => setDialog(null)}><p className="text-sm">This post and any reposts of it will disappear from feeds.</p><button disabled={busy} onClick={remove} className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white">{busy ? 'Deleting…' : 'Delete post'}</button></FeedDialog>}
  </article>;
}
