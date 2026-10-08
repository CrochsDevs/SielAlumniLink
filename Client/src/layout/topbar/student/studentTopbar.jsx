import GlobalSearch from '../../../components/search/GlobalSearch';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import { useNotifications } from '../../../realtime/useNotifications';
import NotificationDropdown from '../../../components/notifications/NotificationDropdown';
import { useChat } from '../../../context/ChatContext';

const breadcrumbMap = [
  ['/student/journey', 'Journey'],
  ['/student/portfolio', 'Portfolio'],
  ['/student/internship', 'Internship'],
  ['/student/internship', 'Internship'],
  ['/student/mentorship', 'Mentorship'],
  ['/student/competency', 'Competency'],
  ['/student/certificate', 'Certificate'],
  ['/student/readiness', 'Readiness'],
  ['/student/career', 'Career'],
  ['/student/referrals', 'Referrals'],
  ['/student/requests', 'Requests'],
  ['/student/accounts', 'Accounts'],
  ['/student/profile', 'Profile'],
  ['/student/message', 'Message'],
  ['/student/message', 'Message'],
  ['/inbox', 'Message'],
];

const StudentTopbar = ({
  user,
  title,
  onMenuClick,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const { items: notifs, unread: notifUnread, markRead: markNotifRead, markAllRead: markAllNotifsRead, refresh: refreshNotifs } = useNotifications();
  const { unreadTotal: chatUnread, convos, openChat } = useChat();
  const dropdownRef = useRef(null);
  const notifRef = useRef(null);
  const chatRef = useRef(null);

  const pageTitle =
    title ||
    breadcrumbMap.find(([prefix]) => location.pathname.startsWith(prefix))?.[1] ||
    'Dashboard';

  // Escape closes header menus
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setDropdownOpen(false);
        setNotifOpen(false);
        setChatOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);


  // Close dropdowns on outside click
  useEffect(() => {
    const onClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
      if (chatRef.current && !chatRef.current.contains(e.target)) {
        setChatOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleLogout = () => {
    navigate('/logout');
  };

  return (
    <nav
      className="sticky top-0 z-10 bg-gradient-to-r from-[#0F4C3A] via-[#007a2e] to-[#009639] shadow-md shadow-emerald-900/20"
      style={{ fontFamily: "'Libre Franklin', ui-sans-serif, system-ui, sans-serif" }}
    >
      <div className="flex h-14 items-center gap-2 px-3 sm:px-4 lg:px-6">
        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-lg bg-white/15 p-2 text-white transition hover:bg-white/25 lg:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Breadcrumb */}
        <nav aria-label="breadcrumb" className="hidden min-w-0 flex-1 sm:block">
            <ol className="flex items-center gap-1.5 text-[12px]">
              <li className="flex items-center">
                <Link
                  to="/student"
                  className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 font-semibold text-white transition hover:bg-white/25"
                >
                  <Home className="h-3.5 w-3.5" />
                  <span>Student</span>
                </Link>
              </li>
              <li aria-hidden="true" className="text-white/40">
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
              <li className="truncate text-[13px] font-bold text-white">{pageTitle}</li>
            </ol>
        </nav>

        <GlobalSearch />

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-0.5">
          <div className="relative" ref={chatRef}>
            <button
              type="button"
              onClick={() => setChatOpen(!chatOpen)}
              className="relative rounded-full p-2 text-white/80 transition hover:bg-white/15 hover:text-white"
              aria-label="Chats"
            >
              <MessageSquare className="h-[18px] w-[18px]" />
              {(chatUnread > 0) && (
                <span aria-label={`${chatUnread} unread messages`} aria-live="polite" className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-[#007a2e]">
                  {chatUnread > 99 ? '99+' : chatUnread}
                </span>
              )}
            </button>
            {chatOpen && (
              <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl z-20">
                <div className="flex items-center justify-between px-4 py-3">
                  <p className="text-[14px] font-extrabold tracking-tight text-zinc-900">Chats</p>
                  <Link
                    to="/student/message"
                    onClick={() => setChatOpen(false)}
                    className="text-[11.5px] font-semibold text-[#009639] hover:underline"
                  >
                    See all
                  </Link>
                </div>
                <ul className="max-h-80 overflow-y-auto pb-1.5">
                  {convos.map((c) => (
                    <li key={c._id}>
                      <button
                        type="button"
                        onClick={() => { openChat(c); setChatOpen(false); }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-zinc-50"
                      >
                        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#009639]/10 text-[13px] font-bold text-[#009639]">
                          {c.initial}
                          {c.unread > 0 && (
                            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-white">
                              {c.unread}
                            </span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-bold text-zinc-800">{c.name}</span>
                          <span className="block truncate text-[11px] text-zinc-500">{c.preview}</span>
                        </span>
                        <span className="shrink-0 text-[10px] text-zinc-400">{c.time}</span>
                      </button>
                    </li>
                  ))}
                  {convos.length === 0 && (
                    <li className="px-4 py-6 text-center text-[12px] text-zinc-400">
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
              onClick={() => { setNotifOpen(!notifOpen); refreshNotifs(); }}
              className="relative rounded-full p-2 text-white/80 transition hover:bg-white/15 hover:text-white"
              aria-label="Notifications"
            >
              <Bell className="h-[18px] w-[18px]" />
              {notifUnread > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-[#007a2e]">
                  {notifUnread > 99 ? '99+' : notifUnread}
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
        <div className="relative shrink-0" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-1.5 rounded-full bg-white/15 py-1 pl-1 pr-2 transition hover:bg-white/25"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[11px] font-extrabold text-[#007a2e]">
              {(user?.name || 'S').charAt(0).toUpperCase()}
            </span>
            <ChevronDown
              className={`hidden h-3.5 w-3.5 text-white/70 transition-transform duration-200 sm:block ${dropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-1.5 shadow-xl shadow-zinc-900/10 z-20">
              <div className="mb-1 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/40 px-3 py-2.5">
                <p className="truncate text-[12.5px] font-bold text-zinc-800 dark:text-zinc-100">
                  {user?.name || 'Student'}
                </p>
                <p className="truncate text-[10.5px] text-zinc-500 dark:text-zinc-400">
                  {user?.email || 'student@clsu.edu.ph'}
                </p>
              </div>

              <Link
                to="/student/profile"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[12.5px] font-medium text-zinc-600 dark:text-zinc-300 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <User className="h-4 w-4 shrink-0 text-zinc-400" />
                Profile
              </Link>
              <Link
                to="/student/accounts"
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
      </div>
      {/* Accent strip */}
      <div className="h-[3px] w-full bg-white/20"></div>
    </nav>
  );
};

export default StudentTopbar;
