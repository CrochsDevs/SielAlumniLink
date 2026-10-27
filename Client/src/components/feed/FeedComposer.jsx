import ProgressBar from "../ui/progress-bar";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Briefcase,
  CalendarDays,
  Globe,
  HandHeart,
  ImagePlus,
  ImageUp,
  Smile,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import api from "../../utils/axios";
import ProfileAvatar from "../profile/ProfileAvatar";
import {
  MAX_POST_IMAGES,
  removePostImage,
  uploadPostImage,
  validatePostImage,
} from "../../utils/feedImages";
import PostImageDropzone from "./PostImageDropzone";

const kinds = [
  {
    type: "referral",
    label: "Referral",
    Icon: HandHeart,
    path: "/alumni/referral",
  },
  { type: "hiring", label: "Hiring", Icon: Briefcase, path: "/alumni/career" },
  { type: "event", label: "Event", Icon: CalendarDays, path: "/alumni/events" },
  { type: "story", label: "Success story", Icon: Sparkles },
];
const fieldClass =
  "w-full rounded-xl border border-zinc-300 bg-white p-3 text-sm text-zinc-900 outline-none focus:border-brand dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

export function AudienceSelect({
  value,
  onChange,
  privateOnly = false,
  compact = false,
  disabled = false,
}) {
  if (compact)
    return (
      <label
        title={
          value === "public"
            ? "All users in the portal can see this post"
            : "Only your accepted connections can see this post"
        }
        className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-zinc-300 px-2.5 py-1 text-xs font-semibold text-zinc-600 dark:border-zinc-600 dark:text-zinc-300"
      >
        {value === "public" ? (
          <Globe size={14} aria-hidden="true" />
        ) : (
          <Users size={14} aria-hidden="true" />
        )}
        <select
          aria-label="Post audience"
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="max-w-full cursor-pointer bg-transparent pr-1 outline-none disabled:opacity-50 dark:[&>option]:bg-zinc-900"
        >
          {!privateOnly && <option value="public">Anyone</option>}
          <option value="connections">Connections only</option>
        </select>
      </label>
    );
  return (
    <label className="flex flex-wrap items-center gap-2 text-sm">
      Who can see this?
      <select
        aria-label="Post audience"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={fieldClass + " !w-auto max-w-full !p-2"}
      >
        {!privateOnly && <option value="public">Public · All users</option>}
        <option value="connections">Connections only</option>
      </select>
    </label>
  );
}

export function FeedDialog({
  title,
  onClose,
  children,
  busy = false,
  composer = false,
  header,
  wide = false,
  className = "",
}) {
  const ref = useRef(null);
  const titleId = useId();
  useLayoutEffect(() => {
    const dialog = ref.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      data-post-composer={composer ? "" : undefined}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      className={`m-auto max-h-[94dvh] w-[calc(100%-1rem)] overflow-y-auto overscroll-contain bg-white text-zinc-900 shadow-xl backdrop:bg-black/60 sm:w-[calc(100%-2rem)] dark:bg-zinc-900 dark:text-zinc-100 ${composer ? "max-w-2xl rounded-xl p-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden" : `${wide ? "max-w-3xl" : "max-w-xl"} rounded-2xl p-4 sm:p-5`} ${className}`}
    >
      <div
        className={
          composer
            ? "sticky top-0 z-20 flex items-start justify-between gap-3 bg-white px-5 pb-3 pt-5 sm:px-6 dark:bg-zinc-900"
            : "mb-4 flex items-center justify-between gap-3"
        }
      >
        <h2 id={titleId} className={header ? "sr-only" : "text-lg font-bold"}>
          {title}
        </h2>
        {header}
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          aria-label="Close dialog"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export default function FeedComposer({
  user,
  defaultType = "update",
  fixedType,
  onPublished,
}) {
  const navigate = useNavigate();
  const [type, setType] = useState(null);
  const [draft, setDraft] = useState({
    title: "",
    body: "",
    audience: "public",
    details: {},
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [photos, setPhotos] = useState([]);
  const [showMedia, setShowMedia] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const pending = useRef(false);
  const postText = useRef(null);
  const imagePicker = useRef(null);
  const nextCaret = useRef(null);
  const previewUrls = useRef(new Set());
  const activeUploads = useRef(new Set());
  const uploading = photos.some(
    (photo) =>
      photo.status === "uploading" ||
      photo.status === "queued" ||
      photo.status === "removing",
  );
  const unreadyPhotos = photos.some(
    (photo) => !photo.asset || photo.status === "removing",
  );
  useEffect(() => {
    const urls = previewUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);
  useLayoutEffect(() => {
    const textarea = postText.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight + 2}px`;
    if (nextCaret.current !== null) {
      textarea.focus();
      textarea.setSelectionRange(nextCaret.current, nextCaret.current);
      nextCaret.current = null;
    }
  }, [draft.body, type]);
  const open = (next, media = false) => {
    setType(next);
    setShowMedia(media || photos.length > 0);
    setShowEmoji(false);
    setError("");
  };
  const addEmoji = (emoji) => {
    const start = postText.current?.selectionStart ?? draft.body.length;
    const end = postText.current?.selectionEnd ?? start;
    const body = draft.body.slice(0, start) + emoji + draft.body.slice(end);
    if (body.length > 10000) {
      setError("Post must be at most 10000 characters");
      return;
    }
    nextCaret.current = start + emoji.length;
    setDraft((prev) => ({ ...prev, body }));
    setShowEmoji(false);
  };
  const detail = (key, value) =>
    setDraft((prev) => ({
      ...prev,
      details: { ...prev.details, [key]: value },
    }));
  const uploadPhoto = async (photo) => {
    if (activeUploads.current.has(photo.key)) return;
    activeUploads.current.add(photo.key);
    setPhotos((prev) =>
      prev.map((item) =>
        item.key === photo.key
          ? { ...item, status: "uploading", percent: 0, error: "" }
          : item,
      ),
    );
    try {
      const asset = await uploadPostImage(photo.file, (percent) =>
        setPhotos((prev) =>
          prev.map((item) =>
            item.key === photo.key
              ? { ...item, percent: Math.min(percent, 100) }
              : item,
          ),
        ),
      );
      setPhotos((prev) =>
        prev.map((item) =>
          item.key === photo.key
            ? { ...item, asset, status: "uploaded", percent: 100 }
            : item,
        ),
      );
    } catch (err) {
      setPhotos((prev) =>
        prev.map((item) =>
          item.key === photo.key
            ? {
                ...item,
                status: "failed",
                error:
                  err.response?.data?.message ||
                  err.message ||
                  "Photo upload failed.",
              }
            : item,
        ),
      );
    } finally {
      activeUploads.current.delete(photo.key);
    }
  };
  const addPhotos = async (selectedFiles) => {
    const files = Array.from(selectedFiles || []);
    if (!files.length) return;
    setShowMedia(true);
    try {
      if (photos.length + files.length > MAX_POST_IMAGES)
        throw new Error(
          `You can attach up to ${MAX_POST_IMAGES} photos per post.`,
        );
      files.forEach(validatePostImage);
      const additions = files.map((file) => {
        const preview = URL.createObjectURL(file);
        previewUrls.current.add(preview);
        return {
          key: crypto.randomUUID(),
          file,
          preview,
          alt: "",
          status: "queued",
          percent: 0,
        };
      });
      setPhotos((prev) => [...prev, ...additions]);
      setError("");
      // Upload immediately on selection. Publishing only attaches completed uploads.
      for (const photo of additions) await uploadPhoto(photo);
    } catch (err) {
      setError(err.message);
    }
  };
  const removePhoto = async (key) => {
    const photo = photos.find((item) => item.key === key);
    if (!photo || ["uploading", "queued", "removing"].includes(photo.status))
      return;
    if (photo.asset) {
      setPhotos((prev) =>
        prev.map((item) =>
          item.key === key ? { ...item, status: "removing" } : item,
        ),
      );
      try {
        await removePostImage(photo.asset.id);
      } catch (err) {
        setPhotos((prev) =>
          prev.map((item) =>
            item.key === key ? { ...item, status: "uploaded" } : item,
          ),
        );
        setError(
          err.response?.data?.message ||
            "Unable to remove photo. Please try again.",
        );
        return;
      }
    }
    if (photo) {
      URL.revokeObjectURL(photo.preview);
      previewUrls.current.delete(photo.preview);
    }
    setPhotos((prev) => prev.filter((item) => item.key !== key));
  };
  const publish = async (e) => {
    e.preventDefault();
    if (pending.current || uploading || unreadyPhotos) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const images = photos.map((photo) => ({
        id: photo.asset.id,
        alt: photo.alt,
      }));
      const details = { ...draft.details };
      if (type === "event") {
        details.startAt = new Date(details.startAt).toISOString();
        details.endAt = details.endAt
          ? new Date(details.endAt).toISOString()
          : null;
      }
      const res = await api.post("/feed", { ...draft, type, details, images });
      setDraft({ title: "", body: "", audience: "public", details: {} });
      previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrls.current.clear();
      setPhotos([]);
      setType(null);
      onPublished(res.data.data);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to publish. Please try again.",
      );
    } finally {
      setBusy(false);
      pending.current = false;
    }
  };
  return (
    <>
      <div className="rounded-2xl border border-brand/10 bg-white p-3 shadow-sm dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-50 text-brand">
            <ProfileAvatar user={user} fallback="A" />
          </div>
          <button
            type="button"
            onClick={() => open(defaultType)}
            className="min-w-0 flex-1 rounded-2xl border border-zinc-300 px-3 py-3 text-left text-sm text-zinc-500 hover:border-brand sm:px-4 dark:border-zinc-700 dark:text-zinc-400"
          >
            {defaultType === "story"
              ? "Share your success story and inspire others…"
              : defaultType === "event"
                ? "Share an event with your network…"
                : "Share an update with your network…"}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => open(defaultType, true)}
            className="flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-xs font-semibold text-zinc-600 hover:bg-emerald-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <ImagePlus size={18} className="text-brand" />
            Photo
          </button>
          {kinds
            .filter((kind) => !fixedType || kind.type === fixedType)
            .map((kind) => (
              <button
                key={kind.type}
                type="button"
                onClick={() =>
                  kind.path && fixedType !== kind.type && user?.role !== "admin"
                    ? navigate(kind.path)
                    : open(kind.type)
                }
                className="flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-xs font-semibold text-zinc-600 hover:bg-emerald-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <kind.Icon size={16} className="text-brand" />
                {kind.label}
              </button>
            ))}
        </div>
      </div>
      {type && (
        <FeedDialog
          composer
          title="Create a post"
          busy={busy}
          onClose={() => setType(null)}
          header={
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-100 text-lg font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-200">
                <ProfileAvatar user={user} fallback="A" />
              </span>
              <div className="min-w-0">
                <p className="mb-1 truncate text-base font-semibold sm:text-lg">
                  {user?.name || "Alumni"}
                </p>
                <AudienceSelect
                  compact
                  disabled={busy}
                  value={draft.audience}
                  onChange={(audience) =>
                    setDraft((prev) => ({ ...prev, audience }))
                  }
                />
              </div>
            </div>
          }
        >
          <form onSubmit={publish}>
            <fieldset disabled={busy} className="min-w-0">
              <div className="space-y-4 px-5 pb-6 pt-3 sm:px-6">
                {type !== "update" && (
                  <label className="block text-sm">
                    {type === "story" ? "Story title" : "Title"}
                    <input
                      required
                      maxLength={200}
                      value={draft.title}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, title: e.target.value }))
                      }
                      className={fieldClass}
                    />
                  </label>
                )}
                <label className="block">
                  <span className="sr-only">
                    {type === "story" ? "Your success story" : "Post details"}
                  </span>
                  <textarea
                    ref={postText}
                    autoFocus
                    required={type !== "update" || photos.length === 0}
                    maxLength={10000}
                    rows={6}
                    value={draft.body}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, body: e.target.value }))
                    }
                    placeholder={
                      type === "story"
                        ? "Share your journey and inspire your network…"
                        : "What do you want to talk about?"
                    }
                    className="min-h-[200px] w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-lg leading-8 text-zinc-900 outline-none placeholder:text-zinc-500 dark:text-zinc-100 dark:placeholder:text-zinc-400"
                  />
                </label>
                <div
                  className={
                    showMedia || photos.length ? "space-y-3" : "hidden"
                  }
                >
                  <PostImageDropzone
                    inputRef={imagePicker}
                    onFilesSelect={addPhotos}
                    count={photos.length}
                    maxImages={MAX_POST_IMAGES}
                    disabled={busy || photos.length >= MAX_POST_IMAGES}
                  />
                  {photos.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {photos.map((photo, index) => (
                        <div key={photo.key} className="min-w-0">
                          <div className="relative aspect-square overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800">
                            <img
                              src={photo.preview}
                              alt={photo.alt || `Selected photo ${index + 1}`}
                              className="h-full w-full object-cover"
                            />
                            <button
                              type="button"
                              disabled={[
                                "uploading",
                                "queued",
                                "removing",
                              ].includes(photo.status)}
                              onClick={() => removePhoto(photo.key)}
                              aria-label={`Remove photo ${index + 1}`}
                              className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black disabled:opacity-40"
                            >
                              <X size={18} />
                            </button>
                          </div>
                          <div
                            aria-live="polite"
                            className="mt-1 text-xs text-zinc-500"
                          >
                            {photo.status === "queued" && "Waiting to upload…"}
                            {photo.status === "uploading" && (
                              <>
                                <span>Uploading… {photo.percent}%</span>
                                <ProgressBar value={photo.percent} label="Photo upload progress" className="mt-2" />
                              </>
                            )}
                            {photo.status === "uploaded" && "Photo ready"}
                            {photo.status === "removing" && "Removing photo…"}
                            {photo.status === "failed" && (
                              <>
                                <p role="alert" className="text-red-600">
                                  {photo.error}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => uploadPhoto(photo)}
                                  className="min-h-11 font-bold text-brand underline"
                                >
                                  Retry upload
                                </button>
                              </>
                            )}
                          </div>
                          <label className="mt-2 block text-xs text-zinc-500">
                            Photo {index + 1} description
                            <input
                              maxLength={300}
                              value={photo.alt}
                              onChange={(e) =>
                                setPhotos((prev) =>
                                  prev.map((item) =>
                                    item.key === photo.key
                                      ? { ...item, alt: e.target.value }
                                      : item,
                                  ),
                                )
                              }
                              placeholder="Describe this photo"
                              className="mt-1 w-full rounded-lg border border-zinc-300 bg-transparent p-2 text-xs text-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {["referral", "hiring"].includes(type) && (
                  <label className="block text-sm">
                    Company or organization
                    <input
                      required
                      maxLength={200}
                      value={draft.details.organization || ""}
                      onChange={(e) => detail("organization", e.target.value)}
                      className={fieldClass}
                    />
                  </label>
                )}
                {["referral", "hiring", "event"].includes(type) && (
                  <>
                    <label className="block text-sm">
                      Location
                      {type === "event" ? " (or online meeting venue)" : ""}
                      <input
                        required={type === "event"}
                        maxLength={200}
                        value={draft.details.location || ""}
                        onChange={(e) => detail("location", e.target.value)}
                        className={fieldClass}
                      />
                    </label>
                    <label className="block text-sm">
                      {type === "event"
                        ? "Registration link (optional)"
                        : "Application or opportunity link (optional)"}
                      <input
                        type="url"
                        placeholder="https://"
                        maxLength={2000}
                        value={draft.details.link || ""}
                        onChange={(e) => detail("link", e.target.value)}
                        className={fieldClass}
                      />
                    </label>
                  </>
                )}
                {type === "event" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm">
                      Starts at (your local time)
                      <input
                        type="datetime-local"
                        required
                        value={draft.details.startAt || ""}
                        onChange={(e) => detail("startAt", e.target.value)}
                        className={fieldClass}
                      />
                    </label>
                    <label className="text-sm">
                      Ends at (optional)
                      <input
                        type="datetime-local"
                        value={draft.details.endAt || ""}
                        onChange={(e) => detail("endAt", e.target.value)}
                        className={fieldClass}
                      />
                    </label>
                  </div>
                )}
                {error && (
                  <p role="alert" className="text-sm text-red-600">
                    {error}
                  </p>
                )}
                {showEmoji && (
                  <div
                    aria-label="Choose an emoji"
                    className="flex flex-wrap gap-1 rounded-xl border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-800"
                  >
                    {[
                      "😀",
                      "👏",
                      "🎉",
                      "💡",
                      "❤️",
                      "🚀",
                      "🎓",
                      "🙌",
                      "😊",
                      "🤝",
                      "💼",
                      "✨",
                    ].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => addEmoji(emoji)}
                        aria-label={`Insert ${emoji}`}
                        className="flex h-11 w-11 items-center justify-center rounded-lg text-2xl hover:bg-zinc-200 dark:hover:bg-zinc-700"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="sticky bottom-0 z-10 bg-white px-5 pb-4 pt-2 sm:px-6 dark:bg-zinc-900">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={photos.length >= MAX_POST_IMAGES}
                      onClick={() => {
                        setShowMedia(true);
                        imagePicker.current?.click();
                      }}
                      aria-label="Add photos"
                      aria-expanded={showMedia || photos.length > 0}
                      title="Add photos"
                      className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    >
                      <ImageUp size={24} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowEmoji((prev) => !prev)}
                      aria-label="Add emoji"
                      aria-expanded={showEmoji}
                      title="Add emoji"
                      className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    >
                      <Smile size={24} />
                    </button>
                  </div>
                  {!fixedType && (
                    <label className="max-w-full">
                      <span className="sr-only">Post type</span>
                      <select
                        aria-label="Post type"
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                        className="max-w-full rounded-full border border-zinc-200 bg-transparent px-3 py-2 text-xs font-semibold text-zinc-600 outline-none dark:border-zinc-700 dark:text-zinc-300 dark:[&>option]:bg-zinc-900"
                      >
                        <option value="update">Update</option>
                        <option value="story">Success story</option>
                        {user?.role === "admin" && (
                          <>
                            <option value="referral">Referral</option>
                            <option value="hiring">Hiring</option>
                            <option value="event">Event</option>
                          </>
                        )}
                      </select>
                    </label>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
                  <p className="min-w-0 text-xs text-zinc-500 dark:text-zinc-400">
                    {uploading
                      ? "Uploading photos…"
                      : draft.audience === "public"
                        ? "Visible to anyone"
                        : "Visible to your connections"}
                  </p>
                  <button
                    disabled={
                      busy ||
                      uploading ||
                      unreadyPhotos ||
                      (!draft.body.trim() &&
                        (type !== "update" || photos.length === 0))
                    }
                    className="min-h-10 shrink-0 rounded-full bg-[#0a66c2] px-6 py-2 text-sm font-semibold text-white transition hover:bg-[#004182] disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
                  >
                    {busy ? "Posting…" : "Post"}
                  </button>
                </div>
              </div>
            </fieldset>
          </form>
        </FeedDialog>
      )}
    </>
  );
}
