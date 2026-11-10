import ContentSkeleton from "../ui/Skeleton";
import { Link } from "react-router-dom";
import useJobDeadline, {
  deadlinePassed,
  deadlineLabel,
  deadlineInput,
} from "./useJobDeadline";
import { AdminTabs, AdminButton } from "../admin/AdminUI";
import { createElement, useCallback, useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  Clock3,
  FileText,
  Send,
  Bookmark,
  Briefcase,
  Building2,
  Eye,
  EyeOff,
  GraduationCap,
  Lightbulb,
  Map,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  MapPin,
  Monitor,
  ArrowUpRight,
  Trash2,
} from "lucide-react";
import { useAuth } from "../../context/useAuth";
import api from "../../utils/axios";
import { JobApplicantsDialog } from "./JobApplicationDialog";
import ProfileAvatar from "../profile/ProfileAvatar";
import DataPagination from "../ui/data-pagination";
import { FeedDialog } from "../feed/FeedComposer";
import PageHeader from "../ui/PageHeader";
import CareerSearch from "./CareerSearch";
import OpportunityEditor from "./LazyOpportunityEditor";
import JobDescription from "./JobDescription";
import { descriptionText } from "./description";
import "./CareerBoard.css";
import "./OpportunityModal.css";
import { CareerFilters, CareerFilterDrawer } from "./CareerFilters";

const CATEGORIES = [
  { id: "job", label: "Jobs", icon: Briefcase, color: "bg-brand" },
  {
    id: "internship",
    label: "Internships",
    icon: GraduationCap,
    color: "bg-blue-600",
  },
  {
    id: "advice",
    label: "Career Advice",
    icon: Lightbulb,
    color: "bg-violet-600",
  },
  {
    id: "insight",
    label: "Industry Insights",
    icon: Building2,
    color: "bg-amber-600",
  },
  {
    id: "roadmap",
    label: "Career Roadmaps",
    icon: Map,
    color: "bg-indigo-600",
  },
];
const INTERESTS = [
  "Software Development",
  "Data Science",
  "Human Resources",
  "Marketing",
  "Engineering",
  "Education",
  "Healthcare",
  "Business",
  "Design",
  "Research",
];
const EXPERIENCE_LEVELS = [
  "No experience required",
  "Entry-level",
  "Mid-level",
  "Senior-level",
  "Manager / Lead",
  "Executive",
];
const cardClass =
  "rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900";
const inputClass =
  "h-10 w-full min-w-0 rounded-lg border border-solid border-zinc-400 bg-zinc-50 px-3 text-sm text-zinc-900 outline-none transition-colors hover:border-zinc-500 focus:border-brand focus:ring-2 focus:ring-brand/15 dark:border-zinc-500 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-400 dark:focus:border-brand dark:[color-scheme:dark]";
const primaryButton =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-xs font-semibold text-white transition hover:bg-brand disabled:opacity-50";
const iconButton =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800";
const emptyJob = {
  title: "",
  company: "",
  location: "",
  type: "Full-time",
  mode: "On-site",
  experienceLevel: "",
  applicationDeadline: null,
  description: "",
  tags: "",
  isActive: true,
  audience: "all",
};
const emptyGuide = { title: "", type: "advice", body: "", tags: "" };
const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";
const jobCategory = (job) => (job.type === "Internship" ? "internship" : "job");

function IconControl({
  label,
  onClick,
  icon,
  active = false,
  disabled = false,
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={icon === Bookmark ? active : undefined}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={
        iconButton +
        (active
          ? " !border-brand/20 !bg-brand/10 !text-brand dark:!text-brand"
          : "")
      }
    >
      {createElement(icon, {
        size: 15,
        ...(icon === Bookmark && active ? { fill: "currentColor" } : {}),
      })}
    </button>
  );
}

function Editor({ kind, item, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    ...(kind === "job" ? emptyJob : emptyGuide),
    ...item,
    tags: (item?.tags || []).join(", "),
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const deadlineRef = useRef(null);
  const [duration, setDuration] = useState(null);
  const set = (field, value) =>
    setForm((previous) => ({ ...previous, [field]: value }));
  const label = kind === "job" ? "opportunity" : "career guide";
  const submit = async (event) => {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    const payload = {
      ...form,
      title: form.title.trim(),
      tags: form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    };
    const endpoint = kind === "job" ? "/jobs" : "/career-posts";
    try {
      if (item) await api.put(`${endpoint}/${item._id}`, payload);
      else await api.post(endpoint, payload);
      onSaved();
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to save. Please try again.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const field = (name, text, required = false) => (
    <label className="block text-xs font-medium">
      {text}
      {required && " *"}
      <input
        id={`career-${name}`}
        aria-label={text}
        value={form[name]}
        onChange={(event) => set(name, event.target.value)}
        required={required}
        maxLength={name === "tags" ? 1000 : 200}
        className={`${inputClass} mt-1.5`}
      />
    </label>
  );
  return (
    <FeedDialog
      title={`${item ? "Edit" : "Post an"} ${label}`}
      busy={busy}
      onClose={onClose}
      wide={kind === "job"}
      header={
        kind === "job" ? (
          <div className="opportunity-modal-heading">
            <span className="opportunity-heading-icon">
              <Briefcase size={22} aria-hidden="true" />
            </span>
            <div>
              <p className="opportunity-eyebrow">UNIVERSITY CAREER BOARD</p>
              <h3>{item ? "Edit opportunity" : "Post an opportunity"}</h3>
              <p>Help a fellow Sielesyuan take the next step.</p>
            </div>
          </div>
        ) : undefined
      }
    >
      <form
        onSubmit={submit}
        className={kind === "job" ? "opportunity-form" : "space-y-4"}
      >
        <fieldset disabled={busy} className="min-w-0 space-y-5">
          {kind === "job" ? (
            <>
              <section
                className="opportunity-section"
                aria-label="Opportunity details"
              >
                <div className="opportunity-section-heading">
                  <span>
                    <Briefcase size={16} aria-hidden="true" />
                  </span>
                  <div>
                    <h4>Opportunity details</h4>
                    <p>Start with the role and where it fits.</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="block text-xs font-medium">
                    Opportunity type
                    <select
                      aria-label="Opportunity type"
                      value={form.type === "Internship" ? "internship" : "job"}
                      onChange={(event) =>
                        set(
                          "type",
                          event.target.value === "internship"
                            ? "Internship"
                            : form.type === "Internship"
                              ? "Full-time"
                              : form.type,
                        )
                      }
                      className={`${inputClass} mt-1.5`}
                    >
                      <option value="job">Job</option>
                      <option value="internship">Internship</option>
                    </select>
                  </label>
                  {field("title", "Title", true)}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {field("company", "Company / Organizer", true)}
                    {field("location", "Location")}
                  </div>
                  <div
                    className={`grid gap-4 ${form.type !== "Internship" ? "sm:grid-cols-2" : ""}`}
                  >
                    {form.type !== "Internship" && (
                      <label className="block text-xs font-medium">
                        Employment type
                        <select
                          aria-label="Employment type"
                          value={form.type}
                          onChange={(event) => set("type", event.target.value)}
                          className={`${inputClass} mt-1.5`}
                        >
                          {["Full-time", "Part-time", "Contract"].map(
                            (type) => (
                              <option key={type}>{type}</option>
                            ),
                          )}
                        </select>
                      </label>
                    )}
                    <label className="block text-xs font-medium">
                      Work mode
                      <select
                        aria-label="Work mode"
                        value={form.mode}
                        onChange={(event) => set("mode", event.target.value)}
                        className={`${inputClass} mt-1.5`}
                      >
                        {["On-site", "Hybrid", "Remote"].map((mode) => (
                          <option key={mode}>{mode}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="block text-xs font-medium">
                    Experience level
                    <select
                      id="career-experienceLevel"
                      aria-label="Experience level"
                      value={form.experienceLevel || ""}
                      onChange={(event) =>
                        set("experienceLevel", event.target.value)
                      }
                      className={`${inputClass} mt-1.5`}
                    >
                      <option value="">Not specified</option>
                      {EXPERIENCE_LEVELS.map((level) => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>
              <section
                className="opportunity-section opportunity-deadline-section"
                aria-label="Application schedule"
              >
                <div className="opportunity-section-heading">
                  <span>
                    <CalendarDays size={17} aria-hidden="true" />
                  </span>
                  <div>
                    <h4>Application schedule</h4>
                    <p>Decide how long applications stay open.</p>
                  </div>
                  <span className="opportunity-optional">Optional</span>
                </div>
                <label
                  htmlFor="career-deadline"
                  className="block text-xs font-medium"
                >
                  Application deadline (Philippine time)
                </label>
                <div className="opportunity-date-control">
                  <input
                    ref={deadlineRef}
                    id="career-deadline"
                    aria-label="Application deadline"
                    type="datetime-local"
                    value={deadlineInput(form.applicationDeadline)}
                    onChange={(event) => {
                      setDuration(null);
                      set(
                        "applicationDeadline",
                        event.target.value
                          ? new Date(
                              `${event.target.value}+08:00`,
                            ).toISOString()
                          : null,
                      );
                    }}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    className="opportunity-date-button"
                    aria-label="Choose application deadline"
                    title="Choose date and time"
                    onClick={() => {
                      try {
                        if (deadlineRef.current?.showPicker)
                          deadlineRef.current.showPicker();
                        else deadlineRef.current?.focus();
                      } catch {
                        deadlineRef.current?.focus();
                      }
                    }}
                  >
                    <CalendarDays size={18} aria-hidden="true" />
                    <span>Choose date</span>
                  </button>
                </div>
                <div
                  className="opportunity-duration-options"
                  role="group"
                  aria-label="Application duration"
                >
                  {[7, 14, 30].map((days) => (
                    <button
                      key={days}
                      type="button"
                      aria-pressed={duration === days}
                      onClick={() => {
                        setDuration(days);
                        set(
                          "applicationDeadline",
                          new Date(Date.now() + days * 86400000).toISOString(),
                        );
                      }}
                    >
                      <Clock3 size={13} aria-hidden="true" />
                      {days} days
                    </button>
                  ))}
                  <button
                    type="button"
                    aria-pressed={!form.applicationDeadline}
                    onClick={() => {
                      setDuration(null);
                      set("applicationDeadline", null);
                    }}
                  >
                    No deadline
                  </button>
                </div>
                <p className="opportunity-deadline-note">
                  <Clock3 size={15} aria-hidden="true" />
                  <span>
                    {form.applicationDeadline
                      ? `Automatically closes ${deadlineLabel(form.applicationDeadline)}. You can change this anytime.`
                      : "Keep applications open, or choose a date to close them automatically."}
                  </span>
                </p>
              </section>
              <section
                className="opportunity-section"
                aria-label="About the opportunity"
              >
                <div className="opportunity-section-heading">
                  <span>
                    <FileText size={17} aria-hidden="true" />
                  </span>
                  <div>
                    <h4>About the opportunity</h4>
                    <p>
                      Share the responsibilities, qualifications, and benefits.
                    </p>
                  </div>
                </div>
                <OpportunityEditor
                  value={form.description}
                  format={form.descriptionFormat}
                  disabled={busy}
                  onChange={(description) =>
                    setForm((previous) => ({
                      ...previous,
                      description,
                      descriptionFormat: "html",
                    }))
                  }
                />
              </section>
              <section
                className="opportunity-audience-section"
                aria-label="Opportunity visibility"
              >
                <div className="opportunity-visibility">
                  <span className="opportunity-visibility-icon">
                    <Eye size={19} aria-hidden="true" />
                  </span>
                  <span>
                    <strong id="opportunity-visible-label">
                      {form.audience === "alumni"
                        ? "Visible to alumni only"
                        : "Visible to the community"}
                    </strong>
                    <span id="opportunity-visible-hint">
                      {form.audience === "alumni"
                        ? "Only alumni can discover and apply to this opportunity."
                        : "Alumni and students can discover and apply to this opportunity."}
                    </span>
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-label="Include students"
                    aria-describedby="opportunity-visible-hint"
                    aria-checked={form.audience !== "alumni"}
                    title="On: All (Alumni and Students). Off: Alumni only."
                    className="opportunity-visibility-switch"
                    onClick={() =>
                      set(
                        "audience",
                        form.audience === "alumni" ? "all" : "alumni",
                      )
                    }
                  >
                    <span />
                  </button>
                </div>
              </section>
            </>
          ) : (
            <>
              <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                Share advice, an industry insight, or a roadmap to help others
                grow.
              </p>
              {field("title", "Title", true)}
              <label className="block text-xs font-medium">
                Guide type
                <select
                  aria-label="Guide type"
                  value={form.type}
                  onChange={(event) => set("type", event.target.value)}
                  className={`${inputClass} mt-1.5`}
                >
                  {CATEGORIES.filter((category) =>
                    ["advice", "insight", "roadmap"].includes(category.id),
                  ).map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium">
                Guide content *
                <textarea
                  aria-label="Guide content"
                  value={form.body}
                  onChange={(event) => set("body", event.target.value)}
                  required
                  rows={5}
                  maxLength={10000}
                  className={`${inputClass} mt-1.5 !h-auto py-3`}
                />
              </label>
              {field("tags", "Tags (comma separated)")}
            </>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          <div
            className={
              kind === "job"
                ? "opportunity-modal-actions"
                : "flex justify-end gap-2"
            }
          >
            {kind === "job" && (
              <span className="opportunity-required-note">
                * Required fields
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-300 px-4 py-2.5 text-xs font-semibold transition hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button type="submit" className={primaryButton}>
              {kind === "job" && <Send size={14} aria-hidden="true" />}
              {busy ? "Saving..." : item ? "Save changes" : "Publish"}
            </button>
          </div>
        </fieldset>
      </form>
    </FeedDialog>
  );
}

function PostDescription({ text, format, preview = false }) {
  return (
    <div className="mt-4">
      <JobDescription
        value={text}
        format={format}
        className={`career-description text-zinc-600 dark:text-zinc-300 ${preview ? "max-h-[8.5em] overflow-hidden" : ""}`}
      />
    </div>
  );
}

export default function CareerBoard({
  referralContent = null,
  appearance = "default",
}) {
  const now = useJobDeadline();
  const marketplace = appearance === "marketplace";
  const { user, refreshUser } = useAuth();
  const isAdmin = user?.role === "admin";
  const canPost = isAdmin || user?.role === "alumni";
  const authId = String(user?.authId || user?._id || "");
  const [jobs, setJobs] = useState([]);
  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const closeFilters = useCallback(() => setFiltersOpen(false), []);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [categories, setCategories] = useState(
    CATEGORIES.map((category) => category.id),
  );
  const [sources, setSources] = useState(["university", "community"]);
  const [savedJobs, setSavedJobs] = useState({});
  const [appliedJobs, setAppliedJobs] = useState({});
  const [applicantsJob, setApplicantsJob] = useState(null);
  const [interestDraft, setInterestDraft] = useState(null);
  const interests = interestDraft ?? user?.interests ?? [];
  const [interestsSaved, setInterestsSaved] = useState(false);
  const interestOptions = [...new Set([...INTERESTS, ...interests])];
  const [editor, setEditor] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(null);
  const pending = useRef(false);
  const generation = useRef(0);
  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    const results = await Promise.allSettled([
      api.get("/jobs", { params: isAdmin ? { all: "true" } : {} }),
      api.get("/career-posts"),
      ...(!isAdmin ? [api.get("/jobs/applications/me")] : []),
    ]);
    if (request !== generation.current) return;
    if (results[0].status === "fulfilled")
      setJobs(results[0].value.data.data || []);
    if (results[1].status === "fulfilled")
      setGuides(results[1].value.data.data || []);
    if (results[2]?.status === "fulfilled")
      setAppliedJobs(
        Object.fromEntries(
          (results[2].value.data.data || []).map((application) => [
            application.jobId,
            application,
          ]),
        ),
      );
    setError(
      results.some((result) => result.status === "rejected")
        ? "Some resources could not be loaded. Please retry."
        : "",
    );
    setLoading(false);
  }, [isAdmin]);
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) load();
    });
    return () => {
      active = false;
      // Sequence counter invalidates pending requests; it is not a DOM ref.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ++generation.current;
    };
  }, [load, authId]);
  const action = async (key, task) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(key);
    setError("");
    try {
      await task();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to complete this action. Please try again.",
      );
    } finally {
      pending.current = false;
      setBusy(null);
    }
  };
  const saveGuide = (guide) =>
    action(`guide:${guide._id}`, async () => {
      const response = await api.post(`/career-posts/${guide._id}/save`);
      setGuides((previous) =>
        previous.map((item) =>
          item._id === guide._id
            ? {
                ...item,
                savedByMe: response.data.data.saved,
                savesCount: Math.max(
                  0,
                  (item.savesCount || 0) + (response.data.data.saved ? 1 : -1),
                ),
              }
            : item,
        ),
      );
    });
  const remove = () =>
    action("delete", async () => {
      await api.delete(
        `${deleting.kind === "job" ? "/jobs" : "/career-posts"}/${deleting.item._id}`,
      );
      setDeleting(null);
      await load();
    });
  const toggleVisibility = (job) =>
    action(`job:${job._id}`, async () => {
      const response = await api.put(`/jobs/${job._id}`, {
        isActive: !job.isActive,
      });
      setJobs((previous) =>
        previous.map((item) =>
          item._id === job._id ? response.data.data : item,
        ),
      );
    });
  const displayedJobs =
    view === "applied"
      ? [
          ...jobs,
          ...Object.values(appliedJobs)
            .filter(
              (application) =>
                !jobs.some((job) => job._id === application.jobId),
            )
            .map((application) => ({
              ...application.jobSnapshot,
              _id: application.jobId,
              title: application.jobTitle,
              company: application.company,
              isActive: false,
            })),
        ]
      : jobs;
  const rows = [
    ...displayedJobs.map((item) => ({
      item,
      kind: "job",
      category: jobCategory(item),
      source: "university",
      saved: !!savedJobs[item._id],
      mine: String(item.createdBy) === authId,
    })),
    ...guides.map((item) => ({
      item,
      kind: "guide",
      category: item.type,
      source: "community",
      saved: !!item.savedByMe,
      mine: String(item.authorAuthId) === authId,
    })),
  ].sort(
    (a, b) =>
      (new Date(b.item.createdAt).getTime() || 0) -
      (new Date(a.item.createdAt).getTime() || 0),
  );
  const opportunityView = view === "all" || view === "applied";
  const guideView = view === "guides";
  const viewRows = rows.filter((row) =>
    opportunityView
      ? row.kind === "job"
      : guideView
        ? row.kind === "guide"
        : true,
  );
  const visibleCategories = CATEGORIES.filter((category) => {
    const opportunity = category.id === "job" || category.id === "internship";
    return opportunityView ? opportunity : guideView ? !opportunity : true;
  });
  const sourceOptions = [
    ...(!guideView ? [["university", "University"]] : []),
    ...(!opportunityView ? [["community", "Community"]] : []),
  ];
  const searchPlaceholder = guideView
    ? "Search career guides, topics, or keywords"
    : opportunityView
      ? "Search jobs, companies, or keywords"
      : "Search your resources";
  const filtered = viewRows.filter(
    (row) =>
      categories.includes(row.category) &&
      sources.includes(row.source) &&
      (view !== "saved" || row.saved) &&
      (view !== "mine" || row.mine) &&
      (view !== "guides" || row.kind === "guide") &&
      (view !== "applied" ||
        (row.kind === "job" && appliedJobs[row.item._id])) &&
      `${row.item.title || ""} ${row.item.company || ""} ${row.item.experienceLevel || ""} ${descriptionText(row.item.description || row.item.body || "", row.item.descriptionFormat)} ${(row.item.tags || []).join(" ")}`
        .toLowerCase()
        .includes(term.toLowerCase()),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage,
  );
  const toggleFilter = (setter, value) => {
    setPage(1);
    setter((previous) =>
      previous.includes(value)
        ? previous.filter((item) => item !== value)
        : [...previous, value],
    );
  };
  const clearFilters = () => {
    setPage(1);
    setCategories(CATEGORIES.map((category) => category.id));
    setSources(["university", "community"]);
    setQuery("");
    setTerm("");
  };
  const selectView = (nextView) => {
    setView(nextView);
    clearFilters();
    setFiltersOpen(false);
  };
  const tabs = [
    { id: "all", label: "Opportunities" },
    ...(referralContent ? [{ id: "referrals", label: "Referrals" }] : []),
    { id: "guides", label: "Career Guides" },
    { id: "saved", label: "Saved" },
    ...(canPost ? [{ id: "mine", label: "My Posts" }] : []),
    ...(!isAdmin ? [{ id: "applied", label: "Applied" }] : []),
    ...(user?.role === "student"
      ? [{ id: "interests", label: "My Interests" }]
      : []),
  ];
  const renderFilters = (onClose) => (
    <CareerFilters
      categories={visibleCategories}
      selectedCategories={categories}
      sources={sourceOptions}
      selectedSources={sources}
      rows={viewRows}
      categoryLabel={
        guideView
          ? "Guide type"
          : opportunityView
            ? "Opportunity type"
            : "Resource type"
      }
      resultCount={filtered.length}
      onCategoryChange={(id) => toggleFilter(setCategories, id)}
      onSourceChange={(id) => toggleFilter(setSources, id)}
      onClear={clearFilters}
      onClose={onClose}
    />
  );

  return (
    <main
      className={`mx-auto max-w-7xl p-3 text-zinc-900 sm:p-5 dark:text-zinc-100 workspace-page ${marketplace ? "career-marketplace" : ""}`}
    >
      {marketplace && (
        <>
          <PageHeader
            icon={Briefcase}
            title={isAdmin ? "Job Posts" : "Career Board"}
            description={
              isAdmin
                ? "Manage job opportunities and career resources for your community."
                : "Find opportunities, learn from alumni, and build what comes next."
            }
          >
            {canPost &&
              (isAdmin ? (
                <AdminButton
                  onClick={() =>
                    setEditor({ kind: view !== "guides" ? "job" : "guide" })
                  }
                >
                  <Plus size={15} />
                  {view !== "guides"
                    ? "Post an opportunity"
                    : "Share a career guide"}
                </AdminButton>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditor({ kind: "guide" })}
                  className={primaryButton}
                >
                  <Plus size={16} />
                  Share a career guide
                </button>
              ))}
          </PageHeader>
          {view !== "referrals" && (
            <div className="career-search-row">
              <CareerSearch
                value={query}
                onChange={setQuery}
                onSearch={(value) => {
                  setTerm(value);
                  setPage(1);
                }}
                placeholder={searchPlaceholder}
              />
              <button
                type="button"
                className="career-filter-toggle"
                aria-haspopup="dialog"
                aria-expanded={filtersOpen}
                aria-controls="career-filter-drawer"
                onClick={() => setFiltersOpen(true)}
              >
                <SlidersHorizontal size={18} />
                Filters
              </button>
            </div>
          )}
        </>
      )}
      <div
        className={
          marketplace
            ? "career-board-navigation"
            : `${cardClass} mb-5 flex flex-wrap items-center justify-between gap-3 px-5 py-3 workspace-page-header`
        }
      >
        {!marketplace && (
          <h1 className="flex items-center gap-2 text-base font-bold">
            <Briefcase size={20} className="text-brand" />
            Career Board
          </h1>
        )}
        {isAdmin || (marketplace && user?.role === "student") ? (
          <AdminTabs
            label="Career board views"
            value={view}
            onChange={selectView}
            items={tabs.map((tab) => ({ id: tab.id, label: tab.label }))}
          />
        ) : (
          <nav
            aria-label="Career board views"
            className="flex max-w-full gap-4 overflow-x-auto"
          >
            {tabs.map((tab) => (
              <button
                type="button"
                key={tab.id}
                aria-pressed={view === tab.id}
                onClick={() => selectView(tab.id)}
                className={`shrink-0 border-b-2 py-3 text-xs font-semibold ${view === tab.id ? "border-brand text-brand dark:text-brand" : "border-transparent text-zinc-500 dark:text-zinc-400"}`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        )}
      </div>
      {view === "referrals" && referralContent ? (
        referralContent
      ) : (
        <div
          className={`career-layout grid items-start gap-4 md:grid-cols-[200px_minmax(0,1fr)] ${!marketplace ? "xl:grid-cols-[200px_minmax(0,1fr)_220px]" : ""}`}
        >
          <aside
            id="career-filters"
            className={`${cardClass} career-filter-panel order-2 p-5 md:order-none md:sticky md:top-20 ${marketplace ? "hidden md:block" : ""}`}
            aria-label="Career filters"
          >
            {marketplace ? (
              renderFilters()
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Filter</h2>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-[11px] font-medium text-red-600 dark:text-red-400"
                  >
                    Clear all
                  </button>
                </div>
                <h3 className="mb-4 mt-6 text-xs font-semibold">
                  {guideView
                    ? "Guide type"
                    : opportunityView
                      ? "Opportunity type"
                      : "Resource type"}
                </h3>
                <div className="space-y-3">
                  {visibleCategories.map((category) => (
                    <label
                      key={category.id}
                      className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300"
                    >
                      <input
                        type="checkbox"
                        aria-label={`Filter ${category.label}`}
                        checked={categories.includes(category.id)}
                        onChange={() =>
                          toggleFilter(setCategories, category.id)
                        }
                        className="h-3.5 w-3.5 accent-brand"
                      />
                      {category.label}
                      <span className="ml-auto text-[10px] text-zinc-400">
                        {
                          viewRows.filter((row) => row.category === category.id)
                            .length
                        }
                      </span>
                    </label>
                  ))}
                </div>
                <h3 className="mb-4 mt-6 text-xs font-semibold">Posted by</h3>
                <div className="space-y-3">
                  {sourceOptions.map(([id, label]) => (
                    <label
                      key={id}
                      className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300"
                    >
                      <input
                        type="checkbox"
                        aria-label={`Filter ${label}`}
                        checked={sources.includes(id)}
                        onChange={() => toggleFilter(setSources, id)}
                        className="h-3.5 w-3.5 accent-brand"
                      />
                      {label}
                      <span className="ml-auto text-[10px] text-zinc-400">
                        {viewRows.filter((row) => row.source === id).length}
                      </span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </aside>
          <section className="career-feed order-1 min-w-0 space-y-3 md:order-none">
            {marketplace ? (
              <header className="career-feed-heading">
                <h2>
                  {view === "saved"
                    ? "Your saved resources"
                    : view === "applied"
                      ? "Your applications"
                      : view === "mine"
                        ? "Your career posts"
                        : guideView
                          ? "Career Guides"
                          : "Opportunities for you"}
                </h2>
                <p>
                  {view === "all"
                    ? "Explore jobs and internships from your university."
                    : guideView
                      ? "Career advice, industry insights, and roadmaps from your community."
                      : "Search and filter to find what you need."}
                </p>
              </header>
            ) : (
              <header className="relative overflow-hidden rounded-lg bg-gradient-to-br from-brand to-brand p-5 text-white dark:from-zinc-900 dark:to-zinc-900">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-8 -top-8 rotate-12 text-white/10"
                >
                  <Briefcase size={180} strokeWidth={1} />
                </div>
                <h2 className="relative text-xl font-semibold">
                  {guideView ? "Career Guides" : "Career Opportunity Board"}
                </h2>
                <p className="relative mt-2 max-w-lg text-xs leading-6 text-white/90">
                  {guideView
                    ? "Explore career advice, industry insights, and roadmaps shared by your community."
                    : "Discover jobs and internships shared by the university. Find community advice in Career Guides."}
                </p>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    setTerm(query.trim());
                    setPage(1);
                  }}
                  className="relative mt-4 flex flex-wrap gap-2"
                >
                  <div className="relative min-w-0 flex-1 basis-40">
                    <Search
                      size={15}
                      className="absolute left-3 top-3 text-white/80"
                    />
                    <input
                      type="search"
                      aria-label="Search career board"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder={searchPlaceholder}
                      className="h-10 w-full rounded-lg border border-white/20 bg-white/20 pl-9 pr-3 text-xs text-white outline-none placeholder:text-white/75 focus:bg-white/30"
                    />
                  </div>
                  <button
                    type="submit"
                    className="rounded-lg bg-white px-4 text-xs font-semibold text-brand"
                  >
                    Search
                  </button>
                  {canPost && (
                    <button
                      type="button"
                      onClick={() =>
                        setEditor({
                          kind: isAdmin && view !== "guides" ? "job" : "guide",
                        })
                      }
                      className="inline-flex h-10 items-center gap-1 rounded-lg border border-white/70 px-3 text-xs font-semibold"
                    >
                      <Plus size={15} />
                      Post
                    </button>
                  )}
                </form>
              </header>
            )}
            {error && (
              <div
                role="alert"
                className={`${cardClass} p-4 text-xs text-red-600 dark:text-red-400`}
              >
                {error}{" "}
                <button
                  type="button"
                  onClick={load}
                  className="font-semibold underline"
                >
                  Retry
                </button>
              </div>
            )}
            {view === "interests" ? (
              <section className={`${cardClass} p-5`}>
                <h2 className="text-sm font-semibold">My career interests</h2>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Pick the topics you want to follow.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {interestOptions.map((interest) => (
                    <button
                      key={interest}
                      type="button"
                      aria-pressed={interests.includes(interest)}
                      disabled={busy !== null}
                      onClick={() => {
                        setInterestsSaved(false);
                        setInterestDraft(
                          interests.includes(interest)
                            ? interests.filter((value) => value !== interest)
                            : [...interests, interest],
                        );
                      }}
                      className={`rounded-lg px-3 py-2 text-xs ${interests.includes(interest) ? "bg-brand text-white" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"}`}
                    >
                      {interest}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() =>
                    action("interests", async () => {
                      await api.put("/users/me", { interests });
                      await refreshUser();
                      setInterestsSaved(true);
                    })
                  }
                  className={`${primaryButton} mt-5`}
                >
                  {busy === "interests" ? "Saving…" : "Save interests"}
                </button>
                {interestsSaved && (
                  <p
                    role="status"
                    className="mt-3 text-xs text-brand dark:text-brand"
                  >
                    Career interests saved.
                  </p>
                )}
                <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                  {interests.length} career{" "}
                  {interests.length === 1 ? "interest" : "interests"} selected.
                  Your interests are saved to your profile.
                </p>
              </section>
            ) : loading ? (
              <ContentSkeleton variant="cards" count={3} label="Loading opportunities…" />
            ) : (
              <>
                <p
                  role="status"
                  className="px-1 text-[11px] text-zinc-500 dark:text-zinc-400"
                >
                  {filtered.length}{" "}
                  {filtered.length === 1 ? "result" : "results"}
                  {term && ` for “${term}”`}
                </p>
                {!filtered.length && (
                  <div className={`${cardClass} p-8 text-center`}>
                    <Briefcase
                      size={28}
                      className="mx-auto text-zinc-300 dark:text-zinc-600"
                    />
                    <h3 className="mt-3 text-sm font-semibold">
                      {view === "saved"
                        ? "No saved resources yet"
                        : view === "mine"
                          ? "No posts to show"
                          : view === "applied"
                            ? "No applications yet"
                            : guideView
                              ? "No career guides found"
                              : "No opportunities found"}
                    </h3>
                    <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                      {view === "saved"
                        ? "Save a resource to find it here."
                        : "Try another filter or check back for new resources."}
                    </p>
                  </div>
                )}
                {paged.map((row) => {
                  const { item, kind } = row;
                  const category =
                    CATEGORIES.find((option) => option.id === row.category) ||
                    CATEGORIES[0];
                  const canManage =
                    isAdmin || (kind === "guide" && canPost && row.mine);
                  const controls = (
                    <div className="career-card-actions flex gap-1.5">
                      <IconControl
                        label={row.saved ? "Unsave resource" : "Save resource"}
                        onClick={() =>
                          kind === "job"
                            ? setSavedJobs((previous) => ({
                                ...previous,
                                [item._id]: !previous[item._id],
                              }))
                            : saveGuide(item)
                        }
                        icon={Bookmark}
                        active={row.saved}
                        disabled={busy !== null}
                      />
                      {canManage && (
                        <>
                          <IconControl
                            label="Edit post"
                            onClick={() => setEditor({ kind, item })}
                            icon={Pencil}
                            disabled={busy !== null}
                          />
                          {kind === "job" && (
                            <IconControl
                              label={
                                item.isActive
                                  ? "Hide opportunity"
                                  : "Show opportunity"
                              }
                              onClick={() => toggleVisibility(item)}
                              icon={item.isActive ? Eye : EyeOff}
                              disabled={busy !== null}
                            />
                          )}
                          <IconControl
                            label="Delete post"
                            onClick={() => setDeleting({ kind, item })}
                            icon={Trash2}
                            disabled={busy !== null}
                          />
                        </>
                      )}
                    </div>
                  );
                  return (
                    <article
                      key={`${kind}:${item._id}`}
                      data-career-card={kind}
                      data-career-category={row.category}
                      className={`${cardClass} career-listing p-4 sm:p-5`}
                    >
                      <div className="career-card-content">
                        {marketplace && (
                          <div className="career-card-context">
                            <div className="career-card-labels">
                              {row.category !== "job" && (
                                <span className="career-category-badge">
                                  {category.label}
                                </span>
                              )}
                              {item.createdAt && (
                                <time dateTime={item.createdAt}>
                                  Posted {formatDate(item.createdAt)}
                                </time>
                              )}
                            </div>
                            {controls}
                          </div>
                        )}
                        <div className="career-card-header flex flex-wrap items-start gap-3">
                          <span
                            className={`career-company-mark flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white ${category.color}`}
                          >
                            {kind === "job"
                              ? (
                                  (item.company || "CLSU").match(
                                    /\p{L}/u,
                                  )?.[0] || "C"
                                ).toUpperCase()
                              : createElement(category.icon, { size: 19 })}
                          </span>
                          <div className="min-w-0 flex-1 basis-36">
                            <h3 className="break-words text-sm font-semibold leading-5">
                              {kind === "job" ? (
                                <Link
                                  to={`${isAdmin ? "/admin/jobs" : user?.role === "alumni" ? "/alumni/career" : "/student/career"}/${item._id}`}
                                  className="text-left hover:underline underline-offset-4"
                                >
                                  {item.title}
                                </Link>
                              ) : (
                                item.title
                              )}
                            </h3>
                            <p className="career-card-byline mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                              <span>
                                {kind === "job"
                                  ? item.company
                                  : item.authorName ||
                                    item.authorEmail ||
                                    "Community"}
                              </span>
                              {!marketplace && item.location && (
                                <span>· {item.location}</span>
                              )}
                              {!marketplace && (
                                <span>
                                  ·{" "}
                                  {kind === "job" ? "University" : "Community"}
                                </span>
                              )}
                            </p>
                          </div>
                          {!marketplace && controls}
                        </div>
                        {marketplace && kind === "job" && (
                          <dl className="career-job-details">
                            {[
                              ["Location", item.location, MapPin],
                              ["Employment type", item.type, Briefcase],
                              ["Work mode", item.mode, Monitor],
                              [
                                "Experience level",
                                item.experienceLevel,
                                GraduationCap,
                              ],
                            ]
                              .filter(([, value]) => value)
                              .map(([label, value, Icon]) => (
                                <div key={label}>
                                  <dt className="sr-only">{label}</dt>
                                  <dd>
                                    {createElement(Icon, {
                                      size: 14,
                                      "aria-hidden": true,
                                    })}
                                    {value}
                                  </dd>
                                </div>
                              ))}
                          </dl>
                        )}
                        {kind === "job" && item.applicationDeadline && (
                          <p
                            className={`mt-3 text-xs font-medium ${deadlinePassed(item, now) ? "text-red-600 dark:text-red-400" : "text-zinc-600 dark:text-zinc-300"}`}
                          >
                            {deadlinePassed(item, now)
                              ? "Applications closed"
                              : "Apply until"}{" "}
                            ? {deadlineLabel(item.applicationDeadline)}
                          </p>
                        )}
                        {marketplace ? (
                          <PostDescription
                            preview={kind === "job"}
                            text={
                              (kind === "job"
                                ? item.description || "No description provided."
                                : item.body) || ""
                            }
                            format={
                              kind === "job"
                                ? item.descriptionFormat
                                : undefined
                            }
                          />
                        ) : (
                          <JobDescription
                            value={
                              (kind === "job"
                                ? item.description || "No description provided."
                                : item.body) || ""
                            }
                            format={
                              kind === "job"
                                ? item.descriptionFormat
                                : undefined
                            }
                            className={`mt-4 text-zinc-600 dark:text-zinc-300 ${kind === "job" ? "max-h-[8.5em] overflow-hidden" : ""}`}
                          />
                        )}
                        {(!marketplace ||
                          item.tags?.length > 0 ||
                          item.isActive === false) && (
                          <footer className="career-card-tags mt-4 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap gap-1.5">
                              {!marketplace && (
                                <span
                                  className={`rounded-md px-2.5 py-1 text-[10px] font-semibold text-white ${category.color}`}
                                >
                                  {category.label}
                                </span>
                              )}
                              {kind === "job" && !marketplace && (
                                <>
                                  <span className="rounded-md bg-zinc-100 px-2.5 py-1 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                                    {item.type}
                                  </span>
                                  <span className="rounded-md bg-zinc-100 px-2.5 py-1 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                                    {item.mode}
                                  </span>
                                  {item.experienceLevel && (
                                    <span className="rounded-md bg-zinc-100 px-2.5 py-1 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                                      {item.experienceLevel}
                                    </span>
                                  )}
                                  {item.isActive === false && (
                                    <span className="rounded-md bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                      Hidden
                                    </span>
                                  )}
                                </>
                              )}
                              {marketplace && item.isActive === false && (
                                <span className="career-hidden-label">
                                  Hidden
                                </span>
                              )}
                              {(item.tags || []).map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-md bg-zinc-100 px-2.5 py-1 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                            {!marketplace && (
                              <time
                                dateTime={item.createdAt}
                                className="text-[10px] text-zinc-500 dark:text-zinc-400"
                              >
                                {formatDate(item.createdAt)}
                              </time>
                            )}
                          </footer>
                        )}
                      </div>
                      {kind === "job" && (
                        <div
                          className={
                            marketplace ? "career-card-bottom" : undefined
                          }
                        >
                          {marketplace && (
                            <span className="career-card-source">
                              <Building2 size={15} aria-hidden="true" />
                              {item.audience === "alumni"
                                ? "Alumni only"
                                : "Alumni & Students"}
                            </span>
                          )}
                          <div className="career-opportunity-actions mt-4">
                            <Link
                              to={`${isAdmin ? "/admin/jobs" : user?.role === "alumni" ? "/alumni/career" : "/student/career"}/${item._id}`}
                              className={primaryButton}
                            >
                              View more
                              <ArrowUpRight size={16} aria-hidden="true" />
                            </Link>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => setApplicantsJob(item)}
                                className={primaryButton}
                              >
                                View applicants
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
                {filtered.length > 0 && (
                  <div className={`${cardClass} overflow-hidden`}>
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
                      itemLabel="resources"
                    />
                  </div>
                )}
              </>
            )}
          </section>
          {!marketplace && (
            <aside className="career-member-panel order-3 grid min-w-0 gap-3 md:col-span-2 md:grid-cols-2 xl:col-span-1 xl:grid-cols-1 xl:sticky xl:top-20">
              <section className={`${cardClass} p-5 text-center`}>
                <span className="mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-emerald-50 text-brand dark:bg-zinc-800 dark:text-brand">
                  <ProfileAvatar user={user} />
                </span>
                <h2 className="mt-3 break-words text-sm font-semibold">
                  {user?.name || "Member"}
                </h2>
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  {[user?.program, user?.batch && `Batch ${user.batch}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <span className="mt-3 inline-block rounded-full bg-zinc-100 px-3 py-1 text-[10px] font-semibold capitalize text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {user?.role}
                </span>
                {canPost && (
                  <button
                    type="button"
                    onClick={() => setEditor({ kind: "guide" })}
                    className={`${primaryButton} mt-4 w-full`}
                  >
                    Share a career guide
                  </button>
                )}
              </section>
              <section className={`${cardClass} p-5`}>
                <h2 className="mb-4 text-sm font-semibold">
                  {guideView
                    ? "Guides at a glance"
                    : opportunityView
                      ? "Opportunities at a glance"
                      : "Board Summary"}
                </h2>
                <dl className="space-y-3">
                  {visibleCategories.map((category) => (
                    <div
                      key={category.id}
                      className="flex items-center justify-between gap-3 text-xs"
                    >
                      <dt className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                        <span
                          className={`h-2 w-2 rounded-sm ${category.color}`}
                        />
                        {category.label}
                      </dt>
                      <dd className="font-semibold">
                        {
                          viewRows.filter((row) => row.category === category.id)
                            .length
                        }
                      </dd>
                    </div>
                  ))}
                  {isAdmin && !guideView && (
                    <div className="flex items-center justify-between border-t border-zinc-100 pt-3 text-xs dark:border-zinc-800">
                      <dt className="text-zinc-500 dark:text-zinc-400">
                        Hidden opportunities
                      </dt>
                      <dd className="font-semibold">
                        {jobs.filter((job) => job.isActive === false).length}
                      </dd>
                    </div>
                  )}
                </dl>
              </section>
              <p
                className={`${cardClass} p-4 text-[11px] leading-6 text-zinc-500 md:col-span-2 xl:col-span-1 dark:text-zinc-400`}
              >
                {isAdmin
                  ? "Create, edit, hide, or delete university job posts. You can also manage career guides shared by the community."
                  : user?.role === "alumni"
                    ? "Share career advice, industry insights, and roadmaps. Manage your guides in My Posts, or share opportunities through Referrals."
                    : "Explore opportunities, save useful guides, and update your career interests."}
              </p>
            </aside>
          )}
        </div>
      )}
      {marketplace && filtersOpen && (
        <CareerFilterDrawer onClose={closeFilters}>
          {renderFilters(closeFilters)}
        </CareerFilterDrawer>
      )}
      {applicantsJob && (
        <JobApplicantsDialog
          job={applicantsJob}
          onClose={() => setApplicantsJob(null)}
        />
      )}
      {editor && (
        <Editor
          key={`${editor.kind}:${editor.item?._id || "new"}`}
          kind={editor.kind}
          item={editor.item}
          onClose={() => setEditor(null)}
          onSaved={() => {
            if (editor.kind === "guide" && !editor.item) selectView("guides");
            load();
          }}
        />
      )}
      {deleting && (
        <FeedDialog
          title="Delete this post?"
          busy={busy === "delete"}
          onClose={() => setDeleting(null)}
        >
          <p className="text-sm">
            “{deleting.item.title}” will be removed from the board.
          </p>
          {error && (
            <p
              role="alert"
              className="mt-3 text-sm text-red-600 dark:text-red-400"
            >
              {error}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => setDeleting(null)}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-xs dark:border-zinc-700"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={remove}
              className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white"
            >
              {busy === "delete" ? "Deleting…" : "Delete post"}
            </button>
          </div>
        </FeedDialog>
      )}
    </main>
  );
}
