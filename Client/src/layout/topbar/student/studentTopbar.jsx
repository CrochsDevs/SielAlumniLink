import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  Home,
  ChevronRight,
  Search,
  X,
  MessageSquare,
  Bell,
  ChevronDown,
  User,
  Settings,
  LogOut,
} from 'lucide-react';

const breadcrumbMap = [
  ['/student/journey', 'Journey'],
  ['/student/portfolio', 'Portfolio'],
  ['/student/internship', 'Internship'],
  ['/student/mentorship', 'Mentorship'],
  ['/student/competency', 'Competency'],
  ['/student/certificate', 'Certificate'],
  ['/student/readiness', 'Readiness'],
  ['/student/career', 'Career'],
  ['/student/accounts', 'Accounts'],
  ['/student/profile', 'Profile'],
  ['/student/message', 'Message'],
  ['/inbox', 'Message'],
];

const StudentTopbar = ({
  user,
  title,
  onMenuClick,
  unreadMessages = 0,
  notificationDot = true,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchInputRef = useRef(null);
  const dropdownRef = useRef(null);

  const pageTitle =
    title ||
    breadcrumbMap.find(([prefix]) => location.pathname.startsWith(prefix))?.[1] ||
    'Dashboard';

  // Ctrl/Cmd+K opens search, Escape closes search + dropdown
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setDropdownOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    const onClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
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
        {!searchOpen && (
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
        )}
        {searchOpen && <div className="min-w-0 flex-1" />}

        {/* Search */}
        {searchOpen ? (
          <div className="relative hidden sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search..."
              className="h-9 w-64 rounded-full border border-white/20 bg-white/15 pl-9 pr-9 text-[12.5px] text-white placeholder-white/50 outline-none transition focus:border-white/40 focus:bg-white/20"
            />
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/60 hover:bg-white/10 hover:text-white"
              aria-label="Close search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="hidden h-9 items-center gap-2 rounded-full bg-white/15 px-4 text-[12.5px] text-white/80 transition hover:bg-white/25 hover:text-white sm:flex"
          >
            <Search className="h-4 w-4" />
            Search...
            <kbd className="rounded border border-white/20 bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold text-white/70">
              ⌘K
            </kbd>
          </button>
        )}

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-0.5">
          <Link
            to="/inbox"
            className="relative rounded-full p-2 text-white/80 transition hover:bg-white/15 hover:text-white"
            aria-label="Messages"
          >
            <MessageSquare className="h-[18px] w-[18px]" />
            {unreadMessages > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-[#007a2e]">
                {unreadMessages > 99 ? '99+' : unreadMessages}
              </span>
            )}
          </Link>

          <button
            type="button"
            className="relative rounded-full p-2 text-white/80 transition hover:bg-white/15 hover:text-white"
            aria-label="Notifications"
          >
            <Bell className="h-[18px] w-[18px]" />
            {notificationDot && (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-amber-300 ring-2 ring-[#007a2e]"></span>
            )}
          </button>
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
            <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-xl shadow-zinc-900/10 z-20">
              <div className="mb-1 rounded-xl bg-emerald-50/60 px-3 py-2.5">
                <p className="truncate text-[12.5px] font-bold text-zinc-800">
                  {user?.name || 'Student'}
                </p>
                <p className="truncate text-[10.5px] text-zinc-500">
                  {user?.email || 'student@clsu.edu.ph'}
                </p>
              </div>

              <Link
                to="/student/profile"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[12.5px] font-medium text-zinc-600 transition hover:bg-zinc-100"
              >
                <User className="h-4 w-4 shrink-0 text-zinc-400" />
                Profile
              </Link>
              <Link
                to="/student/accounts"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[12.5px] font-medium text-zinc-600 transition hover:bg-zinc-100"
              >
                <Settings className="h-4 w-4 shrink-0 text-zinc-400" />
                Settings
              </Link>

              <div className="my-1 border-t border-zinc-100"></div>

              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[12.5px] font-medium text-zinc-500 transition hover:bg-red-50 hover:text-red-600"
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
