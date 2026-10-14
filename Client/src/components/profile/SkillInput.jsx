import { useId, useState } from "react";
import { Plus } from "lucide-react";
import { suggestSkills } from "./skillSuggestions";

export default function SkillInput({
  value,
  onChange,
  onAdd,
  selected,
  disabled,
  inputClass,
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const atLimit = selected.length >= 10;
  const blocked = disabled || atLimit;
  const suggestions = suggestSkills(value, selected);
  const visible = open && suggestions.length > 0 && !blocked;
  const add = async (skill) => {
    if (blocked) return;
    if (await onAdd(skill)) {
      setOpen(false);
      setActive(-1);
    }
  };

  return (
    <div className="mt-2">
      <div className="flex gap-2">
        <div
          className="relative min-w-0 flex-1"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setOpen(false);
              setActive(-1);
            }
          }}
        >
          <input
            role="combobox"
            aria-label="Add a skill"
            aria-autocomplete="list"
            aria-expanded={visible}
            aria-controls={visible ? id : undefined}
            aria-activedescendant={
              visible && active >= 0 && active < suggestions.length
                ? `${id}-${active}`
                : undefined
            }
            autoComplete="off"
            maxLength={100}
            value={value}
            disabled={blocked}
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              onChange(event.target.value);
              setOpen(true);
              setActive(-1);
            }}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;
              if (event.key === "Escape") {
                setOpen(false);
                setActive(-1);
              }
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                setOpen(true);
                if (suggestions.length)
                  setActive(
                    event.key === "ArrowDown"
                      ? (active + 1) % suggestions.length
                      : active <= 0
                        ? suggestions.length - 1
                        : active - 1,
                  );
              }
              if (event.key === "Enter") {
                event.preventDefault();
                add(
                  visible && active >= 0 && suggestions[active]
                    ? suggestions[active].label
                    : value,
                );
              }
            }}
            placeholder="Add a skill..."
            className={`${inputClass} h-9 text-[12px] disabled:opacity-50`}
          />
          {visible && (
            <ul
              id={id}
              role="listbox"
              aria-label="Suggested skills"
              className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
            >
              {suggestions.map((skill, index) => (
                <li
                  key={skill.label}
                  id={`${id}-${index}`}
                  role="option"
                  aria-selected={active === index}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => add(skill.label)}
                  className={`cursor-pointer px-3.5 py-2 text-[12px] ${active === index ? "bg-emerald-50 dark:bg-emerald-950" : "hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
                >
                  <span className="block font-semibold text-zinc-800 dark:text-zinc-100">
                    {skill.label}
                  </span>
                  <span className="block text-[10px] text-zinc-500 dark:text-zinc-400">
                    {skill.category}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={() => add(value)}
          disabled={blocked || !value.trim()}
          className="flex h-9 shrink-0 items-center gap-1 rounded-xl bg-[#009639] px-3 text-[12px] font-bold text-white transition hover:bg-[#007a2e] disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>
      <p
        aria-live="polite"
        className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400"
      >
        {selected.length}/10 skills.{" "}
        {atLimit
          ? "Limit reached. Remove a skill to add another."
          : "Choose a suggestion or type your own skill and press Add."}
      </p>
    </div>
  );
}
