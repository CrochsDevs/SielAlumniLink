import { useEffect, useRef } from "react";
import { Chart, ArcElement, BarElement, BarController, CategoryScale, DoughnutController, LinearScale, Tooltip } from "chart.js";

Chart.register(ArcElement, BarElement, BarController, CategoryScale, DoughnutController, LinearScale, Tooltip);

function wrapLabel(label) {
  const lines = [];
  for (const word of label.split(/\s+/)) {
    const last = lines.length - 1;
    if (last >= 0 && `${lines[last]} ${word}`.length <= 24) lines[last] += ` ${word}`;
    else lines.push(word);
  }
  return lines;
}

export default function TracerGraph({ items, total, label, doughnut = false, showShares = false, children }) {
  const canvas = useRef(null);
  useEffect(() => {
    const styles = getComputedStyle(canvas.current.closest(".admin-overview"));
    const muted = () => styles.getPropertyValue("--card-muted").trim();
    const border = () => styles.getPropertyValue("--card-border").trim();
    const chart = new Chart(canvas.current, {
      type: doughnut ? "doughnut" : "bar",
      plugins: showShares ? [{
        id: "alignmentDetails",
        beforeDatasetsDraw(chart) {
          const { ctx, chartArea } = chart;
          ctx.save();
          ctx.fillStyle = styles.getPropertyValue("--gauge-track").trim();
          chart.getDatasetMeta(0).data.forEach(bar => {
            ctx.beginPath();
            ctx.roundRect(chartArea.left, bar.y - 9, chartArea.width, 18, 5);
            ctx.fill();
          });
          ctx.restore();
        },
        afterDatasetsDraw(chart) {
          const { ctx, chartArea } = chart;
          ctx.save();
          ctx.font = `500 10px ${styles.fontFamily}`;
          ctx.fillStyle = styles.getPropertyValue("--card-ink").trim();
          ctx.textBaseline = "middle";
          chart.getDatasetMeta(0).data.forEach((bar, index) => {
            const count = items[index].count;
            ctx.fillText(`${count.toLocaleString()} · ${Math.round(count / total * 100)}%`, chartArea.right + 9, bar.y);
          });
          ctx.restore();
        },
      }] : [],
      data: {
        labels: items.map(item => item.label),
        datasets: [{
          label: "Respondents",
          data: items.map(item => item.count),
          backgroundColor: items.map(item => item.color || "#159879"),
          borderWidth: 0,
          borderRadius: doughnut ? 3 : 5,
          ...(doughnut ? { hoverOffset: 6, spacing: 3 } : { maxBarThickness: showShares ? 18 : 26 }),
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? false : { duration: 350 },
        ...(doughnut ? { cutout: "78%", layout: { padding: 8 } } : {
          indexAxis: "y",
          ...(showShares ? { layout: { padding: { right: 70 } } } : {}),
          scales: {
            x: { beginAtZero: true, max: Math.max(1, total), border: { display: false }, grid: { color: border(), drawTicks: false }, ticks: { color: muted(), ...(showShares ? { stepSize: Math.max(1, total) / 4, callback: value => `${Math.round(value / Math.max(1, total) * 100)}%` } : { precision: 0 }), maxTicksLimit: showShares ? 5 : 6, font: { size: 10 } }, title: { display: true, text: showShares ? "Share of working respondents" : `Respondents (out of ${total.toLocaleString()})`, color: muted(), font: { size: 10 } } },
            y: { border: { display: false }, grid: { display: false }, ticks: { color: muted(), autoSkip: false, font: { size: 11, lineHeight: 1.3 }, callback(value) { return wrapLabel(this.getLabelForValue(value)); } } },
          },
        }),
        plugins: {
          tooltip: {
            padding: 12,
            callbacks: { label: context => `${items[context.dataIndex].count.toLocaleString()} respondents (${total ? Math.round(items[context.dataIndex].count / total * 100) : 0}%)` },
          },
        },
      },
    });
    const observer = new MutationObserver(() => {
      if (doughnut) return;
      chart.options.scales.x.ticks.color = muted();
      chart.options.scales.x.title.color = muted();
      chart.options.scales.x.grid.color = border();
      chart.options.scales.y.ticks.color = muted();
      chart.update("none");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => { observer.disconnect(); chart.destroy(); };
  }, [items, total, doughnut, showShares]);

  return <div className={doughnut ? "tracer-donut-wrap" : "tracer-graph-scroll"}>
    <div className="tracer-canvas-wrap" style={doughnut ? { aspectRatio: "1" } : { height: Math.max(240, items.length * Math.max(44, ...items.map(item => wrapLabel(item.label).length * 15 + 16)) + 44) }}>
      <canvas ref={canvas} role="img" aria-label={`${label}. ${items.map(item => `${item.label}: ${item.count}${showShares ? ` (${total ? Math.round(item.count / total * 100) : 0}%)` : ""}`).join("; ")}`} />
    </div>
    {children}
  </div>;
}
