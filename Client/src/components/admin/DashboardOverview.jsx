import { AdminStatGrid } from "./AdminUI";
import AdminStatCard from "./AdminStatCard";
import { createElement } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Users,
  BriefcaseBusiness,
  CalendarDays,
  ClipboardList,
  Award,
  Megaphone,
  MessageSquare,
  ShieldCheck,
  Link2,
  ArrowRight,
  CheckCheck,
  Activity,
  Info,
} from "lucide-react";

export const dashboardPanel = "dashboard-card bg-white p-5 dark:bg-zinc-900";
const muted = "text-xs text-zinc-500 dark:text-zinc-400";
const number = (value) => Number(value || 0).toLocaleString();
const dateLabel = (value) =>
  new Date(value).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
  });

function Heading({ title, to, label = "View all" }) {
  return (
    <div className="dashboard-card-heading">
      <h2>{title}</h2>
      <Link to={to} className="dashboard-view-link">
        {label}
        <ArrowUpRight size={12} />
      </Link>
    </div>
  );
}

export function OverviewStats({ data }) {
  const o = data.overview;
  const items = [
    {
      label: "Community members",
      value: data.members.total,
      detail: `${number(data.members.alumni)} alumni · ${number(data.members.students)} students`,
      to: "/admin/users",
      icon: Users,
    },
    {
      label: "Active job posts",
      value: o?.jobs,
      detail: o
        ? `${number(o.applications)} applications received`
        : "Overview unavailable",
      to: "/admin/jobs",
      icon: BriefcaseBusiness,
    },
    {
      label: "Upcoming events",
      value: o?.events,
      detail: o
        ? `${number(o.registrations)} total registrations`
        : "Overview unavailable",
      to: "/admin/events",
      icon: CalendarDays,
    },
    {
      label: "Active surveys",
      value: o?.surveys,
      detail: o
        ? `${number(o.surveyResponses)} responses across all surveys`
        : "Overview unavailable",
      to: "/admin/surveys",
      icon: ClipboardList,
    },
  ];
  return (
    <AdminStatGrid columns={4}>
      {items.map((item, index) => (
        <AdminStatCard
          key={item.label}
          {...item}
          featured={false}
          caption={
            [
              "registered members",
              "open opportunities",
              "scheduled activities",
              "accepting responses",
            ][index]
          }
        />
      ))}
    </AdminStatGrid>
  );
}

export function AttentionPanel({ data }) {
  const o = data.overview;
  const items = [
    [
      "Submitted applications",
      o?.pendingApplications,
      "/admin/jobs",
      BriefcaseBusiness,
    ],
    [
      "Attendance to verify",
      o?.pendingCertificates,
      "/admin/certificates",
      Award,
    ],
    [
      "Pending mentorship requests",
      data.mentorship.pending,
      "/admin/connections",
      Link2,
    ],
    ["Unread messages", o?.unreadMessages, "/admin/message", MessageSquare],
  ];
  const complete = items.every(([, count]) => count != null);
  const total = items.reduce((sum, [, count]) => sum + (count || 0), 0);
  return (
    <section className={dashboardPanel + " dashboard-attention"}>
      <div className="dashboard-card-heading">
        <div className="dashboard-heading-icon">
          <span>
            <ClipboardList size={16} />
          </span>
          <h2>Needs attention</h2>
        </div>
        <span className="dashboard-total-badge">
          {complete ? number(total) : "?"}
        </span>
      </div>
      <p className="dashboard-panel-subtitle">
        Your review queue and community follow-ups.
      </p>
      {complete && total === 0 && (
        <div className="dashboard-all-clear">
          <CheckCheck size={15} />
          <span>You're all caught up</span>
        </div>
      )}
      <div className="dashboard-queue">
        {items.map(([label, count, to, Icon]) => (
          <Link key={label} to={to}>
            <span className="queue-icon">
              {createElement(Icon, { size: 15 })}
            </span>
            <span className="queue-label">{label}</span>
            <span className={`queue-count ${count > 0 ? "has-items" : ""}`}>
              {count == null ? "?" : number(count)}
            </span>
            <ArrowRight size={13} className="queue-arrow" />
          </Link>
        ))}
      </div>
    </section>
  );
}

export function EventsPanel({ overview }) {
  return (
    <section className={dashboardPanel + " dashboard-upcoming"}>
      <Heading title="Coming up next" to="/admin/events" label="Calendar" />
      {overview?.upcomingEvents?.length ? (
        <div className="dashboard-events-list">
          {overview.upcomingEvents.map((event) => (
            <Link
              key={event._id}
              to="/admin/events"
              className="dashboard-event"
            >
              <div className="dashboard-event-date">
                <span>
                  {new Date(event.startAt).toLocaleDateString("en-PH", {
                    timeZone: "Asia/Manila",
                    month: "short",
                  })}
                </span>
                <strong>
                  {new Date(event.startAt).toLocaleDateString("en-PH", {
                    timeZone: "Asia/Manila",
                    day: "numeric",
                  })}
                </strong>
              </div>
              <div className="dashboard-event-copy">
                <p>{event.title}</p>
                <span>
                  {new Date(event.startAt).toLocaleTimeString("en-PH", {
                    timeZone: "Asia/Manila",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
                <span>{event.location || "Location to be announced"}</span>
              </div>
              <ArrowUpRight size={14} />
            </Link>
          ))}
        </div>
      ) : (
        <div className="dashboard-empty">
          <span className="dashboard-empty-icon">
            <CalendarDays size={24} strokeWidth={1.5} />
          </span>
          <strong>
            {overview ? "Your calendar is clear" : "Calendar unavailable"}
          </strong>
          <p>
            {overview
              ? "No upcoming events. Plan your next community gathering."
              : "Refresh to try loading events again."}
          </p>
          <Link to="/admin/events" className="dashboard-inline-action">
            Open calendar
            <ArrowRight size={13} />
          </Link>
        </div>
      )}
    </section>
  );
}

export function TracerPanel({ data }) {
  const o = data.overview;
  const rate =
    data.members.alumni && o
      ? Math.round((o.tracerResponses / data.members.alumni) * 100)
      : 0;
  return (
    <section className={dashboardPanel + " dashboard-tracer"}>
      <Heading title="Tracer study coverage" to="/admin/tracer" />
      <div className="flex items-center gap-4">
        <div
          role="img"
          aria-label={
            o ? `${rate}% of alumni responded` : "Tracer data unavailable"
          }
          className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full"
          style={{
            background: `conic-gradient(hsl(var(--primary)) ${rate * 3.6}deg, var(--tracer-track, #b9d4c2) 0deg)`,
          }}
        >
          <div className="flex h-[76px] w-[76px] flex-col items-center justify-center rounded-full bg-white dark:bg-zinc-900">
            <strong className="text-lg font-semibold">
              {o ? `${rate}%` : "—"}
            </strong>
            <span className="text-[10px] text-zinc-500">responded</span>
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-xs">
            <strong className="text-base font-semibold">
              {o ? number(o.tracerResponses) : "—"}
            </strong>
            <br />
            <span className={muted}>
              of {number(data.members.alumni)} alumni
            </span>
          </p>
          <p className={muted}>
            {o ? number(o.employedAlumni) : "—"} employed / self-employed
            respondents
          </p>
        </div>
      </div>
    </section>
  );
}

export function CommunityPanel({ data }) {
  const m = data.mentorship;
  return (
    <section className={dashboardPanel + " dashboard-mentorship"}>
      <Heading title="Mentorship Status Reports" to="/admin/connections" />
      <div className="mentorship-headline">
        <strong>{number(m.accepted)}</strong>
        <div>
          <span>accepted matches</span>
          <p>Connecting students with alumni</p>
        </div>
        <span className="mentorship-symbol">
          <Link2 size={23} />
        </span>
      </div>
      <div
        className="mentorship-track"
        role="img"
        aria-label={`${m.accepted} accepted, ${m.pending} pending, ${m.rejected} rejected`}
      >
        {[
          ["accepted", "hsl(var(--primary))"],
          ["pending", "#e9ae42"],
          ["rejected", "#8b96a5"],
        ].map(([key, color]) => (
          <span
            key={key}
            style={{
              background: color,
              width: `${m.total ? (m[key] / m.total) * 100 : 0}%`,
            }}
          />
        ))}
      </div>
      <dl className="mentorship-statuses">
        {[
          ["accepted", "Accepted"],
          ["pending", "Pending"],
          ["rejected", "Rejected"],
        ].map(([key, label]) => (
          <div key={key}>
            <dt>
              <i className={key} />
              {label}
            </dt>
            <dd>{number(m[key])}</dd>
          </div>
        ))}
      </dl>
      <p className="dashboard-card-footnote">
        {number(m.total)} total student-alumni matches
      </p>
    </section>
  );
}

export function UpdatesPanel({ overview: o }) {
  return (
    <section className={dashboardPanel + " dashboard-updates"}>
      <Heading title="Latest announcements" to="/admin/announcements" />
      {o?.recentAnnouncements?.length ? (
        <div className="dashboard-announcements-list">
          {o.recentAnnouncements.map((item) => (
            <Link
              key={item._id}
              to="/admin/announcements"
              className="dashboard-announcement"
            >
              <span className="announcement-icon">
                <Megaphone size={18} />
              </span>
              <div>
                <p>{item.title}</p>
                <span className="announcement-meta">
                  {dateLabel(item.createdAt)}
                  <span className="announcement-audience">
                    {item.audience || "all"}
                  </span>
                </span>
              </div>
              <ArrowUpRight size={14} />
            </Link>
          ))}
        </div>
      ) : (
        <div className="dashboard-empty">
          <span className="dashboard-empty-icon">
            <Megaphone size={24} strokeWidth={1.5} />
          </span>
          <strong>
            {o ? "No announcements yet" : "Announcements unavailable"}
          </strong>
          <p>Keep your community informed with the latest news.</p>
        </div>
      )}
      <Link to="/admin/announcements" className="dashboard-bottom-link">
        Manage announcements
        <ArrowRight size={14} />
      </Link>
    </section>
  );
}

export function OperationsStrip({ overview: o }) {
  const items = [
    ["Certificates issued", o?.certificates, "/admin/certificates", Award],
    ["Published feed posts", o?.posts, "/feed", MessageSquare],
    ["Blocked posts", o?.blockedPosts, "/feed", ShieldCheck],
    [
      "Active announcements",
      o?.announcements,
      "/admin/announcements",
      Megaphone,
    ],
  ];
  return (
    <div className="dashboard-operations" aria-label="Community operations">
      {items.map(([label, value, to, Icon]) => (
        <Link key={label} to={to} className="dashboard-operation">
          <span className="operation-icon">
            {createElement(Icon, { size: 19 })}
          </span>
          <div>
            <p className="operation-value">
              {value == null ? "?" : number(value)}
            </p>
            <p className="operation-label">{label}</p>
          </div>
          <ArrowUpRight size={15} className="dashboard-operation-arrow" />
        </Link>
      ))}
    </div>
  );
}

export function EngagementBreakdown({ report, title }) {
  return (
    <section className={dashboardPanel + " dashboard-sources"}>
      <div className="dashboard-card-heading">
        <div className="dashboard-heading-icon">
          <span>
            <Activity size={16} />
          </span>
          <div>
            <h2>Engagement breakdown</h2>
            <p className="dashboard-panel-subtitle">
              {title} &middot; {report.key}
            </p>
          </div>
        </div>
        <span className="dashboard-total-badge">
          {number(report.total)} actions
        </span>
      </div>
      <dl className="dashboard-source-list">
        {report.breakdown.map((source) => (
          <div key={source.key}>
            <dt>{source.label}</dt>
            <dd>{number(source.count)}</dd>
          </div>
        ))}
      </dl>
      <p className="dashboard-card-footnote">
        <Info size={13} />
        Activity recorded during the selected period
      </p>
    </section>
  );
}
