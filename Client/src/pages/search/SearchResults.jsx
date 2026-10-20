import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, LoaderCircle, Bookmark } from "lucide-react";
import api from "../../utils/axios";
import { useAuth } from "../../context/useAuth";
import AlumniSidebar from "../../layout/sidebar/alumni/alumniSidebar";
import StudentSidebar from "../../layout/sidebar/student/studentSidebar";
import AdminSidebar from "../../layout/sidebar/admin/adminSidebar";
import AlumniTopbar from "../../layout/topbar/alumni/alumniTopbar";
import StudentTopbar from "../../layout/topbar/student/studentTopbar";
import AdminTopbar from "../../layout/topbar/alumni/adminTopbar";
import SearchPerson, {
  Avatar,
  Highlight,
} from "../../components/search/SearchPerson";
import { profilePath } from "../../components/search/searchLinks";

const categories = ["all", "people", "posts", "students", "alumni"];

function PostCard({ post, query }) {
  const [expanded, setExpanded] = useState(false);
  const author = post.authorProfileId
    ? profilePath({ _id: post.authorProfileId, role: post.authorRole })
    : null;
  return (
    <article className="rounded-2xl border border-brand/10 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center gap-3">
        <Avatar person={post} />
        <div className="min-w-0">
          {author ? (
            <Link className="font-semibold hover:underline" to={author}>
              <Highlight text={post.authorName} query={query} />
            </Link>
          ) : (
            <span className="font-semibold">
              {post.authorName || "AlumniLink member"}
            </span>
          )}
          <p className="text-xs capitalize text-zinc-500">
            {post.authorRole || "Member"} ·{" "}
            <time dateTime={post.createdAt}>
              {new Date(post.createdAt).toLocaleDateString()}
            </time>
          </p>
        </div>
      </div>
      <h3 className="mb-2 text-lg font-bold">
        <Highlight text={post.title} query={query} />
      </h3>
      <p
        className={`${expanded ? "" : "line-clamp-4"} whitespace-pre-wrap break-words text-sm leading-6 text-zinc-600 dark:text-zinc-300`}
      >
        <Highlight text={post.body} query={query} />
      </p>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        className="mt-2 text-sm font-semibold text-brand dark:text-brand"
      >
        {expanded ? "Show less" : "View full post"}
      </button>
      <div className="mt-3 flex flex-wrap gap-2">
        {post.tags?.map((tag, index) => (
          <span
            key={`${tag}-${index}`}
            className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-brand dark:bg-emerald-950 dark:text-brand"
          >
            #{tag}
          </span>
        ))}
      </div>
      <p className="mt-4 flex items-center gap-1 border-t border-zinc-100 pt-3 text-xs text-zinc-500 dark:border-zinc-800">
        <Bookmark className="h-3.5 w-3.5" />
        {post.savesCount} saves
      </p>
    </article>
  );
}

export default function SearchResults() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") || "";
  const category = categories.includes(params.get("category"))
    ? params.get("category")
    : "all";
  const sort = ["active", "newest"].includes(params.get("sort"))
    ? params.get("sort")
    : "relevant";
  const rawPage = Number(params.get("page") || 1);
  const page =
    Number.isInteger(rawPage) && rawPage > 0 && rawPage <= 1000 ? rawPage : 1;
  const requestKey = JSON.stringify([query, category, sort, page]);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(null);
  const [actionError, setActionError] = useState("");
  const data = response?.key === requestKey ? response.data : null;
  const currentError = error?.key === requestKey ? error.message : "";
  const loading = !!query.trim() && !data && !currentError;
  const Sidebar =
    user.role === "admin"
      ? AdminSidebar
      : user.role === "student"
        ? StudentSidebar
        : AlumniSidebar;
  const Topbar =
    user.role === "admin"
      ? AdminTopbar
      : user.role === "student"
        ? StudentTopbar
        : AlumniTopbar;

  useEffect(() => {
    if (!query.trim()) return;
    const controller = new AbortController();
    api
      .get("/search/all", {
        params: { q: query, category, sort, page },
        signal: controller.signal,
      })
      .then(({ data: result }) => {
        if (!controller.signal.aborted) {
          setResponse({ key: requestKey, data: result.data });
          setError(null);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setError({
            key: requestKey,
            message:
              err.response?.data?.message ||
              "Could not load search results. Please try again.",
          });
      });
    return () => controller.abort();
  }, [query, category, sort, page, requestKey, revision]);

  useEffect(() => {
    const refresh = () => {
      if (!document.hidden) setRevision((value) => value + 1);
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    next.delete("page");
    for (const [key, value] of Object.entries(changes))
      next.set(key, String(value));
    setParams(next);
    setActionError("");
  };
  const connect = async (person) => {
    setBusy(person._id);
    setActionError("");
    try {
      await api.post("/connections", { recipientAuthId: person.authId });
      setResponse((previous) =>
        previous
          ? {
              ...previous,
              data: {
                ...previous.data,
                people: {
                  ...previous.data.people,
                  items: previous.data.people.items.map((item) =>
                    item._id === person._id
                      ? {
                          ...item,
                          connectionStatus: "pending",
                          canConnect: false,
                        }
                      : item,
                  ),
                },
              },
            }
          : previous,
      );
    } catch (err) {
      setActionError(
        err.response?.data?.message || "Could not send connection request.",
      );
    } finally {
      setBusy(null);
      setRevision((value) => value + 1);
    }
  };
  const pages = Math.max(data?.people.pages || 0, data?.posts.pages || 0);
  const total = (data?.people.total || 0) + (data?.posts.total || 0);

  return (
    <div className="min-h-screen bg-[#f3f6f3] text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <Sidebar
        user={user}
        mobileOpen={sidebarOpen}
        setMobileOpen={setSidebarOpen}
      />
      <div className="lg:pl-64">
        <Topbar
          user={user}
          title="Search"
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="mx-auto max-w-5xl space-y-5 px-4 py-7 sm:px-6 workspace-page">
          <div className="workspace-page-header">
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-brand dark:text-brand">
              Your AlumniLink community
            </p>
            <h1 className="break-words text-2xl font-bold">
              {query.trim() ? (
                <>Results for “{query}”</>
              ) : (
                "Find your next connection"
              )}
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              Discover students, alumni, and career insights.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand/10 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
            <nav
              aria-label="Search categories"
              className="flex flex-wrap gap-2"
            >
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={category === item}
                  onClick={() => update({ category: item, sort: "relevant" })}
                  className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition ${category === item ? "bg-brand text-white" : "text-zinc-600 hover:bg-emerald-50 dark:text-zinc-300 dark:hover:bg-zinc-800"}`}
                >
                  {item}
                </button>
              ))}
            </nav>
            <label className="flex items-center gap-2 px-2 text-xs text-zinc-500">
              Sort by
              <select
                aria-label="Sort search results"
                value={sort}
                onChange={(event) => update({ sort: event.target.value })}
                className="max-w-full rounded-lg border border-zinc-200 bg-transparent p-2 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              >
                <option value="relevant">Most Relevant</option>
                {category !== "posts" && (
                  <option value="active">Recently Active</option>
                )}
                {["all", "posts"].includes(category) && (
                  <option value="newest">Newest Posts</option>
                )}
              </select>
            </label>
          </div>
          {actionError && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
            >
              {actionError}
            </p>
          )}
          {!query.trim() ? (
            <div className="py-16 text-center text-zinc-500">
              <Search className="mx-auto mb-4 h-10 w-10 text-brand" />
              <p>Type a name or keyword in the search bar above.</p>
            </div>
          ) : loading ? (
            <div
              role="status"
              className="flex items-center justify-center gap-2 py-20 text-zinc-500"
            >
              <LoaderCircle className="h-6 w-6 animate-spin" />
              Searching the community…
            </div>
          ) : currentError ? (
            <div
              role="alert"
              className="rounded-2xl bg-white p-8 text-center dark:bg-zinc-900"
            >
              <p>{currentError}</p>
              <button
                className="mt-3 font-semibold text-brand"
                onClick={() => {
                  setError(null);
                  setRevision((value) => value + 1);
                }}
              >
                Try again
              </button>
            </div>
          ) : (
            <>
              <p role="status" className="text-sm text-zinc-500">
                {total} {total === 1 ? "result" : "results"}
                {pages > 0 && ` · Page ${page} of ${pages}`}
              </p>
              {total === 0 ? (
                <div className="rounded-2xl bg-white p-10 text-center dark:bg-zinc-900">
                  <h2 className="font-semibold">
                    No matching {category === "all" ? "results" : category}{" "}
                    found
                  </h2>
                  <p className="mt-2 text-sm text-zinc-500">
                    Try a shorter name, another keyword, or a different
                    category.
                  </p>
                </div>
              ) : (
                <>
                  {!!data?.people.items.length && (
                    <section aria-labelledby="people-heading">
                      <h2
                        id="people-heading"
                        className="mb-3 text-lg font-bold"
                      >
                        {category === "students"
                          ? "Students"
                          : category === "alumni"
                            ? "Alumni"
                            : "People"}{" "}
                        <span className="text-sm font-normal text-zinc-500">
                          ({data.people.total})
                        </span>
                      </h2>
                      <div className="grid gap-4 sm:grid-cols-2">
                        {data.people.items.map((person) => (
                          <SearchPerson
                            key={person._id}
                            person={person}
                            query={query}
                            onConnect={connect}
                            busy={busy !== null}
                          />
                        ))}
                      </div>
                    </section>
                  )}
                  {!!data?.posts.items.length && (
                    <section aria-labelledby="posts-heading">
                      <h2 id="posts-heading" className="mb-3 text-lg font-bold">
                        Posts{" "}
                        <span className="text-sm font-normal text-zinc-500">
                          ({data.posts.total})
                        </span>
                      </h2>
                      <div className="space-y-4">
                        {data.posts.items.map((post) => (
                          <PostCard key={post._id} post={post} query={query} />
                        ))}
                      </div>
                    </section>
                  )}
                  {page > pages && (
                    <p className="py-8 text-center text-zinc-500">
                      This page has no results. Return to the first page.
                    </p>
                  )}
                  {(pages > 1 || page > 1) && (
                    <nav
                      aria-label="Search result pages"
                      className="flex flex-wrap items-center justify-center gap-4 py-5 text-sm"
                    >
                      <button
                        disabled={page <= 1}
                        onClick={() => update({ page: page - 1 })}
                        className="rounded-full border border-zinc-300 px-4 py-2 disabled:opacity-40"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => update({ page: 1 })}
                        className="text-brand dark:text-brand"
                      >
                        Page {page} · First page
                      </button>
                      <button
                        disabled={page >= pages || page >= 1000}
                        onClick={() => update({ page: page + 1 })}
                        className="rounded-full border border-zinc-300 px-4 py-2 disabled:opacity-40"
                      >
                        Next
                      </button>
                    </nav>
                  )}
                </>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
