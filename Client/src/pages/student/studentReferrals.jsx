import { useState } from "react";
import { useAuth } from "../../context/useAuth";
import StudentSidebar from "../../layout/sidebar/student/studentSidebar";
import StudentTopbar from "../../layout/topbar/student/studentTopbar";
import ReferralBoard from "../../components/career/ReferralBoard";

export default function StudentReferrals() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="student-page min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <StudentSidebar
        user={user}
        mobileOpen={sidebarOpen}
        setMobileOpen={setSidebarOpen}
      />
      <div className="lg:pl-64">
        <StudentTopbar
          user={user}
          title="Referrals"
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="mx-auto max-w-7xl p-4 sm:p-6">
          <ReferralBoard />
        </main>
      </div>
    </div>
  );
}
