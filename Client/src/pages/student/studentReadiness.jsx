import { createElement } from "react";
import { Link } from "react-router-dom";
import { BarChart3, ArrowRight, Award, Briefcase, CalendarDays, CheckCircle2, Circle, FolderKanban, Info, RefreshCw, Target, TrendingUp, Users } from "lucide-react";
import ProgressBar from "../../components/ui/progress-bar";
import PageTitle from "../../components/ui/PageTitle";
import StatCard from "../../components/ui/stat-card";
import { useAuth } from "../../context/useAuth";
import useDevelopment from "../../hooks/useDevelopment";
import DevelopmentShell, { DevelopmentStatus } from "../../components/student/DevelopmentShell";
import "./studentReadiness.css";

const FACTORS = {
  mentorship: { icon: Users, unit: "alumni mentorship connection", action: "Find a mentor" },
  events: { icon: CalendarDays, unit: "recorded events", action: "Update event records" },
  certifications: { icon: Award, unit: "certifications", action: "Update certifications" },
  portfolio: { icon: FolderKanban, unit: "sections with content", action: "Build your portfolio" },
  internship: { icon: Briefcase, unit: "% of required hours", action: "Update internship hours" },
};
const LEVELS = [["Getting Started", "0–39", 0, 39], ["Developing", "40–59", 40, 59], ["Prepared", "60–79", 60, 79], ["Highly Prepared", "80–100", 80, 100]];
function ReadinessProgress({ value, max, label }) {
  return <ProgressBar role="meter" value={value} max={max} label={label} valueText={`${value} out of ${max} points`} />;
}

export default function StudentReadiness() {
  const { user } = useAuth();
  const state = useDevelopment();
  const readiness = state.data?.readiness;
  const factors = readiness?.factors || [];
  const complete = factors.filter(factor => factor.points >= 20).length;
  const next = [...factors].filter(factor => factor.points < 20).sort((a, b) => a.points - b.points)[0];
  const factorLink = factor => user?.role === "alumni" && factor.key === "mentorship" ? "/alumni/requests" : user?.role === "alumni" && factor.key === "events" ? "/alumni/events" : factor.link;
  return <DevelopmentShell title="Employment Readiness">
    <main className="readiness-page workspace-page mx-auto max-w-7xl space-y-6 p-3 sm:p-6">
      <header className="workspace-page-header flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><PageTitle icon={BarChart3}>Employment Readiness</PageTitle><p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">See where you stand, build your experience, and plan your next step.</p></div>
        <button type="button" onClick={state.load} disabled={state.loading || state.busy} className="readiness-button self-start"><RefreshCw size={15} className={state.loading ? "animate-spin" : ""} />Refresh score</button>
      </header>
      <DevelopmentStatus state={state} />
      {readiness && !state.loading && <>
        <section className="readiness-panel readiness-overview" aria-label="Employment readiness overview">
          <div className="readiness-score-panel">
            <p className="readiness-eyebrow">Your readiness score</p>
            <p className="readiness-score">{readiness.score}<span>/ 100</span></p>
            <span className="readiness-level"><TrendingUp size={15} />{readiness.level}</span>
            <p className="readiness-score-note">Based on your recorded experience and career preparation.</p>
          </div>
          <div className="readiness-overview-body">
            <div className="flex items-start justify-between gap-3"><div><h2>Your progress at a glance</h2><p className="readiness-muted mt-1">Five factors contribute up to 20 points each.</p></div><Target size={22} className="shrink-0 text-brand" aria-hidden="true" /></div>
            <div className="readiness-overall-track"><ReadinessProgress value={readiness.score} max={100} label="Overall employment readiness" /><div className="readiness-track-labels"><span>{readiness.score} / 100 points</span><span>Target: 100</span></div></div>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard label="Completed factors" value={`${complete} / ${factors.length}`} icon={CheckCircle2} compact />
              <StatCard label="To improve" value={factors.length - complete} icon={TrendingUp} compact />
              <StatCard label="Points to target" value={Math.max(0, 100 - readiness.score)} icon={Target} compact />
            </dl>
          </div>
        </section>

        <div className="readiness-content">
          <section className="min-w-0" aria-label="Readiness factors">
            <div className="readiness-section-heading"><div><h2>Your readiness breakdown</h2><p className="readiness-muted mt-1">Review your records and see what to work on next.</p></div><span className="readiness-count">{factors.length} factors</span></div>
            <div className="readiness-factor-grid">
              {factors.map(factor => {
                const config = FACTORS[factor.key] || { icon: Award, unit: "certifications", action: "Improve this factor" };
                const completed = factor.points >= 20;
                return <article key={factor.key} className="readiness-panel readiness-factor" data-readiness-factor={factor.key}>
                  <div className="readiness-factor-heading"><span className="readiness-factor-icon">{createElement(config.icon, { size: 21, "aria-hidden": true })}</span><div className="min-w-0"><h3>{factor.label}</h3><span className={`readiness-factor-status${completed ? " is-complete" : ""}`}>{completed ? <CheckCircle2 size={12} /> : <Circle size={10} />}{completed ? "Completed" : factor.points > 0 ? "In progress" : "Not started"}</span></div><p className="readiness-factor-points">{factor.points}<span>/ 20</span></p></div>
                  <div className="readiness-factor-progress"><ReadinessProgress value={factor.points} max={20} label={`${factor.label} progress`} /></div>
                  <p className="readiness-factor-records"><strong>{factor.value} / {factor.target}</strong> {config.unit}</p>
                  <Link to={factorLink(factor)} className="readiness-factor-link">{completed ? "View records" : config.action}<ArrowRight size={15} /></Link>
                </article>;
              })}
            </div>
          </section>

          <aside className="space-y-5">
            <section className="readiness-panel readiness-next">
              <span className="readiness-guide-icon"><Target size={22} /></span>
              <h2>{next ? "Your next step" : "Keep building your experience"}</h2>
              <p className="readiness-muted mt-2">{next ? <>Start with <strong>{next.label}</strong>, your lowest-scoring factor. Update your records to reflect your progress.</> : "You have reached the target across all five factors. Keep your records current as you gain more experience."}</p>
              {next && <Link to={factorLink(next)} className="readiness-button readiness-primary mt-4 w-full">{FACTORS[next.key]?.action || "Improve this factor"}<ArrowRight size={15} /></Link>}
            </section>
            <section className="readiness-panel readiness-levels"><h2>Readiness levels</h2><p className="readiness-muted mt-1">Where your overall score falls.</p><ol>{LEVELS.map(([label, range, min, max]) => <li key={label} className={readiness.score >= min && readiness.score <= max ? "is-current" : ""}><span>{label}{readiness.score >= min && readiness.score <= max && <span className="sr-only"> (your current level)</span>}</span><strong>{range}</strong></li>)}</ol></section>
          </aside>
        </div>
        <details className="readiness-panel readiness-scoring"><summary><Info size={17} />How your score is calculated</summary><div><p>One accepted alumni mentorship connection, three attended events, three certifications, six populated portfolio sections, and completed internship hours earn 20 points each. Partial progress earns proportional points, rounded per factor.</p><p>This score is a progress guide, not a guarantee of employment. It uses your recorded connections and self-reported attendance, certifications, portfolio entries, and internship hours.</p></div></details>
      </>}
    </main>
  </DevelopmentShell>;
}
