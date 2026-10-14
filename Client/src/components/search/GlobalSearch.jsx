import { useEffect, useId, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Search, X, LoaderCircle } from "lucide-react";
import api from "../../utils/axios";
import { PersonSummary } from "./SearchPerson";
import { profilePath } from "./searchLinks";

export default function GlobalSearch() {
  const location = useLocation();
  const initialQuery = new URLSearchParams(location.search).get("q") || "";
  // Remount on URL changes to keep the input aligned with browser back/forward.
  return (
    <SearchInput
      key={`${location.pathname}?${initialQuery}`}
      initialQuery={initialQuery}
    />
  );
}

function SearchInput({ initialQuery }) {
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [result, setResult] = useState({
    query: "",
    items: [],
    loading: false,
    error: "",
  });
  const root = useRef(null);
  const input = useRef(null);
  const id = useId();
  const navigate = useNavigate();
  const term = query.trim();
  const current = result.query === term;
  const items = current ? result.items : [];
  const loading = !!term && (!current || result.loading);

  useEffect(() => {
    const outside = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    const shortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        input.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", shortcut);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", shortcut);
    };
  }, []);

  useEffect(() => {
    if (!term || !open) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setResult({ query: term, items: [], loading: true, error: "" });
      try {
        const { data } = await api.get("/search/suggestions", {
          params: { q: term },
          signal: controller.signal,
        });
        if (!controller.signal.aborted)
          setResult({
            query: term,
            items: data.data.people.items,
            loading: false,
            error: "",
          });
      } catch {
        if (!controller.signal.aborted)
          setResult({
            query: term,
            items: [],
            loading: false,
            error: "Search is unavailable. Please try again.",
          });
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term, open]);

  const seeAll = () => {
    if (!term) return;
    setOpen(false);
    setActive(-1);
    navigate(`/search?${new URLSearchParams({ q: term })}`);
  };
  const select = (person) => {
    setOpen(false);
    navigate(profilePath(person));
  };
  const expanded = open && !!term;
  return (
    <form
      ref={root}
      role="search"
      className="relative min-w-0 flex-1 sm:max-w-sm"
      onSubmit={(event) => {
        event.preventDefault();
        seeAll();
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-500"
        />
        <input
          ref={input}
          type="search"
          role="combobox"
          aria-label="Search AlumniLink"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={id}
          aria-activedescendant={
            expanded && active >= 0 ? `${id}-${active}` : undefined
          }
          autoComplete="off"
          maxLength={120}
          value={query}
          placeholder="Search people and posts"
          onFocus={() => {
            setOpen(true);
            setActive(-1);
          }}
          onClick={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
              setActive(-1);
            }
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              setActive((index) =>
                event.key === "ArrowDown"
                  ? (index + 1) % (items.length + 1)
                  : index <= 0
                    ? items.length
                    : index - 1,
              );
            }
            if (
              event.key === "Enter" &&
              expanded &&
              active >= 0 &&
              items[active]
            ) {
              event.preventDefault();
              select(items[active]);
            }
          }}
          className="h-10 w-full rounded-full border border-zinc-200 bg-zinc-50 pl-9 pr-9 text-sm text-zinc-900 outline-none focus:border-[#009639] focus:ring-2 focus:ring-emerald-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              setActive(-1);
              input.current?.focus();
            }}
            className="absolute right-2 top-2 rounded-full p-1 text-zinc-500"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {expanded && (
        <div className="absolute left-0 top-full z-50 mt-2 max-h-[70vh] w-full min-w-[230px] overflow-y-auto rounded-2xl border border-zinc-200 bg-white text-zinc-900 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 dark:text-white sm:left-auto sm:right-0 sm:w-[380px] sm:max-w-[calc(100vw-2rem)]">
          <div role="status" className="px-4 pt-3 text-xs text-zinc-500">
            {loading ? (
              <span className="flex items-center gap-2">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Searching…
              </span>
            ) : current && result.error ? (
              result.error
            ) : !items.length ? (
              "No matching results found"
            ) : (
              "People"
            )}
          </div>
          <ul
            id={id}
            role="listbox"
            aria-label="Search suggestions"
            className="py-2"
          >
            {items.map((person, index) => (
              <li
                key={person._id}
                id={`${id}-${index}`}
                role="option"
                aria-selected={active === index}
              >
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => select(person)}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left text-sm transition ${active === index ? "bg-emerald-50 dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
                >
                  <PersonSummary person={person} query={term} />
                </button>
              </li>
            ))}
            <li
              id={`${id}-${items.length}`}
              role="option"
              aria-selected={active === items.length}
            >
              <button
                type="submit"
                tabIndex={-1}
                className={`w-full border-t border-zinc-100 px-4 py-3 text-left text-sm font-semibold text-emerald-700 dark:border-zinc-800 dark:text-emerald-400 ${active === items.length ? "bg-emerald-50 dark:bg-zinc-800" : ""}`}
              >
                See all results for “{term}”
              </button>
            </li>
          </ul>
        </div>
      )}
    </form>
  );
}
