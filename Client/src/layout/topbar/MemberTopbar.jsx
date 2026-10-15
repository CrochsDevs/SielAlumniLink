import GlobalSearch from "../../components/search/GlobalSearch";
import ChatAvatar from "../../components/chat/ChatAvatar";
import { formatTime } from "../../components/chat/messageFormat";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Menu,
  Home,
  ChevronRight,
  MessageSquare,
  Bell,
  ChevronDown,
  User,
  Settings,
  LogOut,
} from "lucide-react";
import { useNotifications } from "../../realtime/useNotifications";
import NotificationDropdown from "../../components/notifications/NotificationDropdown";
import { useChat } from "../../context/useChat.js";

const breadcrumbMap = [
  ["/alumni/mentorship","Mentorship"],
  ["/alumni/career","Career"],
  ["/alumni/employment","Employment"],
  ["/alumni/referral","Referral"],
  ["/alumni/success","Success Stories"],
  ["/stories","Success Stories"],
  ["/alumni/events","Events"],
  ["/alumni/surveys","Surveys"],
  ["/alumni/accounts","Accounts"],
  ["/alumni/profile","Profile"],
  ["/alumni/message","Message"],
  ["/alumni/requests","Requests"],
  ["/inbox","Message"],
  ["/student/journey","Journey"],
  ["/student/portfolio","Portfolio"],
  ["/student/internship","Internship"],
  ["/student/mentorship","Mentorship"],
  ["/student/competency","Competency"],
  ["/student/certificate","Certificate"],
  ["/student/readiness","Readiness"],
  ["/student/career","Career"],
  ["/student/referrals","Referrals"],
  ["/student/success","Success Stories"],
  ["/student/requests","Requests"],
  ["/student/accounts","Accounts"],
  ["/student/profile","Profile"],
  ["/student/message","Message"],
];

const MemberTopbar = ({ user, title, onMenuClick, memberRole }) => {
  const roleLabel = memberRole === "student" ? "Student" : "Alumni";
  const homePath = `/${memberRole}`;
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const {
    convos,
    openChat,
    refreshConvos,
    unreadTotal: totalUnread,
  } = useChat();
  const {
    items: notifs,
    unread: notifUnread,
    markRead: markNotifRead,
    markAllRead: markAllNotifsRead,
    refresh: refreshNotifs,
  } = useNotifications();
  const dropdownRef = useRef(null);
  const chatRef = useRef(null);
  const notifRef = useRef(null);

  useEffect(() => {
    if (chatOpen) refreshConvos();
  }, [chatOpen, refreshConvos]);

  // Escape closes header menus
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setDropdownOpen(false);
        setChatOpen(false);
        setNotifOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const onClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
      if (chatRef.current && !chatRef.current.contains(e.target)) {
        setChatOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const pageTitle =
    title ||
    breadcrumbMap.find(([prefix]) =>
      location.pathname.startsWith(prefix),
    )?.[1] ||
    "Dashboard";

  const handleLogout = () => {
    navigate("/logout");
  };

  return (
    <div className="member-topbar sticky top-3 z-10 mx-auto max-w-7xl px-4 pt-3 sm:px-6">
      <header
        className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-900/10 dark:border-zinc-700 bg-white/90 dark:bg-zinc-900/90 px-3 py-3 shadow-lg shadow-emerald-900/5 backdrop-blur sm:h-16 sm:flex-nowrap sm:px-4 sm:py-0"
        style={{
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-xl bg-[#009639] p-2 text-white transition hover:bg-[#007a2e] lg:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Breadcrumb + date */}
        <nav aria-label="breadcrumb" className="hidden min-w-0 flex-1 sm:block">
          <ol className="flex items-center gap-1.5 text-[12px] text-zinc-600 dark:text-zinc-400">
            <li className="flex items-center">
              <Link
                to={homePath}
                className="flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950 px-2.5 py-1 font-semibold text-[#007a2e] dark:text-emerald-300 transition hover:bg-emerald-100 dark:hover:bg-emerald-900"
              >
                <Home className="h-3.5 w-3.5" />
                <span>{roleLabel}</span>
              </Link>
            </li>
            <li aria-hidden="true" className="text-zinc-300 dark:text-zinc-600">
              <ChevronRight className="h-3.5 w-3.5" />
            </li>
            <li className="flex min-w-0 items-center gap-2">
              <span className="truncate text-[13px] font-bold text-zinc-900 dark:text-zinc-100">
                {pageTitle}
              </span>
            </li>
          </ol>
        </nav>

        <span className="min-w-0 flex-1 truncate text-sm font-bold dark:text-white sm:hidden">
          {pageTitle}
        </span>
        <div className="order-last w-full sm:order-none sm:w-auto sm:min-w-0 sm:max-w-sm sm:flex-1">
          <GlobalSearch />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <div className="relative" ref={chatRef}>
            <button
              type="button"
              onClick={() => setChatOpen((open) => !open)}
              className={`relative rounded-full p-2.5 transition ${chatOpen ? "bg-emerald-50 text-[#009639]" : "text-zinc-500 hover:bg-emerald-50 hover:text-[#009639]"}`}
              aria-label="Chats"
              aria-expanded={chatOpen}
              aria-controls={chatOpen ? `${memberRole}-topbar-chats` : undefined}
            >
              <MessageSquare className="h-[18px] w-[18px]" />
              {totalUnread > 0 && (
                <span
                  aria-label={`${totalUnread} unread messages`}
                  aria-live="polite"
                  className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-white"
                >
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
            </button>

            {chatOpen && (
              <div
                id={`${memberRole}-topbar-chats`}
                className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-5rem)] overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl shadow-zinc-900/5 z-20"
              >
                <div className="flex items-center justify-between px-4 py-3">
                  <p className="text-[14px] font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
                    Chats
                  </p>
                  <Link
                    to={`${homePath}/message`}
                    onClick={() => setChatOpen(false)}
                    className="text-[11.5px] font-semibold text-[#009639] dark:text-emerald-300 hover:underline"
                  >
                    See all
                  </Link>
                </div>
                <ul className="max-h-80 overflow-y-auto pb-1.5">
                  {convos.map((c) => (
                    <li key={c._id}>
                      <button
                        type="button"
                        onClick={() => {
                          openChat(c);
                          setChatOpen(false);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      >
                        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#009639]/10 text-[13px] font-bold text-[#009639]">
                          <ChatAvatar convo={c} />
                          {c.unread > 0 && (
                            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-white">
                              {c.unread}
                            </span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-bold text-zinc-800 dark:text-zinc-100">
                            {c.name}
                          </span>
                          <span className="block truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                            {c.preview}
                          </span>
                        </span>
                        <span className="shrink-0 text-[10px] text-zinc-400">
                          {formatTime(c.time)}
                        </span>
                      </button>
                    </li>
                  ))}
                  {convos.length === 0 && (
                    <li className="px-4 py-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
                      No conversations yet.
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>

          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => {
                setNotifOpen(!notifOpen);
                refreshNotifs();
              }}
              className={`relative rounded-full p-2.5 transition ${notifOpen ? "bg-emerald-50 text-[#009639]" : "text-zinc-500 hover:bg-emerald-50 hover:text-[#009639]"}`}
              aria-label="Notifications"
              aria-expanded={notifOpen}
            >
              <Bell className="h-[18px] w-[18px]" />
              {notifUnread > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-white">
                  {notifUnread > 99 ? "99+" : notifUnread}
                </span>
              )}
            </button>
            {notifOpen && (
              <NotificationDropdown
                items={notifs}
                onRead={markNotifRead}
                onReadAll={markAllNotifsRead}
                onClose={() => setNotifOpen(false)}
              />
            )}
          </div>
        </div>

        {/* User */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            aria-label="Account menu"
            aria-expanded={dropdownOpen}
            className="flex items-center gap-2 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-1 pl-1 pr-2 transition hover:border-emerald-300 hover:shadow-sm"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#007a2e] to-[#009639] text-[11px] font-bold text-white">
              {user?.profilePicture ? (
                <img
                  src={user.profilePicture}
                  alt=""
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                (user?.name || "A").charAt(0).toUpperCase()
              )}
            </span>
            <ChevronDown
              className={`hidden h-3.5 w-3.5 text-zinc-400 transition-transform duration-200 sm:block ${dropdownOpen ? "rotate-180" : ""}`}
            />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-1.5 shadow-xl shadow-zinc-900/5 z-20">
              <div className="rounded-xl bg-emerald-50/60 dark:bg-emerald-950/40 px-3 py-2.5 mb-1">
                <p className="truncate text-[12.5px] font-bold text-zinc-800 dark:text-zinc-100">
                  {user?.name || roleLabel}
                </p>
                <p className="truncate text-[10.5px] text-zinc-500 dark:text-zinc-400">
                  {user?.email || ""}
                </p>
              </div>

              <Link
                to={`${homePath}/profile`}
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[12.5px] font-medium text-zinc-600 dark:text-zinc-300 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <User className="h-4 w-4 shrink-0 text-zinc-400" />
                Profile
              </Link>
              <Link
                to={`${homePath}/accounts`}
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[12.5px] font-medium text-zinc-600 dark:text-zinc-300 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <Settings className="h-4 w-4 shrink-0 text-zinc-400" />
                Settings
              </Link>

              <div className="my-1 border-t border-zinc-100 dark:border-zinc-800"></div>

              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[12.5px] font-medium text-zinc-500 dark:text-zinc-400 transition hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 dark:hover:text-red-400"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                Logout
              </button>
            </div>
          )}
        </div>
      </header>
    </div>
  );
};

export default MemberTopbar;
