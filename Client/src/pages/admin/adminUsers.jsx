import { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { Search, Trash2, Users as UsersIcon, ShieldCheck, GraduationCap, BookOpen, ScrollText, RefreshCw, Circle } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { usePresence } from '../../realtime/usePresence';
import AdminSidebar from '../../layout/sidebar/admin/adminSidebar';
import AdminTopbar from '../../layout/topbar/alumni/adminTopbar';
import api from '../../utils/axios';
import { Roles } from '../../utils/roles';

const ROLE_META = {
  [Roles.ADMIN]: { icon: ShieldCheck, style: 'bg-red-50 text-red-600 ring-red-200/60' },
  [Roles.ALUMNI]: { icon: GraduationCap, style: 'bg-[#009639]/10 text-[#007a2e] ring-emerald-200/60' },
  [Roles.STUDENT]: { icon: BookOpen, style: 'bg-blue-50 text-blue-600 ring-blue-200/60' },
};

const formatRelative = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function AdminUsers() {
  const { user } = useAuth();
  const { onlineIds, lastSeen } = usePresence();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [view, setView] = useState('users');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [audit, setAudit] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/users');
      setUsers(res.data.data || []);
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchAudit();
  }, [fetchUsers, fetchAudit]);

  // Per-email last login/logout from the audit trail (persistent,
  // survives server restarts — unlike socket lastSeen).
  const lastActivity = useMemo(() => {
    const map = {};
    audit.forEach((log) => {
      if (!map[log.email]) map[log.email] = {};
      if (log.action === 'login' && !map[log.email].login) {
        map[log.email].login = log.createdAt;
      }
      if (log.action === 'logout' && !map[log.email].logout) {
        map[log.email].logout = log.createdAt;
      }
    });
    return map;
  }, [audit]);

  const fetchAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      const res = await api.get('/activity', { params: { limit: 50 } });
      setAudit(res.data.data || []);
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to load audit logs', 'error');
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === 'audit') fetchAudit();
  }, [view, fetchAudit]);

  const counts = useMemo(() => {
    const c = { all: users.length, admin: 0, alumni: 0, student: 0 };
    users.forEach((u) => {
      if (u.role === Roles.ADMIN) c.admin += 1;
      else if (u.role === Roles.STUDENT) c.student += 1;
      else c.alumni += 1;
    });
    return c;
  }, [users]);

  const filtered = users.filter((u) => {
    if (u.role === Roles.ADMIN) return false;
    const matchesQuery =
      (u.name || '').toLowerCase().includes(query.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(query.toLowerCase());
    const matchesRole = roleFilter === 'all' || (u.role || Roles.ALUMNI) === roleFilter;
    return matchesQuery && matchesRole;
  });

  const handleRoleChange = async (profileId, email, newRole) => {
    try {
      await api.put(`/users/${profileId}/role`, { role: newRole });
      setUsers((prev) => prev.map((u) => (u._id === profileId ? { ...u, role: newRole } : u)));
      Swal.fire({ title: 'Role updated', text: `${email} is now ${newRole}.`, icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to update role', 'error');
      fetchUsers();
    }
  };

  const handleDelete = async (profileId, email) => {
    const result = await Swal.fire({
      title: 'Delete user?',
      text: `Remove ${email} from the directory? This cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626',
      reverseButtons: true,
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/users/${profileId}`);
      setUsers((prev) => prev.filter((u) => u._id !== profileId));
      Swal.fire({ title: 'Deleted', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to delete user', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <AdminSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />

      <div className="lg:pl-64">
        <AdminTopbar user={user} title="Users" onMenuClick={() => setSidebarOpen(true)} />

        <main className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              { label: 'Total Users', value: counts.all, icon: UsersIcon },
              { label: 'Admins', value: counts.admin, icon: ShieldCheck },
              { label: 'Alumni', value: counts.alumni, icon: GraduationCap },
              { label: 'Students', value: counts.student, icon: BookOpen },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-zinc-500">{label}</span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#009639]/10 text-[#009639]">
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <p className="mt-1.5 text-2xl font-extrabold tracking-tight text-zinc-900">{value}</p>
              </div>
            ))}
          </div>

          {/* View tabs */}
          <div className="flex gap-1.5">
            {[
              { key: 'users', label: 'Users', icon: UsersIcon },
              { key: 'audit', label: 'Audit Logs', icon: ScrollText },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-bold transition ${
                  view === key ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-500 border border-zinc-200 hover:text-zinc-900'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {key === 'audit' && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                    <Circle className="h-1.5 w-1.5 fill-current" />
                    LIVE
                  </span>
                )}
              </button>
            ))}
          </div>

          {view === 'audit' ? (
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-100 p-4">
              <div>
                <h2 className="text-[14px] font-extrabold text-zinc-900">Audit Logs</h2>
                <p className="text-[11.5px] text-zinc-500">Logins and logouts — newest first.</p>
              </div>
              <button
                type="button"
                onClick={fetchAudit}
                disabled={auditLoading}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-[11.5px] font-bold text-zinc-600 transition hover:border-[#009639] hover:text-[#007a2e] disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${auditLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
            {auditLoading ? (
              <p className="p-6 text-[13px] text-zinc-500">Loading audit logs...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-[12.5px]">
                  <thead>
                    <tr className="border-b border-zinc-100 text-[10.5px] uppercase tracking-wider text-zinc-400">
                      <th className="px-5 py-3 font-semibold">User</th>
                      <th className="px-5 py-3 font-semibold">Action</th>
                      <th className="px-5 py-3 font-semibold">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.map((log) => (
                      <tr key={log._id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/60">
                        <td className="px-5 py-3 font-medium text-zinc-800">{log.email}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-block rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide ${
                            log.action === 'login' ? 'bg-[#009639]/10 text-[#007a2e]' : 'bg-zinc-100 text-zinc-500'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-zinc-500">
                          {new Date(log.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                    {audit.length === 0 && (
                      <tr><td colSpan={3} className="px-5 py-8 text-center text-zinc-400">No activity yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          ) : (
          <>
          {/* Table card */}
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-zinc-100 p-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name or email..."
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-[12.5px] outline-none transition focus:border-[#009639] focus:bg-white focus:ring-2 focus:ring-[#009639]/15"
                />
              </div>
              <div className="flex gap-1.5">
                {['all', Roles.ADMIN, Roles.ALUMNI, Roles.STUDENT].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRoleFilter(r)}
                    className={`rounded-full px-3 py-1.5 text-[11.5px] font-bold capitalize transition ${
                      roleFilter === r ? 'bg-[#009639] text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <p className="p-6 text-[13px] text-zinc-500">Loading users...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-[12.5px]">
                  <thead>
                    <tr className="border-b border-zinc-100 text-[10.5px] uppercase tracking-wider text-zinc-400">
                      <th className="px-5 py-3 font-semibold">User</th>
                      <th className="px-5 py-3 font-semibold">Role</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                      <th className="px-5 py-3 font-semibold">Last Login</th>
                      <th className="px-5 py-3 font-semibold">Joined</th>
                      <th className="px-5 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((u) => {
                      const meta = ROLE_META[u.role] || ROLE_META[Roles.ALUMNI];
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
                            : 'Never logged in';
                      return (
                        <tr key={u._id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/60">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2.5">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[12px] font-bold text-[#009639]">
                                {(u.name || 'U').charAt(0).toUpperCase()}
                              </span>
                              <span>
                                <span className="block font-semibold text-zinc-800">{u.name || '—'}</span>
                                <span className="block text-[11px] text-zinc-500">{u.email}</span>
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide ring-1 ${meta.style}`}>
                              <RoleIcon className="h-3 w-3" />
                              {u.role || Roles.ALUMNI}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            {online ? (
                              <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-[#007a2e]">
                                <Circle className="h-2 w-2 fill-current text-[#009639]" />
                                Active now
                              </span>
                            ) : (
                              <span className="text-[11.5px] text-zinc-400">
                                {offlineLabel}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-zinc-500">
                            {activity.login ? (
                              <span title={new Date(activity.login).toLocaleString()}>
                                {formatRelative(activity.login)}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-5 py-3 text-zinc-500">
                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              <select
                                value={u.role || Roles.ALUMNI}
                                onChange={(e) => handleRoleChange(u._id, u.email, e.target.value)}
                                className="h-8 rounded-lg border border-zinc-200 bg-white px-2 text-[11.5px] font-semibold text-zinc-700 outline-none focus:border-[#009639]"
                                aria-label={`Change role for ${u.email}`}
                              >
                                {Object.values(Roles).map((r) => (
                                  <option key={r} value={r}>{r}</option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => handleDelete(u._id, u.email)}
                                className="rounded-lg p-2 text-zinc-300 transition hover:bg-red-50 hover:text-red-600"
                                aria-label={`Delete ${u.email}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr><td colSpan={6} className="px-5 py-8 text-center text-zinc-400">No users found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          </>
          )}
        </main>
      </div>
    </div>
  );
}
