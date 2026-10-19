import { useEffect, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import api from "../../utils/axios";
import AdminSidebar from "../../layout/sidebar/admin/adminSidebar";
import AdminTopbar from "../../layout/topbar/alumni/adminTopbar";

const panel = "rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900";
const button = "inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";
const num = value => Number(value).toLocaleString();
const today = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
const titles = { daily: "Daily", monthly: "Monthly", yearly: "Yearly" };

function Chart({ report, period }) {
  const [selected, setSelected] = useState(null);
  const peak = Math.max(1, ...report.buckets.map(bucket => bucket.total));
  const detail = report.buckets.find(bucket => bucket.key === selected);
  return <>
    <div className="mt-5 overflow-x-auto pb-2" aria-label={titles[period] + " engagement bar chart"}>
      <div className="flex h-60 items-end gap-2 border-b border-zinc-200 dark:border-zinc-700" style={{ minWidth: report.buckets.length * 38 }}>
        {report.buckets.map(bucket => <button key={bucket.key} type="button" onClick={() => setSelected(bucket.key)} aria-pressed={selected === bucket.key} aria-label={bucket.key + ": " + bucket.total + " recorded actions"} className="group flex h-full min-w-7 flex-1 flex-col items-center justify-end rounded-t focus-visible:outline focus-visible:outline-2 focus-visible:outline-green-600">
          <span className="mb-1 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">{num(bucket.total)}</span>
          <span className={selected === bucket.key ? "w-full max-w-12 rounded-t bg-emerald-800 dark:bg-emerald-400" : "w-full max-w-12 rounded-t bg-emerald-500 group-hover:bg-emerald-600"} style={{ height: bucket.total / peak * 76 + "%", minHeight: 2 }} />
          <span className="mt-2 h-7 text-[10px] text-zinc-500 dark:text-zinc-400">{bucket.label}</span>
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
  return <div className="min-h-screen bg-zinc-50 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
    <AdminSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />
    <div className="lg:pl-64">
      <AdminTopbar user={user} title="Dashboard" onMenuClick={() => setSidebarOpen(true)} />
      <main className="workspace-page mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6">
        <div className="workspace-page-header flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-emerald-700 dark:text-emerald-400">Admin overview</p><h1 className="mt-1 text-2xl font-bold">Engagement Reports</h1><p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Community participation and student–alumni mentorship matches.</p></div><div className="flex flex-wrap gap-2"><button className={button} disabled={!current} onClick={() => setRevision(v => v + 1)}><RefreshCw size={16} />Refresh</button><button className={button} disabled={!data} onClick={() => download(data, period)}><Download size={16} />Export CSV</button></div></div>
        <div className="flex flex-wrap items-end justify-between gap-3"><label className="flex flex-col gap-1 text-sm font-medium">Report date<input aria-label="Report date" type="date" min="2000-01-01" max={today()} value={date} onChange={event => { if (event.target.value && event.target.validity.valid) setDate(event.target.value); }} className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" /></label><p className="text-xs text-zinc-500 dark:text-zinc-400">{data ? "Updated " + new Date(data.generatedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" }) + " · Philippine time" : "Reports use Philippine time (UTC+8)."}</p></div>
        {!current && <div className={panel} role="status">Loading dashboard reports…</div>}
        {current?.error && <div className={panel} role="alert"><p>{current.error}</p><button className={button + " mt-3"} onClick={() => setRevision(v => v + 1)}>Retry reports</button></div>}
        {data && <>
          <div className="grid gap-4 md:grid-cols-3">{Object.entries(titles).map(([key, label]) => <button key={key} aria-pressed={period === key} onClick={() => setPeriod(key)} className={panel + " text-left " + (period === key ? "ring-2 ring-emerald-600" : "hover:border-emerald-400")}><h2 className="text-sm font-semibold">{label} Engagement Summary</h2><p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{data.engagement[key].key}</p><p className="mt-4 text-3xl font-bold tabular-nums">{num(data.engagement[key].total)}</p><p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Recorded actions · {num(data.engagement[key].activeMembers)} active members</p></button>)}</div>
          <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]"><section className={panel + " min-w-0"}><h2 className="text-lg font-bold">{titles[period]} engagement · {report.key}</h2><p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">The selected day, calendar month, or calendar year. Current periods include records up to the last refresh.</p><Chart key={period + ":" + data.date} report={report} period={period} /></section><section className={panel}><h2 className="text-lg font-bold">Summary Statistics</h2><p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{titles[period]} · {report.key}</p><dl className="mt-5 space-y-3">{report.breakdown.map(source => <div key={source.key} className="flex justify-between gap-3 text-sm"><dt>{source.label}</dt><dd className="font-semibold tabular-nums">{num(source.count)}</dd></div>)}<div className="flex justify-between gap-3 border-t border-zinc-200 pt-3 font-semibold dark:border-zinc-700"><dt>Total actions</dt><dd>{num(report.total)}</dd></div><div className="flex justify-between gap-3 text-sm"><dt>Distinct active members</dt><dd>{num(report.activeMembers)}</dd></div></dl><p className="mt-5 rounded-xl bg-zinc-50 p-3 text-sm dark:bg-zinc-800">{num(data.members.total)} current members · {num(data.members.students)} students · {num(data.members.alumni)} alumni</p></section></div>
          <section className={panel}><h2 className="text-lg font-bold">Mentorship Status Reports</h2><p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Current student–alumni connection requests, independent of report date. {num(data.mentorship.total)} total matches.</p><div className="mt-5 grid gap-4 md:grid-cols-3">{[["accepted", "Accepted Matches", "bg-emerald-500"], ["pending", "Pending Matches", "bg-amber-500"], ["rejected", "Rejected Matches", "bg-rose-500"]].map(([key, label, color]) => <div key={key} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700"><h3 className="text-sm font-medium">{label}</h3><p className="mt-2 text-3xl font-bold">{num(data.mentorship[key])}</p><div role="img" aria-label={label + ": " + data.mentorship[key] + " of " + data.mentorship.total} className="mt-4 h-3 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"><div className={"h-full rounded-full " + color} style={{ width: (data.mentorship.total ? data.mentorship[key] / data.mentorship.total * 100 : 0) + "%" }} /></div></div>)}</div>{!data.mentorship.total && <p className="mt-4 text-sm">No mentorship requests have been recorded.</p>}<p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">Rejected matches are declined requests. AI recommendations count only after a connection request is sent. Removed requests are excluded.</p></section>
          <details className={panel + " text-sm"}><summary className="cursor-pointer font-semibold">How these reports are calculated</summary><p className="mt-3 leading-relaxed text-zinc-500 dark:text-zinc-400">Engagement counts retained logins, posts, comments, job and referral applications, event registrations, and initial survey submissions from current student and alumni accounts. Administrators, deleted posts and comments, and blocked posts are excluded. Likes, page views, messages, and survey edits are not counted. Active members are unique people in each period; daily counts cannot be added to obtain monthly unique members. Reports reflect available records, not a permanent historical audit.</p></details>
        </>}
      </main>
    </div>
  </div>;
}
