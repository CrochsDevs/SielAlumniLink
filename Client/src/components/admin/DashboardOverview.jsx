import { AdminStatGrid } from "./AdminUI";
import AdminStatCard from "./AdminStatCard";
import { createElement } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Users, BriefcaseBusiness, CalendarDays, ClipboardList, Award, Megaphone, MessageSquare, ShieldCheck, Link2, ArrowRight } from 'lucide-react';

export const dashboardPanel = 'dashboard-card bg-white p-5 dark:bg-zinc-900';
const muted = 'text-xs text-zinc-500 dark:text-zinc-400';
const number = value => Number(value || 0).toLocaleString();
const dateLabel = value => new Date(value).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' });

function Heading({ title, to, label = 'View all' }) {
  return <div className="dashboard-card-heading"><h2>{title}</h2><Link to={to} className="dashboard-view-link">{label}<ArrowUpRight size={12} /></Link></div>;
}

export function OverviewStats({ data }) {
  const o = data.overview;
  const items = [
    { label: 'Community members', value: data.members.total, detail: `${number(data.members.alumni)} alumni · ${number(data.members.students)} students`, to: '/admin/users', icon: Users },
    { label: 'Active job posts', value: o?.jobs, detail: o ? `${number(o.applications)} applications received` : 'Overview unavailable', to: '/admin/jobs', icon: BriefcaseBusiness },
    { label: 'Upcoming events', value: o?.events, detail: o ? `${number(o.registrations)} total registrations` : 'Overview unavailable', to: '/admin/events', icon: CalendarDays },
    { label: 'Active surveys', value: o?.surveys, detail: o ? `${number(o.surveyResponses)} responses across all surveys` : 'Overview unavailable', to: '/admin/surveys', icon: ClipboardList },
  ];
  return <AdminStatGrid columns={4}>{items.map((item, index) => <AdminStatCard key={item.label} {...item} featured={index === 0} caption={['registered members', 'open opportunities', 'scheduled activities', 'accepting responses'][index]} />)}</AdminStatGrid>;
}

export function AttentionPanel({ data }) {
  const o = data.overview;
  const items = [
    ['Submitted applications', o?.pendingApplications, '/admin/jobs', BriefcaseBusiness],
    ['Attendance to verify', o?.pendingCertificates, '/admin/certificates', Award],
    ['Pending mentorship requests', data.mentorship.pending, '/admin/connections', Link2],
    ['Unread messages', o?.unreadMessages, '/admin/message', MessageSquare],
  ];
  return <section className={dashboardPanel + " dashboard-attention"}><div className="mb-3 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-500" /><h2 className="text-sm font-semibold">Needs attention</h2></div><p className={muted}>Your review queue and community follow-ups.</p><div className="dashboard-queue mt-4 space-y-2">{items.map(([label, count, to, Icon]) => <Link key={label} to={to} className="flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800">{createElement(Icon, { size: 16, className: "shrink-0 text-zinc-400" })}<span className="flex-1 text-xs">{label}</span><span className={`rounded-lg px-2 py-1 text-xs font-semibold tabular-nums ${count > 0 ? 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800'}`}>{count == null ? '—' : number(count)}</span><ArrowRight size={13} className="text-zinc-400" /></Link>)}</div></section>;
}

export function EventsPanel({ overview }) {
  return <section className={dashboardPanel}><Heading title="Coming up next" to="/admin/events" label="Calendar" /><div className="space-y-4">{overview?.upcomingEvents?.length ? overview.upcomingEvents.map(event => <Link key={event._id} to="/admin/events" className="dashboard-event group flex items-center gap-3"><div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-emerald-50 text-brand dark:bg-emerald-950 dark:text-brand"><span className="text-[9px] font-semibold uppercase">{new Date(event.startAt).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short' })}</span><span className="text-base font-semibold leading-5">{new Date(event.startAt).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', day: 'numeric' })}</span></div><div className="min-w-0"><p className="truncate text-xs font-medium group-hover:text-brand">{event.title}</p><p className={`${muted} mt-1 truncate`}>{new Date(event.startAt).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' })} · {event.location || 'Location to be announced'}</p></div></Link>) : <p className={`${muted} py-5`}>{overview ? 'No upcoming events. Plan your next community gathering.' : 'Event overview unavailable.'}</p>}</div></section>;
}

export function TracerPanel({ data }) {
  const o = data.overview;
  const rate = data.members.alumni && o ? Math.round(o.tracerResponses / data.members.alumni * 100) : 0;
  return <section className={dashboardPanel + " dashboard-tracer"}><Heading title="Tracer study coverage" to="/admin/tracer" /><div className="flex items-center gap-4"><div role="img" aria-label={o ? `${rate}% of alumni responded` : 'Tracer data unavailable'} className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(#009639 ${rate * 3.6}deg, var(--tracer-track, #b9d4c2) 0deg)` }}><div className="flex h-[76px] w-[76px] flex-col items-center justify-center rounded-full bg-white dark:bg-zinc-900"><strong className="text-lg font-semibold">{o ? `${rate}%` : '—'}</strong><span className="text-[10px] text-zinc-500">responded</span></div></div><div className="min-w-0 flex-1 space-y-3"><p className="text-xs"><strong className="text-base font-semibold">{o ? number(o.tracerResponses) : '—'}</strong><br /><span className={muted}>of {number(data.members.alumni)} alumni</span></p><p className={muted}>{o ? number(o.employedAlumni) : '—'} employed / self-employed respondents</p></div></div></section>;
}

export function CommunityPanel({ data }) {
  const m = data.mentorship;
  return <section className={dashboardPanel + " dashboard-mentorship"}><Heading title="Mentorship Status Reports" to="/admin/connections" /><div className="flex items-end gap-2"><span className="text-xl font-semibold">{number(m.accepted)}</span><span className={`${muted} mb-1`}>accepted matches</span></div><div className="my-4 flex h-3 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800" role="img" aria-label={`${m.accepted} accepted, ${m.pending} pending, ${m.rejected} rejected`}>{[['accepted', 'bg-brand'], ['pending', 'bg-amber-300'], ['rejected', 'bg-zinc-300']].map(([key, color]) => <span key={key} className={color} style={{ width: `${m.total ? m[key] / m.total * 100 : 0}%` }} />)}</div><div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">{[['accepted', 'Accepted', 'bg-brand'], ['pending', 'Pending', 'bg-amber-300'], ['rejected', 'Rejected', 'bg-zinc-300']].map(([key, label, color]) => <span key={key} className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${color}`} />{label} {number(m[key])}</span>)}</div><p className={`${muted} mt-4`}>Current student–alumni requests. {number(m.total)} total matches.</p></section>;
}

export function UpdatesPanel({ overview: o }) {
  return <section className={dashboardPanel}><Heading title="Latest announcements" to="/admin/announcements" /><div className="space-y-4">{o?.recentAnnouncements?.length ? o.recentAnnouncements.map(item => <Link key={item._id} to="/admin/announcements" className="dashboard-announcement flex items-start gap-3"><Megaphone size={17} className="mt-0.5 shrink-0 text-brand" /><div className="min-w-0"><p className="truncate text-xs font-medium">{item.title}</p><p className={`${muted} mt-1`}>{dateLabel(item.createdAt)} · {item.audience || 'all'}</p></div></Link>) : <p className={muted}>{o ? 'No active announcements.' : 'Announcements unavailable.'}</p>}</div></section>;
}

export function OperationsStrip({ overview: o }) {
  const items = [ ['Certificates issued', o?.certificates, '/admin/certificates', Award], ['Published feed posts', o?.posts, '/feed', MessageSquare], ['Blocked posts', o?.blockedPosts, '/feed', ShieldCheck], ['Active announcements', o?.announcements, '/admin/announcements', Megaphone] ];
  return <div className="dashboard-operations">{items.map(([label, value, to, Icon]) => <Link key={label} to={to} className={"dashboard-operation"}>{createElement(Icon, { size: 18, className: "shrink-0 text-brand dark:text-brand" })}<div><p className="text-base font-semibold tabular-nums">{value == null ? '—' : number(value)}</p><p className={muted}>{label}</p></div><ArrowUpRight size={13} className="dashboard-operation-arrow" /></Link>)}</div>;
}
