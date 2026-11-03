import Swal from "sweetalert2";
import {
  FileText,
  Download,
  Phone,
  PhoneMissed,
  Video,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Bubble, BubbleContent } from "../ui/bubble";
import { messageDeliveryLabel } from './messageDelivery';
import MessageActions from './MessageActions';
import ChatPhoto from './ChatPhoto';
import { chatAttachmentUrl } from '../../utils/chatAttachments';

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
  isGroup = false,
  convoId,
  onEdit,
  onUnsend,
}) {
  const postId = sharedPostId(msg.text);
  const hasPhoto = !msg.unsent && msg.attachment?.kind === 'image' && !!msg.attachment.url;
  const canEdit = !msg.call && mine && msg._id && msg.text && onEdit;
  const canUnsend = !msg.call && mine && msg._id && onUnsend;


  const confirmUnsend = async () => {
    const result = await Swal.fire({
      title: "Delete message?",
      text: "It will be removed for everyone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete message",
      confirmButtonColor: "#dc2626",
      reverseButtons: true,
    });
    if (result.isConfirmed) onUnsend(convoId, msg._id);
  };

  return (
    <Bubble
      style={hasPhoto ? { maxWidth: 'min(100%, var(--chat-photo-max-width, 320px))' } : undefined}
      data-read-id={!mine && msg._id && !msg.readByMe ? msg._id : undefined}
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
      ) : (
        <>
          {msg.attachment?.kind === 'image' && msg.attachment.url && <ChatPhoto attachment={msg.attachment} pending={!!msg.pendingId} />}
          {(msg.text || msg.call || msg.attachment?.kind === 'file') && <BubbleContent>
            {msg.attachment?.kind === "file" && msg.attachment?.url && (
              <a
                href={chatAttachmentUrl(msg.attachment)}
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
          </BubbleContent>}
          {msg.edited && !mine && (
            <span className="px-1 text-[10px] text-muted-foreground">
              Edited
            </span>
          )}
          {(canEdit || canUnsend) && (
            <MessageActions canEdit={canEdit} canDelete={canUnsend}
              onEdit={() => onEdit(convoId, msg._id, msg.text)}
              onDelete={confirmUnsend} />
          )}
        </>
      )}
      {mine && !msg.unsent && !msg.call && (
        <span className="self-end px-1 text-[10px] leading-4 text-muted-foreground" aria-live="polite"
          title={msg.read && isGroup ? 'Read by at least one other group member' : undefined}>
          {messageDeliveryLabel(msg)}
        </span>
      )}
    </Bubble>
  );
}
