import ContentSkeleton from "../ui/Skeleton";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Clock3, Search, X } from "lucide-react";
import api from "../../utils/axios";
import { Avatar, PersonSummary } from "./SearchPerson";
import { profilePath } from "./searchLinks";
import { useAuth } from "../../context/useAuth";
import './GlobalSearch.css';

const emptyHistory = () => ({ people: [], queries: [] });
const readHistory = key => {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    return {
      people: Array.isArray(saved?.people) ? saved.people.filter(person => typeof person?._id === 'string' && typeof person?.name === 'string').slice(0, 8) : [],
      queries: Array.isArray(saved?.queries) ? saved.queries.filter(query => typeof query === 'string' && query.trim() && query.length <= 120).slice(0, 8) : [],
    };
  } catch { return emptyHistory(); }
};

export default function GlobalSearch() {
  const location = useLocation();
  const { user } = useAuth();
  const historyKey = `alumnilink:search-history:${user?.authId || user?._id || 'guest'}`;
  const initialQuery = new URLSearchParams(location.search).get("q") || "";
  // Remount on URL changes to keep the input aligned with browser back/forward.
  return (
    <SearchInput
      key={`${historyKey}:${location.pathname}?${initialQuery}`}
      initialQuery={initialQuery}
      historyKey={historyKey}
    />
  );
}

function SearchInput({ initialQuery, historyKey }) {
  const [query, setQuery] = useState(initialQuery);
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 639px)').matches);
  const [history, setHistory] = useState(() => readHistory(historyKey));
  const [showAllHistory, setShowAllHistory] = useState(false);
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
    const media = window.matchMedia('(max-width: 639px)');
    const changed = event => setMobile(event.matches);
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);
  useEffect(() => {
    if (!visible || !mobile) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const viewport = window.visualViewport;
    const panel = root.current;
    const resize = () => {
      if (viewport && panel) {
        panel.style.height = `${viewport.height}px`;
        panel.style.top = `${viewport.offsetTop}px`;
      }
    };
    resize();
    viewport?.addEventListener('resize', resize);
    viewport?.addEventListener('scroll', resize);
    return () => {
      document.body.style.overflow = overflow;
      viewport?.removeEventListener('resize', resize);
      viewport?.removeEventListener('scroll', resize);
      panel?.style.removeProperty('height');
      panel?.style.removeProperty('top');
    };
  }, [visible, mobile]);

  const saveHistory = next => {
    setHistory(next);
    try { localStorage.setItem(historyKey, JSON.stringify(next)); } catch { /* Search still works without browser storage. */ }
  };

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

  const seeAll = (value = term) => {
    const search = value.trim();
    if (!search) return;
    saveHistory({ ...history, queries: [search, ...history.queries.filter(previous => previous !== search)].slice(0, 8) });
    setVisible(false);
    setOpen(false);
    setActive(-1);
    navigate(`/search?${new URLSearchParams({ q: search })}`);
  };
  const select = (person) => {
    const { _id, authId, name, profilePicture, role } = person;
    saveHistory({ ...history, people: [{ _id, authId, name, profilePicture, role }, ...history.people.filter(previous => previous._id !== _id)].slice(0, 8) });
    setVisible(false);
    setOpen(false);
    navigate(profilePath(person));
  };
  const expanded = open && !!term;
  const content = (
    <form
      ref={root}
      role="search"
      className={`global-search static shrink-0 sm:relative ${mobile && visible ? 'global-search-mobile-open' : ''}`}
      aria-label="Search"
      onSubmit={(event) => {
        event.preventDefault();
        seeAll();
      }}
      onBlur={(event) => {
        if (mobile && visible) return;
        if (!event.currentTarget.contains(event.relatedTarget)) closeSearch();
      }}
      onKeyDown={(event) => {
        if (mobile && visible && event.key === 'Tab') {
          const controls = [...root.current.querySelectorAll('button, input, [tabindex]')].filter(element => element.tabIndex >= 0 && element.getClientRects().length && !element.disabled);
          const first = controls[0], last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
        if (event.key === "Escape") {
          event.preventDefault();
          closeSearch();
          requestAnimationFrame(() => trigger.current?.focus());
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
        className={`global-search-trigger flex h-10 w-10 items-center justify-center rounded-full transition ${visible ? "bg-emerald-50 text-brand dark:bg-zinc-800" : "text-zinc-500 hover:bg-emerald-50 hover:text-brand dark:hover:bg-zinc-800"}`}
      >
        {visible ? <X className="h-[18px] w-[18px]" /> : <Search className="h-[18px] w-[18px]" />}
      </button>
      <div
        id={`${id}-panel`}
        hidden={!visible}
        className="global-search-panel absolute left-4 right-4 top-full z-50 mt-2 rounded-2xl border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:left-auto sm:right-0 sm:w-[380px] sm:max-w-[calc(100vw-2rem)]"
      >
      <div className="global-search-header">
      {mobile && <button type="button" aria-label="Back from search" onClick={() => { closeSearch(); requestAnimationFrame(() => trigger.current?.focus()); }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"><ArrowLeft size={26} /></button>}
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
          enterKeyHint="search"
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
      </div>
      {mobile && !term && <div className="global-search-history">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Recent</h2>
          {(history.people.length > 0 || history.queries.length > 0) && <button type="button" onClick={() => setShowAllHistory(value => !value)} className="min-h-11 text-sm font-semibold text-zinc-500 dark:text-zinc-400">{showAllHistory ? 'Show less' : 'Show all'}</button>}
        </div>
        {history.people.length > 0 && <div className="mb-5 flex gap-4 overflow-x-auto pb-2" aria-label="Recently viewed profiles">
          {history.people.slice(0, showAllHistory ? 8 : 4).map(person => <button key={person._id} type="button" aria-label={`View ${person.name}`} onClick={() => select(person)} className="global-search-recent-person flex w-20 shrink-0 flex-col items-center gap-2 text-center">
            <Avatar person={person} /><span className="line-clamp-2 text-sm font-medium leading-5">{person.name}</span>
          </button>)}
        </div>}
        {history.queries.slice(0, showAllHistory ? 8 : 3).map(search => <button key={search} type="button" onClick={() => seeAll(search)} className="flex min-h-14 w-full items-center gap-4 py-3 text-left"><Clock3 size={23} className="shrink-0 text-zinc-500 dark:text-zinc-400" /><span className="truncate text-sm font-semibold">{search}</span></button>)}
        {!history.people.length && !history.queries.length && <p className="text-sm text-zinc-500 dark:text-zinc-400">Your recent searches and profiles will appear here.</p>}
        {showAllHistory && <button type="button" onClick={() => saveHistory(emptyHistory())} className="mt-3 min-h-11 text-sm font-medium text-brand">Clear recent searches</button>}
        <h2 className="mb-3 mt-7 text-lg font-semibold">Try searching for</h2>
        {['Alumni', 'Mentorship', 'Career opportunities'].map(search => <button key={search} type="button" onClick={() => seeAll(search)} className="flex min-h-14 w-full items-center gap-4 py-3 text-left"><Search size={23} className="shrink-0 text-zinc-500 dark:text-zinc-400" /><span className="text-sm font-medium">{search}</span></button>)}
      </div>}
      {expanded && (
        <div className="global-search-results mt-2 max-h-[min(60dvh,28rem)] overflow-y-auto text-zinc-900 dark:text-white">
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
  return mobile && visible ? createPortal(content, document.body) : content;
}
