import { useState } from 'react';
import { useAuth } from '../../context/useAuth';
import StudentSidebar from '../../layout/sidebar/student/studentSidebar';
import StudentTopbar from '../../layout/topbar/student/studentTopbar';
import CareerBoard from '../../components/career/CareerBoard';

export default function StudentCareer() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return <div className="student-page min-h-screen bg-zinc-100 dark:bg-zinc-950">
    <StudentSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />
    <div className="lg:pl-64">
      <StudentTopbar user={user} title="Career" onMenuClick={() => setSidebarOpen(true)} />
      <CareerBoard />
    </div>
  </div>;
}
