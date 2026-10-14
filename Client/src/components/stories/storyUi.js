import { Award, Compass, Lightbulb } from "lucide-react";

export const STORY_TOPICS = [
  {
    key: "career_journey",
    label: "Career journeys",
    singular: "Career journey",
    icon: Compass,
    style:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    cover:
      "from-emerald-100 via-emerald-50 to-teal-100 dark:from-emerald-950 dark:via-zinc-900 dark:to-teal-950",
  },
  {
    key: "achievement",
    label: "Achievements",
    singular: "Professional achievement",
    icon: Award,
    style: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    cover:
      "from-amber-100 via-orange-50 to-yellow-100 dark:from-amber-950 dark:via-zinc-900 dark:to-orange-950",
  },
  {
    key: "advice",
    label: "Advice",
    singular: "Advice for students",
    icon: Lightbulb,
    style:
      "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    cover:
      "from-violet-100 via-purple-50 to-indigo-100 dark:from-violet-950 dark:via-zinc-900 dark:to-indigo-950",
  },
];
export const storyTopic = (post) =>
  STORY_TOPICS.find((topic) => topic.key === post.details?.story?.topic) || {
    ...STORY_TOPICS[0],
    singular: "Success story",
  };
export const storySections = (post) =>
  post.details?.story
    ? [
        ["Career journey", post.details.story.journey],
        ["Professional achievements", post.details.story.achievements],
        ["Advice for students", post.details.story.advice],
      ].filter(([, body]) => body)
    : [["The story", post.body]];
export const storyDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "Asia/Manila",
      })
    : "";
export const readingTime = (post) =>
  Math.max(1, Math.ceil((post.body || "").trim().split(/\s+/).length / 200));
export const card =
  "rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900";
export const primaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#009639] px-4 text-xs font-semibold text-white hover:bg-[#007a2e] disabled:cursor-not-allowed disabled:opacity-50";
export const secondaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800";
export const input =
  "mt-2 w-full min-w-0 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm outline-none focus:border-[#009639] focus:ring-2 focus:ring-[#009639]/10 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";
