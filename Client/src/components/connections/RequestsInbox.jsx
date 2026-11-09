import ContentSkeleton from "../ui/Skeleton";
import { useCallback, useEffect, useRef, useState } from "react";
import { gooeyToast as toast } from 'goey-toast';
import { Check, X, UserPlus, Inbox, Clock3, LoaderCircle } from "lucide-react";
import { Link } from "react-router-dom";
import ProfileAvatar from "../profile/ProfileAvatar";
import { profilePath } from "../search/searchLinks";
import api from "../../utils/axios";
import { getSocket } from "../../realtime/socket";

// Shared invitations inbox: accept or decline connection requests.
// Used by both alumni and student requests pages.
export const useRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/connections/requests");
      setRequests(res.data.data || []);
    } catch {
      setError("Unable to load invitations. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();

    const socket = getSocket();
    const onNew = () => {
      fetchRequests();
    };
    socket.on("notification:new", onNew);

    return () => {
      socket.off("notification:new", onNew);
    };
  }, [fetchRequests]);

  const respond = async (id, status) => {
    try {
      await api.put(`/connections/${id}`, { status });
      setRequests((prev) => prev.filter((r) => String(r._id) !== String(id)));
      toast.info(status === "accepted" ? "Connected!" : "Declined", { description: status === "accepted"
            ? "You can now chat with each other."
            : undefined });
    } catch (err) {
      toast.error("Error", { description: err.response?.data?.message || "Failed to respond" });
    }
  };

  return { requests, loading, error, respond, refresh: fetchRequests };
};

const RequestsList = ({ requests, loading, onRespond, error, onRetry, searching = false, onClearSearch }) => {
  const pending = useRef(new Set());
  const [responding, setResponding] = useState({});
  const respond = async (id, status) => {
    if (pending.current.has(id)) return;
    pending.current.add(id);
    setResponding(previous => ({ ...previous, [id]: status }));
    try { await onRespond(id, status); }
    finally {
      pending.current.delete(id);
      setResponding(previous => { const next = { ...previous }; delete next[id]; return next; });
    }
  };
  if (error) return <div role="alert" className="requests-state rounded-2xl border border-red-200 bg-white p-6 text-sm text-red-600 dark:border-red-900 dark:bg-zinc-900 dark:text-red-400">{error}{onRetry && <button type="button" onClick={onRetry} className="ml-2 font-semibold underline">Retry</button>}</div>;
  if (loading) {
    return (
      <ContentSkeleton variant="list" count={3} label="Loading invitations..." />
    );
  }

  if (requests.length === 0) {
    return (
      <div className="requests-state rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-10 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-zinc-800 text-brand dark:text-brand">
          <Inbox className="h-6 w-6" />
        </span>
        <p className="text-[14px] font-bold text-zinc-800 dark:text-zinc-100">
          {searching ? "No matching invitations" : "No pending invitations"}
        </p>
        <p className="mt-0.5 text-[12px] text-zinc-500 dark:text-zinc-400">
          {searching ? "Try another name, program, or email." : "New connect requests will appear here."}
        </p>
        {searching && onClearSearch && <button type="button" onClick={onClearSearch} className="mt-4 text-xs font-semibold text-brand">Clear search</button>}
      </div>
    );
  }

  return (
    <ul className="requests-list space-y-2.5">
      {requests.map((r) => {
        const ProfileLink = r.profileId ? Link : "span";
        const profileLinkProps = r.profileId
          ? {
              to: profilePath({ _id: r.profileId, role: r.role }),
              "aria-label": `View ${r.name || "user"} profile`,
            }
          : {};
        return (
          <li
            key={r._id}
            className="requests-card flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4"
          >
            <ProfileLink
              {...profileLinkProps}
              className="request-avatar flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand/10 dark:bg-brand/20 text-sm font-bold text-brand dark:text-brand"
            >
              <ProfileAvatar user={r} />
            </ProfileLink>
            <span className="request-person min-w-0 flex-1">
              <ProfileLink
                {...profileLinkProps}
                className="block truncate text-[13.5px] font-bold text-zinc-900 dark:text-zinc-100 hover:underline"
              >
                {r.name}
              </ProfileLink>
              <span className="block truncate text-[11.5px] text-zinc-500 dark:text-zinc-400">
                {[r.program, r.email].filter(Boolean).join(" • ")}
              </span>
            </span>
            <span className="request-pending"><Clock3 size={12} />Pending invitation</span>
            <span className="request-actions flex shrink-0 gap-1.5">
              <button
                type="button"
                disabled={!!responding[r._id]}
                onClick={() => respond(r._id, "declined")}
                className="flex h-9 items-center gap-1 rounded-xl border border-zinc-200 dark:border-zinc-700 px-3.5 text-[12px] font-bold text-zinc-500 dark:text-zinc-400 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                {responding[r._id] === "declined" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                Ignore
              </button>
              <button
                type="button"
                disabled={!!responding[r._id]}
                onClick={() => respond(r._id, "accepted")}
                className="flex h-9 items-center gap-1 rounded-xl bg-brand px-3.5 text-[12px] font-bold text-white transition hover:bg-brand"
              >
                {responding[r._id] === "accepted" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Accept
              </button>
            </span>
          </li>
        );
      })}
    </ul>
  );
};

export const RequestsHeader = ({ count }) => (
  <div className="workspace-page-header rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5">
    <h1 className="workspace-page-title flex items-center gap-3 text-[16px] font-extrabold text-zinc-900 dark:text-zinc-100">
      <UserPlus size={28} className="shrink-0 text-brand" aria-hidden="true" />
      Invitations
      {count > 0 && (
        <span className="rounded-full bg-brand px-2 py-0.5 text-[10.5px] font-bold text-white">
          {count}
        </span>
      )}
    </h1>
    <p className="mt-1 text-[12.5px] text-zinc-500 dark:text-zinc-400">
      Accept to connect — chat unlocks after both sides connect.
    </p>
  </div>
);

export default RequestsList;
