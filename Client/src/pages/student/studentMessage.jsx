import { useState } from "react";
import { useAuth } from "../../context/useAuth";
import StudentSidebar from "../../layout/sidebar/student/studentSidebar";
import StudentTopbar from "../../layout/topbar/student/studentTopbar";
import {
  useInbox,
  ConvoList,
  ThreadPane,
} from "../../components/chat/InboxParts";
import RequestsList, {
  RequestsHeader,
  useRequests,
} from "../../components/connections/RequestsInbox";

const StudentMessage = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const inbox = useInbox();
  const { activeId } = inbox;
  const { requests, loading, respond } = useRequests();
  const [activeTab, setActiveTab] = useState("chats");

  return (
    <div className="student-page min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <StudentSidebar
        user={user}
        mobileOpen={sidebarOpen}
        setMobileOpen={setSidebarOpen}
      />

      <div className="lg:pl-64">
        <StudentTopbar
          user={user}
          title="Message"
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="mx-auto max-w-6xl p-4 sm:p-6 workspace-page">
          <header className="mb-5 border-b border-zinc-200 pb-5 dark:border-zinc-800 workspace-page-header">
            <h1>Messages</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              Your conversations and connection requests.
            </p>
          </header>
          <div className="flex border-b border-zinc-200 dark:border-zinc-800 mb-6">
            <button
              type="button"
              onClick={() => setActiveTab("chats")}
              className={`flex-1 rounded-t-md px-4 py-2 text-[13px] font-medium transition-colors ${activeTab === "chats" ? "text-brand bg-brand/10 dark:text-brand dark:bg-zinc-800" : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
            >
              Chats
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("requests")}
              className={`flex-1 rounded-t-md px-4 py-2 text-[13px] font-medium transition-colors ${activeTab === "requests" ? "text-brand bg-brand/10 dark:text-brand dark:bg-zinc-800" : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
            >
              Requests
            </button>
          </div>

          {activeTab === "chats" && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-[300px_minmax(0,1fr)]">
              <div className={`min-w-0 ${activeId ? "hidden md:block" : "block"}`}>
                <ConvoList {...inbox} />
              </div>
              <div className={`min-w-0 ${activeId ? "block" : "hidden md:block"}`}>
                <ThreadPane {...inbox} />
              </div>
            </div>
          )}

          {activeTab === "requests" && (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6">
              <RequestsHeader count={requests.length} />
              <RequestsList
                requests={requests}
                loading={loading}
                onRespond={respond}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default StudentMessage;
