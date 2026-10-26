import { useState } from "react";
import Swal from "sweetalert2";
import {
  Pencil,
  Trash2,
  Check,
  X,
  FileText,
  Download,
  Phone,
  PhoneMissed,
  Video,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Bubble, BubbleContent } from "../ui/bubble";

const sharedPostId = (text) => {
  const match = /^Shared a post: (https?:\/\/\S+)$/.exec(text || "");
  if (!match) return null;
  try {
    const url = new URL(match[1]);
    const id = url.searchParams.get("post");
    return url.origin === window.location.origin &&
      url.pathname === "/feed" &&
      /^[a-f\d]{24}$/i.test(id || "")
      ? id
      : null;
  } catch {
    return null;
  }
};

export default function MessageBubble({
  msg,
  mine,
  convoId,
  onEdit,
  onUnsend,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(msg.text || "");
  const postId = sharedPostId(msg.text);
  const canEdit = !msg.call && mine && msg._id && msg.text && onEdit;
  const canUnsend = !msg.call && mine && msg._id && onUnsend;

  const saveEdit = () => {
    if (draft.trim() && draft.trim() !== msg.text)
      onEdit(convoId, msg._id, draft.trim());
    setEditing(false);
  };

  const confirmUnsend = async () => {
    const result = await Swal.fire({
      title: "Unsend message?",
      text: "It will be removed for everyone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Unsend",
      confirmButtonColor: "#dc2626",
      reverseButtons: true,
    });
    if (result.isConfirmed) onUnsend(convoId, msg._id);
  };

  return (
    <Bubble
      align={mine ? "end" : "start"}
      variant={msg.unsent ? "outline" : mine ? "default" : "secondary"}
      className={
        msg.unsent
          ? "[&>[data-slot=bubble-content]]:border-dashed [&>[data-slot=bubble-content]]:bg-transparent"
          : mine
            ? "[&>[data-slot=bubble-content]]:bg-brand [&>[data-slot=bubble-content]]:text-white"
            : ""
      }
    >
      {msg.unsent ? (
        <BubbleContent className="text-xs italic text-muted-foreground">
          {mine ? "You unsent a message" : "Message unsent"}
        </BubbleContent>
      ) : editing ? (
        <div className="w-full min-w-40 rounded-xl border border-ring bg-background p-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                saveEdit();
              }
              if (event.key === "Escape") setEditing(false);
            }}
            autoFocus
            aria-label="Edit message text"
            rows={2}
            className="block w-full resize-y bg-transparent p-1 text-[13px] text-foreground outline-none"
          />
          <div className="flex justify-end gap-1">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md p-2 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Cancel edit"
            >
              <X size={15} />
            </button>
            <button
              type="button"
              onClick={saveEdit}
              disabled={!draft.trim()}
              className="rounded-md p-2 text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
              aria-label="Save edit"
            >
              <Check size={15} />
            </button>
          </div>
        </div>
      ) : (
        <>
          <BubbleContent>
            {msg.attachment?.kind === "image" && msg.attachment?.url && (
              <a
                href={msg.attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-1 block overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
                aria-label={`Open ${msg.attachment.name || "shared photo"}`}
              >
                <img
                  src={msg.attachment.url}
                  alt={msg.attachment.name || "Shared photo"}
                  className="max-h-56 max-w-full object-contain"
                />
              </a>
            )}
            {msg.attachment?.kind === "file" && msg.attachment?.url && (
              <a
                href={msg.attachment.url}
                download={msg.attachment.name || "file"}
                className="flex min-w-0 items-center gap-2 rounded-lg py-1 font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
              >
                <FileText className="h-4 w-4 shrink-0" />
                <span className="min-w-0 break-all">
                  {msg.attachment.name || "Download file"}
                </span>
                <Download className="h-3.5 w-3.5 shrink-0" />
              </a>
            )}
            {msg.call && (
              <span className="mb-1 flex items-center gap-2 text-xs font-semibold">
                {msg.call.status === "missed" ? (
                  <PhoneMissed size={16} />
                ) : msg.call.kind === "video" ? (
                  <Video size={16} />
                ) : (
                  <Phone size={16} />
                )}
                {mine ? "Outgoing call" : "Incoming call"}
              </span>
            )}
            {msg.text &&
              (postId ? (
                <Link
                  to={`/feed?post=${postId}`}
                  className="font-semibold underline underline-offset-2"
                >
                  View shared post →
                </Link>
              ) : (
                <p>{msg.text}</p>
              ))}
          </BubbleContent>
          {msg.edited && (
            <span className="px-1 text-[10px] text-muted-foreground">
              Edited
            </span>
          )}
          {(canEdit || canUnsend) && (
            <div className="message-actions absolute right-full top-1 mr-1 flex gap-0.5 rounded-lg border border-border bg-background p-0.5 opacity-100 shadow-sm transition-opacity sm:opacity-0 sm:group-hover/bubble:opacity-100 sm:group-focus-within/bubble:opacity-100 [@media(hover:none)]:opacity-100">
              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setDraft(msg.text || "");
                    setEditing(true);
                  }}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Edit message"
                >
                  <Pencil size={12} />
                </button>
              )}
              {canUnsend && (
                <button
                  type="button"
                  onClick={confirmUnsend}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Unsend message"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          )}
        </>
      )}
    </Bubble>
  );
}
