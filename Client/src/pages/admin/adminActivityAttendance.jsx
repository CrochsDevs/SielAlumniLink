import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Users, Video } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import AdminSidebar from "../../layout/sidebar/admin/adminSidebar";
import AdminTopbar from "../../layout/topbar/alumni/adminTopbar";
import CertificatePreview from "../../components/student/CertificatePreview";
import api from "../../utils/axios";

const card =
  "rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900";
const time = (value) =>
  new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
export default function AdminActivityAttendance() {
  const { eventId } = useParams(),
    { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false),
    [event, setEvent] = useState(null),
    [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [certificate, setCertificate] = useState(null);
  const posting = useRef(false);
  const load = useCallback(async () => {
    try {
      const [activity, roster] = await Promise.all([
        api.get(`/events/${eventId}`),
        api.get(`/events/${eventId}/participants`),
      ]);
      setEvent(activity.data.data);
      setPeople(roster.data.data);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load registrations.");
    } finally {
      setLoading(false);
    }
  }, [eventId]);
  useEffect(() => {
    Promise.resolve().then(load);
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);
  const submit = async (person, action) => {
    if (posting.current) return;
    posting.current = true;
    setBusy(person.authId);
    setError("");
    try {
      const response = await api.post(
        `/events/${eventId}/participants/${person.authId}/${action}`,
      );
      if (action === "certificate") setCertificate(response.data.data);
      await load();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to save participation. Please try again.",
      );
    } finally {
      posting.current = false;
      setBusy("");
    }
  };
  const online = event?.deliveryMode === "online";
  const attended = people.filter((person) =>
    online ? person.attendedSeconds > 0 : person.onsiteCheckedInAt,
  ).length;
  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <AdminSidebar
        user={user}
        mobileOpen={sidebarOpen}
        setMobileOpen={setSidebarOpen}
      />
      <div className="lg:pl-64">
        <AdminTopbar
          user={user}
          title="Registration & attendance"
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="workspace-page mx-auto max-w-5xl space-y-5 p-3 sm:p-6">
          <Link
            to="/admin/events"
            className="inline-flex items-center gap-2 text-xs text-zinc-500"
          >
            <ArrowLeft size={14} />
            Back to calendar
          </Link>
          <header className="workspace-page-header flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-5 dark:border-zinc-800">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {event?.title || "Registration & attendance"}
              </h1>
              <p className="mt-2 text-sm text-zinc-500">
                {event
                  ? `${online ? "Online" : "On site"} · ${time(event.startAt)}`
                  : "Registered participants and verified attendance"}
              </p>
            </div>
            {online && (
              <Link
                to={`/meetings/${eventId}`}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#009639] px-4 text-xs font-semibold text-white"
              >
                <Video size={15} />
                Open meeting
              </Link>
            )}
          </header>
          {error && (
            <p role="alert" className={`${card} p-4 text-sm text-red-600`}>
              {error}{" "}
              <button onClick={load} className="underline">
                Retry
              </button>
            </p>
          )}
          {loading ? (
            <p role="status" className="p-8 text-center text-sm text-zinc-500">
              Loading registrations...
            </p>
          ) : (
            event && (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    ["Registered", people.length],
                    [online ? "Recorded attendance" : "Checked in", attended],
                    [
                      "Certificates issued",
                      people.filter((person) => person.certificateId).length,
                    ],
                  ].map(([label, count]) => (
                    <div key={label} className={`${card} p-4`}>
                      <p className="text-xs text-zinc-500">{label}</p>
                      <p className="mt-2 text-2xl font-semibold">{count}</p>
                    </div>
                  ))}
                </div>
                <section
                  className={`${card} p-4 text-xs leading-6 text-zinc-500`}
                >
                  <p>
                    Registration is{" "}
                    {event.registrationWindow.state === "upcoming"
                      ? "not open yet"
                      : event.registrationWindow.state}
                    .{" "}
                    {event.registrationWindow.opensAt &&
                      `Opens ${time(event.registrationWindow.opensAt)}. `}
                    Closes {time(event.registrationWindow.closesAt)}.
                  </p>
                  <p className="mt-1">
                    {online
                      ? "Meeting attendance is recorded automatically. Confirm participation after the host ends the session."
                      : "Check in registered participants at the venue. Confirm completed participation after the activity ends to issue their certificates."}
                  </p>
                </section>
                <section className="space-y-3">
                  {!people.length && (
                    <div className={`${card} p-10 text-center`}>
                      <Users size={25} className="mx-auto text-zinc-400" />
                      <p className="mt-3 text-sm text-zinc-500">
                        No registered participants yet.
                      </p>
                    </div>
                  )}
                  {people.map((person) => (
                    <article
                      key={person.authId}
                      data-participant={person.authId}
                      className={`${card} flex flex-wrap items-center justify-between gap-4 p-5`}
                    >
                      <div className="min-w-0">
                        <h2 className="break-words text-sm font-semibold">
                          {person.name}
                        </h2>
                        <p className="mt-1 break-words text-xs text-zinc-500">
                          {person.email}
                        </p>
                        <p className="mt-2 text-[11px] text-zinc-500">
                          Registered {time(person.registeredAt)}
                        </p>
                        <p className="mt-1 text-[11px] font-medium text-[#007a2e] dark:text-emerald-300">
                          {online
                            ? person.attendedSeconds > 0
                              ? `${Math.floor(person.attendedSeconds / 60)}m ${person.attendedSeconds % 60}s recorded`
                              : "No recorded meeting attendance"
                            : person.onsiteCheckedInAt
                              ? `Checked in ${time(person.onsiteCheckedInAt)}`
                              : "Awaiting on-site check-in"}
                        </p>
                      </div>
                      {person.certificateId ? (
                        <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#009639]">
                          <BadgeCheck size={16} />
                          Certificate issued
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {!online && !person.onsiteCheckedInAt && (
                            <button
                              type="button"
                              disabled={!!busy || !event.hasStarted}
                              onClick={() => submit(person, "check-in")}
                              className="min-h-10 rounded-lg border border-zinc-300 px-4 text-xs font-semibold disabled:opacity-40 dark:border-zinc-700"
                            >
                              {busy === person.authId
                                ? "Saving..."
                                : "Check in"}
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={
                              !!busy ||
                              (online
                                ? !person.attendedSeconds ||
                                  event.meetingState !== "ended"
                                : !person.onsiteCheckedInAt || !event.hasEnded)
                            }
                            onClick={() => submit(person, "certificate")}
                            className="min-h-10 rounded-lg bg-[#009639] px-4 text-xs font-semibold text-white disabled:opacity-40"
                          >
                            {busy === person.authId
                              ? "Saving..."
                              : "Confirm & issue certificate"}
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
                </section>
              </>
            )
          )}
          {certificate && (
            <CertificatePreview
              certificate={certificate}
              onClose={() => setCertificate(null)}
            />
          )}
        </main>
      </div>
    </div>
  );
}
