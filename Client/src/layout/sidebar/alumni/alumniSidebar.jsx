import React, { useState } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  Building2,
  Share2,
  Trophy,
  FileText,
  MessageSquare,
  UserPlus,
  Settings,
  LogOut,
} from 'lucide-react';
import clsuLogo from '../../../assets/logo/clsu_logo.png';

const AlumniSidebar = ({ user, mobileOpen: controlledOpen, setMobileOpen: controlledSet }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [internalOpen, setInternalOpen] = useState(false);

  // Controlled when parent passes props, otherwise falls back to internal state.
  const mobileOpen = controlledOpen ?? internalOpen;
  const setMobileOpen = controlledSet ?? setInternalOpen;

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');
  const isSettingsActive =
    location.pathname.startsWith('/alumni/accounts') || location.pathname.startsWith('/alumni/profile');

  const navItemClass = (active) =>
    `group flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-colors ${
      active
        ? 'bg-[#009639]/10 text-[#009639] font-semibold dark:bg-[#009639]/20 dark:text-emerald-300'
        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 font-medium dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
    }`;

  const handleLogout = () => {
    navigate('/logout');
  };

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setMobileOpen(false)}
        ></div>
      )}

      <aside
        id="sidebar"
        className={`fixed left-0 top-0 h-full w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 transform transition-transform duration-300 z-30 flex flex-col ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
        style={{ fontFamily: "'Libre Franklin', ui-sans-serif, system-ui, sans-serif" }}
      >
        {/* Header / Brand */}
        <div className="px-4 pt-5 pb-5 border-b border-zinc-100 dark:border-zinc-800">
          <Link to="/alumni" className="flex flex-col items-center text-center group">
            <img src={clsuLogo} alt="CLSU" className="h-16 w-16 object-contain" />
            <div className="leading-tight mt-1">
              <p className="font-extrabold text-[17px] tracking-tight text-zinc-800 dark:text-zinc-100">
                Siel<span className="text-[#009639]">Alumni</span>
              </p>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto px-2.5 pb-2 pt-6 space-y-0.5">

          {/* Primary group */}
          <nav className="space-y-0.5">
            <NavLink to="/alumni" end className={navItemClass(location.pathname === '/alumni')}>
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span className="truncate">Dashboard</span>
            </NavLink>

            <NavLink to="/alumni/career" className={navItemClass(isActive('/alumni/career'))}>
              <Briefcase className="w-4 h-4 shrink-0" />
              <span className="truncate">Career</span>
            </NavLink>

            <NavLink to="/alumni/referral" className={navItemClass(isActive('/alumni/referral'))}>
              <Share2 className="w-4 h-4 shrink-0" />
              <span className="truncate">Referral</span>
            </NavLink>

            <NavLink to="/alumni/success" className={navItemClass(isActive('/alumni/success'))}>
              <Trophy className="w-4 h-4 shrink-0" />
              <span className="truncate">Success Stories</span>
            </NavLink>

            <NavLink to="/alumni/surveys" className={navItemClass(isActive('/alumni/surveys'))}>
              <FileText className="w-4 h-4 shrink-0" />
              <span className="truncate">Surveys</span>
            </NavLink>
          </nav>

          {/* Secondary group */}
          <nav className="space-y-0.5">
            <NavLink to="/alumni/message" className={navItemClass(isActive('/alumni/message'))}>
              <MessageSquare className="w-4 h-4 shrink-0" />
              <span className="truncate">Message</span>
            </NavLink>

            <NavLink to="/alumni/requests" className={navItemClass(isActive('/alumni/requests'))}>
              <UserPlus className="w-4 h-4 shrink-0" />
              <span className="truncate">Requests</span>
            </NavLink>
          </nav>

          {/* Settings */}
          <div id="nav-settings-group">
            <NavLink to="/alumni/accounts" className={navItemClass(isSettingsActive)}>
              <Settings className="w-4 h-4 shrink-0" />
              <span className="truncate">Settings</span>
            </NavLink>
          </div>
        </div>

        {/* User + Logout */}
        <div className="p-2.5 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-2.5 px-2 py-2 mb-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <div className="h-8 w-8 rounded-full bg-[#009639] flex items-center justify-center text-[11px] font-bold text-white shrink-0">
              {(user?.name || 'A').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold text-zinc-900 dark:text-zinc-100 truncate leading-tight">
                {user?.name || 'Alumni'}
              </p>
              <p className="text-[10px] text-zinc-600 dark:text-zinc-400 truncate leading-tight mt-0.5">
                {user?.email || 'alumni@clsu.edu.ph'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-[12px] font-medium text-zinc-500 dark:text-zinc-400 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 dark:hover:text-red-400 transition-colors text-left"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span className="truncate">Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default AlumniSidebar;
