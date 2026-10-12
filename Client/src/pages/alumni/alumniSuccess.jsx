import { useState } from 'react';
import { Trophy } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import AlumniSidebar from '../../layout/sidebar/alumni/alumniSidebar';
import AlumniTopbar from '../../layout/topbar/alumni/alumniTopbar';
import AlumniFeed from '../../components/feed/AlumniFeed';

export default function AlumniSuccess() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return <div className="min-h-screen bg-[#f3f6f3] dark:bg-zinc-950">
    <AlumniSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />
    <div className="lg:pl-64">
      <AlumniTopbar user={user} title="Success Stories" onMenuClick={() => setSidebarOpen(true)} />
      <main className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
        <div className="rounded-2xl bg-gradient-to-br from-[#0F4C3A] to-[#009639] p-6 text-white">
          <h1 className="flex items-center gap-2 text-xl font-bold"><Trophy size={24} />Alumni success stories</h1>
          <p className="mt-2 text-sm text-white/80">Share your journey, celebrate achievements, and inspire fellow Sielesyuans.</p>
        </div>
        <AlumniFeed onlyType="story" />
      </main>
    </div>
  </div>;
}