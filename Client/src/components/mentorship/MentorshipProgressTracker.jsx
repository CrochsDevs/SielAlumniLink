import { createElement, useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Compass,
  FileUser,
  MessageCircle,
  RefreshCw,
  Target,
} from "lucide-react";
import { useAuth } from "../../context/useAuth";
import ProfileAvatar from "../profile/ProfileAvatar";
import api from "../../utils/axios";

const STATUSES = [
  {
    key: "not_started",
    label: "Not Started",
    style: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  },
  {
    key: "in_progress",
    label: "In Progress",
    style: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  {
    key: "completed",
    label: "Completed",
    style:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
];
const icons = {
  resume_building: FileUser,
  interview_preparation: MessageCircle,
  career_planning: Compass,
};
const card =
  "rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900";
const input =
  "mt-2 h-10 w-full min-w-0 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-xs outline-none focus:border-[#009639] focus:ring-2 focus:ring-[#009639]/10 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";
const button =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#009639] px-4 text-xs font-semibold text-white hover:bg-[#007a2e] disabled:cursor-not-allowed disabled:opacity-50";
const date = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "Asia/Manila",
      })
    : "";

function GoalCard({ goal, connectionId, onSaved }) {
  const [status, setStatus] = useState(goal.status);
  const [note, setNote] = useState(goal.note);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const savedStatus =
    STATUSES.find((item) => item.key === goal.status) || STATUSES[0];
  const changed = status !== goal.status || note.trim() !== goal.note;
  const save = async (event) => {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await api.put(
        `/mentorship/${connectionId}/goals/${goal.key}`,
        { status, note: note.trim(), revision: goal.revision },
      );
      onSaved(response.data.data, goal.title);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to save progress. Please try again.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <article
      data-mentorship-goal={goal.key}
      className={`${card} flex min-w-0 flex-col p-5`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${goal.status === "completed" ? "bg-emerald-50 text-[#009639] dark:bg-emerald-950 dark:text-emerald-300" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300"}`}
        >
          {createElement(
            goal.status === "completed"
              ? CheckCircle2
              : icons[goal.key] || Target,
            { size: 22 },
          )}
        </span>
        <span
          className={`rounded-full px-3 py-1.5 text-[10px] font-semibold ${savedStatus.style}`}
        >
          {savedStatus.label}
        </span>
      </div>
      <h3 className="mt-4 text-sm font-semibold">{goal.title}</h3>
      <p className="mb-5 mt-2 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
        {goal.description}
      </p>
      <form onSubmit={save} className="mt-auto">
        <fieldset disabled={busy}>
          <label className="block text-xs font-medium">
            Progress status
            <select
              aria-label={`Status for ${goal.title}`}
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setError("");
              }}
              className={input}
            >
              {STATUSES.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-4 block text-xs font-medium">
            Progress note{" "}
            <span className="font-normal text-zinc-400">(optional)</span>
            <textarea
              aria-label={`Note for ${goal.title}`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="What have you worked on? What comes next?"
              className={`${input} !h-auto py-3 leading-6`}
            />
          </label>
          {error && (
            <p
              role="alert"
              className="mt-3 text-xs leading-6 text-red-600 dark:text-red-400"
            >
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={!changed || busy}
            className={`${button} mt-4 w-full`}
          >
            {busy ? "Saving…" : "Save progress"}
          </button>
        </fieldset>
      </form>
      <div className="mt-4 min-h-9 border-t border-zinc-100 pt-3 text-[10px] leading-5 text-zinc-400 dark:border-zinc-800">
        {goal.updatedAt ? (
          <>
            <p>
              Updated {date(goal.updatedAt)} by{" "}
              {goal.updatedByName || goal.updatedByRole}
            </p>
            {goal.completedAt && (
              <p className="text-[#007a2e] dark:text-emerald-300">
                Completed {date(goal.completedAt)}
              </p>
            )}
          </>
        ) : (
          <p>No progress recorded yet.</p>
        )}
      </div>
    </article>
  );
}

export default function MentorshipProgressTracker({
  initialPartnerAuthId = "",
}) {
  const { user } = useAuth();
  const [trackers, setTrackers] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const generation = useRef(0);
  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/mentorship/me");
      if (request === generation.current) setTrackers(response.data.data || []);
    } catch (err) {
      if (request === generation.current)
        setError(
          err.response?.data?.message || "Unable to load mentorship progress.",
        );
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    return () => {
      ++generation.current;
    };
  }, [load]);
  const partner = (tracker) =>
    user?.role === "alumni" ? tracker.student : tracker.mentor;
  const selected =
    trackers.find((tracker) => tracker.connectionId === selectedId) ||
    trackers.find(
      (tracker) => partner(tracker).authId === initialPartnerAuthId,
    ) ||
    trackers[0];
  const onSaved = (tracker, title) => {
    setTrackers((previous) =>
      previous.map((item) =>
        item.connectionId === tracker.connectionId ? tracker : item,
      ),
    );
    setMessage(`${title} progress saved.`);
  };
  const peer = selected ? partner(selected) : null;
  return (
    <section aria-label="Mentorship progress tracker" className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Target size={21} className="text-[#009639]" />
            Mentorship progress tracker
          </h2>
          <p className="mt-2 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
            Set a direction together and track the steps toward your career
            goals.
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={load}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-600 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
          <RefreshCw size={14} />
          Refresh progress
        </button>
      </header>
      {error && (
        <p
          role="alert"
          className={`${card} p-4 text-sm text-red-600 dark:text-red-400`}
        >
          {error}{" "}
          <button type="button" onClick={load} className="underline">
            Retry
          </button>
        </p>
      )}
      {message && !loading && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
        >
          <CheckCircle2 size={16} />
          {message}
        </p>
      )}
      {loading ? (
        <p
          role="status"
          className={`${card} p-8 text-center text-sm text-zinc-500 dark:text-zinc-400`}
        >
          Loading mentorship goals…
        </p>
      ) : !error && !selected ? (
        <div className={`${card} py-12 text-center`}>
          <Target
            size={32}
            className="mx-auto text-zinc-300 dark:text-zinc-600"
          />
          <h3 className="mt-4 text-base font-semibold">
            Start with a mentorship connection
          </h3>
          <p className="mx-auto mt-2 max-w-md px-4 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            {user?.role === "alumni"
              ? "Your students will appear here once you accept their connection requests."
              : "Connect with an alumni mentor. Once your request is accepted, you can track resume building, interview preparation, and career planning together."}
          </p>
        </div>
      ) : (
        !error &&
        selected && (
          <>
            <div
              className={`${card} flex flex-wrap items-center justify-between gap-4 p-5`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-50 text-[#009639] dark:bg-emerald-950">
                  <ProfileAvatar user={peer} />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    {user?.role === "alumni"
                      ? "Student mentee"
                      : "Alumni mentor"}
                  </p>
                  <h3 className="mt-1 break-words text-sm font-semibold">
                    {peer.name}
                  </h3>
                  <p className="mt-1 break-words text-xs text-zinc-500 dark:text-zinc-400">
                    {peer.program || peer.email}
                  </p>
                </div>
              </div>
              <label className="block min-w-0 w-full text-xs font-medium sm:w-72">
                {user?.role === "alumni" ? "Select mentee" : "Select mentor"}
                <select
                  aria-label="Select mentorship connection"
                  value={selected.connectionId}
                  onChange={(event) => {
                    setSelectedId(event.target.value);
                    setMessage("");
                  }}
                  className={input}
                >
                  {trackers.map((tracker) => (
                    <option
                      key={tracker.connectionId}
                      value={tracker.connectionId}
                    >
                      {partner(tracker).name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="rounded-2xl bg-[#064d37] p-5 text-white sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs text-emerald-100/75">
                    Your shared milestones
                  </p>
                  <h3 className="mt-2 text-xl font-semibold">
                    {selected.summary.completed} of {selected.summary.total}{" "}
                    goals completed
                  </h3>
                  <p className="mt-2 text-xs text-emerald-100/75">
                    {selected.summary.inProgress} in progress ·{" "}
                    {selected.summary.notStarted} not started
                  </p>
                </div>
                <span className="text-3xl font-semibold">
                  {selected.summary.percent}%
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="Mentorship goals completed"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={selected.summary.percent}
                className="mt-5 h-2 overflow-hidden rounded-full bg-white/15"
              >
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all"
                  style={{ width: `${selected.summary.percent}%` }}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {selected.goals.map((goal) => (
                <GoalCard
                  key={`${selected.connectionId}:${goal.key}:${goal.revision}`}
                  goal={goal}
                  connectionId={selected.connectionId}
                  onSaved={onSaved}
                />
              ))}
            </div>
            <p className="px-1 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
              Both you and your mentorship partner can save progress and notes.
              Progress is tracked separately for each connection. The completion
              percentage counts completed goals.
            </p>
          </>
        )
      )}
    </section>
  );
}
