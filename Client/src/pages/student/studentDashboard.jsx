import ProgressBar from "../../components/ui/progress-bar";
import PageTitle from "../../components/ui/PageTitle";
import { createElement } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ChevronRight,
  FileText,
  Briefcase,
  Users,
  LayoutDashboard,
} from "lucide-react";
import { useAuth } from "../../context/useAuth";
import useDevelopment from "../../hooks/useDevelopment";
import DevelopmentShell from "../../components/student/DevelopmentShell";
import ProfileAvatar from "../../components/profile/ProfileAvatar";
import DashboardUpdates from "../../components/student/DashboardUpdates";

const card =
  "rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900";
const sections = [
  "skills",
  "projects",
  "research",
  "certifications",
  "seminars",
  "awards",
];

export default function StudentDashboard() {
  const { user } = useAuth();
  const development = useDevelopment();
  const data = development.data;
  const portfolioSections = sections.filter(
    (key) => data?.portfolio?.[key]?.length,
  ).length;
  const placements = data?.internships || [];
  const hours = placements.reduce(
    (total, placement) => total + (Number(placement.hoursCompleted) || 0),
    0,
  );
  const requiredHours = placements.reduce(
    (total, placement) => total + (Number(placement.requiredHours) || 0),
    0,
  );

  return (
    <DevelopmentShell title="Dashboard">
      <main className="mx-auto max-w-7xl space-y-5 p-3 sm:p-6 workspace-page">
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 pt-1 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 workspace-page-header">
          <div>
            <PageTitle icon={LayoutDashboard}>Dashboard</PageTitle>
            <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              Welcome back, {user?.name?.split(" ")[0] || "Student"}. Here are
              the latest updates from your community.
            </p>
          </div>
          <Link
            to="/student/portfolio"
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 self-start rounded-lg border border-zinc-300 bg-white px-4 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            View portfolio
            <ArrowUpRight size={14} />
          </Link>
        </header>

        <nav
          aria-label="Student shortcuts"
          className={`${card} grid divide-y divide-zinc-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0 dark:divide-zinc-800`}
        >
          {[
            {
              to: "/student/career",
              label: "Career opportunities",
              description: "Browse jobs and internships",
              Icon: Briefcase,
            },
            {
              to: "/student/mentorship",
              label: "Alumni mentorship",
              description: "Find someone to learn from",
              Icon: Users,
            },
            {
              to: "/student/portfolio",
              label: "Portfolio & resume",
              description: "Keep your experience up to date",
              Icon: FileText,
            },
          ].map(({ to, label, description, Icon }) => (
            <Link
              key={to}
              to={to}
              className="group flex min-w-0 items-center gap-3 px-4 py-4 transition hover:bg-zinc-50 first:rounded-t-xl last:rounded-b-xl sm:first:rounded-l-xl sm:first:rounded-tr-none sm:last:rounded-r-xl sm:last:rounded-bl-none dark:hover:bg-zinc-800/50"
            >
              {createElement(Icon, {
                size: 18,
                className: "shrink-0 text-zinc-400",
              })}
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-semibold group-hover:text-brand dark:group-hover:text-brand">
                  {label}
                </span>
                <span className="mt-1 block text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
                  {description}
                </span>
              </div>
              <ChevronRight size={14} className="shrink-0 text-zinc-400" />
            </Link>
          ))}
        </nav>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_300px]">
          <DashboardUpdates />

          <aside className="space-y-5 lg:sticky lg:top-20">
            <section className={`${card} p-5`} aria-label="Student profile">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-100 text-lg font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  <ProfileAvatar user={user} />
                </span>
                <div className="min-w-0">
                  <h2 className="break-words text-sm font-semibold">
                    {user?.name || "Student"}
                  </h2>
                  <p className="mt-1 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
                    {user?.program || "Student"}
                    {user?.batch && ` | Batch ${user.batch}`}
                  </p>
                </div>
              </div>
              <Link
                to="/student/accounts"
                className="mt-4 inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500 hover:text-brand dark:text-zinc-400 dark:hover:text-brand"
              >
                Manage profile
                <ArrowUpRight size={12} />
              </Link>
            </section>
            <section
              className={`${card} p-5`}
              aria-label="Saved student progress"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">Your progress</h2>
                <Link
                  to="/student/journey"
                  className="text-[11px] text-zinc-500 hover:text-brand dark:text-zinc-400"
                >
                  View journey
                </Link>
              </div>
              {development.loading ? (
                <p
                  role="status"
                  className="py-6 text-xs text-zinc-500 dark:text-zinc-400"
                >
                  Loading your records...
                </p>
              ) : development.error ? (
                <p
                  role="alert"
                  className="mt-4 text-xs leading-5 text-red-600 dark:text-red-400"
                >
                  Unable to load progress.{" "}
                  <button
                    type="button"
                    onClick={development.load}
                    className="underline"
                  >
                    Retry
                  </button>
                </p>
              ) : (
                data && (
                  <dl className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
                    <div className="pb-4">
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-xs text-zinc-500 dark:text-zinc-400">
                          Portfolio
                        </dt>
                        <dd className="text-xs font-medium">
                          {portfolioSections} / 6 sections
                        </dd>
                      </div>
                      <ProgressBar label="Portfolio sections filled" value={portfolioSections} max={6} segments={6} className="mt-3" />
                    </div>
                    <div className="flex items-center justify-between gap-3 py-4">
                      <dt className="text-xs text-zinc-500 dark:text-zinc-400">
                        Alumni connections
                      </dt>
                      <dd className="text-xs font-medium">
                        {data.mentorCount || 0}
                      </dd>
                    </div>
                    <div className="pt-4">
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-xs text-zinc-500 dark:text-zinc-400">
                          Internship hours
                        </dt>
                        <dd className="text-xs font-medium">
                          {requiredHours
                            ? `${hours} / ${requiredHours}`
                            : "Not recorded"}
                        </dd>
                      </div>
                      {requiredHours > 0 && (
                        <p className="mt-1.5 text-[10px] text-zinc-400">
                          Based on your saved internship records
                        </p>
                      )}
                    </div>
                  </dl>
                )
              )}
            </section>
            <section className="px-1">
              <h2 className="text-xs font-semibold">Student resources</h2>
              <div className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">
                {[
                  ["/student/internship", "Internship records"],
                  ["/student/requests", "Connection requests"],
                  ["/student/readiness", "Employment readiness"],
                ].map(([to, label]) => (
                  <Link
                    key={to}
                    to={to}
                    className="flex items-center justify-between gap-3 py-3 text-xs text-zinc-500 hover:text-brand dark:text-zinc-400 dark:hover:text-brand"
                  >
                    {label}
                    <ChevronRight size={13} />
                  </Link>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </main>
    </DevelopmentShell>
  );
}
