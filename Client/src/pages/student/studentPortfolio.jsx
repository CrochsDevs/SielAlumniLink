import { createElement, useRef, useState } from "react";
import PageTitle from "../../components/ui/PageTitle";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  Plus,
  Award,
  BadgeCheck,
  Presentation,
  FolderKanban,
  FileText,
  Sparkles,
  Pencil,
  Trash2,
  Printer,
  ArrowUpRight,
  Check,
  Mail,
  Eye,
} from "lucide-react";
import { useAuth } from "../../context/useAuth";
import api from "../../utils/axios";
import useDevelopment from "../../hooks/useDevelopment";
import DevelopmentShell, {
  DevelopmentStatus,
} from "../../components/student/DevelopmentShell";
import ProfileAvatar from "../../components/profile/ProfileAvatar";
import PortfolioResume from "../../components/student/PortfolioResume";
import ResumeThemePicker from "../../components/student/ResumeThemePicker";
import ResumePreview from "../../components/student/ResumePreview";
import PortfolioContactDetails from "../../components/student/PortfolioContactDetails";
import { readResumeTheme, validResumeTheme } from "../../utils/resumeThemes";
import { FeedDialog } from "../../components/feed/FeedComposer";

const SECTIONS = [
  {
    key: "skills",
    label: "Skills",
    singular: "skill",
    icon: Sparkles,
    type: "tags",
    hint: "The tools, technologies, and strengths you bring.",
    example: "e.g. JavaScript, one skill at a time",
    color:
      "bg-emerald-50 text-brand dark:bg-emerald-950 dark:text-brand",
  },
  {
    key: "projects",
    label: "Projects",
    singular: "project",
    icon: FolderKanban,
    type: "cards",
    hint: "Show what you have built and the impact of your work.",
    example: "e.g. Campus event management system",
    color: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  {
    key: "research",
    label: "Research Papers",
    singular: "research paper",
    icon: FileText,
    type: "cards",
    hint: "Highlight the questions you explored and what you learned.",
    example: "Research paper title",
    color:
      "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  },
  {
    key: "certifications",
    label: "Certifications",
    singular: "certification",
    icon: BadgeCheck,
    type: "list",
    hint: "Credentials that support your expertise.",
    example: "e.g. AWS Cloud Practitioner - 2026",
    color: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
  {
    key: "seminars",
    label: "Seminars Attended",
    singular: "seminar",
    icon: Presentation,
    type: "list",
    hint: "Keep track of workshops, training, and learning experiences.",
    example: "Seminar title, organizer, and year",
    color: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
  },
  {
    key: "awards",
    label: "Awards",
    singular: "award",
    icon: Award,
    type: "list",
    hint: "Celebrate your achievements and recognition.",
    example: "Award title and year",
    color: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  },
];
const card =
  "rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900";
const primary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-xs font-semibold text-white transition hover:bg-brand disabled:opacity-50";
const field =
  "mt-2 w-full rounded-lg border border-zinc-200 bg-white p-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 dark:border-zinc-700 dark:bg-zinc-900";

export default function StudentPortfolio() {
  const { user, refreshUser } = useAuth();
  const state = useDevelopment();
  const data = Object.fromEntries(
    SECTIONS.map((section) => [
      section.key,
      state.data?.portfolio?.[section.key] || [],
    ]),
  );
  const [aboutOpen, setAboutOpen] = useState(false);
  const [aboutDraft, setAboutDraft] = useState("");
  const [aboutBusy, setAboutBusy] = useState(false);
  const [aboutError, setAboutError] = useState("");
  const [savedAbout, setSavedAbout] = useState(null);
  const aboutPending = useRef(false);
  const accountId = user?.authId || user?._id;
  const [savedContact, setSavedContact] = useState(null);
  const aboutUser =
    savedAbout?.accountId === accountId && savedAbout.sourceBio === user?.bio
      ? { ...user, bio: savedAbout.bio }
      : user;
  const resumeUser = savedContact?.accountId === accountId
    ? { ...aboutUser, ...savedContact.details }
    : aboutUser;
  const openAbout = () => {
    setAboutDraft(resumeUser?.bio || "");
    setAboutError("");
    setAboutOpen(true);
  };
  const saveAbout = async (event) => {
    event.preventDefault();
    if (aboutPending.current) return;
    aboutPending.current = true;
    setAboutBusy(true);
    setAboutError("");
    try {
      const bio = aboutDraft.trim();
      await api.put("/users/me", { bio });
      setSavedAbout({ accountId, sourceBio: user?.bio, bio });
      await refreshUser();
      setAboutOpen(false);
    } catch (error) {
      setAboutError(
        error.response?.data?.message ||
          "Unable to save your about section. Please try again.",
      );
    } finally {
      aboutPending.current = false;
      setAboutBusy(false);
    }
  };
  const [editor, setEditor] = useState(null);
  const [draft, setDraft] = useState({ title: "", desc: "" });
  const [preview, setPreview] = useState(false);
  const [view, setView] = useState("resume");
  const themeKey = `portfolio-resume-theme:${user?.authId || user?._id || "guest"}`;
  const [selection, setSelection] = useState(() => ({
    key: themeKey,
    theme: readResumeTheme(themeKey),
  }));
  const theme = validResumeTheme(
    selection.key === themeKey ? selection.theme : readResumeTheme(themeKey),
  );
  const chooseTheme = (value) => {
    const next = validResumeTheme(value);
    setSelection({ key: themeKey, theme: next });
    try {
      localStorage.setItem(themeKey, next);
    } catch {
      /* Theme still works when browser storage is unavailable. */
    }
  };
  const [removing, setRemoving] = useState(null);
  const filled = SECTIONS.filter((section) => data[section.key].length).length;
  const total = SECTIONS.reduce(
    (count, section) => count + data[section.key].length,
    0,
  );
  const disabled = aboutBusy || state.busy || state.loading || !state.data;
  const startEdit = (section, index = null) => {
    const item = index === null ? null : data[section.key][index];
    setDraft({
      title: typeof item === "string" ? item : item?.title || "",
      desc: item?.desc || "",
    });
    setEditor({ ...section, index });
  };
  const save = async (event) => {
    event.preventDefault();
    if (!draft.title.trim()) return;
    const entry =
      editor.type === "cards"
        ? { title: draft.title.trim(), desc: draft.desc.trim() }
        : draft.title.trim();
    const entries =
      editor.index === null
        ? [...data[editor.key], entry]
        : data[editor.key].map((item, index) =>
            index === editor.index ? entry : item,
          );
    if (await state.mutate("put", `portfolio/${editor.key}`, { entries }))
      setEditor(null);
  };
  const remove = async () => {
    if (
      await state.mutate("put", `portfolio/${removing.key}`, {
        entries: data[removing.key].filter(
          (_, index) => index !== removing.index,
        ),
      })
    )
      setRemoving(null);
  };
  const digitalCertificates = state.data?.digitalCertificates || [];
  const resumePortfolio = {
    ...data,
    certifications: [
      ...data.certifications,
      ...digitalCertificates.map(
        (certificate) =>
          `Certificate of Participation: ${certificate.title} (${certificate.participationDate})`,
      ),
    ],
  };
  const resume = (
    <PortfolioResume
      theme={theme}
      user={resumeUser}
      portfolio={resumePortfolio}
      internships={state.data?.internships || []}
    />
  );
  const controls = (section, index, title) => (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        disabled={disabled}
        aria-label={`Edit ${title}`}
        onClick={() => startEdit(section, index)}
        className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
      >
        <Pencil size={13} />
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-label={`Remove ${title}`}
        onClick={() => setRemoving({ key: section.key, index, title })}
        className="rounded-lg p-2 text-zinc-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-950"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );

  return (
    <DevelopmentShell title="Portfolio">
      <main className="mx-auto max-w-7xl space-y-5 p-3 sm:p-6 workspace-page">
        <DevelopmentStatus state={state} />
        <header className="border-b border-zinc-200 pb-5 pt-1 dark:border-zinc-800 workspace-page-header">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <PageTitle icon={FolderKanban}>
                Portfolio
              </PageTitle>
              <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                Build a formal resume from your profile, experience, and
                achievements.
              </p>
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setPreview(true)}
              className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 self-start rounded-lg border border-zinc-300 bg-white px-4 text-xs font-semibold text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
            >
              <Eye size={15} />
              Preview resume
            </button>
          </div>
          {state.data && (
            <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
              <span>
                {total} {total === 1 ? "entry" : "entries"}
              </span>
              <span
                aria-hidden="true"
                className="h-3 w-px bg-zinc-300 dark:bg-zinc-700"
              />
              <span>{filled} of 6 sections filled</span>
            </p>
          )}
        </header>
        <nav
          aria-label="Portfolio views"
          className="flex gap-5 border-b border-zinc-200 dark:border-zinc-800"
        >
          {[
            ["resume", "Resume"],
            ["edit", "Edit details"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={view === id}
              onClick={() => setView(id)}
              className={`border-b-2 pb-3 text-xs font-semibold ${view === id ? "border-brand text-brand dark:text-brand" : "border-transparent text-zinc-500 dark:text-zinc-400"}`}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-4">
            {view === "resume" ? (
              <section
                aria-label="Your resume"
                className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-200/40 p-3 sm:p-5 dark:border-zinc-800 dark:bg-zinc-800/40"
              >
                {state.loading ? (
                  <p className="p-8 text-center text-sm text-zinc-500">
                    Loading resume...
                  </p>
                ) : state.data ? (
                  <ResumePreview>{resume}</ResumePreview>
                ) : (
                  <p className="p-8 text-center text-sm text-zinc-500">
                    Your saved details will appear here once loaded.
                  </p>
                )}
              </section>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <h2 className="text-sm font-semibold">Your portfolio</h2>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Add experiences as you grow
                  </span>
                </div>
                <section id="digital-certificates" className={`${card} p-5`}>
                  <div className="flex items-center justify-between gap-3">
                    <h2>Digital certificates</h2>
                    <Link
                      to="/student/certificate"
                      className="text-xs font-semibold text-brand"
                    >
                      View certificates
                    </Link>
                  </div>
                  <p className="mt-2 text-xs leading-6 text-zinc-500">
                    Certificates from confirmed events, training, and seminars
                    are stored here automatically.
                  </p>
                  {digitalCertificates.length ? (
                    <ul className="mt-4 space-y-3">
                      {digitalCertificates.map((certificate) => (
                        <li
                          key={certificate._id}
                          className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800"
                        >
                          <span className="block text-xs font-semibold">
                            {certificate.title}
                          </span>
                          <span className="mt-1 block text-[10px] text-zinc-400">
                            {certificate.participationDate} |{" "}
                            {certificate.certificateNumber}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-xs text-zinc-400">
                      No digital certificates issued yet.
                    </p>
                  )}
                </section>
                <section
                  id="about"
                  className={`${card} scroll-mt-24 p-5 sm:p-6`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold">About</h2>
                      <p className="mt-1 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
                        A short introduction about your background, strengths,
                        and career goals. Saved to your profile and used as your
                        resume summary.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={openAbout}
                      className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg border border-zinc-200 px-2.5 text-[11px] font-semibold dark:border-zinc-700"
                    >
                      <Pencil size={13} />
                      {resumeUser?.bio?.trim() ? "Edit about" : "Add about"}
                    </button>
                  </div>
                  {resumeUser?.bio?.trim() ? (
                    <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                      {resumeUser.bio}
                    </p>
                  ) : (
                    <p className="mt-4 text-xs text-zinc-400">
                      Introduce yourself to give your resume a personal summary.
                    </p>
                  )}
                </section>
                <PortfolioContactDetails
                  user={resumeUser}
                  disabled={disabled}
                  onSaved={details => setSavedContact({ accountId, details })}
                  refreshUser={refreshUser}
                />
                {SECTIONS.map((section) => (
                  <section
                    id={section.key}
                    key={section.key}
                    className={`${card} scroll-mt-24 p-5 sm:p-6`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${section.color}`}
                        >
                          {createElement(section.icon, { size: 19 })}
                        </span>
                        <div>
                          <h3 className="text-sm font-semibold">
                            {section.label}
                            <span className="ml-2 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                              {data[section.key].length}
                            </span>
                          </h3>
                          <p className="mt-1 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
                            {section.hint}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={
                          disabled ||
                          data[section.key].length >=
                            (section.key === "skills" ? 10 : 100)
                        }
                        aria-label={`Add ${section.singular}`}
                        onClick={() => startEdit(section)}
                        className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg border border-zinc-200 px-2.5 text-[11px] font-semibold transition hover:border-emerald-300 hover:text-brand disabled:opacity-40 dark:border-zinc-700 dark:hover:text-brand"
                      >
                        <Plus size={14} />
                        Add
                      </button>
                    </div>
                    {!data[section.key].length ? (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => startEdit(section)}
                        className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-200 bg-zinc-50/60 px-4 py-6 text-xs text-zinc-500 transition hover:border-emerald-300 hover:bg-emerald-50/30 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800/30 dark:text-zinc-400"
                      >
                        <Plus size={15} />
                        Add your first {section.singular}
                      </button>
                    ) : (
                      <div
                        className={
                          section.type === "tags"
                            ? "mt-5 flex flex-wrap gap-2"
                            : "mt-5 space-y-3"
                        }
                      >
                        {data[section.key].map((item, index) => {
                          const title =
                            typeof item === "string" ? item : item.title;
                          return section.type === "tags" ? (
                            <div
                              key={index}
                              className="flex max-w-full items-center gap-1 rounded-lg border border-emerald-100 bg-emerald-50/50 py-1 pl-3 pr-1 text-xs font-medium text-brand dark:border-brand dark:bg-emerald-950/30 dark:text-emerald-200"
                            >
                              <span className="break-words">{title}</span>
                              {controls(section, index, title)}
                            </div>
                          ) : (
                            <div
                              key={index}
                              className="rounded-lg border border-zinc-100 p-4 dark:border-zinc-800"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <p className="min-w-0 break-words text-sm font-medium">
                                  {title}
                                </p>
                                {controls(section, index, title)}
                              </div>
                              {item.desc && (
                                <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-zinc-500 dark:text-zinc-400">
                                  {item.desc}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {section.key === "skills" && (
                      <p className="mt-3 text-[10px] text-zinc-400">
                        Choose up to 10 skills that best represent you.
                      </p>
                    )}
                  </section>
                ))}
              </>
            )}
          </div>
          <aside className="space-y-4 lg:sticky lg:top-20">
            <Link
              to="/student/certificate"
              className={`${card} flex items-center justify-between gap-3 p-5 text-xs font-semibold`}
            >
              <span>Digital certificates ({digitalCertificates.length})</span>
              <ArrowUpRight size={14} />
            </Link>
            <section className={`${card} p-5`}>
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-50 text-lg font-semibold text-brand dark:bg-emerald-950">
                  <ProfileAvatar user={user} />
                </span>
                <div className="min-w-0">
                  <h2 className="break-words text-sm font-semibold">
                    {user?.name || "Student"}
                  </h2>
                  <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                    {user?.program || "Student portfolio"}
                  </p>
                </div>
              </div>
              {(resumeUser?.contactEmail ?? resumeUser?.email) && (
                <p className="mt-4 flex items-start gap-2 break-all text-[11px] text-zinc-500 dark:text-zinc-400">
                  <Mail size={13} className="mt-0.5 shrink-0" />
                  {resumeUser.contactEmail ?? resumeUser.email}
                </p>
              )}
              <Link
                to={user?.role === "alumni" ? "/alumni/accounts" : "/student/accounts"}
                className="mt-4 inline-flex items-center gap-1 text-[11px] font-semibold text-brand dark:text-brand"
              >
                Update profile details
                <ArrowUpRight size={13} />
              </Link>
            </section>
            <section className={`${card} p-5`}>
              <ResumeThemePicker value={theme} onChange={chooseTheme} />
              <p className="mt-3 text-[10px] leading-5 text-zinc-500 dark:text-zinc-400">
                Your choice is remembered on this browser and applied to the
                printed resume.
              </p>
            </section>
            <section className={`${card} p-5`}>
              <h2 className="text-sm font-semibold">Print your resume</h2>
              <p className="mt-2 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
                Review your details before printing. Choose Save as PDF in the
                print dialog to download a copy.
              </p>
              <button
                type="button"
                disabled={disabled}
                onClick={() => setPreview(true)}
                className={`${primary} mt-4 w-full`}
              >
                <Printer size={15} />
                Preview &amp; print
              </button>
            </section>
            <nav aria-label="Portfolio sections" className={`${card} p-5`}>
              <h2 className="mb-3 text-xs font-semibold">
                Portfolio checklist
              </h2>
              <a
                href="#contact-details"
                onClick={event => {
                  event.preventDefault();
                  setView('edit');
                  requestAnimationFrame(() => document.getElementById('contact-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
                }}
                className="flex items-center justify-between rounded-lg py-2 text-xs text-zinc-500 dark:text-zinc-400"
              >
                Contact &amp; links
                <Plus size={14} />
              </a>
              <a
                href="#about"
                onClick={(event) => {
                  event.preventDefault();
                  setView("edit");
                  requestAnimationFrame(() =>
                    document
                      .getElementById("about")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                  );
                }}
                className="flex items-center justify-between rounded-lg py-2 text-xs text-zinc-500 dark:text-zinc-400"
              >
                About
                {resumeUser?.bio?.trim() ? (
                  <Check size={14} className="text-brand" />
                ) : (
                  <span className="h-3 w-3 rounded-full border border-zinc-300 dark:border-zinc-600" />
                )}
              </a>
              {SECTIONS.map((section) => (
                <a
                  key={section.key}
                  href={`#${section.key}`}
                  onClick={(event) => {
                    event.preventDefault();
                    setView("edit");
                    requestAnimationFrame(() =>
                      document.getElementById(section.key)?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      }),
                    );
                  }}
                  className="flex items-center justify-between rounded-lg py-2 text-xs text-zinc-500 hover:text-brand dark:text-zinc-400 dark:hover:text-brand"
                >
                  {section.label}
                  {data[section.key].length ? (
                    <Check size={14} className="text-brand" />
                  ) : (
                    <span className="h-3 w-3 rounded-full border border-zinc-300 dark:border-zinc-600" />
                  )}
                </a>
              ))}
            </nav>
          </aside>
        </div>
      </main>
      {aboutOpen && (
        <FeedDialog
          title="About you"
          busy={aboutBusy}
          onClose={() => setAboutOpen(false)}
        >
          <form onSubmit={saveAbout}>
            <fieldset disabled={aboutBusy} className="space-y-4">
              <p className="text-xs leading-6 text-zinc-500 dark:text-zinc-400">
                This introduction also appears in your profile and the Summary
                section of your resume.
              </p>
              <label className="block text-xs font-medium">
                About
                <textarea
                  autoFocus
                  rows={6}
                  maxLength={2000}
                  value={aboutDraft}
                  onChange={(event) => setAboutDraft(event.target.value)}
                  placeholder="Describe your field of study, strengths, experience, and the opportunities you are looking for."
                  className={field}
                />
              </label>
              <p className="text-right text-[10px] text-zinc-400">
                {aboutDraft.length} / 2,000
              </p>
              {aboutError && (
                <p role="alert" className="text-xs text-red-600">
                  {aboutError}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAboutOpen(false)}
                  className="rounded-lg px-4 py-2 text-xs text-zinc-500"
                >
                  Cancel
                </button>
                <button type="submit" className={primary}>
                  {aboutBusy ? "Saving..." : "Save about"}
                </button>
              </div>
            </fieldset>
          </form>
        </FeedDialog>
      )}
      {editor && (
        <FeedDialog
          title={`${editor.index === null ? "Add" : "Edit"} ${editor.singular}`}
          busy={state.busy}
          onClose={() => setEditor(null)}
        >
          <form onSubmit={save}>
            <fieldset disabled={state.busy} className="space-y-4">
              <p className="text-xs leading-6 text-zinc-500 dark:text-zinc-400">
                {editor.hint}
              </p>
              <label className="block text-xs font-medium">
                {editor.type === "cards" ? "Title" : "Name"} *
                <input
                  autoFocus
                  required
                  maxLength={editor.type === "cards" ? 200 : 300}
                  value={draft.title}
                  onChange={(event) =>
                    setDraft({ ...draft, title: event.target.value })
                  }
                  placeholder={editor.example}
                  className={field}
                />
              </label>
              {editor.type === "cards" && (
                <label className="block text-xs font-medium">
                  Description
                  <textarea
                    rows={4}
                    maxLength={2000}
                    value={draft.desc}
                    onChange={(event) =>
                      setDraft({ ...draft, desc: event.target.value })
                    }
                    placeholder="Describe your contribution, the tools you used, and the result."
                    className={field}
                  />
                </label>
              )}
              {state.error && (
                <p role="alert" className="text-xs text-red-600">
                  {state.error}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditor(null)}
                  className="rounded-lg px-4 py-2 text-xs text-zinc-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!draft.title.trim()}
                  className={primary}
                >
                  {state.busy ? "Saving..." : "Save entry"}
                </button>
              </div>
            </fieldset>
          </form>
        </FeedDialog>
      )}
      {removing && (
        <FeedDialog
          title="Remove this entry?"
          busy={state.busy}
          onClose={() => setRemoving(null)}
        >
          <p className="break-words text-sm text-zinc-500">
            {removing.title} will be removed from your portfolio and resume.
          </p>
          {state.error && (
            <p role="alert" className="mt-3 text-xs text-red-600">
              {state.error}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              disabled={state.busy}
              onClick={() => setRemoving(null)}
              className="rounded-lg px-4 py-2 text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={state.busy}
              onClick={remove}
              className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white"
            >
              {state.busy ? "Removing..." : "Remove entry"}
            </button>
          </div>
        </FeedDialog>
      )}
      {preview && (
        <FeedDialog
          wide
          title="Resume preview"
          onClose={() => setPreview(false)}
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
            <p className="max-w-sm text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              Includes saved profile and portfolio details. Select Save as PDF
              in the print dialog to download a copy.
            </p>
            <button
              type="button"
              disabled={disabled}
              onClick={() => window.print()}
              className={primary}
            >
              <Printer size={15} />
              Print / Save as PDF
            </button>
          </div>
          <div className="mb-4">
            <ResumeThemePicker compact value={theme} onChange={chooseTheme} />
          </div>
          <div className="overflow-hidden rounded-lg border border-zinc-200 shadow-sm">
            <ResumePreview>{resume}</ResumePreview>
          </div>
        </FeedDialog>
      )}
      {state.data &&
        createPortal(
          <div className="student-resume-print">{resume}</div>,
          document.body,
        )}
    </DevelopmentShell>
  );
}
