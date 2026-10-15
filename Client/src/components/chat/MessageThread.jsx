import { BubbleGroup } from "../ui/bubble";
import MessageBubble from "./MessageBubble";
import { groupMessages } from "./messageGroups";

export default function MessageThread({
  messages,
  isGroup = false,
  convoId,
  onEdit,
  onUnsend,
}) {
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
