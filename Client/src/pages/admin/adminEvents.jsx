import { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { Search, Plus, Pencil, Trash2, Calendar, CalendarDays, Power, MapPin, Clock, CalendarPlus, ChevronLeft, ChevronRight, Calendar as TodayIcon, LayoutDashboard, X } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import AdminSidebar from '../../layout/sidebar/admin/adminSidebar';
import AdminTopbar from '../../layout/topbar/alumni/adminTopbar';
import DataPagination from '../../components/ui/data-pagination';
import api from '../../utils/axios';
import CalendarView from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

const toInputValue = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const EMPTY_FORM = { title: '', description: '', location: '', startAt: '', endAt: '', isActive: true };

const formatTime = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

const formatDate = (iso) => iso
  ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  : '—';

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
  const [viewMode, setViewMode] = useState('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventDetailsOpen, setEventDetailsOpen] = useState(false);

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

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const counts = useMemo(() => {
    const now = new Date();
    return {
      total: events.length,
      active: events.filter((e) => e.isActive).length,
      upcoming: events.filter((e) => e.startAt && new Date(e.startAt) >= now).length,
    };
  }, [events]);

  const filtered = events.filter((e) =>
    `${e.title} ${e.location || ''}`.toLowerCase().includes(query.toLowerCase())
  );

  const eventsForDate = (date) => {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    return events.filter((e) => {
      if (!e.startAt) return false;
      const start = new Date(e.startAt);
      return start >= dayStart && start <= dayEnd && e.isActive;
    });
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
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
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/events/${editing._id}`, form);
      } else {
        await api.post('/events', form);
      }
      setModalOpen(false);
      fetchEvents();
      Swal.fire({ title: 'Saved', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to save event', 'error');
    } finally {
      setSaving(false);
    }
  };

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
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/events/${event._id}`);
      fetchEvents();
      Swal.fire({ title: 'Deleted', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to delete event', 'error');
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

  const handleEventClick = (event, e) => {
    e?.stopPropagation();
    setSelectedEvent(event);
    setEventDetailsOpen(true);
  };

  const formatDate = (iso) => iso
    ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

  const formatTime = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const inputClass =
    'w-full h-10 px-3 rounded-xl border border-zinc-200 bg-white text-[12.5px] outline-none transition focus:border-[#009639] focus:ring-2 focus:ring-[#009639]/15';

  const prevMonth = () => setCurrentDate(d => {
    const nd = new Date(d);
    nd.setMonth(nd.getMonth() - 1);
    return nd;
  });

  const nextMonth = () => setCurrentDate(d => {
    const nd = new Date(d);
    nd.setMonth(nd.getMonth() + 1);
    return nd;
  });

  const goToday = () => setCurrentDate(new Date());

  const tileContent = ({ date, view }) => {
    if (view !== 'month') return <div style={{fontSize: '14px', fontWeight: 'bold', padding: '8px'}}>{date.getDate()}</div>;
    
    const dayEvents = eventsForDate(date);
    const isToday = date.toDateString() === new Date().toDateString();
    const isCurrentMonth = date.getMonth() === currentDate.getMonth();
    
    const handleDayClick = (e) => {
      // Only open create modal if clicking on empty space (not on an event)
      if (e.target === e.currentTarget) {
        const start = new Date(date);
        start.setHours(9, 0, 0, 0);
        const end = new Date(date);
        end.setHours(10, 0, 0, 0);
        setForm({
          ...EMPTY_FORM,
          startAt: toInputValue(start.toISOString()),
          endAt: toInputValue(end.toISOString()),
        });
        setEditing(null);
        setModalOpen(true);
      }
    };
    
    const eventColors = [
      '#3b82f6', // blue
      '#ef4444', // red
      '#f59e0b', // amber
      '#8b5cf6', // violet
      '#ec4899', // pink
      '#14b8a6', // teal
      '#f97316', // orange
    ];
    
    const getEventColor = (eventId) => {
      let hash = 0;
      for (let i = 0; i < eventId.length; i++) {
        hash = eventId.charCodeAt(i) + ((hash << 5) - hash);
      }
      return eventColors[Math.abs(hash) % eventColors.length];
    };
    
    return (
      <div
        onClick={handleDayClick}
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: '2px',
          backgroundColor: isToday ? '#f0fdf4' : (isCurrentMonth ? '#ffffff' : '#f9fafb'),
          border: isToday ? '1px solid #22c55e' : '1px solid #e5e7eb',
          borderRadius: '8px',
          cursor: 'pointer',
          minHeight: '120px',
          boxShadow: isToday ? '0 2px 8px rgba(34, 197, 94, 0.15)' : '0 1px 3px rgba(0,0,0,0.04)',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          if (!isCurrentMonth) return;
          e.currentTarget.style.backgroundColor = '#f0fdf4';
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.12)';
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.zIndex = '10';
        }}
        onMouseLeave={(e) => {
          if (!isCurrentMonth) return;
          e.currentTarget.style.backgroundColor = isToday ? '#f0fdf4' : '#ffffff';
          e.currentTarget.style.boxShadow = isToday ? '0 2px 8px rgba(34, 197, 94, 0.15)' : '0 1px 3px rgba(0,0,0,0.04)';
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.zIndex = '1';
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          padding: '4px 4px 0',
        }}>
          <span style={{
            fontWeight: isToday ? 'bold' : 'normal',
            color: !isCurrentMonth ? '#9ca3af' : isToday ? '#16a34a' : '#111827',
            fontSize: '13px',
            lineHeight: 1,
          }}>
            {date.getDate()}
          </span>
          {isToday && (
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#22c55e',
              marginTop: '2px',
              flexShrink: 0,
            }} />
          )}
        </div>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '2px', padding: '0 2px 2px' }}>
          {eventsForDate(date).slice(0, 4).map((event, idx) => (
            <div
              key={`${event._id}-${idx}`}
              onClick={(e) => handleEventClick(event, e)}
              style={{
                backgroundColor: getEventColor(event._id),
                color: 'white',
                padding: '2px 6px',
                borderRadius: '3px',
                fontSize: '10px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                cursor: 'pointer',
                lineHeight: '1.3',
                fontWeight: '500',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              }}
              title={event.title}
            >
              {formatTime(event.startAt)} {event.title}
            </div>
          ))}
          {eventsForDate(date).length > 4 && (
            <div style={{
              backgroundColor: '#f3f4f6',
              color: '#6b7280',
              padding: '2px 6px',
              borderRadius: '3px',
              fontSize: '10px',
              textAlign: 'center',
              fontWeight: '500',
            }}>
              +{eventsForDate(date).length - 4} more
            </div>
          )}
        </div>
      </div>
    );
  };

  const CalendarViewComponent = () => (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden" style={{minWidth: '1000px'}}>
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 p-4">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 min-w-[180px] text-center">
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h2>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={goToday} className="px-3 py-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-300 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
            <TodayIcon className="h-4 w-4 inline mr-1" /> Today
          </button>
        </div>
      </div>
      <CalendarView
        value={currentDate}
        onChange={setCurrentDate}
        view="month"
        tileContent={tileContent}
        tileClassName={({ date, view }) => 
          view === 'month' && date.toDateString() === new Date().toDateString() ? 'today-tile' : ''
        }
        className="p-3"
        style={{
          height: '750px',
        }}
      />
    </div>
  );

  const ListViewComponent = () => (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-zinc-100 dark:border-zinc-800 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder="Search events..."
            className="h-10 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 pl-9 pr-3 text-[12.5px] outline-none transition focus:border-[#009639] focus:bg-white focus:ring-2 focus:ring-[#009639]/15"
          />
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#009639] px-4 text-[12.5px] font-bold text-white transition hover:bg-[#007a2e]"
        >
          <Plus className="h-4 w-4" />
          New Event
        </button>
      </div>

      {loading ? (
        <p className="p-6 text-[13px] text-zinc-500 dark:text-zinc-400">Loading events...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 text-[10.5px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                <th className="px-5 py-3 font-semibold">Event</th>
                <th className="px-5 py-3 font-semibold">Schedule</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((event) => (
                <tr key={event._id} className="border-b border-zinc-50 dark:border-zinc-800 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800 dark:bg-zinc-800/60">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-zinc-800 dark:text-zinc-100">{event.title}</p>
                    <p className="flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                      <MapPin className="h-3 w-3" />
                      {event.location || 'No location'}
                    </p>
                  </td>
                  <td className="px-5 py-3">
                    <p className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
                      <Clock className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
                      {formatDate(event.startAt)}
                    </p>
                    {event.endAt && (
                      <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">until {formatDate(event.endAt)}</p>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      onClick={() => toggleActive(event)}
                      title={event.isActive ? 'Hide event' : 'Publish event'}
                      className={`inline-block rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide ring-1 transition ${
                        event.isActive ? 'bg-[#009639]/10 text-[#007a2e] ring-emerald-200/60' : 'bg-zinc-100 text-zinc-400 ring-zinc-200'
                      }`}
                    >
                      {event.isActive ? 'Active' : 'Draft'}
                    </button>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" onClick={() => openEdit(event)}
                        className="rounded-lg p-2 text-zinc-300 dark:text-zinc-500 transition hover:bg-emerald-50 hover:text-[#009639] dark:text-emerald-300" aria-label="Edit event">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => handleDelete(event)}
                        className="rounded-lg p-2 text-zinc-300 dark:text-zinc-500 transition hover:bg-red-50 hover:text-red-600" aria-label="Delete event">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center">
                    <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-[#009639] dark:text-emerald-300">
                      <CalendarPlus className="h-6 w-6" />
                    </span>
                    <p className="text-[13px] font-bold text-zinc-700 dark:text-zinc-200">
                      {events.length === 0 ? 'No events yet' : 'No events found'}
                    </p>
                    <p className="mt-0.5 text-[12px] text-zinc-400 dark:text-zinc-500">
                      {events.length === 0 ? 'Click New Event to create one.' : 'Try a different keyword.'}
                    </p>
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

  const ViewTabs = () => (
    <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-700 mb-4">
      {[
        { key: 'month', label: 'Month', icon: Calendar },
        { key: 'week', label: 'Week', icon: LayoutDashboard },
        { key: 'day', label: 'Day', icon: CalendarDays },
        { key: 'list', label: 'List', icon: LayoutDashboard },
      ].map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => setViewMode(key)}
          className={`flex items-center gap-1.5 rounded-t-lg px-4 py-2.5 text-[13px] font-bold transition ${
            viewMode === key
              ? 'bg-white dark:bg-zinc-900 text-[#009639] dark:text-emerald-300 border-b-2 border-[#009639]'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
          }`}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  );

  const renderView = () => {
    switch (viewMode) {
      case 'month':
        return <CalendarViewComponent />;
      case 'list':
        return <ListViewComponent />;
      default:
        return <CalendarViewComponent />;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AdminSidebar user={user} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />

      <div className="lg:pl-64">
        <AdminTopbar user={user} title="Calendar" onMenuClick={() => setSidebarOpen(true)} />

        <main className={`mx-auto space-y-4 p-4 sm:p-6 ${viewMode === 'month' ? 'max-w-[1400px]' : 'max-w-6xl'}`}>
          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Events', value: counts.total, icon: Calendar },
              { label: 'Active', value: counts.active, icon: Power },
              { label: 'Upcoming', value: counts.upcoming, icon: CalendarDays },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#009639]/10 text-[#009639] dark:text-emerald-300">
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <p className="mt-1.5 text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">{value}</p>
              </div>
            ))}
          </div>

          {/* View tabs */}
          <ViewTabs />

          {/* Calendar / List View */}
          {renderView()}

          {/* Event Details Modal */}
          {eventDetailsOpen && selectedEvent && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { setEventDetailsOpen(false); setSelectedEvent(null); }}>
              <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white dark:bg-zinc-900 shadow-xl p-5" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{selectedEvent.title}</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">{selectedEvent.location || 'No location'}</p>
                  </div>
                  <button onClick={() => { setEventDetailsOpen(false); setSelectedEvent(null); }} className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
                  <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                    <Clock className="h-4 w-4" />
                    <span>
                      {formatDate(selectedEvent.startAt)} {selectedEvent.startAt && formatTime(selectedEvent.startAt)}
                      {selectedEvent.endAt && ` – ${formatDate(selectedEvent.endAt)} ${formatTime(selectedEvent.endAt)}`}
                    </span>
                  </div>
                  {selectedEvent.location && (
                    <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                      <MapPin className="h-4 w-4" />
                      <span>{selectedEvent.location}</span>
                    </div>
                  )}
                  {selectedEvent.description && (
                    <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
                      <p className="font-medium text-zinc-700 dark:text-zinc-300">Description</p>
                      <p className="mt-1 text-zinc-600 dark:text-zinc-400">{selectedEvent.description}</p>
                    </div>
                  )}
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => { openEdit(selectedEvent); setEventDetailsOpen(false); setSelectedEvent(null); }}
                    className="flex-1 py-2 rounded-lg bg-[#009639] text-white font-bold transition hover:bg-[#007a2e]">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(selectedEvent)}
                    className="flex-1 py-2 rounded-lg border border-red-500 text-red-600 font-bold transition hover:bg-red-50">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}