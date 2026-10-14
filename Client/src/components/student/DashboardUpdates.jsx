import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowUpRight,
  Search,
  RefreshCw,
  CalendarDays,
  Briefcase,
  Handshake,
} from "lucide-react";
import { useAuth } from "../../context/useAuth";
import useStudentDashboard from "../../hooks/useStudentDashboard";
import AlumniFeed from "../feed/AlumniFeed";
import ActivityAccess from "./ActivityAccess";
import { JobApplicationDialog } from "../career/JobApplicationDialog";
import { ReferralDetails } from "../career/ReferralDialogs";

const tabs = [
  ["all", "All updates"],
  ["hiring", "Hiring"],
  ["referral", "Referrals"],
  ["event", "Events"],
  ["story", "Success stories"],
];
const card =
  "rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900";
const action =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#009639] px-3 text-xs font-semibold text-white hover:bg-[#007a2e] disabled:opacity-50";
const date = (value) =>
  new Date(value).toLocaleString("en-US", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  });

function DashboardListings({ filter, query, refreshKey }) {
  const { user } = useAuth();
  const { resources, load, replace } = useStudentDashboard(
    user?.authId || user?._id,
    refreshKey,
  );
  const [selected, setSelected] = useState(null);
  const [limit, setLimit] = useState(6);
  useEffect(() => {
    setLimit(6);
  }, [filter, query]);
  const selectedSources = [
    filter === "hiring" ? "jobs" : filter === "referral" ? "referrals" : "events",
  ];
  const rows = selectedSources
    .flatMap((source) =>
      resources[source].items
        .filter((item) => item.isActive !== false)
        .map((item) => ({ source, item })),
    )
    .filter(({ item }) =>
      [
        item.title,
        item.company,
        item.organization,
        item.organizer,
        item.description,
        item.location,
        ...(item.tags || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .sort(
      (a, b) =>
        (new Date(b.item.createdAt || b.item.startAt).getTime() || 0) -
        (new Date(a.item.createdAt || a.item.startAt).getTime() || 0),
    );
  const errors = selectedSources
    .concat(
      filter === "hiring"
          ? ["jobApplications"]
          : filter === "referral"
            ? ["referralApplications"]
            : [],
    )
    .filter((key) => resources[key].error);
  const loading = selectedSources.some((key) => resources[key].loading);
  const jobApplication = (id) =>
    resources.jobApplications.items.find(
      (application) => String(application.jobId) === String(id),
    );
  const referralApplication = (id) =>
    resources.referralApplications.items.find(
      (application) => String(application.referralId) === String(id),
    );
  return (
    <section aria-label="Opportunities and activities" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">
          {filter === "hiring"
            ? "Job & internship openings"
            : filter === "referral"
              ? "Alumni referrals"
              : "University events & learning"}
        </h3>
        <span className="text-[11px] text-zinc-500">
          {rows.length} {rows.length === 1 ? "listing" : "listings"}
        </span>
      </div>
      {errors.map((key) => (
        <p
          key={key}
          role="alert"
          className={`${card} text-xs text-red-600 dark:text-red-300`}
        >
          {resources[key].error}{" "}
          <button
            type="button"
            onClick={load}
            className="font-semibold underline"
          >
            Retry listings
          </button>
        </p>
      ))}
      {loading && (
        <p role="status" className={`${card} text-xs text-zinc-500`}>
          Loading opportunities and activities...
        </p>
      )}
      {!loading && !errors.length && !rows.length && (
        <p role="status" className={`${card} text-xs leading-6 text-zinc-500`}>
          {query
            ? "No listings match your search. Try another keyword."
            : "No listings available yet. New opportunities and activities will appear here."}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.slice(0, limit).map(({ source, item }) => {
          const application =
            source === "jobs"
              ? jobApplication(item._id)
              : referralApplication(item._id);
          const applicationState =
            resources[
              source === "jobs" ? "jobApplications" : "referralApplications"
            ];
          const ended =
            source === "events" &&
            new Date(item.endAt || item.startAt).getTime() < Date.now();
          return (
            <article
              key={`${source}:${item._id}`}
              data-dashboard-listing={source}
              className={`${card} flex min-w-0 flex-col gap-3`}
            >
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-[#007a2e] dark:text-emerald-300">
                {source === "jobs" ? (
                  <Briefcase size={14} />
                ) : source === "referrals" ? (
                  <Handshake size={14} />
                ) : (
                  <CalendarDays size={14} />
                )}
                {source === "jobs"
                  ? item.type === "Internship"
                    ? "Internship"
                    : "Hiring"
                  : source === "referrals"
                    ? "Referral"
                    : item.activityType || "Event"}
              </p>
              <div>
                <h4 className="break-words text-sm font-semibold">
                  {item.title}
                </h4>
                <p className="mt-1 break-words text-xs text-zinc-500 dark:text-zinc-400">
                  {source === "jobs"
                    ? [item.company, item.location, item.mode]
                        .filter(Boolean)
                        .join(" · ")
                    : source === "referrals"
                      ? item.organization ||
                        item.authorName ||
                        "Alumni community"
                      : [item.organizer, item.location]
                          .filter(Boolean)
                          .join(" · ")}
                </p>
              </div>
              {source === "events" && item.startAt && (
                <p className="text-xs text-zinc-500">
                  {date(item.startAt)} (Manila)
                </p>
              )}
              {item.description && (
                <p className="line-clamp-3 break-words text-xs leading-6 text-zinc-500 dark:text-zinc-400">
                  {item.description}
                </p>
              )}
              {source === "events" ? (
                <>
                  <details className="text-xs text-zinc-500">
                    <summary className="cursor-pointer font-semibold text-[#007a2e] dark:text-emerald-300">
                      Event details
                    </summary>
                    <p className="mt-2 whitespace-pre-wrap break-words leading-6">
                      {item.description ||
                        "Contact the organizer for more information."}
                    </p>
                  </details>
                  {ended && !item.registration ? (
                    <p className="mt-auto text-xs text-zinc-500">
                      This event has ended.
                    </p>
                  ) : (
                    <ActivityAccess
                      event={item}
                      onRegistered={(updated) => replace("events", updated)}
                    />
                  )}
                </>
              ) : (
                <div className="mt-auto space-y-2 pt-2">
                  {application && (
                    <p className="text-xs font-medium capitalize text-[#007a2e] dark:text-emerald-300">
                      Application: {application.status || "pending"}
                    </p>
                  )}
                  <button
                    type="button"
                    className={action}
                    disabled={
                      applicationState.loading || !!applicationState.error
                    }
                    onClick={() => setSelected({ source, item })}
                  >
                    {application ? "View application" : "View details & apply"}
                    <ArrowUpRight size={13} />
                  </button>
                  {applicationState.loading && (
                    <p className="text-[10px] text-zinc-500">
                      Checking your applications...
                    </p>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
      {rows.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((value) => value + 6)}
          className="min-h-10 w-full rounded-lg border border-zinc-200 text-xs font-semibold dark:border-zinc-700"
        >
          Show more listings
        </button>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-medium text-[#007a2e] dark:text-emerald-300">
        {selectedSources.map((source) => (
          <Link
            key={source}
            to={
              source === "jobs"
                ? "/student/career"
                : source === "referrals"
                  ? "/student/referrals"
                  : "/student/events"
            }
            className="inline-flex min-h-9 items-center gap-1 hover:underline"
          >
            {source === "jobs"
              ? "Career board"
              : source === "referrals"
                ? "Referral board"
                : "All events"}
            <ArrowUpRight size={12} />
          </Link>
        ))}
      </div>
      {selected?.source === "jobs" && (
        <JobApplicationDialog
          key={selected.item._id}
          jobId={selected.item._id}
          user={user}
          application={jobApplication(selected.item._id)}
          onApplied={(application) =>
            replace("jobApplications", application, "jobId")
          }
          onClose={() => setSelected(null)}
        />
      )}
      {selected?.source === "referrals" && (
        <ReferralDetails
          key={selected.item._id}
          referral={selected.item}
          application={referralApplication(selected.item._id)}
          canApply={
            String(selected.item.authorAuthId) !==
            String(user?.authId || user?._id)
          }
          onApplied={(application) =>
            replace("referralApplications", application, "referralId")
          }
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}

export default function DashboardUpdates() {
  const [params, setParams] = useSearchParams();
  const filter = tabs.some(([key]) => key === params.get("tab"))
    ? params.get("tab")
    : "all";
  const query = (params.get("q") || "").slice(0, 200);
  const [term, setTerm] = useState(query);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);
  const updateParams = (key, value) => {
    const next = new URLSearchParams(params);
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
    next.delete("post");
    setParams(next, { replace: key === "q" });
  };
  return (
    <section aria-label="Community updates" className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Community updates</h2>
        <button
          type="button"
          onClick={() => setRefreshKey((value) => value + 1)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-zinc-500 hover:bg-zinc-200/50 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          <RefreshCw size={13} />
          Refresh updates
        </button>
      </div>
      <nav
        aria-label="Community feed filters"
        className="flex flex-wrap gap-x-5 gap-y-2 border-b border-zinc-200 dark:border-zinc-800"
      >
        {tabs.map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => updateParams("tab", value)}
            className={`min-h-10 border-b-2 pb-3 pt-1 text-xs font-medium transition ${filter === value ? "border-[#009639] text-[#007a2e] dark:text-emerald-300" : "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"}`}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="flex items-center gap-2">
        <label className="relative block min-w-0 flex-1">
          <span className="sr-only">Search dashboard updates</span>
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-3 text-zinc-400"
          />
          <input
            type="search"
            value={query}
            maxLength={200}
            onChange={(event) => updateParams("q", event.target.value)}
            placeholder="Search updates, opportunities, and events"
            className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-xs outline-none focus:border-[#009639] focus:ring-2 focus:ring-emerald-500/15 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        {query && (
          <button
            type="button"
            onClick={() => updateParams("q", "")}
            className="min-h-10 px-2 text-xs text-[#007a2e] dark:text-emerald-300"
          >
            Clear search
          </button>
        )}
      </div>
      {!params.has("post") && ["hiring", "referral", "event"].includes(filter) && (
        <DashboardListings
          filter={filter}
          query={term}
          refreshKey={refreshKey}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <h3 className="text-sm font-semibold">
          {filter === "story" ? "Alumni success stories" : "Community posts"}
        </h3>
        {filter === "story" && (
          <Link
            to="/student/success"
            className="inline-flex min-h-9 items-center gap-1 text-xs text-[#007a2e] dark:text-emerald-300"
          >
            Browse story gallery
            <ArrowUpRight size={12} />
          </Link>
        )}
      </div>
      <AlumniFeed
        onlyType={filter === "all" ? undefined : filter}
        showComposer={false}
        searchQuery={term}
        refreshKey={refreshKey}
      />
    </section>
  );
}
