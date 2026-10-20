import { createElement, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { AudienceSelect, FeedDialog } from "../feed/FeedComposer";
import api from "../../utils/axios";
import {
  POST_IMAGE_ACCEPT,
  removePostImage,
  uploadPostImage,
} from "../../utils/feedImages";
import { STORY_TOPICS, input, primaryButton, secondaryButton } from "./storyUi";

export default function StoryComposer({ onClose, onPublished }) {
  const [form, setForm] = useState({
    title: "",
    topic: "career_journey",
    journey: "",
    achievements: "",
    advice: "",
    audience: "public",
  });
  const [photo, setPhoto] = useState(null);
  const [photoAlt, setPhotoAlt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const uploadPending = useRef(false);
  const photoInput = useRef(null);
  const change = (key, value) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  const addPhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || uploadPending.current) return;
    uploadPending.current = true;
    setUploading(true);
    setError("");
    try {
      const asset = await uploadPostImage(file);
      setPhoto({ ...asset, preview: URL.createObjectURL(file) });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to upload the photo. Please try again.",
      );
    } finally {
      uploadPending.current = false;
      setUploading(false);
    }
  };
  const removePhoto = async () => {
    if (!photo || uploadPending.current) return;
    uploadPending.current = true;
    setUploading(true);
    setError("");
    try {
      await removePostImage(photo.id);
      URL.revokeObjectURL(photo.preview);
      setPhoto(null);
      setPhotoAlt("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to remove photo. Please try again.",
      );
    } finally {
      uploadPending.current = false;
      setUploading(false);
    }
  };
  const close = (published = false) => {
    if (photo) {
      URL.revokeObjectURL(photo.preview);
      if (!published) void removePostImage(photo.id).catch(() => {});
    }
    onClose();
  };
  const submit = async (event) => {
    event.preventDefault();
    if (pending.current || uploadPending.current) return;
    if (!form.title.trim()) {
      setError("Please enter a story title.");
      return;
    }
    const sections = [
      ["Career journey", form.journey],
      ["Professional achievements", form.achievements],
      ["Advice for students", form.advice],
    ].filter(([, value]) => value.trim());
    if (!sections.length) {
      setError(
        "Share your career journey, an achievement, or advice to begin your story.",
      );
      return;
    }
    const body = sections
      .map(([label, value]) => `${label}\n${value.trim()}`)
      .join("\n\n");
    if (body.length > 10000) {
      setError("Please keep your full story within 10,000 characters.");
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await api.post("/feed", {
        type: "story",
        audience: form.audience,
        title: form.title.trim(),
        body,
        details: {
          story: {
            topic: form.topic,
            journey: form.journey.trim(),
            achievements: form.achievements.trim(),
            advice: form.advice.trim(),
          },
        },
        images: photo ? [{ id: photo.id, alt: photoAlt.trim() }] : [],
      });
      onPublished(response.data.data);
      close(true);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to publish your story. Please try again.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <FeedDialog
      title="Share your success story"
      busy={busy || uploading}
      onClose={() => close()}
      wide
    >
      <p className="mb-5 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
        A first job, a hard-earned milestone, or a lesson learned. Your
        experience can help someone find their next step.
      </p>
      <form onSubmit={submit}>
        <fieldset disabled={busy || uploading} className="space-y-5">
          <div>
            <p className="mb-2 text-xs font-semibold">
              What is your story about?
            </p>
            <div className="grid grid-cols-3 gap-2">
              {STORY_TOPICS.map((topic) => (
                <button
                  key={topic.key}
                  type="button"
                  aria-pressed={form.topic === topic.key}
                  onClick={() => change("topic", topic.key)}
                  className={`flex min-w-0 flex-col items-center gap-2 rounded-xl border px-2 py-3 text-xs font-medium ${form.topic === topic.key ? `border-brand ${topic.style}` : "border-zinc-200 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"}`}
                >
                  {createElement(topic.icon, { size: 20 })}
                  {topic.label}
                </button>
              ))}
            </div>
          </div>
          <label className="block text-xs font-semibold">
            Story title *
            <input
              aria-label="Story title"
              required
              maxLength={200}
              value={form.title}
              onChange={(event) => change("title", event.target.value)}
              placeholder="Give your experience a memorable title"
              className={input}
            />
          </label>
          {[
            [
              "journey",
              "Career journey",
              "Where did you start? What challenges and turning points shaped your career?",
            ],
            [
              "achievements",
              "Professional achievements",
              "Share a milestone, meaningful project, recognition, or impact you are proud of.",
            ],
            [
              "advice",
              "Advice for students",
              "What do you wish you had known? Share practical advice with future graduates.",
            ],
          ].map(([key, label, prompt]) => (
            <label key={key} className="block text-xs font-semibold">
              {label}
              <textarea
                aria-label={label}
                value={form[key]}
                onChange={(event) => change(key, event.target.value)}
                rows={3}
                maxLength={5000}
                placeholder={prompt}
                className={`${input} leading-6`}
              />
            </label>
          ))}
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Complete any of the three sections, or tell your story through all
            of them.
          </p>
          <div className="rounded-xl border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
            <input
              ref={photoInput}
              type="file"
              accept={POST_IMAGE_ACCEPT}
              onChange={addPhoto}
              className="sr-only"
              aria-label="Add story cover photo"
            />
            {photo ? (
              <div className="space-y-3">
                <div className="relative">
                  <img
                    src={photo.preview}
                    alt={photoAlt || "Selected story cover"}
                    className="max-h-48 w-full rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    disabled={busy || uploading}
                    onClick={removePhoto}
                    aria-label="Remove story photo"
                    className="absolute right-2 top-2 rounded-full bg-black/60 p-2 text-white"
                  >
                    <X size={16} />
                  </button>
                </div>
                <label className="block text-xs font-medium">
                  Photo description
                  <input
                    aria-label="Story photo description"
                    maxLength={300}
                    value={photoAlt}
                    onChange={(event) => setPhotoAlt(event.target.value)}
                    className={input}
                  />
                </label>
              </div>
            ) : (
              <button
                type="button"
                disabled={busy || uploading}
                onClick={() => photoInput.current?.click()}
                className="flex min-h-10 items-center gap-2 text-xs font-semibold text-brand dark:text-brand"
              >
                <ImagePlus size={18} />
                Add a cover photo{" "}
                <span className="font-normal text-zinc-400">(optional)</span>
              </button>
            )}
          </div>
          <div>
            <AudienceSelect
              value={form.audience}
              onChange={(value) => change("audience", value)}
            />
            <p className="mt-2 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
              Choose Public so students and alumni across the portal can read
              your story.
            </p>
          </div>
          {uploading && (
            <p role="status" className="text-xs text-zinc-500">
              Updating your photo…
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => close()}
              className={secondaryButton}
            >
              Cancel
            </button>
            <button type="submit" className={primaryButton}>
              {busy ? "Publishing…" : "Publish story"}
            </button>
          </div>
        </fieldset>
      </form>
    </FeedDialog>
  );
}
