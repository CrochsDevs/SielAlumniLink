import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { getSocket } from "../../realtime/socket";
import { readCommunityStatus } from "../../utils/communityStatus";
import { PageSkeleton } from "../ui/Skeleton";
import { CommunityStatusContext } from "../../context/CommunityStatusContext";

export default function CommunityGuard({ children }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const owner = user?.authId || user?._id;
  const [result, setResult] = useState(null);
  const [blocked, setBlocked] = useState(null);
  const load = useCallback(async () => {
    if (!owner) return;
    try {
      const { data } = await readCommunityStatus(owner);
      setResult({ owner, data: data?.data ?? null, checkedAt: Date.now() });
      setBlocked(null);
    } catch {
      setResult((previous) =>
        previous?.owner === owner ? previous : { owner, data: null },
      );
    }
  }, [owner]);
  useEffect(() => {
    if (!owner) return;
    let active = true;
    Promise.resolve().then(() => {
      if (active) void load();
    });
    const socket = getSocket();
    const changed = () => {
      if (active) void load();
    };
    const refreshed = event => {
      if (!active) return;
      if (event.detail?.owner === owner && event.detail?.data) {
        setResult({ owner, data: event.detail.data, checkedAt: Date.now() });
        setBlocked(null);
      } else changed();
    };
    const restricted = (event) => {
      setBlocked({ owner, ...event.detail });
      changed();
    };
    const socketRestricted = (data) => {
      setBlocked({ owner, ...data });
      changed();
    };
    socket.on("community:changed", changed);
    socket.on("community:restricted", socketRestricted);
    window.addEventListener("community:restriction", restricted);
    window.addEventListener("focus", changed);
    window.addEventListener("community:refresh", refreshed);
    const timer = setInterval(changed, 60000);
    return () => {
      active = false;
      clearInterval(timer);
      socket.off("community:changed", changed);
      socket.off("community:restricted", socketRestricted);
      window.removeEventListener("community:restriction", restricted);
      window.removeEventListener("focus", changed);
      window.removeEventListener("community:refresh", refreshed);
    };
  }, [owner, load]);
  const data = owner && result?.owner === owner ? result?.data : null;
  const blockedCaseId =
    owner && blocked?.owner === owner ? blocked?.caseId : null;
  const active = (data?.restrictions || []).filter(
    (row) =>
      !row.revokedAt &&
      new Date(row.expiresAt).getTime() > (result?.checkedAt || 0),
  );
  const severe = active.some((row) => row.level >= 4);
  const accountPath =
    user?.role === "admin"
      ? "/admin/settings"
      : `/${user?.role === "student" ? "student" : "alumni"}/accounts`;
  const permitted =
    pathname === "/community-status" ||
    pathname === accountPath ||
    pathname === "/logout" ||
    pathname === "/setup-password";
  if (
    owner &&
    result?.owner !== owner &&
    pathname !== "/community-status"
  )
    return <PageSkeleton pathname={pathname} label="Checking your community access" />;
  if (
    severe &&
    !permitted &&
    !(user?.role === "admin" && pathname.startsWith("/admin/community"))
  )
    return <Navigate to="/community-status" replace />;
  return (
    <CommunityStatusContext.Provider value={data}>
      {owner &&
        !permitted &&
        (active.length > 0 ||
          data?.cases?.some((row) =>
            ["pending", "under_review"].includes(row.status),
          ) ||
          blockedCaseId) && (
          <aside
            role="status"
            className="relative z-40 border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
          >
            <strong>
              {active.some((row) => row.level > 1)
                ? "Some account features are temporarily restricted."
                : "You have a community moderation notice."}
            </strong>{" "}
            <Link to="/community-status" className="font-semibold underline">
              View violation details or appeal
            </Link>
          </aside>
        )}
      {children}
    </CommunityStatusContext.Provider>
  );
}
