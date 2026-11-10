import ContentSkeleton from "../../components/ui/Skeleton";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { gooeyToast as toast } from "goey-toast";
import {
  MessageSquare,
  ClipboardCheck,
  BadgeCheck,
  GraduationCap,
  Users,
  UserPlus,
  Check,
  X,
  Megaphone,
} from "lucide-react";
import { useAuth } from "../../context/useAuth";
import { useChat } from "../../context/useChat.js";
import AlumniSidebar from "../../layout/sidebar/alumni/alumniSidebar";
import AlumniTopbar from "../../layout/topbar/alumni/alumniTopbar";
import ProfileAvatar from "../../components/profile/ProfileAvatar";
import { profilePath } from "../../components/search/searchLinks";
import api from "../../utils/axios";
import AlumniFeed from "../../components/feed/AlumniFeed";
import { FeedDialog } from "../../components/feed/FeedComposer";
import "./alumniDashboard.css";

const AlumniDashboard = () => {
  const { user } = useAuth();
  const { openChatByEmail } = useChat();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [dashTab, setDashTab] = useState("feed");
  const [mentees, setMentees] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [menteesLoading, setMenteesLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [suggestionsError, setSuggestionsError] = useState("");
  const [connecting, setConnecting] = useState(null);
  const connectPending = useRef(false);
  const [announcements, setAnnouncements] = useState([]);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [showConnections, setShowConnections] = useState(false);
  const [connections, setConnections] = useState([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [connectionsError, setConnectionsError] = useState("");
  const [profileStats, setProfileStats] = useState({
    program: "",
    batch: "",
    viewers: 0,
    connections: 0,
  });

  const loadConnections = async () => {
    setConnectionsLoading(true);
    setConnectionsError("");
    try {
      const [connsRes, usersRes] = await Promise.all([
        api.get("/connections/me"),
        api.get("/users"),
      ]);
      const normalize = (email) =>
        String(email || "")
          .trim()
          .toLowerCase();
      const byEmail = new Map(
        (usersRes.data.data || []).map((p) => [normalize(p.email), p]),
      );
      const byAuthId = new Map((usersRes.data.data || []).filter(p => p.authId).map(p => [String(p.authId), p]));
      const peers = (connsRes.data.data || [])
        .filter((c) => c.status === "accepted")
        .map(c => {
          const outgoing = String(c.requesterAuthId) === String(user?.authId) || normalize(c.requesterEmail) === normalize(user?.email);
          const authId = outgoing ? c.recipientAuthId : c.requesterAuthId;
          const email = outgoing ? c.recipientEmail : c.requesterEmail;
          return { email, authId, ...(byAuthId.get(String(authId)) || byEmail.get(normalize(email)) || { name: email }) };
        });
      setConnections(
        [...new Map(peers.map(person => [person.authId || person.email, person])).values()],
      );
    } catch (err) {
      setConnectionsError(
        err.response?.data?.message || "Unable to load connections.",
      );
    } finally {
      setConnectionsLoading(false);
    }
  };

  // Connected students (mentees) + pending request count.
  const loadMentees = useCallback(async () => {
    setMenteesLoading(true);
    try {
      const [connsRes, usersRes] = await Promise.all([
        api.get("/connections/me"),
        api.get("/users"),
      ]);
      const roleByEmail = {};
      const roleByAuthId = {};
      (usersRes.data.data || []).forEach((u) => {
        roleByEmail[u.email] = u;
        if (u.authId) roleByAuthId[String(u.authId)] = u;
      });
      const mine = String(user?.email);
      const accepted = (connsRes.data.data || []).filter(
        (c) => c.status === "accepted",
      );
      setMentees(
        accepted
          .map(c => {
            const outgoing = String(c.requesterAuthId) === String(user?.authId) || c.requesterEmail === mine;
            const email = outgoing ? c.recipientEmail : c.requesterEmail;
            const authId = outgoing ? c.recipientAuthId : c.requesterAuthId;
            return { email, authId, ...(roleByAuthId[String(authId)] || roleByEmail[email]) };
          }).filter(person => person.role === 'student'),
      );
      const pending = await api
        .get("/connections/requests")
        .catch(() => ({ data: { data: [] } }));
      setPendingCount((pending.data.data || []).length);
    } catch (err) {
      toast.error("Error", {
        description: err.response?.data?.message || "Failed to load mentees",
      });
    } finally {
      setMenteesLoading(false);
    }
  }, [user]);

  const loadRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const res = await api.get("/connections/requests");
      setRequests(res.data.data || []);
      setPendingCount((res.data.data || []).length);
    } catch {
      // ignore
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  const loadSuggestions = useCallback(async () => {
    setSuggestionsLoading(true);
    setSuggestionsError("");
    try {
      const [usersRes, connsRes] = await Promise.all([
        api.get("/users", { params: { role: "alumni" } }),
        api.get("/connections/me"),
      ]);
      const normalizeEmail = (email) =>
        String(email || "")
          .trim()
          .toLowerCase();
      const connections = connsRes.data.data || [];
      const connectedIds = new Set(
        connections
          .flatMap((c) => [c.requesterAuthId, c.recipientAuthId])
          .filter(Boolean)
          .map(String),
      );
      const connectedEmails = new Set(
        connections
          .flatMap((c) => [c.requesterEmail, c.recipientEmail])
          .filter(Boolean)
          .map(normalizeEmail),
      );
      const list = (usersRes.data.data || [])
        .filter(
          (u) =>
            (u.authId || u.email) &&
            u.role === "alumni" &&
            String(u._id) !== String(user?._id) &&
            (!u.authId || String(u.authId) !== String(user?.authId)) &&
            normalizeEmail(u.email) !== normalizeEmail(user?.email) &&
            (!u.authId || !connectedIds.has(String(u.authId))) &&
            !connectedEmails.has(normalizeEmail(u.email)),
        )
        .slice(0, 5);
      setSuggestions(list);
    } catch {
      setSuggestionsError("Unable to load suggestions. Please try again.");
    } finally {
      setSuggestionsLoading(false);
    }
  }, [user?._id, user?.authId, user?.email]);

  const loadAnnouncements = useCallback(async () => {
    try {
      const res = await api.get("/announcements");
      const all = res.data.data || [];
      const filtered = all.filter(
        (a) => a.audience === "all" || a.audience === "alumni",
      );
      setAnnouncements(filtered.slice(0, 5));
    } catch {
      // ignore
    }
  }, []);

  const loadProfileStats = useCallback(async () => {
    try {
      const [profileRes, connsRes] = await Promise.all([
        api.get("/users/me"),
        api.get("/connections/me"),
      ]);
      const p = profileRes.data.data || {};
      const connections = (connsRes.data.data || []).filter(
        (c) => c.status === "accepted",
      ).length;
      setProfileStats({
        program: p.program || "BS Program",
        batch: p.batch || "20XX",
        viewers: p.profileViews || 0,
        connections,
      });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      loadRequests();
      loadAnnouncements();
      loadProfileStats();
    });
  }, [loadRequests, loadAnnouncements, loadProfileStats]);

  useEffect(() => {
    // Fetch suggestions when the signed-in account changes.
    Promise.resolve().then(loadSuggestions);
  }, [loadSuggestions]);

  useEffect(() => {
    if (dashTab === "mentorship") Promise.resolve().then(loadMentees);
  }, [dashTab, loadMentees]);

  const handleRespond = async (id, status) => {
    try {
      await api.put(`/connections/${id}`, { status });
      setRequests((prev) => prev.filter((r) => String(r._id) !== String(id)));
      setPendingCount((prev) => Math.max(0, prev - 1));
      toast.info(status === "accepted" ? "Connected!" : "Declined", {
        description:
          status === "accepted"
            ? "You can now chat with each other."
            : undefined,
      });
      loadSuggestions();
      loadProfileStats();
      if (dashTab === "mentorship") loadMentees();
    } catch (err) {
      toast.error("Error", {
        description: err.response?.data?.message || "Failed to respond",
      });
    }
  };

  const handleConnect = async (person) => {
    if (connectPending.current) return;
    connectPending.current = true;
    setConnecting(person.authId || person.email);
    try {
      const recipient = /^[a-f\d]{24}$/i.test(String(person.authId || ""))
        ? { recipientAuthId: String(person.authId) }
        : { email: person.email };
      await api.post("/connections", recipient);
      setSuggestions((prev) => prev.filter((s) => s._id !== person._id));
      toast.success("Request sent");
    } catch (err) {
      if (err.response?.status === 409) await loadSuggestions();
      toast.error("Error", {
        description: err.response?.data?.message || "Failed to send request",
      });
    } finally {
      connectPending.current = false;
      setConnecting(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f6f3] dark:bg-zinc-950">
      <AlumniSidebar
        user={user}
        mobileOpen={sidebarOpen}
        setMobileOpen={setSidebarOpen}
      />

      <div className="lg:pl-64">
        <AlumniTopbar
          user={user}
          title="Dashboard"
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="mx-auto grid max-w-7xl gap-4 p-3 sm:p-5 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_280px] workspace-page">
          {/* LEFT: Sieles ID card */}
          <aside className="alumni-dashboard-rail alumni-dashboard-profile-rail order-2 min-w-0 space-y-3 lg:order-none lg:self-start">
            <div className="overflow-hidden rounded-2xl border border-brand/10 bg-white dark:bg-zinc-900 shadow-sm">
              <div className="h-16 overflow-hidden bg-gradient-to-r from-brand via-brand to-brand dark:from-zinc-900 dark:to-zinc-900 dark:via-zinc-900">
                {user?.bannerImage && (
                  <img
                    src={user.bannerImage}
                    alt="Profile banner"
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="px-4 pb-4 text-center">
                <div className="relative mx-auto -mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-white dark:bg-zinc-900 text-xl font-extrabold text-brand dark:text-brand shadow ring-2 ring-emerald-100 dark:ring-brand">
                  <ProfileAvatar user={user} fallback="A" />
                </div>
                <p className="mt-2 flex items-center justify-center gap-1 text-[14px] font-bold text-zinc-900 dark:text-zinc-100">
                  <span className="truncate">{user?.name || "Alumni"}</span>
                  <BadgeCheck className="h-4 w-4 shrink-0 text-brand dark:text-brand" />
                </p>
                <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400">
                  {profileStats.program}
                  {profileStats.batch ? ` • Batch ${profileStats.batch}` : ""}
                </p>
                <span className="alumni-verified-badge mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand">
                  <GraduationCap className="h-3 w-3" />
                  Verified Alumni
                </span>
                <div className="mt-3 space-y-1 border-t border-zinc-100 dark:border-zinc-800 pt-3 text-left text-[11.5px]">
                  <button
                    type="button"
                    onClick={() => {
                      setShowConnections(true);
                      loadConnections();
                    }}
                    className="flex w-full justify-between py-0.5 text-zinc-500 dark:text-zinc-400 transition hover:text-brand dark:text-brand"
                  >
                    <span>Total Connections</span>
                    <span className="font-bold text-brand dark:text-brand">
                      {profileStats.connections}
                    </span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/alumni/profile")}
                  className="mt-3 w-full rounded-xl bg-brand py-2 text-[12px] font-bold text-white transition hover:bg-brand"
                >
                  View Profile
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-brand/10 bg-gradient-to-br from-brand to-brand p-4 text-white shadow-sm dark:from-zinc-900 dark:to-zinc-900">
              <p className="flex items-center gap-1.5 text-[12.5px] font-bold">
                <ClipboardCheck className="h-4 w-4" />
                Tracer Study
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-white/70">
                Update your details every quarter to keep university records
                current. Takes about 3 minutes.
              </p>
              <button
                type="button"
                onClick={() => navigate("/alumni/tracer")}
                className="mt-3 w-full rounded-xl bg-white dark:bg-zinc-900 py-2 text-[12px] font-bold text-brand transition hover:bg-emerald-50"
              >
                Update Tracer Study
              </button>
            </div>
          </aside>

          {/* CENTER */}
          <section className="order-1 min-w-0 space-y-3 lg:order-none">
            {/* Feed / Mentorship tabs */}
            <div className="flex gap-1.5">
              {[
                { key: "feed", label: "Feed" },
                { key: "mentorship", label: "Mentorship" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDashTab(key)}
                  className={`rounded-full px-4 py-2 text-[12.5px] font-bold transition ${
                    dashTab === key
                      ? "bg-brand text-white shadow-sm"
                      : "bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {dashTab === "mentorship" ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-brand/10 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5 shadow-sm">
                  <h3 className="flex items-center gap-2 text-[14px] font-extrabold text-zinc-900 dark:text-zinc-100">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/10 dark:bg-brand/20 text-brand dark:text-brand">
                      <Users className="h-3.5 w-3.5" />
                    </span>
                    My Mentees
                    <span className="rounded-full bg-emerald-50 dark:bg-zinc-800 px-2 py-0.5 text-[10.5px] font-bold text-brand dark:text-brand">
                      {mentees.length} connected students
                    </span>
                  </h3>
                  {menteesLoading ? (
                    <ContentSkeleton variant="list" count={3} label="Loading mentees..." />
                  ) : mentees.length === 0 ? (
                    <p className="py-4 text-center text-[12.5px] text-zinc-400">
                      No connected students yet. Accept requests to mentor them
                      here.
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {mentees.map((m) => (
                        <li
                          key={m.email}
                          className="flex items-center gap-3 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-3"
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 dark:bg-brand/20 text-sm font-bold text-brand dark:text-brand">
                            {m.profilePicture ? (
                              <img
                                src={m.profilePicture}
                                alt={`${m.name || "Student"} profile picture`}
                                className="h-full w-full rounded-full object-cover"
                              />
                            ) : (
                              (m.name || "S").charAt(0).toUpperCase()
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-bold text-zinc-900 dark:text-zinc-100">
                              {m.name}
                            </span>
                            <span className="block truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                              {m.email}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => openChatByEmail(m.email)}
                            className="flex shrink-0 items-center gap-1.5 rounded-full bg-brand px-3.5 py-1.5 text-[11.5px] font-bold text-white transition hover:bg-brand"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            Chat
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate("/alumni/requests")}
                    className="mt-3 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 py-2.5 text-[12.5px] font-bold text-zinc-600 dark:text-zinc-300 transition hover:border-brand hover:text-brand dark:hover:text-brand"
                  >
                    View invitations
                    {pendingCount > 0 ? ` (${pendingCount} pending)` : ""}
                  </button>
                </div>
              </div>
            ) : (
              <AlumniFeed />
            )}
          </section>

          {/* RIGHT: Connection requests + Suggested connects */}
          <aside className="alumni-dashboard-rail alumni-dashboard-community-rail order-3 min-w-0 space-y-3 lg:order-none lg:col-span-2 xl:col-span-1 xl:self-start">
            <div className="overflow-hidden rounded-2xl border border-brand/10 bg-white dark:bg-zinc-900 shadow-sm">
              <div className="bg-gradient-to-r from-brand to-brand px-4 py-2.5 dark:from-zinc-900 dark:to-zinc-900">
                <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-white">
                  <UserPlus className="h-3.5 w-3.5" />
                  Connection Requests
                  {pendingCount > 0 && (
                    <span className="ml-auto rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold">
                      {pendingCount}
                    </span>
                  )}
                </p>
              </div>
              <div className="p-3">
                {requestsLoading ? (
                  <ContentSkeleton variant="list" count={3} label="Loading..." />
                ) : requests.length === 0 ? (
                  <p className="py-3 text-center text-[11.5px] text-zinc-400">
                    No pending requests
                  </p>
                ) : (
                  <ul className="space-y-2.5">
                    {requests.slice(0, 3).map((r) => {
                      const ProfileLink = r.profileId ? Link : "span";
                      const profileLinkProps = r.profileId
                        ? {
                            to: profilePath({ _id: r.profileId, role: r.role }),
                            "aria-label": `View ${r.name || "user"} profile`,
                          }
                        : {};
                      return (
                        <li key={r._id} className="rounded-xl p-2.5">
                          <div className="flex items-center gap-2">
                            <ProfileLink
                              {...profileLinkProps}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 dark:bg-brand/20 text-[11px] font-bold text-brand dark:text-brand"
                            >
                              <ProfileAvatar user={r} />
                            </ProfileLink>
                            <div className="min-w-0 flex-1">
                              <ProfileLink
                                {...profileLinkProps}
                                className="block truncate text-[12px] font-bold text-zinc-900 dark:text-zinc-100 hover:underline"
                              >
                                {r.name}
                              </ProfileLink>
                              <p className="truncate text-[10px] text-zinc-500 dark:text-zinc-400">
                                {r.program || r.email}
                              </p>
                            </div>
                          </div>
                          <div className="mt-2 flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleRespond(r._id, "accepted")}
                              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-brand py-1.5 text-[10.5px] font-bold text-white transition hover:bg-brand"
                            >
                              <Check className="h-3 w-3" />
                              Accept
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRespond(r._id, "declined")}
                              className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 py-1.5 text-[10.5px] font-bold text-zinc-500 dark:text-zinc-400 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            >
                              <X className="h-3 w-3" />
                              Decline
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={() => navigate("/alumni/requests")}
                  className="mt-2.5 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 py-1.5 text-[11px] font-bold text-zinc-500 dark:text-zinc-400 transition hover:border-brand hover:text-brand dark:hover:text-brand"
                >
                  View more
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-brand/10 bg-white dark:bg-zinc-900 p-4 shadow-sm">
              <p className="text-[13px] font-bold text-zinc-900 dark:text-zinc-100">
                Suggested Connects
              </p>
              {suggestionsLoading ? (
                <ContentSkeleton variant="list" count={3} label="Loading..." />
              ) : suggestionsError ? (
                <div className="py-3 text-center text-[11.5px] text-zinc-500 dark:text-zinc-400">
                  <p role="alert">{suggestionsError}</p>
                  <button
                    type="button"
                    onClick={loadSuggestions}
                    className="mt-2 font-bold text-brand hover:underline"
                  >
                    Retry suggestions
                  </button>
                </div>
              ) : suggestions.length === 0 ? (
                <p className="py-3 text-center text-[11.5px] text-zinc-400">
                  No suggestions
                </p>
              ) : (
                <ul className="mt-2 space-y-3">
                  {suggestions.slice(0, 3).map((person) => (
                    <li key={person._id} className="flex items-start gap-2.5">
                      <Link
                        to={profilePath(person)}
                        aria-label={`View ${person.name || "Alumni"} profile`}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand dark:text-brand"
                      >
                        <ProfileAvatar
                          user={{
                            ...person,
                            profilePicture:
                              person.profilePicture || person.avatar,
                          }}
                          fallback="A"
                        />
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link
                          to={profilePath(person)}
                          className="block truncate text-[12px] font-bold text-zinc-800 dark:text-zinc-100 hover:underline"
                        >
                          {person.name || "Alumni"}
                        </Link>
                        <p className="truncate text-[10.5px] text-zinc-500 dark:text-zinc-400">
                          {person.program || person.email}
                        </p>
                        <button
                          type="button"
                          disabled={connecting !== null}
                          onClick={() => handleConnect(person)}
                          className="alumni-suggested-connect"
                        >
                          {connecting === (person.authId || person.email) ? "..." : "+ connect"}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={() => navigate("/alumni/requests")}
                className="mt-3 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 py-1.5 text-[11px] font-bold text-zinc-500 dark:text-zinc-400 transition hover:border-brand hover:text-brand dark:hover:text-brand"
              >
                View more
              </button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-brand/10 bg-white dark:bg-zinc-900 shadow-sm">
              <div className="bg-gradient-to-r from-brand to-brand px-4 py-2.5 dark:from-zinc-900 dark:to-zinc-900">
                <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-white">
                  <Megaphone className="h-3.5 w-3.5" />
                  At CLSU Today
                </p>
              </div>
              <ul className="space-y-3 p-4">
                {announcements.length === 0 ? (
                  <li className="py-2 text-center text-[11.5px] text-zinc-400">
                    No announcements
                  </li>
                ) : (
                  announcements.map((item) => (
                    <li key={item._id}>
                      <button
                        type="button"
                        onClick={() => setSelectedAnnouncement(item)}
                        className="w-full text-left"
                      >
                        <p className="text-[12px] font-semibold leading-snug text-zinc-800 dark:text-zinc-100 transition hover:text-brand dark:text-brand">
                          {item.title}
                        </p>
                        <p className="text-[10.5px] text-zinc-400 dark:text-zinc-500">
                          {item.createdAt
                            ? new Date(item.createdAt).toLocaleDateString(
                                "en-US",
                                { month: "short", day: "numeric" },
                              )
                            : ""}
                        </p>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </aside>
        </main>
        {selectedAnnouncement && (
          <FeedDialog
            title={selectedAnnouncement.title}
            onClose={() => setSelectedAnnouncement(null)}
          >
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {selectedAnnouncement.body || "No further details."}
            </p>
          </FeedDialog>
        )}
        {showConnections && (
          <FeedDialog
            title="Your connections"
            onClose={() => setShowConnections(false)}
          >
            {connectionsLoading ? (
              <ContentSkeleton variant="list" count={3} label="Loading connections…" />
            ) : connectionsError ? (
              <p role="alert" className="text-sm text-red-600">
                {connectionsError}{" "}
                <button onClick={loadConnections} className="underline">
                  Retry
                </button>
              </p>
            ) : connections.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No accepted connections yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {connections.map((person) => (
                  <li
                    key={person.email}
                    className="flex items-center gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-50 text-brand">
                      <ProfileAvatar user={person} />
                    </span>
                    <span className="min-w-0 flex-1">
                      {person._id ? (
                        <Link
                          to={profilePath(person)}
                          className="block truncate text-sm font-bold hover:underline"
                        >
                          {person.name}
                        </Link>
                      ) : (
                        <span className="text-sm font-bold">{person.name}</span>
                      )}
                      <span className="block truncate text-xs text-zinc-500">
                        {person.program || person.email}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowConnections(false);
                        openChatByEmail(person.email);
                      }}
                      className="rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white"
                    >
                      Message
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </FeedDialog>
        )}
      </div>
    </div>
  );
};

export default AlumniDashboard;
