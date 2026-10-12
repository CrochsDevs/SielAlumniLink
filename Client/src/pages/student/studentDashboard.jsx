import { useState } from 'react';
import { useAuth } from '../../context/useAuth';
import StudentSidebar from '../../layout/sidebar/student/studentSidebar';
import StudentTopbar from '../../layout/topbar/student/studentTopbar';
import AlumniFeed from '../../components/feed/AlumniFeed';

// TEMPORARY placeholder — lalagyan ng tunay na content kapag ready na.
// TODO(student): build real student dashboard here.
const StudentDashboard = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f3f6f3]">
      <StudentSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />

      <div className="lg:pl-64">
        <StudentTopbar user={user} title="Dashboard" onMenuClick={() => setSidebarOpen(true)} />

        <main className="mx-auto max-w-3xl p-4 sm:p-6">
          <div className="rounded-3xl bg-gradient-to-br from-[#0F4C3A] via-[#007a2e] to-[#009639] p-8 text-center text-white shadow-lg shadow-emerald-900/10 sm:p-10">
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/60">
              Student Portal
            </p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
              Welcome, {user?.name?.split(' ')[0] || 'Student'}!
            </h1>
            <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-white/75">
              Discover alumni updates, career opportunities, events, and success stories from your community.
            </p>
          </div>
          <div className="mt-4"><AlumniFeed showComposer={false} /></div>
        </main>
      </div>
    </div>
  );
};

export default StudentDashboard;
