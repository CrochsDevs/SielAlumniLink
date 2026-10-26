import { BubbleGroup } from "../ui/bubble";
import MessageBubble from "./MessageBubble";
import { groupMessages } from "./messageGroups";
import ChatAvatar from "./ChatAvatar";
import { formatTime } from "./messageFormat";

export default function MessageThread({
  messages,
  isGroup = false,
  convoId,
  onEdit,
  onUnsend,
  layout = "bubbles",
  user,
  conversation,
}) {
  if (layout === "stream") {
    return (
      <div className="message-stream" data-chat-thread>
        {groupMessages(messages, isGroup).map((group, index) => {
          const first = group[0];
          const mine = first.from === "me";
          const name = mine
            ? user?.name || "You"
            : isGroup
              ? first.senderName || first.senderEmail || "Member"
              : conversation?.name || first.senderEmail || "Member";
          const avatar = mine
            ? { name, profilePicture: user?.profilePicture }
            : isGroup
              ? { name }
              : { ...conversation, name };
          return (
            <section
              className="message-stream-group"
              data-align={mine ? "end" : "start"}
              key={first._id || `${convoId}-${index}`}
            >
              <span className="message-stream-avatar" aria-hidden="true">
                <ChatAvatar convo={avatar} />
              </span>
              <div className="message-stream-body">
                <div className="message-stream-author">
                  <strong>{name}</strong>
                  {first.at && (
                    <time dateTime={first.at}>{formatTime(first.at)}</time>
                  )}
                </div>
                <BubbleGroup>
                  {group.map((message, messageIndex) => (
                    <MessageBubble
                      key={message._id || messageIndex}
                      msg={message}
                      mine={message.from === "me"}
                      convoId={convoId}
                      onEdit={onEdit}
                      onUnsend={onUnsend}
                    />
                  ))}
                </BubbleGroup>
              </div>
            </section>
          );
        })}
      </div>
    );
  }
  return (
    <div className="flex min-w-0 flex-col gap-5" data-chat-thread>
      {groupMessages(messages, isGroup).map((group, index) => (
        <BubbleGroup key={group[0]._id || `${convoId}-${index}`}>
          {isGroup && group[0].from !== "me" && group[0].senderEmail && (
            <p className="truncate px-1 text-[10px] font-medium text-muted-foreground">
              {group[0].senderEmail}
            </p>
          )}
          {group.map((message, messageIndex) => (
            <MessageBubble
              key={message._id || messageIndex}
              msg={message}
              mine={message.from === "me"}
              convoId={convoId}
              onEdit={onEdit}
              onUnsend={onUnsend}
            />
          ))}
        </BubbleGroup>
      ))}
    </div>
  );
}
