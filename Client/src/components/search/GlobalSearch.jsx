import ContentSkeleton from "../ui/Skeleton";
import { useEffect, useId, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
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
  const [visible, setVisible] = useState(false);
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
  const trigger = useRef(null);
  const id = useId();
  const navigate = useNavigate();
  const term = query.trim();
  const current = result.query === term;
  const items = current ? result.items : [];
  const loading = !!term && (!current || result.loading);

  useEffect(() => {
    if (visible) input.current?.focus();
  }, [visible]);

  const closeSearch = () => {
    setVisible(false);
    setOpen(false);
    setActive(-1);
  };

  useEffect(() => {
    const outside = (event) => {
      if (!root.current?.contains(event.target)) {
        setOpen(false);
        setVisible(false);
      }
    };
    const shortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setVisible(true);
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
      className="static shrink-0 sm:relative"
      onSubmit={(event) => {
        event.preventDefault();
        seeAll();
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) closeSearch();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          closeSearch();
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-label={visible ? "Close search" : "Open search"}
        aria-expanded={visible}
        aria-controls={`${id}-panel`}
        onClick={() => {
          if (visible) closeSearch();
          else setVisible(true);
        }}
        className={`flex h-10 w-10 items-center justify-center rounded-full transition ${visible ? "bg-emerald-50 text-brand dark:bg-zinc-800" : "text-zinc-500 hover:bg-emerald-50 hover:text-brand dark:hover:bg-zinc-800"}`}
      >
        {visible ? <X className="h-[18px] w-[18px]" /> : <Search className="h-[18px] w-[18px]" />}
      </button>
      <div
        id={`${id}-panel`}
        hidden={!visible}
        className="absolute left-4 right-4 top-full z-50 mt-2 rounded-2xl border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:left-auto sm:right-0 sm:w-[380px] sm:max-w-[calc(100vw-2rem)]"
      >
      <div className="global-search-input relative">
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
          className="h-10 w-full rounded-full border border-zinc-200 bg-zinc-50 pl-9 pr-9 text-sm text-zinc-900 outline-none focus:border-brand focus:ring-2 focus:ring-emerald-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
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
        <div className="mt-2 max-h-[min(60dvh,28rem)] overflow-y-auto text-zinc-900 dark:text-white">
          <div role="status" className="px-4 pt-3 text-xs text-zinc-500">
            {loading ? (
              <ContentSkeleton variant="list" count={3} label="Searching…" />
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
                className={`w-full border-t border-zinc-100 px-4 py-3 text-left text-sm font-semibold text-brand dark:border-zinc-800 dark:text-brand ${active === items.length ? "bg-emerald-50 dark:bg-zinc-800" : ""}`}
              >
                See all results for “{term}”
              </button>
            </li>
          </ul>
        </div>
      )}
      </div>
    </form>
  );
}
