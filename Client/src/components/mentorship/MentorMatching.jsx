import ContentSkeleton from "../ui/Skeleton";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  LoaderCircle,
  ArrowUpRight,
  Check,
  Target,
} from "lucide-react";
import api from "../../utils/axios";
import StudentMentorCard from "./StudentMentorCard";
import DataPagination from "../ui/data-pagination";
import { mentorKey } from './connectionStates';
const card =
  "rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900";
const button =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-xs font-semibold text-white hover:bg-brand disabled:opacity-50";
const input =
  "mt-2 w-full rounded-lg border border-zinc-300 bg-white p-3 text-sm text-zinc-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";
export default function MentorMatching({
  states,
  connect,
  message,
  sending,
  connectionsLoading,
  connectionError,
  notice,
  onBrowse,
  onProgress,
  mentorProfiles = [],
  initialEdit = false,
}) {
  const [data, setData] = useState(null);
  const [interests, setInterests] = useState("");
  const [careerGoals, setCareerGoals] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState(1);
  const perPage = 12;
  const pending = useRef(false);
  const matches = data?.matches || [];
  const mentorProfilesById = new Map(mentorProfiles.map(profile => [String(profile._id), profile]));
  const totalPages = Math.max(1, Math.ceil(matches.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const visibleMatches = matches.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage,
  );
  useEffect(() => {
    let active = true;
    api
      .get("/mentorship/matches")
      .then((response) => {
        if (!active) return;
        const result = response.data.data;
        setData(result);
        setPage(1);
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
  useEffect(() => {
    if (!loading && initialEdit)
      document.getElementById("mentor-goals")?.focus();
  }, [loading, initialEdit]);
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
      setPage(1);
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
      <ContentSkeleton variant="cards" count={3} label="Finding mentors for you…" />
    );
  if (!data)
    return (
      <div role="alert" className={card}>
        <p className="text-sm text-zinc-500">{error}</p>
        <button
          type="button"
          className={`${button} mt-4`}
          onClick={() => {
            setLoading(true);
            setAttempt((value) => value + 1);
          }}
        >
          Try again
        </button>
      </div>
    );
  return (
    <div className="mentorship-matching-layout">
      <div className="min-w-0 space-y-6">
        <section
          className={`${card} !rounded-2xl !p-0`}
          aria-label="Your career direction"
        >
          <header className="flex items-center gap-3 p-4 sm:p-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-brand dark:bg-zinc-800">
              <Target size={20} />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">Your career direction</h2>
              <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Tell us what you want to learn.
              </p>
            </div>
          </header>
          <form
            id="mentor-preferences-form"
            onSubmit={save}
            aria-label="Mentor matching preferences"
            className="border-t border-zinc-100 p-4 sm:p-5 dark:border-zinc-800"
          >
            <p className="mb-5 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              Your interests and goals help us suggest alumni with relevant
              experience.
            </p>
            <fieldset disabled={saving} className="grid gap-4">
              <label
                className="block text-xs font-semibold"
                htmlFor="mentor-interests"
              >
                Career interests
                <input
                  id="mentor-interests"
                  className={input}
                  value={interests}
                  maxLength={1638}
                  onChange={(event) => {
                    setInterests(event.target.value);
                    setSaved(false);
                  }}
                  placeholder="e.g. Web development"
                  aria-describedby="mentor-interests-help"
                />
                <span
                  id="mentor-interests-help"
                  className="mt-2 block text-xs font-normal text-zinc-500"
                >
                  Use commas to separate interests (up to 20).
                </span>
              </label>
              <label
                className="block text-xs font-semibold"
                htmlFor="mentor-goals"
              >
                Career goal{" "}
                <span className="font-normal text-zinc-400">(optional)</span>
                <textarea
                  id="mentor-goals"
                  rows={3}
                  maxLength={1000}
                  className={`${input} resize-y`}
                  value={careerGoals}
                  onChange={(event) => {
                    setCareerGoals(event.target.value);
                    setSaved(false);
                  }}
                  placeholder="e.g. Prepare for my first developer role."
                />
                <span className="mt-1 block text-right text-[11px] font-normal text-zinc-400">
                  {careerGoals.length}/1,000
                </span>
              </label>
              <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Portfolio skills
                  </p>
                  <Link
                    to="/student/portfolio"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand"
                  >
                    {data.profile.skills.length ? "Edit skills" : "Add skills"}
                    <ArrowUpRight size={13} />
                  </Link>
                </div>
                <div className="flex flex-wrap gap-2">
                  {data.profile.skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  {data.profile.skills.length
                    ? "These skills also help us find relevant mentors."
                    : "Add your skills to improve your recommendations."}
                </p>
              </div>
              {error && (
                <p
                  role="alert"
                  className="text-sm text-red-600 dark:text-red-300"
                >
                  {error}
                </p>
              )}
              <div>
                <button
                  type="submit"
                  disabled={saving}
                  className={`${button} !min-h-11 w-full`}
                >
                  {saving ? (
                    <LoaderCircle size={16} className="animate-spin" />
                  ) : (
                    <Sparkles size={16} />
                  )}{" "}
                  {saving ? "Updating…" : "Update recommendations"}
                </button>
              </div>
            </fieldset>
          </form>
        </section>
        <div className="hidden px-1 xl:block">
          <h2 className="text-sm font-semibold">Start your mentorship</h2>
          <ol className="mt-4 space-y-4">
            {[
              [
                "Choose a mentor",
                "Explore their experience and shared interests.",
              ],
              ["Send a request", "You can message them once they accept."],
              [
                "Work on your goals",
                "Open My progress to share activities and get feedback.",
              ],
            ].map(([title, description], index) => (
              <li key={title} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[11px] font-semibold text-brand">
                  {index + 1}
                </span>
                <div>
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    {title}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                    {description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div className="min-w-0 space-y-4">
        {saved && (
          <p
            role="status"
            className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-brand dark:bg-zinc-800 dark:text-brand"
          >
            <Check size={16} />
            Your career direction is saved. Recommendations are updated.
          </p>
        )}
        <section
          aria-label="Recommended mentors"
          aria-busy={saving}
          className="space-y-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Recommended mentors</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {data.matches.length}{" "}
                {data.matches.length === 1 ? "alumnus" : "alumni"} with
                experience related to your skills and interests.
              </p>
            </div>
            {onBrowse && (
              <button
                type="button"
                onClick={onBrowse}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-brand/20 px-3 text-xs font-semibold text-brand hover:bg-brand/5 dark:text-brand"
              >
                Browse all mentors
                <ArrowUpRight size={15} />
              </button>
            )}
          </div>
          {connectionError && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
            >
              {connectionError}
            </p>
          )}
          {notice && (
            <p
              role="status"
              className="rounded-xl bg-emerald-50 p-4 text-sm text-brand dark:bg-zinc-800 dark:text-brand"
            >
              {notice}
            </p>
          )}
          {!data.matches.length && (
            <div className={`${card} !rounded-2xl py-10 text-center`}>
              <Sparkles size={28} className="mx-auto text-brand" />
              <h3 className="mt-4 text-base font-semibold">
                {data.candidateCount
                  ? "Let’s find the right mentor for you"
                  : "Your alumni community is growing"}
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                {data.candidateCount
                  ? "Share your career interests or add portfolio skills. You can also browse all alumni and make your own connection."
                  : "Save your career interests now and check back as alumni join."}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    document.getElementById("mentor-interests")?.focus();
                  }}
                  className={`${button} !min-h-11`}
                >
                  Add interests & goals
                </button>
                {onBrowse && (
                  <button
                    type="button"
                    onClick={onBrowse}
                    className="min-h-11 px-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300"
                  >
                    Browse all mentors
                  </button>
                )}
              </div>
            </div>
          )}
          <div
            className={`mentorship-recommendation-grid${visibleMatches.length === 1 ? " mentorship-recommendation-grid-single" : ""}`}
          >
            {visibleMatches.map(({ mentor, score, reasons }) => {
              const profile = mentorProfilesById.get(String(mentor._id));
              const displayMentor = profile
                ? { ...mentor, bannerImage: profile.bannerImage || null }
                : mentor;
              return (
              <StudentMentorCard
                key={mentor._id}
                mentor={displayMentor}
                score={score}
                reasons={reasons}
                status={states[mentorKey(mentor)]}
                connect={connect}
                message={message}
                sending={sending}
                disabled={connectionsLoading || !!connectionError}
                onProgress={onProgress}
              />
              );
            })}
          </div>
          {matches.length > 0 && (
            <nav
              aria-label="Recommended mentor pagination"
              className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
            >
              <DataPagination
                page={currentPage}
                totalPages={totalPages}
                onPageChange={setPage}
                perPage={perPage}
                showPerPage={false}
                totalItems={matches.length}
                itemLabel="mentors"
              />
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
