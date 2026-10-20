import { createElement } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import "./AdminStatCard.css";

export default function AdminStatCard({ label, value, caption, detail, icon, featured = false, to, onClick, selected, loading = false }) {
  const Component = to ? Link : onClick ? "button" : "article";
  const actionProps = to ? { to } : onClick ? { type: "button", onClick, "aria-pressed": selected, disabled: loading } : {};
  return <Component {...actionProps} aria-busy={loading || undefined} className={`admin-stat-card dashboard-stat ${featured ? "dashboard-stat-featured" : ""}`}>
    <div className="dashboard-stat-header">
      <span className="dashboard-stat-icon">{createElement(icon, { size: 15, strokeWidth: 1.7, "aria-hidden": true })}</span>
      <p className="dashboard-stat-label">{label}</p>
      {(to || onClick) && <ArrowUpRight size={15} className="dashboard-card-arrow" aria-hidden="true" />}
    </div>
    <div className="dashboard-stat-body">
      <p className="dashboard-stat-value">{loading || value == null ? "—" : typeof value === "number" ? value.toLocaleString() : value}</p>
      <span className="dashboard-stat-caption">{caption}</span>
    </div>
    {detail && <div className="dashboard-stat-footer"><span className="dashboard-status-dot" /><p className="dashboard-stat-detail">{loading ? "Loading..." : detail}</p>{(to || onClick) && <ArrowRight size={12} aria-hidden="true" />}</div>}
  </Component>;
}
