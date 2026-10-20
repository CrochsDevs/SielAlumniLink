import { createElement, useId } from "react";
import { Link } from "react-router-dom";
import "./AdminUI.css";

export function AdminButton({ to, variant = "primary", className = "", type = "button", children, ...props }) {
  const Component = to ? Link : "button";
  return <Component {...(to ? { to } : { type })} {...props} className={`admin-button admin-button-${variant} ${className}`}>{children}</Component>;
}

export function AdminTabs({ items, value, onChange, label, className = "" }) {
  return <nav aria-label={label} className={`admin-tabs ${className}`}>
    {items.map(item => <button key={item.id} type="button" aria-label={item.ariaLabel} aria-pressed={value === item.id} onClick={() => onChange(item.id)}>
      {item.icon && createElement(item.icon, { size: 14, "aria-hidden": true })}
      <span>{item.label}</span>
      {item.count != null && <span className="admin-tab-count">{item.count}</span>}
      {item.badge && <span className="admin-tab-badge">{item.badge}</span>}
    </button>)}
  </nav>;
}

export function AdminStatGrid({ columns = 3, children, label = "Summary statistics", className = "" }) {
  return <div aria-label={label} className={`admin-stat-grid ${className}`} style={{ "--stat-columns": columns, "--stat-tablet-columns": Math.min(columns, 2) }}>{children}</div>;
}

export function AdminSwitch({ label, description, checked, onChange, disabled = false }) {
  const id = useId();
  return <button type="button" role="switch" aria-checked={checked} aria-labelledby={`${id}-label`} aria-describedby={description ? `${id}-description` : undefined} disabled={disabled} onClick={() => onChange(!checked)} className="admin-switch">
    <span className="admin-switch-copy">
      <span id={`${id}-label`} className="admin-switch-label">{label}</span>
      {description && <span id={`${id}-description`} className="admin-switch-description">{description}</span>}
    </span>
    <span className="admin-switch-track" aria-hidden="true"><span className="admin-switch-thumb" /></span>
  </button>;
}
