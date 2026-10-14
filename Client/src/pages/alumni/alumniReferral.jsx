import { useState } from "react";
import { useAuth } from "../../context/useAuth";
import AlumniSidebar from "../../layout/sidebar/alumni/alumniSidebar";
import AlumniTopbar from "../../layout/topbar/alumni/alumniTopbar";
import ReferralBoard from "../../components/career/ReferralBoard";

export default function AlumniReferral() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AlumniSidebar
        user={user}
        mobileOpen={sidebarOpen}
        setMobileOpen={setSidebarOpen}
      />
      <div className="lg:pl-64">
        <AlumniTopbar
          user={user}
          title="Referral"
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="mx-auto max-w-7xl p-4 sm:p-6">
          <ReferralBoard />
        </main>
      </div>
    </div>
  );
}
