import { useState } from "react";
import { useAuth } from "../../context/useAuth";
import StudentSidebar from "../../layout/sidebar/student/studentSidebar";
import StudentTopbar from "../../layout/topbar/student/studentTopbar";
import CareerBoard from "../../components/career/CareerBoard";
import "../alumni/alumniCareer.css";
import "../../components/admin/AdminUI.css";
import "./studentCareer.css";

export default function StudentCareer() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="student-page alumni-career-page student-career-page min-h-screen">
      <StudentSidebar
        user={user}
        mobileOpen={sidebarOpen}
        setMobileOpen={setSidebarOpen}
      />
      <div className="lg:pl-64">
        <StudentTopbar
          user={user}
          title="Career"
          onMenuClick={() => setSidebarOpen(true)}
        />
        <div className="member-workspace admin-workspace student-career-board">
          <CareerBoard appearance="marketplace" />
        </div>
      </div>
    </div>
  );
}
