import "./progress-bar.css";

export default function ProgressBar({
  value = 0,
  max = 100,
  segments = 4,
  label,
  valueText,
  role = "progressbar",
  className = "",
  segmentClassName = "",
  fillClassName = "",
}) {
  const maximum = Number.isFinite(max) && max > 0 ? max : 100;
  const current = Number.isFinite(value) ? Math.max(0, Math.min(maximum, value)) : 0;
  const count = Number.isInteger(segments) && segments > 0 ? segments : 4;
  const fraction = current / maximum;

  return (
    <div className={`app-progress ${className}`} role={role} aria-label={label}
      aria-valuemin={0} aria-valuemax={maximum} aria-valuenow={current} aria-valuetext={valueText}>
      {Array.from({ length: count }, (_, index) => {
        const filled = Math.max(0, Math.min(1, fraction * count - index));
        return <span key={index} aria-hidden="true" data-filled={filled === 1}
          className={`app-progress-track ${segmentClassName}`}>
          <span className={`app-progress-fill ${fillClassName}`} style={{ width: `${filled * 100}%` }} />
        </span>;
      })}
    </div>
  );
}
