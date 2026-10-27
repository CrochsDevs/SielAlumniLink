import { createElement, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Route, FolderKanban, Briefcase, Users, Award,
  BadgeCheck, BarChart3, Share2, CalendarDays, Trophy,
  MessageSquare, UserPlus, Settings, LogOut, X,
} from "lucide-react";
import clsuLogo from "../../../assets/logo/clsu_logo.png";
import ProfileAvatar from "../../../components/profile/ProfileAvatar";
import "./studentSidebar.css";

let sidebarScrollTop = 0;

const menuGroups = [
  { label: "Overview", items: [
    { to: "/student", label: "Dashboard", icon: LayoutDashboard, end: true, aliases: ["/feed"] },
    { to: "/student/journey", label: "Journey", icon: Route },
    { to: "/student/portfolio", label: "Portfolio", icon: FolderKanban },
  ] },
  { label: "Career & Growth", items: [
    { to: "/student/internship", label: "Internship", icon: Briefcase },
    { to: "/student/mentorship", label: "Mentorship", icon: Users },
    { to: "/student/competency", label: "Competency", icon: Award },
    { to: "/student/certificate", label: "Certificate", icon: BadgeCheck },
    { to: "/student/readiness", label: "Readiness", icon: BarChart3 },
    { to: "/student/career", label: "Career", icon: Briefcase },
    { to: "/student/referrals", label: "Referrals", icon: Share2 },
  ] },
  { label: "Community", items: [
    { to: "/student/events", label: "Events", icon: CalendarDays, aliases: ["/activities"] },
    { to: "/student/success", label: "Success Stories", icon: Trophy, aliases: ["/stories"] },
    { to: "/student/requests", label: "Requests", icon: UserPlus },
    { to: "/student/message", label: "Messages", icon: MessageSquare },
  ] },
];

export default function StudentSidebar({ user, mobileOpen: controlledOpen, setMobileOpen: controlledSet }) {
  const location = useLocation();
  const navigate = useNavigate();
  const scrollRef = useRef(null);
  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = sidebarScrollTop;
  }, []);
  const [internalOpen, setInternalOpen] = useState(false);
  const mobileOpen = controlledOpen ?? internalOpen;
  const setMobileOpen = controlledSet ?? setInternalOpen;
  const matchesPath = (path, end = false) => location.pathname === path || (!end && location.pathname.startsWith(path + "/"));
  const settingsActive = matchesPath("/student/accounts") || location.pathname === "/student/profile";

  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = event => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen, setMobileOpen]);

  return <>
    {mobileOpen && <button type="button" aria-label="Close sidebar overlay" className="student-sidebar-overlay fixed inset-0 z-20 lg:hidden" onClick={() => setMobileOpen(false)} />}
    <aside id="sidebar" aria-label="Student sidebar" className={`student-sidebar fixed left-0 top-0 z-30 flex h-full w-64 flex-col transition-transform duration-200 ${mobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}>
      <div className="student-sidebar-brand">
        <Link to="/student" onClick={() => setMobileOpen(false)} className="student-brand-link">
          <span className="student-brand-logo"><img src={clsuLogo} alt="CLSU" /></span>
          <span><span className="student-brand-name">Siel<span>Alumni</span></span><span className="student-brand-caption">CLSU Alumni Link</span></span>
        </Link>
        <button type="button" className="student-sidebar-close lg:hidden" aria-label="Close sidebar" onClick={() => setMobileOpen(false)}><X size={16} /></button>
      </div>
      <div className="student-sidebar-scroll" ref={scrollRef} onScroll={event => { sidebarScrollTop = event.currentTarget.scrollTop; }}>
        {menuGroups.map(group => <nav key={group.label} aria-label={group.label} className="student-menu-group">
          <p className="student-menu-label">{group.label}</p>
          {group.items.map(item => {
            const active = matchesPath(item.to, item.end) || item.aliases?.some(path => matchesPath(path));
            return <Link key={item.to} to={item.to} aria-current={active ? "page" : undefined} onClick={() => setMobileOpen(false)} className={`student-menu-item ${active ? "is-active !bg-[#009639] !border-[#009639] !text-white" : ""}`}>
            {createElement(item.icon, { size: 16, strokeWidth: 1.7, "aria-hidden": true })}<span>{item.label}</span>
            </Link>;
          })}
        </nav>)}
      </div>
      <div className="student-sidebar-bottom">
        <Link to="/student/accounts" aria-current={settingsActive ? "page" : undefined} onClick={() => setMobileOpen(false)} className={`student-menu-item ${settingsActive ? "is-active !bg-[#009639] !border-[#009639] !text-white" : ""}`}><Settings size={16} strokeWidth={1.7} aria-hidden="true" /><span>Settings</span></Link>
        <div className="student-sidebar-account">
          <Link to="/student/profile" className="student-account-link" onClick={() => setMobileOpen(false)} aria-label="View your profile">
            <span className="student-account-avatar"><ProfileAvatar user={user} fallback="S" /></span>
            <span className="student-account-details"><strong>{user?.name || "Student"}</strong><span>{user?.email || "Student member"}</span></span>
          </Link>
        </div>
        <button type="button" onClick={() => { setMobileOpen(false); navigate("/logout"); }} className="student-sidebar-logout"><LogOut size={16} strokeWidth={1.7} aria-hidden="true" /><span>Logout</span></button>
      </div>
    </aside>
  </>;
}
