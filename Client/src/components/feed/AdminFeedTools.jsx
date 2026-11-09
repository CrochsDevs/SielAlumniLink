import ContentSkeleton from "../ui/Skeleton";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Shield, Users } from "lucide-react";
import api from "../../utils/axios";
import { getSocket } from "../../realtime/socket";

export default function AdminFeedTools() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null);
  const pending = useRef(false);
  const generation = useRef(0);
  const load = useCallback(async () => {
    const request = ++generation.current;
    try {
      const response = await api.get("/feed/restrictions");
      if (request === generation.current) {
        setMembers(response.data.data);
        setError("");
      }
    } catch (err) {
      if (request === generation.current)
        setError(
          err.response?.data?.message || "Unable to load restricted members.",
        );
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    Promise.resolve().then(load);
    const socket = getSocket();
    socket.on("feed:changed", load);
    socket.on("connect", load);
    return () => {
      socket.off("feed:changed", load);
      socket.off("connect", load);
      // Invalidate pending requests; this ref is a sequence counter, not a DOM node.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ++generation.current;
    };
  }, [load]);
  const restore = async (authId) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(authId);
    setError("");
    try {
      await api.put(`/feed/restrictions/${authId}`, { enabled: false });
      await load();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to restore member participation.",
      );
    } finally {
      pending.current = false;
      setBusy(null);
    }
  };
  return (
    <div className="space-y-3">
      <section className="overflow-hidden rounded-2xl border border-brand/10 bg-white shadow-sm dark:bg-zinc-900">
        <div className="bg-zinc-50 px-4 py-2.5 dark:bg-zinc-800">
        <h2 className="flex items-center gap-1.5 text-[12.5px] font-bold text-zinc-800 dark:text-zinc-100">
          <Shield size={14} />
          Feed moderation
        </h2>
        </div>
        <div className="p-4">
        <p className="text-[11.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          Use the three-dot menu on a post to block content, manage comments,
          restrict a member, or delete a post. Use the feed filter to review
          blocked posts.
        </p>
        <p className="mt-2 text-[11.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          You can review public and connections-only posts. Restoring content
          preserves its original audience.
        </p>
        <Link
          to="/admin/users"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 py-1.5 text-[11px] font-bold text-zinc-500 transition hover:border-brand hover:text-brand dark:border-zinc-700 dark:text-zinc-400"
        >
          <Users size={15} />
          Manage users
        </Link>
        </div>
      </section>
      <section className="rounded-2xl border border-brand/10 bg-white p-4 shadow-sm dark:bg-zinc-900">
        <h2 className="text-[13px] font-bold">Restricted members</h2>
        {error && (
          <p
            role="alert"
            className="mt-3 text-xs text-red-600 dark:text-red-400"
          >
            {error}{" "}
            <button type="button" onClick={load} className="underline">
              Retry
            </button>
          </p>
        )}
        {loading ? (
          <ContentSkeleton variant="list" count={3} label="Loading members…" />
        ) : !members.length ? (
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            No restricted members.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {members.map((member) => (
              <li
                key={member.author.authId}
                className="border-t border-zinc-100 pt-3 first:border-0 first:pt-0 dark:border-zinc-800"
              >
                <p className="break-words text-xs font-semibold">
                  {member.author.name}
                </p>
                <p className="mt-1 break-words text-xs text-zinc-500 dark:text-zinc-400">
                  {member.reason}
                </p>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => restore(member.author.authId)}
                  className="mt-2 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-brand disabled:opacity-50 dark:border-zinc-700"
                >
                  {busy === member.author.authId
                    ? "Restoring…"
                    : "Restore participation"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
