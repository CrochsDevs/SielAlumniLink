import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  LoaderCircle,
  ArrowUpRight,
  Check,
  Plus,
  MessageSquare,
} from "lucide-react";
import api from "../../utils/axios";
import ProfileAvatar from "../profile/ProfileAvatar";

const card =
  "rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900";
const button =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#009639] px-4 text-xs font-semibold text-white hover:bg-[#007a2e] disabled:opacity-50";
const input =
  "mt-2 w-full rounded-lg border border-zinc-300 bg-white p-3 text-sm text-zinc-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

export default function MentorMatching({
  states,
  connect,
  message,
  sending,
  connectionsLoading,
  connectionError,
  notice,
}) {
  const [data, setData] = useState(null);
  const [interests, setInterests] = useState("");
  const [careerGoals, setCareerGoals] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const pending = useRef(false);

  useEffect(() => {
    let active = true;
    api
      .get("/mentorship/matches")
      .then((response) => {
        if (!active) return;
        const result = response.data.data;
        setData(result);
        setInterests(result.preferences.interests.join(", "));
        setCareerGoals(result.preferences.careerGoals);
        setError("");
      })
      .catch(() => {
        if (active)
          setError("Unable to load mentor matches. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  const save = async (event) => {
    event.preventDefault();
    if (pending.current) return;
    const entries = interests
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (entries.length > 20 || entries.some((value) => value.length > 80)) {
      setError("Use up to 20 interests, with no more than 80 characters each.");
      return;
    }
    pending.current = true;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const response = await api.put("/mentorship/matches/preferences", {
        interests: entries,
        careerGoals,
      });
      setData(response.data.data);
      setSaved(true);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to update your matches. Your edits are still here; please try again.",
      );
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div role="status" className={`${card} flex items-center gap-3`}>
        <LoaderCircle className="animate-spin text-emerald-600" size={20} />
        Finding your mentor matches...
      </div>
    );
  if (!data)
    return (
      <div role="alert" className={card}>
        <p>{error}</p>
        <button
          type="button"
          className={`${button} mt-3`}
          onClick={() => {
            setLoading(true);
            setAttempt((value) => value + 1);
          }}
        >
          Retry matching
        </button>
      </div>
    );

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
      <form
        onSubmit={save}
        className={`${card} space-y-5`}
        aria-label="Mentor matching preferences"
      >
        <div>
          <span className="inline-flex rounded-lg bg-emerald-50 p-2 text-[#009639] dark:bg-emerald-950">
            <Sparkles size={21} />
          </span>
          <h2 className="mt-3 text-lg font-semibold">Find your mentor match</h2>
          <p className="mt-2 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
            Tell us what you want to explore. We’ll compare your skills,
            interests, and goals with alumni profiles.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold">Your profile skills</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {data.profile.skills.length ? (
              data.profile.skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                >
                  {skill}
                </span>
              ))
            ) : (
              <p className="text-xs text-zinc-500">
                Add skills to make your matches more useful.
              </p>
            )}
          </div>
          <Link
            to="/student/portfolio"
            className="mt-2 inline-flex min-h-8 items-center gap-1 text-xs text-[#007a2e] dark:text-emerald-300"
          >
            Edit portfolio
            <ArrowUpRight size={12} />
          </Link>
        </div>
        <label
          className="block text-xs font-semibold"
          htmlFor="mentor-interests"
        >
          Career interests
          <input
            id="mentor-interests"
            className={input}
            value={interests}
            disabled={saving}
            maxLength={1638}
            onChange={(event) => {
              setInterests(event.target.value);
              setSaved(false);
            }}
            placeholder="e.g. Data science, teaching"
            aria-describedby="mentor-interests-help"
          />
          <span
            id="mentor-interests-help"
            className="mt-1 block text-[11px] font-normal text-zinc-500"
          >
            Separate interests with commas. Up to 20.
          </span>
        </label>
        <label className="block text-xs font-semibold" htmlFor="mentor-goals">
          Career goals
          <textarea
            id="mentor-goals"
            rows={4}
            maxLength={1000}
            className={`${input} resize-y`}
            value={careerGoals}
            disabled={saving}
            onChange={(event) => {
              setCareerGoals(event.target.value);
              setSaved(false);
            }}
            placeholder="e.g. Become a software engineer and improve my JavaScript skills"
          />
          <span className="mt-1 block text-right text-[11px] font-normal text-zinc-500">
            {careerGoals.length}/1,000
          </span>
        </label>
        {error && (
          <p role="alert" className="text-xs text-red-600 dark:text-red-300">
            {error}
          </p>
        )}
        <button type="submit" disabled={saving} className={`${button} w-full`}>
          {saving ? (
            <LoaderCircle size={15} className="animate-spin" />
          ) : (
            <Sparkles size={15} />
          )}
          {saving ? "Updating matches..." : "Save & update matches"}
        </button>
        {saved && (
          <p
            role="status"
            className="text-xs text-emerald-700 dark:text-emerald-300"
          >
            Preferences saved. Your matches are up to date.
          </p>
        )}
      </form>
      <section
        aria-label="Recommended mentors"
        aria-busy={saving}
        className="min-w-0 space-y-4"
      >
        <div className={card}>
          <h2 className="text-lg font-semibold">Recommended for you</h2>
          <p className="mt-2 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
            Content-based matching uses shared skills and career keywords.
            Scores show profile similarity, not a guarantee of fit. Alumni
            choose whether to accept a connection.
          </p>
          <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            {data.matches.length} matches from {data.candidateCount} alumni
            profiles
          </p>
        </div>
        {connectionError && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 p-4 text-xs text-red-700 dark:bg-red-950 dark:text-red-300"
          >
            {connectionError} Open Find mentors to refresh connections.
          </p>
        )}
        {notice && (
          <p
            role="status"
            className="rounded-xl bg-emerald-50 p-4 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
          >
            {notice}
          </p>
        )}
        {!data.matches.length && (
          <div className={`${card} py-12 text-center`}>
            <Sparkles size={28} className="mx-auto text-emerald-600" />
            <h3 className="mt-4 font-semibold">
              {data.candidateCount
                ? "No matching profiles yet"
                : "No alumni profiles available yet"}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
              {data.candidateCount
                ? "Add your skills, interests, or a specific career goal, then update your matches. You can also explore everyone in Find mentors."
                : "Check back as alumni join the community. You can save your preferences now."}
            </p>
          </div>
        )}
        <div className="grid gap-4 xl:grid-cols-2">
          {data.matches.map(({ mentor, score, reasons }) => {
            const status = states[mentor.email];
            return (
              <article
                key={mentor._id}
                className={`${card} flex min-w-0 flex-col`}
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-50 font-semibold text-emerald-700">
                    <ProfileAvatar user={mentor} fallback="A" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/alumni/profile/${mentor._id}`}
                      className="break-words text-sm font-semibold hover:underline"
                    >
                      {mentor.name}
                    </Link>
                    <p className="mt-1 break-words text-xs text-zinc-500 dark:text-zinc-400">
                      {mentor.headline}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {score}/100
                  </span>
                </div>
                <h3 className="mt-5 text-xs font-semibold">Why this match</h3>
                <ul className="mb-5 mt-2 space-y-2">
                  {reasons.map((reason) => (
                    <li
                      key={reason}
                      className="flex gap-2 break-words text-xs leading-5 text-zinc-600 dark:text-zinc-300"
                    >
                      <Check
                        size={13}
                        className="mt-1 shrink-0 text-emerald-600"
                      />
                      <span className="min-w-0">{reason}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto flex flex-wrap items-center gap-3">
                  {status === "connected" ? (
                    <button
                      type="button"
                      className={button}
                      onClick={() => message(mentor)}
                    >
                      <MessageSquare size={14} />
                      Message
                    </button>
                  ) : status === "incoming" ? (
                    <Link className={button} to="/student/requests">
                      Review request
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className={button}
                      disabled={
                        connectionsLoading ||
                        !!connectionError ||
                        !!sending ||
                        status === "pending"
                      }
                      onClick={() => connect(mentor)}
                    >
                      {sending === mentor.email ? (
                        <LoaderCircle size={14} className="animate-spin" />
                      ) : (
                        <Plus size={14} />
                      )}
                      {status === "pending"
                        ? "Request sent"
                        : sending === mentor.email
                          ? "Sending..."
                          : "Connect"}
                    </button>
                  )}
                  <Link
                    to={`/alumni/profile/${mentor._id}`}
                    className="inline-flex min-h-10 items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400"
                  >
                    View profile
                    <ArrowUpRight size={12} />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

