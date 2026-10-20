import { createElement, useEffect, useState } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, ClipboardCheck, Briefcase, FileText, Calendar,
  Link2, Megaphone, MessageSquare, Settings, LogOut, Award, X,
} from "lucide-react";
import clsuLogo from "../../../assets/logo/clsu_logo.png";
import ProfileAvatar from "../../../components/profile/ProfileAvatar";
import "./adminSidebar.css";

const menuGroups = [
  { label: "Overview", items: [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/admin/users", label: "Users", icon: Users },
    { to: "/feed", label: "Alumni Feed", icon: MessageSquare },
  ] },
  { label: "Management", items: [
    { to: "/admin/tracer", label: "Tracer Study", icon: ClipboardCheck },
    { to: "/admin/jobs", label: "Job Posts", icon: Briefcase },
    { to: "/admin/surveys", label: "Surveys", icon: FileText },
    { to: "/admin/certificates", label: "Certificates", icon: Award },
    { to: "/admin/events", label: "Calendar", icon: Calendar },
  ] },
  { label: "Community", items: [
    { to: "/admin/connections", label: "Connections", icon: Link2 },
    { to: "/admin/announcements", label: "Announcements", icon: Megaphone },
    { to: "/admin/message", label: "Messages", icon: MessageSquare },
  ] },
];

export default function AdminSidebar({ user, mobileOpen: controlledOpen, setMobileOpen: controlledSet }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [internalOpen, setInternalOpen] = useState(false);
  const mobileOpen = controlledOpen ?? internalOpen;
  const setMobileOpen = controlledSet ?? setInternalOpen;

  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = event => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen, setMobileOpen]);

  return <>
    {mobileOpen && <button type="button" aria-label="Close sidebar overlay" className="admin-sidebar-overlay fixed inset-0 z-20 lg:hidden" onClick={() => setMobileOpen(false)} />}
    <aside id="sidebar" aria-label="Admin sidebar" className={`admin-sidebar fixed left-0 top-0 z-30 flex h-full w-64 flex-col transition-transform duration-200 ${mobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}>
      <div className="admin-sidebar-brand">
        <Link to="/admin" onClick={() => setMobileOpen(false)} className="admin-brand-link">
          <span className="admin-brand-logo"><img src={clsuLogo} alt="CLSU" /></span>
          <span><span className="admin-brand-name">Siel<span>Alumni</span></span><span className="admin-brand-caption">Administration workspace</span></span>
        </Link>
        <button type="button" className="admin-sidebar-close lg:hidden" aria-label="Close sidebar" onClick={() => setMobileOpen(false)}><X size={16} /></button>
      </div>
      <div className="admin-sidebar-scroll">
        {menuGroups.map(group => <nav key={group.label} aria-label={group.label} className="admin-menu-group">
          <p className="admin-menu-label">{group.label}</p>
          {group.items.map(item => <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setMobileOpen(false)} className={({ isActive }) => `admin-menu-item ${isActive || (item.to === "/admin" && location.pathname === "/admin/dashboard") ? "is-active" : ""}`}>
            {createElement(item.icon, { size: 16, strokeWidth: 1.7, "aria-hidden": true })}<span>{item.label}</span>
          </NavLink>)}
        </nav>)}
      </div>
      <div className="admin-sidebar-bottom">
        <NavLink to="/admin/settings" onClick={() => setMobileOpen(false)} className={({ isActive }) => `admin-menu-item ${isActive ? "is-active" : ""}`}><Settings size={16} strokeWidth={1.7} aria-hidden="true" /><span>Settings</span></NavLink>
        <div className="admin-sidebar-account">
          <Link to="/admin/settings" className="admin-account-link" onClick={() => setMobileOpen(false)} aria-label="Account settings">
            <span className="admin-account-avatar"><ProfileAvatar user={user} fallback="A" /></span>
            <span className="admin-account-details"><strong>{user?.name || "Admin"}</strong><span>{user?.email || "Administrator"}</span></span>
          </Link>
          <button type="button" onClick={() => navigate("/logout")} className="admin-sidebar-logout" aria-label="Logout" title="Logout"><LogOut size={16} strokeWidth={1.7} /></button>
        </div>
      </div>
    </aside>
  </>;
}
