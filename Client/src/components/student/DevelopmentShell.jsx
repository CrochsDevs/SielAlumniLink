import ContentSkeleton from "../ui/Skeleton";
import { createElement, useState } from "react";
import { useAuth } from "../../context/useAuth";
import StudentSidebar from "../../layout/sidebar/student/studentSidebar";
import StudentTopbar from "../../layout/topbar/student/studentTopbar";
import AlumniSidebar from "../../layout/sidebar/alumni/alumniSidebar";
import AlumniTopbar from "../../layout/topbar/alumni/alumniTopbar";
import AdminSidebar from "../../layout/sidebar/admin/adminSidebar";
import AdminTopbar from "../../layout/topbar/alumni/adminTopbar";

export const developmentCard =
  "rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900";
export const developmentInput =
  "mt-1.5 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-brand dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:[color-scheme:dark]";
export const developmentButton =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-xs font-semibold text-white disabled:opacity-50";
export function DevelopmentStatus({ state, variant = "cards", showLoading = true }) {
  return (
    <>
      {state.error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-white p-4 text-sm text-red-600 dark:border-red-900 dark:bg-zinc-900 dark:text-red-400"
        >
          {state.error}{" "}
          <button
            type="button"
            onClick={state.load}
            className="font-semibold underline"
          >
            Retry
          </button>
        </p>
      )}
      {state.loading && showLoading && (
        <ContentSkeleton variant={variant} count={variant === "form" ? 1 : 3} label="Loading your records…" />
      )}
    </>
  );
}
export default function DevelopmentShell({ title, children }) {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const alumni = user?.role === "alumni";
  const admin = user?.role === "admin";
  return (
    <div
      className={`${alumni || admin ? "" : "student-page "}min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100`}
    >
      {createElement(admin ? AdminSidebar : alumni ? AlumniSidebar : StudentSidebar, {
        user,
        mobileOpen: sidebarOpen,
        setMobileOpen: setSidebarOpen,
      })}
      <div className="lg:pl-64">
        {createElement(admin ? AdminTopbar : alumni ? AlumniTopbar : StudentTopbar, {
          user,
          title,
          onMenuClick: () => setSidebarOpen(true),
        })}
        {children}
      </div>
    </div>
  );
}
