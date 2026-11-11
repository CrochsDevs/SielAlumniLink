import ContentSkeleton from "../ui/Skeleton";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ThumbsUp,
  MessageSquare,
  Repeat2,
  Send,
  Globe,
  Users,
  Trash2,
  CalendarDays,
  MoreHorizontal,
  Shield,
  Ban,
  MessageSquareOff,
  Undo2,
  UserRound,
  LoaderCircle,
} from "lucide-react";
import api from "../../utils/axios";
import { useChat } from "../../context/useChat";
import ProfileAvatar from "../profile/ProfileAvatar";
import { profilePath } from "../search/searchLinks";
import { AudienceSelect, FeedDialog } from "./FeedComposer";
import FeedImages from "./FeedImages";

const buttonClass =
  "rounded-lg px-3 py-2 text-sm font-semibold text-brand hover:bg-emerald-50 disabled:opacity-50 dark:text-brand dark:hover:bg-zinc-800";
const formatDate = (value) =>
  new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });

function Author({ person, createdAt, audience }) {
  const content = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-50 text-brand">
        <ProfileAvatar user={person} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold">{person.name}</span>
        <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
          {[person.program, person.batch && `Batch ${person.batch}`]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
    </>
  );
  return (
    <div className="flex-1 min-w-0">
      {person._id ? (
        <Link
          to={profilePath(person)}
          className="flex items-center gap-2 no-underline hover:no-underline"
        >
          {content}
        </Link>
      ) : (
        <div className="flex items-center gap-2">{content}</div>
      )}
      <span className="mt-1 flex flex-wrap items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
        {formatDate(createdAt)}
        {audience && (
          <>
            {" "}
            ·{" "}
            {audience === "public" ? (
              <Globe size={12} />
            ) : (
              <Users size={12} />
            )}{" "}
            {audience === "public" ? "Public" : "Connections only"}
          </>
        )}
      </span>
    </div>
  );
}

function PostContent({ post, onRsvp, busy = false }) {
  const [expanded, setExpanded] = useState(false);
  const details = post.details || {};
  const longBody = (post.body || "").length > 600;
  return (
    <>
      {post.type !== 'update' && <span className="inline-block rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold capitalize text-brand dark:bg-zinc-800 dark:text-brand">
        {post.type === "story" ? "Success story" : post.type}
      </span>}
      {post.title && <h3 className="mt-2 text-base font-bold">{post.title}</h3>}
      {post.body && (
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]">
          {longBody && !expanded ? `${post.body.slice(0, 600)}…` : post.body}
        </p>
      )}
      {longBody && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="mt-2 min-h-9 text-xs font-semibold text-brand dark:text-brand"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
      {post.type === "story" && !post.originalPost && (
        <Link
          to={`/stories?story=${post._id}`}
          className="mt-3 block text-xs font-semibold text-brand hover:underline dark:text-brand"
        >
          Read full success story
        </Link>
      )}
      <FeedImages images={post.images} />
      {(details.organization || details.location) && (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          {[details.organization, details.location].filter(Boolean).join(" · ")}
        </p>
      )}
      {post.type === "event" && details.startAt && (
        <div className="mt-3 space-y-2 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800">
          <p className="flex items-center gap-2 text-sm">
            <CalendarDays size={16} />
            {formatDate(details.startAt)}
            {details.endAt && ` – ${formatDate(details.endAt)}`}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {post.attendingCount} attending
          </p>
          {onRsvp && (
            <button
              type="button"
              disabled={busy}
              onClick={onRsvp}
              className={buttonClass}
            >
              {post.attendingByMe ? "Cancel RSVP" : "Attend event"}
            </button>
          )}
        </div>
      )}
      {details.link && (
        <a
          href={details.link}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm font-bold text-brand underline dark:text-brand"
        >
          {post.type === "event"
            ? "Register for this event"
            : "View opportunity / apply"}
        </a>
      )}
    </>
  );
}

function CommentReplies({ postId, comment, revision, onChanged, isAdmin, disabled }) {
  const [expanded, setExpanded] = useState(false);
  const [target, setTarget] = useState(null);
  const [body, setBody] = useState('');
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const request = useRef(0);
  const input = useRef(null);
  const load = useCallback(async (before = null) => {
    const ticket = ++request.current;
    setLoading(true);
    try {
      const response = await api.get(`/feed/${postId}/comments`, { params: { parentCommentId: comment._id, before: before || undefined } });
      if (ticket !== request.current) return;
      const data = response.data.data;
      setItems(previous => before ? [...previous, ...data.comments.filter(row => !previous.some(current => current._id === row._id))] : data.comments);
      setCursor(data.nextCursor);
      setError('');
    } catch (err) {
      if (ticket === request.current) setError(err.response?.data?.message || 'Unable to load replies.');
    } finally {
      if (ticket === request.current) setLoading(false);
    }
  }, [postId, comment._id]);
  useEffect(() => {
    let active = true;
    if (expanded) Promise.resolve().then(() => { if (active) void load(); });
    return () => {
      active = false;
      // Request sequence counter; discard results for a closed/unmounted thread.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ++request.current;
    };
  }, [expanded, load, revision]);
  const replyTo = row => {
    setExpanded(true);
    setTarget(row);
    requestAnimationFrame(() => input.current?.focus());
  };
  const submit = async event => {
    event.preventDefault();
    if (pending.current || disabled || !body.trim() || !target) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await api.post(`/feed/${postId}/comments`, { body, parentCommentId: target._id });
      setBody('');
      setTarget(null);
      await load();
      onChanged();
    } catch (err) { setError(err.response?.data?.message || 'Unable to post reply. Your draft is saved here.'); }
    finally { pending.current = false; setBusy(false); }
  };
  const remove = async id => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      await api.delete(`/feed/${postId}/comments/${id}`);
      await load();
      onChanged();
    } catch (err) { setError(err.response?.data?.message || 'Unable to delete reply.'); }
    finally { pending.current = false; setBusy(false); }
  };
  return <div className="mt-1">
    <div className="flex flex-wrap items-center gap-3">
      {!disabled && <button type="button" disabled={busy} onClick={() => replyTo(comment)} className="min-h-9 px-2 text-xs font-semibold text-brand hover:underline">Reply</button>}
      {(comment.repliesCount > 0 || items.length > 0) && <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)} className="min-h-9 text-xs font-semibold text-zinc-500 hover:underline dark:text-zinc-400">{expanded ? 'Hide replies' : `View ${comment.repliesCount || items.length} ${(comment.repliesCount || items.length) === 1 ? 'reply' : 'replies'}`}</button>}
    </div>
    {expanded && <div className="ml-3 space-y-3 border-l-2 border-zinc-200 pl-3 sm:ml-8 dark:border-zinc-700" aria-label={`Replies to ${comment.author.name}`}>
      {loading && <p role="status" className="text-xs text-zinc-500">Loading replies…</p>}
      {items.map(row => <div key={row._id} className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800">
        <div className="flex items-start justify-between gap-2">
          <Author person={row.author} createdAt={row.createdAt} />
          {(row.isMine || isAdmin) && <button type="button" disabled={busy} aria-label="Delete reply" onClick={() => remove(row._id)} className="p-1 text-zinc-500 hover:text-red-600"><Trash2 size={14} /></button>}
        </div>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">{row.body}</p>
        {!disabled && <button type="button" disabled={busy} onClick={() => replyTo(row)} className="mt-1 min-h-9 text-xs font-semibold text-brand hover:underline">Reply</button>}
      </div>)}
      {cursor && <button type="button" disabled={loading || busy} onClick={() => load(cursor)} className={buttonClass}>Older replies</button>}
      {target && !disabled && <form onSubmit={submit} className="space-y-2">
        <p className="text-xs text-zinc-500">Replying to {target.author.name} <button type="button" disabled={busy} onClick={() => setTarget(null)} className="ml-2 underline">Cancel reply</button></p>
        <div className="flex items-start gap-2">
          <textarea ref={input} disabled={busy} aria-label={`Reply to ${target.author.name}`} rows={2} required maxLength={2000} value={body} onChange={event => setBody(event.target.value)} placeholder="Write a reply…" className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-transparent p-2 text-sm dark:border-zinc-700" />
          <button type="submit" disabled={busy || !body.trim()} className={buttonClass}>{busy ? 'Sending…' : 'Post reply'}</button>
        </div>
      </form>}
      {error && <p role="alert" className="text-sm text-red-600">{error} <button type="button" disabled={busy || loading} onClick={() => load()} className="underline">Retry loading replies</button></p>}
    </div>}
  </div>;
}

function Comments({ postId, revision, onChanged, isAdmin, disabled = false }) {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const load = useCallback(async () => {
    try {
      const res = await api.get(`/feed/${postId}/comments`);
      setItems(res.data.data.comments);
      setCursor(res.data.data.nextCursor);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load comments");
    } finally {
      setLoading(false);
    }
  }, [postId]);
  useEffect(() => {
    Promise.resolve().then(load);
  }, [load, revision]);
  const more = async () => {
    setBusy(true);
    try {
      const res = await api.get(`/feed/${postId}/comments`, {
        params: { before: cursor },
      });
      setItems((prev) => [
        ...prev,
        ...res.data.data.comments.filter(
          (c) => !prev.some((p) => p._id === c._id),
        ),
      ]);
      setCursor(res.data.data.nextCursor);
    } catch {
      setError("Unable to load more comments");
    } finally {
      setBusy(false);
    }
  };
  const submit = async (e) => {
    e.preventDefault();
    if (pending.current || !body.trim()) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await api.post(`/feed/${postId}/comments`, { body });
      setBody("");
      await load();
      onChanged();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to add comment");
    } finally {
      setBusy(false);
      pending.current = false;
    }
  };
  const remove = async (id) => {
    setBusy(true);
    try {
      await api.delete(`/feed/${postId}/comments/${id}`);
      await load();
      onChanged();
    } catch {
      setError("Unable to delete comment");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3 border-t border-zinc-100 p-4 dark:border-zinc-800">
      {disabled ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Commenting is unavailable for this post.
        </p>
      ) : (
        <form onSubmit={submit} className="flex items-start gap-2">
          <textarea
            aria-label="Write a comment"
            autoFocus
            rows={2}
            required
            maxLength={2000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a comment…"
            className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-transparent p-2 text-sm dark:border-zinc-700"
          />
          <button disabled={busy || !body.trim()} className={buttonClass}>
            Post
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}{" "}
          <button onClick={load} className="underline">
            Retry
          </button>
        </p>
      )}
      {loading ? (
        <ContentSkeleton variant="list" count={3} label="Loading comments…" />
      ) : (
        items.length === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Start the conversation.
          </p>
        )
      )}
      {items.map((c) => (
        <div key={c._id}>
        <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800">
          <div className="flex items-start justify-between gap-2">
            <Author person={c.author} createdAt={c.createdAt} />
            {(c.isMine || isAdmin) && (
              <button
                type="button"
                disabled={busy}
                aria-label="Delete comment"
                onClick={() => remove(c._id)}
                className="p-1 text-zinc-500 hover:text-red-600 dark:text-zinc-400"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm">
            {c.body}
          </p>
        </div>
        <CommentReplies postId={postId} comment={c} revision={revision} onChanged={onChanged} isAdmin={isAdmin} disabled={disabled} />
        </div>
      ))}
      {cursor && (
        <button
          type="button"
          disabled={busy}
          onClick={more}
          className={buttonClass}
        >
          Older comments
        </button>
      )}
    </div>
  );
}

function ShareDialog({ post, onClose, onChanged }) {
  const [audience, setAudience] = useState(post.audience);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const original = post.originalPost || post;
  const share = async (e) => {
    e.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await api.post(`/feed/${post._id}/share`, { body, audience });
      onChanged();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to share post");
    } finally {
      setBusy(false);
      pending.current = false;
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/feed?post=${post._id}`,
      );
      setError("Link copied. Viewing the post still requires access.");
    } catch {
      setError("Unable to copy. Use the post link in your address bar.");
    }
  };
  return (
    <FeedDialog title="Share this post" onClose={onClose} busy={busy}>
      <form onSubmit={share} className="space-y-3">
        <AudienceSelect
          value={audience}
          onChange={setAudience}
          privateOnly={original.audience === "connections"}
        />
        {original.audience === "connections" && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Only connections who can also see the original post can see this
            repost.
          </p>
        )}
        <textarea
          aria-label="Add your thoughts"
          maxLength={10000}
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add your thoughts (optional)…"
          className="w-full rounded-xl border border-zinc-300 bg-transparent p-3 text-sm dark:border-zinc-700"
        />
        {error && (
          <p role="status" className="text-sm">
            {error}
          </p>
        )}
        <div className="flex justify-between">
          <button type="button" onClick={copy} className={buttonClass}>
            Copy link
          </button>
          <button disabled={busy} className={buttonClass}>
            {busy ? "Sharing…" : "Repost to feed"}
          </button>
        </div>
      </form>
    </FeedDialog>
  );
}

function ShareLinkDialog({ post, onClose }) {
  const [status, setStatus] = useState("");
  const url = `${window.location.origin}/feed?post=${post._id}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Link copied.");
    } catch {
      setStatus("Select the link above and copy it manually.");
    }
  };
  return (
    <FeedDialog title="Share post link" onClose={onClose}>
      <p className="mb-3 text-sm">
        Copy this link to share the post. Viewing it requires permission.
      </p>
      <input
        readOnly
        aria-label="Post link"
        value={url}
        onFocus={(event) => event.target.select()}
        className="w-full rounded-lg border p-3 text-sm dark:bg-zinc-950"
      />
      <button type="button" onClick={copy} className={`${buttonClass} mt-3`}>
        Copy link
      </button>
      {status && (
        <p
          role="status"
          className="mt-2 text-xs text-brand dark:text-brand"
        >
          {status}
        </p>
      )}
    </FeedDialog>
  );
}

function SendDialog({ post, onClose }) {
  const { openChatByEmail, openChat, refreshConvos } = useChat();
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [recipientType, setRecipientType] = useState('connections');
  const [sendingTo, setSendingTo] = useState(null);
  const busy = sendingTo !== null;
  const [error, setError] = useState("");
  const pending = useRef(false);
  useEffect(() => {
    let cancelled = false;
    api
      .get(`/feed/${post._id}/recipients`)
      .then((res) => {
        if (!cancelled) setPeople(res.data.data);
      })
      .catch(() => {
        if (!cancelled)
          setError(
            "Unable to load recipients. Please close and try again.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [post._id]);
  const send = async (person) => {
    if (pending.current) return;
    pending.current = true;
    setSendingTo(person.conversationId || person.authId);
    setError("");
    try {
      const { data } = await api.post(`/feed/${post._id}/send`, person.isGroup
        ? { conversationId: person.conversationId }
        : { recipientAuthId: person.authId });
      if (person.isGroup) {
        await refreshConvos();
        openChat({ _id: data.data.conversationId, name: person.name, isGroup: true, memberCount: person.memberCount });
      } else await openChatByEmail(person.email);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to send post");
    } finally {
      setSendingTo(null);
      pending.current = false;
    }
  };
  const groupsSelected = recipientType === 'groups';
  const filtered = people.filter((person) =>
    Boolean(person.isGroup) === groupsSelected &&
    `${person.name} ${person.email || ''}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <FeedDialog
      title="Send to a connection or group"
      onClose={onClose}
      busy={busy}
    >
      <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
        Send a post link and open your conversation. Recipients must have
        permission to view this post.
      </p>
      <div role="group" aria-label="Recipient type" className="mb-3 flex gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
        {[
          { value: 'connections', label: 'Connections', icon: <UserRound size={17} aria-hidden="true" /> },
          { value: 'groups', label: 'Groups', icon: <Users size={17} aria-hidden="true" /> },
        ].map(({ value, label, icon }) => (
          <button
            key={value}
            type="button"
            aria-pressed={recipientType === value}
            disabled={busy}
            onClick={() => { setRecipientType(value); setQuery(''); }}
            className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 ${recipientType === value ? 'bg-brand text-white shadow-sm' : 'text-zinc-600 hover:bg-white dark:text-zinc-300 dark:hover:bg-zinc-700'}`}
          >
            {icon}{label}
          </button>
        ))}
      </div>
      <input
        aria-label={groupsSelected ? 'Search groups' : 'Search connections'}
        disabled={busy}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={groupsSelected ? 'Search groups…' : 'Search connections…'}
        className="mb-3 w-full rounded-xl border border-zinc-300 bg-transparent p-3 text-sm dark:border-zinc-700"
      />
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {loading ? (
        <ContentSkeleton variant="list" count={3} label="Loading recipients…" />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {query ? `No matching ${groupsSelected ? 'groups' : 'connections'}.` : groupsSelected ? 'No group chats available.' : 'No connections available.'}
        </p>
      ) : (
        <ul aria-label={groupsSelected ? 'Group chats' : 'Connections'} className="max-h-[45dvh] space-y-2 overflow-y-auto overscroll-contain p-0.5">
          {filtered.map((person) => (
            <li
              key={person.isGroup ? `group-${person.conversationId}` : person.authId}
              className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand dark:bg-brand/20" aria-hidden="true">
                {person.isGroup ? <Users size={19} /> : (person.name || '?').charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 text-sm font-semibold">
                <span className="block truncate">{person.name}</span>
                {person.isGroup && <span className="flex items-center gap-1 text-xs font-normal text-zinc-500 dark:text-zinc-400"><Users size={13} />Group chat</span>}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => send(person)}
                aria-label={`Send post to ${person.name}`}
                aria-busy={sendingTo === (person.conversationId || person.authId)}
                className="inline-flex min-h-11 min-w-24 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sendingTo === (person.conversationId || person.authId) ? <><LoaderCircle size={16} className="animate-spin" aria-hidden="true" />Sending…</> : <><Send size={16} aria-hidden="true" />Send</>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </FeedDialog>
  );
}

function ModerationDialog({ post, action, onClose, onChanged }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const enabled =
    action === "block"
      ? !post.moderation?.blocked
      : action === "comments"
        ? !post.commentsDisabled
        : !post.moderation?.authorRestricted;
  const title =
    action === "block"
      ? enabled
        ? "Block this post"
        : "Restore this post"
      : action === "comments"
        ? enabled
          ? "Turn off comments"
          : "Turn on comments"
        : enabled
          ? "Restrict member from feed"
          : "Restore member participation";
  const descriptions = {
    block: enabled
      ? "This post and its reposts will be hidden from members. Administrators can review and restore it."
      : "The post will be visible again to its original audience.",
    comments: enabled
      ? "Existing comments stay visible. New comments will be disabled."
      : "Members can comment again.",
    restrict: enabled
      ? `${post.author.name} will be unable to publish, repost, comment, like, or RSVP. They can still read posts. Existing posts stay available unless you block them separately.`
      : `${post.author.name} can participate in the feed again.`,
  };
  const submit = async (event) => {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await api.put(
        action === "restrict"
          ? `/feed/restrictions/${post.author.authId}`
          : `/feed/${post._id}/moderation`,
        { action, enabled, reason },
      );
      onChanged();
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to apply moderation. Please try again.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <FeedDialog title={title} busy={busy} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm leading-relaxed">{descriptions[action]}</p>
        <label className="block text-sm font-medium">
          Reason {enabled ? "(required)" : "(optional)"}
          <textarea
            aria-label="Moderation reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required={enabled}
            maxLength={500}
            rows={3}
            className="mt-2 w-full rounded-xl border border-zinc-300 bg-transparent p-3 text-sm dark:border-zinc-600"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || (enabled && !reason.trim())}
          className="rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : title}
        </button>
      </form>
    </FeedDialog>
  );
}

export default function FeedPost({
  post,
  user,
  revision,
  onChanged,
  onReplace,
  restricted = false,
}) {
  const { openChatByEmail } = useChat();
  const [showComments, setShowComments] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const canPublish = ["alumni", "admin"].includes(user?.role);
  const isAdmin = user?.role === "admin";
  const interactionDisabled = busy || restricted || !!post.moderation?.blocked;
  const menuButton =
    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800";
  const act = async (path, data) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const res = await api.put(`/feed/${path}`, data);
      onReplace(res.data.data);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to update post. Please try again.",
      );
    } finally {
      setBusy(false);
      pending.current = false;
    }
  };
  const contactAuthor = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await openChatByEmail(post.author.email);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to message this author. Connect with them first, then try again.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const remove = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      await api.delete(`/feed/${post._id}`);
      onChanged();
      setDialog(null);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to delete post");
    } finally {
      setBusy(false);
      pending.current = false;
    }
  };
  return (
    <article
      id={`post-${post._id}`}
      className="rounded-2xl border border-brand/10 bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
    >
      <div className="flex gap-2 p-4">
        <Author
          person={post.author}
          audience={post.audience}
          createdAt={post.createdAt}
        />
        {isAdmin ? (
          <details className="relative shrink-0 self-start">
            <summary
              aria-label="Admin post controls"
              className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 [&::-webkit-details-marker]:hidden dark:hover:bg-zinc-800 dark:text-zinc-400"
            >
              <MoreHorizontal size={20} />
            </summary>
            <div
              className="absolute right-0 z-30 mt-1 w-56 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
              onClick={(event) => {
                event.currentTarget.closest("details").open = false;
              }}
            >
              <button
                type="button"
                disabled={busy}
                onClick={() => setDialog("block")}
                className={menuButton}
              >
                {post.moderation?.blocked ? (
                  <Undo2 size={15} />
                ) : (
                  <Ban size={15} />
                )}
                {post.moderation?.blocked ? "Restore post" : "Block post"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setDialog("comments")}
                className={menuButton}
              >
                <MessageSquareOff size={15} />
                {post.commentsDisabled
                  ? "Turn on comments"
                  : "Turn off comments"}
              </button>
              {post.author.role !== "admin" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setDialog("restrict")}
                  className={menuButton}
                >
                  <Shield size={15} />
                  {post.moderation?.authorRestricted
                    ? "Restore member participation"
                    : "Restrict member from feed"}
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => setDialog("delete")}
                className={`${menuButton} text-red-600 dark:text-red-400`}
              >
                <Trash2 size={15} />
                Delete post
              </button>
            </div>
          </details>
        ) : (
          post.isMine && (
            <button
              type="button"
              onClick={() => setDialog("delete")}
              aria-label="Delete post"
              className="self-start rounded-lg p-2 text-zinc-500 hover:text-red-600 dark:text-zinc-400"
            >
              <Trash2 size={16} />
            </button>
          )
        )}
      </div>
      {isAdmin &&
        (post.moderation?.blocked || post.moderation?.authorRestricted) && (
          <div className="mx-4 mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <p className="font-semibold">
              {post.moderation.blocked
                ? "Blocked post · Only administrators can see this"
                : "Member participation restricted"}
            </p>
            <p className="mt-1 break-words">
              {post.moderation.blocked
                ? post.moderation.reason
                : post.moderation.authorRestrictionReason}
            </p>
          </div>
        )}
      <div className="px-4 pb-4">
        <PostContent
          post={post}
          busy={interactionDisabled}
          onRsvp={
            !post.originalPost && post.type === "event"
              ? () =>
                  act(`${post._id}/rsvp`, { attending: !post.attendingByMe })
              : null
          }
        />
        {["referral", "hiring"].includes(post.type) &&
          !post.originalPost &&
          !post.details?.link &&
          !post.isMine && (
            <button
              type="button"
              disabled={busy || !post.author?.email}
              onClick={contactAuthor}
              className={buttonClass}
            >
              Message author about this opportunity
            </button>
          )}
        {post.originalPost && (
          <div className="mt-3 space-y-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-[0_4px_14px_rgba(0,0,0,0.16)] dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-[0_4px_14px_rgba(0,0,0,0.4)]">
            <Author
              person={post.originalPost.author}
              audience={post.originalPost.audience}
              createdAt={post.originalPost.createdAt}
            />
            <PostContent
              post={post.originalPost}
              busy={
                interactionDisabled || !!post.originalPost.moderation?.blocked
              }
              onRsvp={
                post.originalPost.type === "event"
                  ? () =>
                      act(`${post.originalPost._id}/rsvp`, {
                        attending: !post.originalPost.attendingByMe,
                      })
                  : null
              }
            />
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 px-4 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        <span>
          {post.likesCount} {post.likesCount === 1 ? "like" : "likes"}
        </span>
        <button
          onClick={() => setShowComments((prev) => !prev)}
          className="hover:underline"
        >
          {post.commentsCount} comments · {post.sharesCount} reposts
        </button>
      </div>
      <div className="grid grid-cols-4 border-t border-zinc-100 px-1 py-1 sm:px-2 dark:border-zinc-800">
        <button
          type="button"
          disabled={interactionDisabled}
          aria-pressed={post.likedByMe}
          onClick={() => act(`${post._id}/like`, { liked: !post.likedByMe })}
          className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-0 py-3 text-xs sm:flex-row sm:px-1 font-semibold hover:bg-emerald-50 disabled:opacity-50 dark:hover:bg-zinc-800 ${post.likedByMe ? "text-brand dark:text-brand" : "text-zinc-500 dark:text-zinc-400"}`}
        >
          <ThumbsUp size={16} />
          {post.likedByMe ? "Liked" : "Like"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setShowComments((prev) => !prev)}
          className="flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-0 py-3 text-xs sm:flex-row sm:px-1 font-semibold text-zinc-500 hover:bg-emerald-50 dark:hover:bg-zinc-800 dark:text-zinc-400"
        >
          <MessageSquare size={16} />
          Comment
        </button>
        <button
          type="button"
          disabled={interactionDisabled}
          onClick={() => setDialog("share")}
          className="flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-0 py-3 text-xs sm:flex-row sm:px-1 font-semibold text-zinc-500 hover:bg-emerald-50 dark:hover:bg-zinc-800 dark:text-zinc-400"
        >
          <Repeat2 size={16} />
          Share
        </button>
        <button
          type="button"
          disabled={busy || !!post.moderation?.blocked}
          onClick={() => setDialog("send")}
          className="flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-0 py-3 text-xs sm:flex-row sm:px-1 font-semibold text-zinc-500 hover:bg-emerald-50 dark:hover:bg-zinc-800 dark:text-zinc-400"
        >
          <Send size={16} />
          Send
        </button>
      </div>
      {error && (
        <p
          role="alert"
          className="px-4 pb-3 text-sm text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      )}
      {post.commentsDisabled && (
        <p className="px-4 pb-3 text-xs text-zinc-500 dark:text-zinc-400">
          Comments are turned off.
        </p>
      )}
      {showComments && (
        <Comments
          postId={post._id}
          revision={revision}
          onChanged={onChanged}
          isAdmin={isAdmin}
          disabled={
            restricted || post.commentsDisabled || post.moderation?.blocked
          }
        />
      )}
      {isAdmin && ["block", "comments", "restrict"].includes(dialog) && (
        <ModerationDialog
          post={post}
          action={dialog}
          onChanged={onChanged}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "share" &&
        (canPublish ? (
          <ShareDialog
            post={post}
            onChanged={onChanged}
            onClose={() => setDialog(null)}
          />
        ) : (
          <ShareLinkDialog post={post} onClose={() => setDialog(null)} />
        ))}
      {dialog === "send" && (
        <SendDialog post={post} onClose={() => setDialog(null)} />
      )}
      {dialog === "delete" && (
        <FeedDialog
          title="Delete this post?"
          busy={busy}
          onClose={() => setDialog(null)}
        >
          <p className="text-sm">
            This post and any reposts of it will disappear from feeds.
          </p>
          <button
            disabled={busy}
            onClick={remove}
            className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white"
          >
            {busy ? "Deleting…" : "Delete post"}
          </button>
        </FeedDialog>
      )}
    </article>
  );
}
