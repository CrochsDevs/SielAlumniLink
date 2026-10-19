import { useState } from "react";
import { useAuth } from "../../context/useAuth";
import AdminSidebar from "../../layout/sidebar/admin/adminSidebar";
import AdminTopbar from "../../layout/topbar/alumni/adminTopbar";
import {
  useInbox,
  ConvoList,
  ThreadPane,
} from "../../components/chat/InboxParts";

const AdminMessage = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const inbox = useInbox();
  const { activeId } = inbox;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AdminSidebar
        user={user}
        mobileOpen={sidebarOpen}
        setMobileOpen={setSidebarOpen}
      />

      <div className="lg:pl-64">
        <AdminTopbar
          user={user}
          title="Message"
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="workspace-page mx-auto max-w-6xl p-4 sm:p-6">
          <div
            className="grid grid-cols-1 overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm md:grid-cols-[300px_minmax(0,1fr)]"
            style={{ height: "calc(100vh - 12rem)", minHeight: "480px" }}
          >
            <div className={`${activeId ? "hidden md:block" : "block"}`}>
              <ConvoList {...inbox} />
            </div>
            <div className={`min-w-0 ${activeId ? "block" : "hidden md:block"}`}>
              <ThreadPane {...inbox} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminMessage;
