import { lazy, Suspense } from "react";

const OpportunityEditor = lazy(() => import("./OpportunityEditor"));

export default function LazyOpportunityEditor(props) {
  return <Suspense fallback={<div role="status" className="min-h-52 rounded-lg border border-zinc-300 p-4 text-sm">Loading description editor…</div>}><OpportunityEditor {...props} /></Suspense>;
}
