import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import AdminSidebar from '../../layout/sidebar/admin/adminSidebar';
import AdminTopbar from '../../layout/topbar/alumni/adminTopbar';
import TracerResponses from '../../components/tracer/TracerResponses';
import EmploymentReports from '../../components/tracer/EmploymentReports';
import ProgramAlignmentReport from '../../components/tracer/ProgramAlignmentReport';

const views = [
  { id: 'alignment', label: 'Program–Job Alignment' },
  { id: 'responses', label: 'Tracer Responses' },
  { id: 'employment', label: 'Employment Reports' },
];

export default function AdminTracer() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const view = views.some(item => item.id === searchParams.get('view')) ? searchParams.get('view') : 'alignment';
  const changeView = id => {
    const next = new URLSearchParams(searchParams);
    if (id === 'alignment') next.delete('view');
    else next.set('view', id);
    setSearchParams(next);
  };

  return <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
    <AdminSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />
    <div className="lg:pl-64">
      <AdminTopbar user={user} title="Tracer Study" onMenuClick={() => setSidebarOpen(true)} />
      <main className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
        <header className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h1 className="text-xl font-semibold">Tracer Study</h1>
          <p className="mt-1 text-xs leading-6 text-zinc-500 dark:text-zinc-400">Track how graduates use their programs in their work, including outcomes 3–5 years after graduation.</p>
          <nav aria-label="Tracer study views" className="mt-4 flex gap-2 overflow-x-auto">
            {views.map(item => <button key={item.id} type="button" aria-pressed={view === item.id} onClick={() => changeView(item.id)} className={`shrink-0 rounded-lg px-4 py-2.5 text-xs font-semibold transition ${view === item.id ? 'bg-[#009639] text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'}`}>{item.label}</button>)}
          </nav>
        </header>
        {view === 'alignment' ? <ProgramAlignmentReport /> : view === 'employment' ? <EmploymentReports /> : <TracerResponses />}
      </main>
    </div>
  </div>;
}
