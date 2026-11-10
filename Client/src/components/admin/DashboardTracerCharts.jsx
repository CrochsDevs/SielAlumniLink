import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, X } from "lucide-react";
import ContentSkeleton from "../ui/Skeleton";
import api from "../../utils/axios";
import TracerGraph from "./TracerGraph";

const statuses = [
  ["Employed", "#159879"],
  ["Self-employed", "#5189d8"],
  ["Unemployed", "#df7777"],
  ["Studying", "#d7a344"],
];
const alignments = [
  ["directly_related", "Directly related", "#159879"],
  ["partly_related", "Partly related", "#5189d8"],
  ["unrelated", "Unrelated", "#d7a344"],
  ["unsure", "Not sure", "#9a87ca"],
  ["not_reported", "Not reported", "#8a95a5"],
];
const isWorking = row => ["Employed", "Self-employed"].includes(row.status);
const percent = (count, total) => total ? Math.round(count / total * 100) : 0;

function ChartData({ items, total, label }) {
  const dialog = useRef(null);
  const titleId = useId();
  return <div className="dashboard-chart-data">
    <button type="button" className="tracer-data-trigger" onClick={() => dialog.current.showModal()}>View chart data <ArrowUpRight size={12} /></button>
    <dialog ref={dialog} className="tracer-data-modal" aria-labelledby={titleId} onClick={event => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.current.close();
    }}>
    <div className="tracer-modal-heading"><div><h3 id={titleId}>{label}</h3><p className="dashboard-panel-subtitle">{total.toLocaleString()} respondents in the selected tracing period.</p></div><button type="button" aria-label="Close chart data" onClick={() => dialog.current.close()}><X size={18} /></button></div>
    <div className="tracer-data-scroll"><table>
      <caption className="sr-only">{label}</caption>
      <thead><tr><th scope="col">Category</th><th scope="col">Respondents</th><th scope="col">Share</th></tr></thead>
      <tbody>{items.map(item => <tr key={item.label}><th scope="row">{item.label}</th><td>{item.count.toLocaleString()}</td><td>{percent(item.count, total)}%</td></tr>)}</tbody>
    </table></div>
    </dialog>
  </div>;
}

export default function DashboardTracerCharts({ revision = 0 }) {
  const [year, setYear] = useState("all");
  const [quarter, setQuarter] = useState("all");
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState(null);
  const [years, setYears] = useState([]);
  const key = `${year}:${quarter}:${revision}:${retry}`;
  useEffect(() => {
    const controller = new AbortController();
    api.get("/tracer", { params: { year, quarter }, signal: controller.signal })
      .then(response => {
        if (controller.signal.aborted) return;
        setResult({ key, rows: response.data.data || [] });
        setYears(response.data.periods?.years || []);
      })
      .catch(error => {
        if (!controller.signal.aborted) setResult({ key, error: error.response?.data?.message || "Unable to load tracer study charts." });
      });
    return () => controller.abort();
  }, [year, quarter, key]);
  const current = result?.key === key ? result : null;
  const rows = current?.rows || [];
  const total = rows.length;
  const working = rows.filter(isWorking);
  const employment = statuses.map(([label, color]) => ({ label, color, count: rows.filter(row => row.status === label).length }));
  const unknownStatus = rows.filter(row => !statuses.some(([status]) => status === row.status)).length;
  if (unknownStatus) employment.push({ label: "Not reported", color: "#8a95a5", count: unknownStatus });
  const alignment = alignments.map(([value, label, color]) => ({ label, color, count: working.filter(row => value === "not_reported" ? !alignments.slice(0, 4).some(([id]) => id === row.jobAlignment) : row.jobAlignment === value).length }));
  const programCounts = new Map();
  rows.forEach(row => {
    const program = row.program?.trim() || "Program not reported";
    programCounts.set(program, (programCounts.get(program) || 0) + 1);
  });
  const programs = [...programCounts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const params = new URLSearchParams();
  if (year !== "all") params.set("year", year);
  if (quarter !== "all") params.set("quarter", quarter);
  const reportLink = `/admin/tracer${params.size ? `?${params}` : ""}`;
  const related = working.filter(row => ["directly_related", "partly_related"].includes(row.jobAlignment)).length;

  return <section className="dashboard-tracer space-y-4" aria-labelledby="dashboard-tracer-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="dashboard-tracer-title" className="text-sm font-semibold">Tracer study insights</h2><p className="dashboard-panel-subtitle">Latest response per alumnus within the selected tracing period.</p></div>
      <Link className="dashboard-view-link" to={reportLink}>View tracer study <ArrowUpRight size={13} /></Link>
    </div>
    <div className="flex flex-wrap gap-3">
      <label className="tracer-chart-filter">Tracing year<select aria-label="Tracing year" value={year} onChange={event => setYear(event.target.value)}><option value="all">All tracing years</option>{years.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <label className="tracer-chart-filter">Quarter<select aria-label="Quarter" value={quarter} onChange={event => setQuarter(event.target.value)}><option value="all">All quarters</option><option value="1">Q1 · Jan–Mar</option><option value="2">Q2 · Apr–Jun</option><option value="3">Q3 · Jul–Sep</option><option value="4">Q4 · Oct–Dec</option></select></label>
    </div>
    {!current ? <ContentSkeleton variant="cards" count={3} label="Loading tracer study charts..." /> : current.error ?
      <div className="dashboard-card" role="alert">{current.error} <button type="button" className="underline" onClick={() => setRetry(value => value + 1)}>Retry tracer charts</button></div> : !total ?
      <div className="dashboard-card"><p className="text-sm font-medium">No tracer responses for this period.</p><p className="dashboard-panel-subtitle">Choose another tracing year or quarter to view graduate outcomes.</p></div> :
      <>
      <dl className="tracer-insight-stats">
        <div><dt>Total respondents</dt><dd>{total.toLocaleString()}</dd><span>Within the selected period</span></div>
        <div><dt>Working respondents</dt><dd>{percent(working.length, total)}<small>%</small></dd><span>{working.length.toLocaleString()} employed or self-employed</span></div>
        <div><dt>Related to their program</dt><dd>{working.length ? percent(related, working.length) : "—"}{working.length > 0 && <small>%</small>}</dd><span>{related.toLocaleString()} directly or partly related jobs</span></div>
        <div><dt>Programs represented</dt><dd>{programs.length.toLocaleString()}</dd><span>Based on submitted responses</span></div>
      </dl>
      <div className="tracer-charts-grid">
        <section className="dashboard-card">
          <div className="dashboard-card-heading"><h3>Employment status</h3><span className="dashboard-total-badge">{total.toLocaleString()} respondents</span></div>
          <div className="tracer-employment-chart">
            <TracerGraph items={employment} total={total} label="Employment status" doughnut>
              <div className="tracer-donut-center" aria-hidden="true"><strong>{percent(working.length, total)}%</strong><span>Working</span><small>{working.length.toLocaleString()} of {total.toLocaleString()} alumni</small></div>
            </TracerGraph>
            <ul className="tracer-chart-legend">{employment.map(item => <li key={item.label}>
              <i style={{ background: item.color }} aria-hidden="true" />
              <span>{item.label}</span><strong>{item.count.toLocaleString()} <small>{percent(item.count, total)}%</small></strong>
              <div className="tracer-legend-track" aria-hidden="true"><div style={{ width: `${percent(item.count, total)}%`, background: item.color }} /></div>
            </li>)}</ul>
          </div>
          <p className="dashboard-chart-caption">Working includes employed and self-employed tracer respondents.</p>
          <ChartData items={employment} total={total} label="Employment status data" />
        </section>
        <section className="dashboard-card">
          <div className="dashboard-card-heading"><h3>Program–job alignment</h3><span className="dashboard-total-badge">{working.length.toLocaleString()} working</span></div>
          {working.length ? <div className="tracer-alignment-chart">
            <div className="tracer-alignment-summary"><strong>{percent(related, working.length)}%</strong><div><span>in related work</span><small>{related.toLocaleString()} of {working.length.toLocaleString()} working alumni · directly or partly related</small></div></div>
            <TracerGraph items={alignment} total={working.length} label="Job alignment among working tracer respondents" showShares />
          </div> : <p className="tracer-chart-empty">No working respondents in this period.</p>}
          <p className="dashboard-chart-caption">Self-reported alignment among working respondents. Studying and unemployed responses are excluded.</p>
          {working.length > 0 && <ChartData items={alignment} total={working.length} label="Program–job alignment data" />}
        </section>
        <section className="dashboard-card tracer-program-chart">
          <div className="dashboard-card-heading"><h3>Responses by graduation program</h3><span className="dashboard-total-badge">{programs.length} programs</span></div>
          <TracerGraph items={programs} total={total} label="Tracer response counts by graduation program" />
          <p className="dashboard-chart-caption">Full chart width represents all {total.toLocaleString()} respondents in the selected period. Counts reflect responses, not total program enrollment.</p>
          <ChartData items={programs} total={total} label="Responses by graduation program data" />
        </section>
      </div></>}
  </section>;
}
