import { lazy, Suspense } from "react";

const EmojiPicker = lazy(() => import("emoji-picker-react"));

export default function LazyEmojiPicker(props) {
  return <Suspense fallback={<div role="status" className="p-4 text-sm">Loading emojis…</div>}><EmojiPicker {...props} /></Suspense>;
}
