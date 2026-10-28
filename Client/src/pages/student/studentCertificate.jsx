import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, Search, ArrowUpRight, Award, CalendarDays, Building2, Eye, GraduationCap, Presentation, Ticket, Check } from "lucide-react";
import useDevelopment from "../../hooks/useDevelopment";
import { useAuth } from "../../context/useAuth";
import DevelopmentShell, { DevelopmentStatus } from "../../components/student/DevelopmentShell";
import CertificatePreview from "../../components/student/CertificatePreview";
import StatCard from "../../components/ui/stat-card";
import DataPagination from "../../components/ui/data-pagination";
import PageTitle from "../../components/ui/PageTitle";
import "./studentCertificate.css";

const ACTIVITIES = [["event", "Events", Ticket], ["training", "Training", GraduationCap], ["seminar", "Seminars", Presentation]];
const PAGE_SIZE = 12;
const date = (value) => new Date(value).toLocaleDateString("en-PH", {
  timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric",
});

export default function StudentCertificates() {
  const { user } = useAuth();
  const state = useDevelopment();
  const certificates = state.data?.digitalCertificates || [];
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const collection = useRef(null);
  const filtered = certificates.filter((certificate) =>
    (type === "all" || certificate.activityType === type) &&
    `${certificate.title} ${certificate.organizer} ${certificate.certificateNumber}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const hasFilters = type !== "all" || !!query;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleCertificates = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const clearFilters = () => { setType("all"); setQuery(""); setPage(1); };
  const changePage = (nextPage) => {
    setPage(Math.max(1, Math.min(nextPage, totalPages)));
    collection.current?.scrollIntoView({ block: "start", behavior: "instant" });
  };
  const basePath = user?.role === "alumni" ? "/alumni" : "/student";
  const ready = !state.loading && !!state.data;

  return <DevelopmentShell title="Certificate">
    <main className="certificate-page workspace-page mx-auto max-w-7xl space-y-6 p-3 sm:p-6">
      <header className="workspace-page-header flex flex-col gap-4 border-b border-zinc-200 pb-5 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
        <div className="min-w-0">
          <div className="min-w-0"><PageTitle icon={Award}>Digital certificates</PageTitle>
            <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">Your achievements from confirmed events, training, and seminars, all in one place.</p>
          </div>
        </div>
        <Link to={`${basePath}/portfolio`} className="certificate-button self-start sm:self-center">View portfolio<ArrowUpRight size={15} /></Link>
      </header>
      <DevelopmentStatus state={state} />
      <dl aria-label="Certificate collection summary" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Total certificates" value={ready ? certificates.length : "—"} note="In your collection" icon={Award} />
        {ACTIVITIES.map(([key, label, icon]) => <StatCard key={key} label={label} value={ready ? certificates.filter(item => item.activityType === key).length : "—"} note="Confirmed participation" icon={icon} />)}
      </dl>
      <div className="certificate-layout">
        <section ref={collection} className="min-w-0 space-y-4 scroll-mt-24" aria-label="Your certificates">
          <div className="certificate-panel certificate-filters">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search certificates</span>
              <Search size={17} className="pointer-events-none absolute left-3 top-3.5 text-zinc-400" />
              <input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="Search activity, organizer, or certificate ID" className="certificate-field certificate-search" />
            </label>
            <label className="certificate-type"><span className="sr-only">Activity type</span>
              <select value={type} onChange={event => { setType(event.target.value); setPage(1); }} className="certificate-field">
                <option value="all">All activities</option>
                {ACTIVITIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </label>
          </div>
          {ready && <>
            <div className="flex items-center justify-between gap-3 px-1">
              <p role="status" className="text-xs text-zinc-500 dark:text-zinc-400">{filtered.length} {filtered.length === 1 ? "certificate" : "certificates"}{hasFilters ? ` of ${certificates.length}` : " in your collection"}</p>
              {hasFilters && <button type="button" onClick={clearFilters} className="certificate-clear">Clear filters</button>}
            </div>
            {!filtered.length && <section className="certificate-panel certificate-empty">
              <span className="certificate-empty-icon"><Award size={30} /></span>
              <h2>{certificates.length ? "No matching certificates" : "No certificates issued yet"}</h2>
              <p>{certificates.length ? "Try a different search or activity type to find your certificate." : "Once an administrator confirms your participation in an event, training, or seminar, your certificate will appear here automatically."}</p>
              {certificates.length ? <button type="button" onClick={clearFilters} className="certificate-button certificate-primary">Clear filters</button> : <Link to={user?.role === "alumni" ? "/alumni/events" : "/student/journey"} className="certificate-button certificate-primary">{user?.role === "alumni" ? "Browse activities" : "View participation records"}<ArrowUpRight size={15} /></Link>}
            </section>}
            <div className="certificate-grid">
              {visibleCertificates.map(certificate => <article key={certificate._id} data-certificate={certificate._id} className="certificate-panel certificate-item">
                <div className="certificate-item-top">
                  <span className="certificate-award-icon" aria-hidden="true"><Award size={23} /></span>
                  <div className="certificate-title-group"><p className="certificate-eyebrow">Digital certificate</p><h2>{certificate.title}</h2></div>
                </div>
                <div className="certificate-item-body">
                  <div className="certificate-status-row"><span className="certificate-activity">{certificate.activityType}</span><span className="certificate-confirmed"><BadgeCheck size={14} />Participation confirmed</span></div>
                  <dl className="certificate-details">
                    <div><dt><Building2 size={15} />Organizer</dt><dd>{certificate.organizer || "Organizer not specified"}</dd></div>
                    <div><dt><CalendarDays size={15} />Participation date</dt><dd>{date(certificate.participationDate + "T00:00:00+08:00")}</dd></div>
                  </dl>
                  <div className="certificate-id"><span>Certificate ID</span><p>{certificate.certificateNumber}</p></div>
                </div>
                <footer className="certificate-item-footer"><button type="button" onClick={() => setSelected(certificate)} className="certificate-button certificate-primary w-full"><Eye size={16} />View certificate<ArrowUpRight size={14} /></button></footer>
              </article>)}
            </div>
            {filtered.length > 0 && <nav aria-label="Certificate pagination" className="certificate-panel overflow-hidden">
              <DataPagination page={currentPage} totalPages={totalPages} onPageChange={changePage} perPage={PAGE_SIZE} showPerPage={false} totalItems={filtered.length} itemLabel="certificates" />
            </nav>}
          </>}
        </section>
        <aside className="certificate-panel certificate-guide">
          <span className="certificate-guide-icon"><BadgeCheck size={21} /></span>
          <h2>How certificates are issued</h2>
          <p className="certificate-guide-intro">From participation to a certificate in your collection.</p>
          <ol>
            {[["Take part", "Complete an event, training, or seminar."], ["Get confirmed", "An administrator confirms your participation."], ["Receive your certificate", "Your digital certificate is generated and saved automatically."]].map(([title, description], index) => <li key={title}><span className="certificate-step">{index + 1}</span><div><h3>{title}</h3><p>{description}</p></div></li>)}
          </ol>
          <div className="certificate-guide-note"><Check size={16} /><p>Open a certificate to preview, download, or print a copy.</p></div>
        </aside>
      </div>
      {selected && <CertificatePreview certificate={selected} onClose={() => setSelected(null)} />}
    </main>
  </DevelopmentShell>;
}
