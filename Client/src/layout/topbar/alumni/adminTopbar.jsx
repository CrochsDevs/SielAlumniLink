import GlobalSearch from '../../../components/search/GlobalSearch';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  Home,
  ChevronRight,
  ChevronDown,
  Calendar,
  Clock,
  MessageSquare,
  Bell,
  User,
  Settings,
  LogOut,
} from 'lucide-react';
import { useNotifications } from '../../../realtime/useNotifications';
import NotificationDropdown from '../../../components/notifications/NotificationDropdown';
import { useChat } from '../../../context/useChat.js';
const breadcrumbMap = [
  ['/admin/users', 'Users'],
  ['/admin/tracer', 'Tracer Study'],
  ['/admin/jobs', 'Job Posts'],
  ['/admin/surveys', 'Survey'],
  ['/admin/events', 'Calendar'],
  ['/admin/connections', 'Connections'],
  ['/admin/announcements', 'Announcements'],
  ['/admin/settings', 'Account'],
  ['/inbox', 'Message'],
];

const AdminTopbar = ({
  user,
  title,
  onMenuClick,
  crumbLabel = 'Admin',
  crumbPath = '/admin',
  profilePath = '/admin/profile',
  settingsPath = '/admin/settings',
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { unreadTotal: unreadMessages } = useChat();
  const { items: notifs, unread: notifUnread, markRead: markNotifRead, markAllRead: markAllNotifsRead, refresh: refreshNotifs } = useNotifications();
  const [now, setNow] = useState(new Date());
  const dropdownRef = useRef(null);
  const notifRef = useRef(null);

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
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);


  // Live clock
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
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
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const handleLogout = () => {
    navigate('/logout');
  };

  return (
    <nav
      className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800"
      style={{ fontFamily: "'Libre Franklin', ui-sans-serif, system-ui, sans-serif" }}
    >
      <div className="flex items-center justify-between h-14 px-3 sm:px-4 lg:px-6 gap-3">

        {/* LEFT: toggle + breadcrumb / search input */}
        <div className="flex items-center gap-2 min-w-0 flex-1">

          {/* Mobile menu toggle */}
          <button
            type="button"
            onClick={onMenuClick}
            className="lg:hidden p-1.5 rounded-md text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors shrink-0"
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Breadcrumb */}
          <nav aria-label="breadcrumb" className="hidden sm:flex min-w-0">
              <ol className="flex items-center gap-1.5 text-[12px] text-zinc-500 dark:text-zinc-400 min-w-0">
                <li className="flex items-center">
                  <Link
                    to={crumbPath}
                    className="flex items-center gap-1.5 font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors"
                  >
                    <Home className="w-3.5 h-3.5" />
                    <span>{crumbLabel}</span>
                  </Link>
                </li>
                <li aria-hidden="true" className="text-zinc-300">
                  <ChevronRight className="w-3.5 h-3.5" />
                </li>
                <li className="flex items-center">
                  <span className="text-zinc-800 dark:text-zinc-100 font-semibold truncate">{pageTitle}</span>
                </li>
              </ol>
          </nav>

          <GlobalSearch />
        </div>

        {/* RIGHT: date + time + actions + user dropdown */}
        <div className="flex items-center gap-0.5 shrink-0">

          {/* Live Date & Time chip */}
          <div className="hidden xl:flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-800 text-[11px] text-zinc-600 dark:text-zinc-300 font-medium">
            <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="truncate">{dateStr}</span>
            <span className="w-px h-3 bg-zinc-300"></span>
            <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="tabular-nums font-semibold text-zinc-700 dark:text-zinc-200">{timeStr}</span>
          </div>

          {/* Messages */}
          <Link
            to="/admin/message"
            className="relative p-2 rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors inline-flex items-center justify-center"
            aria-label="Messages"
          >
            <MessageSquare className="w-4 h-4" />
            {unreadMessages > 0 && (
              <span aria-label={`${unreadMessages} unread messages`} aria-live="polite" className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 ring-2 ring-white text-[9px] font-bold text-white flex items-center justify-center">
                {unreadMessages > 99 ? '99+' : unreadMessages}
              </span>
            )}
          </Link>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => { setNotifOpen(!notifOpen); refreshNotifs(); }}
              className={`relative p-2 rounded-md transition-colors ${notifOpen ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {notifUnread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 ring-2 ring-white text-[9px] font-bold text-white flex items-center justify-center">
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

          <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-1.5"></div>

          {/* User dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-md cursor-pointer select-none hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <div className="h-8 w-8 rounded-full bg-emerald-50 text-[#009639] flex items-center justify-center text-[11px] font-semibold shrink-0 ring-1 ring-emerald-100">
                {user?.profilePicture ? <img src={user.profilePicture} alt="" className="h-full w-full rounded-full object-cover" /> : (user?.name || 'A').charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:flex flex-col min-w-0 leading-tight text-left">
                <span className="text-[12px] font-semibold text-zinc-800 truncate max-w-[140px]">
                  {user?.name || 'Admin'}
                </span>
                <span className="text-[10px] text-zinc-500 truncate max-w-[140px]">
                  {user?.email || 'admin@clsu.edu.ph'}
                </span>
              </div>
              <ChevronDown
                className={`w-3 h-3 text-zinc-400 transition-transform duration-200 hidden sm:block ${dropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-1 w-60 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-1 shadow-lg shadow-zinc-900/5 z-20">
                <div className="flex items-center gap-2.5 px-2.5 py-2 border-b border-zinc-100 dark:border-zinc-800 mb-1">
                  <div className="h-9 w-9 rounded-full bg-emerald-50 dark:bg-emerald-950 text-[#009639] dark:text-emerald-300 flex items-center justify-center text-[12px] font-semibold shrink-0 ring-1 ring-emerald-100 dark:ring-emerald-900">
                    {user?.profilePicture ? <img src={user.profilePicture} alt="" className="h-full w-full rounded-full object-cover" /> : (user?.name || 'A').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold text-zinc-800 dark:text-zinc-100 truncate leading-tight">
                      {user?.name || 'Admin'}
                    </p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate leading-tight mt-0.5">
                      {user?.email || 'admin@clsu.edu.ph'}
                    </p>
                  </div>
                </div>

                <Link
                  to={profilePath}
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-md text-[12px] font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                  <User className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Profile</span>
                </Link>

                <Link
                  to={settingsPath}
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-md text-[12px] font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                  <Settings className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Settings</span>
                </Link>

                <div className="my-1 border-t border-zinc-100 dark:border-zinc-800"></div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-md text-[12px] font-medium text-zinc-500 hover:bg-red-50 hover:text-red-600 transition-colors text-left"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Green accent strip */}
      <div className="h-[3px] w-full bg-gradient-to-r from-[#007a2e] via-[#009639] to-[#007a2e]"></div>
    </nav>
  );
};

export default AdminTopbar;
