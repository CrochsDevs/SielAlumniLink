const actions = {
  feed_comment: 'commented on your post.',
  feed_like: 'liked your post.',
  feed_share: 'shared your post.',
};

export function createFeedNotifier({ notifications, emit }) {
  return async ({ post, user, actorName, kind, eventId }) => {
    if (!actions[kind] || String(post.authorAuthId) === String(user._id)) return;
    const notification = await notifications.notify({
      recipientAuthId: post.authorAuthId,
      actorAuthId: user._id,
      kind,
      title: `${actorName || 'A member'} ${actions[kind]}`,
      body: (post.title || post.body || 'Community post').slice(0, 160),
      link: `/feed?post=${encodeURIComponent(String(post._id))}`,
      // A repeated like does not spam the author. New comments/reposts each
      // have their own saved action ID and notify once per action.
      dedupKey: `feed:${post._id}:${user._id}:${kind}:${kind === 'feed_like' ? 'like' : eventId}`,
    });
    if (notification) emit(post.authorAuthId, 'notification:new', notification);
  };
}
