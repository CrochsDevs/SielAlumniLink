import { useState } from "react";
import { Users } from "lucide-react";

export default function ChatAvatar({ convo }) {
  const [failedUrl, setFailedUrl] = useState(null);
  const url = convo.profilePicture;
  if (!convo.isGroup && url && url !== failedUrl)
    return (
      <img
        src={url}
        alt={`${convo.name || "User"} profile picture`}
        className="h-full w-full rounded-full object-cover"
        onError={() => setFailedUrl(url)}
      />
    );
  return (
    <span
      role="img"
      aria-label={`${convo.name || convo.email || (convo.isGroup ? 'Group' : 'User')} avatar`}
      className="flex h-full w-full items-center justify-center rounded-full border border-zinc-300 bg-zinc-200 font-semibold text-zinc-700 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
    >
      {convo.isGroup ? <Users className="h-4 w-4" aria-hidden="true" /> :
        convo.initial || (convo.name || convo.email || "U").charAt(0).toUpperCase()}
    </span>
  );
}
