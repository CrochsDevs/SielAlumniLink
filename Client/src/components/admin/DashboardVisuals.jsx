import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowUpRight } from 'lucide-react';

export function CoverageGauge({ data }) {
  const total = data.members.alumni;
  const responses = data.overview?.tracerResponses;
  const rate = total && responses != null ? Math.min(100, Math.round(responses / total * 100)) : 0;
  return <section className="dashboard-card dashboard-coverage">
    <div className="dashboard-card-heading"><h2>Tracer study coverage</h2><Link className="dashboard-view-link" to="/admin/tracer">View report <ArrowUpRight size={13} /></Link></div>
    <div className="coverage-gauge" role="img" aria-label={responses == null ? 'Tracer coverage unavailable' : `${rate}% of alumni responded`}>
      <svg viewBox="0 0 300 220" aria-hidden="true">
        {Array.from({ length: 26 }, (_, i) => {
          const angle = (150 + i * 240 / 25) * Math.PI / 180;
          return <line key={i} x1={150 + 90 * Math.cos(angle)} y1={140 + 90 * Math.sin(angle)} x2={150 + 116 * Math.cos(angle)} y2={140 + 116 * Math.sin(angle)} stroke={responses != null && i < Math.round(rate * 26 / 100) ? '#009639' : 'var(--gauge-track)'} strokeWidth="11" strokeLinecap="round" />;
        })}
        <text x="150" y="143" textAnchor="middle" className="coverage-number">{responses == null ? '—' : `${rate}%`}</text>
        <text x="150" y="167" textAnchor="middle" className="coverage-caption">alumni responded</text>
      </svg>
    </div>
    <div className="coverage-legend"><span><i />Responded <strong>{responses ?? '—'}</strong></span><span><i className="is-muted" />Remaining <strong>{responses == null ? '—' : Math.max(0, total - responses)}</strong></span></div>
    <p className="coverage-note">Across {total.toLocaleString()} registered alumni</p>
  </section>;
}

const localDay = value => new Date(value).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

export function DashboardCalendar({ overview }) {
  const today = localDay(new Date());
  const [month, setMonth] = useState(() => new Date(`${today.slice(0, 7)}-01T12:00:00`));
  const [selected, setSelected] = useState(today);
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const first = new Date(year, monthIndex, 1).getDay();
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const events = overview?.upcomingEvents || [];
  const selectedEvents = events.filter(event => localDay(event.startAt) === selected);
  const move = offset => setMonth(new Date(year, monthIndex + offset, 1, 12));
  return <section className="dashboard-card dashboard-calendar">
    <div className="dashboard-card-heading"><h2>Calendar</h2><Link to="/admin/events" className="dashboard-view-link">View all <ArrowUpRight size={13} /></Link></div>
    <div className="calendar-month"><button type="button" aria-label="Previous month" onClick={() => move(-1)}><ChevronLeft size={15} /></button><h3 aria-live="polite">{month.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}</h3><button type="button" aria-label="Next month" onClick={() => move(1)}><ChevronRight size={15} /></button></div>
    <div className="dashboard-calendar-grid">
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <span className="calendar-weekday" key={day}>{day}</span>)}
      {Array.from({ length: Math.ceil((first + days) / 7) * 7 }, (_, i) => {
        const day = i - first + 1;
        if (day < 1 || day > days) return <span key={i} />;
        const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const count = events.filter(event => localDay(event.startAt) === key).length;
        return <button type="button" key={i} onClick={() => setSelected(key)} aria-label={`${key}${count ? `, ${count} upcoming events` : ''}`} aria-pressed={selected === key} aria-current={today === key ? 'date' : undefined} className={selected === key ? 'is-selected' : ''}>{day}{count > 0 && <i />}</button>;
      })}
    </div>
    <div className="calendar-agenda" aria-live="polite">{selectedEvents.length ? selectedEvents.map(event => <Link key={event._id} to="/admin/events"><i />{event.title}</Link>) : <p>{overview ? 'No listed upcoming events on this date.' : 'Event overview unavailable.'}</p>}</div>
    <p className="coverage-note">Highlights from upcoming events · Philippine time</p>
  </section>;
}
