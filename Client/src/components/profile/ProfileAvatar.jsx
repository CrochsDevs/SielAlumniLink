import { useState } from 'react';

export default function ProfileAvatar({ user, fallback = 'U' }) {
  const [failedUrl, setFailedUrl] = useState(null);
  const url = user?.profilePicture;
  if (url && url !== failedUrl) {
    return (
      <img
        src={url}
        alt={`${user?.name || 'User'} profile picture`}
        className="h-full w-full rounded-full object-cover"
        onError={() => setFailedUrl(url)}
      />
    );
  }
  return (user?.name || fallback).charAt(0).toUpperCase();
}
