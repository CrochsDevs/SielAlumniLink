// UTC-backed civil dates in Manila keep calendar cells independent of device timezone.
const DAY = 86400000;
const manilaDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export const calendarDate = (value) => {
  const parts = Object.fromEntries(
    manilaDate
      .formatToParts(new Date(value))
      .map((part) => [part.type, part.value]),
  );
  return new Date(
    Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)),
  );
};
export const addDays = (date, count) => new Date(date.getTime() + count * DAY);
export const dateKey = (date) => date.toISOString().slice(0, 10);
export const dateLabel = (
  date,
  options = { month: "long", day: "numeric", year: "numeric" },
) => date.toLocaleDateString("en-US", { ...options, timeZone: "UTC" });
export const eventTime = (value) =>
  new Date(value).toLocaleTimeString("en-US", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
  });
export const eventDateTime = (value) =>
  new Date(value).toLocaleString("en-US", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  });
export const weekDates = (date) =>
  Array.from({ length: 7 }, (_, index) =>
    addDays(date, index - date.getUTCDay()),
  );
export const monthDates = (date) => {
  const first = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1),
  );
  const daysInMonth = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const cellCount = Math.ceil((first.getUTCDay() + daysInMonth) / 7) * 7;
  return Array.from({ length: cellCount }, (_, index) =>
    addDays(first, index - first.getUTCDay()),
  );
};
export const shiftMonth = (date, count) => {
  const first = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + count, 1),
  );
  const lastDay = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  first.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return first;
};
export const eventsOnDate = (events, date) => {
  const start = date.getTime() - 8 * 3600000;
  return events
    .filter((event) => {
      const eventStart = new Date(event.startAt).getTime();
      const eventEnd = event.endAt
        ? new Date(event.endAt).getTime()
        : eventStart + 3600000;
      return (
        eventStart < start + DAY && Math.max(eventEnd, eventStart + 1) > start
      );
    })
    .sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
};
export const activityLabel = (event) =>
  ({ event: "Event", training: "Training", seminar: "Seminar" })[
    event.activityType
  ] || "Event";
export const activityStyle = (event) =>
  ({
    event: {
      card: "bg-sky-50 text-sky-950 border-sky-200 dark:bg-sky-400/10 dark:text-sky-100 dark:border-sky-800",
      dot: "bg-sky-500",
    },
    training: {
      card: "bg-violet-50 text-violet-950 border-violet-200 dark:bg-violet-400/10 dark:text-violet-100 dark:border-violet-800",
      dot: "bg-violet-500",
    },
    seminar: {
      card: "bg-amber-50 text-amber-950 border-amber-200 dark:bg-amber-400/10 dark:text-amber-100 dark:border-amber-800",
      dot: "bg-amber-500",
    },
  })[event.activityType] || {
    card: "bg-sky-50 text-sky-950 border-sky-200 dark:bg-sky-400/10 dark:text-sky-100 dark:border-sky-800",
    dot: "bg-sky-500",
  };
