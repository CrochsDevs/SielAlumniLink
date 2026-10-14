import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, MapPin, ArrowUpRight } from "lucide-react";
import ActivityAccess from "../../components/student/ActivityAccess";
import DevelopmentShell from "../../components/student/DevelopmentShell";
import api from "../../utils/axios";

export default function StudentEvents() {
  const [events, setEvents] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [type, setType] = useState("all"),
    [query, setQuery] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setEvents((await api.get("/events")).data.data || []);
    } catch {
      setError("Unable to load activities. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    Promise.resolve().then(load);
  }, [load]);
  useEffect(() => {
    const timer = setInterval(() => {
      api
        .get("/events")
        .then((response) => setEvents(response.data.data || []))
        .catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, []);
  const visible = events.filter(
    (event) =>
      (type === "all" || (event.activityType || "event") === type) &&
      `${event.title} ${event.organizer || ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <DevelopmentShell title="Events">
      <main className="mx-auto max-w-6xl space-y-5 p-3 sm:p-6">
        <header className="border-b border-zinc-200 pb-5 dark:border-zinc-800">
          <h1>Events &amp; learning</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Find events, training, and seminars. Join online sessions directly
            in SielAlumni.
          </p>
        </header>
        <div className="flex flex-wrap gap-3">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Search activities</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search activities or organizer"
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label>
            <span className="sr-only">Activity type</span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="all">All activities</option>
              <option value="event">Events</option>
              <option value="training">Training</option>
              <option value="seminar">Seminars</option>
            </select>
          </label>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}{" "}
            <button onClick={load} className="underline">
              Retry
            </button>
          </p>
        )}
        {loading ? (
          <p role="status" className="p-8 text-center text-sm text-zinc-500">
            Loading activities...
          </p>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((event) => (
              <article
                key={event._id}
                className="flex min-w-0 flex-col rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold capitalize text-[#009639]">
                    {event.activityType || "event"}
                  </span>
                  <span className="rounded-md bg-zinc-100 px-2 py-1 text-[10px] dark:bg-zinc-800">
                    {event.deliveryMode === "online" ? "Online" : "On site"}
                  </span>
                </div>
                <h2 className="mt-4 break-words">{event.title}</h2>
                <p className="mt-2 text-xs text-zinc-500">
                  {event.organizer || "SielAlumni"}
                </p>
                <p className="mt-4 flex gap-2 text-xs leading-5 text-zinc-500">
                  <CalendarDays size={15} className="shrink-0" />
                  {new Date(event.startAt).toLocaleString([], {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
                {event.location && (
                  <p className="mt-2 flex gap-2 text-xs text-zinc-500">
                    <MapPin size={15} className="shrink-0" />
                    {event.location}
                  </p>
                )}
                <p className="my-4 whitespace-pre-wrap break-words text-xs leading-6 text-zinc-500">
                  {event.description}
                </p>
                <ActivityAccess
                  event={event}
                  onRegistered={(updated) =>
                    setEvents((list) =>
                      list.map((item) =>
                        item._id === updated._id ? updated : item,
                      ),
                    )
                  }
                />
              </article>
            ))}
            {!visible.length && (
              <p className="rounded-xl border border-zinc-200 bg-white p-8 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                No activities match your selection.
              </p>
            )}
          </section>
        )}
        <Link
          to="/student/certificate"
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#009639]"
        >
          Your certificates
          <ArrowUpRight size={14} />
        </Link>
      </main>
    </DevelopmentShell>
  );
}
