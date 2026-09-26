import { useState } from 'react';
import Swal from 'sweetalert2';
import { UserRound, ShieldCheck, Lock, Mail, BadgeCheck } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import AlumniSidebar from '../../layout/sidebar/alumni/alumniSidebar';
import AlumniTopbar from '../../layout/topbar/alumni/alumniTopbar';
import api from '../../utils/axios';

const TABS = [
  { key: 'profile', label: 'Profile', desc: 'Name and account details', icon: UserRound },
  { key: 'password', label: 'Change Password', desc: 'Keep your account secure', icon: ShieldCheck },
];

const AlumniAccounts = () => {
  const { user, refreshUser } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwLoading, setPwLoading] = useState(false);

  const inputClass =
    'w-full h-11 px-3.5 rounded-xl border border-zinc-200 bg-zinc-50/60 text-[13px] text-zinc-800 placeholder-zinc-400 outline-none transition-all hover:border-zinc-300 focus:border-[#009639] focus:bg-white focus:ring-2 focus:ring-[#009639]/15';

  const handleSaveName = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      Swal.fire('Error', 'Please enter your name', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.put('/users/me', { name: name.trim() });
      await refreshUser();
      Swal.fire({ title: 'Saved', text: 'Your profile has been updated.', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      Swal.fire('Error', 'New passwords do not match', 'error');
      return;
    }
    setPwLoading(true);
    try {
      const res = await api.post('/auth/password/change', pwForm);
      Swal.fire('Success', res.data.message, 'success');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to change password', 'error');
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f6f3]">
      <AlumniSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />

      <div className="lg:pl-64">
        <AlumniTopbar user={user} title="Accounts" onMenuClick={() => setSidebarOpen(true)} />

        <main className="mx-auto max-w-5xl p-4 sm:p-6">
          {/* Page header */}
          <div className="relative mb-5 overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F4C3A] via-[#007a2e] to-[#009639] p-6 text-white shadow-lg shadow-emerald-900/10 sm:p-7">
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 85% 20%, rgba(255,255,255,0.25), transparent 40%), radial-gradient(circle at 70% 85%, rgba(255,255,255,0.12), transparent 35%)',
              }}
            />
            <div className="relative flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-2xl font-extrabold text-white ring-1 ring-white/30 backdrop-blur">
                {(user?.name || 'A').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-extrabold tracking-tight sm:text-xl">
                  {user?.name || 'Account Settings'}
                </h1>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-white/70">
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {user?.email}
                  </span>
                  {user?.role && (
                    <span className="flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                      <BadgeCheck className="h-3 w-3" />
                      {user.role}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-5 items-start">
            {/* Sub-sidebar */}
            <aside className="w-full md:w-64 shrink-0 overflow-hidden rounded-3xl border border-emerald-900/10 bg-white shadow-sm">
              <p className="px-4 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Account Settings
              </p>
              <nav className="space-y-1 p-2">
                {TABS.map(({ key, label, desc, icon: Icon }) => {
                  const active = activeTab === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveTab(key)}
                      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all ${
                        active
                          ? 'bg-[#009639]/10 ring-1 ring-emerald-200/60'
                          : 'hover:bg-zinc-50'
                      }`}
                    >
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                        active ? 'bg-[#009639] text-white shadow-sm' : 'bg-zinc-100 text-zinc-500'
                      }`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className={`block truncate text-[12.5px] font-bold ${active ? 'text-[#007a2e]' : 'text-zinc-700'}`}>
                          {label}
                        </span>
                        <span className="block truncate text-[10.5px] text-zinc-400">{desc}</span>
                      </span>
                    </button>
                  );
                })}
              </nav>
              <div className="m-2 mt-1 rounded-2xl bg-emerald-50/70 p-3 text-[11px] leading-relaxed text-zinc-500">
                Your email is managed by your institution. Contact an admin to change it.
              </div>
            </aside>

            {/* Content */}
            <div className="flex-1 min-w-0 w-full">
              {activeTab === 'profile' && (
                <section className="overflow-hidden rounded-3xl border border-emerald-900/10 bg-white shadow-sm">
                  <div className="border-b border-zinc-100 px-5 py-4 sm:px-6">
                    <h2 className="text-[15px] font-extrabold tracking-tight text-zinc-900">Profile Information</h2>
                    <p className="text-[12px] text-zinc-500">How you appear across the alumni network.</p>
                  </div>
                  <form onSubmit={handleSaveName} className="space-y-4 p-5 sm:p-6">
                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                        Full Name
                      </label>
                      <input value={name} onChange={(e) => setName(e.target.value)} required
                        placeholder="Your full name" className={inputClass} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                        Email Address
                      </label>
                      <input value={user?.email || ''} disabled
                        className={`${inputClass} cursor-not-allowed bg-zinc-100/70 text-zinc-400`} />
                    </div>
                    <div className="flex justify-end border-t border-zinc-100 pt-4">
                      <button type="submit" disabled={saving}
                        className="h-10 rounded-xl bg-[#009639] px-6 text-[13px] font-bold text-white shadow-sm transition hover:bg-[#007a2e] disabled:opacity-60">
                        {saving ? 'Saving...' : 'Save changes'}
                      </button>
                    </div>
                  </form>
                </section>
              )}

              {activeTab === 'password' && (
                <section className="overflow-hidden rounded-3xl border border-emerald-900/10 bg-white shadow-sm">
                  <div className="border-b border-zinc-100 px-5 py-4 sm:px-6">
                    <h2 className="flex items-center gap-2 text-[15px] font-extrabold tracking-tight text-zinc-900">
                      Change Password
                      <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#007a2e]">
                        <Lock className="h-2.5 w-2.5" />
                        Secure
                      </span>
                    </h2>
                    <p className="text-[12px] text-zinc-500">Use at least 6 characters with a mix of letters and numbers.</p>
                  </div>
                  <form onSubmit={handlePasswordChange} className="space-y-4 p-5 sm:p-6">
                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                        Current Password
                      </label>
                      <input type="password" required value={pwForm.currentPassword}
                        onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                        placeholder="Enter current password" className={inputClass} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                          New Password
                        </label>
                        <input type="password" required minLength={6} value={pwForm.newPassword}
                          onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                          placeholder="At least 6 characters" className={inputClass} />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                          Confirm New
                        </label>
                        <input type="password" required minLength={6} value={pwForm.confirmPassword}
                          onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
                          placeholder="Repeat new password" className={inputClass} />
                      </div>
                    </div>
                    <div className="flex justify-end border-t border-zinc-100 pt-4">
                      <button type="submit" disabled={pwLoading}
                        className="h-10 rounded-xl bg-zinc-900 px-6 text-[13px] font-bold text-white transition hover:bg-zinc-800 disabled:opacity-60">
                        {pwLoading ? 'Updating...' : 'Update password'}
                      </button>
                    </div>
                  </form>
                </section>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AlumniAccounts;
