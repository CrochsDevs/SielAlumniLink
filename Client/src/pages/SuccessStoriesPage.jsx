import { useState } from "react";
import { useAuth } from "../context/useAuth";
import AlumniSidebar from "../layout/sidebar/alumni/alumniSidebar";
import AlumniTopbar from "../layout/topbar/alumni/alumniTopbar";
import StudentSidebar from "../layout/sidebar/student/studentSidebar";
import StudentTopbar from "../layout/topbar/student/studentTopbar";
import AdminSidebar from "../layout/sidebar/admin/adminSidebar";
import AdminTopbar from "../layout/topbar/alumni/adminTopbar";
import SuccessStoriesBoard from "../components/stories/SuccessStoriesBoard";

export default function SuccessStoriesPage() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const Sidebar =
    user?.role === "student"
      ? StudentSidebar
      : user?.role === "admin"
        ? AdminSidebar
        : AlumniSidebar;
  const Topbar =
    user?.role === "student"
      ? StudentTopbar
      : user?.role === "admin"
        ? AdminTopbar
        : AlumniTopbar;
  return (
    <div
      className={`${user?.role === "student" ? "student-page " : ""}min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100`}
    >
      <Sidebar
        user={user}
        mobileOpen={sidebarOpen}
        setMobileOpen={setSidebarOpen}
      />
      <div className="lg:pl-64">
        <Topbar
          user={user}
          title="Success Stories"
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="mx-auto max-w-7xl p-4 sm:p-6 workspace-page">
          <SuccessStoriesBoard />
        </main>
      </div>
    </div>
  );
}
