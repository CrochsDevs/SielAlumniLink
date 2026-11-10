import ContentSkeleton from "../../components/ui/Skeleton";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Award, BadgeCheck, Building2, CalendarDays, Clock3, MapPin, Search, Video, ArrowUpRight, Pencil } from "lucide-react";
import ActivityAccess from "../../components/student/ActivityAccess";
import ActivityDetails from "../../components/events/ActivityDetails";
import { descriptionText } from "../../components/career/description";
import DevelopmentShell from "../../components/student/DevelopmentShell";
import api from "../../utils/axios";
import PageTitle from "../../components/ui/PageTitle";
import StatCard from "../../components/ui/stat-card";
import DataPagination from "../../components/ui/data-pagination";
import { useAuth } from "../../context/useAuth";
import useVisiblePolling from "../../hooks/useVisiblePolling";
import "./studentEvents.css";

const formatDate = (value, options) => new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila", ...options });
const PAGE_SIZE = 12;

export default function StudentEvents() {
  const { user } = useAuth();
  const admin = user?.role === "admin";
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [type, setType] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const selectedEvent = events.find(event => event._id === selectedId);
  const updateEvent = updated => setEvents(list => list.map(item => item._id === updated._id ? updated : item));
  const filters = useRef(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setEvents((await api.get("/events")).data.data || []); }
    catch { setError("Unable to load activities. Please try again."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { Promise.resolve().then(load); }, [load]);
  useVisiblePolling(async () => {
    const response = await api.get("/events");
    setEvents(response.data.data || []);
  }, 15000);
  const visible = events.filter(event =>
    (type === "all" || (event.activityType || "event") === type) &&
    `${event.title} ${event.organizer || ""}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const hasFilters = type !== "all" || !!query;
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageEvents = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const clearFilters = () => { setType("all"); setQuery(""); setPage(1); };
  const changePage = nextPage => {
    setPage(Math.max(1, Math.min(nextPage, totalPages)));
    filters.current?.scrollIntoView({ block: "start", behavior: "instant" });
  };
  return <DevelopmentShell title="Events">
    <main className="events-page workspace-page mx-auto max-w-7xl space-y-6 p-3 sm:p-6">
      <header className="workspace-page-header flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><PageTitle icon={CalendarDays}>Events &amp; learning</PageTitle><p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">Discover events, training, and seminars. Register and keep learning with your alumni community.</p></div>
        <div className="flex flex-wrap gap-2 self-start">
          {user?.role === "alumni" && <Link to="/alumni/events" className="events-button"><CalendarDays size={16} />Event calendar</Link>}
          {admin && <Link to="/admin/events" className="events-button"><CalendarDays size={16} />Event calendar</Link>}
          <Link to={admin ? "/admin/certificates" : "/student/certificate"} className="events-button"><Award size={16} />{admin ? "Manage certificates" : "Your certificates"}<ArrowUpRight size={14} /></Link>
        </div>
      </header>
      <dl className="grid gap-3 sm:grid-cols-3" aria-label="Activity summary">
        <StatCard loading={loading} label="Available activities" value={loading || error ? "—" : events.length} icon={CalendarDays} note="Events, training, and seminars" />
        <StatCard loading={loading} label="Online sessions" value={loading || error ? "—" : events.filter(event => event.deliveryMode === "online").length} icon={Video} note="Join through SielAlumni" />
        <StatCard loading={loading} label={admin ? "On-site activities" : "Your registrations"} value={loading || error ? "—" : events.filter(event => admin ? event.deliveryMode !== "online" : event.registration).length} icon={BadgeCheck} note={admin ? "Activities with on-site attendance" : "Activities you registered for"} />
      </dl>
      <div ref={filters} className="events-panel events-filters scroll-mt-24">
        <label className="relative min-w-0 flex-1"><span className="sr-only">Search activities</span><Search size={17} className="pointer-events-none absolute left-3 top-3.5 text-zinc-400" /><input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="Search activities or organizer" className="events-field events-search" /></label>
        <label className="events-type"><span className="sr-only">Activity type</span><select value={type} onChange={event => { setType(event.target.value); setPage(1); }} className="events-field"><option value="all">All activities</option><option value="event">Events</option><option value="training">Training</option><option value="seminar">Seminars</option></select></label>
      </div>
      {error && <div role="alert" className="events-panel p-4 text-sm text-red-600 dark:text-red-400">{error}<button type="button" onClick={load} className="ml-2 font-semibold underline">Retry</button></div>}
      {loading ? <ContentSkeleton variant="cards" count={3} label="Loading activities..." /> : !error && <>
        <div className="flex items-center justify-between gap-3 px-1"><p role="status" className="events-muted">{visible.length} {visible.length === 1 ? "activity" : "activities"}{hasFilters ? ` of ${events.length}` : " to explore"}</p>{hasFilters && <button type="button" onClick={clearFilters} className="events-clear">Clear filters</button>}</div>
        {!visible.length ? <section className="events-panel events-empty"><span className="events-empty-icon"><CalendarDays size={30} /></span><h2>{events.length ? "No matching activities" : "More opportunities are on the way"}</h2><p>{events.length ? "Try another search or activity type to find what interests you." : "Published events, training, and seminars will appear here. Check back for new activities."}</p>{hasFilters && <button type="button" onClick={clearFilters} className="events-button">Clear filters</button>}</section> : <section className="events-grid" aria-label="Activities">
          {pageEvents.map(event => <article key={event._id} data-event={event._id} className="events-panel event-card">
            <div className="event-card-header"><div className="event-date" aria-hidden="true"><span>{formatDate(event.startAt, { month: "short" })}</span><strong>{formatDate(event.startAt, { day: "2-digit" })}</strong></div><div className="event-badges"><span className="event-type-badge">{event.activityType || "event"}</span><span className="event-mode">{event.deliveryMode === "online" ? <Video size={13} /> : <MapPin size={13} />}{event.deliveryMode === "online" ? "Online" : "On site"}</span></div></div>
            <div className="event-card-body"><h2>{event.title}</h2><p className="event-organizer"><Building2 size={14} />{event.organizer || "SielAlumni"}</p>
              <div className="event-schedule"><p><CalendarDays size={15} /><time dateTime={event.startAt}>{formatDate(event.startAt, { dateStyle: "medium" })}</time></p><p><Clock3 size={15} />{formatDate(event.startAt, { timeStyle: "short" })}<span className="event-timezone">PHT</span></p>{event.location && <p><MapPin size={15} /><span>{event.location}</span></p>}</div>
              {event.description && <p className="event-description event-description-preview">{descriptionText(event.description, event.descriptionFormat).replace(/\s+/g, " ").trim()}</p>}
            </div>
            <div className="event-card-actions"><button type="button" aria-haspopup="dialog" aria-label={`View details for ${event.title}`} className="events-button event-card-details" onClick={() => setSelectedId(event._id)}>View details<ArrowUpRight size={14} /></button>{admin ? <div className="event-admin-actions"><Link to={`/admin/events?edit=${encodeURIComponent(event._id)}`} aria-label={`Edit ${event.title}`} className="events-button"><Pencil size={14} />Edit</Link><Link to={`/admin/events/${event._id}/attendance`} className="events-button">Attendance</Link></div> : <ActivityAccess event={event} compact onRegistered={updateEvent} />}</div>
          </article>)}
        </section>}
        {visible.length > 0 && <nav aria-label="Activity pagination" className="events-panel overflow-hidden">
          <DataPagination page={currentPage} totalPages={totalPages} onPageChange={changePage} perPage={PAGE_SIZE} showPerPage={false} totalItems={visible.length} itemLabel="activities" />
        </nav>}
        <p className="events-muted flex items-start gap-2"><Clock3 size={15} className="mt-0.5 shrink-0" />All schedules use Philippine time. Register to see meeting access or your on-site registration details.</p>
      </>}
    </main>
    {selectedEvent && <ActivityDetails event={selectedEvent} onClose={() => setSelectedId(null)} onRegistered={updateEvent} />}
  </DevelopmentShell>;
}
