import { useId } from "react";
import { RESUME_THEMES, RESUME_THEME_GROUPS } from "../../utils/resumeThemes";

export function ResumeThemeOptions() {
  return RESUME_THEME_GROUPS.map((group) => (
    <optgroup key={group.name} label={group.name}>
      {group.ids.map((id) => {
        const theme = RESUME_THEMES.find((item) => item.id === id);
        return <option key={id} value={id}>{theme.name}</option>;
      })}
    </optgroup>
  ));
}

export default function ResumeThemePicker({
  value,
  onChange,
}) {
  const id = useId();
  const selected = RESUME_THEMES.find((theme) => theme.id === value) || RESUME_THEMES[0];
  return (
    <div>
      <label htmlFor={id} className="mb-3 block text-xs font-semibold">Resume theme</label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={`${id}-description`}
        className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:[color-scheme:dark]"
      >
        <ResumeThemeOptions />
      </select>
      <div className="mt-3 flex items-center gap-3" id={`${id}-description`}>
        <span aria-hidden="true" className={`resume-theme-swatch resume-theme-swatch--${selected.id}`}>
          <span /><span /><span /><span />
        </span>
        <p className="text-[10px] leading-5 text-zinc-500 dark:text-zinc-400">{selected.description}</p>
      </div>
    </div>
  );
}
