import { createElement, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Newspaper } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import AlumniSidebar from '../layout/sidebar/alumni/alumniSidebar';
import AlumniTopbar from '../layout/topbar/alumni/alumniTopbar';
import StudentSidebar from '../layout/sidebar/student/studentSidebar';
import StudentTopbar from '../layout/topbar/student/studentTopbar';
import AdminSidebar from '../layout/sidebar/admin/adminSidebar';
import AdminTopbar from '../layout/topbar/alumni/adminTopbar';
import AlumniFeed from '../components/feed/AlumniFeed';
import AlumniDashboard from './alumni/alumniDashboard';
import AdminFeedTools from '../components/feed/AdminFeedTools';
import ProfileAvatar from '../components/profile/ProfileAvatar';

export default function FeedPage() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const Sidebar = user?.role === 'student' ? StudentSidebar : user?.role === 'admin' ? AdminSidebar : AlumniSidebar;
  const Topbar = user?.role === 'student' ? StudentTopbar : user?.role === 'admin' ? AdminTopbar : AlumniTopbar;
  if (user?.role === 'alumni') return <AlumniDashboard />;
  const isAdmin = user?.role === 'admin';
  return <div className="min-h-screen bg-[#f3f6f3] dark:bg-zinc-950">
    {createElement(Sidebar, { user, mobileOpen: sidebarOpen, setMobileOpen: setSidebarOpen })}
    <div className="lg:pl-64">
      {createElement(Topbar, { user, title: 'Alumni Feed', onMenuClick: () => setSidebarOpen(true) })}
      <main className="mx-auto grid max-w-7xl gap-4 p-3 text-zinc-900 sm:p-5 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_280px] dark:text-zinc-100">
        <aside className="order-2 min-w-0 space-y-3 lg:order-none lg:sticky lg:top-20 lg:self-start">
          <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900"><div className="h-16 bg-gradient-to-r from-[#0F4C3A] to-[#009639]" />
            <div className="px-4 pb-4 text-center"><span className="mx-auto -mt-6 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-white text-[#009639] ring-2 ring-emerald-100 dark:bg-zinc-900 dark:ring-emerald-900"><ProfileAvatar user={user} /></span><p className="mt-3 break-words text-sm font-bold">{user?.name}</p><p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{isAdmin ? 'Administrator' : 'Student'}</p>
              <Link to={isAdmin ? '/admin' : '/student'} className="mt-4 block rounded-xl bg-[#009639] px-3 py-2.5 text-xs font-bold text-white">Dashboard</Link>
            </div>
          </section>
          <div className="rounded-2xl bg-gradient-to-br from-[#0F4C3A] to-[#007a2e] p-4 text-white"><p className="flex items-center gap-2 text-sm font-bold">{isAdmin ? <Shield size={17} /> : <Newspaper size={17} />}{isAdmin ? 'Manage your community' : 'Your alumni network'}</p><p className="mt-2 text-xs leading-relaxed text-white/80">{isAdmin ? 'Keep alumni updates, opportunities, events, and stories welcoming and relevant.' : 'Discover alumni stories, opportunities, and events.'}</p></div>
        </aside>
        <section className="order-1 min-w-0 lg:order-none"><AlumniFeed moderationEnabled={isAdmin} /></section>
        {isAdmin && <aside className="order-3 min-w-0 lg:col-span-2 xl:col-span-1 xl:sticky xl:top-20 xl:self-start"><AdminFeedTools /></aside>}
      </main>
    </div>
  </div>;
}
