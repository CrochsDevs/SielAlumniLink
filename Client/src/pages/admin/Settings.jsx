import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { Users, ShieldCheck, Bell, Moon } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import AdminSidebar from '../../layout/sidebar/admin/adminSidebar';
import AdminTopbar from '../../layout/topbar/alumni/adminTopbar';
import api from '../../utils/axios';

const TABS = [
  { key: 'account', label: 'Account Management', icon: Users },
  { key: 'security', label: 'Security and Password', icon: ShieldCheck },
  { key: 'notifications', label: 'Notification', icon: Bell },
  { key: 'appearance', label: 'Dark Mode', icon: Moon },
];

const NOTIF_DEFAULTS = { announcements: true, jobs: true, messages: true };

const loadNotifs = () => {
  try {
    return { ...NOTIF_DEFAULTS, ...JSON.parse(localStorage.getItem('notifPrefs') || '{}') };
  } catch {
    return { ...NOTIF_DEFAULTS };
  }
};

export default function Settings() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const activeTab = TABS.some((t) => t.key === searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'account';

  // Account tab state (personal information only —
  // role changes and deletes live in /admin/users).
  const [myName, setMyName] = useState('');
  const [myEmail, setMyEmail] = useState('');
  const [myNameSaving, setMyNameSaving] = useState(false);

  // Security tab state
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwLoading, setPwLoading] = useState(false);

  // Notification tab state
  const [notifs, setNotifs] = useState(loadNotifs);

  // Appearance tab state
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    if (user?.name) setMyName(user.name);
    if (user?.email) setMyEmail(user.email);
  }, [user?.name, user?.email]);

  const handleSaveMyInfo = async (e) => {
    e.preventDefault();
    if (!myName.trim() || !myEmail.trim()) {
      Swal.fire('Error', 'Please provide name and email', 'error');
      return;
    }
    const emailChanged = myEmail.trim() !== user?.email;
    if (emailChanged) {
      const confirm = await Swal.fire({
        title: 'Change your email?',
        text: 'Your login will switch to the new email and you will be logged out.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, change it',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#009639',
        reverseButtons: true,
      });
      if (!confirm.isConfirmed) return;
    }
    setMyNameSaving(true);
    try {
      // Admin route syncs both directory profile and login record.
      const res = await api.put(`/users/${user._id}`, {
        name: myName.trim(),
        email: myEmail.trim(),
      });
      if (res.data.data?.emailChanged) {
        await logout();
        Swal.fire('Email updated', 'Please log in again with your new email.', 'success');
        navigate('/login', { replace: true });
        return;
      }
      await refreshUser();
      Swal.fire({ title: 'Saved', text: 'Your personal information has been updated.', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to update profile', 'error');
    } finally {
      setMyNameSaving(false);
    }
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  const switchTab = (key) => setSearchParams({ tab: key });

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

  const toggleNotif = (key) => {
    setNotifs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem('notifPrefs', JSON.stringify(next));
      return next;
    });
  };

  const inputClass =
    'w-full h-9 px-3 rounded-lg border border-zinc-200 bg-white text-[12.5px] text-zinc-800 placeholder-zinc-400 outline-none transition-all duration-200 hover:border-zinc-300 focus:border-[#009639] focus:ring-2 focus:ring-[#009639]/15';

  return (
    <div className="min-h-screen bg-zinc-50">
      <AdminSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />

      <div className="lg:pl-64">
        <AdminTopbar user={user} title="Settings" onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-4 sm:p-6">
          <div className="flex flex-col md:flex-row gap-5 items-start">
            {/* Sub-sidebar */}
            <aside className="w-full md:w-60 shrink-0 rounded-xl border border-zinc-200 bg-white shadow-sm p-2">
              <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Settings
              </p>
              <nav className="space-y-0.5">
                {TABS.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => switchTab(key)}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-[12.5px] transition-colors text-left ${
                      activeTab === key
                        ? 'bg-[#009639]/10 text-[#009639] font-semibold'
                        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 font-medium'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{label}</span>
                  </button>
                ))}
              </nav>
            </aside>

            {/* Content */}
            <div className="flex-1 min-w-0 w-full">

          {/* ACCOUNT */}
          {activeTab === 'account' && (
            <div className="space-y-4">
            {/* My personal information */}
            <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-100">
                <h2 className="text-[15px] font-bold text-zinc-800">My Personal Information</h2>
                <p className="text-[12px] text-zinc-500">Update your own admin profile.</p>
              </div>
              <form onSubmit={handleSaveMyInfo} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label className="mb-1 block text-[11px] font-semibold text-zinc-700">Full Name</label>
                  <input value={myName} onChange={(e) => setMyName(e.target.value)} required
                    placeholder="Your full name"
                    className="w-full h-9 px-3 rounded-lg border border-zinc-200 bg-white text-[12.5px] outline-none transition hover:border-zinc-300 focus:border-[#009639] focus:ring-2 focus:ring-[#009639]/15" />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-[11px] font-semibold text-zinc-700">Email</label>
                  <input type="email" value={myEmail} onChange={(e) => setMyEmail(e.target.value)} required
                    placeholder="Your email"
                    className="w-full h-9 px-3 rounded-lg border border-zinc-200 bg-white text-[12.5px] outline-none transition hover:border-zinc-300 focus:border-[#009639] focus:ring-2 focus:ring-[#009639]/15" />
                </div>
                <button type="submit" disabled={myNameSaving}
                  className="h-9 rounded-lg bg-[#009639] px-5 text-[12.5px] font-semibold text-white transition hover:bg-[#007a2e] disabled:opacity-60">
                  {myNameSaving ? 'Saving...' : 'Save'}
                </button>
              </form>
            </div>
            </div>
          )}

          {/* SECURITY */}
          {activeTab === 'security' && (
            <div className="rounded-xl border border-zinc-200 bg-white shadow-sm p-5 max-w-md">
              <h2 className="text-[15px] font-bold text-zinc-800">Security and Password</h2>
              <p className="text-[12px] text-zinc-500 mb-4">Change your own login password.</p>
              <form onSubmit={handlePasswordChange} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-700 mb-1">Current Password</label>
                  <input type="password" required value={pwForm.currentPassword}
                    onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                    placeholder="Enter current password" className={inputClass} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-700 mb-1">New Password</label>
                  <input type="password" required minLength={6} value={pwForm.newPassword}
                    onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                    placeholder="At least 6 characters" className={inputClass} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-700 mb-1">Confirm New Password</label>
                  <input type="password" required minLength={6} value={pwForm.confirmPassword}
                    onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
                    placeholder="Repeat new password" className={inputClass} />
                </div>
                <button type="submit" disabled={pwLoading}
                  className="w-full h-9 rounded-lg bg-[#009639] text-white text-[12.5px] font-semibold hover:bg-[#007a2e] disabled:opacity-60 transition-colors">
                  {pwLoading ? 'Saving...' : 'Change password'}
                </button>
              </form>
            </div>
          )}

          {/* NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="rounded-xl border border-zinc-200 bg-white shadow-sm p-5 max-w-md space-y-1">
              <h2 className="text-[15px] font-bold text-zinc-800">Notification</h2>
              <p className="text-[12px] text-zinc-500 mb-3">Stored on this device.</p>
              {[
                ['announcements', 'Announcements', 'University and alumni announcements'],
                ['jobs', 'Job alerts', 'New job posts matching your profile'],
                ['messages', 'Messages', 'New inbox messages'],
              ].map(([key, label, desc]) => (
                <button key={key} type="button" onClick={() => toggleNotif(key)}
                  className="flex items-center justify-between w-full px-3 py-3 rounded-lg hover:bg-zinc-50 transition-colors text-left">
                  <span>
                    <span className="block text-[13px] font-semibold text-zinc-800">{label}</span>
                    <span className="block text-[11.5px] text-zinc-500">{desc}</span>
                  </span>
                  <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${notifs[key] ? 'bg-[#009639]' : 'bg-zinc-200'}`}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${notifs[key] ? 'left-[22px]' : 'left-0.5'}`} />
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* APPEARANCE */}
          {activeTab === 'appearance' && (
            <div className="rounded-xl border border-zinc-200 bg-white shadow-sm p-5 max-w-md">
              <h2 className="text-[15px] font-bold text-zinc-800">Dark Mode</h2>
              <p className="text-[12px] text-zinc-500 mb-3">Toggles the dark theme across the app.</p>
              <button type="button" onClick={() => setDark(!dark)}
                className="flex items-center justify-between w-full px-3 py-3 rounded-lg hover:bg-zinc-50 transition-colors text-left">
                <span>
                  <span className="block text-[13px] font-semibold text-zinc-800">Dark mode</span>
                  <span className="block text-[11.5px] text-zinc-500">{dark ? 'On' : 'Off'}</span>
                </span>
                <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${dark ? 'bg-[#009639]' : 'bg-zinc-200'}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${dark ? 'left-[22px]' : 'left-0.5'}`} />
                </span>
              </button>
            </div>
          )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
