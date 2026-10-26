import { useState } from "react";
import { useAuth } from "../../context/useAuth";
import AlumniSidebar from "../../layout/sidebar/alumni/alumniSidebar";
import AlumniTopbar from "../../layout/topbar/alumni/alumniTopbar";
import {
  useInbox,
  ConvoList,
  ThreadPane,
} from "../../components/chat/InboxParts";
import "../../components/chat/MessagesWorkspace.css";

const AlumniMessage = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const inbox = useInbox();
  const { activeId } = inbox;

  return (
    <div className="messages-workspace min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AlumniSidebar
        user={user}
        mobileOpen={sidebarOpen}
        setMobileOpen={setSidebarOpen}
      />

      <div className="messages-workspace-layout lg:pl-64">
        <AlumniTopbar
          user={user}
          title="Messages"
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main
          aria-label="Messages workspace"
          className="workspace-page messages-page grid grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)]"
        >
          <aside
            aria-label="Message list sidebar"
            className={`messages-sidebar-slot ${activeId ? "hidden md:block" : "block"}`}
          >
            <ConvoList {...inbox} workspace />
          </aside>
          <div
            className={`messages-thread-slot min-w-0 ${activeId ? "block" : "hidden md:block"}`}
          >
            <ThreadPane {...inbox} workspace />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AlumniMessage;
