import UserModel from '../users/users.models.js';

// Resolve current display details at delivery time, including historical senders.
// Keep only the public fields needed by a message; do not copy full profiles.
export async function messageSenders(messages) {
  const ids = [...new Set(messages.map(message => String(message.senderAuthId || '')).filter(Boolean))];
  const profiles = await UserModel.findChatProfilesByAuthIds(ids);
  const byAuthId = new Map(profiles.map(profile => [String(profile.authId), profile]));
  return new Map(ids.map(id => {
    const profile = byAuthId.get(id);
    return [id, { senderAuthId: id,
      senderName: (typeof profile?.name === 'string' && profile.name.trim()) || 'Member',
      senderProfilePicture: typeof profile?.profilePicture === 'string' ? profile.profilePicture || null : null }];
  }));
}
