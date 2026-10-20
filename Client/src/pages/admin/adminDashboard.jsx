import { AdminTabs, AdminButton } from "../../components/admin/AdminUI";
import PageHeader from "../../components/ui/PageHeader";
import "./adminDashboard.css";
import { useEffect, useState } from "react";
import { Download, RefreshCw, Plus } from "lucide-react";
import { OverviewStats, AttentionPanel, EventsPanel, TracerPanel, CommunityPanel, UpdatesPanel, OperationsStrip, dashboardPanel } from "../../components/admin/DashboardOverview";
import { useAuth } from "../../context/useAuth";
import api from "../../utils/axios";
import AdminSidebar from "../../layout/sidebar/admin/adminSidebar";
import AdminTopbar from "../../layout/topbar/alumni/adminTopbar";

const panel = dashboardPanel;
const button = "inline-flex items-center justify-center gap-2 rounded-full border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";
const num = value => Number(value).toLocaleString();
const today = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
const titles = { daily: "Daily", monthly: "Monthly", yearly: "Yearly" };

function Chart({ report, period }) {
  const [selected, setSelected] = useState(null);
  const peak = Math.max(1, ...report.buckets.map(bucket => bucket.total));
  const detail = report.buckets.find(bucket => bucket.key === selected);
  return <>
    <div className="dashboard-chart-scroll mt-5 overflow-x-auto pb-2" aria-label={titles[period] + " engagement bar chart"}>
      <div className="dashboard-chart-plot flex h-36 items-end gap-1" style={{ minWidth: report.buckets.length * 20 }}>
        {report.buckets.map(bucket => <button key={bucket.key} type="button" onClick={() => setSelected(bucket.key)} aria-pressed={selected === bucket.key} aria-label={bucket.key + ": " + bucket.total + " recorded actions"} className="group flex h-full min-w-3 flex-1 flex-col items-center justify-end rounded-t focus-visible:outline focus-visible:outline-2 focus-visible:outline-green-600">
          <span className="mb-1 shrink-0 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">{num(bucket.total)}</span>
          <span className="dashboard-chart-bar w-full max-w-12 rounded-full" style={{ height: bucket.total / peak * 55 + "%", minHeight: 2 }} />
          <span className="mt-2 h-7 shrink-0 text-[10px] text-zinc-500 dark:text-zinc-400">{bucket.label}</span>
        </button>)}
      </div>
    </div>
    <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Recorded actions by {period === "daily" ? "hour" : period === "monthly" ? "day" : "month"}. Select a bar for details. Philippine time (UTC+8).</p>
    {!report.total && <p className="mt-4 text-sm">No recorded engagement for this period.</p>}
    {detail && <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm dark:bg-emerald-950" aria-live="polite"><strong>{detail.key}</strong> · {num(detail.total)} actions · {num(detail.activeMembers)} active members<div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">{detail.breakdown.map(source => <span key={source.key}>{source.label}: {num(source.count)}</span>)}</div></div>}
    <details className="mt-4 text-sm"><summary className="cursor-pointer font-medium">View chart data</summary><div className="mt-3 max-h-72 overflow-auto"><table className="w-full text-left"><caption className="sr-only">Engagement chart data</caption><thead><tr><th className="py-2">Period</th><th>Actions</th><th>Active members</th></tr></thead><tbody>{report.buckets.map(bucket => <tr key={bucket.key} className="border-t border-zinc-100 dark:border-zinc-800"><td className="py-2">{bucket.key}</td><td>{num(bucket.total)}</td><td>{num(bucket.activeMembers)}</td></tr>)}</tbody></table></div></details>
  </>;
}

function download(data, period) {
  const report = data.engagement[period];
  const rows = [["Engagement report", titles[period], report.key, data.timezone], ["Generated at", data.generatedAt], ["Period", "Recorded actions", "Active members", ...report.breakdown.map(s => s.label)], ...report.buckets.map(b => [b.key, b.total, b.activeMembers, ...b.breakdown.map(s => s.count)]), ["Period total", report.total, report.activeMembers, ...report.breakdown.map(s => s.count)], [], ["Mentorship status", "Current snapshot, independent of report date"], ["Accepted", data.mentorship.accepted], ["Pending", data.mentorship.pending], ["Rejected", data.mentorship.rejected]];
  const csv = rows.map(row => row.map(value => '"' + String(value).replaceAll('"', '""') + '"').join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" }));
  const link = document.createElement("a");
  link.href = url; link.download = "admin-report-" + period + "-" + data.date + ".csv"; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [period, setPeriod] = useState("monthly");
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState(null);
  const requestKey = date + ":" + revision;
  useEffect(() => {
    const controller = new AbortController();
    api.get("/reports/dashboard", { params: { date }, signal: controller.signal }).then(response => {
      if (!controller.signal.aborted) setResult({ key: requestKey, data: response.data.data });
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ key: requestKey, error: error.response?.data?.message || "Unable to load dashboard reports. Please try again." });
    });
    return () => controller.abort();
  }, [date, requestKey]);
  const current = result?.key === requestKey ? result : null;
  const data = current?.data;
  const report = data?.engagement[period];
  return <div className="min-h-screen bg-[#f5f6f8] text-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
    <AdminSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />
    <div className="lg:pl-64">
      <AdminTopbar user={user} title="Dashboard" onMenuClick={() => setSidebarOpen(true)} />
      <main className="workspace-page admin-overview mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
        <PageHeader title="Dashboard" description="Your community, connected. Everything you need to keep it moving.">
          <AdminButton variant="secondary" aria-label="Refresh dashboard" disabled={!current} onClick={() => setRevision(v => v + 1)}><RefreshCw size={14} />Refresh</AdminButton>
          <AdminButton variant="secondary" disabled={!data} onClick={() => download(data, period)}><Download size={14} />Export CSV</AdminButton>
          <AdminButton to="/admin/announcements"><Plus size={16} />Announcement</AdminButton>
        </PageHeader>
        {!current && <div className={panel} role="status">Loading dashboard reports...</div>}
        {current?.error && <div className={panel} role="alert"><p>{current.error}</p><button className={button + " mt-3"} onClick={() => setRevision(v => v + 1)}>Retry reports</button></div>}
        {data && <>
          <OverviewStats data={data} />
          <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
            <div className="min-w-0 space-y-4">
              <section className={panel + " dashboard-engagement min-w-0"}>
                <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="admin-section-title text-sm font-semibold">Community engagement</h2><p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{num(report.total)} recorded actions &middot; {num(report.activeMembers)} active members</p></div><AdminTabs label="Engagement period" value={period} onChange={setPeriod} items={Object.entries(titles).map(([id, label]) => ({ id, label, ariaLabel: label + " Engagement Summary" }))} /></div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2"><label className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">Report date<input aria-label="Report date" type="date" min="2000-01-01" max={today()} value={date} onChange={event => { if (event.target.value && event.target.validity.valid) setDate(event.target.value); }} className="min-w-0 rounded-lg border border-zinc-200 bg-transparent px-2 py-1.5 text-zinc-700 dark:border-zinc-700 dark:text-zinc-200" /></label><span className="text-xs text-zinc-500">{titles[period]} &middot; {report.key}</span></div>
                <Chart key={period + ":" + data.date} report={report} period={period} />
              </section>
              <div className="grid gap-4 md:grid-cols-2"><TracerPanel data={data} /><CommunityPanel data={data} /></div>
            </div>
            <div className="space-y-4"><AttentionPanel data={data} /><EventsPanel overview={data.overview} /></div>
          </div>
          <OperationsStrip overview={data.overview} />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]"><section className={panel}><h2 className="admin-section-title text-sm font-semibold">Engagement breakdown</h2><p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{titles[period]} &middot; {report.key}</p><dl className="dashboard-breakdown mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{report.breakdown.map(source => <div key={source.key}><dd className="text-base font-semibold tabular-nums">{num(source.count)}</dd><dt className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{source.label}</dt></div>)}</dl></section><UpdatesPanel overview={data.overview} /></div>
          <details className="rounded-2xl border border-zinc-200 p-4 text-xs dark:border-zinc-800"><summary className="cursor-pointer font-medium">How these reports are calculated</summary><p className="mt-3 leading-relaxed text-zinc-500 dark:text-zinc-400">Overview cards and queues show current system records, independent of the report date. Tracer coverage counts current alumni with a response; employment is self-reported. Pending mentorship requests await a member response. Attendance needs verification before issuing certificates. Engagement counts retained logins, posts, comments, job and referral applications, event registrations, and initial survey submissions from current students and alumni. Administrators, deleted posts and comments, and blocked posts are excluded. Likes, page views, messages, and survey edits are not counted. Active members are unique in each period. CSV exports contain the selected engagement report and current mentorship counts.</p></details>
          <p className="text-right text-[10px] text-zinc-500 dark:text-zinc-400">Updated {new Date(data.generatedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })} &middot; Philippine time &middot; Use Refresh for the latest records</p>
        </>}
      </main>
    </div>
  </div>;
}
