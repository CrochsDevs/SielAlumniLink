import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import DataPagination from '../ui/data-pagination';
import api from '../../utils/axios';

const card = 'rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900';
const input = 'h-10 min-w-0 rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none focus:border-[#009639] dark:border-zinc-700 dark:bg-zinc-900';
const button = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-zinc-200 px-4 text-xs font-semibold hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800';
const labelMonth = value => value ? value.slice(0, 7) : 'Date not provided';
const csvCell = value => {
  const text = String(value ?? '');
  return `"${(/^[=+@\-\t\r]/.test(text) ? "'" : '') + text.replace(/"/g, '""')}"`;
};

export default function EmploymentReports() {
  const [report, setReport] = useState(null);
  const [batch, setBatch] = useState('');
  const [program, setProgram] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [expanded, setExpanded] = useState(null);
  const generation = useRef(0);
  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true); setError('');
    try {
      const response = await api.get('/employment/reports', { params: { ...(batch ? { batch } : {}), ...(program ? { program } : {}) } });
      if (request === generation.current) setReport(response.data.data);
    } catch (err) { if (request === generation.current) setError(err.response?.data?.message || 'Unable to load employment reports.'); }
    finally { if (request === generation.current) setLoading(false); }
  }, [batch, program]);
  useEffect(() => { void load(); return () => { ++generation.current; }; }, [load]);
  const filtered = (report?.alumni || []).filter(person => (!status || person.employmentStatus === status) && [person.name, person.email, person.currentCompany, person.position, person.industry].some(value => value.toLowerCase().includes(query.trim().toLowerCase())));
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);
  const exportReport = () => {
    const rows = [
      ['Employment report', 'Value'],
      ['Batch', batch || 'All'], ['Program', program || 'All'],
      ['Total alumni', report.summary.totalAlumni], ['Reported status', report.summary.reported], ['Not reported', report.summary.notReported],
      ['Employment rate (%) among reported alumni', report.summary.employmentRate], ['Reporting rate (%)', report.summary.reportingRate],
      [], ['Industry', 'Employed alumni', 'Share of employed (%)'], ...report.industryDistribution.map(item => [item.industry, item.count, item.percentage]),
      [], ['Name', 'Email', 'Batch', 'Program', 'Status', 'Company', 'Position', 'Industry', 'Start month', 'Recorded role changes'],
      ...filtered.map(person => [person.name, person.email, person.batch, person.program, person.employmentStatus, person.currentCompany, person.position, person.industry, person.startDate, person.transitions.filter(step => step.companyChanged || step.positionChanged).length]),
      [], ['Career progression', 'Company', 'Position', 'Industry', 'Start', 'End', 'Current'],
      ...filtered.flatMap(person => person.employmentHistory.map(job => [person.name, job.company, job.position || job.role, job.industry, job.startDate, job.endDate, job.current ? 'Yes' : 'No'])),
    ];
    const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a'); link.href = url; link.download = 'alumni-employment-report.csv'; link.click();
    URL.revokeObjectURL(url);
  };
  return <section aria-label="Alumni employment reports" className="space-y-4">
      <header className={`${card} flex flex-wrap items-center justify-between gap-4`}><div><h2 className="text-xl font-semibold">Alumni employment tracking</h2><p className="mt-1 text-xs leading-6 text-zinc-500 dark:text-zinc-400">Employment outcomes and career history from alumni profiles.</p></div><div className="flex gap-2"><button type="button" onClick={load} disabled={loading} className={button}><RefreshCw size={15} />Refresh</button><button type="button" onClick={exportReport} disabled={loading || !!error || !report} className={button}><Download size={15} />Export CSV</button></div></header>
      <section className={`${card} flex flex-wrap gap-3`} aria-label="Report filters"><label className="flex min-w-0 flex-col gap-2 text-xs font-medium">Batch<select aria-label="Filter batch" value={batch} onChange={event => { setBatch(event.target.value); setPage(1); }} className={input}><option value="">All batches</option>{report?.filters.batches.map(value => <option key={value}>{value}</option>)}</select></label><label className="flex min-w-0 flex-col gap-2 text-xs font-medium">Program<select aria-label="Filter program" value={program} onChange={event => { setProgram(event.target.value); setPage(1); }} className={`${input} max-w-full`}><option value="">All programs</option>{report?.filters.programs.map(value => <option key={value}>{value}</option>)}</select></label></section>
      {error && <p role="alert" className={`${card} text-sm text-red-600 dark:text-red-400`}>{error} <button type="button" onClick={load} className="underline">Retry</button></p>}
      {loading ? <p role="status" className={card}>Loading employment reports…</p> : !error && report && <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['Employment rate', `${report.summary.employmentRate}%`, `${report.summary.employed} employed / ${report.summary.reported} reported`], ['Reporting coverage', `${report.summary.reportingRate}%`, `${report.summary.reported} of ${report.summary.totalAlumni} alumni`], ['Not reported', report.summary.notReported, 'No status or current role reported'], ['Career changes', report.summary.alumniWithCareerChanges, 'Alumni with recorded company or position changes']].map(([title, value, detail]) => <section key={title} className={card}><h2 className="text-xs text-zinc-500 dark:text-zinc-400">{title}</h2><p className="mt-2 text-3xl font-semibold text-[#009639] dark:text-emerald-300">{value}</p><p className="mt-2 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">{detail}</p></section>)}</div>
        <p className="px-1 text-xs leading-6 text-zinc-500 dark:text-zinc-400">Employment rate = employed and self-employed alumni ÷ alumni with a reported status. Studying and unemployed are included in the denominator. Missing reports are excluded. Batch and program filters apply to all summaries; search and status below filter the alumni list and its export.</p>
        <div className="grid gap-4 lg:grid-cols-2"><section className={card}><h2 className="text-base font-semibold">Industry distribution</h2><p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Share of employed and self-employed alumni</p><div className="mt-5 space-y-4">{!report.industryDistribution.length && <p className="text-sm text-zinc-500 dark:text-zinc-400">No employed alumni in this selection.</p>}{report.industryDistribution.map(item => <div key={item.industry}><div className="mb-2 flex justify-between gap-3 text-xs"><span className="break-words">{item.industry}</span><span className="shrink-0 text-zinc-500 dark:text-zinc-400">{item.count} · {item.percentage}%</span></div><div role="meter" aria-label={item.industry} aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.percentage} className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"><div className="h-full rounded-full bg-[#009639]" style={{ width: `${item.percentage}%` }} /></div></div>)}</div></section><section className={card}><h2 className="text-base font-semibold">Employment status</h2><dl className="mt-4 space-y-3">{report.statusDistribution.map(item => <div key={item.status} className="flex justify-between gap-3 border-b border-zinc-100 pb-3 text-sm last:border-0 dark:border-zinc-800"><dt className="text-zinc-500 dark:text-zinc-400">{item.status}</dt><dd className="font-semibold">{item.count}</dd></div>)}</dl></section></div>
        <section className={card}><h2 className="text-base font-semibold">Career progression</h2><p className="mt-1 text-xs leading-6 text-zinc-500 dark:text-zinc-400">View recorded roles over time. Position changes are shown as history; seniority is not inferred.</p><div className="mt-4 flex flex-wrap gap-3"><input type="search" aria-label="Search alumni employment" placeholder="Search name, company, position or industry" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} className={`${input} flex-1 basis-64`} /><select aria-label="Filter employment status" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }} className={input}><option value="">All statuses</option>{report.statusDistribution.map(item => <option key={item.status}>{item.status}</option>)}</select></div><p role="status" className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">{filtered.length} alumni</p>
          <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[750px] text-left text-xs"><thead className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"><tr>{['Alumni', 'Status', 'Company / position', 'Industry', 'History'].map(value => <th key={value} scope="col" className="px-3 py-3 font-medium">{value}</th>)}</tr></thead><tbody>{paged.map(person => <tr key={person._id} className="border-b border-zinc-100 dark:border-zinc-800"><td className="max-w-64 break-words px-3 py-4"><p className="font-semibold">{person.name}</p><p className="mt-1 text-zinc-500 dark:text-zinc-400">{[person.program, person.batch].filter(Boolean).join(' · ')}</p></td><td className="px-3 py-4">{person.employmentStatus}</td><td className="max-w-64 break-words px-3 py-4"><p>{person.currentCompany || '—'}</p><p className="mt-1 text-zinc-500 dark:text-zinc-400">{person.position}</p></td><td className="px-3 py-4">{person.industry || '—'}</td><td className="px-3 py-4"><button type="button" aria-expanded={expanded === person._id} onClick={() => setExpanded(expanded === person._id ? null : person._id)} className="font-semibold text-[#009639] dark:text-emerald-300">{person.employmentHistory.length} roles · View</button></td></tr>)}</tbody></table></div>
          {!filtered.length && <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">No alumni match this selection.</p>}
          {expanded && filtered.some(person => person._id === expanded) && <div className="mt-4 rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/60">{filtered.filter(person => person._id === expanded).map(person => <div key={person._id}><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">{person.name} — career history</h3><button type="button" onClick={() => setExpanded(null)} className="text-xs underline">Close</button></div>{!person.employmentHistory.length && <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">No roles recorded.</p>}<ol className="mt-4 space-y-3">{person.employmentHistory.map((job, index) => <li key={job._id || index} className="border-l-2 border-[#009639] pl-3"><p className="break-words text-sm font-medium">{job.position || job.role || 'Position not specified'} at {job.company || 'Company not specified'}{job.current && ' · Current'}</p><p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{labelMonth(job.startDate)} – {job.current ? 'Present' : labelMonth(job.endDate)}{job.industry && ` · ${job.industry}`}</p></li>)}</ol><p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">{person.transitions.filter(step => step.companyChanged || step.positionChanged).length} recorded company or position changes.</p></div>)}</div>}
          <DataPagination page={currentPage} totalPages={totalPages} onPageChange={setPage} perPage={perPage} onPerPageChange={value => { setPerPage(value); setPage(1); }} totalItems={filtered.length} itemLabel="alumni" />
        </section>
      </>}
  </section>;
}
