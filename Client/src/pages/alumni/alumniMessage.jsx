import { useState } from "react";
import { useAuth } from "../../context/useAuth";
import PageHeader from "../../components/ui/PageHeader";
import AlumniSidebar from "../../layout/sidebar/alumni/alumniSidebar";
import AlumniTopbar from "../../layout/topbar/alumni/alumniTopbar";
import {
  useInbox,
  ConvoList,
  ThreadPane,
} from "../../components/chat/InboxParts";

const AlumniMessage = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const inbox = useInbox();
  const { activeId } = inbox;

  return (
    <div className="min-h-screen bg-[#f3f6f3] dark:bg-zinc-950">
      <AlumniSidebar
        user={user}
        mobileOpen={sidebarOpen}
        setMobileOpen={setSidebarOpen}
      />

      <div className="lg:pl-64">
        <AlumniTopbar
          user={user}
          title="Message"
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="mx-auto max-w-6xl p-4 sm:p-6 workspace-page">
          <PageHeader title="Messages" description="Keep your conversations with students and fellow alumni in one place." />
          <div
            className="grid grid-cols-1 overflow-hidden rounded-3xl border border-brand/10 bg-white dark:bg-zinc-900 shadow-sm md:grid-cols-[300px_minmax(0,1fr)]"
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

export default AlumniMessage;
