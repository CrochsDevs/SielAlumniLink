import { useState } from "react";
import Swal from "sweetalert2";
import { Pencil, Trash2, Check, X, FileText, Download } from "lucide-react";
import { Link } from "react-router-dom";

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

// Shared chat bubble: edited label, unsent tombstone,
// hover actions (edit/unsend) for your own messages.
const MessageBubble = ({ msg, mine, convoId, onEdit, onUnsend }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(msg.text);

  if (msg.unsent) {
    return (
      <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
        <p className="max-w-[75%] rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-600 px-3.5 py-2 text-[12px] italic text-zinc-400 dark:text-zinc-500">
          {mine ? "You unsent a message" : "Message unsent"}
        </p>
      </div>
    );
  }

  const saveEdit = () => {
    if (!draft.trim() || draft === msg.text) {
      setEditing(false);
      return;
    }
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
    <div className={`group flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] ${mine ? "items-end" : "items-start"} flex flex-col`}
      >
        {editing ? (
          <div className="w-full rounded-2xl border border-[#009639] bg-white dark:bg-zinc-800 p-1.5">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit();
                if (e.key === "Escape") setEditing(false);
              }}
              autoFocus
              className="w-full bg-transparent px-2 py-1 text-[13px] text-zinc-800 dark:text-zinc-100 outline-none"
            />
            <div className="flex justify-end gap-1 px-1 pb-0.5">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                aria-label="Cancel edit"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={saveEdit}
                className="rounded-md p-1 text-[#009639]"
                aria-label="Save edit"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="relative">
            {msg.attachment?.kind === "image" && msg.attachment?.url && (
              <img
                src={msg.attachment.url}
                alt={msg.attachment.name || "Shared photo"}
                className="mb-1 max-h-56 w-full rounded-xl object-cover"
              />
            )}
            {msg.attachment?.kind === "file" && msg.attachment?.url && (
              <a
                href={msg.attachment.url}
                download={msg.attachment.name || "file"}
                className={`mb-1 flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-semibold ${
                  mine
                    ? "bg-white/15 text-white hover:bg-white/25"
                    : "bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200"
                }`}
              >
                <FileText className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">
                  {msg.attachment.name || "File"}
                </span>
                <Download className="h-3.5 w-3.5 shrink-0" />
              </a>
            )}
            {msg.text ? (
              <p
                className={`rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed shadow-sm ${
                  mine
                    ? "rounded-br-md bg-[#009639] text-white"
                    : "rounded-bl-md border border-zinc-100 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100"
                }`}
              >
                {sharedPostId(msg.text) ? (
                  <Link
                    to={`/feed?post=${sharedPostId(msg.text)}`}
                    className="font-semibold underline"
                  >
                    View shared post →
                  </Link>
                ) : (
                  msg.text
                )}
              </p>
            ) : null}
            {mine && msg._id && (
              <span className="absolute -left-9 top-1/2 hidden -translate-y-1/2 gap-0.5 group-hover:flex">
                <button
                  type="button"
                  onClick={() => {
                    setDraft(msg.text);
                    setEditing(true);
                  }}
                  className="rounded-full bg-white dark:bg-zinc-800 p-1.5 text-zinc-400 shadow border border-zinc-200 dark:border-zinc-700 hover:text-[#009639]"
                  aria-label="Edit message"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => confirmUnsend()}
                  className="rounded-full bg-white dark:bg-zinc-800 p-1.5 text-zinc-400 shadow border border-zinc-200 dark:border-zinc-700 hover:text-red-600"
                  aria-label="Unsend message"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
        )}
        <span className="mt-0.5 flex items-center gap-1 px-1 text-[9.5px] font-medium text-zinc-400 dark:text-zinc-500">
          {msg.edited && !editing ? "Edited" : ""}
        </span>
      </div>
    </div>
  );
};

export default MessageBubble;
