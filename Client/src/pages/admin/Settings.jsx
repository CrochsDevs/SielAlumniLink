import { AdminTabs, AdminSwitch } from "../../components/admin/AdminUI";
import PageHeader from "../../components/ui/PageHeader";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Swal from "sweetalert2";
import { gooeyToast as toast } from 'goey-toast';
import { Users, ShieldCheck, Bell, Moon, Sun, Monitor } from "lucide-react";
import ProfilePhotoUpload from "../../components/profile/ProfilePhotoUpload";
import { useAuth } from "../../context/useAuth";
import { useNotifications } from "../../realtime/useNotifications";
import { getTheme, setTheme } from "../../lib/theme";
import AdminSidebar from "../../layout/sidebar/admin/adminSidebar";
import AdminTopbar from "../../layout/topbar/alumni/adminTopbar";
import api from "../../utils/axios";

const TABS = [
  { key: "account", label: "Account Management", icon: Users },
  { key: "security", label: "Security and Password", icon: ShieldCheck },
  { key: "notifications", label: "Notification", icon: Bell },
  { key: "appearance", label: "Dark Mode", icon: Moon },
];

export default function Settings() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const activeTab = TABS.some((t) => t.key === searchParams.get("tab"))
    ? searchParams.get("tab")
    : "account";

  // Account tab state (personal information only —
  // role changes and deletes live in /admin/users).
  const [myName, setMyName] = useState("");
  const [myEmail, setMyEmail] = useState("");
  const [myNameSaving, setMyNameSaving] = useState(false);

  // Security tab state
  const [pwForm, setPwForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [pwLoading, setPwLoading] = useState(false);

  // Notification tab: preference toggles (persisted) filter the real feed.
  const [notifPrefs, setNotifPrefs] = useState(() => {
    try {
      return {
        announcements: true,
        jobs: true,
        events: true,
        ...JSON.parse(localStorage.getItem("notifPrefs") || "{}"),
      };
    } catch {
      return { announcements: true, jobs: true, events: true };
    }
  });
  const {
    items: notifItems,
    markRead: markNotifRead,
    markAllRead: markAllNotifsRead,
  } = useNotifications();

  const toggleNotifPref = (key) => {
    setNotifPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem("notifPrefs", JSON.stringify(next));
      return next;
    });
  };

  const visibleNotifs = notifItems.filter((item) => {
    if (!item.kind || item.kind === "general") return true;
    return notifPrefs[item.kind] !== false;
  });

  // Appearance tab state
  const [theme, setThemeState] = useState(getTheme);

  const changeTheme = (value) => {
    setTheme(value);
    setThemeState(value);
  };

  useEffect(() => {
    if (user?.name) setMyName(user.name);
    if (user?.email) setMyEmail(user.email);
  }, [user?.name, user?.email]);

  const handleSaveMyInfo = async (e) => {
    e.preventDefault();
    if (!myName.trim() || !myEmail.trim()) {
      toast.error("Error", { description: "Please provide name and email" });
      return;
    }
    const emailChanged = myEmail.trim() !== user?.email;
    if (emailChanged) {
      const confirm = await Swal.fire({
        title: "Change your email?",
        text: "Your login will switch to the new email and you will be logged out.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Yes, change it",
        cancelButtonText: "Cancel",
        confirmButtonColor: "#009639",
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
        toast.success("Email updated", { description: "Please log in again with your new email." });
        navigate("/login", { replace: true });
        return;
      }
      await refreshUser();
      toast.success("Saved", { description: "Your personal information has been updated." });
    } catch (err) {
      toast.error("Error", { description: err.response?.data?.message || "Failed to update profile" });
    } finally {
      setMyNameSaving(false);
    }
  };

  const switchTab = (key) => setSearchParams({ tab: key });

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast.error("Error", { description: "New passwords do not match" });
      return;
    }
    setPwLoading(true);
    try {
      await api.post("/auth/password/change", pwForm);
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });

      // Stay or logout? Auto-logout after 5 seconds of no choice.
      const choice = await Swal.fire({
        title: "Password changed!",
        text: "Stay logged in on this device, or log out now? Auto logout in 5 seconds.",
        icon: "success",
        showConfirmButton: true,
        confirmButtonText: "Stay logged in",
        confirmButtonColor: "#009639",
        showDenyButton: true,
        denyButtonText: "Log out now",
        denyButtonColor: "#71717a",
        reverseButtons: true,
        timer: 5000,
        timerProgressBar: true,
      });

      if (!choice.isConfirmed) {
        await logout();
        navigate("/login", { replace: true });
      }
    } catch (err) {
      toast.error("Error", { description: err.response?.data?.message || "Failed to change password" });
    } finally {
      setPwLoading(false);
    }
  };

  const inputClass =
    "w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[12.5px] text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 outline-none transition-all duration-200 hover:border-zinc-300 focus:border-brand focus:ring-2 focus:ring-brand/15";

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
          title="Settings"
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="workspace-page p-4 sm:p-6">
          <PageHeader title="Settings" description="Manage your profile, account preferences, and security." />
          <div className="flex flex-col md:flex-row gap-5 items-start">
            {/* Sub-sidebar */}
            <aside className="w-full md:w-60 shrink-0 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm p-2">
              <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Settings
              </p>
              <AdminTabs label="Settings sections" value={activeTab} onChange={switchTab} className="admin-tabs-vertical" items={TABS.map(item => ({ id: item.key, label: item.label, icon: item.icon }))} />
            </aside>

            {/* Content */}
            <div className="flex-1 min-w-0 w-full">
              {/* ACCOUNT */}
              {activeTab === "account" && (
                <div className="space-y-4">
                  {/* My personal information */}
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-zinc-100">
                      <h2 className="admin-section-title text-[15px] font-bold text-zinc-800 dark:text-zinc-100">
                        My Personal Information
                      </h2>
                      <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
                        Update your own admin profile.
                      </p>
                    </div>
                    <div className="flex items-center gap-4 px-5 pt-5">
                      <div className="relative">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-2xl font-extrabold text-brand ring-2 ring-emerald-100">
                          {user?.profilePicture ? (
                            <img
                              src={user.profilePicture}
                              alt="Profile"
                              className="h-full w-full rounded-full object-cover"
                            />
                          ) : (
                            (user?.name || "A").charAt(0).toUpperCase()
                          )}
                        </div>
                      </div>
                      <div>
                        <ProfilePhotoUpload />
                        <p className="mt-1 text-[10.5px] text-zinc-400">
                          Image files up to 10 MB.
                        </p>
                      </div>
                    </div>
                    <form
                      onSubmit={handleSaveMyInfo}
                      className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end"
                    >
                      <div className="flex-1">
                        <label className="mb-1 block text-[11px] font-semibold text-zinc-700">
                          Full Name
                        </label>
                        <input
                          value={myName}
                          onChange={(e) => setMyName(e.target.value)}
                          required
                          placeholder="Your full name"
                          className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[12.5px] outline-none transition hover:border-zinc-300 focus:border-brand focus:ring-2 focus:ring-brand/15"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="mb-1 block text-[11px] font-semibold text-zinc-700">
                          Email
                        </label>
                        <input
                          type="email"
                          value={myEmail}
                          onChange={(e) => setMyEmail(e.target.value)}
                          required
                          placeholder="Your email"
                          className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[12.5px] outline-none transition hover:border-zinc-300 focus:border-brand focus:ring-2 focus:ring-brand/15"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={myNameSaving}
                        className="h-9 rounded-lg bg-brand px-5 text-[12.5px] font-semibold text-white transition hover:bg-brand disabled:opacity-60"
                      >
                        {myNameSaving ? "Saving..." : "Save"}
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* SECURITY */}
              {activeTab === "security" && (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm p-5 max-w-md">
                  <h2 className="admin-section-title text-[15px] font-bold text-zinc-800 dark:text-zinc-100">
                    Security and Password
                  </h2>
                  <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mb-4">
                    Change your own login password.
                  </p>
                  <form onSubmit={handlePasswordChange} className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                        Current Password
                      </label>
                      <input
                        type="password"
                        required
                        value={pwForm.currentPassword}
                        onChange={(e) =>
                          setPwForm({
                            ...pwForm,
                            currentPassword: e.target.value,
                          })
                        }
                        placeholder="Enter current password"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                        New Password
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={pwForm.newPassword}
                        onChange={(e) =>
                          setPwForm({ ...pwForm, newPassword: e.target.value })
                        }
                        placeholder="At least 6 characters"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={pwForm.confirmPassword}
                        onChange={(e) =>
                          setPwForm({
                            ...pwForm,
                            confirmPassword: e.target.value,
                          })
                        }
                        placeholder="Repeat new password"
                        className={inputClass}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={pwLoading}
                      className="w-full h-9 rounded-lg bg-brand text-white text-[12.5px] font-semibold hover:bg-brand disabled:opacity-60 transition-colors"
                    >
                      {pwLoading ? "Saving..." : "Change password"}
                    </button>
                  </form>
                </div>
              )}

              {/* NOTIFICATIONS */}
              {activeTab === "notifications" && (
                <div className="space-y-4 max-w-md">
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm p-5 space-y-1">
                    <h2 className="admin-section-title text-[15px] font-bold text-zinc-800 dark:text-zinc-100">
                      Preferences
                    </h2>
                    <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mb-2">
                      Choose which alerts appear in your feed.
                    </p>
                    {[
                      [
                        "announcements",
                        "Announcements",
                        "University and alumni announcements",
                      ],
                      [
                        "jobs",
                        "Job alerts",
                        "New job posts matching your profile",
                      ],
                      ["events", "Events", "New gatherings and activities"],
                    ].map(([key, label, desc]) => (
                      <AdminSwitch
                        key={key}
                        label={label}
                        description={desc}
                        checked={notifPrefs[key] !== false}
                        onChange={() => toggleNotifPref(key)}
                      />
                    ))}
                  </div>

                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h2 className="admin-section-title text-[15px] font-bold text-zinc-800 dark:text-zinc-100">
                          Recent Alerts
                        </h2>
                        <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
                          Filtered by your preferences.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={markAllNotifsRead}
                        className="text-[11.5px] font-semibold text-brand hover:underline"
                      >
                        Mark all read
                      </button>
                    </div>
                    <ul className="space-y-1">
                      {visibleNotifs.slice(0, 10).map((item) => (
                        <li key={item._id}>
                          <button
                            type="button"
                            onClick={() => markNotifRead(item._id)}
                            className={`flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-800 ${!item.read ? "bg-emerald-50/50" : ""}`}
                          >
                            <span
                              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${!item.read ? "bg-brand" : "bg-zinc-200"}`}
                            />
                            <span className="min-w-0">
                              <span className="block truncate text-[12.5px] font-bold text-zinc-800 dark:text-zinc-100">
                                {item.title}
                              </span>
                              {item.body && (
                                <span className="block truncate text-[11.5px] text-zinc-500 dark:text-zinc-400">
                                  {item.body}
                                </span>
                              )}
                              <span className="block text-[10.5px] text-zinc-400">
                                {new Date(item.createdAt).toLocaleString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    hour: "numeric",
                                    minute: "2-digit",
                                  },
                                )}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                      {visibleNotifs.length === 0 && (
                        <li className="py-6 text-center text-[12.5px] text-zinc-400">
                          No alerts — enable a category above or wait for new
                          posts.
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              )}

              {/* APPEARANCE */}
              {activeTab === "appearance" && (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm p-5 max-w-md">
                  <h2 className="admin-section-title text-[15px] font-bold text-zinc-800 dark:text-zinc-100">
                    Appearance
                  </h2>
                  <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mb-3">
                    Choose how SielAlumni looks on this device.
                  </p>
                  <AdminTabs label="Color theme" value={theme} onChange={changeTheme} items={[
                      { key: "light", label: "Light", icon: Sun },
                      { key: "dark", label: "Dark", icon: Moon },
                      { key: "system", label: "System", icon: Monitor },
                    ].map(item => ({ id: item.key, label: item.label, icon: item.icon }))} />
                  <p className="mt-3 text-[11.5px] text-zinc-400">
                    System follows your device setting and updates
                    automatically.
                  </p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
