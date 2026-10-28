import { createElement } from "react";

export default function PageTitle({ icon, children, className = "" }) {
  return <h1 className={`workspace-page-title flex items-center gap-3 ${className}`}>
    {icon && createElement(icon, { size: 28, className: "shrink-0 text-brand", "aria-hidden": true })}
    <span className="min-w-0">{children}</span>
  </h1>;
}
