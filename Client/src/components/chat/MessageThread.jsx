import { BubbleGroup } from "../ui/bubble";
import MessageBubble from "./MessageBubble";
import { groupMessages } from "./messageGroups";
import ChatAvatar from "./ChatAvatar";
import { useVisibleMessageReads } from './useVisibleMessageReads';
import { useChat } from "../../context/useChat";
import ContentSkeleton from "../ui/Skeleton";

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
  const readRoot = useVisibleMessageReads(convoId, messages);
  const { threadLoading, threads } = useChat();
  if (convoId && !threads?.[convoId] && threadLoading?.[convoId] !== false && !messages.length) {
    return <ContentSkeleton variant="messages" label="Loading messages" />;
  }
  if (layout === "stream") {
    return (
      <div ref={readRoot} className="message-stream" data-chat-thread>
        {groupMessages(messages, isGroup).map((group, index) => {
          const first = group[0];
          const mine = first.from === "me";
          const name = mine
            ? user?.name || "You"
            : isGroup
              ? first.senderName || "Member"
              : conversation?.name || first.senderEmail || "Member";
          const avatar = mine
            ? { name, profilePicture: user?.profilePicture }
            : isGroup
              ? { name, profilePicture: first.senderProfilePicture }
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
                <BubbleGroup>
                  {group.map((message, messageIndex) => (
                    <MessageBubble
                      key={message._id || messageIndex}
                      msg={message}
                      isGroup={isGroup}
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
    <div ref={readRoot} className="flex min-w-0 flex-col gap-5" data-chat-thread>
      {groupMessages(messages, isGroup).map((group, index) => {
        const first = group[0];
        const mine = first.from === 'me';
        const name = (isGroup ? first.senderName : conversation?.name || first.senderName) || 'Member';
        const avatar = { name, profilePicture: (isGroup ? first.senderProfilePicture : conversation?.profilePicture || first.senderProfilePicture) || null };
        return (
          <div key={first._id || `${convoId}-${index}`} data-message-group data-align={mine ? 'end' : 'start'} className="flex min-w-0 items-end gap-2">
            {!mine && <span data-message-avatar className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-[11px] font-semibold text-primary" title={name}>
              <ChatAvatar convo={avatar} />
            </span>}
            <BubbleGroup className="min-w-0 flex-1">
              {isGroup && !mine && <span className="truncate px-1 text-[10px] font-medium text-muted-foreground">{name}</span>}
              {group.map((message, messageIndex) => (
                <MessageBubble
                  key={message._id || messageIndex}
                  msg={message}
                  isGroup={isGroup}
                  mine={message.from === "me"}
                  convoId={convoId}
                  onEdit={onEdit}
                  onUnsend={onUnsend}
                />
              ))}
            </BubbleGroup>
          </div>
        );
      })}
    </div>
  );
}
