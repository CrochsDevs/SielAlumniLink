import { createElement } from "react";
import "./stat-card.css";

// Use inside a <dl> so every summary retains its label/value relationship.
export default function StatCard({ label, value, note, icon, tone = "positive", compact = false }) {
  return <div className={`app-stat-card${compact ? " app-stat-card-compact" : ""}`}>
    <dt className="app-stat-label">
      <span>{label}</span>
      {icon && <span className={`app-stat-icon app-stat-icon-${tone}`}>
        {createElement(icon, { size: 17, "aria-hidden": true })}
      </span>}
    </dt>
    <dd className="app-stat-value">{value ?? "—"}</dd>
    {note && <dd className="app-stat-note">{note}</dd>}
  </div>;
}
