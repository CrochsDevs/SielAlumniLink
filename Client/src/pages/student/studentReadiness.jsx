import ProgressBar from "../../components/ui/progress-bar";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { BarChart3, ArrowRight } from "lucide-react";
import useDevelopment from "../../hooks/useDevelopment";
import DevelopmentShell, {
  DevelopmentStatus,
  developmentCard as card,
} from "../../components/student/DevelopmentShell";

function ReadinessProgress({ value, max, label }) {
  return <ProgressBar role="meter" value={value} max={max} label={label}
    valueText={`${value} out of ${max} points`} className="max-w-[260px]" />;
}

export default function StudentReadiness() {
  const { user } = useAuth();
  const state = useDevelopment();
  const readiness = state.data?.readiness;
  return (
    <DevelopmentShell title="Employment Readiness">
      <main className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6 workspace-page">
        <header className="rounded-xl bg-gradient-to-br from-brand to-brand p-6 text-white workspace-page-header">
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <BarChart3 size={24} />
            Employment Readiness Score
          </h1>
          <p className="mt-2 text-sm text-white/85">
            See your progress from student life to your first career
            opportunity.
          </p>
        </header>
        <DevelopmentStatus state={state} />
        {readiness && !state.loading && (
          <>
            <section
              className={`${card} space-y-5`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">Overall progress</p>
                  <h2 className="mt-2 text-base font-semibold">Employment readiness</h2>
                </div>
                <span className="rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-brand dark:bg-emerald-950">
                  {readiness.level}
                </span>
              </div>
              <div>
                <ReadinessProgress value={readiness.score} max={100} label="Overall employment readiness" />
                <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">{readiness.score} / 100 points | Target: 100</p>
              </div>
              <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <p className="mt-2 max-w-lg text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  Each factor contributes up to 20 points. This score is a
                  progress guide, not a guarantee of employment. Self-reported
                  attendance, certifications, portfolio entries, and internship
                  hours contribute to your score.
                </p>
                <button
                  type="button"
                  onClick={state.load}
                  className="mt-4 text-xs font-semibold text-brand dark:text-brand"
                >
                  Refresh score
                </button>
              </div>
            </section>
            <div className="grid gap-3 sm:grid-cols-2">
              {readiness.factors.map((factor) => (
                <section key={factor.key} className={card}>
                  <div className="flex justify-between gap-3">
                    <h3 className="text-sm font-semibold">{factor.label}</h3>
                    <span className="shrink-0 text-sm font-bold text-brand dark:text-brand">
                      {factor.points}/20
                    </span>
                  </div>
                  <div className="mt-5">
                    <ReadinessProgress value={factor.points} max={20} label={`${factor.label} progress`} />
                    <p className="mt-2 text-[10px] text-zinc-400">{factor.points} / 20 points | Target: 20</p>
                  </div>
                  <p className="mt-4 border-t border-zinc-100 pt-4 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                    {factor.value} / {factor.target}{" "}
                    {factor.key === "internship"
                      ? "% of required hours"
                      : factor.key === "portfolio"
                        ? "sections with content"
                        : factor.key === "mentorship"
                          ? "alumni mentorship connection"
                          : factor.key === "events"
                            ? "recorded events"
                            : "certifications"}
                  </p>
                  <Link
                    to={
                      user?.role === "alumni" && factor.key === "mentorship"
                        ? "/alumni/requests"
                        : user?.role === "alumni" && factor.key === "events"
                          ? "/alumni/journey"
                          : factor.link
                    }
                    className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-brand dark:text-brand"
                  >
                    {factor.points === 20
                      ? "View records"
                      : "Improve this factor"}
                    <ArrowRight size={13} />
                  </Link>
                </section>
              ))}
            </div>
            <p className="text-xs leading-6 text-zinc-500 dark:text-zinc-400">
              Scoring: one accepted alumni mentorship connection, three attended
              events, three certifications, six populated portfolio sections,
              and completed internship hours earn 20 points each. Partial
              progress earns proportional points, rounded per factor. Highly
              Prepared: 80–100; Prepared: 60–79; Developing: 40–59; Getting
              Started: 0–39.
            </p>
          </>
        )}
      </main>
    </DevelopmentShell>
  );
}
