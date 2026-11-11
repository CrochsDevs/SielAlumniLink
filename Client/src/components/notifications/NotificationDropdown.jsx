import { useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  Bell,
  BellOff,
  Briefcase,
  CalendarDays,
  Megaphone,
  Users,
  MessageCircle,
  ThumbsUp,
  Repeat2,
} from "lucide-react";
import { useAuth } from "../../context/useAuth";
import ProfileAvatar from "../profile/ProfileAvatar";
import { notificationTime, notificationText, messageNotificationLink } from "./notificationFormat";
import TopbarPanel from "../ui/TopbarPanel";
import ContentSkeleton from "../ui/Skeleton";

// Notification links are authored for alumni pages — resolve them
// to the equivalent page for the current role.
const ADMIN_LINKS = {
  "/alumni/message": "/admin/message",
  "/message": "/admin/message",
  "/alumni/career": "/admin/jobs",
  "/requests": "/admin/users",
};
const STUDENT_LINKS = {
  "/alumni/message": "/student/message",
  "/message": "/student/message",
  "/alumni/career": "/student/career",
  "/requests": "/student/requests",
};

const filters = ["All", "Unread", "Connections", "Jobs"];
const kindIcons = {
  jobs: Briefcase,
  events: CalendarDays,
  announcements: Megaphone,
  connection_request: Users,
  connection_response: Users,
  feed_comment: MessageCircle,
  feed_like: ThumbsUp,
  feed_share: Repeat2,
};

// Shared notification dropdown panel (wired to useNotifications data).
const NotificationDropdown = ({ items, onRead, onReadAll, onClose, triggerRef, loading = false }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [filter, setFilter] = useState("All");
  const visibleItems = items.filter(
    (item) =>
      filter === "All" ||
      (filter === "Unread" && !item.read) ||
      (filter === "Connections" && item.kind?.startsWith("connection_")) ||
      (filter === "Jobs" && item.kind === "jobs"),
  );

  const resolveLink = (link) => {
    if (!link) return null;
    const messageLink = messageNotificationLink(link, user?.role);
    if (messageLink) return messageLink;
    if (user?.role === "admin") return ADMIN_LINKS[link] || link;
    if (user?.role === "student") return STUDENT_LINKS[link] || link;
    if (link === "/requests") return "/alumni/requests";
    if (link === "/message") return "/alumni/message";
    return link;
  };

  const open = (item) => {
    if (!item.read) onRead(item._id);
    onClose();
    const target = resolveLink(item.link);
    if (target) navigate(target);
  };

  return (
    <TopbarPanel title="Notifications" triggerRef={triggerRef} onClose={onClose}
      className="notifications-panel w-[min(420px,calc(100vw-112px))] max-w-none"
      action={<button type="button" onClick={onReadAll} disabled={!items.some(item => !item.read)}
        className="text-[11.5px] font-semibold text-primary hover:underline disabled:opacity-40">Mark all read</button>}>
      <div
        aria-label="Filter notifications"
        className="flex flex-wrap gap-1.5 border-b border-zinc-100 px-4 pb-3 dark:border-zinc-800"
      >
        {filters.map((label) => (
          <button
            key={label}
            type="button"
            aria-pressed={filter === label}
            onClick={() => setFilter(label)}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${filter === label ? "border-brand bg-brand text-white" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <ul className="notifications-list topbar-panel-list max-h-[min(480px,60dvh)] overflow-y-auto">
        {loading && <ContentSkeleton as="li" label="Loading notifications" />}
        {visibleItems.map((item) => {
          const text = notificationText(item);
          const Icon = kindIcons[item.kind] || Bell;
          return (
            <li key={item._id}>
              <button
                type="button"
                onClick={() => open(item)}
                className={`flex w-full items-start gap-3 border-b border-zinc-100 px-4 py-3.5 text-left transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800 ${
                  !item.read ? "bg-emerald-50/50 dark:bg-zinc-800/30" : ""
                }`}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-brand dark:bg-zinc-800 dark:text-brand">
                  {item.actor ? (
                    <ProfileAvatar user={item.actor} />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-3 text-[12.5px] leading-relaxed text-zinc-700 dark:text-zinc-200">
                    <strong className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {text.lead}
                    </strong>
                    {text.text}
                  </span>
                  {text.detail && (
                    <span className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                      {text.detail}
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 flex-col items-end gap-2 pt-0.5">
                  <time
                    dateTime={item.createdAt}
                    className="text-[10.5px] text-zinc-500 dark:text-zinc-400"
                  >
                    {notificationTime(item.createdAt)}
                  </time>
                  {!item.read && (
                    <span
                      aria-label="Unread notification"
                      className="h-2 w-2 rounded-full bg-brand"
                    />
                  )}
                </span>
              </button>
            </li>
          );
        })}
        {!loading && visibleItems.length === 0 && (
          <li className="flex flex-col items-center px-4 py-8 text-center">
            <BellOff className="h-7 w-7 text-zinc-300 dark:text-zinc-600" />
            <p className="mt-2 text-[12.5px] font-semibold text-zinc-500 dark:text-zinc-400">
              {filter === "All"
                ? "No notifications yet"
                : `No ${filter.toLowerCase()} notifications`}
            </p>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
              {filter === "All"
                ? "New announcements, jobs, events, and connections appear here."
                : "Try another filter to see more notifications."}
            </p>
          </li>
        )}
      </ul>
    </TopbarPanel>
  );
};

export default NotificationDropdown;
