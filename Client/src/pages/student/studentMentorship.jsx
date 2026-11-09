import { useEffect, useRef, useState } from "react";
import ContentSkeleton from "../../components/ui/Skeleton";
import PageTitle from "../../components/ui/PageTitle";
import { Search, Users, Check, ArrowRight, SlidersHorizontal, Compass, Target } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import { useChat } from "../../context/useChat.js";
import DevelopmentShell from "../../components/student/DevelopmentShell";
import StudentMentorCard from "../../components/mentorship/StudentMentorCard";
import "./studentMentorship.css";
import DataPagination from "../../components/ui/data-pagination";
import api from "../../utils/axios";
import MentorshipProgressTracker from "../../components/mentorship/MentorshipProgressTracker";
import MentorMatching from "../../components/mentorship/MentorMatching";
import { mentorConnectionStates, mentorKey } from "../../components/mentorship/connectionStates";
import { getSocket } from "../../realtime/socket";
const card = "rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900";
const primary = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-xs font-semibold text-white transition hover:bg-brand disabled:opacity-50";
export default function StudentMentorship() {
  const {
    user
  } = useAuth();
  const {
    openChatByEmail, openChatByAuthId
  } = useChat();
  const [workspace, setWorkspace] = useState("matching");
  const [progressPartner, setProgressPartner] = useState('');
  const [editCareer, setEditCareer] = useState(false);
  const [mentors, setMentors] = useState([]);
  const ownerKey = String(user?.authId || user?._id || user?.email || "");
  const [connectionState, setConnectionState] = useState({ owner: "", states: {} });
  const states = connectionState.owner === ownerKey ? connectionState.states : {};
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [view, setView] = useState("all");
  const [program, setProgram] = useState("");
  const [sending, setSending] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const pending = useRef(false);
  useEffect(() => {
    let active = true;
    let generation = 0;
    const applyConnections = connections => setConnectionState({ owner: ownerKey, states: mentorConnectionStates(connections, { authId: ownerKey, email: user?.email }) });
    const refreshConnections = async () => {
      const request = ++generation;
      try {
        const response = await api.get("/connections/me");
        if (active && request === generation) {
          applyConnections(response.data.data || []);
          setError("");
        }
      } catch {
        if (active && request === generation) {
          applyConnections([]);
          setError("Unable to verify connection status. Please refresh mentors.");
        }
      }
    };
    const initialRequest = ++generation;
    Promise.all([api.get("/users", {
      params: {
        role: "alumni"
      }
    }), api.get("/connections/me")]).then(([usersRes, connsRes]) => {
      if (!active) return;
      setMentors((usersRes.data.data || []).filter(mentor => (mentor.authId || mentor.email) && String(mentor.authId || mentor.email) !== String(user?.authId || user?.email) && mentor.role?.toLowerCase() === "alumni"));
      if (initialRequest === generation) {
        applyConnections(connsRes.data.data || []);
        setError("");
      }
    }).catch(() => {
      if (active) setError("Unable to load mentors and connection requests. Please try again.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    const socket = getSocket();
    socket.on("feed:changed", refreshConnections);
    socket.on("connect", refreshConnections);
    window.addEventListener("focus", refreshConnections);
    return () => {
      active = false;
      socket.off("feed:changed", refreshConnections);
      socket.off("connect", refreshConnections);
      window.removeEventListener("focus", refreshConnections);
    };
  }, [ownerKey, user?.email, user?.authId, attempt]);
  const connect = async mentor => {
    if (pending.current) return;
    pending.current = true;
    setSending(mentorKey(mentor));
    setError("");
    setNotice("");
    try {
      await api.post("/connections", {
        ...(mentor.authId ? { recipientAuthId: String(mentor.authId) } : { email: mentor.email })
      });
      setConnectionState(previous => ({ owner: ownerKey, states: {
        ...(previous.owner === ownerKey ? previous.states : {}),
        [mentorKey(mentor)]: "pending"
      } }));
      setNotice(`Request sent to ${mentor.name || mentor.email}. You can message them once they accept.`);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to send the request. Please try again.");
    } finally {
      pending.current = false;
      setSending(null);
    }
  };
  const message = async mentor => {
    try {
      if (mentor.authId) await openChatByAuthId(mentor.authId);
      else await openChatByEmail(mentor.email);
    } catch {
      setError("Unable to open the conversation. Please try again.");
    }
  };
  const connected = mentors.filter(mentor => states[mentorKey(mentor)] === "connected").length;
  const requested = mentors.filter(mentor => ["pending", "incoming"].includes(states[mentorKey(mentor)])).length;
  const programs = [...new Set(mentors.map(mentor => mentor.program).filter(Boolean))].sort();
  const filtered = mentors.filter(mentor => (!program || mentor.program === program) && (view === "all" || (view === "connected" ? states[mentorKey(mentor)] === "connected" : ["pending", "incoming"].includes(states[mentorKey(mentor)]))) && [mentor.name, mentor.email, mentor.program, ...(mentor.skills || [])].filter(Boolean).join(" ").toLowerCase().includes(query.trim().toLowerCase()));
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);
  const reset = () => {
    setQuery("");
    setProgram("");
    setView("all");
    setPage(1);
  };
  const activeWorkspace = workspace === "mentors" && view === "all" ? "matching" : workspace;
  return <DevelopmentShell title="Mentorship">
      <main className="mx-auto max-w-7xl space-y-6 p-3 sm:p-6 workspace-page mentorship-page">
        <header className="flex flex-col gap-5 border-b border-zinc-200 pb-5 pt-1 sm:flex-row sm:items-end sm:justify-between dark:border-zinc-800 workspace-page-header">
          <div className="min-w-0">
            <PageTitle icon={Users}>
              Mentorship
            </PageTitle>
            <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              Find guidance, connect with a mentor, and take your next step.
            </p>
          </div>
        </header>
        <nav aria-label="Student mentorship workspace" className="mentorship-tabs grid grid-cols-3 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          {[["matching", "Find a mentor", "Discover alumni who can guide you", Compass], ["mentors", "My mentors", "Connections and pending requests", Users], ["progress", "My progress", "Goals, activities, and feedback", Target]].map(([id, label, description, Icon]) => (
            <button key={id} type="button" aria-pressed={activeWorkspace === id} onClick={() => {
              setWorkspace(id);
              setEditCareer(false);
              if (id === "mentors") {
                setView("connected");
                setQuery("");
                setProgram("");
                setPage(1);
              }
            }} className={`mentorship-tab ${activeWorkspace === id ? "text-brand" : "text-zinc-500 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800"}`}>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${activeWorkspace === id ? "bg-brand/10" : "bg-zinc-100 dark:bg-zinc-800"}`}><Icon size={19} /></span>
              <span className="min-w-0"><span className="block text-xs font-semibold sm:text-sm">{label}</span><span className="mt-1 hidden text-xs leading-5 text-zinc-500 lg:block dark:text-zinc-400">{description}</span></span>
            </button>
          ))}
        </nav>
        {workspace === "matching" ? <MentorMatching key={user?.email} mentorProfiles={mentors} states={states} connect={connect} message={message} sending={sending} connectionsLoading={loading} connectionError={error} notice={notice} initialEdit={editCareer} onBrowse={() => {
        setWorkspace('mentors');
        setView('all');
        setQuery('');
        setProgram('');
        setPage(1);
      }} onProgress={mentor => {
        setProgressPartner(mentors.find(item => item._id === mentor._id)?.authId || '');
        setWorkspace('progress');
      }} /> : workspace === "progress" ? <MentorshipProgressTracker initialPartnerAuthId={progressPartner} onFindMentors={() => {
        setEditCareer(false);
        setWorkspace('matching');
      }} onCareerPlanning={() => {
        setEditCareer(true);
        setWorkspace('matching');
      }} /> : <div className="space-y-5">
            <section className="min-w-0 space-y-4" aria-label="Alumni mentors">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">{view === 'all' ? 'Explore all mentors' : view === 'connected' ? 'Your mentors' : 'Your connection requests'}</h2><p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{view === 'connected' ? 'Start a conversation or continue working on your goals.' : 'Explore an alumni profile before sending a connection request.'}</p></div><button type="button" onClick={() => setWorkspace('matching')} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand dark:text-brand">{view === 'all' ? 'Back to recommendations' : 'Find another mentor'}<ArrowRight size={15} /></button></div>
              <div className={`${card} overflow-hidden`}>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-4 pt-2 dark:border-zinc-800 sm:px-5">
                <nav aria-label="Mentor views" className="flex max-w-full gap-4 overflow-x-auto">
                  {[["all", "All mentors", mentors.length], ["connected", "Connected", connected], ["pending", "Requests", requested]].map(([id, label, count]) => <button key={id} type="button" aria-pressed={view === id} onClick={() => {
                setView(id);
                setPage(1);
              }} className={`flex shrink-0 items-center gap-2 border-b-2 py-2 text-xs font-semibold ${view === id ? "border-brand text-brand dark:text-brand" : "border-transparent text-zinc-500 dark:text-zinc-400"}`}>
                      {label}
                      <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                        {count}
                      </span>
                    </button>)}
                </nav>
                </div>
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
                  <label className="relative block min-w-0 flex-1">
                    <span className="sr-only">Search mentors</span>
                    <Search size={17} className="pointer-events-none absolute left-3.5 top-3.5 text-zinc-400" />
                    <input type="search" value={query} onChange={event => {
                      setQuery(event.target.value);
                      setPage(1);
                    }} placeholder="Search name, program, or skill" className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 dark:border-zinc-700 dark:bg-zinc-950" />
                  </label>
                <label className="flex min-w-0 items-center gap-2 text-zinc-400 sm:w-64">
                  <SlidersHorizontal size={14} />
                  <span className="sr-only">Filter by program</span>
                  <select value={program} onChange={event => {
                setProgram(event.target.value);
                setPage(1);
              }} className="h-11 min-w-0 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-600 outline-none focus:border-brand dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                    <option value="">All programs</option>
                    {programs.map(value => <option key={value}>{value}</option>)}
                  </select>
                </label>
                </div>
              </div>
              {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                  {error}{" "}
                  <button type="button" onClick={() => {
              setLoading(true);
              setAttempt(value => value + 1);
            }} className="font-semibold underline">
                    Refresh mentors
                  </button>
                </div>}
              {notice && <p role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs leading-5 text-brand dark:border-brand dark:bg-zinc-800 dark:text-emerald-200">
                  <Check size={16} className="mt-0.5 shrink-0" />
                  {notice}
                </p>}
              {loading ? <ContentSkeleton variant="cards" label="Finding alumni" /> : <>
                  <div className="flex items-center justify-between gap-2 px-1">
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {filtered.length}{" "}
                      {filtered.length === 1 ? "alumnus" : "alumni"}
                      {view === "connected" ? " connected with you" : view === "pending" ? " with pending requests" : " to explore"}
                    </p>
                    {(query || program) && <button type="button" onClick={reset} className="text-[11px] font-medium text-brand dark:text-brand">
                        Clear filters
                      </button>}
                  </div>
                  {!filtered.length && <div className={`${card} p-10 text-center`}>
                      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-brand dark:bg-zinc-800">
                        <Users size={26} />
                      </span>
                      <h2 className="mt-4 text-sm font-semibold">
                        {view === "connected" ? "Your connections start here" : view === "pending" ? "No pending requests" : "No alumni found"}
                      </h2>
                      <p className="mx-auto mt-2 max-w-xs text-xs leading-6 text-zinc-500 dark:text-zinc-400">
                        {query || program ? "Try a different name, skill, or program." : "Explore the alumni community and reach out to someone whose experience interests you."}
                      </p>
                      <button type="button" onClick={reset} className={`${primary} mt-5`}>
                        Explore alumni
                        <ArrowRight size={14} />
                      </button>
                    </div>}
                  <div className="mentorship-directory-grid">
                    {paged.map(mentor => <StudentMentorCard key={mentor._id} mentor={mentor}
                      status={states[mentorKey(mentor)]} connect={connect} message={message} sending={sending} disabled={!!error}
                      onProgress={item => {
                        setProgressPartner(item.authId || "");
                        setWorkspace("progress");
                      }} />)}
                  </div>
                  {!!filtered.length && <div className={`${card} overflow-hidden`}>
                      <DataPagination page={currentPage} totalPages={totalPages} onPageChange={setPage} perPage={perPage} onPerPageChange={value => {
                setPerPage(value);
                setPage(1);
              }} totalItems={filtered.length} itemLabel="alumni" />
                    </div>}
                </>}
            </section>

          </div>}
      </main>
    </DevelopmentShell>;
}
