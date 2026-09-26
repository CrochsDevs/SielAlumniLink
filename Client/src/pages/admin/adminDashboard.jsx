import { useState } from 'react';
import { useAuth } from '../../context/useAuth';
import AdminSidebar from '../../layout/sidebar/admin/adminSidebar';
import AdminTopbar from '../../layout/topbar/alumni/adminTopbar';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-50">
      <AdminSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />

      <div className="lg:pl-64">
        <AdminTopbar user={user} title="Dashboard" onMenuClick={() => setSidebarOpen(true)} />

        {/* Content */}
        <main className="p-4 sm:p-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-zinc-800">
              Welcome, {user?.name || 'Admin'}
            </h2>
            <p className="mt-1 text-[13px] text-zinc-500">
              This is the admin dashboard. Pick a section from the sidebar to manage the alumni network.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
