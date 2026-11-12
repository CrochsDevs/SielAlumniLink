import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/axios';
import ProfileAvatar from '../profile/ProfileAvatar';
import ContentSkeleton from '../ui/Skeleton';
import { profilePath } from '../search/searchLinks';
import { FeedDialog } from './FeedComposer';

export default function PostLikesDialog({ postId, onClose }) {
  const [people, setPeople] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const controller = useRef(null);
  const load = useCallback(async (before, signal) => {
    try {
      const { data } = await api.get(`/feed/${postId}/likes`, { params: { before: before || undefined }, signal });
      if (signal.aborted) return;
      setPeople(previous => before
        ? [...previous, ...data.data.people.filter(person => !previous.some(row => row.authId === person.authId))]
        : data.data.people);
      setCursor(data.data.nextCursor);
      setError('');
    } catch (err) {
      if (!signal.aborted) setError(err.response?.data?.message || 'Unable to load likes. Please try again.');
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [postId]);
  useEffect(() => {
    const request = new AbortController();
    controller.current = request;
    Promise.resolve().then(() => {
      if (!request.signal.aborted) load(null, request.signal);
    });
    return () => request.abort();
  }, [load]);
  const more = () => {
    if (loading) return;
    setLoading(true);
    load(cursor, controller.current.signal);
  };
  return (
    <FeedDialog title="People who liked this post" onClose={onClose}>
      <div className="space-y-2">
        {people.map(person => {
          const content = <>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-50 text-brand">
              <ProfileAvatar user={person} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{person.name}</span>
              <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
                {[person.program, person.batch && `Batch ${person.batch}`].filter(Boolean).join(' · ')}
              </span>
            </span>
          </>;
          const className = 'flex items-center gap-3 rounded-xl p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800';
          return person._id
            ? <Link key={person.authId} to={profilePath(person)} onClick={onClose} className={className}>{content}</Link>
            : <div key={person.authId} className={className}>{content}</div>;
        })}
        {loading && <ContentSkeleton variant="list" count={3} label="Loading likes" />}
        {!loading && !error && people.length === 0 && <p className="py-4 text-sm text-zinc-500 dark:text-zinc-400">No likes yet.</p>}
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error} <button type="button" disabled={loading} onClick={more} className="underline">Retry</button></p>}
        {cursor && !error && <button type="button" disabled={loading} onClick={more} className="rounded-lg px-3 py-2 text-sm font-semibold text-brand disabled:opacity-50">Show more</button>}
      </div>
    </FeedDialog>
  );
}
