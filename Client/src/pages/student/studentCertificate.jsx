import { useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, Search, ArrowUpRight } from "lucide-react";
import useDevelopment from "../../hooks/useDevelopment";
import DevelopmentShell, {
  DevelopmentStatus,
} from "../../components/student/DevelopmentShell";
import CertificatePreview from "../../components/student/CertificatePreview";

const card =
  "rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900";
const date = (value) =>
  new Date(value).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
export default function StudentCertificates() {
  const state = useDevelopment();
  const certificates = state.data?.digitalCertificates || [];
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [selected, setSelected] = useState(null);
  const filtered = certificates.filter(
    (certificate) =>
      (type === "all" || certificate.activityType === type) &&
      `${certificate.title} ${certificate.organizer} ${certificate.certificateNumber}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  return (
    <DevelopmentShell title="Certificate">
      <main className="mx-auto max-w-6xl space-y-5 p-3 sm:p-6">
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
          <div>
            <h1>Digital certificates</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              Certificates from your confirmed event, training, and seminar
              participation.
            </p>
          </div>
          <Link
            to="/student/portfolio"
            className="inline-flex min-h-10 items-center gap-2 self-start rounded-lg border border-zinc-300 bg-white px-4 text-xs font-semibold dark:border-zinc-700 dark:bg-zinc-900"
          >
            View portfolio
            <ArrowUpRight size={14} />
          </Link>
        </header>
        <DevelopmentStatus state={state} />
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_270px]">
          <section className="min-w-0 space-y-4">
            <div className={`${card} flex flex-wrap gap-3 p-4`}>
              <label className="relative min-w-0 flex-1 basis-48">
                <span className="sr-only">Search certificates</span>
                <Search
                  size={15}
                  className="absolute left-3 top-3 text-zinc-400"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search activity, organizer, or certificate ID"
                  className="h-10 w-full rounded-lg border border-zinc-200 pl-9 pr-3 text-xs outline-none focus:border-[#009639] dark:border-zinc-700 dark:bg-zinc-900"
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
            {!state.loading && state.data && (
              <>
                <p role="status" className="px-1 text-[11px] text-zinc-500">
                  {filtered.length}{" "}
                  {filtered.length === 1 ? "certificate" : "certificates"}
                </p>
                {!filtered.length && (
                  <section className={`${card} p-10 text-center`}>
                    <BadgeCheck size={30} className="mx-auto text-zinc-400" />
                    <h2 className="mt-3">
                      {certificates.length
                        ? "No matching certificates"
                        : "No certificates issued yet"}
                    </h2>
                    <p className="mx-auto mt-2 max-w-sm text-xs leading-6 text-zinc-500">
                      {certificates.length
                        ? "Try another activity type or search term."
                        : "After an administrator confirms your participation, your certificate will appear here automatically."}
                    </p>
                    {certificates.length ? (
                      <button
                        type="button"
                        onClick={() => {
                          setType("all");
                          setQuery("");
                        }}
                        className="mt-4 text-xs font-semibold text-[#009639]"
                      >
                        Clear filters
                      </button>
                    ) : (
                      <Link
                        to="/student/journey"
                        className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#009639]"
                      >
                        View participation records
                        <ArrowUpRight size={13} />
                      </Link>
                    )}
                  </section>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  {filtered.map((certificate) => (
                    <article
                      key={certificate._id}
                      data-certificate={certificate._id}
                      className={`${card} flex flex-col p-5`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <BadgeCheck size={23} className="text-[#009639]" />
                        <span className="rounded-md bg-zinc-100 px-2 py-1 text-[10px] font-medium capitalize text-zinc-500 dark:bg-zinc-800">
                          {certificate.activityType}
                        </span>
                      </div>
                      <h2 className="mt-4 break-words">{certificate.title}</h2>
                      <p className="mt-2 text-xs leading-6 text-zinc-500">
                        {certificate.organizer}
                      </p>
                      <p className="mt-1 text-[11px] text-zinc-500">
                        Participated{" "}
                        {date(
                          certificate.participationDate + "T00:00:00+08:00",
                        )}
                      </p>
                      <p className="mt-3 text-[10px] text-zinc-400">
                        {certificate.certificateNumber}
                      </p>
                      <div className="mt-auto flex items-center justify-between gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                        <span className="text-[10px] text-[#007a2e] dark:text-emerald-300">
                          Participation confirmed
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelected(certificate)}
                          className="min-h-10 rounded-lg border border-zinc-200 px-3 text-xs font-semibold dark:border-zinc-700"
                        >
                          View certificate
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>
          <aside className="space-y-4">
            <section className={`${card} p-5`}>
              <h2>Your certificate collection</h2>
              <p className="mt-3 text-2xl font-semibold">
                {state.loading || !state.data ? "-" : certificates.length}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">
                Issued certificates stored in your portfolio
              </p>
            </section>
            <section className={`${card} p-5`}>
              <h2>How certificates are issued</h2>
              <ol className="mt-4 space-y-4 text-xs leading-6 text-zinc-500">
                <li>1. Complete an event, training, or seminar.</li>
                <li>2. An administrator confirms your participation.</li>
                <li>
                  3. The system generates and stores your certificate
                  automatically.
                </li>
              </ol>
            </section>
          </aside>
        </div>
        {selected && (
          <CertificatePreview
            certificate={selected}
            onClose={() => setSelected(null)}
          />
        )}
      </main>
    </DevelopmentShell>
  );
}
