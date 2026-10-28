import { createElement, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  PenLine,
  RefreshCw,
  Search,
  Trophy,
} from "lucide-react";
import { useAuth } from "../../context/useAuth";
import { getSocket } from "../../realtime/socket";
import api from "../../utils/axios";
import { postImageUrl } from "../../utils/feedImages";
import ProfileAvatar from "../profile/ProfileAvatar";
import StoryComposer from "./StoryComposer";
import StoryReader from "./StoryReader";
import PageTitle from "../ui/PageTitle";
import "./SuccessStoriesBoard.css";
import {
  STORY_TOPICS,
  card,
  primaryButton,
  readingTime,
  secondaryButton,
  storyDate,
  storySections,
  storyTopic,
} from "./storyUi";

function StoryCover({ post }) {
  const [failed, setFailed] = useState(false);
  const topic = storyTopic(post);
  const photo = post.images?.[0];
  return (
    <div
      className={`story-cover relative flex h-40 items-center justify-center overflow-hidden bg-gradient-to-br ${topic.cover}`}
      aria-hidden="true"
    >
      <div className="absolute -bottom-12 -left-10 h-48 w-48 rounded-full border-[24px] border-white/30 dark:border-white/5" />
      <div className="absolute -right-5 -top-12 h-40 w-40 rounded-full border border-white/70 dark:border-white/10" />
      <span
        className={`relative flex h-20 w-20 items-center justify-center rounded-2xl bg-white/65 shadow-sm dark:bg-zinc-900/60 ${topic.style}`}
      >
        {createElement(topic.icon, { size: 36, strokeWidth: 1.4 })}
      </span>
      {photo && !failed && (
        <img
          src={postImageUrl(photo)}
          onError={() => setFailed(true)}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </div>
  );
}

export default function SuccessStoriesBoard() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const storyId = params.get("story");
  const canPublish = ["alumni", "admin"].includes(user?.role);
  const [filters, setFilters] = useState({
    topic: "all",
    mine: "false",
    q: "",
  });
  const [query, setQuery] = useState("");
  const [posts, setPosts] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [restricted, setRestricted] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [notice, setNotice] = useState("");
  const [readerPost, setReaderPost] = useState(null);
  const [readerLoading, setReaderLoading] = useState(false);
  const [readerError, setReaderError] = useState("");
  const [readerAttempt, setReaderAttempt] = useState(0);
  const generation = useRef(0);
  const pages = useRef(1);
  const morePending = useRef(false);
  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const participation = await api.get("/feed/status");
      let nextPosts = [],
        nextCursor = null;
      for (let page = 0; page < pages.current; page++) {
        const response = await api.get("/feed/stories", {
          params: {
            ...filters,
            limit: 12,
            ...(nextCursor ? { before: nextCursor } : {}),
          },
        });
        nextPosts.push(...response.data.data.posts);
        nextCursor = response.data.data.nextCursor;
        if (!nextCursor) break;
      }
      if (request !== generation.current) return;
      setPosts(nextPosts);
      setCursor(nextCursor);
      setRestricted(!!participation.data.data.restricted);
    } catch (err) {
      if (request === generation.current) {
        setError(
          err.response?.data?.message ||
            "Unable to load success stories. Please retry.",
        );
        if ([403, 404].includes(err.response?.status)) setPosts([]);
      }
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [filters]);
  useEffect(() => {
    pages.current = 1;
    void load();
    const socket = getSocket();
    let timer;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void load();
        setReaderAttempt((previous) => previous + 1);
      }, 150);
    };
    socket.on("feed:changed", refresh);
    socket.on("connect", refresh);
    return () => {
      ++generation.current;
      clearTimeout(timer);
      socket.off("feed:changed", refresh);
      socket.off("connect", refresh);
    };
  }, [load, user?.authId]);
  useEffect(() => {
    if (!storyId) return;
    let active = true;
    const read = async () => {
      setReaderLoading(true);
      setReaderError("");
      setReaderPost(null);
      try {
        const response = await api.get(`/feed/${storyId}`);
        if (
          response.data.data.type !== "story" ||
          response.data.data.originalPost
        )
          throw new Error("This link is not an original success story.");
        if (active) setReaderPost(response.data.data);
      } catch (err) {
        if (active)
          setReaderError(
            err.response?.data?.message ||
              err.message ||
              "Story unavailable. Please try again.",
          );
      } finally {
        if (active) setReaderLoading(false);
      }
    };
    void read();
    return () => {
      active = false;
    };
  }, [storyId, readerAttempt, user?.authId]);
  const open = (id) => {
    const next = new URLSearchParams(params);
    next.set("story", id);
    setParams(next);
  };
  const close = () => {
    const next = new URLSearchParams(params);
    next.delete("story");
    setParams(next);
  };
  const more = async () => {
    if (!cursor || morePending.current) return;
    morePending.current = true;
    setLoadingMore(true);
    const request = generation.current;
    try {
      const response = await api.get("/feed/stories", {
        params: { ...filters, limit: 12, before: cursor },
      });
      if (request !== generation.current) return;
      setPosts((previous) => [
        ...previous,
        ...response.data.data.posts.filter(
          (post) => !previous.some((item) => item._id === post._id),
        ),
      ]);
      setCursor(response.data.data.nextCursor);
      pages.current++;
    } catch (err) {
      if (request === generation.current)
        setError(err.response?.data?.message || "Unable to load more stories.");
    } finally {
      morePending.current = false;
      setLoadingMore(false);
    }
  };
  const change = (key, value) =>
    setFilters((previous) => ({ ...previous, [key]: value }));
  const published = () => {
    setNotice(
      "Your story is published. Thank you for sharing your experience.",
    );
    pages.current = 1;
    void load();
  };
  const saved = (post) => {
    setNotice("Your story has been updated.");
    setReaderPost(post);
    setReaderAttempt((previous) => previous + 1);
    void load();
  };
  return (
    <section
      aria-label="Alumni success stories"
      className={`${user?.role === "student" ? "student-success-stories " : ""}space-y-6 font-sans text-zinc-900 [&_dialog]:font-sans dark:text-zinc-100`}
    >
      <header className="workspace-page-header flex flex-wrap items-start justify-between gap-4"><div><PageTitle icon={Trophy}>Success stories</PageTitle><p className="mt-2 max-w-2xl">Discover alumni journeys, milestones, and lessons for your future.</p></div>{canPublish && <button type="button" disabled={restricted} onClick={() => setComposerOpen(true)} className={primaryButton}><PenLine size={16} />Share your story</button>}</header>
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 p-4 text-sm text-brand dark:bg-emerald-950 dark:text-brand"
        >
          {notice}
        </p>
      )}
      {canPublish && restricted && !loading && !error && (
        <p
          role="status"
          className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300"
        >
          Your feed participation is restricted. You can still read available
          stories.
        </p>
      )}
      <section className={`${card} story-filters p-4`} aria-label="Story filters">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav
            aria-label="Story topics"
            className="flex max-w-full gap-2 overflow-x-auto"
          >
            {[{ key: "all", label: "All stories" }, ...STORY_TOPICS].map(
              (topic) => (
                <button
                  key={topic.key}
                  type="button"
                  aria-pressed={filters.topic === topic.key}
                  onClick={() => change("topic", topic.key)}
                  className={`shrink-0 rounded-lg px-3 py-2.5 text-xs font-semibold ${filters.topic === topic.key ? "bg-brand/10 text-brand dark:bg-emerald-950 dark:text-brand" : "text-zinc-500 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800"}`}
                >
                  {topic.label}
                </button>
              ),
            )}
          </nav>
          {canPublish && (
            <button
              type="button"
              aria-pressed={filters.mine === "true"}
              onClick={() =>
                change("mine", filters.mine === "true" ? "false" : "true")
              }
              className={`${secondaryButton} !min-h-9 ${filters.mine === "true" ? "!border-brand !text-brand dark:!text-brand" : ""}`}
            >
              My stories
            </button>
          )}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            change("q", query.trim());
          }}
          className="story-search-form mt-4 flex gap-2"
        >
          <div className="relative min-w-0 flex-1">
            <Search
              size={16}
              className="absolute left-3 top-3.5 text-zinc-400"
            />
            <input
              type="search"
              aria-label="Search success stories"
              maxLength={200}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search a story title or keyword"
              className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-xs outline-none focus:border-brand dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>
          <button type="submit" className={secondaryButton}>
            Search
          </button>
          <button
            type="button"
            aria-label="Refresh stories"
            title="Refresh stories"
            disabled={loading}
            onClick={load}
            className={`${secondaryButton} !px-3`}
          >
            <RefreshCw size={15} />
          </button>
        </form>
      </section>
      {error && (
        <p
          role="alert"
          className={`${card} p-4 text-sm text-red-600 dark:text-red-400`}
        >
          {error}{" "}
          <button type="button" onClick={load} className="underline">
            Retry
          </button>
        </p>
      )}
      {loading ? (
        <p
          role="status"
          className={`${card} p-12 text-center text-sm text-zinc-500 dark:text-zinc-400`}
        >
          Loading alumni stories…
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">
              {filters.mine === "true"
                ? "Stories you have shared"
                : "Stories from our alumni"}
            </h2>
            <p
              role="status"
              className="text-xs text-zinc-500 dark:text-zinc-400"
            >
              {posts.length} stories{cursor && " loaded"}
            </p>
          </div>
          {!posts.length && !error && (
            <div className={`${card} py-12 text-center`}>
              <BookOpen
                size={32}
                className="mx-auto text-zinc-300 dark:text-zinc-600"
              />
              <h3 className="mt-4 text-base font-semibold">
                {filters.mine === "true"
                  ? "Your story could inspire someone"
                  : "No stories found"}
              </h3>
              <p className="mt-2 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
                {filters.q || filters.topic !== "all"
                  ? "Try another keyword or topic."
                  : "Alumni stories will appear here as they are shared."}
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setFilters({ topic: "all", mine: "false", q: "" });
                }}
                className={`${secondaryButton} mt-5`}
              >
                Browse all stories
              </button>
            </div>
          )}
          <div className="story-gallery grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {posts.map((post) => (
              <article
                key={post._id}
                data-success-story={post._id}
                className={`${card} story-gallery-card group flex min-w-0 flex-col overflow-hidden transition hover:border-zinc-300 hover:shadow-sm dark:hover:border-zinc-700`}
              >
                <button
                  type="button"
                  onClick={() => open(post._id)}
                  aria-label={`Read ${post.title}`}
                  className="text-left"
                >
                  <StoryCover post={post} />
                </button>
                <div className="story-card-body flex flex-1 flex-col p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${storyTopic(post).style}`}
                    >
                      {storyTopic(post).singular}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400">
                      <BookOpen size={12} />
                      {readingTime(post)} min read
                    </span>
                  </div>
                  <h3 className="story-card-title mt-3 break-words text-lg font-semibold leading-6 tracking-tight">
                    <button
                      type="button"
                      onClick={() => open(post._id)}
                      className="text-left hover:text-brand dark:hover:text-brand"
                    >
                      {post.title}
                    </button>
                  </h3>
                  <p className="story-excerpt mb-5 mt-3 line-clamp-3 break-words text-xs leading-6 text-zinc-500 dark:text-zinc-400">
                    {storySections(post)[0]?.[1]}
                  </p>
                  <div className="mt-auto">
                    <div className="story-author flex items-center gap-2.5 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-50 text-brand dark:bg-emerald-950">
                        <ProfileAvatar user={post.author} />
                      </span>
                      <div className="min-w-0">
                        <p className="break-words text-xs font-semibold">
                          {post.author?.name || "Alumni community member"}
                        </p>
                        <p className="mt-1 text-[10px] text-zinc-400">
                          {post.author?.batch &&
                            `Batch ${post.author.batch} · `}
                          {storyDate(post.createdAt)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => open(post._id)}
                      className="story-read-button mt-4 inline-flex min-h-9 items-center gap-2 text-xs font-semibold text-brand dark:text-brand"
                    >
                      Read story
                      <ArrowRight size={15} />
                    </button>
                    {post.isMine && canPublish && !restricted && (
                      <button
                        type="button"
                        onClick={() => setEditingPost(post)}
                        className="ml-4 mt-4 inline-flex min-h-9 items-center gap-2 text-xs font-semibold text-zinc-600 hover:text-brand dark:text-zinc-300"
                      >
                        <PenLine size={15} />
                        Edit story
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
          {cursor && (
            <button
              type="button"
              disabled={loadingMore}
              onClick={more}
              className={`${secondaryButton} w-full`}
            >
              {loadingMore ? "Loading…" : "Load more stories"}
            </button>
          )}
        </>
      )}
      {composerOpen && canPublish && !restricted && (
        <StoryComposer
          onClose={() => setComposerOpen(false)}
          onPublished={published}
        />
      )}
      {editingPost && canPublish && !restricted && (
        <StoryComposer
          key={editingPost._id}
          post={editingPost}
          onClose={() => setEditingPost(null)}
          onPublished={saved}
        />
      )}
      {storyId && !editingPost && (
        <StoryReader
          key={storyId}
          post={readerPost?._id === storyId ? readerPost : null}
          loading={
            readerLoading || (!readerError && readerPost?._id !== storyId)
          }
          error={readerError}
          onRetry={() => setReaderAttempt((previous) => previous + 1)}
          onClose={close}
          isAdmin={user?.role === "admin"}
          onEdit={canPublish && !restricted ? setEditingPost : undefined}
          onDeleted={(id) => {
            setPosts((previous) => previous.filter((post) => post._id !== id));
            setNotice("Story deleted.");
          }}
        />
      )}
    </section>
  );
}
