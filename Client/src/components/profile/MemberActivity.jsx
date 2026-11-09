import ContentSkeleton from "../ui/Skeleton";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowUpRight, FileText, MessageCircle, RefreshCw, UserRound, ShieldCheck } from "lucide-react";
import api from "../../utils/axios";
import { getSocket } from "../../realtime/socket";
import { auditLabel } from "../../utils/auditActions";
import DataPagination from "../ui/data-pagination";

const filters = [["all", "All activity"], ["posts", "Posts"], ["comments", "Comments"],
  ["stories", "Stories"], ["profile", "Profile updates"], ["security", "Security"]];
const adminFilters = [["all", "All activity"], ["admin", "Admin actions"], ["access", "Login/logout"],
  ["security", "Security"], ["posts", "Posts"], ["comments", "Comments"], ["stories", "Stories"], ["profile", "Profile updates"]];

function ActivityList({ filter }) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const refresh = useCallback(() => {
    setPage(1);
    setRevision(value => value + 1);
  }, []);

  useEffect(() => {
    const request = ++generation.current;
    // A different page or filter replaces the displayed records.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");
    setItems([]);
    api.get("/users/me/activity", { params: { type: filter, page, limit: pageSize } })
      .then(({ data }) => {
        if (request !== generation.current) return;
        const result = data.data;
        setItems(result.items);
        setTotal(result.total);
        setTotalPages(result.totalPages);
        // Deletions or access changes can remove the previously selected page.
        if (page > result.totalPages) setPage(result.totalPages);
      })
      .catch(err => {
        if (request !== generation.current) return;
        setTotal(0);
        setTotalPages(1);
        setError(err.response?.data?.message || "Unable to load activity. Please try again.");
      })
      .finally(() => { if (request === generation.current) setLoading(false); });
    return () => { ++generation.current; };
  }, [filter, page, pageSize, revision]);

  useEffect(() => {
    const socket = getSocket();
    let timer;
    const changed = () => { clearTimeout(timer); timer = setTimeout(refresh, 150); };
    const focused = () => { if (!document.hidden) changed(); };
    socket.on("feed:changed", changed);
    socket.on("notification:new", changed);
    socket.on("connect", changed);
    window.addEventListener("focus", focused);
    return () => {
      clearTimeout(timer);
      socket.off("feed:changed", changed);
      socket.off("notification:new", changed);
      socket.off("connect", changed);
      window.removeEventListener("focus", focused);
    };
  }, [refresh]);

  return <div aria-busy={loading}>
    <div className="mt-4 flex items-center justify-between gap-3">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">Most recent first</p>
      <button type="button" onClick={refresh} disabled={loading} aria-label="Refresh activity"
        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-brand hover:bg-brand/10 disabled:opacity-50">
        <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
      </button>
    </div>
    {loading ? <ContentSkeleton variant="list" count={3} label="Loading activity..." /> : <>
      {items.length > 0 && <ol className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800">
        {items.map(item => {
          const Icon = ['security', 'admin'].includes(item.kind) ? ShieldCheck : item.kind === "comment" ? MessageCircle : item.kind === "profile" ? UserRound : FileText;
          const action = item.kind === "admin" ? auditLabel(item.action).toLowerCase()
            : item.kind === "security" ? (item.action === "password_reset" ? "reset your password" : "changed your password")
            : item.kind === "comment" ? "commented on a post" : item.kind === "profile" ? "updated your profile"
            : item.originalPostId ? "reposted" : item.postType === "story" ? "shared a story" : "published a post";
          const date = new Date(item.createdAt);
          return <li key={item._id} className="flex gap-3 py-4">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand"><Icon size={17} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-zinc-700 dark:text-zinc-200"><span className="font-semibold">You</span>{" "}{action}</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                <time dateTime={date.toISOString()} title={date.toLocaleString()}>{date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}{" · "}{date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</time>
                {item.audience && ` · ${item.audience === "connections" ? "Connections only" : "Community"}`}
              </p>
              {item.kind === "admin" ? <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                {item.target?.label && <p>{item.target.label}</p>}
                {item.details && <p className="mt-1 whitespace-pre-wrap break-words text-xs">{item.details}</p>}
              </div>
                : item.kind === "security" ? <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Your password was {item.action === "password_reset" ? "reset" : "changed"} successfully.</p>
                : item.kind === "profile" ? <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Updated {(item.sections || []).join(", ")}.</p> : <>
                {item.kind === "comment" && <p className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-zinc-50 p-3 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">{item.body}</p>}
                <Link to={`/feed?post=${item.postId}`} className="mt-3 block rounded-xl border border-zinc-200 p-3 transition hover:border-brand/50 hover:bg-brand/5 focus-visible:outline-brand dark:border-zinc-700">
                  {item.title && <p className="break-words text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.title}</p>}
                  {item.postBody && <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-sm text-zinc-600 dark:text-zinc-300">{item.postBody}</p>}
                  <span className="mt-2 flex items-center gap-1 text-xs font-semibold text-brand">View {item.postType === "story" ? "story" : "post"}<ArrowUpRight size={13} /></span>
                </Link>
              </>}
            </div>
          </li>;
        })}
      </ol>}
      {!items.length && !error && <div className="py-8 text-center">
        <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">No {filter === "all" ? "activity" : filter === "security" ? "security activity" : [...filters, ...adminFilters].find(([key]) => key === filter)[1].toLowerCase()} to show yet</p>
        <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">Your shared content and new profile updates will appear here. Join a conversation in the community feed to get started.</p>
        <Link to="/feed" className="mt-3 inline-block text-sm font-semibold text-brand">Explore the community feed</Link>
      </div>}
      {error && <div role="alert" className="my-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
        {error} <button type="button" onClick={() => setRevision(value => value + 1)} className="ml-2 font-semibold underline">Try again</button>
      </div>}
      {!error && <DataPagination page={page} totalPages={totalPages} onPageChange={setPage}
        perPage={pageSize} perPageOptions={[5, 10, 20, 30]}
        onPerPageChange={size => { setPageSize(size); setPage(1); }}
        totalItems={total} itemLabel="activities" />}

    </>}
  </div>;
}

export default function MemberActivity({ admin = false }) {
  const [filter, setFilter] = useState("all");
  return <section aria-label="Your activity logs" className="rounded-3xl border border-brand/10 bg-white p-5 shadow-sm dark:bg-zinc-900 sm:p-6">
    <h3 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/10 text-brand"><Activity size={15} /></span>Activity Logs
    </h3>
    <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">Your personal activity history. These logs are visible only to you.</p>
    <div role="group" aria-label="Filter activity" className="mt-4 flex flex-wrap gap-2">
      {(admin ? adminFilters : filters).map(([key, label]) => <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}
        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${filter === key ? "border-brand bg-brand text-white" : "border-zinc-200 text-zinc-600 hover:border-brand hover:text-brand dark:border-zinc-700 dark:text-zinc-300"}`}>{label}</button>)}
    </div>
    <ActivityList key={filter} filter={filter} />
  </section>;
}
