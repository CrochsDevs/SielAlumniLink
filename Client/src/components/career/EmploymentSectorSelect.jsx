import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

export default function EmploymentSectorSelect({ options, value, onChange, disabled, className }) {
  const id = useId();
  const trigger = useRef(null);
  const search = useRef(null);
  const list = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const filtered = options.filter(option => option.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    if (open) search.current?.focus();
  }, [open]);

  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const choose = option => {
    onChange(option);
    setOpen(false);
    trigger.current?.focus();
  };
  const keyDown = event => {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setQuery("");
        setActive(Math.max(0, options.indexOf(value)));
        setOpen(true);
      } else {
        setActive(previous => Math.max(0, Math.min(filtered.length - 1, previous + (event.key === "ArrowDown" ? 1 : -1))));
      }
    } else if (open && event.key === "Enter") {
      event.preventDefault();
      if (filtered[active]) choose(filtered[active]);
    }
  };

  return (
    <div className="relative min-w-0" onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <label id={`${id}-label`} htmlFor={`${id}-trigger`} className="block text-xs font-medium">
        Employment sector *
      </label>
      <button
        ref={trigger}
        id={`${id}-trigger`}
        type="button"
        role="combobox"
        aria-labelledby={`${id}-label`}
        aria-required="true"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-haspopup="listbox"
        disabled={disabled}
        className={`${className} flex items-center justify-between gap-2 text-left`}
        onKeyDown={keyDown}
        onClick={() => {
          setQuery("");
          setActive(Math.max(0, options.indexOf(value)));
          setOpen(previous => !previous);
        }}
      >
        <span className={`truncate ${value ? "" : "text-zinc-500"}`}>{value || "Select employment sector"}</span>
        <ChevronDown size={15} className="shrink-0" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center gap-2 border-b border-zinc-200 px-3 dark:border-zinc-700">
            <Search size={15} className="shrink-0 text-zinc-500" />
            <input
              ref={search}
              type="text"
              role="combobox"
              aria-label="Search employment sectors"
              aria-autocomplete="list"
              aria-expanded="true"
              aria-controls={`${id}-list`}
              aria-activedescendant={filtered[active] ? `${id}-option-${active}` : undefined}
              placeholder="Search sectors, e.g. LGU, IT, healthcare"
              value={query}
              onChange={event => { setQuery(event.target.value); setActive(0); }}
              onKeyDown={keyDown}
              className="h-10 w-full min-w-0 bg-transparent text-xs outline-none"
            />
          </div>
          <div ref={list} id={`${id}-list`} role="listbox" aria-labelledby={`${id}-label`} className="max-h-60 overflow-y-auto p-1">
            {filtered.map((option, index) => (
              <button
                key={option}
                id={`${id}-option-${index}`}
                type="button"
                role="option"
                aria-selected={value === option}
                tabIndex={-1}
                onMouseDown={event => event.preventDefault()}
                onMouseMove={() => setActive(index)}
                onClick={() => choose(option)}
                className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-xs ${active === index ? "bg-emerald-50 text-brand dark:bg-zinc-800" : "text-zinc-700 dark:text-zinc-200"}`}
              >
                <span>{option}</span>
                {value === option && <Check size={14} className="shrink-0" />}
              </button>
            ))}
          </div>
          {!filtered.length && <p role="status" className="p-3 text-xs text-zinc-500">No matching sectors. Try another search.</p>}
        </div>
      )}
    </div>
  );
}
