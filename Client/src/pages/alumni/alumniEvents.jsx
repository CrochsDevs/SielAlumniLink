import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, RefreshCw } from "lucide-react";
import ActivityDetails from "../../components/events/ActivityDetails";
import EventCalendar from "../../components/events/EventCalendar";
import { activityLabel, activityStyle } from "../../utils/eventCalendar";
import { useAuth } from "../../context/useAuth";
import AlumniSidebar from "../../layout/sidebar/alumni/alumniSidebar";
import AlumniTopbar from "../../layout/topbar/alumni/alumniTopbar";
import AlumniFeed from "../../components/feed/AlumniFeed";
import api from "../../utils/axios";

const field =
  "min-h-10 rounded-lg border border-zinc-200 bg-white text-xs outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 dark:border-zinc-700 dark:bg-zinc-900";

export default function AlumniEvents() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("calendar");
  const activeTab = params.has("post") ? "community" : tab;
  const changeTab = (value) => {
    setTab(value);
    if (value === "calendar" && params.has("post")) {
      const next = new URLSearchParams(params);
      next.delete("post");
      setParams(next);
    }
  };
  const [now, setNow] = useState(() => Date.now());
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [participation, setParticipation] = useState("all");
  const [mode, setMode] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const loadEvents = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    try {
      const res = await api.get("/events");
      setEvents(res.data.data || []);
      setError("");
      setNow(Date.now());
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load university events. Please try again.",
      );
    } finally {
      if (!background) setLoading(false);
    }
  }, []);
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) void loadEvents();
    });
    return () => {
      cancelled = true;
    };
  }, [loadEvents]);
  useEffect(() => {
    const timer = setInterval(() => loadEvents(true), 15000);
    return () => clearInterval(timer);
  }, [loadEvents]);
  const visible = events.filter(
    (event) =>
      Number.isFinite(new Date(event.startAt).getTime()) &&
      event.isActive !== false &&
      (type === "all" || (event.activityType || "event") === type) &&
      (mode === "all" || event.deliveryMode === mode) &&
      (participation !== "registered" || !!event.registration) &&
      [event.title, event.description, event.organizer, event.location]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const selected = events.find((event) => event._id === selectedId);
  const upcoming = events.filter(
    (event) =>
      new Date(event.endAt || event.startAt).getTime() >= now &&
      event.isActive !== false,
  );
  const filterActive =
    !!query || type !== "all" || mode !== "all" || participation !== "all";
  const clearFilters = () => {
    setQuery("");
    setType("all");
    setMode("all");
    setParticipation("all");
  };

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <AlumniSidebar
        user={user}
        mobileOpen={sidebarOpen}
        setMobileOpen={setSidebarOpen}
      />
      <div className="lg:pl-64">
        <AlumniTopbar
          user={user}
          title="Events"
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="mx-auto max-w-[1500px] space-y-5 p-3 sm:p-6 workspace-page">
          <header className="flex flex-wrap items-start justify-between gap-4 workspace-page-header">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Events & activities
              </h1>
              <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                Plan your next university event, training, or seminar.
              </p>
            </div>
            {activeTab === "calendar" && (
              <button
                type="button"
                disabled={loading}
                onClick={() => loadEvents()}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
              >
                <RefreshCw
                  size={14}
                  className={loading ? "animate-spin" : ""}
                />
                Refresh
              </button>
            )}
          </header>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <nav
              aria-label="Events workspace"
              className="alumni-section-tabs flex max-w-full overflow-x-auto"
            >
              {[
                ["calendar", "University calendar"],
                ["community", "Alumni community"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={activeTab === id}
                  onClick={() => changeTab(id)}
                  className={`min-h-11 border-b-2 px-1 text-xs font-semibold ${activeTab === id ? "border-brand text-brand dark:text-brand" : "border-transparent text-zinc-500"}`}
                >
                  {label}
                </button>
              ))}
            </nav>
            {activeTab === "calendar" && !loading && (
              <p className="pb-2 text-xs text-zinc-500">
                {upcoming.length} upcoming{" "}
                <span className="mx-1 text-zinc-300">·</span>{" "}
                {upcoming.filter((event) => event.registration).length}{" "}
                registered
              </p>
            )}
          </div>
          {activeTab === "calendar" ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <label className="relative min-w-[180px] flex-1">
                  <Search
                    size={16}
                    className="absolute left-3 top-3 text-zinc-400"
                  />
                  <input
                    type="search"
                    aria-label="Search activities"
                    placeholder="Search activities or organizers"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className={`${field} w-full pl-9 pr-3`}
                  />
                </label>
                <select
                  aria-label="Activity type"
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                  className={`${field} max-w-full px-3`}
                >
                  <option value="all">All activities</option>
                  <option value="event">Events</option>
                  <option value="training">Training</option>
                  <option value="seminar">Seminars</option>
                </select>
                <select
                  aria-label="Delivery mode"
                  value={mode}
                  onChange={(event) => setMode(event.target.value)}
                  className={`${field} max-w-full px-3`}
                >
                  <option value="all">Online & on-site</option>
                  <option value="online">Online</option>
                  <option value="onsite">On-site</option>
                </select>
                <select
                  aria-label="Participation"
                  value={participation}
                  onChange={(event) => setParticipation(event.target.value)}
                  className={`${field} max-w-full px-3`}
                >
                  <option value="all">All registrations</option>
                  <option value="registered">My registrations</option>
                </select>
                {filterActive && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="min-h-10 px-1 text-xs font-medium text-brand hover:underline dark:text-brand"
                  >
                    Clear filters
                  </button>
                )}
              </div>
              {error && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
                >
                  {error}{" "}
                  <button
                    type="button"
                    onClick={() => loadEvents()}
                    className="font-semibold underline"
                  >
                    Retry
                  </button>
                </p>
              )}
              {loading && !events.length ? (
                <div
                  role="status"
                  className="flex min-h-[460px] items-center justify-center rounded-xl border border-zinc-200 bg-white text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  Loading calendar…
                </div>
              ) : (
                <>
                  {!error && !visible.length && (
                    <p
                      role="status"
                      className="rounded-lg border border-zinc-200 bg-white p-3 text-xs leading-6 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      {filterActive
                        ? "No activities match your filters. Clear filters to see all schedules."
                        : "No university activities have been published yet. New activities will appear here."}
                    </p>
                  )}
                  <EventCalendar
                    events={visible}
                    now={now}
                    onOpen={(event) => setSelectedId(event._id)}
                  />
                </>
              )}
            </>
          ) : (
            <section className="mx-auto max-w-3xl space-y-4">
              <div>
                <h2 className="text-sm font-semibold">
                  From the alumni community
                </h2>
                <p className="mt-1 text-xs leading-6 text-zinc-500">
                  Discover gatherings and event updates shared by fellow alumni.
                </p>
              </div>
              <AlumniFeed onlyType="event" />
            </section>
          )}
        </main>
        {selected && (
          <ActivityDetails
            key={selected._id}
            event={selected}
            onClose={() => setSelectedId(null)}
            onRegistered={(updated) =>
              setEvents((list) =>
                list.map((item) => (item._id === updated._id ? updated : item)),
              )
            }
          />
        )}
      </div>
    </div>
  );
}
