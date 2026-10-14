import { createElement, useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Handshake,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { useAuth } from "../../context/useAuth";
import api from "../../utils/axios";
import ProfileAvatar from "../profile/ProfileAvatar";
import DataPagination from "../ui/data-pagination";
import { FeedDialog } from "../feed/FeedComposer";
import {
  ReferralApplicants,
  ReferralDetails,
  ReferralEditor,
} from "./ReferralDialogs";
import {
  REFERRAL_TYPES,
  applicationStatus,
  panel,
  primaryButton,
  referralDate,
  referralType,
  secondaryButton,
} from "./referralUi";

export default function ReferralBoard({ embedded = false }) {
  const { user } = useAuth();
  const authId = String(user?.authId || user?._id || "");
  const canPost = ["alumni", "admin"].includes(user?.role);
  const canApplyRole = ["student", "alumni"].includes(user?.role);
  const Heading = embedded ? "h2" : "h1";
  const [referrals, setReferrals] = useState([]);
  const [applications, setApplications] = useState([]);
  const [applicationsReady, setApplicationsReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [view, setView] = useState("browse");
  const [type, setType] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [editor, setEditor] = useState(null);
  const [details, setDetails] = useState(null);
  const [applicantsReferral, setApplicantsReferral] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const generation = useRef(0);
  const pending = useRef(false);
  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setError("");
    const results = await Promise.allSettled([
      api.get("/referrals"),
      ...(canApplyRole ? [api.get("/referrals/applications/me")] : []),
    ]);
    if (request !== generation.current) return;
    if (results[0].status === "fulfilled")
      setReferrals(results[0].value.data.data || []);
    if (results[1]?.status === "fulfilled") {
      setApplications(results[1].value.data.data || []);
      setApplicationsReady(true);
    } else setApplicationsReady(!canApplyRole);
    setError(
      results.some((result) => result.status === "rejected")
        ? "Some opportunities or applications could not be loaded. Please retry."
        : "",
    );
    setLoading(false);
  }, [canApplyRole]);
  useEffect(() => {
    void load();
    return () => {
      ++generation.current;
    };
  }, [load, authId]);
  const isMine = (referral) => String(referral.authorAuthId) === authId;
  const canManage = (referral) =>
    user?.role === "admin" || (canPost && isMine(referral));
  const applicationsByReferral = new Map(
    applications.map((application) => [
      String(application.referralId),
      application,
    ]),
  );
  const ownReferrals = referrals.filter(isMine);
  const baseRows =
    view === "applied"
      ? applications.map((application) => {
          const referral = referrals.find(
            (item) => String(item._id) === String(application.referralId),
          );
          return {
            ...referral,
            _id: String(application.referralId),
            title:
              application.referralTitle ||
              referral?.title ||
              "Removed opportunity",
            organization:
              application.organization || referral?.organization || "",
            type: application.type || referral?.type || "",
            application,
            available: !!referral,
          };
        })
      : referrals.filter(
          (referral) =>
            view !== "mine" ||
            (user?.role === "admin" ? canManage(referral) : isMine(referral)),
        );
  const filtered = baseRows
    .filter(
      (referral) =>
        (type === "all" || referral.type === type) &&
        [
          referral.title,
          referral.organization,
          referral.description,
          referral.authorName,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
        ),
    )
    .sort(
      (a, b) =>
        ((new Date(a.application?.createdAt || a.createdAt).getTime() || 0) -
          (new Date(b.application?.createdAt || b.createdAt).getTime() || 0)) *
        (sort === "newest" ? -1 : 1),
    );
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage,
  );
  const setFilter = (value) => {
    setType(value);
    setPage(1);
  };
  const tabs = [
    { id: "browse", label: "All opportunities" },
    ...(canPost
      ? [
          {
            id: "mine",
            label: user?.role === "admin" ? "Manage referrals" : "My referrals",
          },
        ]
      : []),
    ...(canApplyRole
      ? [
          {
            id: "applied",
            label: "My applications",
            count: applications.length,
          },
        ]
      : []),
  ];
  const openDetails = (referral, apply = false) =>
    setDetails({ referral, apply });
  const onSaved = (referral, edited = false) => {
    setReferrals((previous) =>
      previous.some((item) => item._id === referral._id)
        ? previous.map((item) => (item._id === referral._id ? referral : item))
        : [referral, ...previous],
    );
    setMessage(
      edited
        ? "Referral updated."
        : "Referral published. The community can now explore this opportunity.",
    );
  };
  const remove = async () => {
    if (pending.current) return;
    pending.current = true;
    setDeletingBusy(true);
    setDeleteError("");
    try {
      await api.delete(`/referrals/${deleting._id}`);
      setReferrals((previous) =>
        previous.filter((item) => item._id !== deleting._id),
      );
      setDeleting(null);
      setMessage("Referral removed.");
    } catch (err) {
      setDeleteError(
        err.response?.data?.message ||
          "Unable to delete this referral. Please try again.",
      );
    } finally {
      pending.current = false;
      setDeletingBusy(false);
    }
  };
  const statusBadge = (application) => {
    const status = applicationStatus(application.status);
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold ${status.style}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {status.label}
      </span>
    );
  };

  return (
    <section
      aria-label="Alumni referrals"
      className="space-y-5 text-zinc-900 dark:text-zinc-100"
    >
      <header className={`${panel} relative overflow-hidden p-6 sm:p-8`}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full bg-emerald-50 dark:bg-emerald-950/30"
        />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-2xl">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#007a2e] dark:bg-emerald-950 dark:text-emerald-300">
              <Handshake size={14} />
              The alumni advantage
            </p>
            <Heading className="text-2xl font-semibold tracking-tight sm:!text-3xl">
              {canPost
                ? "Open a door. Make a difference."
                : "Your next opportunity starts here."}
            </Heading>
            <p className="mt-3 max-w-xl text-sm leading-7 text-zinc-500 dark:text-zinc-400">
              {canPost
                ? "Connect students with jobs, internships, and scholarships. A referral from you could be their next big step."
                : "Discover jobs, internships, and scholarships shared by alumni. Apply directly and follow your progress in one place."}
            </p>
          </div>
          {canPost && (
            <button
              type="button"
              onClick={() => setEditor({})}
              className={`${primaryButton} !min-h-12 !px-5`}
            >
              <Plus size={17} />
              Share an opportunity
            </button>
          )}
        </div>
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        {REFERRAL_TYPES.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={type === item.key}
            onClick={() => setFilter(type === item.key ? "all" : item.key)}
            className={`${panel} group flex min-w-0 items-center gap-4 p-4 text-left transition hover:border-[#009639]/40 ${type === item.key ? "!border-[#009639] ring-1 ring-[#009639]/10" : ""}`}
          >
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${item.style}`}
            >
              {createElement(item.icon, { size: 23 })}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2 text-sm font-semibold">
                {item.label}
                <span className="text-lg">
                  {loading
                    ? "–"
                    : referrals.filter((referral) => referral.type === item.key)
                        .length}
                </span>
              </span>
              <span className="mt-1 block text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
                {item.description}
              </span>
            </span>
          </button>
        ))}
      </div>
      {message && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
        >
          <CheckCircle2 size={18} />
          {message}
        </p>
      )}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0 space-y-4">
          <div className={`${panel} p-4`}>
            <nav
              aria-label="Referral views"
              className="flex gap-5 overflow-x-auto border-b border-zinc-100 dark:border-zinc-800"
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={view === tab.id}
                  onClick={() => {
                    setView(tab.id);
                    setPage(1);
                  }}
                  className={`inline-flex shrink-0 items-center gap-2 border-b-2 pb-3 text-xs font-semibold ${view === tab.id ? "border-[#009639] text-[#007a2e] dark:text-emerald-300" : "border-transparent text-zinc-500 dark:text-zinc-400"}`}
                >
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] dark:bg-zinc-800">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
            <div className="mt-4 flex flex-wrap gap-3">
              <div className="relative min-w-0 flex-1 basis-48">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-3 text-zinc-400"
                />
                <input
                  type="search"
                  aria-label="Search referrals"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search a title, organization, or keyword"
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-xs outline-none focus:border-[#009639] dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>
              <select
                aria-label="Sort referrals"
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value);
                  setPage(1);
                }}
                className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-xs text-zinc-600 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
              <button
                type="button"
                aria-label="Refresh referrals"
                title="Refresh referrals"
                onClick={load}
                disabled={loading}
                className={`${secondaryButton} !px-3`}
              >
                <RefreshCw size={15} />
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {[{ key: "all", label: "All types" }, ...REFERRAL_TYPES].map(
                (item) => (
                  <button
                    key={item.key}
                    type="button"
                    aria-pressed={type === item.key}
                    onClick={() => setFilter(item.key)}
                    className={`rounded-lg px-3 py-1.5 text-[11px] font-medium ${type === item.key ? "bg-[#009639]/10 text-[#007a2e] dark:bg-emerald-950 dark:text-emerald-300" : "text-zinc-500 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800"}`}
                  >
                    {item.label}
                  </button>
                ),
              )}
            </div>
          </div>
          {error && (
            <p
              role="alert"
              className={`${panel} p-4 text-sm text-red-600 dark:text-red-400`}
            >
              {error}{" "}
              <button
                type="button"
                onClick={load}
                className="font-semibold underline"
              >
                Retry
              </button>
            </p>
          )}
          {loading ? (
            <div role="status" className="grid gap-4 lg:grid-cols-2">
              <span className="sr-only">Loading referrals…</span>
              {[0, 1, 2, 3].map((index) => (
                <div
                  key={index}
                  className={`${panel} h-60 animate-pulse p-5 motion-reduce:animate-none`}
                >
                  <div className="h-10 w-10 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
                  <div className="mt-5 h-4 w-3/4 rounded bg-zinc-100 dark:bg-zinc-800" />
                  <div className="mt-3 h-3 w-full rounded bg-zinc-100 dark:bg-zinc-800" />
                  <div className="mt-2 h-3 w-2/3 rounded bg-zinc-100 dark:bg-zinc-800" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 px-1">
                <h3 className="text-sm font-semibold">
                  {view === "applied"
                    ? "Your applications"
                    : view === "mine"
                      ? "Referrals you manage"
                      : "Find your next step"}
                </h3>
                <p
                  role="status"
                  className="text-[11px] text-zinc-500 dark:text-zinc-400"
                >
                  {filtered.length}{" "}
                  {view === "applied" ? "applications" : "opportunities"}
                </p>
              </div>
              {!filtered.length && (
                <div className={`${panel} py-12 text-center`}>
                  <Search
                    size={30}
                    className="mx-auto text-zinc-300 dark:text-zinc-600"
                  />
                  <h3 className="mt-4 text-base font-semibold">
                    {view === "applied"
                      ? "Your journey starts with an application"
                      : view === "mine"
                        ? "Share your first opportunity"
                        : "No matching opportunities"}
                  </h3>
                  <p className="mx-auto mt-2 max-w-sm px-4 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
                    {view === "applied"
                      ? "Explore alumni referrals and apply to an opportunity that fits you."
                      : view === "mine"
                        ? "A job, internship, or scholarship could make a difference for a student."
                        : "Try another keyword or category, or check back for new alumni referrals."}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (view === "mine" && canPost) setEditor({});
                      else {
                        setView("browse");
                        setType("all");
                        setQuery("");
                      }
                    }}
                    className={`${secondaryButton} mt-5`}
                  >
                    {view === "mine" && canPost
                      ? "Share an opportunity"
                      : view === "applied"
                        ? "Browse opportunities"
                        : "Clear filters"}
                  </button>
                </div>
              )}
              <div className="grid gap-4 lg:grid-cols-2">
                {paged.map((referral) => {
                  const meta = referralType(referral.type);
                  const application =
                    referral.application ||
                    applicationsByReferral.get(String(referral._id));
                  const manageable = canManage(referral);
                  const eligible =
                    canApplyRole &&
                    !isMine(referral) &&
                    !application &&
                    applicationsReady;
                  return (
                    <article
                      key={referral._id}
                      data-referral-card
                      className={`${panel} flex min-w-0 flex-col overflow-hidden transition hover:border-zinc-300 hover:shadow-sm dark:hover:border-zinc-700`}
                    >
                      <div className={`h-1 ${meta.accent}`} />
                      <div className="flex flex-1 flex-col p-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold ${meta.style}`}
                          >
                            {createElement(meta.icon, { size: 13 })}
                            {meta.singular}
                          </span>
                          {referral.createdAt && (
                            <time
                              dateTime={referral.createdAt}
                              className="text-[10px] text-zinc-400"
                            >
                              {referralDate(referral.createdAt)}
                            </time>
                          )}
                        </div>
                        <h3 className="mt-4 break-words text-base font-semibold leading-6">
                          {referral.title}
                        </h3>
                        <p className="mt-1 break-words text-xs font-medium text-zinc-500 dark:text-zinc-400">
                          {referral.organization || "Alumni community"}
                        </p>
                        <p className="mb-5 mt-3 line-clamp-3 break-words text-xs leading-6 text-zinc-500 dark:text-zinc-400">
                          {referral.description ||
                            (view === "applied"
                              ? "Find updates to this application below."
                              : "View this opportunity and connect with the alumni referrer.")}
                        </p>
                        <div className="mt-auto">
                          {referral.authorName && (
                            <div className="mb-4 flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                                {referral.authorName.charAt(0).toUpperCase()}
                              </span>
                              <span className="min-w-0 break-words">
                                Referred by{" "}
                                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                                  {referral.authorName}
                                </span>
                              </span>
                            </div>
                          )}
                          {application && (
                            <div className="mb-4 flex flex-wrap items-center gap-2">
                              {statusBadge(application)}
                              <p className="text-[10px] text-zinc-400">
                                Applied {referralDate(application.createdAt)}
                              </p>
                            </div>
                          )}
                          <div className="flex flex-wrap gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                            {view !== "applied" || referral.available ? (
                              <button
                                type="button"
                                onClick={() => openDetails(referral)}
                                className={`${secondaryButton} flex-1`}
                              >
                                View details
                                <ChevronRight size={14} />
                              </button>
                            ) : (
                              <p className="text-xs text-zinc-400">
                                This opportunity is no longer listed.
                              </p>
                            )}
                            {eligible && (
                              <button
                                type="button"
                                onClick={() => openDetails(referral, true)}
                                className={`${primaryButton} flex-1`}
                              >
                                Apply directly
                                <ArrowUpRight size={14} />
                              </button>
                            )}
                            {manageable && (
                              <button
                                type="button"
                                onClick={() => setApplicantsReferral(referral)}
                                className={`${primaryButton} flex-1`}
                              >
                                <Users size={14} />
                                Applicants
                              </button>
                            )}
                          </div>
                          {manageable && (
                            <div className="mt-3 flex justify-end gap-4">
                              <button
                                type="button"
                                aria-label={`Edit ${referral.title}`}
                                onClick={() => setEditor({ item: referral })}
                                className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-[#009639] dark:text-zinc-400"
                              >
                                <Pencil size={12} />
                                Edit
                              </button>
                              <button
                                type="button"
                                aria-label={`Delete ${referral.title}`}
                                onClick={() => {
                                  setDeleteError("");
                                  setDeleting(referral);
                                }}
                                className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-red-600 dark:text-zinc-400"
                              >
                                <Trash2 size={12} />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
              {filtered.length > 0 && (
                <div className={`${panel} overflow-hidden`}>
                  <DataPagination
                    page={currentPage}
                    totalPages={totalPages}
                    onPageChange={setPage}
                    perPage={perPage}
                    onPerPageChange={(value) => {
                      setPerPage(value);
                      setPage(1);
                    }}
                    totalItems={filtered.length}
                    itemLabel={
                      view === "applied" ? "applications" : "opportunities"
                    }
                  />
                </div>
              )}
            </>
          )}
        </div>
        <aside className="grid min-w-0 gap-4 sm:grid-cols-2 xl:sticky xl:top-20 xl:grid-cols-1">
          <section className={`${panel} p-5`}>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-50 text-[#009639] dark:bg-emerald-950">
                <ProfileAvatar user={user} />
              </span>
              <div className="min-w-0">
                <h2 className="break-words text-sm font-semibold">
                  {user?.name || "Community member"}
                </h2>
                <p className="mt-1 text-[11px] capitalize text-zinc-500 dark:text-zinc-400">
                  {user?.role} community
                </p>
              </div>
            </div>
            <dl className="mt-5 space-y-3 border-t border-zinc-100 pt-4 text-xs dark:border-zinc-800">
              {canPost && (
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-500 dark:text-zinc-400">
                    Your referrals
                  </dt>
                  <dd className="font-semibold">{ownReferrals.length}</dd>
                </div>
              )}
              {canApplyRole && (
                <>
                  <div className="flex justify-between gap-2">
                    <dt className="text-zinc-500 dark:text-zinc-400">
                      Your applications
                    </dt>
                    <dd className="font-semibold">{applications.length}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-zinc-500 dark:text-zinc-400">
                      Awaiting review
                    </dt>
                    <dd className="font-semibold">
                      {
                        applications.filter((item) => item.status === "pending")
                          .length
                      }
                    </dd>
                  </div>
                </>
              )}
            </dl>
          </section>
          <section className="rounded-2xl bg-[#064d37] p-5 text-white">
            <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
              <Handshake size={22} />
            </span>
            <h2 className="text-base font-semibold">
              {canPost
                ? "One connection can go a long way."
                : "Make your first impression count."}
            </h2>
            <p className="mt-3 text-xs leading-6 text-emerald-100/80">
              {canPost
                ? "Know an opportunity worth sharing? Help a student find a place to learn, work, or grow."
                : "Read the requirements and add a short note about your skills and interests when you apply."}
            </p>
            {canPost ? (
              <button
                type="button"
                onClick={() => setEditor({})}
                className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-emerald-200"
              >
                Share a referral
                <ArrowRight size={15} />
              </button>
            ) : (
              <p className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-emerald-200">
                <CheckCircle2 size={15} />
                Apply right here in the portal
              </p>
            )}
          </section>
          <section className={`${panel} p-5 sm:col-span-2 xl:col-span-1`}>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <ClipboardList size={16} className="text-[#009639]" />
              How it works
            </h2>
            <ol className="mt-4 space-y-4">
              {(canPost
                ? [
                    [
                      "Share an opportunity",
                      "Include the details and who can apply.",
                    ],
                    [
                      "Meet the applicants",
                      "Review their profiles and application notes.",
                    ],
                    [
                      "Keep them updated",
                      "Set the status as applications progress.",
                    ],
                  ]
                : [
                    ["Find your fit", "Explore the details and requirements."],
                    [
                      "Apply directly",
                      "Send your interest to the alumni referrer.",
                    ],
                    [
                      "Follow your progress",
                      "Check updates in My applications.",
                    ],
                  ]
              ).map(([title, description], index) => (
                <li key={title} className="flex gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="text-xs font-semibold">{title}</h3>
                    <p className="mt-1 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
                      {description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
      {editor && (
        <ReferralEditor
          key={editor.item?._id || "new"}
          item={editor.item}
          onClose={() => setEditor(null)}
          onSaved={onSaved}
        />
      )}
      {details && (
        <ReferralDetails
          key={details.referral._id}
          referral={details.referral}
          initialApply={details.apply}
          canApply={
            canApplyRole && !isMine(details.referral) && applicationsReady
          }
          application={applicationsByReferral.get(String(details.referral._id))}
          onClose={() => setDetails(null)}
          onApplied={(application) =>
            setApplications((previous) => [
              application,
              ...previous.filter(
                (item) =>
                  String(item.referralId) !== String(application.referralId),
              ),
            ])
          }
        />
      )}
      {applicantsReferral && (
        <ReferralApplicants
          referral={applicantsReferral}
          onClose={() => setApplicantsReferral(null)}
        />
      )}
      {deleting && (
        <FeedDialog
          title="Delete this referral?"
          busy={deletingBusy}
          onClose={() => setDeleting(null)}
        >
          <p className="break-words text-sm leading-6">
            {deleting.title} will be removed, together with its applications.
          </p>
          {deleteError && (
            <p
              role="alert"
              className="mt-3 text-sm text-red-600 dark:text-red-400"
            >
              {deleteError}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              disabled={deletingBusy}
              onClick={() => setDeleting(null)}
              className={secondaryButton}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deletingBusy}
              onClick={remove}
              className={`${primaryButton} !bg-red-600 hover:!bg-red-700`}
            >
              {deletingBusy ? "Deleting…" : "Delete referral"}
            </button>
          </div>
        </FeedDialog>
      )}
    </section>
  );
}
