import ContentSkeleton from "../../components/ui/Skeleton";
import GraduationCapLoader from "../../components/ui/GraduationCapLoader";
import { AdminTabs, AdminButton } from "../../components/admin/AdminUI";
import PageHeader from "../../components/ui/PageHeader";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, BadgeCheck, Search, Award, Users, Clock, Eye, Download } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import AdminSidebar from "../../layout/sidebar/admin/adminSidebar";
import AdminTopbar from "../../layout/topbar/alumni/adminTopbar";
import { FeedDialog } from "../../components/feed/FeedComposer";
import CertificatePreview from "../../components/student/CertificatePreview";
import DataPagination from "../../components/ui/data-pagination";
import "./adminCertificates.css";
import api from "../../utils/axios";

const card =
  "admin-panel";
const button = "admin-button admin-button-primary";
const input =
  "mt-2 w-full rounded-lg border border-zinc-200 bg-white p-3 text-sm outline-none focus:border-brand dark:border-zinc-700 dark:bg-zinc-900";
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
  const [query, setQuery] = useState("");
  const [activity, setActivity] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [checked, setChecked] = useState([]);
  const [recipientIds, setRecipientIds] = useState([]);
  const [recipientQuery, setRecipientQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [progress, setProgress] = useState(0);
  const posting = useRef(false);
  const records = view === "pending" ? pending : issued;
  const activities = [...new Set(records.map(record => record.title))].sort();
  const filtered = records.filter(record => (!activity || record.title === activity) &&
    [record.studentName, record.studentEmail, record.recipientName, record.title, record.certificateNumber, record.date, record.participationDate]
      .join(" ").toLowerCase().includes(query.trim().toLowerCase()));
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);
  const matchingPeople = participants.filter(person => [person.name, person.program, person.email].join(" ").toLowerCase().includes(recipientQuery.trim().toLowerCase()));
  const toggle = (id, values, setter) => setter(values.includes(id) ? values.filter(value => value !== id) : [...values, id]);
  const changeView = value => { setView(value); setPage(1); setActivity(""); setChecked([]); };
  const exportCsv = () => {
    const columns = ["Student", "Activity", "Type", "Participation date", "Certificate number"];
    const rows = filtered.map(record => [record.recipientName, record.title, record.activityType, record.participationDate, record.certificateNumber]);
    const csv = [columns, ...rows].map(row => row.map(value => '"' + String(value || "").replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '\"\"') + '"').join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a"); link.href = url; link.download = "issued-certificates.csv"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
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
    setRecipientIds([]);
    setRecipientQuery("");
    setProgress(0);
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
      const targets = editor.bulk ? pending.filter(record => checked.includes(record._id)) : editor._id ? [editor] : recipientIds.map(authId => ({ authId }));
      if (!targets.length) { setSaveError("Select at least one student."); return; }
      const failures = [];
      let lastCertificate;
      let done = 0;
      // Keep requests bounded so a large selection does not overwhelm the API.
      for (let offset = 0; offset < targets.length; offset += 5) {
        await Promise.all(targets.slice(offset, offset + 5).map(async target => {
          try {
            const response = await api.post(target._id ? `/certificates/attendance/${target._id}/confirm` : "/certificates/participations",
              { ...form, studentAuthId: target.authId, type: editor.bulk ? target.activityType || form.type : form.type });
            lastCertificate = response.data.data;
          } catch (err) {
            failures.push({ target, message: err.response?.data?.message || "Unable to issue certificate. Please retry." });
          } finally { done++; setProgress(done); }
        }));
      }
      const successful = targets.length - failures.length;
      setNotice(`${successful} of ${targets.length} certificates issued.${failures.length ? ` ${failures.length} need attention. Retry the remaining students.` : ""}`);
      if (failures.length) {
        setSaveError(failures.map(({ target, message }) => `${target.studentName || participants.find(person => person.authId === target.authId)?.name || "Student"}: ${message}`).join("\n"));
        if (editor.bulk) setChecked(failures.map(({ target }) => target._id));
        else if (!editor._id) setRecipientIds(failures.map(({ target }) => target.authId));
      } else {
        setEditor(null); setChecked([]);
        if (targets.length === 1 && !editor.bulk) setSelected(lastCertificate);
      }
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
          <PageHeader title="Certificates" description="Review attendance and issue certificates to students, individually or in batches.">
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
          <div className="cert-admin-summary">
            {[ [Clock, "Awaiting review", pending.length, "Participation records to confirm"], [Award, "Certificates issued", issued.length, "Available in student portfolios"], [Users, "Recipients", new Set(issued.map(item => item.studentAuthId)).size, "Students with issued certificates"] ].map(([Icon, label, value, hint]) => <div className="admin-panel cert-admin-stat" key={label}><span className="cert-admin-stat-icon"><Icon size={21} /></span><div><p>{label}</p><strong>{loading ? "-" : value.toLocaleString()}</strong><small>{hint}</small></div></div>)}
          </div>
          {notice && <p role="status" className="cert-admin-notice">{notice}</p>}
          <AdminTabs label="Certificate management views" value={view} onChange={changeView} items={[
            { id: "pending", label: "Attendance review", count: loading ? "-" : pending.length },
            { id: "issued", label: "Issued certificates", count: loading ? "-" : issued.length },
          ]} />
          <section className="admin-panel cert-admin-workspace" aria-label="Certificate records">
            <div className="cert-admin-toolbar">
              <label className="cert-admin-search"><Search size={17} aria-hidden="true" /><input type="search" aria-label="Search certificate records" placeholder="Search student, activity, or certificate ID" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} /></label>
              <select aria-label="Filter by activity" value={activity} onChange={event => { setActivity(event.target.value); setPage(1); }}><option value="">All activities</option>{activities.map(title => <option key={title}>{title}</option>)}</select>
              {view === "issued" && <AdminButton variant="secondary" disabled={!filtered.length || loading} onClick={exportCsv}><Download size={15} />Export CSV</AdminButton>}
            </div>
            <div className="cert-admin-list-heading"><div><h2>{view === "pending" ? "Attendance review" : "Issued certificates"}</h2><p>{loading ? "Loading records..." : `${filtered.length.toLocaleString()} records${query || activity ? ` of ${records.length.toLocaleString()}` : ""}`} | {view === "pending" ? "Select students to issue certificates together." : "Find and view any student's certificate."}</p></div>{(query || activity) && <button className="text-xs text-brand" onClick={() => { setQuery(""); setActivity(""); setPage(1); }}>Clear filters</button>}</div>
            {view === "pending" && checked.length > 0 && <div className="cert-admin-selection"><span><strong>{checked.length}</strong> selected across pages</span><div><button type="button" onClick={() => setChecked([])}>Clear selection</button><AdminButton disabled={loading} onClick={() => open({ bulk: true })}><BadgeCheck size={15} />Issue selected</AdminButton></div></div>}
            {loading ? <ContentSkeleton variant="table" count={5} label="Loading records..." /> : !filtered.length ? <div className="cert-admin-empty"><Award size={32} /><h3>{query || activity ? "No matching records" : view === "pending" ? "All caught up" : "No certificates issued yet"}</h3><p>{query || activity ? "Try another student name, activity, or certificate ID." : view === "pending" ? "No participation records waiting for review." : "Record participation or confirm attendance to issue certificates."}</p></div> : <>
              <div className="cert-admin-table-scroll"><table className="cert-admin-table"><caption className="sr-only">{view === "pending" ? "Attendance waiting for confirmation" : "Issued certificates"}</caption><thead><tr>
                {view === "pending" && <th className="cert-admin-check"><input type="checkbox" aria-label="Select all on this page" checked={visible.length > 0 && visible.every(record => checked.includes(record._id))} ref={node => { if (node) node.indeterminate = visible.some(record => checked.includes(record._id)) && !visible.every(record => checked.includes(record._id)); }} onChange={event => setChecked(event.target.checked ? [...new Set([...checked, ...visible.map(record => record._id)])] : checked.filter(id => !visible.some(record => record._id === id)))} /></th>}
                <th>Student</th><th>Activity</th><th>Date</th><th>{view === "pending" ? "Status" : "Certificate ID"}</th><th><span className="sr-only">Actions</span></th>
              </tr></thead><tbody>{visible.map(record => <tr key={record._id} data-attendance={view === "pending" ? record._id : undefined} data-certificate={view === "issued" ? record._id : undefined} className={checked.includes(record._id) ? "is-selected" : ""}>
                {view === "pending" && <td className="cert-admin-check"><input type="checkbox" aria-label={`Select ${record.studentName} for ${record.title}`} checked={checked.includes(record._id)} onChange={() => toggle(record._id, checked, setChecked)} /></td>}
                <td><strong>{record.studentName || record.recipientName}</strong>{record.studentEmail && <small>{record.studentEmail}</small>}</td>
                <td><strong>{record.title}</strong><small className="capitalize">{record.activityType || "event"}</small></td><td className="cert-admin-date">{record.date || record.participationDate}</td>
                <td>{view === "pending" ? <span className="cert-admin-status">Awaiting review</span> : <span className="cert-admin-number">{record.certificateNumber}</span>}</td>
                <td><button type="button" className="cert-admin-row-action" onClick={() => view === "pending" ? open(record) : setSelected(record)}>{view === "pending" ? <BadgeCheck size={15} /> : <Eye size={15} />}{view === "pending" ? "Confirm participation" : "View certificate"}</button></td>
              </tr>)}</tbody></table></div>
              <DataPagination page={currentPage} totalPages={totalPages} onPageChange={setPage} perPage={perPage} onPerPageChange={value => { setPerPage(value); setPage(1); }} perPageOptions={[20, 50, 100]} totalItems={filtered.length} itemLabel="records" />
            </>}
          </section>
          <Link
            to="/admin/events"
            className="inline-block text-xs font-medium text-brand"
          >
            Open event calendar
          </Link>
          {editor && (
            <FeedDialog
              title={editor.bulk ? `Issue certificates to ${checked.length} students` : editor._id ? "Confirm participation" : "Record participation"}
              busy={saving}
              onClose={() => setEditor(null)}
            >
              <form onSubmit={submit}>
                <fieldset disabled={saving} className="space-y-4">
                  <p className="text-xs leading-6 text-zinc-500">
                    Confirmation creates the student's digital certificate and
                    stores it in their portfolio.
                  </p>
                  {editor.bulk ? <div className="rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-800"><strong>{checked.length} attendance records selected</strong><p className="mt-2 text-xs text-zinc-500">Each student keeps their recorded activity, date, and activity type. The organizer below applies to all selected records.</p><ul className="cert-admin-review-list">{pending.filter(record => checked.includes(record._id)).map(record => <li key={record._id}>{record.studentName} | {record.title} | {record.date}</li>)}</ul></div> : editor._id ? (
                    <p className="rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-800">
                      {editor.studentName} | {editor.title} | {editor.date}
                    </p>
                  ) : (
                    <>
                      <div className="cert-admin-recipients"><label className="block text-xs font-medium">Students *<input type="search" className={input} value={recipientQuery} onChange={event => setRecipientQuery(event.target.value)} placeholder="Search name, program, or email" /></label><div className="cert-admin-recipient-heading"><span>{recipientIds.length} selected</span><button type="button" className="text-brand" onClick={() => setRecipientIds([...new Set([...recipientIds, ...matchingPeople.map(person => person.authId)])])}>Select matching ({matchingPeople.length})</button><button type="button" onClick={() => setRecipientIds([])}>Clear</button></div><div className="cert-admin-recipient-list">{matchingPeople.map(person => <label key={person.authId}><input type="checkbox" checked={recipientIds.includes(person.authId)} onChange={() => toggle(person.authId, recipientIds, setRecipientIds)} /><span><strong>{person.name}</strong><small>{person.program || person.email}</small></span></label>)}{!matchingPeople.length && <p className="p-3 text-xs text-zinc-500">No matching students.</p>}</div></div>
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
                        disabled={editor.bulk}
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
                      className="mt-1 accent-brand"
                    />
                    I confirm that participation is complete for all selected students.
                  </label>
                  {saving && <GraduationCapLoader fullScreen={false} compact className="graduation-cap-loader--inline" label={`Issuing certificates (${progress} processed)`} />}
                  {saveError && (
                    <p role="alert" className="whitespace-pre-line text-xs text-red-600">
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
                    <button type="submit" disabled={!editor._id && !editor.bulk && !recipientIds.length} className={button}>
                      {saving ? "Confirming..." : editor.bulk || recipientIds.length > 1 ? "Confirm & issue certificates" : "Confirm & issue certificate"}
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
