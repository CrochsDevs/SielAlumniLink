import { useState } from "react";
import { useAuth } from "../../context/useAuth";
import AdminSidebar from "../../layout/sidebar/admin/adminSidebar";
import AdminTopbar from "../../layout/topbar/alumni/adminTopbar";
import CareerBoard from "../../components/career/CareerBoard";

export default function AdminCareer() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="alumni-career-page min-h-screen">
      <AdminSidebar
        user={user}
        mobileOpen={sidebarOpen}
        setMobileOpen={setSidebarOpen}
      />
      <div className="lg:pl-64">
        <AdminTopbar
          user={user}
          title="Job Posts"
          onMenuClick={() => setSidebarOpen(true)}
        />
        <CareerBoard appearance="marketplace" />
      </div>
    </div>
  );
}
