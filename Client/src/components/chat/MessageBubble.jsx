import Swal from "sweetalert2";
import {
  FileText,
  Download,
  Phone,
  PhoneMissed,
  PhoneOff,
  Video,
  VideoOff,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Bubble, BubbleContent } from "../ui/bubble";
import { messageDeliveryLabel } from './messageDelivery';
import MessageActions from './MessageActions';
import ChatPhoto from './ChatPhoto';
import { chatAttachmentUrl } from '../../utils/chatAttachments';
import './MessageBubble.css';

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
  const missedCall = msg.call?.status === 'missed';
  const declinedCall = msg.call?.status === 'declined';
  const callType = msg.call?.kind === 'video' ? 'video' : 'voice';
  const callDuration = Math.max(0, Math.floor(Number(msg.call?.duration) || 0));
  const durationLabel = `${Math.floor(callDuration / 60)}:${String(callDuration % 60).padStart(2, '0')}`;
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
      data-call-status={msg.call?.status}
      variant={msg.unsent ? "outline" : missedCall ? "destructive" : msg.call ? "outline" : mine ? "default" : "secondary"}
      className={
        msg.unsent
          ? "[&>[data-slot=bubble-content]]:border-dashed [&>[data-slot=bubble-content]]:bg-transparent"
          : msg.call
            ? "chat-call-card"
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
              <div className="chat-call-card__layout">
                <span className="chat-call-card__icon" aria-hidden="true">
                  {declinedCall
                    ? callType === 'video' ? <VideoOff size={19} /> : <PhoneOff size={19} />
                    : callType === 'video' ? <Video size={19} /> : missedCall ? <PhoneMissed size={19} /> : <Phone size={19} />}
                </span>
                <div className="chat-call-card__details">
                  <p className="chat-call-card__title">
                    {missedCall ? `Missed ${callType} call` : `${callType === 'video' ? 'Video' : 'Voice'} call ${msg.call.status === 'declined' ? 'declined' : 'ended'}`}
                  </p>
                  <p className="chat-call-card__subtitle">
                    {mine ? 'Outgoing call' : 'Incoming call'}
                    {declinedCall && <> &middot; {mine ? 'Declined' : 'You declined'}</>}
                    {msg.call.status === 'completed' && <> &middot; <span className="chat-call-card__duration">{durationLabel}</span></>}
                    {missedCall && mine && <> &middot; No answer</>}
                  </p>
                </div>
              </div>
            )}
            {msg.text && !msg.call &&
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
