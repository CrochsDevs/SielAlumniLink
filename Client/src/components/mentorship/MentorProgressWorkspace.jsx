import StatCard from "../ui/stat-card";
import ProgressBar from "../ui/progress-bar";
import { useState } from 'react';
import { ArrowLeft, ArrowUpRight, CheckCircle2, Search, Target, Users } from 'lucide-react';
import ProfileAvatar from '../profile/ProfileAvatar';

const panel = 'rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900';
const muted = 'text-zinc-500 dark:text-zinc-400';
const states = {
  completed: ['Completed', 'bg-brand'],
  in_progress: ['In progress', 'bg-amber-400'],
  not_started: ['Not started', 'bg-zinc-300 dark:bg-zinc-600'],
};

function Progress({ tracker }) {
  return <div>
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <span className={`text-xs ${muted}`}>{tracker.summary.completed} of {tracker.summary.total} goals confirmed</span>
      <span className="text-sm font-semibold tabular-nums text-brand dark:text-brand">{tracker.summary.percent}%</span>
    </div>
    <ProgressBar label={`${tracker.student.name}'s confirmed goals`} value={tracker.summary.total ? tracker.summary.completed / tracker.summary.total * 100 : 0} segments={tracker.summary.total} />
  </div>;
}

export default function MentorProgressWorkspace({ trackers, renderGoals, dirty, initialPartnerAuthId, onSelect }) {
  const [selectedId, setSelectedId] = useState(() => trackers.find(item => item.student.authId === initialPartnerAuthId)?.connectionId || '');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const selected = trackers.find(item => item.connectionId === selectedId);
  const finished = trackers.filter(item => item.summary.percent === 100).length;
  const active = trackers.filter(item => item.summary.inProgress > 0).length;
  const visible = trackers.filter(item => {
    const matches = [item.student.name, item.student.program, item.student.email].filter(Boolean).join(' ').toLowerCase().includes(query.trim().toLowerCase());
    return matches && (filter === 'all' || (filter === 'completed' ? item.summary.percent === 100 : filter === 'in_progress' ? item.summary.inProgress > 0 : item.summary.completed === 0 && item.summary.inProgress === 0));
  });
  const select = id => { setSelectedId(id); onSelect(); };

  if (selected) return <div className="space-y-5" data-mentee-detail={selected.connectionId}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <button type="button" disabled={dirty} onClick={() => select('')} className="inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-medium text-zinc-600 hover:text-brand disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-300"><ArrowLeft size={16} />All mentees</button>
      <span className={`text-xs ${muted}`}>{dirty ? 'Save or cancel your review before switching mentees.' : 'Individual progress tracker'}</span>
    </div>
    <section className={`${panel} overflow-hidden`}>
      <div className="h-1 bg-brand" />
      <div className="grid items-center gap-6 p-5 sm:p-6 md:grid-cols-[1fr_280px]">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-emerald-50 text-xl font-semibold text-brand dark:bg-zinc-800 dark:text-brand"><ProfileAvatar user={selected.student} /></span>
          <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-widest text-brand dark:text-brand">Mentee progress</p><h3 className="mt-1 break-words text-xl font-semibold tracking-tight">{selected.student.name}</h3><p className={`mt-1 break-words text-xs ${muted}`}>{selected.student.program || selected.student.email}</p></div>
        </div>
        <div><Progress tracker={selected} /><p className={`mt-3 text-xs ${muted}`}>{selected.summary.inProgress} in progress · {selected.summary.notStarted} not started</p></div>
      </div>
    </section>
    <div><h3 className="text-sm font-semibold">Goals & mentor reviews</h3><p className={`mt-1 text-xs leading-5 ${muted}`}>Review {selected.student.name.split(' ')[0]}'s activity and confirm each completed goal.</p></div>
    <div className="space-y-3">{renderGoals(selected)}</div>
  </div>;

  return <div className="space-y-5">
    <dl className="grid gap-3 sm:grid-cols-3">
      {[[Users, trackers.length, 'Total mentees', 'Connected to you', 'blue'], [Target, active, 'Working on goals', 'Have goals in progress', 'warning'], [CheckCircle2, finished, 'All goals completed', 'Confirmed by you', 'positive']].map(([icon, value, label, note, tone]) => <StatCard key={label} label={label} value={value} note={note} icon={icon} tone={tone} />)}
    </dl>
    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
      <div><h3 className="text-sm font-semibold">Mentee overview</h3><p className={`mt-1 text-xs ${muted}`}>A separate journey for every mentee.</p></div>
      <div className="flex w-full flex-wrap gap-2 sm:w-auto">
        <label className="relative min-w-0 flex-1 sm:w-60"><Search size={15} className="absolute left-3 top-3 text-zinc-400" /><span className="sr-only">Search mentees</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search mentees..." className="workspace-search-input h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-xs outline-none focus:border-brand dark:border-zinc-700 dark:bg-zinc-800" /></label>
        <select aria-label="Filter mentee progress" value={filter} onChange={event => setFilter(event.target.value)} className="h-11 max-w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs outline-none focus:border-brand dark:border-zinc-700 dark:bg-zinc-900"><option value="all">All progress</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="not_started">Not started</option></select>
      </div>
    </div>
    <p role="status" className={`text-xs ${muted}`}>Showing {visible.length} of {trackers.length} mentees</p>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {visible.map(tracker => <article key={tracker.connectionId} data-mentee-progress={tracker.connectionId} className={`${panel} flex min-w-0 flex-col transition-shadow hover:shadow-md`}>
        <div className="flex flex-1 flex-col p-5">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-50 font-semibold text-brand dark:bg-zinc-800 dark:text-brand"><ProfileAvatar user={tracker.student} /></span>
            <div className="min-w-0"><h4 className="truncate text-sm font-semibold" title={tracker.student.name}>{tracker.student.name}</h4><p className={`mt-1 truncate text-xs ${muted}`} title={tracker.student.program || tracker.student.email}>{tracker.student.program || tracker.student.email}</p></div>
          </div>
          <Progress tracker={tracker} />
          <ul className="mt-5 space-y-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">{tracker.goals.map(goal => { const [label, color] = states[goal.status] || states.not_started; return <li key={goal.key} className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="text-zinc-600 dark:text-zinc-300">{goal.title}</span><span className={`inline-flex items-center gap-1.5 text-[10px] ${muted}`}><span className={`h-1.5 w-1.5 rounded-full ${color}`} />{label}</span></li>; })}</ul>
        </div>
        <button type="button" aria-label={`View progress for ${tracker.student.name}`} onClick={() => select(tracker.connectionId)} className="flex min-h-12 items-center justify-between gap-2 rounded-b-2xl border-t border-zinc-100 bg-zinc-50/60 px-5 text-xs font-semibold text-brand transition-colors hover:bg-emerald-50 focus-visible:outline-brand dark:border-zinc-800 dark:bg-zinc-800/30 dark:text-brand dark:hover:bg-zinc-800">View progress<ArrowUpRight size={16} /></button>
      </article>)}
    </div>
    {!visible.length && <div className={`${panel} p-10 text-center`}><Search size={24} className="mx-auto text-zinc-400" /><h3 className="mt-3 text-sm font-semibold">No mentees found</h3><p className={`mt-2 text-xs ${muted}`}>Try another name or adjust the progress filter.</p><button type="button" onClick={() => { setQuery(''); setFilter('all'); }} className="mt-4 min-h-10 text-xs font-semibold text-brand dark:text-brand">Clear filters</button></div>}
    <p className={`text-xs leading-5 ${muted}`}>Progress reflects mentor-confirmed goals. Activities and reviews stay linked to each individual mentee.</p>
  </div>;
}
