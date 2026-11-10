import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, Video, Clock, MapPin, CalendarX } from "lucide-react";
import { FeedDialog } from "../feed/FeedComposer";
import api from "../../utils/axios";

const dateTime = (value) =>
  new Date(value).toLocaleString("en-US", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  });
export default function ActivityAccess({ event, onRegistered, compact = false }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [showPass, setShowPass] = useState(false);
  const posting = useRef(false);
  const registered = !!event.registration;
  const window = event.registrationWindow || { state: "open" };
  const meetingAccess = event.meetingAccess;
  const updateEvent = useRef(onRegistered);
  useEffect(() => { updateEvent.current = onRegistered; }, [onRegistered]);
  // Revalidate with the server at the opening boundary instead of waiting for
  // the page's next background poll. Local time never grants room access.
  useEffect(() => {
    if (!registered || event.deliveryMode !== "online" || meetingAccess?.state !== "upcoming") return;
    const opensAt = new Date(meetingAccess.opensAt).getTime();
    if (!Number.isFinite(opensAt)) return;
    let active = true, running = false, timer;
    const controller = new AbortController();
    const refresh = async () => {
      if (!active || document.hidden || running) return;
      running = true;
      try {
        const response = await api.get(`/events/${event._id}`, { signal: controller.signal });
        if (active) {
          updateEvent.current?.(response.data.data);
          // Clock skew or a transient response can still report upcoming.
          if (response.data.data.meetingAccess?.state === "upcoming") timer = setTimeout(refresh, 2000);
        }
      } catch {
        if (active) timer = setTimeout(refresh, 5000);
      } finally { running = false; }
    };
    const resume = () => { if (Date.now() >= opensAt) { clearTimeout(timer); void refresh(); } };
    timer = setTimeout(refresh, Math.min(2147483647, Math.max(100, opensAt - Date.now() + 100)));
    document.addEventListener("visibilitychange", resume);
    return () => { active = false; clearTimeout(timer); controller.abort(); document.removeEventListener("visibilitychange", resume); };
  }, [registered, event._id, event.deliveryMode, meetingAccess?.state, meetingAccess?.opensAt]);
  const register = async () => {
    if (posting.current) return;
    posting.current = true;
    setBusy(true);
    setError("");
    try {
      await api.post(`/events/${event._id}/register`);
      const response = await api.get(`/events/${event._id}`);
      onRegistered(response.data.data);
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to register. Please try again.",
      );
    } finally {
      posting.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="mt-auto space-y-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
      {registered ? (
        <p className="activity-registration-status inline-flex items-center gap-1.5 text-xs font-semibold text-brand dark:text-brand">
          <BadgeCheck size={15} />
          Registered
        </p>
      ) : !compact ? (
        <p className="text-[11px] leading-5 text-zinc-500">
          Register first to access{" "}
          {event.deliveryMode === "online"
            ? "the online meeting"
            : "your on-site registration and venue details"}
          .
        </p>
      ) : null}
      {!compact && !registered && (window.opensAt || window.closesAt) && (
        <p className="flex items-start gap-2 text-[11px] leading-5 text-zinc-500">
          <Clock size={13} className="mt-1 shrink-0" />
          <span>
            {window.state === "upcoming"
              ? `Registration opens ${dateTime(window.opensAt)}`
              : window.state === "closed"
                ? "Registration closed"
                : `Registration closes ${dateTime(window.closesAt)}`}
          </span>
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs leading-5 text-red-600">
          {error}
        </p>
      )}
      {!compact && registered &&
        event.deliveryMode === "online" &&
        meetingAccess?.state === "upcoming" && (
          <p className="flex items-start gap-2 text-[11px] leading-5 text-zinc-500">
            <Clock size={13} className="mt-1 shrink-0" />
            <span>
              Meeting access opens {dateTime(meetingAccess.opensAt)} (
              {meetingAccess.earlyAccessMinutes} minutes before the scheduled
              start).
            </span>
          </p>
        )}
      {registered ? (
        event.deliveryMode === "online" ? (
          meetingAccess?.state === "open" ? (
            <Link
              to={`/meetings/${event._id}`}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand px-4 text-xs font-semibold text-white"
            >
              <Video size={15} />
              View meeting
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className={`inline-flex min-h-10 cursor-not-allowed items-center gap-2 rounded-lg bg-zinc-200 px-4 text-xs font-semibold text-zinc-500 dark:bg-zinc-800 ${meetingAccess?.state === "ended" ? "!text-red-600 dark:!text-red-400" : ""}`}
            >
              <Video size={15} />
              {meetingAccess?.state === "ended"
                ? "Meeting ended"
                : "Meeting not available yet"}
            </button>
          )
        ) : (
          <button
            type="button"
            onClick={() => setShowPass(true)}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-zinc-300 px-4 text-xs font-semibold dark:border-zinc-700"
          >
            <BadgeCheck size={15} />
            View registration
          </button>
        )
      ) : (
        <button
          type="button"
          disabled={busy || window.state !== "open"}
          onClick={register}
          className={`inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand px-4 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 ${window.state === "closed" ? "disabled:!text-red-600 dark:disabled:!text-red-400" : ""}`}
        >
          {window.state === "closed" && <CalendarX size={15} aria-hidden="true" className="shrink-0" />}
          {busy
            ? "Registering..."
            : window.state === "closed"
              ? "Registration closed"
              : window.state === "upcoming"
                ? "Registration not open"
                : "Register"}
        </button>
      )}
      {showPass && (
        <FeedDialog
          title="Your registration"
          onClose={() => setShowPass(false)}
        >
          <div className="space-y-4">
            <p className="inline-flex items-center gap-2 text-xs font-semibold text-brand">
              <BadgeCheck size={16} />
              Registered participant
            </p>
            <h3 className="text-lg font-semibold">{event.title}</h3>
            <dl className="grid gap-4 text-sm">
              <div>
                <dt className="text-xs text-zinc-500">Participant</dt>
                <dd className="mt-1 font-semibold">
                  {event.registration.name}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Schedule</dt>
                <dd className="mt-1">
                  {dateTime(event.startAt)}
                  {event.endAt && ` — ${dateTime(event.endAt)}`}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Venue</dt>
                <dd className="mt-1 flex items-start gap-2">
                  <MapPin size={16} className="shrink-0" />
                  {event.location || "Contact the organizer for venue details."}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">
                  Registration reference
                </dt>
                <dd className="mt-1 font-mono text-xs">
                  {event.registration._id.slice(0, 16).toUpperCase()}
                </dd>
              </div>
            </dl>
            <p className="rounded-lg bg-zinc-50 p-3 text-xs leading-6 text-zinc-500 dark:bg-zinc-800">
              Present this registration to the organizer. Attendance is
              confirmed through the registered participant roster.
            </p>
          </div>
        </FeedDialog>
      )}
    </div>
  );
}
