import { useState } from "react";
import { Users } from "lucide-react";

export default function ChatAvatar({ convo }) {
  const [failedUrl, setFailedUrl] = useState(null);
  const url = convo.profilePicture;
  if (convo.isGroup) return <Users className="h-4 w-4" />;
  if (url && url !== failedUrl)
    return (
      <img
        src={url}
        alt={`${convo.name || "User"} profile picture`}
        className="h-full w-full rounded-full object-cover"
        onError={() => setFailedUrl(url)}
      />
    );
  return (
    convo.initial || (convo.name || convo.email || "U").charAt(0).toUpperCase()
  );
}
