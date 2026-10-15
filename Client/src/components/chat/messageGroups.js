const senderKey = (message, isGroup) => {
  if (message.from === "me") return "me";
  if (message.senderEmail) return `email:${message.senderEmail}`;
  if (message.senderAuthId) return `auth:${message.senderAuthId}`;
  return isGroup ? null : "them";
};

// Keep each sender's consecutive messages together, as in bubble-03.
export function groupMessages(messages, isGroup = false) {
  const groups = [];
  for (const message of messages) {
    const group = groups.at(-1);
    const previous = group?.at(-1);
    const sender = senderKey(message, isGroup);
    const previousTime = Date.parse(previous?.at);
    const time = Date.parse(message.at);
    const closeInTime =
      !Number.isFinite(previousTime) ||
      !Number.isFinite(time) ||
      (time >= previousTime && time - previousTime < 5 * 60 * 1000);
    if (
      previous &&
      sender &&
      sender === senderKey(previous, isGroup) &&
      !message.unsent &&
      !previous.unsent &&
      closeInTime
    ) {
      group.push(message);
    } else {
      groups.push([message]);
    }
  }
  return groups;
}
