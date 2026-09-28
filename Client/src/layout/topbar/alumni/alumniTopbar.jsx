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
import { useChat } from '../../../context/ChatContext';

const breadcrumbMap = [
  ['/alumni/career', 'Career'],
  ['/alumni/employment', 'Employment'],
  ['/alumni/referral', 'Referral'],
  ['/alumni/success', 'Success Stories'],
  ['/alumni/surveys', 'Surveys'],
  ['/alumni/accounts', 'Accounts'],
  ['/alumni/profile', 'Profile'],
  ['/alumni/message', 'Message'],
  ['/inbox', 'Message'],
];

const AlumniTopbar = ({
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
  const [chatOpen, setChatOpen] = useState(false);
  const { convos, openChat } = useChat();
  const searchInputRef = useRef(null);
  const dropdownRef = useRef(null);
  const chatRef = useRef(null);

  const totalUnread = convos.reduce((sum, c) => sum + c.unread, 0);

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
        setChatOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  // Close dropdowns on outside click
  useEffect(() => {
    const onClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
      if (chatRef.current && !chatRef.current.contains(e.target)) {
        setChatOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const pageTitle =
    title ||
    breadcrumbMap.find(([prefix]) => location.pathname.startsWith(prefix))?.[1] ||
    'Dashboard';

  const handleLogout = () => {
    navigate('/logout');
  };

  return (
    <div className="sticky top-3 z-10 px-4 sm:px-6">
      <header
        className="flex h-16 items-center gap-3 rounded-2xl border border-emerald-900/10 bg-white/90 px-3 shadow-lg shadow-emerald-900/5 backdrop-blur sm:px-4"
        style={{ fontFamily: "'Libre Franklin', ui-sans-serif, system-ui, sans-serif" }}
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
          <ol className="flex items-center gap-1.5 text-[12px] text-zinc-500">
            <li className="flex items-center">
              <Link
                to="/alumni"
                className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-[#007a2e] transition hover:bg-emerald-100"
              >
                <Home className="h-3.5 w-3.5" />
                <span>Alumni</span>
              </Link>
            </li>
            <li aria-hidden="true" className="text-zinc-300">
              <ChevronRight className="h-3.5 w-3.5" />
            </li>
            <li className="flex min-w-0 items-center gap-2">
              <span className="truncate text-[13px] font-bold text-zinc-800">{pageTitle}</span>
            </li>
          </ol>
        </nav>

        {/* Mobile title (breadcrumb hidden on small screens) */}
        <div className="min-w-0 flex-1 sm:hidden">
          <h1 className="truncate text-[14px] font-extrabold tracking-tight text-zinc-900">
            {pageTitle}
          </h1>
        </div>

        {/* Search pill */}
        <div className="hidden md:block">
          {searchOpen ? (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search alumni, jobs..."
                className="h-10 w-64 rounded-full border border-zinc-200 bg-zinc-50 pl-9 pr-9 text-[12.5px] text-zinc-800 placeholder-zinc-400 outline-none transition-all focus:border-[#009639] focus:bg-white focus:ring-2 focus:ring-[#009639]/15"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                aria-label="Close search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex h-10 items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-4 text-[12.5px] text-zinc-400 transition hover:border-zinc-300 hover:text-zinc-600"
            >
              <Search className="h-4 w-4" />
              Search...
              <kbd className="rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[9px] font-semibold text-zinc-400">
                ⌘K
              </kbd>
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <div className="relative" ref={chatRef}>
            <button
              type="button"
              onClick={() => setChatOpen(!chatOpen)}
              className={`relative rounded-full p-2.5 transition ${chatOpen ? 'bg-emerald-50 text-[#009639]' : 'text-zinc-500 hover:bg-emerald-50 hover:text-[#009639]'}`}
              aria-label="Chats"
            >
              <MessageSquare className="h-[18px] w-[18px]" />
              {(unreadMessages > 0 || totalUnread > 0) && (
                <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-white">
                  {(unreadMessages || totalUnread) > 99 ? '99+' : unreadMessages || totalUnread}
                </span>
              )}
            </button>

            {chatOpen && (
              <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl shadow-zinc-900/5 z-20">
                <div className="flex items-center justify-between px-4 py-3">
                  <p className="text-[14px] font-extrabold tracking-tight text-zinc-900">Chats</p>
                  <Link
                    to="/alumni/message"
                    onClick={() => setChatOpen(false)}
                    className="text-[11.5px] font-semibold text-[#009639] hover:underline"
                  >
                    See all
                  </Link>
                </div>
                <ul className="max-h-80 overflow-y-auto pb-1.5">
                  {convos.map((c) => (
                    <li key={c.id}>
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
                </ul>
              </div>
            )}
          </div>

          <button
            type="button"
            className="relative rounded-full p-2.5 text-zinc-500 transition hover:bg-emerald-50 hover:text-[#009639]"
            aria-label="Notifications"
          >
            <Bell className="h-[18px] w-[18px]" />
            {notificationDot && (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#009639] ring-2 ring-white"></span>
            )}
          </button>
        </div>

        {/* User */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white py-1 pl-1 pr-2 transition hover:border-emerald-300 hover:shadow-sm"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#007a2e] to-[#009639] text-[11px] font-bold text-white">
              {(user?.name || 'A').charAt(0).toUpperCase()}
            </span>
            <ChevronDown
              className={`hidden h-3.5 w-3.5 text-zinc-400 transition-transform duration-200 sm:block ${dropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-xl shadow-zinc-900/5 z-20">
              <div className="rounded-xl bg-emerald-50/60 px-3 py-2.5 mb-1">
                <p className="truncate text-[12.5px] font-bold text-zinc-800">
                  {user?.name || 'Alumni'}
                </p>
                <p className="truncate text-[10.5px] text-zinc-500">
                  {user?.email || 'alumni@clsu.edu.ph'}
                </p>
              </div>

              <Link
                to="/alumni/profile"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[12.5px] font-medium text-zinc-600 transition hover:bg-zinc-100"
              >
                <User className="h-4 w-4 shrink-0 text-zinc-400" />
                Profile
              </Link>
              <Link
                to="/alumni/accounts"
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
      </header>
    </div>
  );
};

export default AlumniTopbar;
