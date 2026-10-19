import PageHeader from "../../components/ui/PageHeader";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gooeyToast as toast } from 'goey-toast';
import {
  Search,
  Users as UsersIcon,
  GraduationCap,
  BookOpen,
  ScrollText,
  RefreshCw,
  Circle,
  DatabaseZap,
} from "lucide-react";
import { useAuth } from "../../context/useAuth";
import { usePresence } from "../../realtime/usePresence";
import AdminSidebar from "../../layout/sidebar/admin/adminSidebar";
import AdminTopbar from "../../layout/topbar/alumni/adminTopbar";
import api from "../../utils/axios";
import { Roles } from "../../utils/roles";
import DataPagination from "../../components/ui/data-pagination";

const ROLE_META = {
  [Roles.ALUMNI]: {
    icon: GraduationCap,
    style: "bg-[#009639]/10 text-[#007a2e] ring-emerald-200/60",
  },
  [Roles.STUDENT]: {
    icon: BookOpen,
    style: "bg-blue-50 text-blue-600 ring-blue-200/60",
  },
};

const formatRelative = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

export default function AdminUsers() {
  const { user } = useAuth();
  const { onlineIds, lastSeen } = usePresence();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [view, setView] = useState("users");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [audit, setAudit] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [userPage, setUserPage] = useState(1);
  const [userPerPage, setUserPerPage] = useState(10);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPerPage, setAuditPerPage] = useState(10);
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncSummary, setSyncSummary] = useState(null);
  const [syncLoading, setSyncLoading] = useState(false);

  const usersPending = useRef(false);
  const auditPending = useRef(false);
  const fetchUsers = useCallback(async () => {
    if (usersPending.current) return;
    usersPending.current = true;
    setLoading(true);
    try {
      const res = await api.get("/users");
      setUsers(res.data.data || []);
    } catch (err) {
      toast.error("Error", { description: err.response?.data?.message || "Failed to load users" });
    } finally {
      setLoading(false);
      usersPending.current = false;
    }
  }, []);

  const fetchAudit = useCallback(async () => {
    if (auditPending.current) return;
    auditPending.current = true;
    setAuditLoading(true);
    try {
      const res = await api.get("/activity", { params: { limit: 50 } });
      setAudit(res.data.data || []);
    } catch (err) {
      toast.error("Error", { description: err.response?.data?.message || "Failed to load audit logs" });
    } finally {
      setAuditLoading(false);
      auditPending.current = false;
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchAudit();
  }, [fetchUsers, fetchAudit]);

  // Auto-refresh every 30s so Last Login / Status stay current
  // while the admin keeps this page open.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.hidden) return;
      fetchUsers();
      fetchAudit();
    }, 30000);
    return () => clearInterval(id);
  }, [fetchUsers, fetchAudit]);

  // Per-email last login/logout from the audit trail (persistent,
  // survives server restarts — unlike socket lastSeen).
  const lastActivity = useMemo(() => {
    const map = {};
    audit.forEach((log) => {
      if (!map[log.email]) map[log.email] = {};
      if (log.action === "login" && !map[log.email].login) {
        map[log.email].login = log.createdAt;
      }
      if (log.action === "logout" && !map[log.email].logout) {
        map[log.email].logout = log.createdAt;
      }
    });
    return map;
  }, [audit]);

  useEffect(() => {
    if (view === "audit") fetchAudit();
  }, [view, fetchAudit]);

  // ---- CAIS sync (one-click live pull) ----
  // One-click live pull from the CAIS API — loading, then stored.
  const runCaisSync = async () => {
    setSyncLoading(true);
    setSyncSummary(null);
    try {
      const res = await api.post("/users/sync", { source: "cais" });
      setSyncSummary(res.data.data);
      fetchUsers();
    } catch (err) {
      toast.error("Error", { description: err.response?.data?.message ||
          "CAIS sync failed. Check CAIS_API_URL in Server/.env" });
    } finally {
      setSyncLoading(false);
    }
  };

  const closeSync = () => {
    setSyncOpen(false);
    setSyncSummary(null);
  };

  const counts = useMemo(() => {
    const visible = users.filter((u) => u.role !== Roles.ADMIN);
    const c = { all: visible.length, alumni: 0, student: 0 };
    visible.forEach((u) => {
      if (u.role === Roles.STUDENT) c.student += 1;
      else c.alumni += 1;
    });
    return c;
  }, [users]);

  const filtered = users.filter((u) => {
    if (u.role === Roles.ADMIN) return false;
    const haystack = [
      u.name,
      u.email,
      u.studentId,
      u.program,
      u.yearLevel,
      u.section,
      u.academicStatus,
      u.contactNumber,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesQuery = haystack.includes(query.toLowerCase());
    const matchesRole =
      roleFilter === "all" || (u.role || Roles.ALUMNI) === roleFilter;
    return matchesQuery && matchesRole;
  });

  // Reset to first page when filters change.
  useEffect(() => {
    setUserPage(1);
  }, [query, roleFilter]);

  const totalUserPages = Math.max(1, Math.ceil(filtered.length / userPerPage));
  const pagedUsers = filtered.slice(
    (userPage - 1) * userPerPage,
    userPage * userPerPage,
  );

  // Audit logs exclude admins (matched by email from the users list).
  const adminEmails = useMemo(
    () =>
      new Set(users.filter((u) => u.role === Roles.ADMIN).map((u) => u.email)),
    [users],
  );
  const filteredAudit = audit.filter((log) => !adminEmails.has(log.email));
  const totalAuditPages = Math.max(
    1,
    Math.ceil(filteredAudit.length / auditPerPage),
  );
  const pagedAudit = filteredAudit.slice(
    (auditPage - 1) * auditPerPage,
    auditPage * auditPerPage,
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AdminSidebar
        user={user}
        mobileOpen={sidebarOpen}
        setMobileOpen={setSidebarOpen}
      />

      <div className="lg:pl-64">
        <AdminTopbar
          user={user}
          title="Users"
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="workspace-page mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
          <PageHeader title="Users" description="Manage community members and review account activity." />
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            {[
              { label: "Total Users", value: counts.all, icon: UsersIcon },
              { label: "Alumni", value: counts.alumni, icon: GraduationCap },
              { label: "Students", value: counts.student, icon: BookOpen },
            ].map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                    {label}
                  </span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#009639]/10 text-[#009639] dark:text-emerald-300">
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <p className="mt-1.5 text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* View tabs */}
          <div className="flex gap-1.5">
            {[
              { key: "users", label: "Users", icon: UsersIcon },
              { key: "audit", label: "Audit Logs", icon: ScrollText },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-bold transition ${
                  view === key
                    ? "bg-zinc-900 text-white"
                    : "bg-white text-zinc-500 border border-zinc-200 hover:text-zinc-900"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {key === "audit" && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                    <Circle className="h-1.5 w-1.5 fill-current" />
                    LIVE
                  </span>
                )}
              </button>
            ))}
          </div>

          {view === "audit" ? (
            <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 p-4">
                <div>
                  <h2 className="text-[14px] font-extrabold text-zinc-900 dark:text-zinc-100">
                    Audit Logs
                  </h2>
                  <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400">
                    Logins and logouts — newest first.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchAudit}
                  disabled={auditLoading}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-[11.5px] font-bold text-zinc-600 dark:text-zinc-300 transition hover:border-[#009639] hover:text-[#007a2e] disabled:opacity-50"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${auditLoading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </button>
              </div>
              {auditLoading ? (
                <p className="p-6 text-[13px] text-zinc-500 dark:text-zinc-400">
                  Loading audit logs...
                </p>
              ) : (
                <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full min-w-[560px] text-left text-[12.5px]">
                    <thead>
                      <tr className="border-b border-zinc-100 dark:border-zinc-800 text-[10.5px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                        <th className="px-5 py-3 font-semibold">User</th>
                        <th className="px-5 py-3 font-semibold">Action</th>
                        <th className="px-5 py-3 font-semibold">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedAudit.map((log) => (
                        <tr
                          key={log._id}
                          className="border-b border-zinc-50 dark:border-zinc-800 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800 dark:bg-zinc-800/60"
                        >
                          <td className="px-5 py-3 font-medium text-zinc-800 dark:text-zinc-100">
                            {log.email}
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className={`inline-block rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide ${
                                log.action === "login"
                                  ? "bg-[#009639]/10 text-[#007a2e]"
                                  : "bg-zinc-100 text-zinc-500"
                              }`}
                            >
                              {log.action}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-zinc-500 dark:text-zinc-400">
                            {new Date(log.createdAt).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </td>
                        </tr>
                      ))}
                      {filteredAudit.length === 0 && (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-5 py-8 text-center text-zinc-400 dark:text-zinc-500"
                          >
                            No activity yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              <DataPagination
                page={Math.min(auditPage, totalAuditPages)}
                totalPages={totalAuditPages}
                onPageChange={setAuditPage}
                perPage={auditPerPage}
                onPerPageChange={(n) => {
                  setAuditPerPage(n);
                  setAuditPage(1);
                }}
                totalItems={filteredAudit.length}
                itemLabel="logs"
              />
            </div>
          ) : (
            <>
              {/* Table card */}
              <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm">
                <div className="flex flex-col gap-3 border-b border-zinc-100 dark:border-zinc-800 p-4 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search name or email..."
                      className="h-10 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 pl-9 pr-3 text-[12.5px] outline-none transition focus:border-[#009639] focus:bg-white focus:ring-2 focus:ring-[#009639]/15"
                    />
                  </div>
                  <div className="flex gap-1.5">
                    {["all", Roles.ALUMNI, Roles.STUDENT].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRoleFilter(r)}
                        className={`rounded-full px-3 py-1.5 text-[11.5px] font-bold capitalize transition ${
                          roleFilter === r
                            ? "bg-[#009639] text-white"
                            : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setSyncOpen(true)}
                      className="flex items-center gap-1.5 rounded-full bg-zinc-900 px-3.5 py-1.5 text-[11.5px] font-bold text-white transition hover:bg-zinc-800"
                    >
                      <DatabaseZap className="h-3.5 w-3.5" />
                      Sync CAIS
                    </button>
                  </div>
                </div>

                {loading ? (
                  <p className="p-6 text-[13px] text-zinc-500 dark:text-zinc-400">
                    Loading users...
                  </p>
                ) : (
                  <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full min-w-[1240px] text-left text-[12.5px]">
                      <thead>
                        <tr className="border-b border-zinc-100 dark:border-zinc-800 text-[10.5px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                          <th className="px-5 py-3 font-semibold">
                            Student ID
                          </th>
                          <th className="px-5 py-3 font-semibold min-w-[200px]">
                            Full Name
                          </th>
                          <th className="px-5 py-3 font-semibold">
                            Program/Course
                          </th>
                          <th className="px-5 py-3 font-semibold">
                            Year Level
                          </th>
                          <th className="px-5 py-3 font-semibold">Section</th>
                          <th className="px-5 py-3 font-semibold">
                            Academic Status
                          </th>
                          <th className="px-5 py-3 font-semibold">Email</th>
                          <th className="px-5 py-3 font-semibold">
                            Contact Number
                          </th>
                          <th className="px-5 py-3 font-semibold">Role</th>
                          <th className="px-5 py-3 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedUsers.map((u) => {
                          const meta =
                            ROLE_META[u.role] || ROLE_META[Roles.ALUMNI];
                          const RoleIcon = meta.icon;
                          const online = onlineIds.has(String(u.authId));
                          const seen = lastSeen[String(u.authId)];
                          const activity = lastActivity[u.email] || {};
                          // Offline fallback chain: live socket -> audit trail.
                          const offlineLabel = seen
                            ? `Last seen ${formatRelative(seen)}`
                            : activity.logout
                              ? `Offline since ${formatRelative(activity.logout)}`
                              : activity.login
                                ? `Last login ${formatRelative(activity.login)}`
                                : "Never logged in";
                          return (
                            <tr
                              key={u._id}
                              className="border-b border-zinc-50 dark:border-zinc-800 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800 dark:bg-zinc-800/60"
                            >
                              <td className="px-5 py-3 font-medium text-zinc-800 dark:text-zinc-100">
                                {u.studentId || "—"}
                              </td>
                              <td className="px-5 py-3 font-semibold text-zinc-800 dark:text-zinc-100 whitespace-nowrap min-w-[200px]">
                                {u.name || "—"}
                              </td>
                              <td className="px-5 py-3 text-zinc-600 dark:text-zinc-300">
                                {u.program || "—"}
                              </td>
                              <td className="px-5 py-3 text-zinc-600 dark:text-zinc-300">
                                {u.yearLevel || "—"}
                              </td>
                              <td className="px-5 py-3 text-zinc-600 dark:text-zinc-300">
                                {u.section || "—"}
                              </td>
                              <td className="px-5 py-3">
                                <span className="inline-block rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
                                  {u.academicStatus || "—"}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-zinc-500 dark:text-zinc-400">
                                {u.email}
                              </td>
                              <td className="px-5 py-3 text-zinc-600 dark:text-zinc-300">
                                {u.contactNumber || "—"}
                              </td>
                              <td className="px-5 py-3">
                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide ring-1 ${meta.style}`}
                                >
                                  <RoleIcon className="h-3 w-3" />
                                  {u.role || Roles.ALUMNI}
                                </span>
                              </td>
                              <td className="px-5 py-3">
                                {online ? (
                                  <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-[#007a2e]">
                                    <Circle className="h-2 w-2 fill-current text-[#009639] dark:text-emerald-300" />
                                    Active now
                                  </span>
                                ) : (
                                  <span className="text-[11.5px] text-zinc-400 dark:text-zinc-500">
                                    {offlineLabel}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {filtered.length === 0 && (
                          <tr>
                            <td
                              colSpan={10}
                              className="px-5 py-8 text-center text-zinc-400 dark:text-zinc-500"
                            >
                              No users found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
                <DataPagination
                  page={Math.min(userPage, totalUserPages)}
                  totalPages={totalUserPages}
                  onPageChange={setUserPage}
                  perPage={userPerPage}
                  onPerPageChange={(n) => {
                    setUserPerPage(n);
                    setUserPage(1);
                  }}
                  totalItems={filtered.length}
                  itemLabel="users"
                />
              </div>

              {/* CAIS sync modal */}
              {syncOpen && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                  onClick={closeSync}
                >
                  <div
                    className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white dark:bg-zinc-900 p-5 shadow-xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h2 className="flex items-center gap-2 text-[15px] font-extrabold text-zinc-900 dark:text-zinc-100">
                      <RefreshCw
                        className={`h-4 w-4 text-[#009639] dark:text-emerald-300 ${syncLoading ? "animate-spin" : ""}`}
                      />
                      Sync from CAIS
                    </h2>
                    <p className="mt-0.5 text-[12px] text-zinc-500 dark:text-zinc-400">
                      Pulls all records live from the CAIS API and stores them
                      in SielAlumniLink. New accounts get no password — they
                      sign in via magic link.
                    </p>

                    {!syncSummary && !syncLoading && (
                      <button
                        type="button"
                        onClick={runCaisSync}
                        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#009639] text-[13.5px] font-bold text-white shadow-sm transition hover:bg-[#007a2e]"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Sync Now
                      </button>
                    )}

                    {syncLoading && (
                      <div className="mt-4 flex flex-col items-center rounded-2xl bg-zinc-50 dark:bg-zinc-800 py-8">
                        <svg
                          className="h-8 w-8 animate-spin text-[#009639] dark:text-emerald-300"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        <p className="mt-3 text-[13px] font-bold text-zinc-700 dark:text-zinc-200">
                          Syncing from CAIS...
                        </p>
                        <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                          Fetching records and storing them
                        </p>
                      </div>
                    )}

                    {syncSummary && (
                      <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                        {[
                          ["Total", syncSummary.total],
                          ["Create", syncSummary.created],
                          ["Update", syncSummary.updated],
                          ["Skip", syncSummary.skipped?.length || 0],
                        ].map(([label, value]) => (
                          <div
                            key={label}
                            className="rounded-xl bg-zinc-50 dark:bg-zinc-800 px-2 py-2.5"
                          >
                            <p className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100">
                              {value}
                            </p>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                              {label}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                    {syncSummary?.skipped?.length > 0 && (
                      <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto rounded-xl bg-red-50/60 p-2.5 text-[11px] text-red-600">
                        {syncSummary.skipped.slice(0, 20).map((s, i) => (
                          <li key={i}>
                            {s.email || "(no email)"} — {s.reason}
                          </li>
                        ))}
                        {syncSummary.skipped.length > 20 && (
                          <li>…and {syncSummary.skipped.length - 20} more</li>
                        )}
                      </ul>
                    )}

                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={closeSync}
                        className="h-10 flex-1 rounded-xl border border-zinc-200 dark:border-zinc-700 text-[13px] font-bold text-zinc-600 dark:text-zinc-300 transition hover:bg-zinc-50 dark:hover:bg-zinc-800 dark:bg-zinc-800"
                      >
                        {syncSummary ? "Done" : "Close"}
                      </button>
                      {syncSummary && (
                        <button
                          type="button"
                          onClick={() => {
                            setSyncSummary(null);
                            runCaisSync();
                          }}
                          className="h-10 flex-1 rounded-xl bg-[#009639] text-[13px] font-bold text-white transition hover:bg-[#007a2e]"
                        >
                          Sync Again
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
