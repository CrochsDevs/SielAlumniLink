import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  AdminStatGrid,
  AdminTabs,
  AdminButton,
} from "../../components/admin/AdminUI";
import AdminStatCard from "../../components/admin/AdminStatCard";
import PageHeader from "../../components/ui/PageHeader";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gooeyToast as toast } from "goey-toast";
import {
  Search,
  Users as UsersIcon,
  GraduationCap,
  BookOpen,
  RefreshCw,
  DatabaseZap,
  Circle,
} from "lucide-react";
import { useAuth } from "../../context/useAuth";
import { usePresence } from "../../realtime/usePresence";
import AdminSidebar from "../../layout/sidebar/admin/adminSidebar";
import AdminTopbar from "../../layout/topbar/alumni/adminTopbar";
import api from "../../utils/axios";
import { Roles } from "../../utils/roles";
import DataPagination from "../../components/ui/data-pagination";
import "./adminUsers.css";

const USER_COLUMNS = [
  {
    accessorKey: "studentId",
    header: "Student ID",
    meta: { headerClassName: "px-5 py-3 font-semibold" },
  },
  {
    accessorKey: "name",
    header: "Full Name",
    meta: { headerClassName: "px-5 py-3 font-semibold min-w-[200px]" },
  },
  {
    accessorKey: "program",
    header: "Program/Course",
    meta: { headerClassName: "px-5 py-3 font-semibold" },
  },
  {
    accessorKey: "yearLevel",
    header: "Year Level",
    meta: { headerClassName: "px-5 py-3 font-semibold" },
  },
  {
    accessorKey: "section",
    header: "Section",
    meta: { headerClassName: "px-5 py-3 font-semibold" },
  },
  {
    accessorKey: "academicStatus",
    header: "Academic Status",
    meta: { headerClassName: "px-5 py-3 font-semibold" },
  },
  {
    accessorKey: "email",
    header: "Email",
    meta: { headerClassName: "px-5 py-3 font-semibold" },
  },
  {
    accessorKey: "contactNumber",
    header: "Contact Number",
    meta: { headerClassName: "px-5 py-3 font-semibold" },
  },
  {
    accessorKey: "role",
    header: "Role",
    meta: { headerClassName: "px-5 py-3 font-semibold" },
  },
  {
    accessorKey: "presence",
    header: "Status",
    meta: { headerClassName: "px-5 py-3 font-semibold" },
  },
];

const ROLE_META = {
  [Roles.ALUMNI]: {
    icon: GraduationCap,
    style: "bg-brand/10 text-brand ring-emerald-200/60",
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
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [audit, setAudit] = useState([]);
  const [userPage, setUserPage] = useState(1);
  const [userPerPage, setUserPerPage] = useState(10);
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
      toast.error("Error", {
        description: err.response?.data?.message || "Failed to load users",
      });
    } finally {
      setLoading(false);
      usersPending.current = false;
    }
  }, []);

  const fetchAudit = useCallback(async () => {
    if (auditPending.current) return;
    auditPending.current = true;
    try {
      const res = await api.get("/activity", { params: { limit: 200 } });
      setAudit(res.data.data || []);
    } catch { /* Live presence still works if access history is unavailable. */ }
    finally { auditPending.current = false; }
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
      toast.error("Error", {
        description:
          err.response?.data?.message ||
          "CAIS sync failed. Check CAIS_API_URL in Server/.env",
      });
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

  const usersTable = useReactTable({
    data: filtered,
    columns: USER_COLUMNS,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => String(row._id ?? row.authId ?? row.email),
    autoResetPageIndex: false,
    state: {
      pagination: {
        pageIndex: Math.min(
          userPage - 1,
          Math.max(0, Math.ceil(filtered.length / userPerPage) - 1),
        ),
        pageSize: userPerPage,
      },
    },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === "function"
          ? updater(usersTable.getState().pagination)
          : updater;
      setUserPage(next.pageIndex + 1);
      setUserPerPage(next.pageSize);
    },
  });
  const totalUserPages = Math.max(1, usersTable.getPageCount());
  const pagedUsers = usersTable.getRowModel().rows.map((row) => row.original);


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

        <main className="workspace-page admin-users mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
          <PageHeader
            title="Users"
            description="Manage community members and view their account status."
          />
          <AdminStatGrid columns={3} label="User summaries">
            {[
              {
                label: "Total Users",
                value: counts.all,
                icon: UsersIcon,
                filter: "all",
                caption: "community members",
                detail: `${counts.alumni.toLocaleString()} alumni / ${counts.student.toLocaleString()} students`,
              },
              {
                label: "Alumni",
                value: counts.alumni,
                icon: GraduationCap,
                filter: Roles.ALUMNI,
                caption: "registered alumni",
                detail: "View alumni accounts",
              },
              {
                label: "Students",
                value: counts.student,
                icon: BookOpen,
                filter: Roles.STUDENT,
                caption: "registered students",
                detail: "View student accounts",
              },
            ].map(({ filter, ...item }, index) => (
              <AdminStatCard
                key={filter}
                {...item}
                featured={index === 0}
                loading={loading}
                selected={roleFilter === filter}
                onClick={() => {
                  setRoleFilter(filter);
                  setUserPage(1);
                }}
              />
            ))}
          </AdminStatGrid>

          <>
              {/* Table card */}
              <div className="admin-panel admin-data-table overflow-hidden">
                <div className="admin-toolbar">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search name or email..."
                      className="h-10 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 pl-9 pr-3 text-[12.5px] outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/15"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <AdminTabs
                      label="Filter users by role"
                      value={roleFilter}
                      onChange={(value) => {
                        setRoleFilter(value);
                        setUserPage(1);
                      }}
                      items={[
                        { id: "all", label: "All" },
                        { id: Roles.ALUMNI, label: "Alumni" },
                        { id: Roles.STUDENT, label: "Student" },
                      ]}
                    />
                    <AdminButton onClick={() => setSyncOpen(true)}>
                      <DatabaseZap size={15} />
                      Sync CAIS
                    </AdminButton>
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
                        {usersTable.getHeaderGroups().map((group) => (
                          <tr
                            key={group.id}
                            className={
                              "border-b border-zinc-100 dark:border-zinc-800 text-[10.5px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500"
                            }
                          >
                            {group.headers.map((header) => (
                              <th
                                key={header.id}
                                scope="col"
                                colSpan={header.colSpan}
                                className={
                                  header.column.columnDef.meta?.headerClassName
                                }
                              >
                                {header.isPlaceholder
                                  ? null
                                  : flexRender(
                                      header.column.columnDef.header,
                                      header.getContext(),
                                    )}
                              </th>
                            ))}
                          </tr>
                        ))}
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
                                  <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-brand">
                                    <Circle className="h-2 w-2 fill-current text-brand dark:text-brand" />
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
                  onPageChange={(value) => usersTable.setPageIndex(value - 1)}
                  perPage={userPerPage}
                  onPerPageChange={(pageSize) =>
                    usersTable.setPagination({ pageIndex: 0, pageSize })
                  }
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
                    <h2 className="admin-section-title flex items-center gap-2 text-[15px] font-extrabold text-zinc-900 dark:text-zinc-100">
                      <RefreshCw
                        className={`h-4 w-4 text-brand dark:text-brand ${syncLoading ? "animate-spin" : ""}`}
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
                        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-[13.5px] font-bold text-white shadow-sm transition hover:bg-brand"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Sync Now
                      </button>
                    )}

                    {syncLoading && (
                      <div className="mt-4 flex flex-col items-center rounded-2xl bg-zinc-50 dark:bg-zinc-800 py-8">
                        <svg
                          className="h-8 w-8 animate-spin text-brand dark:text-brand"
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
                          className="h-10 flex-1 rounded-xl bg-brand text-[13px] font-bold text-white transition hover:bg-brand"
                        >
                          Sync Again
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
          </>
        </main>
      </div>
    </div>
  );
}
