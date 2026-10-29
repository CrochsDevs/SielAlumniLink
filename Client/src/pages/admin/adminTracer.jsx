import { AdminTabs } from "../../components/admin/AdminUI";
import PageHeader from "../../components/ui/PageHeader";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import AdminSidebar from "../../layout/sidebar/admin/adminSidebar";
import AdminTopbar from "../../layout/topbar/alumni/adminTopbar";
import TracerResponses from "../../components/tracer/TracerResponses";
import EmploymentReports from "../../components/tracer/EmploymentReports";
import ProgramAlignmentReport from "../../components/tracer/ProgramAlignmentReport";

const views = [
  { id: "responses", label: "Tracer Responses" },
  { id: "alignment", label: "Program–Job Alignment" },
  { id: "employment", label: "Employment Reports" },
];

export default function AdminTracer() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const view = views.some((item) => item.id === searchParams.get("view"))
    ? searchParams.get("view")
    : "responses";
  const changeView = (id) => {
    const next = new URLSearchParams(searchParams);
    if (id === "responses") next.delete("view");
    else next.set("view", id);
    setSearchParams(next);
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <AdminSidebar
        user={user}
        mobileOpen={sidebarOpen}
        setMobileOpen={setSidebarOpen}
      />
      <div className="lg:pl-64">
        <AdminTopbar
          user={user}
          title="Tracer Study"
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="workspace-page mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
          <PageHeader title="Tracer Study" description="Track graduate employment, program alignment, and outcomes after graduation." />
          <AdminTabs label="Tracer study views" value={view} onChange={changeView} items={views.map(item => ({ id: item.id, label: item.label }))} />

          {view === "alignment" ? (
            <ProgramAlignmentReport />
          ) : view === "employment" ? (
            <EmploymentReports />
          ) : (
            <TracerResponses />
          )}
        </main>
      </div>
    </div>
  );
}
