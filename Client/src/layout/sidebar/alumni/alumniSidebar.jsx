import { createElement, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Briefcase, FileText, CalendarDays, Route, BarChart3,
  ClipboardList, Trophy, UserPlus, MessageSquare, Settings, LogOut, X,
} from "lucide-react";
import clsuLogo from "../../../assets/logo/clsu_logo.png";
import ProfileAvatar from "../../../components/profile/ProfileAvatar";
import "./alumniSidebar.css";

let sidebarScrollTop = 0;

const menuGroups = [
  { label: "Overview", items: [
    { to: "/alumni", label: "Dashboard", icon: LayoutDashboard, end: true, aliases: ["/feed"] },
    { to: "/alumni/journey", label: "Journey", icon: Route, aliases: ["/student/journey"] },
  ] },
  { label: "Career & Growth", items: [
    { to: "/alumni/career", label: "Career", icon: Briefcase },
    { to: "/alumni/employment", label: "Employment", icon: Briefcase },
    { to: "/alumni/mentorship", label: "Mentorship", icon: ClipboardList },
    { to: "/alumni/readiness", label: "Readiness", icon: BarChart3, aliases: ["/student/readiness"] },
  ] },
  { label: "Community", items: [
    { to: "/alumni/success", label: "Success Stories", icon: Trophy, aliases: ["/stories"] },
    { to: "/alumni/events", label: "Events", icon: CalendarDays },
    { to: "/alumni/surveys", label: "Surveys", icon: FileText },
    { to: "/alumni/requests", label: "Requests", icon: UserPlus },
    { to: "/alumni/message", label: "Messages", icon: MessageSquare },
  ] },
];

export default function AlumniSidebar({ user, mobileOpen: controlledOpen, setMobileOpen: controlledSet }) {
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
  const settingsActive = matchesPath("/alumni/accounts") || location.pathname === "/alumni/profile";

  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = event => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen, setMobileOpen]);

  return <>
    {mobileOpen && <button type="button" aria-label="Close sidebar overlay" className="alumni-sidebar-overlay fixed inset-0 z-20 lg:hidden" onClick={() => setMobileOpen(false)} />}
    <aside id="sidebar" aria-label="Alumni sidebar" className={`alumni-sidebar fixed left-0 top-0 z-30 flex h-full w-64 flex-col transition-transform duration-200 ${mobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}>
      <div className="alumni-sidebar-brand">
        <Link to="/alumni" onClick={() => setMobileOpen(false)} className="alumni-brand-link">
          <span className="alumni-brand-logo"><img src={clsuLogo} alt="CLSU" /></span>
          <span><span className="alumni-brand-name">Siel<span>Alumni</span></span><span className="alumni-brand-caption">CLSU Alumni Link</span></span>
        </Link>
        <button type="button" className="alumni-sidebar-close lg:hidden" aria-label="Close sidebar" onClick={() => setMobileOpen(false)}><X size={16} /></button>
      </div>
      <div className="alumni-sidebar-scroll" ref={scrollRef} onScroll={event => { sidebarScrollTop = event.currentTarget.scrollTop; }}>
        {menuGroups.map(group => <nav key={group.label} aria-label={group.label} className="alumni-menu-group">
          <p className="alumni-menu-label">{group.label}</p>
          {group.items.map(item => {
            const active = matchesPath(item.to, item.end) || item.aliases?.some(path => matchesPath(path));
            return <Link key={item.to} to={item.to} aria-current={active ? "page" : undefined} onClick={() => setMobileOpen(false)} className={`alumni-menu-item ${active ? "is-active !bg-[#009639] !border-[#009639] !text-white" : ""}`}>
            {createElement(item.icon, { size: 16, strokeWidth: 1.7, "aria-hidden": true })}<span>{item.label}</span>
            </Link>;
          })}
        </nav>)}
      </div>
      <div className="alumni-sidebar-bottom">
        <Link to="/alumni/accounts" aria-current={settingsActive ? "page" : undefined} onClick={() => setMobileOpen(false)} className={`alumni-menu-item ${settingsActive ? "is-active !bg-[#009639] !border-[#009639] !text-white" : ""}`}><Settings size={16} strokeWidth={1.7} aria-hidden="true" /><span>Settings</span></Link>
        <div className="alumni-sidebar-account">
          <Link to="/alumni/profile" className="alumni-account-link" onClick={() => setMobileOpen(false)} aria-label="View your profile">
            <span className="alumni-account-avatar"><ProfileAvatar user={user} fallback="A" /></span>
            <span className="alumni-account-details"><strong>{user?.name || "Alumni"}</strong><span>{user?.email || "Alumni member"}</span></span>
          </Link>
        </div>
        <button type="button" onClick={() => { setMobileOpen(false); navigate("/logout"); }} className="alumni-sidebar-logout"><LogOut size={16} strokeWidth={1.7} aria-hidden="true" /><span>Logout</span></button>
      </div>
    </aside>
  </>;
}
