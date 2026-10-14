import { useState } from 'react';
import { useAuth } from '../../context/useAuth';
import AlumniSidebar from '../../layout/sidebar/alumni/alumniSidebar';
import AlumniTopbar from '../../layout/topbar/alumni/alumniTopbar';
import CareerBoard from '../../components/career/CareerBoard';
import ReferralBoard from '../../components/career/ReferralBoard';

export default function AlumniCareer() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950">
    <AlumniSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />
    <div className="lg:pl-64">
      <AlumniTopbar user={user} title="Career" onMenuClick={() => setSidebarOpen(true)} />
      <CareerBoard referralContent={<ReferralBoard embedded />} />
    </div>
  </div>;
}
