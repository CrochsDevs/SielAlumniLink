import ContentSkeleton from "../ui/Skeleton";
import { useRef, useState } from "react";
import { ArrowUpRight, BookOpen, Clock3, Globe, Users, PenLine, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { FeedDialog } from "../feed/FeedComposer";
import FeedImages from "../feed/FeedImages";
import ProfileAvatar from "../profile/ProfileAvatar";
import { profilePath } from "../search/searchLinks";
import api from "../../utils/axios";
import "./StoryReader.css";
import {
  readingTime,
  secondaryButton,
  storyDate,
  storySections,
  storyTopic,
} from "./storyUi";

export default function StoryReader({
  post,
  loading,
  error,
  onRetry,
  onClose,
  onDeleted,
  onEdit,
  isAdmin,
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const pending = useRef(false);
  const remove = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setDeleteError("");
    try {
      await api.delete(`/feed/${post._id}`);
      onDeleted(post._id);
      onClose();
    } catch (err) {
      setDeleteError(
        err.response?.data?.message ||
          "Unable to delete this story. Please try again.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <FeedDialog title="Read success story" busy={busy} onClose={onClose} wide className="story-reader-dialog" header={<div className="story-reader-heading"><span className="story-reader-heading-icon"><BookOpen size={20} aria-hidden="true" /></span><div><p>Success story</p><span>From our alumni community</span></div></div>}>
      <div className="story-reader-content" tabIndex={0} role="region" aria-label="Story content">
      {loading ? (
        <ContentSkeleton variant="detail" count={1} label="Loading story…" />
      ) : error ? (
        <p role="alert" className="py-5 text-sm text-red-600 dark:text-red-400">
          {error}{" "}
          <button type="button" onClick={onRetry} className="underline">
            Retry
          </button>
        </p>
      ) : (
        post && (
          <article className="story-reader-article">
            <div className="story-reader-eyebrow">
            <span
              className={`inline-block rounded-full px-3 py-1.5 text-[10px] font-semibold ${storyTopic(post).style}`}
            >
              {storyTopic(post).singular}
            </span>
              <span className="story-reader-reading-time"><Clock3 size={13} aria-hidden="true" />{readingTime(post)} min read</span>
            </div>
            <h3 className="story-reader-title mt-4 break-words text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
              {post.title}
            </h3>
            <div className="story-reader-author mb-6 mt-5 flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-50 text-brand dark:bg-zinc-800">
                <ProfileAvatar user={post.author} />
              </span>
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold">
                  {post.author?.name || "Alumni community member"}
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {[
                    post.author?.program,
                    post.author?.batch && `Batch ${post.author.batch}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </div>
            <div className="story-reader-meta">
              <time dateTime={post.createdAt}>{storyDate(post.createdAt)}</time>
              <span aria-hidden="true">·</span>
              <span>{post.audience === 'connections' ? <Users size={13} aria-hidden="true" /> : <Globe size={13} aria-hidden="true" />}{post.audience === 'connections' ? 'Connections only' : 'Public'}</span>
            </div>
            {!!post.images?.length && <div className="story-reader-media"><FeedImages images={post.images} /></div>}
            <div className="story-reader-sections mt-6 space-y-7">
              {storySections(post).map(([title, body]) => (
                <section key={title}>
                  <h4 className="mb-3 text-sm font-semibold text-brand dark:text-brand">
                    {title}
                  </h4>
                  <p className="whitespace-pre-wrap break-words text-sm leading-8 text-zinc-600 [overflow-wrap:anywhere] dark:text-zinc-300">
                    {body}
                  </p>
                </section>
              ))}
            </div>
            {confirming && (
              <div className="story-reader-confirmation mt-4 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
                <p className="text-sm font-medium">
                  Delete this story from the community?
                </p>
                {deleteError && (
                  <p
                    role="alert"
                    className="mt-2 text-sm text-red-600 dark:text-red-400"
                  >
                    {deleteError}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirming(false)}
                    className={secondaryButton}
                  >
                    Keep story
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={remove}
                    className="min-h-11 rounded-xl bg-red-600 px-4 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {busy ? "Deleting…" : "Confirm delete"}
                  </button>
                </div>
              </div>
            )}
          </article>
        )
      )}
      </div>
      {post && !loading && !error && <footer className="story-reader-footer">
        {post.author?._id && <Link to={profilePath(post.author)} className="story-reader-author-link">Meet the author<ArrowUpRight size={14} /></Link>}
        <div className="story-reader-actions">
          {post.isMine && onEdit && <button type="button" disabled={busy} onClick={() => onEdit(post)} className={secondaryButton}><PenLine size={14} />Edit story</button>}
          {(post.isMine || isAdmin) && <button type="button" disabled={busy} onClick={() => {
            setConfirming(true);
            requestAnimationFrame(() => document.querySelector('.story-reader-confirmation')?.scrollIntoView({ block: 'nearest' }));
          }} className="story-reader-delete"><Trash2 size={14} />Delete story</button>}
          <button type="button" onClick={onClose} disabled={busy} className="story-reader-close">Close story</button>
        </div>
      </footer>}
    </FeedDialog>
  );
}
