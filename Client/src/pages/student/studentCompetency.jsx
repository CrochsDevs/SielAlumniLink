import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  ClipboardList,
  Pencil,
  Search,
  RotateCcw,
} from "lucide-react";
import DevelopmentShell, {
  DevelopmentStatus,
} from "../../components/student/DevelopmentShell";
import { FeedDialog } from "../../components/feed/FeedComposer";
import useDevelopment from "../../hooks/useDevelopment";

const LEVELS = [
  {
    value: 1,
    label: "Developing",
    description: "I am learning the basics and need regular support.",
  },
  {
    value: 2,
    label: "Practicing",
    description: "I can apply this skill with some guidance.",
  },
  {
    value: 3,
    label: "Proficient",
    description: "I can apply this skill independently.",
  },
  {
    value: 4,
    label: "Advanced",
    description: "I apply this consistently and can guide others.",
  },
];
const CATEGORIES = [
  ["all", "All skills"],
  ["technical", "Technical"],
  ["communication", "Communication"],
  ["leadership", "Leadership"],
];
const card =
  "rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900";
const button =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-xs font-semibold text-white transition hover:bg-brand disabled:opacity-50";
const field =
  "mt-2 w-full rounded-lg border border-zinc-200 bg-white p-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 dark:border-zinc-700 dark:bg-zinc-900";
const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-PH", {
        timeZone: "Asia/Manila",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

export default function StudentCompetency() {
  const state = useDevelopment();
  const summary = state.data?.competencies;
  const framework = summary?.framework || [];
  const gaps = Object.fromEntries(
    (summary?.gaps || []).map((item) => [item.key, item]),
  );
  const assessments = Object.fromEntries(
    (summary?.assessments || []).map((item) => [item.key, item]),
  );
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [editor, setEditor] = useState(null);
  const [draft, setDraft] = useState({
    rating: 1,
    target: 3,
    evidence: "",
    goal: "",
  });
  const [resetting, setResetting] = useState(null);
  const disabled = state.loading || state.busy || !summary;
  const filtered = framework.filter(
    (item) =>
      (category === "all" || item.category === category) &&
      `${item.name} ${item.description}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()) &&
      (status === "all" ||
        (status === "unassessed"
          ? !assessments[item.key]
          : status === "assessed"
            ? !!assessments[item.key]
            : gaps[item.key]?.gap > 0)),
  );
  const open = (item) => {
    setDraft({
      rating: 1,
      target: 3,
      evidence: "",
      goal: "",
      ...assessments[item.key],
    });
    setEditor(item);
  };
  const save = async (event) => {
    event.preventDefault();
    if (
      await state.mutate("put", `competencies/${editor.key}`, {
        rating: draft.rating,
        target: draft.target,
        evidence: draft.evidence,
        goal: draft.goal,
      })
    )
      setEditor(null);
  };
  const resetFilters = () => {
    setCategory("all");
    setStatus("all");
    setQuery("");
  };

  return (
    <DevelopmentShell title="Competency">
      <main className="mx-auto max-w-7xl space-y-5 p-3 sm:p-6 workspace-page">
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 pt-1 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 workspace-page-header">
          <div>
            <h1>Competency</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              Assess technical, communication, and leadership skills, then
              review skill gaps and mentor feedback.
            </p>
          </div>
          <Link
            to="/student/portfolio"
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 self-start rounded-lg border border-zinc-300 bg-white px-4 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            View portfolio
            <ArrowUpRight size={14} />
          </Link>
        </header>
        <DevelopmentStatus state={state} />
        {!state.loading && state.data && !summary && (
          <p role="alert" className={`${card} p-5 text-sm text-red-600`}>
            Competency data is unavailable.{" "}
            <button type="button" onClick={state.load} className="underline">
              Refresh
            </button>
          </p>
        )}
        {summary && (
          <section
            aria-label="Assessment summary"
            className={`${card} grid divide-y divide-zinc-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0 dark:divide-zinc-800`}
          >
            {[
              [
                "Assessed",
                `${summary.assessedCount} / ${framework.length}`,
                "Competencies you have reviewed",
              ],
              [
                "Average level",
                summary.averageLevel === null
                  ? "Not assessed"
                  : `${summary.averageLevel} / 4`,
                "Across your assessed competencies",
              ],
              [
                "Skill gaps",
                String(summary.focusCount),
                "Skills below your target level",
              ],
            ].map(([label, value, note]) => (
              <div key={label} className="px-5 py-4">
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {label}
                </p>
                <p className="mt-1.5 text-xl font-semibold tracking-tight">
                  {value}
                </p>
                <p className="mt-1 text-[10px] leading-5 text-zinc-400">
                  {note}
                </p>
              </div>
            ))}
          </section>
        )}
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <section
            className="min-w-0 space-y-4"
            aria-label="Competency assessments"
          >
            <div className={`${card} p-4`}>
              <nav
                aria-label="Competency categories"
                className="flex gap-5 overflow-x-auto border-b border-zinc-100 dark:border-zinc-800"
              >
                {CATEGORIES.map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={category === id}
                    onClick={() => setCategory(id)}
                    className={`shrink-0 border-b-2 pb-3 text-xs font-medium ${category === id ? "border-brand text-brand dark:text-brand" : "border-transparent text-zinc-500 dark:text-zinc-400"}`}
                  >
                    {label}
                  </button>
                ))}
              </nav>
              <div className="mt-3 flex flex-wrap gap-3">
                <label className="relative min-w-0 flex-1 basis-48">
                  <span className="sr-only">Search competencies</span>
                  <Search
                    size={15}
                    className="absolute left-3 top-3 text-zinc-400"
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search competencies"
                    className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-xs outline-none focus:border-brand dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </label>
                <label>
                  <span className="sr-only">Assessment status</span>
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    className="h-10 max-w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <option value="all">All statuses</option>
                    <option value="unassessed">Not assessed</option>
                    <option value="assessed">Assessed</option>
                    <option value="focus">Skill gaps</option>
                  </select>
                </label>
              </div>
            </div>
            {summary && !state.loading && (
              <>
                <div className="flex items-center justify-between gap-3 px-1">
                  <p
                    role="status"
                    className="text-[11px] text-zinc-500 dark:text-zinc-400"
                  >
                    {filtered.length}{" "}
                    {filtered.length === 1 ? "competency" : "competencies"}
                  </p>
                  {(category !== "all" || status !== "all" || query) && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="text-[11px] font-medium text-brand dark:text-brand"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
                {!filtered.length && (
                  <div className={`${card} p-10 text-center`}>
                    <ClipboardList
                      size={28}
                      className="mx-auto text-zinc-400"
                    />
                    <h2 className="mt-3">No matching competencies</h2>
                    <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                      Choose another category or assessment status.
                    </p>
                    <button
                      type="button"
                      onClick={resetFilters}
                      className={`${button} mt-5`}
                    >
                      Show all competencies
                    </button>
                  </div>
                )}
                {filtered.map((item) => {
                  const assessment = assessments[item.key];
                  const gap = gaps[item.key];
                  const evaluations = (summary.mentorEvaluations || []).filter(
                    (evaluation) => evaluation.competencyKey === item.key,
                  );
                  return (
                    <article
                      key={item.key}
                      data-competency={item.key}
                      className={`${card} p-5`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                            {
                              CATEGORIES.find(
                                ([key]) => key === item.category,
                              )?.[1]
                            }
                          </p>
                          <h2>{item.name}</h2>
                          <p className="mt-2 max-w-lg text-xs leading-6 text-zinc-500 dark:text-zinc-400">
                            {item.description}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-medium ${assessment?.rating >= 3 ? "bg-emerald-50 text-brand dark:bg-emerald-950 dark:text-brand" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"}`}
                        >
                          {assessment
                            ? LEVELS[assessment.rating - 1].label
                            : "Not assessed"}
                        </span>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0 flex-1 basis-36">
                          <div
                            className="flex max-w-[208px] gap-1.5"
                            role="meter"
                            aria-label={`${item.name} self-assessed level`}
                            aria-valuemin={0}
                            aria-valuemax={4}
                            aria-valuenow={assessment?.rating || 0}
                            aria-valuetext={
                              assessment
                                ? LEVELS[assessment.rating - 1].label
                                : "Not assessed"
                            }
                          >
                            {LEVELS.map((level) => (
                              <span
                                key={level.value}
                                className={`h-1.5 flex-1 rounded-full ${level.value <= (assessment?.rating || 0) ? "bg-brand" : "bg-zinc-100 dark:bg-zinc-800"}`}
                              />
                            ))}
                          </div>
                          <p className="mt-2 text-[10px] text-zinc-400">
                            {assessment
                              ? `Level ${assessment.rating} / 4 | Target: ${LEVELS[assessment.target - 1].label}`
                              : "Choose a level to start your self-assessment."}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => open(item)}
                          className={
                            assessment
                              ? "inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 text-xs font-semibold disabled:opacity-50 dark:border-zinc-700"
                              : button
                          }
                        >
                          <Pencil size={13} />
                          {assessment ? "Update assessment" : "Assess skill"}
                        </button>
                      </div>
                      {assessment && (
                        <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                          {assessment.evidence && (
                            <p className="whitespace-pre-wrap break-words text-xs leading-6 text-zinc-600 dark:text-zinc-300">
                              <strong className="font-medium">
                                Evidence:{" "}
                              </strong>
                              {assessment.evidence}
                            </p>
                          )}
                          {assessment.goal && (
                            <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-zinc-600 dark:text-zinc-300">
                              <strong className="font-medium">
                                Learning goal:{" "}
                              </strong>
                              {assessment.goal}
                            </p>
                          )}
                          {assessment.rating < assessment.target && (
                            <p className="mt-2 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
                              Next step: {item.action}
                            </p>
                          )}
                          <div className="mt-3 flex items-center justify-between gap-3">
                            <span className="text-[10px] text-zinc-400">
                              Self-assessed | Updated{" "}
                              {formatDate(assessment.updatedAt)}
                            </span>
                            <button
                              type="button"
                              disabled={disabled}
                              onClick={() => setResetting(item)}
                              className="inline-flex items-center gap-1 text-[10px] text-zinc-400 hover:text-red-600 disabled:opacity-50"
                            >
                              <RotateCcw size={11} />
                              Reset
                            </button>
                          </div>
                        </div>
                      )}
                      {gap?.gap > 0 && (
                        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs leading-6 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                          <strong>
                            Skill gap: {gap.gap}{" "}
                            {gap.gap === 1 ? "level" : "levels"}.
                          </strong>{" "}
                          Current level {gap.currentLevel}, target {gap.target}.
                          Based on{" "}
                          {gap.basis === "mentor"
                            ? "the latest mentor evaluation"
                            : "your self-assessment"}
                          .
                        </p>
                      )}
                      {evaluations.length > 0 && (
                        <section
                          aria-label={`${item.name} mentor evaluations`}
                          className="mt-4 space-y-3 border-t border-zinc-100 pt-4 dark:border-zinc-800"
                        >
                          <h3 className="text-xs font-semibold">
                            Mentor evaluations
                          </h3>
                          {evaluations.map((evaluation) => (
                            <div
                              key={evaluation._id}
                              className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/50"
                            >
                              <div className="flex flex-wrap justify-between gap-2 text-xs">
                                <strong>{evaluation.mentorName}</strong>
                                <span>
                                  {LEVELS[evaluation.rating - 1].label} (
                                  {evaluation.rating}/4)
                                </span>
                              </div>
                              <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-zinc-600 dark:text-zinc-300">
                                {evaluation.feedback}
                              </p>
                              {evaluation.observedEvidence && (
                                <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-zinc-600 dark:text-zinc-300">
                                  <strong>Work reviewed: </strong>
                                  {evaluation.observedEvidence}
                                </p>
                              )}
                              {evaluation.nextStep && (
                                <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-zinc-600 dark:text-zinc-300">
                                  <strong>Recommended next step: </strong>
                                  {evaluation.nextStep}
                                </p>
                              )}
                              <p className="mt-2 text-[10px] text-zinc-400">
                                Evaluated {formatDate(evaluation.updatedAt)}
                              </p>
                            </div>
                          ))}
                        </section>
                      )}
                    </article>
                  );
                })}
              </>
            )}
          </section>
          <aside className="space-y-4 lg:sticky lg:top-20">
            <section className={`${card} p-5`}>
              <h2>How gaps are identified</h2>
              <p className="mt-3 text-[11px] leading-6 text-zinc-500 dark:text-zinc-400">
                The system compares your target with the latest mentor
                evaluation, or your self-assessment when no mentor evaluation is
                available. Skills with no rating stay unassessed.
              </p>
              <p className="mt-2 text-[11px] leading-6 text-zinc-500 dark:text-zinc-400">
                The default target is Proficient (level 3) until you save a
                target.
              </p>
            </section>
            <section className={`${card} p-5`}>
              <h2>Assessment guide</h2>
              <ol className="mt-4 space-y-4">
                {LEVELS.map((level) => (
                  <li key={level.value} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      {level.value}
                    </span>
                    <div>
                      <h3 className="text-xs font-semibold">{level.label}</h3>
                      <p className="mt-1 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
                        {level.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-5 border-t border-zinc-100 pt-4 text-[11px] leading-6 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                Your ratings are self-assessed. Connected alumni mentors can
                review your assessments and portfolio, then provide separate
                evaluations. These ratings are not official grades or
                certifications.
              </p>
            </section>
            <section className={`${card} p-5`}>
              <h2>Support your assessment</h2>
              <p className="mt-2 text-[11px] leading-6 text-zinc-500 dark:text-zinc-400">
                Use your projects, research, or training as examples of how you
                apply a skill.
              </p>
              <div className="mt-4 space-y-3">
                {[
                  ["Projects", state.data?.portfolio?.projects?.length || 0],
                  [
                    "Certifications",
                    state.data?.portfolio?.certifications?.length || 0,
                  ],
                  [
                    "Research papers",
                    state.data?.portfolio?.research?.length || 0,
                  ],
                ].map(([label, count]) => (
                  <div key={label} className="flex justify-between text-xs">
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {label}
                    </span>
                    <span className="font-medium">
                      {state.loading || !state.data ? "-" : count}
                    </span>
                  </div>
                ))}
              </div>
              <Link
                to="/student/portfolio"
                className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-4 text-[11px] font-medium text-brand dark:border-zinc-800 dark:text-brand"
              >
                Open portfolio
                <ChevronRight size={13} />
              </Link>
            </section>
            <Link
              to="/student/mentorship"
              className={`${card} flex items-center justify-between gap-3 p-5 text-xs text-zinc-600 dark:text-zinc-300`}
            >
              Discuss your goals with an alumni mentor
              <ArrowUpRight size={15} className="shrink-0" />
            </Link>
          </aside>
        </div>
        {editor && (
          <FeedDialog
            title={`Assess ${editor.name.toLowerCase()}`}
            busy={state.busy}
            onClose={() => setEditor(null)}
          >
            <form onSubmit={save}>
              <fieldset
                disabled={state.busy || state.loading}
                className="space-y-5"
              >
                <fieldset>
                  <legend className="mb-3 text-xs font-semibold">
                    Your current level
                  </legend>
                  <div className="space-y-2">
                    {LEVELS.map((level) => (
                      <label
                        key={level.value}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${draft.rating === level.value ? "border-brand bg-emerald-50/50 dark:bg-emerald-950/20" : "border-zinc-200 dark:border-zinc-700"}`}
                      >
                        <input
                          type="radio"
                          name="competency-rating"
                          value={level.value}
                          checked={draft.rating === level.value}
                          onChange={() =>
                            setDraft((previous) => ({
                              ...previous,
                              rating: level.value,
                              target: Math.max(previous.target, level.value),
                            }))
                          }
                          className="mt-0.5 accent-brand"
                        />
                        <span>
                          <span className="block text-xs font-semibold">
                            {level.value}. {level.label}
                          </span>
                          <span className="mt-1 block text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
                            {level.description}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="block text-xs font-medium">
                  Evidence note (optional)
                  <textarea
                    rows={3}
                    maxLength={2000}
                    value={draft.evidence}
                    onChange={(event) =>
                      setDraft({ ...draft, evidence: event.target.value })
                    }
                    className={field}
                    placeholder={editor.prompt}
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-[150px_minmax(0,1fr)]">
                  <label className="block text-xs font-medium">
                    Target level
                    <select
                      value={draft.target}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          target: Number(event.target.value),
                        })
                      }
                      className={field}
                    >
                      {LEVELS.filter(
                        (level) => level.value >= draft.rating,
                      ).map((level) => (
                        <option key={level.value} value={level.value}>
                          {level.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-medium">
                    Learning goal (optional)
                    <textarea
                      rows={2}
                      maxLength={1000}
                      value={draft.goal}
                      onChange={(event) =>
                        setDraft({ ...draft, goal: event.target.value })
                      }
                      className={field}
                      placeholder="A specific step you will take to develop this skill."
                    />
                  </label>
                </div>
                {state.error && (
                  <p role="alert" className="text-xs text-red-600">
                    {state.error}
                  </p>
                )}
                <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setEditor(null)}
                    className="rounded-lg px-4 py-2 text-xs text-zinc-500"
                  >
                    Cancel
                  </button>
                  <button type="submit" className={button}>
                    <Check size={14} />
                    {state.busy ? "Saving..." : "Save assessment"}
                  </button>
                </div>
              </fieldset>
            </form>
          </FeedDialog>
        )}
        {resetting && (
          <FeedDialog
            title="Reset this assessment?"
            busy={state.busy}
            onClose={() => setResetting(null)}
          >
            <p className="text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              Your self-rating, evidence note, and learning goal for{" "}
              {resetting.name.toLowerCase()} will be removed. Mentor evaluations
              will remain available.
            </p>
            {state.error && (
              <p role="alert" className="mt-3 text-xs text-red-600">
                {state.error}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={state.busy}
                onClick={() => setResetting(null)}
                className="rounded-lg px-4 py-2 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={state.busy}
                onClick={async () => {
                  if (
                    await state.mutate(
                      "delete",
                      `competencies/${resetting.key}`,
                    )
                  )
                    setResetting(null);
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white"
              >
                {state.busy ? "Resetting..." : "Reset assessment"}
              </button>
            </div>
          </FeedDialog>
        )}
      </main>
    </DevelopmentShell>
  );
}
