import { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import {
  Search, Plus, Pencil, Trash2, Calendar, CalendarDays, CalendarPlus, Power, MapPin, Clock,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Check, Bell, X,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import AdminSidebar from '../../layout/sidebar/admin/adminSidebar';
import AdminTopbar from '../../layout/topbar/alumni/adminTopbar';
import DataPagination from '../../components/ui/data-pagination';
import api from '../../utils/axios';

/* ---------- helpers ---------- */
const pad = (n) => String(n).padStart(2, '0');
const toInputValue = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const EMPTY_FORM = { title: '', description: '', location: '', startAt: '', endAt: '', isActive: true };

const formatDate = (iso) => iso
  ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  : '—';
const formatTime = (iso) => iso
  ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  : '';

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const sameDay = (a, b) => a.toDateString() === b.toDateString();
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const isDraft = (e) => e.isActive === false;

const monthGrid = (date) => {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
};

const hourLabel = (h) => {
  const hh = h % 24;
  const x = hh % 12 === 0 ? 12 : hh % 12;
  return `${pad(x)} ${hh >= 12 ? 'PM' : 'AM'}`;
};
const gmtLabel = () => {
  const off = -new Date().getTimezoneOffset() / 60;
  return `GMT${off >= 0 ? '+' : '-'}${Math.abs(off)}`;
};

const HOUR_H = 84; // px per hour in the time grid

/* Pastel event cards (static class strings so Tailwind can see them). */
const PALETTE = [
  { card: 'bg-sky-100 text-sky-950 dark:bg-sky-400/20 dark:text-sky-50', dot: 'bg-sky-400', bar: 'bg-sky-400' },
  { card: 'bg-pink-100 text-pink-950 dark:bg-pink-400/20 dark:text-pink-50', dot: 'bg-pink-400', bar: 'bg-pink-400' },
  { card: 'bg-orange-100 text-orange-950 dark:bg-orange-400/20 dark:text-orange-50', dot: 'bg-orange-400', bar: 'bg-orange-400' },
  { card: 'bg-violet-200 text-violet-950 dark:bg-violet-400/25 dark:text-violet-50', dot: 'bg-violet-400', bar: 'bg-violet-400' },
  { card: 'bg-emerald-100 text-emerald-950 dark:bg-emerald-400/20 dark:text-emerald-50', dot: 'bg-emerald-500', bar: 'bg-emerald-500' },
  { card: 'bg-amber-100 text-amber-950 dark:bg-amber-400/20 dark:text-amber-50', dot: 'bg-amber-400', bar: 'bg-amber-400' },
];
const DRAFT_STYLE = {
  card: 'border border-dashed border-zinc-300 bg-zinc-50 text-zinc-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  dot: 'bg-zinc-400',
  bar: 'bg-zinc-400',
};
const colorFor = (event) => {
  if (isDraft(event)) return DRAFT_STYLE;
  let hash = 0;
  const id = String(event._id || '');
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
};

const inputClass =
  'w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[12.5px] text-zinc-900 dark:text-zinc-100 outline-none transition focus:border-[#009639] focus:ring-2 focus:ring-[#009639]/15';

const VIEWS = [
  { key: 'day', label: 'Daily' },
  { key: 'week', label: 'Weekly' },
  { key: 'month', label: 'Monthly' },
  { key: 'list', label: 'List' },
];

/* Lay a day's events out in columns so overlapping events sit side by side. */
function layoutDay(list, day) {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = addDays(startOfDay(day), 1).getTime();
  const items = list
    .map((ev) => {
      const st = new Date(ev.startAt).getTime();
      const en = ev.endAt ? new Date(ev.endAt).getTime() : st + 3600000;
      const s = Math.max(st, dayStart);
      const e = Math.min(Math.max(en, st + 1800000), dayEnd);
      return { ev, s: (s - dayStart) / 60000, e: (e - dayStart) / 60000, startsHere: st >= dayStart, endsHere: en <= dayEnd };
    })
    .sort((a, b) => a.s - b.s || b.e - a.e);

  const out = [];
  let cluster = [];
  let clusterEnd = -1;
  const flush = () => {
    const colEnds = [];
    cluster.forEach((it) => {
      let c = colEnds.findIndex((end) => end <= it.s);
      if (c === -1) { c = colEnds.length; colEnds.push(it.e); } else colEnds[c] = it.e;
      it.col = c;
    });
    cluster.forEach((it) => { it.cols = colEnds.length; out.push(it); });
    cluster = [];
  };
  items.forEach((it) => {
    if (cluster.length && it.s >= clusterEnd) { flush(); clusterEnd = -1; }
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.e);
  });
  if (cluster.length) flush();
  return out;
}

/* ---------- presentational pieces (module level so they never remount) ---------- */
function EventChip({ event, onOpen }) {
  const c = colorFor(event);
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onOpen(event); }}
      title={event.title}
      className={`w-full truncate rounded-lg px-1.5 py-1 text-left text-[10.5px] font-semibold leading-tight transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#009639] ${c.card}`}
    >
      <span className="opacity-60">{formatTime(event.startAt)} </span>
      {event.title}
    </button>
  );
}

/* Small month picker for the left rail. */
function MiniCalendar({ value, onSelect, hasEvents, highlightWeek }) {
  const y = value.getFullYear();
  const m = value.getMonth();
  const [view, setView] = useState(() => new Date(y, m, 1));
  useEffect(() => { setView(new Date(y, m, 1)); }, [y, m]);

  const days = monthGrid(view);
  const today = new Date();
  const weekStart = startOfDay(addDays(value, -value.getDay())).getTime();
  const weekEnd = startOfDay(addDays(value, 6 - value.getDay())).getTime();
  const step = (n) => setView((v) => new Date(v.getFullYear(), v.getMonth() + n, 1));

  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm dark:bg-zinc-900">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[15px] font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
          {view.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h3>
        <div className="flex items-center gap-0.5">
          <button type="button" aria-label="Previous month" onClick={() => step(-1)}
            className="rounded-full p-1.5 text-zinc-500 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Next month" onClick={() => step(1)}
            className="rounded-full p-1.5 text-zinc-500 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-center">
        {WEEKDAYS.map((d) => (
          <span key={d} className="pb-1.5 text-[10px] font-medium text-zinc-400 dark:text-zinc-500">{d[0]}</span>
        ))}
        {days.map((day) => {
          const inMonth = day.getMonth() === view.getMonth();
          const selected = sameDay(day, value);
          const isToday = sameDay(day, today);
          const inWeek = highlightWeek && day.getTime() >= weekStart && day.getTime() <= weekEnd;
          return (
            <div key={day.toISOString()}
              className={`flex justify-center py-0.5 ${inWeek ? 'bg-emerald-100/70 dark:bg-emerald-400/10' : ''} ${inWeek && day.getDay() === 0 ? 'rounded-l-full' : ''} ${inWeek && day.getDay() === 6 ? 'rounded-r-full' : ''}`}>
              <button type="button" onClick={() => onSelect(startOfDay(day))} aria-label={day.toDateString()}
                className={`relative flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#009639] ${selected
                  ? 'bg-[#009639] text-white'
                  : isToday
                    ? 'text-[#009639] ring-1 ring-[#009639]'
                    : inMonth
                      ? 'text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800'
                      : 'text-zinc-300 hover:bg-zinc-100 dark:text-zinc-600 dark:hover:bg-zinc-800'
                  }`}>
                {day.getDate()}
                {hasEvents(day) && (
                  <span className={`absolute bottom-0.5 h-1 w-1 rounded-full ${selected ? 'bg-white' : 'bg-[#009639]'}`} />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CollapseCard({ title, open, onToggle, children }) {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm dark:bg-zinc-900">
      <button type="button" onClick={onToggle} aria-expanded={open}
        className="flex w-full items-center justify-between text-left">
        <span className="text-[15px] font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">{title}</span>
        {open ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

/* Hour-by-hour grid used by the Daily and Weekly views. */
function TimeGrid({ days, eventsOnDay, onOpen, onCreate, onPickDay, now }) {
  const layouts = days.map((d) => layoutDay(eventsOnDay(d), d));

  let minH = 8;
  let maxH = 18;
  layouts.flat().forEach((it) => {
    if (it.startsHere) minH = Math.min(minH, Math.floor(it.s / 60));
    if (it.endsHere) maxH = Math.max(maxH, Math.ceil(it.e / 60));
  });
  maxH = Math.min(24, maxH);
  const hours = Math.max(1, maxH - minH);
  const bodyH = hours * HOUR_H;
  const single = days.length === 1;
  const cols = { display: 'grid', gridTemplateColumns: `56px repeat(${days.length}, minmax(${single ? 0 : 128}px, 1fr))`, columnGap: 8 };
  const nowMin = now.getHours() * 60 + now.getMinutes();

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: single ? 0 : 56 + days.length * 136 }}>
        {/* day headers */}
        <div style={cols} className="mb-2">
          <div className="pt-2 text-[10.5px] font-medium text-zinc-400 dark:text-zinc-500">{gmtLabel()}</div>
          {days.map((day) => {
            const isToday = sameDay(day, now);
            return (
              <button key={day.toISOString()} type="button" onClick={() => onPickDay(day)} disabled={single}
                className={`rounded-2xl py-3 text-center transition ${isToday
                  ? 'bg-emerald-50 text-[#007a2e] dark:bg-emerald-400/10 dark:text-emerald-300'
                  : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                  } ${single ? 'cursor-default' : 'hover:brightness-95'}`}>
                <span className="block text-[11px] font-medium opacity-70">{WEEKDAYS[day.getDay()]}</span>
                <span className="block text-2xl font-extrabold leading-tight tracking-tight">{day.getDate()}</span>
              </button>
            );
          })}
        </div>

        {/* body */}
        <div style={cols} className="pt-3">
          <div className="relative" style={{ height: bodyH }}>
            {Array.from({ length: hours }, (_, i) => (
              <span key={i} className="absolute right-2 -translate-y-1/2 text-[10.5px] font-medium text-zinc-400 dark:text-zinc-500"
                style={{ top: i * HOUR_H }}>
                {hourLabel(minH + i)}
              </span>
            ))}
          </div>

          {days.map((day, di) => {
            const isToday = sameDay(day, now);
            return (
              <div key={day.toISOString()}
                className={`relative cursor-cell rounded-xl ${isToday ? 'bg-emerald-50/50 dark:bg-emerald-400/5' : ''}`}
                style={{ height: bodyH }}
                title="Click to add an event"
                onClick={(e) => {
                  const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
                  onCreate(day, Math.min(23, minH + Math.floor(y / HOUR_H)));
                }}>
                {Array.from({ length: hours + 1 }, (_, i) => (
                  <div key={i} className="pointer-events-none absolute left-0 right-0 border-t border-zinc-100 dark:border-zinc-800" style={{ top: i * HOUR_H }} />
                ))}

                {layouts[di].map((it) => {
                  const s = Math.max(it.s, minH * 60);
                  const e = Math.min(it.e, maxH * 60);
                  if (e <= s) return null;
                  const top = ((s - minH * 60) / 60) * HOUR_H;
                  const h = Math.max(28, ((e - s) / 60) * HOUR_H - 3);
                  const c = colorFor(it.ev);
                  return (
                    <button key={it.ev._id} type="button"
                      onClick={(ev) => { ev.stopPropagation(); onOpen(it.ev); }}
                      title={it.ev.title}
                      className={`absolute z-10 overflow-hidden rounded-2xl p-2.5 text-left transition hover:z-20 hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#009639] ${c.card}`}
                      style={{ top, height: h, left: `calc(${(it.col / it.cols) * 100}% + 1px)`, width: `calc(${100 / it.cols}% - 3px)` }}>
                      <span className={`block text-[12.5px] font-semibold leading-snug ${h < 56 ? 'truncate' : 'line-clamp-2'}`}>{it.ev.title}</span>
                      {h >= 56 && (
                        <span className="mt-1 flex items-center gap-1 text-[10.5px] opacity-70">
                          <Clock className="h-3 w-3 shrink-0" />
                          <span className="truncate">{formatTime(it.ev.startAt)}{it.ev.endAt ? ` – ${formatTime(it.ev.endAt)}` : ''}</span>
                        </span>
                      )}
                      {h >= 88 && it.ev.location && (
                        <span className="mt-0.5 flex items-center gap-1 text-[10.5px] opacity-70">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{it.ev.location}</span>
                        </span>
                      )}
                    </button>
                  );
                })}

                {isToday && nowMin >= minH * 60 && nowMin <= maxH * 60 && (
                  <div className="pointer-events-none absolute left-0 right-0 z-20 border-t-2 border-red-400"
                    style={{ top: ((nowMin - minH * 60) / 60) * HOUR_H }}>
                    <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-red-400" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------- page ---------- */
export default function AdminEvents() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState('week');
  const [currentDate, setCurrentDate] = useState(() => startOfDay(new Date()));
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const [filters, setFilters] = useState({ published: true, drafts: true, upcomingOnly: false });
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [overviewOpen, setOverviewOpen] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/events', { params: { all: 'true' } });
      setEvents(res.data.data || []);
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to load events', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      setModalOpen(false);
      setSelectedEvent(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const counts = useMemo(() => ({
    total: events.length,
    active: events.filter((e) => e.isActive).length,
    upcoming: events.filter((e) => e.startAt && new Date(e.startAt) >= now).length,
  }), [events, now]);

  // Events after the sidebar filters are applied.
  const visible = useMemo(() => events.filter((e) => {
    if (isDraft(e) ? !filters.drafts : !filters.published) return false;
    if (filters.upcomingOnly && !(e.startAt && new Date(e.endAt || e.startAt) >= now)) return false;
    return true;
  }), [events, filters, now]);

  const nextEvent = useMemo(() => events
    .filter((e) => !isDraft(e) && e.startAt && new Date(e.endAt || e.startAt) >= now)
    .sort((a, b) => new Date(a.startAt) - new Date(b.startAt))[0], [events, now]);

  const filtered = visible.filter((e) =>
    `${e.title} ${e.location || ''}`.toLowerCase().includes(query.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  // Events that touch a day, including multi-day events.
  const eventsOnDay = useCallback((day) => {
    const s = startOfDay(day).getTime();
    const e = addDays(startOfDay(day), 1).getTime() - 1;
    return visible
      .filter((ev) => {
        if (!ev.startAt) return false;
        const st = new Date(ev.startAt).getTime();
        const en = ev.endAt ? new Date(ev.endAt).getTime() : st;
        return st <= e && en >= s;
      })
      .sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
  }, [visible]);

  /* ----- actions ----- */
  const openAddForDay = (day, hour = 9) => {
    const start = new Date(day); start.setHours(hour, 0, 0, 0);
    const end = new Date(start.getTime() + 3600000);
    setEditing(null);
    setForm({ ...EMPTY_FORM, startAt: toInputValue(start), endAt: toInputValue(end) });
    setModalOpen(true);
  };

  const openEdit = (event) => {
    setEditing(event);
    setForm({
      title: event.title || '',
      description: event.description || '',
      location: event.location || '',
      startAt: toInputValue(event.startAt),
      endAt: toInputValue(event.endAt),
      isActive: event.isActive !== false,
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (form.endAt && form.startAt && new Date(form.endAt) < new Date(form.startAt)) {
      Swal.fire('Check the dates', 'The end time must be after the start time.', 'warning');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, endAt: form.endAt || null };
      if (editing) await api.put(`/events/${editing._id}`, payload);
      else await api.post('/events', payload);
      setModalOpen(false);
      fetchEvents();
      Swal.fire({ title: 'Saved', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to save event', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Resolves true when the event was deleted.
  const handleDelete = async (event) => {
    const result = await Swal.fire({
      title: 'Delete event?',
      text: `${event.title} will be removed.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626',
      reverseButtons: true,
    });
    if (!result.isConfirmed) return false;
    try {
      await api.delete(`/events/${event._id}`);
      fetchEvents();
      Swal.fire({ title: 'Deleted', icon: 'success', timer: 1500, showConfirmButton: false });
      return true;
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to delete event', 'error');
      return false;
    }
  };

  const toggleActive = async (event) => {
    try {
      await api.put(`/events/${event._id}`, { isActive: !event.isActive });
      fetchEvents();
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to update event', 'error');
    }
  };

  /* ----- navigation ----- */
  const shift = (dir) => setCurrentDate((d) => {
    if (viewMode === 'week') return addDays(d, 7 * dir);
    if (viewMode === 'day') return addDays(d, dir);
    return new Date(d.getFullYear(), d.getMonth() + dir, 1); // avoids Jan 31 -> Mar 3 overflow
  });
  const goToday = () => setCurrentDate(startOfDay(new Date()));

  const weekStart = addDays(currentDate, -currentDate.getDay());
  const title = (() => {
    if (viewMode === 'week') {
      const end = addDays(weekStart, 6);
      const f = (d, y) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(y ? { year: 'numeric' } : {}) });
      return `${f(weekStart)} – ${f(end, true)}`;
    }
    if (viewMode === 'day')
      return currentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  })();

  /* ----- left rail ----- */
  const renderReminder = () => {
    const ongoing = nextEvent && new Date(nextEvent.startAt) <= now;
    return (
      <div className="rounded-3xl bg-[#009639] p-4 text-white shadow-sm dark:bg-[#007a2e]">
        <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-white/80">
          <Bell className="h-3.5 w-3.5" /> {ongoing ? 'Happening now' : 'Next event'}
        </p>
        {nextEvent ? (
          <>
            <h3 className="mt-1 text-[17px] font-extrabold leading-snug tracking-tight">{nextEvent.title}</h3>
            <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-white/90">
              <Clock className="h-3.5 w-3.5" />
              {formatDate(nextEvent.startAt)}, {formatTime(nextEvent.startAt)}
              {nextEvent.endAt ? ` – ${formatTime(nextEvent.endAt)}` : ''}
            </p>
            {nextEvent.location && (
              <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-white/90">
                <MapPin className="h-3.5 w-3.5" /> <span className="truncate">{nextEvent.location}</span>
              </p>
            )}
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" aria-label="Edit event" onClick={() => openEdit(nextEvent)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-300 text-zinc-900 transition hover:bg-amber-400">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button type="button" aria-label="View event" onClick={() => setSelectedEvent(nextEvent)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-white transition hover:bg-zinc-800">
                <Check className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="mt-1 text-[17px] font-extrabold leading-snug tracking-tight">Nothing coming up</h3>
            <button type="button" onClick={() => openAddForDay(new Date())}
              className="mt-3 rounded-full bg-amber-300 px-3.5 py-1.5 text-[12px] font-bold text-zinc-900 transition hover:bg-amber-400">
              Create event
            </button>
          </>
        )}
      </div>
    );
  };

  const FILTER_ROWS = [
    { key: 'published', label: 'Published' },
    { key: 'drafts', label: 'Drafts' },
    { key: 'upcomingOnly', label: 'Upcoming only' },
  ];

  const renderFilters = () => (
    <CollapseCard title="Filters" open={filtersOpen} onToggle={() => setFiltersOpen((o) => !o)}>
      <div className="space-y-2.5">
        {FILTER_ROWS.map(({ key, label }) => (
          <label key={key} className="flex cursor-pointer items-center gap-2.5 text-[12.5px] font-medium text-zinc-600 dark:text-zinc-300">
            <input type="checkbox" checked={filters[key]} className="h-4 w-4 rounded accent-[#009639]"
              onChange={(e) => { setFilters((f) => ({ ...f, [key]: e.target.checked })); setPage(1); }} />
            {label}
          </label>
        ))}
      </div>
    </CollapseCard>
  );

  const renderOverview = () => (
    <CollapseCard title="Overview" open={overviewOpen} onToggle={() => setOverviewOpen((o) => !o)}>
      <div className="space-y-2.5">
        {[
          { label: 'Total events', value: counts.total, icon: Calendar },
          { label: 'Published', value: counts.active, icon: Power },
          { label: 'Upcoming', value: counts.upcoming, icon: CalendarDays },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#009639]/10 text-[#009639] dark:text-emerald-300">
              <Icon className="h-4 w-4" />
            </span>
            <span className="flex-1 text-[12.5px] font-medium text-zinc-600 dark:text-zinc-300">{label}</span>
            <span className="text-[15px] font-extrabold text-zinc-900 dark:text-zinc-100">{value}</span>
          </div>
        ))}
      </div>
    </CollapseCard>
  );

  /* ----- views (plain functions, not components, so inputs keep focus) ----- */
  const renderHeader = () => (
    <div className="flex flex-wrap items-center gap-3 rounded-3xl bg-white px-4 py-3 shadow-sm dark:bg-zinc-900 sm:px-5">
      {viewMode !== 'list' ? (
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => shift(-1)} aria-label="Previous"
            className="rounded-full p-1.5 text-zinc-500 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="px-1 text-[17px] font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-xl">{title}</h2>
          <button type="button" onClick={() => shift(1)} aria-label="Next"
            className="rounded-full p-1.5 text-zinc-500 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button type="button" onClick={goToday}
            className="ml-1 rounded-full px-3 py-1 text-[12px] font-bold text-[#009639] transition hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-zinc-800">
            Today
          </button>
        </div>
      ) : (
        <h2 className="text-[17px] font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-xl">All events</h2>
      )}

      <div className="order-3 inline-flex w-full rounded-full bg-zinc-100 p-1 dark:bg-zinc-800 lg:order-none lg:mx-auto lg:w-auto" role="tablist" aria-label="Calendar view">
        {VIEWS.map(({ key, label }) => (
          <button key={key} type="button" role="tab" aria-selected={viewMode === key} onClick={() => setViewMode(key)}
            className={`flex-1 rounded-full px-4 py-1.5 text-[12px] font-bold transition lg:flex-none ${viewMode === key
              ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100'
              : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
              }`}>
            {label}
          </button>
        ))}
      </div>

      <button type="button" onClick={() => openAddForDay(viewMode === 'list' ? new Date() : currentDate)}
        className="ml-auto flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-amber-300 px-4 text-[12.5px] font-bold text-zinc-900 transition hover:bg-amber-400 lg:ml-0">
        <Plus className="h-4 w-4" />
        <span>Create event</span>
      </button>
    </div>
  );

  const renderTime = (days) => (
    <div className="rounded-3xl bg-white p-3 shadow-sm dark:bg-zinc-900 sm:p-4">
      <TimeGrid
        days={days}
        eventsOnDay={eventsOnDay}
        onOpen={setSelectedEvent}
        onCreate={openAddForDay}
        onPickDay={(d) => { setCurrentDate(startOfDay(d)); setViewMode('day'); }}
        now={now}
      />
    </div>
  );

  const renderMonth = () => {
    const days = monthGrid(currentDate);
    return (
      <>
        <div className="overflow-hidden rounded-3xl bg-white shadow-sm dark:bg-zinc-900">
          <div className="grid grid-cols-7 border-b border-zinc-100 dark:border-zinc-800">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2.5 text-center text-[11px] font-bold text-zinc-400 dark:text-zinc-500">
                <span className="sm:hidden">{d[0]}</span>
                <span className="hidden sm:inline">{d}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-zinc-100 dark:bg-zinc-800">
            {days.map((day) => {
              const inMonth = day.getMonth() === currentDate.getMonth();
              const isToday = sameDay(day, now);
              const selected = sameDay(day, currentDate);
              const dayList = eventsOnDay(day);
              return (
                <div
                  key={day.toISOString()}
                  role="button"
                  tabIndex={0}
                  aria-label={day.toDateString()}
                  onClick={() => setCurrentDate(startOfDay(day))}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCurrentDate(startOfDay(day)); } }}
                  className={`group relative flex min-h-[62px] cursor-pointer flex-col gap-1 p-1 outline-none transition focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-[#009639] sm:min-h-[112px] sm:p-1.5 ${inMonth ? 'bg-white hover:bg-emerald-50/60 dark:bg-zinc-900 dark:hover:bg-zinc-800/70' : 'bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-950 dark:hover:bg-zinc-900'
                    } ${selected ? 'z-[1] ring-2 ring-inset ring-[#009639]' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold ${isToday ? 'bg-[#009639] text-white' : inMonth ? 'text-zinc-800 dark:text-zinc-100' : 'text-zinc-300 dark:text-zinc-600'
                      }`}>
                      {day.getDate()}
                    </span>
                    <button type="button" aria-label={`Add event on ${day.toDateString()}`}
                      onClick={(e) => { e.stopPropagation(); openAddForDay(day); }}
                      className="hidden h-5 w-5 items-center justify-center rounded-md text-zinc-400 opacity-0 transition hover:bg-[#009639]/10 hover:text-[#009639] focus-visible:opacity-100 group-hover:opacity-100 sm:flex">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                    {dayList.slice(0, 3).map((ev) => <EventChip key={ev._id} event={ev} onOpen={setSelectedEvent} />)}
                    {dayList.length > 3 && (
                      <span className="px-1 text-[10.5px] font-bold text-zinc-500 dark:text-zinc-400">+{dayList.length - 3} more</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-0.5 px-0.5 sm:hidden">
                    {dayList.slice(0, 4).map((ev) => <span key={ev._id} className={`h-1.5 w-1.5 rounded-full ${colorFor(ev).dot}`} />)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </>
    );
  };

  const renderList = () => (
    <div className="rounded-3xl bg-white shadow-sm dark:bg-zinc-900">
      <div className="border-b border-zinc-100 p-4 dark:border-zinc-800">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder="Search events..."
            className="h-10 w-full rounded-full border border-zinc-200 bg-zinc-50 pl-10 pr-3 text-[12.5px] outline-none transition focus:border-[#009639] focus:bg-white focus:ring-2 focus:ring-[#009639]/15 dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>
      </div>

      {loading ? (
        <p className="p-6 text-[13px] text-zinc-500 dark:text-zinc-400">Loading events...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-zinc-100 text-[11px] text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
                <th className="px-5 py-3 font-semibold">Event</th>
                <th className="px-5 py-3 font-semibold">Schedule</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((event) => (
                <tr key={event._id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className={`h-8 w-1.5 shrink-0 rounded-full ${colorFor(event).bar}`} />
                      <div className="min-w-0">
                        <button type="button" onClick={() => setSelectedEvent(event)} className="text-left font-semibold text-zinc-800 hover:text-[#009639] dark:text-zinc-100">
                          {event.title}
                        </button>
                        <p className="flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                          <MapPin className="h-3 w-3" />
                          {event.location || 'No location'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <p className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
                      <Clock className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
                      {formatDate(event.startAt)}
                    </p>
                    {event.endAt && <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">until {formatDate(event.endAt)}</p>}
                  </td>
                  <td className="px-5 py-3">
                    <button type="button" onClick={() => toggleActive(event)} title={event.isActive ? 'Hide event' : 'Publish event'}
                      className={`inline-block rounded-full px-2.5 py-1 text-[10.5px] font-bold ring-1 transition ${event.isActive ? 'bg-[#009639]/10 text-[#007a2e] ring-emerald-200/60 dark:text-emerald-300' : 'bg-zinc-100 text-zinc-400 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700'
                        }`}>
                      {event.isActive ? 'Published' : 'Draft'}
                    </button>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" onClick={() => openEdit(event)} aria-label="Edit event"
                        className="rounded-full p-2 text-zinc-300 transition hover:bg-emerald-50 hover:text-[#009639] dark:text-zinc-500 dark:hover:bg-zinc-800">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => handleDelete(event)} aria-label="Delete event"
                        className="rounded-full p-2 text-zinc-300 transition hover:bg-red-50 hover:text-red-600 dark:text-zinc-500 dark:hover:bg-zinc-800">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center">
                    <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-[#009639] dark:bg-zinc-800 dark:text-emerald-300">
                      <CalendarPlus className="h-6 w-6" />
                    </span>
                    <p className="text-[13px] font-bold text-zinc-700 dark:text-zinc-200">{events.length === 0 ? 'No events yet' : 'No events found'}</p>
                    <p className="mt-0.5 text-[12px] text-zinc-400 dark:text-zinc-500">{events.length === 0 ? 'Click Create event to add one.' : 'Try a different keyword or filter.'}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <DataPagination
        page={Math.min(page, totalPages)}
        totalPages={totalPages}
        onPageChange={setPage}
        perPage={perPage}
        onPerPageChange={(n) => { setPerPage(n); setPage(1); }}
        totalItems={filtered.length}
        itemLabel="events"
      />
    </div>
  );

  const renderView = () => {
    if (loading && viewMode !== 'list') {
      return <p className="rounded-3xl bg-white p-6 text-[13px] text-zinc-500 shadow-sm dark:bg-zinc-900 dark:text-zinc-400">Loading events...</p>;
    }
    if (viewMode === 'list') return renderList();
    if (viewMode === 'week') return renderTime(Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)));
    if (viewMode === 'day') return renderTime([currentDate]);
    return renderMonth();
  };

  const labelClass = 'mb-1 block text-[11.5px] font-bold text-zinc-600 dark:text-zinc-300';

  return (
    <div className="min-h-screen bg-[#e9f1ee] dark:bg-zinc-950">
      <AdminSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />

      <div className="lg:pl-64">
        <AdminTopbar user={user} title="Calendar" onMenuClick={() => setSidebarOpen(true)} />

        <main className="mx-auto grid max-w-[1500px] gap-4 p-4 sm:p-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          {/* left rail */}
          <aside className="order-2 space-y-4 xl:order-1">
            <MiniCalendar
              value={currentDate}
              onSelect={setCurrentDate}
              hasEvents={(d) => eventsOnDay(d).length > 0}
              highlightWeek={viewMode === 'week'}
            />
            {renderReminder()}
            {renderFilters()}
            {renderOverview()}
          </aside>

          {/* main */}
          <section className="order-1 min-w-0 space-y-4 xl:order-2">
            {renderHeader()}
            {renderView()}
          </section>
        </main>
      </div>

      {/* Event details */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={() => setSelectedEvent(null)}>
          <div role="dialog" aria-modal="true" aria-label={selectedEvent.title}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white shadow-xl dark:bg-zinc-900 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}>
            <div className={`h-2 ${colorFor(selectedEvent).bar}`} />
            <div className="p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100">{selectedEvent.title}</h3>
                  <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${!isDraft(selectedEvent) ? 'bg-[#009639]/10 text-[#007a2e] dark:text-emerald-300' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}>
                    {!isDraft(selectedEvent) ? 'Published' : 'Draft'}
                  </span>
                </div>
                <button type="button" aria-label="Close" onClick={() => setSelectedEvent(null)}
                  className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3 text-[13px] text-zinc-700 dark:text-zinc-300">
                <div className="flex items-start gap-2.5">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                  <span>
                    {formatDate(selectedEvent.startAt)}, {formatTime(selectedEvent.startAt)}
                    {selectedEvent.endAt && <><br />until {formatDate(selectedEvent.endAt)}, {formatTime(selectedEvent.endAt)}</>}
                  </span>
                </div>
                {selectedEvent.location && (
                  <div className="flex items-start gap-2.5">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                    <span>{selectedEvent.location}</span>
                  </div>
                )}
                {selectedEvent.description && (
                  <p className="border-t border-zinc-100 pt-3 leading-relaxed text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">{selectedEvent.description}</p>
                )}
              </div>

              <div className="mt-5 flex gap-2">
                <button type="button"
                  onClick={() => { const ev = selectedEvent; setSelectedEvent(null); openEdit(ev); }}
                  className="flex-1 rounded-full bg-[#009639] py-2.5 text-[13px] font-bold text-white transition hover:bg-[#007a2e]">
                  Edit
                </button>
                <button type="button"
                  onClick={async () => { if (await handleDelete(selectedEvent)) setSelectedEvent(null); }}
                  className="flex-1 rounded-full border border-red-300 py-2.5 text-[13px] font-bold text-red-600 transition hover:bg-red-50 dark:border-red-500/40 dark:hover:bg-red-500/10">
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create / edit form */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={() => setModalOpen(false)}>
          <form onSubmit={handleSave} role="dialog" aria-modal="true" aria-label={editing ? 'Edit event' : 'New event'}
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl dark:bg-zinc-900 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100">{editing ? 'Edit event' : 'New event'}</h3>
              <button type="button" aria-label="Close" onClick={() => setModalOpen(false)}
                className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className={labelClass} htmlFor="ev-title">Title</label>
                <input id="ev-title" required className={inputClass} value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Alumni Homecoming" />
              </div>
              <div>
                <label className={labelClass} htmlFor="ev-location">Location</label>
                <input id="ev-location" className={inputClass} value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="Main Auditorium" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="ev-start">Starts</label>
                  <input id="ev-start" type="datetime-local" required className={inputClass} value={form.startAt}
                    onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="ev-end">Ends</label>
                  <input id="ev-end" type="datetime-local" className={inputClass} value={form.endAt} min={form.startAt || undefined}
                    onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className={labelClass} htmlFor="ev-desc">Description</label>
                <textarea id="ev-desc" rows={3} value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12.5px] text-zinc-900 outline-none transition focus:border-[#009639] focus:ring-2 focus:ring-[#009639]/15 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
              </div>
              <label className="flex cursor-pointer items-center gap-2.5 text-[12.5px] font-semibold text-zinc-700 dark:text-zinc-200">
                <input type="checkbox" checked={form.isActive} className="h-4 w-4 accent-[#009639]"
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
                Publish this event (uncheck to save as a draft)
              </label>
            </div>

            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setModalOpen(false)}
                className="flex-1 rounded-full border border-zinc-200 py-2.5 text-[13px] font-bold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 rounded-full bg-[#009639] py-2.5 text-[13px] font-bold text-white transition hover:bg-[#007a2e] disabled:opacity-60">
                {saving ? 'Saving...' : editing ? 'Save changes' : 'Create event'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}