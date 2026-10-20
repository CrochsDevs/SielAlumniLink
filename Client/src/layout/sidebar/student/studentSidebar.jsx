import { useState } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarDays,
  Route,
  FolderKanban,
  Briefcase,
  Share2,
  Trophy,
  Users,
  Award,
  BadgeCheck,
  BarChart3,
  MessageSquare,
  Settings,
  LogOut,
} from "lucide-react";
import clsuLogo from "../../../assets/logo/clsu_logo.png";
import ProfileAvatar from "../../../components/profile/ProfileAvatar";

const StudentSidebar = ({
  user,
  mobileOpen: controlledOpen,
  setMobileOpen: controlledSet,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [internalOpen, setInternalOpen] = useState(false);

  // Controlled when parent passes props, otherwise falls back to internal state.
  const mobileOpen = controlledOpen ?? internalOpen;
  const setMobileOpen = controlledSet ?? setInternalOpen;

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + "/");
  const isSettingsActive = location.pathname.startsWith("/student/accounts");

  const navItemClass = (active) =>
    `group flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-colors ${
      active
        ? "bg-[#009639] text-white font-semibold dark:bg-[#009639] dark:text-white"
        : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 font-medium dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    }`;

  const handleLogout = () => {
    navigate("/logout");
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
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
        style={{
          fontFamily: "'Libre Franklin', ui-sans-serif, system-ui, sans-serif",
        }}
      >
        {/* Header / Brand */}
        <div className="px-4 pt-5 pb-5 border-b border-zinc-100 dark:border-zinc-800">
          <Link
            to="/student"
            className="flex flex-col items-center text-center group"
          >
            <img
              src={clsuLogo}
              alt="CLSU"
              className="h-16 w-16 object-contain"
            />
            <div className="leading-tight mt-1">
              <p className="font-extrabold text-[17px] tracking-tight text-zinc-800 dark:text-zinc-100">
                Siel<span className="text-brand">Alumni</span>
              </p>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto px-2.5 pb-2 pt-6 space-y-0.5">
          {/* Primary group */}
          <nav className="space-y-0.5">
            <NavLink
              to="/student"
              end
              className={navItemClass(location.pathname === "/student")}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span className="truncate">Dashboard</span>
            </NavLink>

            <NavLink
              to="/student/journey"
              className={navItemClass(isActive("/student/journey"))}
            >
              <Route className="w-4 h-4 shrink-0" />
              <span className="truncate">Journey</span>
            </NavLink>

            <NavLink
              to="/student/portfolio"
              className={navItemClass(isActive("/student/portfolio"))}
            >
              <FolderKanban className="w-4 h-4 shrink-0" />
              <span className="truncate">Portfolio</span>
            </NavLink>

            <NavLink
              to="/student/internship"
              className={navItemClass(isActive("/student/internship"))}
            >
              <Briefcase className="w-4 h-4 shrink-0" />
              <span className="truncate">Internship</span>
            </NavLink>

            <NavLink
              to="/student/mentorship"
              className={navItemClass(isActive("/student/mentorship"))}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span className="truncate">Mentorship</span>
            </NavLink>

            <NavLink
              to="/student/competency"
              className={navItemClass(isActive("/student/competency"))}
            >
              <Award className="w-4 h-4 shrink-0" />
              <span className="truncate">Competency</span>
            </NavLink>

            <NavLink
              to="/student/certificate"
              className={navItemClass(isActive("/student/certificate"))}
            >
              <BadgeCheck className="w-4 h-4 shrink-0" />
              <span className="truncate">Certificate</span>
            </NavLink>
            <NavLink
              to="/student/events"
              className={navItemClass(
                isActive("/student/events") || isActive("/activities"),
              )}
            >
              <CalendarDays className="w-4 h-4 shrink-0" />
              <span className="truncate">Events</span>
            </NavLink>

            <NavLink
              to="/student/readiness"
              className={navItemClass(isActive("/student/readiness"))}
            >
              <BarChart3 className="w-4 h-4 shrink-0" />
              <span className="truncate">Readiness</span>
            </NavLink>

            <NavLink
              to="/student/career"
              className={navItemClass(isActive("/student/career"))}
            >
              <Briefcase className="w-4 h-4 shrink-0" />
              <span className="truncate">Career</span>
            </NavLink>

            <NavLink
              to="/student/referrals"
              className={navItemClass(isActive("/student/referrals"))}
            >
              <Share2 className="w-4 h-4 shrink-0" />
              <span className="truncate">Referrals</span>
            </NavLink>
            <NavLink
              to="/student/success"
              className={navItemClass(
                isActive("/student/success") || isActive("/stories"),
              )}
            >
              <Trophy className="w-4 h-4 shrink-0" />
              <span className="truncate">Success Stories</span>
            </NavLink>
          </nav>

          {/* Secondary group */}
          <nav className="space-y-0.5">
            <NavLink
              to="/student/message"
              className={navItemClass(isActive("/student/message"))}
            >
              <MessageSquare className="w-4 h-4 shrink-0" />
              <span className="truncate">Message</span>
            </NavLink>
          </nav>

          {/* Settings */}
          <div id="nav-settings-group">
            <NavLink
              to="/student/accounts"
              className={navItemClass(isSettingsActive)}
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span className="truncate">Settings</span>
            </NavLink>
          </div>
        </div>

        {/* User + Logout */}
        <div className="p-2.5 border-t border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2.5 px-2 py-2 mb-1 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
            <div className="h-8 w-8 rounded-full bg-emerald-50 text-brand flex items-center justify-center text-[11px] font-semibold shrink-0 ring-1 ring-emerald-100 dark:bg-emerald-950 dark:text-brand dark:ring-brand">
              <ProfileAvatar user={user} fallback="S" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-zinc-800 dark:text-zinc-100 truncate leading-tight">
                {user?.name || "Student"}
              </p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate leading-tight mt-0.5">
                {user?.email || "student@clsu.edu.ph"}
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

export default StudentSidebar;
