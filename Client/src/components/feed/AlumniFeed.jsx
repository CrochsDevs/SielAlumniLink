import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Newspaper, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { getSocket } from '../../realtime/socket';
import api from '../../utils/axios';
import FeedComposer from './FeedComposer';
import FeedPost from './FeedPost';

export default function AlumniFeed({ onlyType, showComposer = true, moderationEnabled = false }) {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const postId = params.get('post');
  const filter = onlyType || 'all';
  const isModerator = moderationEnabled && user?.role === 'admin';
  const [moderationFilter, setModerationFilter] = useState('published');
  const [participation, setParticipation] = useState({ restricted: false, reason: '' });
  const [posts, setPosts] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const pageCount = useRef(1);
  const morePending = useRef(false);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    try {
      const status = await api.get('/feed/status');
      let nextPosts = [], nextCursor = null;
      if (postId) {
        const res = await api.get(`/feed/${postId}`);
        nextPosts = [res.data.data];
      } else {
        for (let page = 0; page < pageCount.current; page++) {
          const res = await api.get('/feed', { params: { type: filter, before: nextCursor || undefined, moderation: isModerator ? moderationFilter : undefined } });
          nextPosts.push(...res.data.data.posts);
          nextCursor = res.data.data.nextCursor;
          if (!nextCursor) break;
        }
      }
      if (request !== generation.current) return;
      setParticipation(status.data.data);
      setPosts(nextPosts); setCursor(nextCursor); setError('');
      setRevision(prev => prev + 1);
    } catch (err) {
      if (request !== generation.current) return;
      if ([403, 404].includes(err.response?.status)) setPosts([]);
      setError(err.response?.data?.message || 'Unable to load the feed. Please try again.');
    } finally { if (request === generation.current) setLoading(false); }
  }, [filter, postId, isModerator, moderationFilter]);
  useEffect(() => {
    pageCount.current = 1;
    // A new filter or account needs a fresh feed; sockets reuse this loader.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    refresh();
    const socket = getSocket();
    let timer;
    const onChanged = () => { clearTimeout(timer); timer = setTimeout(refresh, 150); };
    socket.on('feed:changed', onChanged);
    socket.on('connect', onChanged);
    return () => {
      // This is a request sequence counter, not a DOM ref. Invalidate in-flight loads.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ++generation.current;
      clearTimeout(timer); socket.off('feed:changed', onChanged); socket.off('connect', onChanged);
    };
  }, [refresh, user?.authId]);
  const more = async () => {
    if (!cursor || morePending.current) return;
    morePending.current = true; setLoadingMore(true);
    const request = generation.current;
    try {
      const res = await api.get('/feed', { params: { type: filter, before: cursor, moderation: isModerator ? moderationFilter : undefined } });
      if (request !== generation.current) return;
      setPosts(prev => [...prev, ...res.data.data.posts.filter(p => !prev.some(item => item._id === p._id))]);
      setCursor(res.data.data.nextCursor); pageCount.current += 1;
    } catch { if (request === generation.current) setError('Unable to load more posts. Please try again.'); }
    finally { setLoadingMore(false); morePending.current = false; }
  };
  const replace = updated => {
    setPosts(prev => prev.map(p => p._id === updated._id ? updated : p.originalPost?._id === updated._id ? { ...p, originalPost: updated } : p));
  };
  const published = () => {
    if (postId) setParams({});
    refresh();
  };
  return <div className="space-y-3">
    {participation.restricted && <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"><p className="font-semibold">Your feed participation is restricted.</p><p className="mt-1">You can still read available posts. {participation.reason}</p></div>}
    {showComposer && !participation.restricted && ['alumni', 'admin'].includes(user?.role) && <FeedComposer user={user} defaultType={onlyType || 'update'} fixedType={onlyType} onPublished={published} />}
    {isModerator && <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"><span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Manage feed</span><select aria-label="Moderation filter" value={moderationFilter} onChange={event => { setModerationFilter(event.target.value); if (postId) setParams({}); }} className="max-w-full rounded-lg border border-zinc-300 bg-transparent p-2 text-sm dark:border-zinc-600 dark:text-zinc-100 dark:[&>option]:bg-zinc-900"><option value="published">Published posts</option><option value="blocked">Blocked posts</option><option value="all">All posts</option></select></div>}
    {postId && <button onClick={() => setParams({})} className="text-sm font-bold text-emerald-700 hover:underline">← Back to feed</button>}
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-white p-4 text-sm text-red-600 dark:bg-zinc-900 dark:text-red-400">{error} <button type="button" onClick={refresh} className="ml-2 font-bold underline">Retry</button></div>}
    {loading ? <p role="status" className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">Loading feed…</p> : <>
      {!posts.length && !error && <div role="status" className="flex flex-col items-center gap-4 rounded-2xl border border-zinc-200 bg-white px-6 py-10 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
          {onlyType === 'story' ? <Sparkles className="h-9 w-9" strokeWidth={1.5} aria-hidden="true" /> : <Newspaper className="h-9 w-9" strokeWidth={1.5} aria-hidden="true" />}
        </span>
        <div className="max-w-sm">
          <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{isModerator && moderationFilter === 'blocked' ? 'No blocked posts' : onlyType === 'story' ? 'No success stories yet' : 'No posts yet'}</p>
          <p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{onlyType === 'story' ? 'Share your journey to inspire others.' : 'Alumni can share an update, opportunity, event, or success story.'}</p>
        </div>
      </div>}
      {posts.map(post => <FeedPost key={post._id} post={post} user={user} restricted={participation.restricted} revision={revision} onChanged={refresh} onReplace={replace} />)}
      {cursor && <button type="button" disabled={loadingMore} onClick={more} className="w-full rounded-xl border border-emerald-600 p-3 text-sm font-bold text-emerald-700 disabled:opacity-50">{loadingMore ? 'Loading…' : 'Load more posts'}</button>}
    </>}
  </div>;
}
