import ProgressBar from "../../components/ui/progress-bar";
import PageTitle from "../../components/ui/PageTitle";
import { createElement, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  FileText,
  Flag,
  GraduationCap,
  Info,
  ListChecks,
  MoveHorizontal,
  Rocket,
  Users,
} from "lucide-react";
import { useAuth } from "../../context/useAuth";
import useDevelopment from "../../hooks/useDevelopment";
import DevelopmentShell, {
  DevelopmentStatus,
  developmentButton,
  developmentInput,
} from "../../components/student/DevelopmentShell";
import { FeedDialog } from "../../components/feed/FeedComposer";

const TABS = [
  { id: "details", label: "Details", icon: Info },
  { id: "next", label: "Next Steps", icon: ListChecks },
  { id: "timeline", label: "Timeline", icon: Clock3 },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "events", label: "Event Attendance", icon: CalendarDays },
  { id: "resources", label: "Resources", icon: Users },
];
const RESOURCES = [
  {
    title: "Mentorship",
    description: "Connect with alumni who can guide your next steps.",
    path: "/student/mentorship",
    icon: Users,
  },
  {
    title: "Internships",
    description: "Explore opportunities to gain practical experience.",
    path: "/student/internship",
    icon: ListChecks,
  },
  {
    title: "Career opportunities",
    description: "Explore opportunities for your career after college.",
    path: "/student/career",
    icon: GraduationCap,
  },
];
const STATUS_LABELS = {
  done: "Completed",
  current: "In progress",
  upcoming: "Upcoming",
};
const accentButton =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-brand/25 bg-brand/5 px-3 text-xs font-semibold text-brand transition hover:bg-brand/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:text-brand";

export default function StudentJourney() {
  const { user } = useAuth();
  const alumni = user?.role === "alumni";
  const resources = alumni ? [
    { title: "Community connections", description: "Stay connected with alumni and mentors.", path: "/alumni/requests", icon: Users },
    { title: "Internship records", description: "Review and update the experience saved during your studies.", path: "/student/internship", icon: ListChecks },
    { title: "Career opportunities", description: "Explore opportunities for your next career step.", path: "/alumni/career", icon: GraduationCap },
    { title: "Employment history", description: "Record your current role and track your career progression.", path: "/alumni/employment", icon: GraduationCap },
  ] : RESOURCES;
  const state = useDevelopment();
  const milestones = state.data?.timeline || [];
  const [recordOpen, setRecordOpen] = useState(false);
  const [academic, setAcademic] = useState({ key: "enrolled", date: "" });
  const [event, setEvent] = useState({ title: "", date: "" });
  const [activeTab, setActiveTab] = useState("timeline");
  const [selectedIndex, setSelectedIndex] = useState(null);
  const scrollRef = useRef(null);
  const currentRef = useRef(null);
  const doneCount = milestones.filter((m) => m.state === "done").length;
  const currentIndex = milestones.findIndex((m) => m.state === "current");
  const remaining = milestones.length - doneCount;
  const progress = Math.round(
    (doneCount / Math.max(1, milestones.length)) * 100,
  );
  const selected = selectedIndex === null ? null : milestones[selectedIndex];
  const showCurrent = () => {
    const container = scrollRef.current,
      current = currentRef.current;
    if (!container || !current) return;
    container.scrollTo({
      left:
        current.offsetLeft - (container.clientWidth - current.offsetWidth) / 2,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
    current.querySelector("button")?.focus({ preventScroll: true });
  };
  const selectTab = (id) => {
    setActiveTab(id);
    setSelectedIndex(null);
  };
  const keyboardTabs = (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = TABS.findIndex((tab) => tab.id === activeTab);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? TABS.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + TABS.length) %
            TABS.length;
    selectTab(TABS[next].id);
    document.getElementById(`journey-tab-${TABS[next].id}`)?.focus();
  };

  return (
    <DevelopmentShell title="Journey">
      <main className="mx-auto max-w-7xl p-3 text-[#1d2740] sm:p-6 dark:text-zinc-100 workspace-page">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e4ecf4] px-5 py-5 sm:px-7 dark:border-zinc-800 workspace-page-header">
            <div>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Student life{" "}
                <span className="mx-2 text-slate-300 dark:text-zinc-600">
                  /
                </span>{" "}
                My journey
              </p>
              <PageTitle icon={GraduationCap} className="mt-1.5">
                Student Journey
              </PageTitle>
            </div>
            <button
              type="button"
              disabled={state.loading || !state.data || state.busy}
              onClick={() => setRecordOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand dark:text-brand"
            >
              <GraduationCap size={15} />
              Record milestone
            </button>
          </header>
        <div className="overflow-hidden rounded-2xl border border-[#e4ecf4] bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">

          <DevelopmentStatus state={state} />
          <div
            role="tablist"
            aria-label="Journey sections"
            onKeyDown={keyboardTabs}
            className="flex gap-1 overflow-x-auto border-b border-[#e4ecf4] px-3 sm:px-5 dark:border-zinc-800"
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                id={`journey-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`journey-panel-${tab.id}`}
                tabIndex={activeTab === tab.id ? 0 : -1}
                onClick={() => selectTab(tab.id)}
                className={`flex h-12 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand sm:text-[13px] ${activeTab === tab.id ? "border-brand font-bold text-brand dark:text-brand" : "border-transparent text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100"}`}
              >
                {createElement(tab.icon, { size: 16 })}
                {tab.label}
              </button>
            ))}
          </div>
          <div className="bg-[#f4f8fc] p-3 sm:p-6 dark:bg-zinc-950/50">
            <section
              id={`journey-panel-${activeTab}`}
              role="tabpanel"
              aria-labelledby={`journey-tab-${activeTab}`}
              tabIndex={0}
              className="min-h-[470px] rounded-xl border border-[#e4ecf4] bg-white outline-none focus-visible:ring-2 focus-visible:ring-brand dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4ecf4] px-5 py-5 sm:px-6 dark:border-zinc-800">
                <div>
                  <h2 className="text-base font-bold">
                    {activeTab === "timeline"
                      ? "Your journey at CLSU"
                      : TABS.find((tab) => tab.id === activeTab).label}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                    {activeTab === "timeline"
                      ? `${doneCount} of ${milestones.length} milestones completed`
                      : activeTab === "details"
                        ? "Your academic profile and journey overview"
                        : activeTab === "next"
                          ? "Explore the milestones ahead"
                          : activeTab === "documents"
                            ? "Keep your achievements and supporting records together"
                            : "Find support for each stage of your journey"}
                  </p>
                </div>
                {activeTab === "timeline" && (
                  <button
                    type="button"
                    onClick={showCurrent}
                    disabled={currentIndex < 0}
                    className={accentButton}
                  >
                    <Flag size={14} />
                    Current milestone
                  </button>
                )}
              </div>
              {activeTab === "timeline" && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-1 pt-5 text-[11px] text-slate-500 sm:px-6 dark:text-zinc-400">
                    <span className="inline-flex items-center gap-1.5">
                      <MoveHorizontal size={14} />
                      Scroll to explore your timeline
                    </span>
                    <span className="flex flex-wrap items-center gap-3">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-brand" />
                        Completed
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full border-2 border-brand" />
                        In progress
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-zinc-600" />
                        Upcoming
                      </span>
                    </span>
                  </div>
                  <div
                    ref={scrollRef}
                    data-journey-scroll
                    role="region"
                    aria-label="Student milestones timeline"
                    tabIndex={0}
                    className="overflow-x-auto px-2 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
                  >
                    <div
                      className="relative pb-5 pt-6"
                      style={{ minWidth: 1520 }}
                    >
                      <div
                        aria-hidden="true"
                        className="absolute"
                        style={{
                          top: 82,
                          left: `${50 / Math.max(1, milestones.length)}%`,
                          right: `${50 / milestones.length}%`,
                        }}
                      >
                        <ProgressBar label="Journey timeline progress" segments={1}
                          value={(currentIndex < 0 ? (doneCount > 0 ? 1 : 0) : currentIndex / Math.max(1, milestones.length - 1)) * 100} />
                      </div>
                      <ol
                        className="relative grid"
                        style={{
                          gridTemplateColumns: `repeat(${milestones.length}, minmax(0, 1fr))`,
                        }}
                      >
                        {milestones.map((milestone, index) => (
                          <li
                            key={milestone.title}
                            ref={
                              milestone.state === "current"
                                ? currentRef
                                : undefined
                            }
                            aria-current={
                              milestone.state === "current" ? "step" : undefined
                            }
                            className="min-w-0 px-3 text-center"
                          >
                            <p
                              className={`h-6 text-[17px] font-bold ${milestone.state !== "upcoming" ? "text-brand dark:text-brand" : "text-slate-400 dark:text-zinc-500"}`}
                            >
                              {milestone.date
                                ? new Date(
                                    milestone.date + "T00:00:00Z",
                                  ).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                    timeZone: "UTC",
                                  })
                                : "Ahead"}
                            </p>
                            <button
                              type="button"
                              aria-label={`${milestone.title}: ${STATUS_LABELS[milestone.state]}. ${milestone.date || "Date to be determined"}`}
                              aria-pressed={selectedIndex === index}
                              onClick={() =>
                                setSelectedIndex(
                                  selectedIndex === index ? null : index,
                                )
                              }
                              className={`relative mx-auto mb-4 mt-4 flex h-12 w-12 items-center justify-center rounded-full border-4 shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary ${milestone.state === "done" ? "border-white bg-brand text-white dark:border-zinc-900" : milestone.state === "current" ? "border-brand bg-white text-brand dark:bg-zinc-900 dark:text-brand" : "border-[#e9f1f9] bg-white text-slate-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500"}`}
                            >
                              {index === 0 ? (
                                <Rocket size={21} strokeWidth={1.8} />
                              ) : milestone.state === "done" ? (
                                <Check size={19} strokeWidth={3} />
                              ) : milestone.state === "current" ? (
                                <Flag size={18} />
                              ) : index === milestones.length - 1 ? (
                                <GraduationCap size={20} />
                              ) : (
                                <span className="text-xs font-bold">
                                  {String(index + 1).padStart(2, "0")}
                                </span>
                              )}
                            </button>
                            <h3 className="mx-auto max-w-[160px] text-[13px] font-bold leading-5">
                              {milestone.title}
                            </h3>
                            <p className="mx-auto mt-1.5 max-w-[150px] text-xs leading-5 text-slate-500 dark:text-zinc-400">
                              {milestone.desc}
                            </p>
                            <p
                              className={`mt-3 text-[10px] font-semibold ${milestone.state !== "upcoming" ? "text-brand dark:text-brand" : "text-slate-400 dark:text-zinc-500"}`}
                            >
                              {STATUS_LABELS[milestone.state]}
                            </p>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                  {selected && (
                    <div
                      data-journey-selected
                      role="status"
                      className="mx-5 mt-3 rounded-xl border border-brand/20 bg-brand/5 p-4 sm:mx-6"
                    >
                      <p className="text-sm font-bold">{selected.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-zinc-300">
                        {selected.desc} · {STATUS_LABELS[selected.state]}
                        {selected.date ? ` · ${selected.date}` : ""}
                        <span className="mt-1 block text-xs">
                          {selected.source}
                        </span>
                      </p>
                    </div>
                  )}
                  <div className="mx-5 mt-5 border-t border-[#e4ecf4] pb-6 pt-5 sm:mx-6 dark:border-zinc-800">
                    <p className="flex items-center justify-center gap-2 text-sm font-bold">
                      <Clock3 size={20} className="text-brand" />
                      Remaining: {remaining} milestones
                    </p>
                    <p className="mt-2 text-center text-xs text-slate-500 dark:text-zinc-400">
                      From your first day on campus to your first career
                      milestone.
                    </p>
                  </div>
                </>
              )}
              {activeTab === "events" && (
                <div className="space-y-5 p-5 sm:p-6">
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (await state.mutate("post", "events", event))
                        setEvent({ title: "", date: "" });
                    }}
                    className="grid gap-3 sm:grid-cols-2"
                  >
                    <label className="block text-xs">
                      Event name
                      <input
                        aria-label="Attended event name"
                        required
                        maxLength={200}
                        value={event.title}
                        onChange={(e) =>
                          setEvent({ ...event, title: e.target.value })
                        }
                        className={developmentInput}
                      />
                    </label>
                    <label className="block text-xs">
                      Date attended
                      <input
                        aria-label="Attendance date"
                        type="date"
                        required
                        value={event.date}
                        onChange={(e) =>
                          setEvent({ ...event, date: e.target.value })
                        }
                        className={developmentInput}
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={state.busy || !state.data}
                      className={developmentButton}
                    >
                      Record attendance
                    </button>
                  </form>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Record events you attended. Attendance is self-reported and
                    contributes to your readiness score.
                  </p>
                  <ul className="space-y-3">
                    {(state.data?.events || []).map((item) => (
                      <li
                        key={item._id}
                        className="flex items-start justify-between gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700"
                      >
                        <div>
                          <h3 className="text-sm font-semibold">
                            {item.title}
                          </h3>
                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            {item.date} |{" "}
                            {item.certificateId
                              ? "Participation confirmed"
                              : "Awaiting attendance review"}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={state.busy || !!item.certificateId}
                          onClick={() =>
                            state.mutate("delete", "events/" + item._id)
                          }
                          className="text-xs text-red-600 disabled:opacity-40 dark:text-red-400"
                        >
                          {item.certificateId ? "Confirmed" : "Remove"}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {!state.data?.events?.length && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      No event attendance recorded yet.
                    </p>
                  )}
                </div>
              )}
              {activeTab === "details" && (
                <div className="space-y-6 p-5 sm:p-6">
                  <dl className="grid gap-5 sm:grid-cols-2">
                    {[
                      ["Student", user?.name],
                      ["Program", user?.program],
                      ["Batch", user?.batch],
                      ["Email", user?.email],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-xs text-slate-500 dark:text-zinc-400">
                          {label}
                        </dt>
                        <dd className="mt-1.5 break-words text-sm font-semibold">
                          {value || "Not provided"}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <div className="rounded-xl bg-[#f4f8fc] p-5 dark:bg-zinc-800">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold">
                        Milestones completed
                      </span>
                      <span className="font-bold text-brand dark:text-brand">
                        {progress}%
                      </span>
                    </div>
                    <ProgressBar label="Journey progress" value={doneCount} max={milestones.length} segments={milestones.length || 4} className="mt-3" />
                    <p className="mt-3 text-xs text-slate-500 dark:text-zinc-400">
                      {doneCount} completed · {remaining} remaining
                    </p>
                  </div>
                </div>
              )}
              {activeTab === "next" && (
                <ol className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
                  {milestones
                    .filter((m) => m.state !== "done")
                    .map((m) => (
                      <li
                        key={m.title}
                        className="rounded-xl border border-[#e4ecf4] p-4 dark:border-zinc-700"
                      >
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-brand dark:text-brand">
                          {STATUS_LABELS[m.state]}
                        </span>
                        <h3 className="mt-2 text-sm font-bold">{m.title}</h3>
                        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
                          {m.desc}
                        </p>
                        {m.title === "Internship Completed" && (
                          <Link
                            to="/student/internship"
                            className={`${accentButton} mt-3`}
                          >
                            Explore internships
                            <ArrowRight size={14} />
                          </Link>
                        )}
                      </li>
                    ))}
                </ol>
              )}
              {activeTab === "documents" && (
                <div className="flex min-h-80 flex-col items-center justify-center px-5 py-8 text-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#e8f1fb] text-brand dark:bg-zinc-800">
                    <FileText size={28} strokeWidth={1.5} />
                  </span>
                  <h3 className="mt-4 text-base font-bold">
                    Your achievements, in one place
                  </h3>
                  <p className="mt-2 max-w-sm text-xs leading-6 text-slate-500 dark:text-zinc-400">
                    View your certifications, projects, research, and awards in
                    your student portfolio.
                  </p>
                  <Link
                    to="/student/portfolio"
                    className={`${accentButton} mt-5`}
                  >
                    Open portfolio
                    <ArrowRight size={14} />
                  </Link>
                </div>
              )}
              {activeTab === "resources" && (
                <div className="grid gap-3 p-5 sm:p-6">
                  {resources.map((resource) => (
                    <Link
                      key={resource.path}
                      to={resource.path}
                      className="flex items-center gap-4 rounded-xl border border-[#e4ecf4] p-4 transition hover:border-brand/40 hover:bg-brand/5 dark:border-zinc-700"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                        {createElement(resource.icon, { size: 20 })}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold">{resource.title}</h3>
                        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
                          {resource.description}
                        </p>
                      </div>
                      <ArrowRight
                        size={16}
                        className="shrink-0 text-slate-400"
                      />
                    </Link>
                  ))}
                </div>
              )}
            </section>
            <p className="mt-3 px-1 text-[11px] leading-5 text-slate-500 dark:text-zinc-400">
              Academic and event entries are self-reported. Mentorship,
              internship, graduation, and employment milestones are linked to
              saved portal records. Historical milestones remain in your
              journey.
            </p>
          </div>
        </div>
      </main>
      {recordOpen && (
        <FeedDialog
          title="Record academic milestone"
          busy={state.busy}
          onClose={() => setRecordOpen(false)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (await state.mutate("put", "academic", academic))
                setRecordOpen(false);
            }}
            className="space-y-4"
          >
            <label className="block text-sm">
              Milestone
              <select
                aria-label="Academic milestone"
                value={academic.key}
                onChange={(e) =>
                  setAcademic({
                    key: e.target.value,
                    date:
                      milestones.find((item) => item.key === e.target.value)
                        ?.date || "",
                  })
                }
                className={developmentInput}
              >
                <option value="enrolled">Enrolled</option>
                <option value="semester">First Semester Completed</option>
              </select>
            </label>
            <label className="block text-sm">
              Completion date
              <input
                aria-label="Milestone date"
                type="date"
                required
                value={academic.date}
                onChange={(e) =>
                  setAcademic({ ...academic, date: e.target.value })
                }
                className={developmentInput}
              />
            </label>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              These dates are recorded by you. Graduation and alumni status come
              from university records.
            </p>
            {state.error && (
              <p role="alert" className="text-sm text-red-600">
                {state.error}
              </p>
            )}
            <button
              disabled={state.busy}
              type="submit"
              className={developmentButton}
            >
              Save milestone
            </button>
          </form>
        </FeedDialog>
      )}
    </DevelopmentShell>
  );
}
