import { useState } from "react";
import { useAuth } from "../../context/useAuth";
import AlumniSidebar from "../../layout/sidebar/alumni/alumniSidebar";
import AlumniTopbar from "../../layout/topbar/alumni/alumniTopbar";
import CareerBoard from "../../components/career/CareerBoard";
import ReferralBoard from "../../components/career/ReferralBoard";
import "./alumniCareer.css";

export default function AlumniCareer() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="alumni-career-page min-h-screen">
      <AlumniSidebar
        user={user}
        mobileOpen={sidebarOpen}
        setMobileOpen={setSidebarOpen}
      />
      <div className="lg:pl-64">
        <AlumniTopbar
          user={user}
          title="Career"
          onMenuClick={() => setSidebarOpen(true)}
        />
        <CareerBoard appearance="marketplace" referralContent={<ReferralBoard embedded />} />
      </div>
    </div>
  );
}
