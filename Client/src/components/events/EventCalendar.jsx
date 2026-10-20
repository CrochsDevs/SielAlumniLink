import { useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Video,
  Check,
} from "lucide-react";
import {
  activityLabel,
  activityStyle,
  addDays,
  calendarDate,
  dateKey,
  dateLabel,
  eventsOnDate,
  eventTime,
  monthDates,
  shiftMonth,
  weekDates,
} from "../../utils/eventCalendar";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const panel =
  "rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900";
const iconButton =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 focus-visible:outline-brand dark:text-zinc-400 dark:hover:bg-zinc-800";
const timeForDay = (event, day) =>
  dateKey(calendarDate(event.startAt)) === dateKey(day)
    ? eventTime(event.startAt)
    : "Continues";

function ActivityCard({ event, day, onOpen }) {
  const colors = activityStyle(event);
  return (
    <button
      type="button"
      data-calendar-event={event._id}
      onClick={() => onOpen(event)}
      className={`w-full rounded-lg border p-3 text-left transition hover:brightness-95 focus-visible:outline-brand ${colors.card}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
          {activityLabel(event)}
        </span>
        {event.registration && (
          <Check size={13} aria-label="Registered" className="shrink-0" />
        )}
      </div>
      <p className="mt-1 break-words text-xs font-semibold leading-5">
        {event.title}
      </p>
      <p className="mt-2 flex items-center gap-1.5 text-[11px] opacity-75">
        <Clock size={12} />
        {timeForDay(event, day)}
        {event.endAt &&
          dateKey(calendarDate(event.endAt)) === dateKey(day) &&
          ` – ${eventTime(event.endAt)}`}
      </p>
      <p className="mt-1 flex items-start gap-1.5 text-[11px] opacity-75">
        {event.deliveryMode === "online" ? (
          <Video size={12} className="mt-0.5 shrink-0" />
        ) : (
          <MapPin size={12} className="mt-0.5 shrink-0" />
        )}
        <span className="break-words">
          {event.deliveryMode === "online"
            ? "Online"
            : event.location || "On-site"}
        </span>
      </p>
    </button>
  );
}

export default function EventCalendar({ events, onOpen, now }) {
  const today = calendarDate(now);
  const [selected, setSelected] = useState(() => calendarDate(now));
  const [view, setView] = useState("month");
  const days = monthDates(selected);
  const week = weekDates(selected);
  const daily = eventsOnDate(events, selected);
  const inMonth = (day) => day.getUTCMonth() === selected.getUTCMonth();
  const selectedKey = dateKey(selected);
  const todayKey = dateKey(today);
  const step = (count) =>
    setSelected((date) =>
      view === "month" || view === "list"
        ? shiftMonth(date, count)
        : addDays(date, count * (view === "week" ? 7 : 1)),
    );
  const title =
    view === "day"
      ? dateLabel(selected, { weekday: "long", month: "short", day: "numeric" })
      : view === "week"
        ? `${dateLabel(week[0], { month: "short", day: "numeric" })} – ${dateLabel(week[6], { month: "short", day: "numeric", year: "numeric" })}`
        : dateLabel(selected, { month: "long", year: "numeric" });
  const monthEvents = events
    .filter((event) =>
      days.some((day) => inMonth(day) && eventsOnDate([event], day).length),
    )
    .sort((a, b) => new Date(a.startAt) - new Date(b.startAt));

  return (
    <div
      className="grid min-w-0 items-start gap-5 xl:grid-cols-[248px_minmax(0,1fr)]"
      data-event-calendar
    >
      <aside className="hidden space-y-4 xl:block">
        <section className={`${panel} p-4`} aria-label="Mini calendar">
          <div className="mb-3 flex items-center justify-between gap-1">
            <h2 className="text-sm font-semibold">
              {dateLabel(selected, { month: "long", year: "numeric" })}
            </h2>
            <div className="flex">
              <button
                type="button"
                aria-label="Mini calendar previous month"
                onClick={() => setSelected(shiftMonth(selected, -1))}
                className={iconButton}
              >
                <ChevronLeft size={15} />
              </button>
              <button
                type="button"
                aria-label="Mini calendar next month"
                onClick={() => setSelected(shiftMonth(selected, 1))}
                className={iconButton}
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 text-center">
            {weekdays.map((day) => (
              <span key={day} className="pb-2 text-[10px] text-zinc-400">
                {day[0]}
              </span>
            ))}
            {days.map((day) => (
              <button
                type="button"
                key={dateKey(day)}
                aria-label={dateLabel(day)}
                aria-pressed={selectedKey === dateKey(day)}
                onClick={() => setSelected(day)}
                className={`relative mx-auto my-0.5 flex h-8 w-8 items-center justify-center rounded-full text-xs focus-visible:outline-brand ${selectedKey === dateKey(day) ? "bg-brand font-semibold text-white" : todayKey === dateKey(day) ? "font-semibold text-brand ring-1 ring-brand" : inMonth(day) ? "hover:bg-zinc-100 dark:hover:bg-zinc-800" : "text-zinc-400 dark:text-zinc-600"}`}
              >
                {day.getUTCDate()}
                {eventsOnDate(events, day).length > 0 && (
                  <span
                    className={`absolute bottom-0.5 h-1 w-1 rounded-full ${selectedKey === dateKey(day) ? "bg-white" : "bg-brand"}`}
                  />
                )}
              </button>
            ))}
          </div>
        </section>
        <section
          className={`${panel} p-4`}
          aria-label="Selected day activities"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Your selected day
          </p>
          <h2 className="mt-1 text-sm font-semibold">
            {dateLabel(selected, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </h2>
          <div className="mt-4 space-y-2">
            {daily.length ? (
              daily.map((event) => (
                <ActivityCard
                  key={event._id}
                  event={event}
                  day={selected}
                  onOpen={onOpen}
                />
              ))
            ) : (
              <p className="py-3 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
                No activities scheduled. Choose another date to explore the
                calendar.
              </p>
            )}
          </div>
        </section>
        <div className="px-1 text-xs text-zinc-500 dark:text-zinc-400">
          <p className="mb-3 font-medium">Activity types</p>
          {["event", "training", "seminar"].map((type) => (
            <p key={type} className="mb-2 flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${activityStyle({ activityType: type }).dot}`}
              />
              {activityLabel({ activityType: type })}
            </p>
          ))}
          <p className="mt-4 border-t border-zinc-200 pt-3 leading-5 dark:border-zinc-800">
            All schedules use Philippine time (GMT+8).
          </p>
        </div>
      </aside>
      <section
        className={`${panel} min-w-0 overflow-hidden`}
        aria-label="University activity calendar"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 p-4 sm:p-5 dark:border-zinc-800">
          <div className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              aria-label="Previous period"
              onClick={() => step(-1)}
              className={iconButton}
            >
              <ChevronLeft size={17} />
            </button>
            <button
              type="button"
              aria-label="Next period"
              onClick={() => step(1)}
              className={iconButton}
            >
              <ChevronRight size={17} />
            </button>
            <h2
              data-calendar-title
              className="ml-1 text-sm font-semibold sm:text-base"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setSelected(today)}
            className="min-h-9 rounded-lg border border-zinc-200 px-3 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Today
          </button>
          <div className="flex w-full items-center justify-between gap-2">
            <div
              className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800"
              aria-label="Calendar view"
            >
              {[
                ["day", "Day"],
                ["week", "Week"],
                ["month", "Month"],
                ["list", "List"],
              ].map(([id, label]) => (
                <button
                  type="button"
                  key={id}
                  aria-pressed={view === id}
                  onClick={() => setView(id)}
                  className={`min-h-8 rounded-md px-3 text-xs font-medium sm:px-4 ${view === id ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white" : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-zinc-400 sm:text-xs">GMT+8</span>
          </div>
        </div>
        {view === "month" && (
          <div data-calendar-month>
            <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800">
              {weekdays.map((day) => (
                <span
                  key={day}
                  className="py-3 text-center text-[10px] font-medium text-zinc-500 sm:text-xs"
                >
                  {day}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day) => {
                const key = dateKey(day),
                  items = eventsOnDate(events, day);
                return (
                  <div
                    key={key}
                    data-calendar-date={key}
                    className={`min-h-[92px] min-w-0 border-b border-r border-zinc-100 p-1 sm:min-h-[126px] sm:p-2 dark:border-zinc-800 [&:nth-child(7n)]:border-r-0 ${key === selectedKey ? "bg-emerald-50/50 dark:bg-brand/5" : !inMonth(day) ? "bg-zinc-50/70 dark:bg-zinc-950/40" : ""}`}
                  >
                    <button
                      type="button"
                      aria-label={`Select ${dateLabel(day)}`}
                      aria-pressed={key === selectedKey}
                      aria-current={key === todayKey ? "date" : undefined}
                      onClick={() => setSelected(day)}
                      className={`mb-1 flex h-7 w-7 items-center justify-center rounded-full text-xs focus-visible:outline-brand ${key === todayKey ? "bg-brand font-semibold text-white" : key === selectedKey ? "font-semibold text-brand ring-1 ring-brand dark:text-brand" : inMonth(day) ? "hover:bg-zinc-100 dark:hover:bg-zinc-800" : "text-zinc-400 dark:text-zinc-600"}`}
                    >
                      {day.getUTCDate()}
                    </button>
                    <div className="space-y-1">
                      {items.slice(0, 2).map((event) => (
                        <button
                          type="button"
                          key={event._id}
                          data-calendar-event={event._id}
                          onClick={() => onOpen(event)}
                          title={`${event.title} · ${timeForDay(event, day)}`}
                          className={`block w-full min-w-0 truncate rounded-md px-1 py-1 text-left text-[10px] font-medium focus-visible:outline-brand sm:px-1.5 sm:text-[11px] ${activityStyle(event).card}`}
                        >
                          <span className="hidden opacity-60 sm:inline">
                            {timeForDay(event, day)}{" "}
                          </span>
                          {event.title}
                        </button>
                      ))}
                      {items.length > 2 && (
                        <button
                          type="button"
                          aria-label={`View all ${items.length} activities on ${dateLabel(day)}`}
                          onClick={() => {
                            setSelected(day);
                            setView("day");
                          }}
                          className="px-1 text-[10px] font-medium text-zinc-500 hover:underline"
                        >
                          +{items.length - 2} more
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {view === "week" && (
          <div className="overflow-x-auto" data-calendar-week>
            <div className="grid min-w-[900px] grid-cols-7">
              {week.map((day) => (
                <section
                  key={dateKey(day)}
                  className="min-h-[460px] border-r border-zinc-200 last:border-r-0 dark:border-zinc-800"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(day);
                      setView("day");
                    }}
                    className={`flex w-full items-center justify-center gap-2 border-b border-zinc-200 py-4 text-xs dark:border-zinc-800 ${dateKey(day) === todayKey ? "text-brand dark:text-brand" : "text-zinc-500"}`}
                  >
                    <span>{weekdays[day.getUTCDay()]}</span>
                    <span className="font-semibold">{day.getUTCDate()}</span>
                  </button>
                  <div className="space-y-2 p-2">
                    {eventsOnDate(events, day).map((event) => (
                      <ActivityCard
                        key={event._id}
                        event={event}
                        day={day}
                        onOpen={onOpen}
                      />
                    ))}
                    {!eventsOnDate(events, day).length && (
                      <p className="pt-5 text-center text-[11px] text-zinc-400">
                        No activities
                      </p>
                    )}
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}
        {(view === "day" || view === "list") && (
          <div className="min-h-[460px] p-4 sm:p-5" data-calendar-agenda>
            {(view === "day" ? daily : monthEvents).length ? (
              <div className="space-y-3">
                {(view === "day" ? daily : monthEvents).map((event) => (
                  <div
                    key={event._id}
                    className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)]"
                  >
                    <div className="px-1 py-2">
                      <p className="text-xs font-semibold">
                        {view === "list"
                          ? dateLabel(calendarDate(event.startAt), {
                              month: "short",
                              day: "numeric",
                            })
                          : timeForDay(event, selected)}
                      </p>
                      <p className="mt-1 text-[11px] text-zinc-500">
                        {view === "list"
                          ? eventTime(event.startAt)
                          : "Philippine time"}
                      </p>
                    </div>
                    <ActivityCard
                      event={event}
                      day={
                        view === "day" ? selected : calendarDate(event.startAt)
                      }
                      onOpen={onOpen}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center py-20 text-center">
                <CalendarDays
                  size={28}
                  strokeWidth={1.5}
                  className="text-zinc-300"
                />
                <h3 className="mt-4 text-sm font-semibold">
                  No activities {view === "day" ? "on this day" : "this month"}
                </h3>
                <p className="mt-2 max-w-xs text-xs leading-6 text-zinc-500">
                  Try another date or adjust your activity filters.
                </p>
              </div>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 px-4 py-3 text-[10px] text-zinc-500 sm:text-xs dark:border-zinc-800">
          <span>Schedules in Philippine time</span>
          <span>Choose an activity to view details and register</span>
        </div>
      </section>
    </div>
  );
}
