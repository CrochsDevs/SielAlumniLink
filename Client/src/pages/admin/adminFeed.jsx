import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Megaphone, ShieldCheck, Users } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import api from "../../utils/axios";
import AdminSidebar from "../../layout/sidebar/admin/adminSidebar";
import AdminTopbar from "../../layout/topbar/alumni/adminTopbar";
import PageHeader from "../../components/ui/PageHeader";
import ProfileAvatar from "../../components/profile/ProfileAvatar";
import AlumniFeed from "../../components/feed/AlumniFeed";
import AdminFeedTools from "../../components/feed/AdminFeedTools";
import { FeedDialog } from "../../components/feed/FeedComposer";

export default function AdminFeed() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newsResult, setNewsResult] = useState(null);
  const [revision, setRevision] = useState(0);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    api.get("/announcements", { signal: controller.signal }).then(({ data }) => {
      if (!controller.signal.aborted) setNewsResult({ revision, items: (data.data || []).slice(0, 5) });
    }).catch(error => {
      if (!controller.signal.aborted) setNewsResult({ revision, error: error.response?.data?.message || "Unable to load announcements." });
    });
    return () => controller.abort();
  }, [revision]);
  const news = newsResult?.revision === revision ? newsResult : null;

  return <div className="min-h-screen bg-[#f3f6f3] text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
    <AdminSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />
    <div className="lg:pl-64">
      <AdminTopbar user={user} title="Alumni Feed" onMenuClick={() => setSidebarOpen(true)} />
      <main className="workspace-page mx-auto grid max-w-7xl gap-4 p-3 sm:p-5 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_280px]">
        <div className="col-span-full"><PageHeader title="Alumni Feed" description="Updates, conversations, and opportunities from your community." /></div>

        <aside aria-label="Admin profile and shortcuts" className="order-2 min-w-0 space-y-3 lg:sticky lg:top-20 lg:order-none lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto">
          <div className="overflow-hidden rounded-2xl border border-emerald-900/10 bg-white shadow-sm dark:bg-zinc-900">
            <div className="h-16 overflow-hidden bg-gradient-to-r from-[#0F4C3A] via-[#007a2e] to-[#009639]">
              {user?.bannerImage && <img src={user.bannerImage} alt="Profile banner" className="h-full w-full object-cover" />}
            </div>
            <div className="px-4 pb-4 text-center">
              <div className="relative mx-auto -mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-white text-xl font-extrabold text-[#009639] shadow ring-2 ring-emerald-100 dark:bg-zinc-900 dark:text-emerald-300 dark:ring-emerald-900"><ProfileAvatar user={user} fallback="A" /></div>
              <p className="mt-2 flex items-center justify-center gap-1 text-[14px] font-bold"><span className="truncate">{user?.name || "Admin"}</span><ShieldCheck className="h-4 w-4 shrink-0 text-[#009639] dark:text-emerald-300" /></p>
              <p className="mt-0.5 truncate text-[11.5px] text-zinc-500 dark:text-zinc-400">Community administration</p>
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#009639]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#007a2e] dark:text-emerald-300"><ShieldCheck className="h-3 w-3" />Administrator</span>
              <div className="mt-3 space-y-1 border-t border-zinc-100 pt-3 text-left text-[11.5px] dark:border-zinc-800">
                <Link to="/admin/users" className="flex items-center justify-between py-1 text-zinc-500 hover:text-[#009639] dark:text-zinc-400"><span>Community members</span><ArrowUpRight size={13} /></Link>
                <Link to="/admin/connections" className="flex items-center justify-between py-1 text-zinc-500 hover:text-[#009639] dark:text-zinc-400"><span>Community connections</span><ArrowUpRight size={13} /></Link>
              </div>
              <Link to="/admin/settings" className="mt-3 block w-full rounded-xl bg-[#009639] py-2 text-[12px] font-bold text-white transition hover:bg-[#007a2e]">View Profile</Link>
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-900/10 bg-gradient-to-br from-[#0F4C3A] to-[#007a2e] p-4 text-white shadow-sm">
            <p className="flex items-center gap-1.5 text-[12.5px] font-bold"><Megaphone className="h-4 w-4" />Keep your community informed</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-white/70">Share university news, upcoming activities, and important updates.</p>
            <Link to="/admin/announcements" className="mt-3 block w-full rounded-xl bg-white py-2 text-center text-[12px] font-bold text-[#007a2e] transition hover:bg-emerald-50 dark:bg-zinc-900 dark:text-emerald-300">Manage announcements</Link>
          </div>
        </aside>

        <section aria-label="Community feed" className="order-1 min-w-0 space-y-3 lg:order-none">
          <nav aria-label="Community views" className="admin-tabs">
            <Link to="/feed" aria-current="page">Feed</Link>
            <Link to="/admin/connections"><Users size={14} />Connections</Link>
          </nav>
          <AlumniFeed moderationEnabled />
        </section>

        <aside aria-label="Moderation and announcements" className="order-3 min-w-0 space-y-3 lg:col-span-2 lg:order-none xl:sticky xl:top-20 xl:col-span-1 xl:max-h-[calc(100vh-6rem)] xl:self-start xl:overflow-y-auto">
          <AdminFeedTools />
          <section className="overflow-hidden rounded-2xl border border-emerald-900/10 bg-white shadow-sm dark:bg-zinc-900">
            <div className="bg-gradient-to-r from-[#0F4C3A] to-[#009639] px-4 py-2.5"><h2 className="flex items-center gap-1.5 text-[12.5px] font-bold text-white"><Megaphone className="h-3.5 w-3.5" />At CLSU Today</h2></div>
            <ul className="space-y-3 p-4">
              {!news ? <li role="status" className="py-2 text-center text-[11.5px] text-zinc-500">Loading announcements...</li> : news.error ? <li role="alert" className="text-[11.5px] text-zinc-500 dark:text-zinc-400">{news.error}<button type="button" onClick={() => setRevision(value => value + 1)} className="ml-1 font-semibold text-[#009639] hover:underline">Retry announcements</button></li> : !news.items.length ? <li className="py-2 text-center text-[11.5px] text-zinc-500">No announcements</li> : news.items.map(item => <li key={item._id}><button type="button" onClick={() => setSelectedAnnouncement(item)} className="w-full text-left"><p className="text-[12px] font-semibold leading-snug text-zinc-800 transition hover:text-[#009639] dark:text-zinc-100">{item.title}</p><p className="mt-0.5 text-[10.5px] text-zinc-500">{item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric" }) : ""}</p></button></li>)}
            </ul>
            <Link to="/admin/announcements" className="mx-4 mb-4 block rounded-lg border border-zinc-200 py-1.5 text-center text-[11px] font-bold text-zinc-500 hover:border-[#009639] hover:text-[#007a2e] dark:border-zinc-700 dark:text-zinc-400">View all announcements</Link>
          </section>
        </aside>
      </main>
      {selectedAnnouncement && <FeedDialog title={selectedAnnouncement.title} onClose={() => setSelectedAnnouncement(null)}><p className="whitespace-pre-wrap text-sm leading-relaxed">{selectedAnnouncement.body || "No further details."}</p></FeedDialog>}
    </div>
  </div>;
}
