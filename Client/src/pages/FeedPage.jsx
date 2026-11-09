import { createElement, useState } from "react";
import { Link } from "react-router-dom";
import { Newspaper } from "lucide-react";
import { useAuth } from "../context/useAuth";
import AlumniSidebar from "../layout/sidebar/alumni/alumniSidebar";
import AlumniTopbar from "../layout/topbar/alumni/alumniTopbar";
import StudentSidebar from "../layout/sidebar/student/studentSidebar";
import StudentTopbar from "../layout/topbar/student/studentTopbar";
import AlumniFeed from "../components/feed/AlumniFeed";
import AlumniDashboard from "./alumni/alumniDashboard";
import AdminFeed from "./admin/adminFeed";
import ProfileAvatar from "../components/profile/ProfileAvatar";

export default function FeedPage() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const Sidebar =
    user?.role === "student"
      ? StudentSidebar
      : AlumniSidebar;
  const Topbar =
    user?.role === "student"
      ? StudentTopbar
      : AlumniTopbar;
  if (user?.role === "alumni") return <AlumniDashboard />;
  if (user?.role === "admin") return <AdminFeed />;
  return (
    <div className="min-h-screen bg-[#f3f6f3] dark:bg-zinc-950">
      {createElement(Sidebar, {
        user,
        mobileOpen: sidebarOpen,
        setMobileOpen: setSidebarOpen,
      })}
      <div className="lg:pl-64">
        {createElement(Topbar, {
          user,
          title: "Alumni Feed",
          onMenuClick: () => setSidebarOpen(true),
        })}
        <main className="mx-auto grid max-w-7xl gap-4 p-3 text-zinc-900 sm:p-5 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_280px] dark:text-zinc-100 workspace-page">
          <aside className="order-2 min-w-0 space-y-3 lg:order-none lg:sticky lg:top-20 lg:self-start">
            <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
              <div className="h-16 bg-gradient-to-r from-brand to-brand dark:from-zinc-900 dark:to-zinc-900" />
              <div className="px-4 pb-4 text-center">
                <span className="mx-auto -mt-6 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-white text-brand ring-2 ring-emerald-100 dark:bg-zinc-900 dark:ring-brand">
                  <ProfileAvatar user={user} />
                </span>
                <p className="mt-3 break-words text-sm font-bold">
                  {user?.name}
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Student
                </p>
                <Link
                  to="/student"
                  className="mt-4 block rounded-xl bg-brand px-3 py-2.5 text-xs font-bold text-white"
                >
                  Dashboard
                </Link>
              </div>
            </section>
            <div className="rounded-2xl bg-gradient-to-br from-brand to-brand p-4 text-white dark:from-zinc-900 dark:to-zinc-900">
              <p className="flex items-center gap-2 text-sm font-bold">
                <Newspaper size={17} />
                Your alumni network
              </p>
              <p className="mt-2 text-xs leading-relaxed text-white/80">
                Discover alumni stories, opportunities, and events.
              </p>
            </div>
          </aside>
          <section className="order-1 min-w-0 lg:order-none">
            <AlumniFeed />
          </section>

        </main>
      </div>
    </div>
  );
}
