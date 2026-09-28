import { useState } from 'react';
import { useAuth } from '../../context/useAuth';
import AdminSidebar from '../../layout/sidebar/admin/adminSidebar';
import AdminTopbar from '../../layout/topbar/alumni/adminTopbar';
import { useInbox, ConvoList, ThreadPane } from '../../components/chat/InboxParts';

const AdminMessage = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const inbox = useInbox();
  const { activeId } = inbox;

  return (
    <div className="min-h-screen bg-zinc-50">
      <AdminSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />

      <div className="lg:pl-64">
        <AdminTopbar user={user} title="Message" onMenuClick={() => setSidebarOpen(true)} />

        <main className="mx-auto max-w-6xl p-4 sm:p-6">
          <div className="grid overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm md:grid-cols-[300px_minmax(0,1fr)]" style={{ height: 'calc(100vh - 12rem)', minHeight: '480px' }}>
            <div className={`${activeId ? 'hidden md:block' : 'block'}`}>
              <ConvoList {...inbox} />
            </div>
            <div className={`${activeId ? 'block' : 'hidden md:block'}`}>
              <ThreadPane {...inbox} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminMessage;
