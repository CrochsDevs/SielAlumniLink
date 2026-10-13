import { useState } from 'react';
import { useAuth } from '../../context/useAuth';
import StudentSidebar from '../../layout/sidebar/student/studentSidebar';
import StudentTopbar from '../../layout/topbar/student/studentTopbar';
import RequestsList, { RequestsHeader, useRequests } from '../../components/connections/RequestsInbox';

const StudentRequests = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { requests, loading, respond } = useRequests();

  return (
    <div className="student-page min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <StudentSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />

      <div className="lg:pl-64">
        <StudentTopbar user={user} title="Requests" onMenuClick={() => setSidebarOpen(true)} />

        <main className="mx-auto max-w-3xl space-y-3 p-4 sm:p-6">
          <RequestsHeader count={requests.length} />
          <RequestsList requests={requests} loading={loading} onRespond={respond} />
        </main>
      </div>
    </div>
  );
};

export default StudentRequests;
