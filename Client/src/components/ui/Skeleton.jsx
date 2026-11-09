import "./Skeleton.css";

export function Skeleton({ className = "", style, ...props }) {
  return <span {...props} aria-hidden="true" className={`siel-skeleton ${className}`} style={style} />;
}

function Lines() {
  return <div className="siel-skeleton-lines"><Skeleton className="siel-skeleton-title" /><Skeleton /><Skeleton className="siel-skeleton-short" /></div>;
}

function Placeholder({ variant }) {
  if (variant === "form") return <div className="siel-skeleton-fields">{Array.from({ length: 4 }, (_, i) => <div key={i}><Skeleton className="siel-skeleton-label" /><Skeleton className="siel-skeleton-input" /></div>)}</div>;
  if (variant === "calendar") return <><Skeleton className="siel-skeleton-title" /><div className="siel-skeleton-calendar">{Array.from({ length: 35 }, (_, i) => <Skeleton key={i} className="siel-skeleton-day" />)}</div></>;
  if (variant === "profile") return <><Skeleton className="siel-skeleton-cover" /><Skeleton className="siel-skeleton-avatar siel-skeleton-profile-avatar" /><Lines /><div className="siel-skeleton-fields"><Lines /><Lines /></div></>;
  return <>
    {variant !== "form" && <div className="siel-skeleton-person"><Skeleton className="siel-skeleton-avatar" /><Lines /></div>}
    {["cards", "feed", "detail", "messages"].includes(variant) && <Lines />}
    {["cards", "feed", "detail"].includes(variant) && <Skeleton className="siel-skeleton-media" />}
    {variant === "messages" && <Skeleton className="siel-skeleton-bubble" />}
  </>;
}

// Use inside the existing loading branch so errors and empty states stay distinct.
export default function ContentSkeleton({ variant = "list", count = 3, label = "Loading content", className = "", as: Component = "div" }) {
  return <Component role="status" aria-live="polite" aria-busy="true" className={`siel-loading siel-loading--${variant} ${className}`}>
    <span className="sr-only">{label}</span>
    <div aria-hidden="true" className="siel-loading-items">
      {Array.from({ length: count }, (_, index) => <div key={index} className="siel-loading-item">
        {variant === "table" ? Array.from({ length: 5 }, (_, column) => <Skeleton key={column} />) : <Placeholder variant={variant} />}
      </div>)}
    </div>
  </Component>;
}

export function PageSkeleton({ label = "Loading your workspace" }) {
  return <div className="siel-page-skeleton">
    <aside aria-hidden="true" className="siel-page-skeleton-sidebar"><Skeleton className="siel-skeleton-logo" />{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="siel-skeleton-input" />)}</aside>
    <div className="siel-page-skeleton-main"><div aria-hidden="true" className="siel-page-skeleton-topbar"><Skeleton className="siel-skeleton-title" /><Skeleton className="siel-skeleton-avatar" /></div>
      <div className="siel-page-skeleton-content"><ContentSkeleton label={label} variant="detail" count={1} /><ContentSkeleton variant="cards" /><ContentSkeleton variant="table" count={5} /></div>
    </div>
  </div>;
}
