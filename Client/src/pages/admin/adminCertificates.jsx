import { AdminTabs, AdminButton } from "../../components/admin/AdminUI";
import PageHeader from "../../components/ui/PageHeader";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, BadgeCheck } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import AdminSidebar from "../../layout/sidebar/admin/adminSidebar";
import AdminTopbar from "../../layout/topbar/alumni/adminTopbar";
import { FeedDialog } from "../../components/feed/FeedComposer";
import CertificatePreview from "../../components/student/CertificatePreview";
import api from "../../utils/axios";

const card =
  "admin-panel";
const button = "admin-button admin-button-primary";
const input =
  "mt-2 w-full rounded-lg border border-zinc-200 bg-white p-3 text-sm outline-none focus:border-[#009639] dark:border-zinc-700 dark:bg-zinc-900";
const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
export default function AdminCertificates() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [pending, setPending] = useState([]);
  const [issued, setIssued] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState({
    studentAuthId: "",
    title: "",
    date: "",
    type: "event",
    organizer: "SielAlumni",
    completed: false,
    eventId: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState("pending");
  const posting = useRef(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [people, attendance, certificates] = await Promise.all([
        api.get("/certificates/participants"),
        api.get("/certificates/attendance"),
        api.get("/certificates/issued"),
      ]);
      setParticipants(people.data.data);
      setPending(attendance.data.data);
      setIssued(certificates.data.data);
      try {
        const response = await api.get("/events", { params: { all: "true" } });
        setEvents(
          response.data.data.filter(
            (event) =>
              new Date(event.endAt || event.startAt).getTime() <= Date.now(),
          ),
        );
      } catch {
        setEvents([]);
      }
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to load participation records.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    Promise.resolve().then(load);
  }, [load]);
  const open = (record) => {
    setEditor(record || {});
    setSaveError("");
    setForm({
      studentAuthId: record?.authId || participants[0]?.authId || "",
      title: record?.title || "",
      date: record?.date || today(),
      type: record?.activityType || "event",
      organizer: "SielAlumni",
      completed: false,
      eventId: "",
    });
  };
  const submit = async (event) => {
    event.preventDefault();
    if (posting.current) return;
    posting.current = true;
    setSaving(true);
    setSaveError("");
    try {
      const response = await api.post(
        editor._id
          ? `/certificates/attendance/${editor._id}/confirm`
          : "/certificates/participations",
        form,
      );
      setEditor(null);
      setSelected(response.data.data);
      await load();
    } catch (err) {
      setSaveError(
        err.response?.data?.message || "Unable to confirm participation.",
      );
    } finally {
      posting.current = false;
      setSaving(false);
    }
  };
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
          title="Certificates"
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="workspace-page mx-auto max-w-6xl space-y-5 p-3 sm:p-6">
          <PageHeader title="Certificates" description="Confirm participation and manage attendance certificates.">
            <AdminButton
              type="button"
              disabled={loading || !participants.length}
              onClick={() => open(null)}

            >
              <Plus size={14} />
              Record participation
            </AdminButton>
          </PageHeader>
          {error && (
            <p role="alert" className={`${card} p-4 text-sm text-red-600`}>
              {error}{" "}
              <button type="button" onClick={load} className="underline">
                Retry
              </button>
            </p>
          )}
          <AdminTabs label="Certificate management views" value={view} onChange={setView} items={[
            { id: "pending", label: "Attendance review", count: loading ? "-" : pending.length },
            { id: "issued", label: "Issued certificates", count: loading ? "-" : issued.length },
          ]} />
          {loading ? (
            <p role="status" className="p-8 text-sm text-zinc-500">
              Loading records...
            </p>
          ) : view === "pending" ? (
            <section className="space-y-3">
              {!pending.length && (
                <p className={`${card} p-8 text-center text-sm text-zinc-500`}>
                  No participation records waiting for review.
                </p>
              )}
              {pending.map((record) => (
                <article
                  key={record._id}
                  data-attendance={record._id}
                  className={`${card} flex flex-wrap items-center justify-between gap-4 p-5`}
                >
                  <div>
                    <h2 className="admin-section-title text-sm font-semibold">{record.title}</h2>
                    <p className="mt-2 text-xs text-zinc-500">
                      {record.studentName} | {record.date}
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-400">
                      Recorded participation - awaiting confirmation
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => open(record)}
                    className={button}
                  >
                    <BadgeCheck size={14} />
                    Confirm participation
                  </button>
                </article>
              ))}
            </section>
          ) : (
            <section className="space-y-3">
              {!issued.length && (
                <p className={`${card} p-8 text-center text-sm text-zinc-500`}>
                  No certificates issued yet.
                </p>
              )}
              {issued.map((certificate) => (
                <article
                  key={certificate._id}
                  className={`${card} flex flex-wrap items-center justify-between gap-3 p-5`}
                >
                  <div>
                    <h2 className="admin-section-title text-sm font-semibold">
                      {certificate.title}
                    </h2>
                    <p className="mt-2 text-xs text-zinc-500">
                      {certificate.recipientName} | {certificate.activityType} |{" "}
                      {certificate.participationDate}
                    </p>
                    <p className="mt-1 text-[10px] text-zinc-400">
                      {certificate.certificateNumber}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(certificate)}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-xs dark:border-zinc-700"
                  >
                    View certificate
                  </button>
                </article>
              ))}
            </section>
          )}
          <Link
            to="/admin/events"
            className="inline-block text-xs font-medium text-[#009639]"
          >
            Open event calendar
          </Link>
          {editor && (
            <FeedDialog
              title="Confirm participation"
              busy={saving}
              onClose={() => setEditor(null)}
            >
              <form onSubmit={submit}>
                <fieldset disabled={saving} className="space-y-4">
                  <p className="text-xs leading-6 text-zinc-500">
                    Confirmation creates the student's digital certificate and
                    stores it in their portfolio.
                  </p>
                  {editor._id ? (
                    <p className="rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-800">
                      {editor.studentName} | {editor.title} | {editor.date}
                    </p>
                  ) : (
                    <>
                      <label className="block text-xs font-medium">
                        Student *
                        <select
                          required
                          value={form.studentAuthId}
                          onChange={(event) =>
                            setForm({
                              ...form,
                              studentAuthId: event.target.value,
                            })
                          }
                          className={input}
                        >
                          {participants.map((person) => (
                            <option key={person.authId} value={person.authId}>
                              {person.name} | {person.program || person.email}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-xs font-medium">
                        Scheduled activity (optional)
                        <select
                          value={form.eventId}
                          onChange={(event) => {
                            const scheduled = events.find(
                              (item) => item._id === event.target.value,
                            );
                            setForm({
                              ...form,
                              eventId: event.target.value,
                              type: scheduled?.activityType || "event",
                              organizer: scheduled?.organizer || "SielAlumni",
                              title: scheduled?.title || "",
                              date: scheduled
                                ? new Date(
                                    scheduled.startAt,
                                  ).toLocaleDateString("en-CA", {
                                    timeZone: "Asia/Manila",
                                  })
                                : today(),
                            });
                          }}
                          className={input}
                        >
                          <option value="">Enter an activity manually</option>
                          {events.map((item) => (
                            <option key={item._id} value={item._id}>
                              {item.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-xs font-medium">
                        Activity title *
                        <input
                          required
                          maxLength={300}
                          readOnly={!!form.eventId}
                          value={form.title}
                          onChange={(event) =>
                            setForm({ ...form, title: event.target.value })
                          }
                          className={input}
                        />
                      </label>
                      <label className="block text-xs font-medium">
                        Participation date *
                        <input
                          required
                          type="date"
                          max={today()}
                          readOnly={!!form.eventId}
                          value={form.date}
                          onChange={(event) =>
                            setForm({ ...form, date: event.target.value })
                          }
                          className={input}
                        />
                      </label>
                    </>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-xs font-medium">
                      Activity type
                      <select
                        value={form.type}
                        onChange={(event) =>
                          setForm({ ...form, type: event.target.value })
                        }
                        className={input}
                      >
                        <option value="event">Event</option>
                        <option value="training">Training</option>
                        <option value="seminar">Seminar</option>
                      </select>
                    </label>
                    <label className="block text-xs font-medium">
                      Organizer *
                      <input
                        required
                        maxLength={200}
                        value={form.organizer}
                        onChange={(event) =>
                          setForm({ ...form, organizer: event.target.value })
                        }
                        className={input}
                      />
                    </label>
                  </div>
                  <label className="flex items-start gap-2 text-xs leading-6">
                    <input
                      required
                      type="checkbox"
                      checked={form.completed}
                      onChange={(event) =>
                        setForm({ ...form, completed: event.target.checked })
                      }
                      className="mt-1 accent-[#009639]"
                    />
                    I confirm that this student's participation is complete.
                  </label>
                  {saveError && (
                    <p role="alert" className="text-xs text-red-600">
                      {saveError}
                    </p>
                  )}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditor(null)}
                      className="rounded-lg px-4 py-2 text-xs"
                    >
                      Cancel
                    </button>
                    <button type="submit" className={button}>
                      {saving ? "Confirming..." : "Confirm & issue certificate"}
                    </button>
                  </div>
                </fieldset>
              </form>
            </FeedDialog>
          )}
          {selected && (
            <CertificatePreview
              certificate={selected}
              onClose={() => setSelected(null)}
            />
          )}
        </main>
      </div>
    </div>
  );
}
