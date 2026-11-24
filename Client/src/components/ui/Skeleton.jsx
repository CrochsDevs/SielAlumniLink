import "./Skeleton.css";
import { createElement } from 'react';
import { loadingLayout } from '../../utils/loadingLayout';

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
export default function ContentSkeleton({ variant = "list", count = 3, label = "Loading content", className = "", as: Component = "div", announce = true }) {
  return createElement(Component, { role: announce ? 'status' : undefined, 'aria-live': announce ? 'polite' : undefined, 'aria-busy': announce ? true : undefined, className: `siel-loading siel-loading--${variant} ${className}` }, <>
    {announce && <span className="sr-only">{label}</span>}
    <div aria-hidden="true" className="siel-loading-items">
      {Array.from({ length: count }, (_, index) => <div key={index} className="siel-loading-item">
        {variant === "table" ? Array.from({ length: 5 }, (_, column) => <Skeleton key={column} />) : <Placeholder variant={variant} />}
      </div>)}
    </div>
  </>);
}

export function PageSkeleton({ label = "Loading your workspace", pathname = '', variant = loadingLayout(pathname) }) {
  return <div className="siel-page-skeleton" role="status" aria-live="polite" aria-busy="true">
    <span className="sr-only">{label}</span>
    <aside aria-hidden="true" className="siel-page-skeleton-sidebar"><Skeleton className="siel-skeleton-logo" />{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="siel-skeleton-input" />)}</aside>
    <div className="siel-page-skeleton-main"><div aria-hidden="true" className="siel-page-skeleton-topbar"><Skeleton className="siel-skeleton-title" /><Skeleton className="siel-skeleton-avatar" /></div>
      <div className="siel-page-skeleton-content" aria-hidden="true">
        <div className="siel-page-skeleton-heading"><Skeleton className="siel-skeleton-title" /><Skeleton className="siel-skeleton-short" /></div>
        {variant === 'dashboard' ? <><div className="siel-skeleton-stats">{Array.from({ length: 4 }, (_, index) => <div key={index}><Skeleton className="siel-skeleton-short" /><Skeleton className="siel-skeleton-stat-value" /></div>)}</div><ContentSkeleton announce={false} variant="table" count={5} /></> : <ContentSkeleton announce={false} variant={variant} count={['form', 'profile', 'calendar'].includes(variant) ? 1 : variant === 'table' ? 6 : 3} />}
      </div>
    </div>
  </div>;
}

export function StudentFeedSkeleton({ label = "Loading your student page" }) {
  return <main className="student-feed-skeleton" role="status" aria-live="polite" aria-busy="true">
    <span className="sr-only">{label}</span>
    <div className="student-feed-skeleton-grid" aria-hidden="true">
      <section className="student-feed-skeleton-post">
        <Skeleton className="student-feed-skeleton-post-media" />
        <div className="student-feed-skeleton-post-actions">
          <div><Skeleton className="student-feed-skeleton-line student-feed-skeleton-line-short" /><Skeleton className="student-feed-skeleton-line" /></div>
          <Skeleton className="student-feed-skeleton-pill" />
        </div>
        <div className="student-feed-skeleton-copy"><Skeleton /><Skeleton className="student-feed-skeleton-line-short" /><Skeleton className="student-feed-skeleton-line-medium" /><Skeleton className="student-feed-skeleton-line" /></div>
        <div className="student-feed-skeleton-footer"><Skeleton className="student-feed-skeleton-button" /></div>
      </section>
      <section className="student-feed-skeleton-side">
        <header><Skeleton className="student-feed-skeleton-avatar" /><div><Skeleton className="student-feed-skeleton-line" /><Skeleton className="student-feed-skeleton-line-short" /></div></header>
        <Skeleton className="student-feed-skeleton-side-media" />
      </section>
    </div>
  </main>;
}
