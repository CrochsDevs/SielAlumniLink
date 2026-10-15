import { Link } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { BarChart3, ArrowRight } from "lucide-react";
import useDevelopment from "../../hooks/useDevelopment";
import DevelopmentShell, {
  DevelopmentStatus,
  developmentCard as card,
} from "../../components/student/DevelopmentShell";

export default function StudentReadiness() {
  const { user } = useAuth();
  const state = useDevelopment();
  const readiness = state.data?.readiness;
  return (
    <DevelopmentShell title="Employment Readiness">
      <main className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6 workspace-page">
        <header className="rounded-xl bg-gradient-to-br from-[#007a2e] to-[#009639] p-6 text-white workspace-page-header">
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
              className={`${card} flex flex-col items-center gap-5 sm:flex-row`}
            >
              <div className="relative h-44 w-44 shrink-0">
                <svg
                  viewBox="0 0 200 200"
                  className="h-full w-full"
                  aria-hidden="true"
                >
                  <circle
                    cx="100"
                    cy="100"
                    r="86"
                    fill="none"
                    strokeWidth="12"
                    className="stroke-zinc-100 dark:stroke-zinc-800"
                  />
                  <circle
                    cx="100"
                    cy="100"
                    r="86"
                    fill="none"
                    stroke="#009639"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={540.35}
                    strokeDashoffset={540.35 * (1 - readiness.score / 100)}
                    transform="rotate(-90 100 100)"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <strong className="text-4xl">{readiness.score}</strong>
                  <span className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    / 100
                  </span>
                </div>
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#009639] dark:text-emerald-300">
                  {readiness.level}
                </h2>
                <p className="mt-2 max-w-lg text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  Each factor contributes up to 20 points. This score is a
                  progress guide, not a guarantee of employment. Self-reported
                  attendance, certifications, portfolio entries, and internship
                  hours contribute to your score.
                </p>
                <button
                  type="button"
                  onClick={state.load}
                  className="mt-4 text-xs font-semibold text-[#009639] dark:text-emerald-300"
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
                    <span className="shrink-0 text-sm font-bold text-[#009639] dark:text-emerald-300">
                      {factor.points}/20
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className="h-full bg-[#009639]"
                      style={{ width: `${(factor.points / 20) * 100}%` }}
                    />
                  </div>
                  <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
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
                    className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#009639] dark:text-emerald-300"
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
