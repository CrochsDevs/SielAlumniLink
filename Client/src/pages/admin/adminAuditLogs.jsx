import ContentSkeleton from "../../components/ui/Skeleton";
import { flexRender, getCoreRowModel, getPaginationRowModel, useReactTable } from "@tanstack/react-table";
import { useCallback, useEffect, useRef, useState } from "react";
import { gooeyToast as toast } from "goey-toast";
import { RefreshCw, Search } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import AdminSidebar from "../../layout/sidebar/admin/adminSidebar";
import AdminTopbar from "../../layout/topbar/alumni/adminTopbar";
import PageHeader from "../../components/ui/PageHeader";
import DataPagination from "../../components/ui/data-pagination";
import api from "../../utils/axios";
import { auditLabel } from "../../utils/auditActions";

const AUDIT_COLUMNS = [
  {
    accessorKey: "email",
    header: "Performed by",
    meta: { headerClassName: "px-5 py-3 font-semibold" },
  },
  {
    accessorKey: "action",
    header: "Event",
    meta: { headerClassName: "px-5 py-3 font-semibold" },
  },
  {
    accessorKey: "target",
    header: "Target",
    meta: { headerClassName: "px-5 py-3 font-semibold" },
  },
  {
    accessorKey: "createdAt",
    header: "Time",
    meta: { headerClassName: "px-5 py-3 font-semibold" },
  },
];

export default function AdminAuditLogs() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [audit, setAudit] = useState([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditQuery, setAuditQuery] = useState('');
  const [auditCategory, setAuditCategory] = useState('all');
  const [auditError, setAuditError] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const [auditPerPage, setAuditPerPage] = useState(10);
  const auditPending = useRef(false);
  const fetchAudit = useCallback(async () => {
    if (auditPending.current) return;
    auditPending.current = true;
    setAuditLoading(true);
    try {
      const res = await api.get("/activity", { params: { limit: 200 } });
      setAudit(res.data.data || []);
      setAuditError('');
    } catch (err) {
      setAuditError(err.response?.data?.message || 'Unable to refresh audit logs. Please try again.');
      toast.error("Error", {
        description: err.response?.data?.message || "Failed to load audit logs",
      });
    } finally {
      setAuditLoading(false);
      auditPending.current = false;
    }
  }, []);

  useEffect(() => {
    fetchAudit();
    const timer = setInterval(() => { if (!document.hidden) fetchAudit(); }, 30000);
    return () => clearInterval(timer);
  }, [fetchAudit]);
  const filteredAudit = audit.filter(log => {
    if (!['login', 'logout'].includes(log.action) || log.role === 'admin' || log.actor?.role === 'admin') return false;
    if (auditCategory !== 'all' && log.action !== auditCategory) return false;
    return [log.email, log.actor?.name, log.actor?.email, auditLabel(log.action), log.target?.label,
      log.target?.id, log.details].filter(Boolean).join(' ').toLowerCase().includes(auditQuery.trim().toLowerCase());
  });
  const auditTable = useReactTable({
    data: filteredAudit,
    columns: AUDIT_COLUMNS,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => String(row._id ?? row.authId ?? row.email),
    autoResetPageIndex: false,
    state: {
      pagination: {
        pageIndex: Math.min(
          auditPage - 1,
          Math.max(0, Math.ceil(filteredAudit.length / auditPerPage) - 1),
        ),
        pageSize: auditPerPage,
      },
    },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === "function"
          ? updater(auditTable.getState().pagination)
          : updater;
      setAuditPage(next.pageIndex + 1);
      setAuditPerPage(next.pageSize);
    },
  });
  const totalAuditPages = Math.max(1, auditTable.getPageCount());
  const pagedAudit = auditTable.getRowModel().rows.map((row) => row.original);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AdminSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />
      <div className="lg:pl-64">
        <AdminTopbar user={user} title="Audit Logs" onMenuClick={() => setSidebarOpen(true)} />
        <main className="workspace-page mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
          <PageHeader title="Audit Logs" description="Login and logout history for students and alumni." />
            <div className="admin-panel admin-data-table overflow-hidden">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 p-4">
                <div>
                  <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400">
                    Latest 200 events · Newest first
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchAudit}
                  disabled={auditLoading}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-[11.5px] font-bold text-zinc-600 dark:text-zinc-300 transition hover:border-brand hover:text-brand disabled:opacity-50"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${auditLoading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </button>
              </div>
              <div className="flex flex-wrap gap-3 border-b border-zinc-100 p-4 dark:border-zinc-800">
                <label className="min-w-0 flex-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Search audit logs
                  <span className="relative mt-1 block">
                  <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                  <input type="search" value={auditQuery} onChange={event => { setAuditQuery(event.target.value); setAuditPage(1); }}
                    placeholder="Search actor, action, or target..."
                    className="block h-10 w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
                  </span>
                </label>
                <label className="text-xs text-zinc-500 dark:text-zinc-400">Event type
                  <select aria-label="Event type" value={auditCategory} onChange={event => { setAuditCategory(event.target.value); setAuditPage(1); }}
                    className="mt-1 block h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
                    <option value="all">All events</option><option value="login">Login</option><option value="logout">Logout</option>
                  </select>
                </label>
              </div>
              {auditError && <p role="alert" className="m-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{auditError}</p>}
              {auditLoading ? (
                <ContentSkeleton variant="table" count={5} label="Loading audit logs..." />
              ) : (
                <div className="overflow-x-auto no-scrollbar">
                  <table aria-label="Audit logs" className="w-full min-w-[720px] text-left text-[12.5px]">
                    <thead>
                      {auditTable.getHeaderGroups().map((group) => (
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
                      {pagedAudit.map((log) => (
                        <tr
                          key={log._id}
                          className="border-b border-zinc-50 dark:border-zinc-800 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800 dark:bg-zinc-800/60"
                        >
                          <td className="px-5 py-3 font-medium text-zinc-800 dark:text-zinc-100">
                            <span className="block" title={log.actor?.email || log.email}>{log.actor?.name || log.actor?.email || log.email || log.authId || 'Unknown account'}</span>
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className={`inline-block rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide ${
                                log.action === "login"
                                  ? "bg-brand/10 text-brand"
                                  : "bg-zinc-100 text-zinc-500"
                              }`}
                            >
                              {auditLabel(log.action)}
                            </span>
                            {log.details && <p className="mt-1 max-w-[300px] whitespace-pre-wrap break-words text-xs text-zinc-500 dark:text-zinc-400">{log.details}</p>}
                          </td>
                          <td title={log.target?.id ? `${log.target.type}: ${log.target.id}` : undefined}
                            className="max-w-[220px] break-words px-5 py-3 text-zinc-700 dark:text-zinc-200">
                            <span className="block">{log.target?.label || (['login', 'logout'].includes(log.action)
                              ? log.email || log.actor?.email || log.authId || 'Unknown account' : '—')}</span>
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
                            colSpan={4}
                            className="px-5 py-8 text-center text-zinc-400 dark:text-zinc-500"
                          >
                            {auditQuery || auditCategory !== 'all' ? 'No matching audit logs.' : 'No activity yet.'}
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
                onPageChange={(value) => auditTable.setPageIndex(value - 1)}
                perPage={auditPerPage}
                onPerPageChange={(pageSize) =>
                  auditTable.setPagination({ pageIndex: 0, pageSize })
                }
                totalItems={filteredAudit.length}
                itemLabel="logs"
              />
            </div>
        </main>
      </div>
    </div>
  );
}
