import { Check } from "lucide-react";
import { RESUME_THEMES } from "../../utils/resumeThemes";

export default function ResumeThemePicker({
  value,
  onChange,
  compact = false,
}) {
  return (
    <fieldset>
      <legend className="mb-3 text-xs font-semibold">Resume theme</legend>
      <div
        className={
          compact ? "grid grid-cols-2 gap-2 sm:grid-cols-4" : "space-y-2"
        }
      >
        {RESUME_THEMES.map((theme) => (
          <label
            key={theme.id}
            className={`relative flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${value === theme.id ? "border-brand bg-emerald-50/50 dark:border-brand dark:bg-emerald-950/20" : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500"} ${compact ? "justify-center" : ""}`}
          >
            <input
              type="radio"
              name={compact ? "preview-resume-theme" : "resume-theme"}
              value={theme.id}
              checked={value === theme.id}
              onChange={() => onChange(theme.id)}
              className="sr-only peer"
            />
            {!compact && (
              <span
                aria-hidden="true"
                className={`resume-theme-swatch resume-theme-swatch--${theme.id}`}
              >
                <span />
                <span />
                <span />
                <span />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold">{theme.name}</span>
              {!compact && (
                <span className="mt-1 block text-[10px] leading-5 text-zinc-500 dark:text-zinc-400">
                  {theme.description}
                </span>
              )}
            </span>
            {value === theme.id && (
              <Check
                size={13}
                className="shrink-0 text-brand dark:text-brand"
              />
            )}
            <span className="pointer-events-none absolute inset-0 rounded-lg peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2" />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
