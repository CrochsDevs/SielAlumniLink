import { useState } from "react";
import { Search, RefreshCw } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import StudentSidebar from "../../layout/sidebar/student/studentSidebar";
import StudentTopbar from "../../layout/topbar/student/studentTopbar";
import RequestsList, {
  RequestsHeader,
  useRequests,
} from "../../components/connections/RequestsInbox";
import "./studentRequests.css";

const StudentRequests = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { requests, loading, error, respond, refresh } = useRequests();
  const [query, setQuery] = useState("");
  const filtered = requests.filter(request => `${request.name || ""} ${request.program || ""} ${request.email || ""}`.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="student-page student-requests-page min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <StudentSidebar
        user={user}
        mobileOpen={sidebarOpen}
        setMobileOpen={setSidebarOpen}
      />

      <div className="lg:pl-64">
        <StudentTopbar
          user={user}
          title="Requests"
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6 workspace-page">
          <RequestsHeader count={requests.length} />
          <div className="requests-toolbar">
            <label className="relative min-w-0 flex-1"><span className="sr-only">Search invitations</span><Search size={17} className="pointer-events-none absolute left-3 top-3.5 text-zinc-400" /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by name, program, or email" className="requests-search" /></label>
            <button type="button" onClick={refresh} disabled={loading} className="requests-refresh"><RefreshCw size={15} className={loading ? "animate-spin" : ""} />Refresh</button>
          </div>
          {!loading && !error && <p role="status" className="text-xs text-zinc-500 dark:text-zinc-400">{filtered.length} pending {filtered.length === 1 ? "invitation" : "invitations"}{query.trim() ? ` of ${requests.length}` : " to review"}</p>}
          <RequestsList
            requests={filtered}
            loading={loading}
            onRespond={respond}
            error={error}
            onRetry={refresh}
            searching={!!query.trim()}
            onClearSearch={() => setQuery("")}
          />
        </main>
      </div>
    </div>
  );
};

export default StudentRequests;
